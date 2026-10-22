/**
 * Release-readiness verdict.
 *
 * WHY THIS EXISTS
 * ---------------
 * Release authorization today lives entirely in prose: `docs/release/*.md`
 * explain what is blocked, and `submission-package.md` lists 16 owner actions
 * (R01–R16). Nothing computes an answer. That makes "is this release-ready?" a
 * question each reader re-derives by hand, and it makes an accidental claim of
 * readiness impossible to contradict mechanically.
 *
 * This script produces ONE verdict from evidence that can actually be checked in
 * the repository, and it is deliberately CONSERVATIVE: every input is a HARD
 * BLOCKER, so the verdict can only become READY when a human has removed each
 * one at its source. It never "infers" readiness from absence of information —
 * an unreadable or missing input is a blocker, not a pass.
 *
 * WHAT IT CHECKS (all repository-observable)
 *   1. Unresolved dependency advisories: the production-dependency gate must be
 *      green. A red gate is a blocker regardless of why.
 *   2. Owner actions outstanding: `[OWNER ACTION]` markers plus the R01–R16
 *      inventory rows that have no recorded resolution.
 *   3. Production hold: the Vercel Git-deployment hold for `main` must be
 *      PRESENT. Removing it is a release decision, so its absence is a blocker.
 *   4. Native signing: the release posture record must still say UNPROVEN. A
 *      record that claims provenance without an artifact is itself a blocker
 *      (it would be a false certification).
 *   5. Store submission credentials: `eas.json` `submit.production` must stay
 *      `{}` in the repository.
 *
 * WHAT IT EXPLICITLY CANNOT SEE
 *   Hosted Supabase/RLS state, real device/simulator behavior, store console
 *   status, artifact signatures, and legal review. Those stay owner actions, and
 *   the verdict says so instead of implying this script covers them.
 *
 * USAGE
 *   node scripts/release-readiness.mjs           # human verdict
 *   node scripts/release-readiness.mjs --json    # machine-readable
 * Exit codes: 0 = READY (all blockers cleared), 1 = BLOCKED, 2 = script error.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_DIR = join(ROOT, 'docs', 'release');

/**
 * All markdown files under a repository-relative directory, recursively.
 * The owner-action marker scan uses this so markers recorded outside the
 * top level of docs/release cannot hide from the verdict (NC-2).
 */
function collectMarkdownFiles(relDir) {
  const absolute = join(ROOT, relDir);
  const out = [];
  if (!existsSync(absolute)) return out;
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const rel = join(relDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectMarkdownFiles(rel));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(rel);
    }
  }
  return out;
}

/** A blocker is never downgraded to a warning; that is the point. */
export const SEVERITY = 'blocker';

/**
 * Read and parse a JSON file from the repository root, without throwing.
 *
 * Returns a discriminated result instead of throwing, because a readiness
 * verdict must NEVER crash and must never treat an unreadable input as a pass.
 * A thrown helper relies on every caller remembering to wrap it; returning
 * `{ ok: false }` makes the failure impossible to ignore at the call site.
 */
function readJson(relativePath) {
  try {
    return { ok: true, value: JSON.parse(readFileSync(join(ROOT, relativePath), 'utf8')) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function readText(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

/**
 * 1. Dependency advisories.
 *
 * Reuses the EXISTING gate rather than re-implementing advisory logic, so this
 * can never disagree with the `quality` job. A non-zero exit is a blocker even
 * if the specific advisory is theoretically unreachable: the policy is
 * "critical/high must be zero", and this script does not get to reinterpret it.
 */
export function checkDependencyAdvisories() {
  const blockers = [];
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'audit-runtime-deps.mjs')], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const out = `${error?.stdout ?? ''}${error?.stderr ?? ''}`;
    // npm reports one finding per vulnerable PATH, so the same advisory appears
    // more than once. Deduplicate on the `package GHSA` pair: the blocker must
    // name the distinct advisories, not repeat itself per path.
    const advisories = [
      ...new Set(
        [
          ...out.matchAll(/\[(?:UNDOCUMENTED|DOCUMENTED)[^\]]*\]\s+\S+\s+(\S+)\s+(GHSA-[\w-]+)/g),
        ].map((match) => `${match[1]} ${match[2]}`),
      ),
    ];
    // Without a documented allowlist left, any finding is undocumented; report
    // whichever ones the gate printed so the blocker names the real advisory.
    blockers.push({
      id: 'DEP-ADVISORY',
      severity: SEVERITY,
      detail:
        advisories.length > 0
          ? `production dependency gate is red: ${advisories.join(', ')}`
          : 'production dependency gate is red (no parsed advisory; run `node scripts/audit-runtime-deps.mjs`)',
      ownerAction:
        'Remediate the advisory, or obtain a governed policy decision. No waiver is implied.',
    });
  }
  return blockers;
}

