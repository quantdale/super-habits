// @ts-nocheck
/**
 * Native flow-coverage proof for the Android lane
 * (`harden-native-evidence-and-release-posture`, tasks 2.1-2.2).
 *
 * WHY: `scripts/qa-native.mjs` mapped ONLY Maestro's process exit code to
 * `PASS`. `maestro test --include-tags=<tag>` exits 0 whether it ran the six
 * flows the tag selects or zero of them, so a renamed tag, a moved flow, or a
 * workspace glob that stopped matching produced the same `PASS` as a full
 * green battery. The iOS lane (`scripts/qa-ios-github-actions.mjs:50-51,248`)
 * already refuses that: it resolves an expected flow list, asserts it is
 * non-empty and duplicate-free, and passes only when the executed count equals
 * the expected count with every flow passing. This module is the Android
 * equivalent, kept pure so both the runner and its unit test use one
 * implementation.
 *
 * The executed set is read from Maestro's own debug output, which the runner
 * already requests (`--debug-output <dir>`) and which contains one directory
 * per flow that actually ran. If that evidence is missing, coverage is
 * `UNPROVEN` — never an assumption that the run was complete.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

export const COVERAGE_OK = 'OK';
export const COVERAGE_UNPROVEN = 'UNPROVEN';
export const COVERAGE_MISMATCH = 'MISMATCH';

/**
 * Read the `tags:` list from a Maestro flow file.
 *
 * Maestro's flow header is `appId:` then an optional `tags:` list; the
 * document body starts at the `---` separator. Only the list is needed, and a
 * hand parser keeps the lane free of a YAML dependency (the same reasoning as
 * the workflow reader in tests/ciLaneIntegrity.test.ts).
 *
 * @param {string} source
 * @returns {string[]}
 */
export function parseFlowTags(source) {
  const lines = source.split(/\r?\n/);
  const tags = [];
  let inTags = false;
  for (const line of lines) {
    if (!inTags) {
      if (/^tags:\s*$/.test(line)) inTags = true;
      else if (/^tags:\s*\S/.test(line)) {
        // Inline form: `tags: [a, b]` is not used by this repository's flows,
        // but a non-empty inline value must not be silently ignored.
        const inline = line.replace(/^tags:\s*/, '').trim();
        if (inline.length > 0) tags.push(inline.replace(/^\[|\]$/g, ''));
        inTags = false;
      } else if (/^---\s*$/.test(line)) break;
      continue;
    }
    // An INDENTED list item belongs to the tag list; a top-level `- ` item is
    // the flow document body (`- launchApp:`) and ends the header.
    const item = /^\s+-\s+(.+?)\s*$/.exec(line);
    if (item) {
      tags.push(item[1].replace(/^['"]|['"]$/g, ''));
      continue;
    }
    break;
  }
  return tags;
}

/**
 * Flow identity used for comparison: the file's base name without extension,
 * which is exactly the directory name Maestro writes per executed flow.
 *
 * @param {string} file
 * @returns {string}
 */
export function flowId(file) {
  return basename(file).replace(/\.(ya?ml)$/i, '');
}

/**
 * Every Maestro flow under `flowsDir`, sorted for deterministic output.
 *
 * @param {string} flowsDir
 * @returns {string[]} absolute paths
 */
export function listFlowFiles(flowsDir) {
  if (!existsSync(flowsDir)) return [];
  /** @type {string[]} */
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ya?ml)$/i.test(entry.name)) files.push(full);
    }
  };
  walk(flowsDir);
  return files;
}

/**
 * Resolve the flows the lane is expected to execute.
 *
 * Tag mode mirrors Maestro's `--include-tags` semantics for a single tag (a
 * flow matches when it carries that tag). `--flow` mode expects exactly that
 * file. Whole-workspace mode expects every flow the workspace glob selects.
 *
 * @param {object} options
 * @param {string} options.flowsDir
 * @param {string | null} [options.tag]
 * @param {string | null} [options.flow] absolute path from `--flow`
 * @param {string[]} [options.includeTags] extra tags the workspace config filters on
 * @returns {{ flows: { id: string, path: string }[], errors: string[] }}
 */
export function resolveExpectedFlows({ flowsDir, tag = null, flow = null, includeTags = [] }) {
  const all = listFlowFiles(flowsDir);
  /** @type {string[]} */
  const errors = [];
  if (flow) {
    if (!existsSync(flow)) {
      return { flows: [], errors: [`Requested flow does not exist: ${flow}`] };
    }
    return { flows: [{ id: flowId(flow), path: flow }], errors };
  }
  const required = [tag, ...includeTags].filter(Boolean);
  const selected = required.length
    ? all.filter((file) => {
        const tags = parseFlowTags(readFileSync(file, 'utf8'));
        return required.every((needed) => tags.includes(needed));
      })
    : all;
  if (selected.length === 0) {
    errors.push(
      required.length
        ? `No Maestro flow carries the requested tag(s) [${required.join(', ')}] in ${flowsDir}.`
        : `No Maestro flow files were found in ${flowsDir}.`,
    );
  }
  const flows = selected.map((file) => ({ id: flowId(file), path: file }));
  const duplicates = [
    ...new Set(
      flows.map((entry) => entry.id).filter((id, index, allIds) => allIds.indexOf(id) !== index),
    ),
  ];
  if (duplicates.length > 0) {
    errors.push(
      `Flow identity is ambiguous: ${duplicates.join(', ')} resolve to the same id, so the executed set could not be compared. Rename one of them.`,
    );
  }
  return { flows, errors };
}

