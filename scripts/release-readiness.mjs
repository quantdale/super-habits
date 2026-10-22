#!/usr/bin/env node
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
        [...out.matchAll(/\[(?:UNDOCUMENTED|DOCUMENTED)[^\]]*\]\s+\S+\s+(\S+)\s+(GHSA-[\w-]+)/g)].map(
          (match) => `${match[1]} ${match[2]}`,
        ),
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
      ownerAction: 'Remediate the advisory, or obtain a governed policy decision. No waiver is implied.',
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

  const docs = readdirSync(RELEASE_DIR).filter((name) => name.endsWith('.md'));
  let markerCount = 0;
  const perDoc = {};
  for (const name of docs) {
    const text = readText(join('docs', 'release', name));
    const matches = text.match(/\[OWNER ACTION/g) ?? [];
    if (matches.length > 0) {
      perDoc[name] = matches.length;
      markerCount += matches.length;
    }
  }

  // The inventory is the authoritative owner-action list. If it is missing or
  // unreadable, that is a BLOCKER, not a crash and not a silent zero: reporting
  // "0 owner actions" from a file that could not be read would be a false
  // ready-signal, which is the exact failure mode this script exists to prevent.
  let inventoryRows = new Set();
  try {
    const submission = readText(join('docs', 'release', 'submission-package.md'));
    inventoryRows = new Set([...submission.matchAll(/^\|\s*(R\d{2})\s*\|/gm)].map((m) => m[1]));
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
  // deployment occurs. So `main: false` alone is not sufficient evidence while a
  // wildcard `true` rule exists.
  const hasWildcardTrue = Object.entries(enabled).some(
    ([branch, value]) => (branch === '*' || branch === '**') && value === true,
  );
  if (enabled.main !== false || hasWildcardTrue) {
    blockers.push({
      id: 'PROD-HOLD',
      severity: SEVERITY,
      detail: hasWildcardTrue
        ? 'a wildcard `*`/`**` rule is enabled, which overrides `main: false` in Vercel precedence'
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
  // than one that admits the gap: it is a false certification.
  const claimsSigned = /signed with the (?:production|upload|release) (?:key|keystore)/i.test(text);
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

export function evaluateReleaseReadiness() {
  const blockers = [
    ...checkDependencyAdvisories(),
    ...checkOwnerActions(),
    ...checkProductionHold(),
    ...checkNativeSigning(),
    ...checkSubmitCredentials(),
  ];
  return {
    verdict: blockers.length === 0 ? 'READY' : 'BLOCKED',
    blockerCount: blockers.length,
    blockers,
    unobservable: UNOBSERVABLE_INPUTS,
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
  }
  return result.verdict === 'READY' ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] !== undefined && process.argv[1].endsWith('release-readiness.mjs');
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