/**
 * 2. Owner actions.
 *
 * Counts `[OWNER ACTION` markers across the release docs (the repository's own
 * convention) and detects the R01–R16 inventory rows. The marker count is a
 * FLOOR, not a completion tracker: this script cannot know when an owner has
 * done the work in an external console, so it reports the outstanding surface
 * and requires a human to update the source documents. That direction of
 * uncertainty is intentional — it can never accidentally report "done".
 */
export function checkOwnerActions() {
  const blockers = [];
  if (!existsSync(RELEASE_DIR)) {
    blockers.push({
      id: 'OWNER-INVENTORY',
      severity: SEVERITY,
      detail: 'docs/release does not exist; the owner-action inventory cannot be evaluated',
      ownerAction: 'Restore the release documentation before claiming readiness.',
    });
    return blockers;
  }

  // Scan the ACTIONABLE surfaces recursively: docs/release (the marker home),
  // docs/testing (known-gap owner actions), and README. Historical record
  // trees (docs/reports, docs/knowledge-base) are deliberately excluded: a
  // report that QUOTES the marker convention is a record, not open work —
  // counting it would pin the verdict shut forever on untouchable evidence
  // files. The matcher is the plain `[OWNER ACTION` substring (real markers
  // in this corpus are backticked placeholders like `[OWNER ACTION: …]`, so
  // any punctuation-aware refinement would fail open). The count direction
  // may only over-report work that exists.
  const markerPattern = /\[OWNER ACTION/gi;
  const docFiles = [
    ...collectMarkdownFiles(join('docs', 'release')),
    ...collectMarkdownFiles(join('docs', 'testing')),
    ...(existsSync(join(ROOT, 'README.md')) ? [join('README.md')] : []),
  ];
  let markerCount = 0;
  const perDoc = {};
  const unreadableDocs = [];
  for (const relPath of docFiles) {
    let text;
    try {
      text = readText(relPath);
    } catch {
      // An unreadable document is a NAMED BLOCKER (never a crash and never a
      // silent zero): the script must not report "0 owner actions" from files
      // it could not read.
      unreadableDocs.push(relPath);
      continue;
    }
    const matches = text.match(markerPattern) ?? [];
    if (matches.length > 0) {
      perDoc[relPath] = matches.length;
      markerCount += matches.length;
    }
  }
  if (unreadableDocs.length > 0) {
    blockers.push({
      id: 'OWNER-ACTION-SCAN',
      severity: SEVERITY,
      detail: `owner-action marker scan could not read ${unreadableDocs.length} document(s): ${unreadableDocs.join(', ')}`,
      ownerAction: 'Restore those documents before claiming readiness.',
    });
  }

  // The inventory is the authoritative owner-action list. If it is missing or
  // unreadable, that is a BLOCKER, not a crash and not a silent zero: reporting
  // "0 owner actions" from a file that could not be read would be a false
  // ready-signal, which is the exact failure mode this script exists to prevent.
  let inventoryRows = new Set();
  try {
    const submission = readText(join('docs', 'release', 'submission-package.md'));
    inventoryRows = new Set(
      [...submission.matchAll(/^\|\s*\**R\d{1,2}\**\s*\|/gm)].map((m) => {
        const digits = m[0].replace(/[^\d]/g, '');
        return `R${digits.padStart(2, '0')}`;
      }),
    );
  } catch {
    blockers.push({
      id: 'OWNER-INVENTORY',
      severity: SEVERITY,
      detail:
        'docs/release/submission-package.md is unreadable, so the owner-action inventory cannot be evaluated',
      ownerAction: 'Restore the submission package before claiming readiness.',
    });
  }

  if (markerCount > 0) {
    blockers.push({
      id: 'OWNER-ACTION-MARKERS',
      severity: SEVERITY,
      detail: `${markerCount} \`[OWNER ACTION\` marker(s) across ${Object.keys(perDoc).length} release document(s): ${Object.entries(
        perDoc,
      )
        .map(([name, count]) => `${name}=${count}`)
        .join(', ')}`,
      ownerAction:
        'Complete the underlying owner work and update the source documents. Console/legal/credential work is not observable from this repository.',
    });
  }

  if (inventoryRows.size > 0) {
    blockers.push({
      id: 'OWNER-INVENTORY',
      severity: SEVERITY,
      detail: `${inventoryRows.size} owner action(s) remain in the submission inventory (${[
        ...inventoryRows,
      ]
        .sort()
        .join(', ')})`,
      ownerAction:
        'Resolve each row in docs/release/submission-package.md and remove it from the inventory.',
    });
  }

  return blockers;
}

/** 3. Production deployment hold must still be in place. */
export function checkProductionHold() {
  const blockers = [];
  const parsed = readJson('vercel.json');
  if (!parsed.ok) {
    blockers.push({
      id: 'PROD-HOLD',
      severity: SEVERITY,
      detail: `vercel.json is unreadable (${parsed.reason}), so the production deployment hold cannot be verified`,
      ownerAction: 'Restore vercel.json with the documented hold.',
    });
    return blockers;
  }
  const vercel = parsed.value;

  const enabled = vercel?.git?.deploymentEnabled ?? {};
  // Vercel precedence: if a branch matches multiple rules and ANY is true, a
  // deployment occurs. So `main: false` alone is not sufficient evidence while
  // any wildcard-ish rule is truthy. NC-1: the previous check only noticed the
  // literal keys `*`/`**`, so `"ma*": true` (or a string-truthy value) could
  // certify a bypassed hold as safe. Glob semantics for these keys are a
  // Vercel-side behavior this script cannot observe, so the CONSERVATIVE
  // reading is the only honest one: any pattern-shaped key with a non-false
  // value is a potential bypass and must block.
  const wildcardBypass = Object.entries(enabled).filter(
    ([branch, value]) => /[*?{[]/.test(branch) && value !== false,
  );
  const hasWildcardTrue = wildcardBypass.length > 0;
  if (enabled.main !== false || hasWildcardTrue) {
    blockers.push({
      id: 'PROD-HOLD',
      severity: SEVERITY,
      detail: hasWildcardTrue
        ? `pattern-shaped deployment rules with non-false values override \`main: false\` in Vercel precedence: ${wildcardBypass
            .map(([branch, value]) => `${branch}=${JSON.stringify(value)}`)
            .join(', ')}`
        : `vercel.json git.deploymentEnabled.main is ${JSON.stringify(enabled.main)}, not false`,
      ownerAction:
        'This is a RELEASE DECISION, not a bug. Only remove the hold as part of an authorized production release.',
    });
  }
  return blockers;
}

/** 4. Native signing must still be honest about being unproven. */
export function checkNativeSigning() {
  const blockers = [];
  const path = join('docs', 'release', 'release-signing-posture.md');
  if (!existsSync(join(ROOT, path))) {
    blockers.push({
      id: 'NATIVE-SIGNING',
      severity: SEVERITY,
      detail: 'release-signing-posture.md is missing, so signing provenance is undetermined',
      ownerAction: 'Restore the signing posture record.',
    });
    return blockers;
  }

  const text = readText(path);
  // A record that asserts a store-signed artifact exists, without one, is worse
  // than one that admits the gap: it is a false certification. The fabrication
  // family is intentionally broad (adversarial review P2/NC-3: paraphrases
  // like "production-signed" must not slip past either side of this gate).
  const claimsSigned =
    /(?:signed with|signed by) the (?:production|upload|release)[^\n]{0,40}(?:key|keystore|certificate)|production-signed\b/i.test(
      text,
    );
  const admitsUnproven = /UNPROVEN RELEASE POSTURE/i.test(text);
  if (!admitsUnproven || claimsSigned) {
    blockers.push({
      id: 'NATIVE-SIGNING',
      severity: SEVERITY,
      detail: claimsSigned
        ? 'the signing record claims a production-signed artifact, which cannot be true without one'
        : 'the signing record no longer states UNPROVEN RELEASE POSTURE',
      ownerAction:
        'Produce real production-signed Android/iOS artifacts from the intended SHA and record their provenance, or restore the honest record.',
    });
  }
  return blockers;
}

/** 5. Store submission credentials must not be committed. */
export function checkSubmitCredentials() {
  const blockers = [];
  const parsedEas = readJson('eas.json');
  if (!parsedEas.ok) {
    blockers.push({
      id: 'SUBMIT-CREDENTIALS',
      severity: SEVERITY,
      detail: `eas.json is unreadable (${parsedEas.reason}), so the submission credential posture cannot be verified`,
      ownerAction: 'Restore eas.json to the documented credential-free posture.',
    });
    return blockers;
  }
  const submit = parsedEas.value?.submit?.production;
  if (submit === undefined || Object.keys(submit).length > 0) {
    blockers.push({
      id: 'SUBMIT-CREDENTIALS',
      severity: SEVERITY,
      detail: `eas.json submit.production must stay {} in the repository; found ${JSON.stringify(submit)}`,
      ownerAction: 'Move submission credentials to owner-controlled EAS state; never commit them.',
    });
  }
  return blockers;
}

/**
 * Inputs this script CANNOT evaluate. Listed explicitly in the verdict so the
 * output never reads as broader than the evidence behind it.
 */
export const UNOBSERVABLE_INPUTS = [
  'hosted Supabase project state, applied migrations, and RLS policies',
  'real Android/iOS device or simulator certification',
  'App Store Connect / Play Console status, ratings, agreements',
  'artifact signing certificates and store-accepted builds',
  'legal review, trader status, and privacy-form answers',
];

/**
 * The verdict is about REPOSITORY-OBSERVABLE evidence ONLY.
 *
 * Adversarial review P1: the old verdict read `READY` when blockers were empty,
 * which contradicts this script's own disclosure that the decisive release
 * conditions (hosted certifications, device runs, store/legal owner actions,
 * release authorization) live OUTSIDE the repository. There is no repository-
 * local state from which this script may honestly claim release readiness, so
 * the positive verdict is named for what it actually proves.
 */
export function computeVerdict(blockerCount) {
  return blockerCount === 0 ? 'REPO_CHECKS_CLEAR' : 'BLOCKED';
}

export function evaluateReleaseReadiness() {
  const blockers = [
    ...checkDependencyAdvisories(),
    ...checkOwnerActions(),
    ...checkProductionHold(),
    ...checkNativeSigning(),
    ...checkSubmitCredentials(),
  ];
  return {
    verdict: computeVerdict(blockers.length),
    blockerCount: blockers.length,
    blockers,
    unobservable: UNOBSERVABLE_INPUTS,
    // Constant, non-clearable, and loud: repository checks passing is NOT
    // release authorization and never implies it.
    releaseAuthorized: false,
  };
}

function main(argv) {
  const result = evaluateReleaseReadiness();
  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(`release-readiness: ${result.verdict} (${result.blockerCount} blocker(s))`);
    console.log('');
    for (const blocker of result.blockers) {
      console.log(`  [${blocker.severity}] ${blocker.id}`);
      console.log(`      ${blocker.detail}`);
      console.log(`      owner: ${blocker.ownerAction}`);
    }
    console.log('');
    console.log('  NOT evaluated by this script (owner-observable only):');
    for (const item of result.unobservable) console.log(`    - ${item}`);
    console.log('');
    console.log(
      '  REPO_CHECKS_CLEAR is not release authorization. Production release requires ' +
        'the external certifications above plus explicit owner authorization.',
    );
  }
  return result.verdict === 'READY' ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] !== undefined && process.argv[1].endsWith('release-readiness.mjs');
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
