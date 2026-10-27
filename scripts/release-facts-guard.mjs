// @ts-nocheck
/**
 * Release-facts guard (audit C §4.2 / §4 HIGH-4).
 *
 * The unit-test triage deleted 29 script/harness self-tests. Two of them pinned
 * facts that are genuinely load-bearing and are NOT observable from product code
 * or E2E, so they were moved here rather than dropped:
 *
 *  1. **The PWA worker carries a GENERATED cache version.** `public/sw.js` must
 *     hold the `__SUPERHABITS_CACHE_VERSION__` token, not a hand-maintained
 *     `v10`, and every export lane must run the shared revision injection.
 *     Browser worker updates are detected by BYTE comparison, so a worker whose
 *     version was forgotten strands every existing client on the old shell
 *     (AUD-SH05-A). The revision arithmetic itself stays in
 *     `scripts/pwa-shell-revision.mjs`; this gate only checks the wiring that
 *     makes it run.
 *
 *  2. **The gating E2E lanes stay independent of the dependency-security
 *     audit.** `e2e` and `nightly` must not grow a `needs: quality` edge, and
 *     the report-only `dist-sync` lane must not become a hard step of the
 *     gating `e2e` job. When they were coupled, an audit that was correctly red
 *     on a known advisory skipped every hosted E2E lane, so the functional state
 *     of `main` silently disappeared from CI
 *     (change `security-blocked-ci-qualification-recovery`).
 *
 * App/store version consistency is enforced in
 * `tests/store-declaration-drift.test.ts` instead — it belongs with the other
 * declaration-drift pins, and that file already reads `app.json`/`eas.json`.
 *
 * Deliberately a plain structural reader over the workflow text: there is no
 * YAML dependency in this repository, and adding one to a quality gate would be
 * its own lane-integrity defect.
 *
 * Wired into `qa:fast`. Exit 1 with a named diff on any mismatch.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

/** Export lanes that must inject the shared shell revision. */
export const SHELL_REVISION_LANES = [
  'scripts/build-dist-web.mjs',
  'scripts/build-dist-e2e.mjs',
  'scripts/build-dist-sync.mjs',
];

/** Jobs that must never depend on the `quality` job's outcome. */
export const INDEPENDENT_JOBS = ['e2e', 'nightly'];

/**
 * The tracked worker template must carry the generated token and no
 * hand-maintained numeric version.
 *
 * @param {string} source `public/sw.js` contents
 * @returns {string[]} problems (empty = clean)
 */
export function checkWorkerTemplate(source) {
  const problems = [];
  if (!source.includes("const CACHE_VERSION = '__SUPERHABITS_CACHE_VERSION__';")) {
    problems.push(
      'public/sw.js does not declare CACHE_VERSION from __SUPERHABITS_CACHE_VERSION__; ' +
        'a hand-maintained version strands existing clients on the old precached shell.',
    );
  }
  if (/const CACHE_VERSION = 'v\d+';/.test(source)) {
    problems.push(
      'public/sw.js carries a hand-maintained numeric CACHE_VERSION; the revision must be generated.',
    );
  }
  return problems;
}

/**
 * Every lane that produces a deployable/installable export must run the shared
 * revision step and VERIFY it.
 *
 * @param {Record<string, string>} laneSources file path -> contents
 * @returns {string[]} problems (empty = clean)
 */
export function checkLanesInjection(laneSources) {
  const problems = [];
  for (const [file, source] of Object.entries(laneSources)) {
    if (!source.includes('applyShellRevision')) {
      problems.push(`${file} does not call applyShellRevision(), so its worker carries no revision.`);
    }
    if (!source.includes('assertRevisionIsContentDerived')) {
      problems.push(
        `${file} does not call assertRevisionIsContentDerived(), so a broken revision ships silently.`,
      );
    }
  }
  return problems;
}

/**
 * Split a workflow into job blocks keyed by the two-space job name.
 *
 * @param {string} source workflow YAML text
 * @returns {Map<string, string>} job name -> block text
 */
export function splitJobs(source) {
  const jobs = new Map();
  const lines = source.split('\n');
  let name = null;
  let body = [];
  const flush = () => {
    if (name !== null) jobs.set(name, body.join('\n'));
    name = null;
    body = [];
  };
  let inJobs = false;
  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    const jobKey = /^ {2}([A-Za-z][\w-]*):\s*$/.exec(line);
    if (jobKey) {
      flush();
      name = jobKey[1];
      body = [line];
      continue;
    }
    if (name !== null) body.push(line);
  }
  flush();
  return jobs;
}

/**
 * The gating lanes stay independent of `quality`, and the report-only dist-sync
 * lane stays out of the gating `e2e` job.
 *
 * @param {string} source `.github/workflows/ci.yml` contents
 * @returns {string[]} problems (empty = clean)
 */
export function checkCiLaneIndependence(source) {
  const problems = [];
  const jobs = splitJobs(source);
  for (const name of INDEPENDENT_JOBS) {
    const block = jobs.get(name);
    if (block === undefined) {
      problems.push(`ci.yml has no "${name}" job; the lane contract cannot be verified.`);
      continue;
    }
    if (/^ {4}needs:/m.test(block) || /^ {4}needs\s*:[^\n]*\bquality\b/m.test(block)) {
      problems.push(
        `ci.yml "${name}" job depends on the quality job; a correctly-red dependency audit ` +
          'would skip the lane and hide its functional result.',
      );
    }
    if (block.includes('scripts/audit-runtime-deps.mjs')) {
      problems.push(
        `ci.yml "${name}" job runs the dependency audit; it belongs to the quality gate only.`,
      );
    }
  }

  const e2e = jobs.get('e2e');
  if (e2e !== undefined && /\bnpm run e2e:sync\b/.test(e2e)) {
    problems.push(
      'ci.yml gating "e2e" job runs the report-only dist-sync lane; that lane is nightly-only ' +
        "(simulation/matrix.ts declares it gates: false).",
    );
  }
  return problems;
}

function readIfPresent(relative) {
  try {
    return readFileSync(join(root, relative), 'utf8');
  } catch {
    return null;
  }
}

function main() {
  const problems = [];

  const worker = readIfPresent('public/sw.js');
  if (worker === null) problems.push('public/sw.js is missing.');
  else problems.push(...checkWorkerTemplate(worker));

  const laneSources = {};
  for (const lane of SHELL_REVISION_LANES) {
    const source = readIfPresent(lane);
    if (source === null) problems.push(`${lane} is missing.`);
    else laneSources[lane] = source;
  }
  problems.push(...checkLanesInjection(laneSources));

  const ci = readIfPresent('.github/workflows/ci.yml');
  if (ci === null) problems.push('.github/workflows/ci.yml is missing.');
  else problems.push(...checkCiLaneIndependence(ci));

  if (problems.length > 0) {
    console.error(`release-facts-guard: FAILED — ${problems.length} problem(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(
    `release-facts-guard: OK — worker revision is generated, ` +
      `${Object.keys(laneSources).length} export lane(s) inject and verify it, and ` +
      `${INDEPENDENT_JOBS.join('/')} stay independent of the quality job.`,
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url ===
    pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) main();