/**
 * Describe the binary a run actually executed (task 2.4).
 *
 * A `--no-provision` run is allowed — a deliberate re-check of an installed
 * build is a documented use — but its record must be SELF-IDENTIFYING, so a
 * later reader can tell current-source evidence from an unverified install.
 * The wording is part of the contract, which is why it lives in a tested
 * function rather than inline in the report assembly.
 *
 * @param {object} input
 * @param {boolean | null} input.provisioned true when this run installed the build
 * @param {string | null} input.installedApkSha256 hash of what is installed, when obtainable
 * @returns {{ binaryVerified: boolean, note: string }}
 */
export function describeBinaryEvidence({ provisioned, installedApkSha256 }) {
  const hash = installedApkSha256 ?? '<unrecorded>';
  if (provisioned === true) {
    return {
      binaryVerified: true,
      note: `Provisioned the current-source build; installed APK SHA-256 ${hash}.`,
    };
  }
  if (provisioned === false) {
    return {
      binaryVerified: false,
      note:
        `Ran on an UNVERIFIED INSTALLED BINARY (no provisioning in this run); installed APK SHA-256 ` +
        `${installedApkSha256 ?? '<unobtainable on this target>'}. This run is not current-source evidence.`,
    };
  }
  return {
    binaryVerified: false,
    note:
      `Binary identity not established for this platform; installed APK SHA-256 ${hash}. ` +
      'This run is not current-source evidence.',
  };
}

/**
 * Read the flows Maestro actually executed, from its debug output.
 *
 * Maestro writes `<debugOutput>/.maestro/tests/<run>/<flowId>/manifest.json`
 * for every flow it starts and a `maestro.log` beside them. The newest run
 * directory wins so a stale directory from an earlier run in the same stamp
 * cannot be mistaken for this one.
 *
 * @param {string} debugOutputDir
 * @returns {{ executed: string[] | null, runDir: string | null, reason: string | null }}
 */
export function readExecutedFlows(debugOutputDir) {
  const runsRoot = join(debugOutputDir, '.maestro', 'tests');
  if (!existsSync(runsRoot)) {
    return {
      executed: null,
      runDir: null,
      reason: `Maestro wrote no debug output at ${runsRoot}; executed flow coverage cannot be proven.`,
    };
  }
  const runDirs = readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(runsRoot, entry.name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (runDirs.length === 0) {
    return {
      executed: null,
      runDir: null,
      reason: `Maestro created no run directory under ${runsRoot}; executed flow coverage cannot be proven.`,
    };
  }
  const runDir = runDirs[0];
  const executed = readdirSync(runDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(runDir, entry.name, 'manifest.json')))
    .map((entry) => entry.name)
    .sort();
  return { executed, runDir, reason: null };
}

/**
 * Decide whether a native run proved the coverage it claims.
 *
 * `PASS` requires all three: the expected list resolved without an error, the
 * executed set is readable, and the two agree exactly. Maestro stops at the
 * first failing flow (`continueOnFailure` is unset in the workspace config),
 * so a zero exit code together with an exact set match means every expected
 * flow passed.
 *
 * @param {object} input
 * @param {{ id: string, path: string }[]} input.expected
 * @param {string[]} input.errors resolution errors
 * @param {string[] | null} input.executed
 * @param {string | null} input.reason why the executed set is unreadable
 * @param {number} input.exitCode Maestro's process exit code
 * @returns {{ verdict: string, reason: string | null, expected: string[], executed: string[] | null, missing: string[], unexpected: string[] }}
 */
export function evaluateFlowCoverage({ expected, errors, executed, reason, exitCode }) {
  const expectedIds = expected.map((entry) => entry.id).sort();
  const base = { expected: expectedIds, executed: executed ?? null, missing: [], unexpected: [] };
  if (errors.length > 0) {
    return { ...base, verdict: COVERAGE_MISMATCH, reason: errors.join(' ') };
  }
  if (executed === null) {
    return { ...base, verdict: COVERAGE_UNPROVEN, reason };
  }
  const executedIds = [...executed].sort();
  const missing = expectedIds.filter((id) => !executedIds.includes(id));
  const unexpected = executedIds.filter((id) => !expectedIds.includes(id));
  // A failing run is a FAILURE first: Maestro stops at the first failing
  // flow, so "the rest of the expected list did not run" is a consequence of
  // that failure and not the finding. The shortfall is still reported.
  if (exitCode !== 0) {
    return {
      ...base,
      verdict: COVERAGE_MISMATCH,
      reason: `Maestro exited ${exitCode}${missing.length > 0 ? `, so ${missing.length} of ${expectedIds.length} expected flow(s) never ran` : ''}.`,
      missing,
      unexpected,
    };
  }
  if (missing.length > 0 || unexpected.length > 0) {
    const parts = [];
    if (missing.length > 0) parts.push(`did not execute: ${missing.join(', ')}`);
    if (unexpected.length > 0) parts.push(`executed unexpectedly: ${unexpected.join(', ')}`);
    return { ...base, verdict: COVERAGE_MISMATCH, reason: parts.join('; '), missing, unexpected };
  }
  return { ...base, verdict: COVERAGE_OK, reason: null };
}
