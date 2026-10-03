import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  AuditExecutionError,
  evaluateAudit,
  findings,
  isDocumented,
  main,
  validateAuditCommandResult,
} from '../scripts/audit-runtime-deps.mjs';

/**
 * The production-dependency advisory gate must fail on anything it has not
 * documented, and must never hide a documented finding.
 *
 * The live tree state it encodes (2026-09-29): three `brace-expansion`
 * advisories reach the production tree through `test-exclude`
 * (`babel-plugin-istanbul`, coverage only) and `glob@9` -> `minimatch@8`, with no
 * non-breaking fixed version — npm's only offered resolution is
 * `react-native@0.87.1`. The 5.x copy IS fixed by an `overrides` entry and is
 * deliberately not allowlisted.
 *
 * The gate's own logic is a CLI, so this test pins the two properties that
 * matter and that a future edit could silently break: the allowlist is matched
 * on advisory id + package + every reported path, and the overrides entry that
 * fixes the 5.x copy actually exists.
 */
const scriptPath = resolve(__dirname, '..', 'scripts', 'audit-runtime-deps.mjs');
const script = readFileSync(scriptPath, 'utf8');

/**
 * The clean-shaped report the pinned npm producer serializes when it skips the
 * audit: `@npmcli/arborist/lib/audit-report.js` `AuditReport[_getReport]`
 * returns null BEFORE the registry request when the effective `offline` config
 * is true (`options.offline === true`, line ~304 in npm 10.9.8), while
 * `toJSON()` still emits this empty report and npm exits 0. This constant is
 * byte-shaped from the actual pinned-npm capture
 * (`npm_config_offline=true npm audit --omit=dev --json --audit-level=info` on
 * this tree; retained in `simulation-output/security-correction-2026-10-03/
 * npm-audit-offline-actual.json`) — report shape alone cannot distinguish a
 * skipped audit from a genuinely clean one.
 */
const PINNED_PRODUCER_OFFLINE_REPORT = {
  auditReportVersion: 2,
  vulnerabilities: {},
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
    dependencies: { prod: 780, dev: 472, optional: 136, peer: 1, peerOptional: 0, total: 1273 },
  },
};

describe('audit-runtime-deps gate policy', () => {
  it('matches a documented finding on advisory id, package, and every reported path', () => {
    // The allowlist entry must exist for the live tree's three advisories.
    for (const advisory of ['GHSA-q2hr-2g5m-vwhr', 'GHSA-qhr7-859c-m2p7', 'GHSA-6j4f-fj2g-mc7p']) {
      expect(script).toContain(`advisory: '${advisory}'`);
    }
    // ...and the matcher must require every reported node to be covered, so a
    // new path for a known advisory is still a failure.
    expect(script).toContain('finding.nodes.every((node) => entry.nodes.includes(node))');
  });

  it('documents the build-time-only reason and its date beside every entry', () => {
    for (const entry of script.match(/const DOCUMENTED_BUILD_TIME_ADVISORIES = \[[\s\S]*?\n\];/) ??
      []) {
      const reasonMatches = entry.match(/reason:/g) ?? [];
      expect(reasonMatches.length).toBeGreaterThanOrEqual(3);
      // The date lives in the block's own header comment, next to the entries.
      expect(script).toContain('allowlist dated 2026-09-29');
      expect(entry).toContain('coverage/glob tooling only');
    }
  });

  it('keeps the 5.x brace-expansion copy fixed by an overrides entry, not allowlisted', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'));
    expect(pkg.overrides['brace-expansion@^5.0.0']).toBe('^5.0.12');
    // The allowlist names only the 1.x/2.x paths, never the 5.x copy.
    expect(script).not.toContain('node_modules/brace-expansion"');
  });

  it('fails the run on an undocumented finding rather than reporting it', () => {
    expect(script).toContain('process.exit(1)');
    expect(script).toContain('undocumented high/critical advisory(ies)');
  });

  it('normalizes inherited npm offline mode so a skipped audit cannot report clean', () => {
    // The transport must pin offline on the command line AND in config: when
    // npm's effective `offline` is true the pinned producer skips the registry
    // request and serializes a clean-shaped report (exit 0) on the vulnerable
    // tree — report shape alone cannot prove the audit completed.
    expect(script).toContain("'--offline=false'");
    expect(script).toContain('npm_config_offline');
  });
});

// ---------------------------------------------------------------------------
// Executing seam fixtures (resolve-windows-dependency-security, tasks 5.1–5.3).
// These drive the REAL command/report seam (`validateAuditCommandResult` +
// `evaluateAudit`) with synthetic command results — the same functions the CLI
// runs — instead of asserting on script text.
// ---------------------------------------------------------------------------

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: { message?: string } | Error;
  signal?: string | null;
};

type MutableFinding = { nodes: string[]; via: unknown[] };

const advisoryEntry = (over: Record<string, unknown> = {}) => ({
  source: 1240912,
  name: 'node-forge',
  dependency: 'node-forge',
  title:
    'node-forge RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements',
  url: 'https://github.com/advisories/GHSA-86w9-cpqp-85rv',
  severity: 'high',
  cwe: ['CWE-347'],
  cvss: { score: 7.5, vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N' },
  range: '<=1.4.0',
  ...over,
});

const report = (
  vulnerabilities: Record<string, unknown>,
  counts: Record<string, number>,
  over: Record<string, unknown> = {},
) => ({
  auditReportVersion: 2,
  vulnerabilities,
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0, ...counts },
  },
  ...over,
});

const cleanReport = () => report({}, {});

const forgeHighReport = () =>
  report(
    {
      'node-forge': {
        name: 'node-forge',
        severity: 'high',
        isDirect: false,
        nodes: ['node_modules/node-forge'],
        range: '*',
        via: [advisoryEntry()],
        fixAvailable: { name: 'expo', version: '44.0.6', isSemVerMajor: true },
      },
    },
    { high: 1, total: 1 },
  );

const documentedBraceReport = () =>
  report(
    {
      'brace-expansion': {
        name: 'brace-expansion',
        severity: 'high',
        isDirect: false,
        nodes: [
          'node_modules/glob/node_modules/brace-expansion',
          'node_modules/test-exclude/node_modules/brace-expansion',
        ],
        range: '<=1.1.20 || 2.0.0 - 2.1.6',
        via: [
          advisoryEntry({
            name: 'brace-expansion',
            dependency: 'brace-expansion',
            title:
              'brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service',
            url: 'https://github.com/advisories/GHSA-q2hr-2g5m-vwhr',
            range: '<=1.1.20 || 2.0.0 - 2.1.6',
          }),
        ],
        fixAvailable: false,
      },
    },
    { high: 1, total: 1 },
  );

// ---------------------------------------------------------------------------
// Review-correction fixtures (2026-10-02 independent review of the apply).
// Each of the seven invalid/incoherent reports below produced a false clean
// verdict (exit 0) through the real seam AND the real CLI before the schema/
// coherence validation landed. They are permanent executing regressions.
// ---------------------------------------------------------------------------

const moderateOnlyReport = () =>
  report(
    {
      'some-package': {
        name: 'some-package',
        severity: 'moderate',
        nodes: ['node_modules/some-package'],
        range: '*',
        via: [
          advisoryEntry({
            name: 'some-package',
            dependency: 'some-package',
            severity: 'moderate',
            title: 'moderate thing',
          }),
        ],
      },
    },
    { moderate: 1, total: 1 },
  );

const infoAndLowReport = () =>
  report(
    {
      'info-package': {
        name: 'info-package',
        severity: 'info',
        nodes: ['node_modules/info-package'],
        range: '*',
        via: [
          advisoryEntry({
            name: 'info-package',
            dependency: 'info-package',
            severity: 'info',
            title: 'info thing',
          }),
        ],
      },
      'low-package': {
        name: 'low-package',
        severity: 'low',
        nodes: ['node_modules/low-package'],
        range: '*',
        via: [
          advisoryEntry({
            name: 'low-package',
            dependency: 'low-package',
            severity: 'low',
            title: 'low thing',
          }),
        ],
      },
    },
    { info: 1, low: 1, total: 2 },
  );

const syntheticFinding = (over: Record<string, unknown>) => ({
  name: 'synthetic-package',
  severity: 'high',
  nodes: ['node_modules/synthetic-package'],
  via: [
    advisoryEntry({
      name: 'synthetic-package',
      dependency: 'synthetic-package',
      title: 'synthetic high finding',
    }),
  ],
  ...over,
});

/** Review false-green 1: an unknown report schema version with a "clean" body. */
const unsupportedVersionReport = () => report({}, {}, { auditReportVersion: 999 });

/** Review false-green 2: metadata claiming a high while findings are empty. */
const metadataHighEmptyFindingsReport = () => report({}, { high: 1, total: 1 });

/** Review false-green 3: severity "HIGH" hiding a reported high. */
const uppercaseSeverityReport = () =>
  report({ 'synthetic-package': syntheticFinding({ severity: 'HIGH' }) }, { high: 1, total: 1 });

/** Review false-green 4: a high finding with no via entries at all. */
const emptyViaReport = () =>
  report({ 'synthetic-package': syntheticFinding({ via: [] }) }, { high: 1, total: 1 });

/** Review false-green 5: a critical finding whose only via is a dangling reference. */
const unresolvedReferenceReport = () =>
  report(
    { 'synthetic-package': syntheticFinding({ severity: 'critical', via: ['missing-package'] }) },
    { critical: 1, total: 1 },
  );

/** Review false-green 6: a documented advisory reported with no dependency paths. */
const emptyPathsReport = () => {
  const payload = documentedBraceReport();
  (payload.vulnerabilities as Record<string, MutableFinding>)['brace-expansion'].nodes = [];
  return payload;
};

/** Review false-green 7: negative/non-numeric metadata counts. */
const invalidCountsReport = () => {
  const payload = report({}, {}) as unknown as {
    metadata: { vulnerabilities: Record<string, unknown> };
  };
  payload.metadata.vulnerabilities.high = -1;
  payload.metadata.vulnerabilities.total = 'not-a-number';
  return payload;
};

/** Extra structural case: a via reference cycle with no advisory evidence. */
const referenceCycleReport = () =>
  report(
    {
      'a-package': {
        name: 'a-package',
        severity: 'high',
        nodes: ['node_modules/a-package'],
        via: ['b-package'],
      },
      'b-package': {
        name: 'b-package',
        severity: 'high',
        nodes: ['node_modules/b-package'],
        via: ['a-package'],
      },
    },
    { high: 2, total: 2 },
  );

/** Control: valid npm meta-vulnerability references (the real grouped shape). */
const groupedMetaReport = () =>
  report(
    {
      'meta-parent': {
        name: 'meta-parent',
        severity: 'high',
        nodes: ['node_modules/meta-parent'],
        via: ['leaf-package'],
      },
      'leaf-package': {
        name: 'leaf-package',
        severity: 'high',
        nodes: ['node_modules/leaf-package'],
        via: [
          advisoryEntry({
            name: 'leaf-package',
            dependency: 'leaf-package',
            title: 'leaf advisory',
            url: 'https://github.com/advisories/GHSA-leaf0-0000-leaf',
          }),
        ],
      },
    },
    { high: 2, total: 2 },
  );

/** Control: a valid multi-advisory finding must keep both advisories visible. */
const multiAdvisoryReport = () =>
  report(
    {
      'brace-expansion': {
        name: 'brace-expansion',
        severity: 'high',
        nodes: [
          'node_modules/glob/node_modules/brace-expansion',
          'node_modules/test-exclude/node_modules/brace-expansion',
        ],
        range: '<=1.1.20 || 2.0.0 - 2.1.6',
        via: [
          advisoryEntry({
            name: 'brace-expansion',
            dependency: 'brace-expansion',
            title: 'brace-expansion first advisory',
            url: 'https://github.com/advisories/GHSA-q2hr-2g5m-vwhr',
          }),
          advisoryEntry({
            name: 'brace-expansion',
            dependency: 'brace-expansion',
            title: 'brace-expansion second advisory',
            url: 'https://github.com/advisories/GHSA-qhr7-859c-m2p7',
          }),
        ],
        fixAvailable: false,
      },
    },
    { high: 1, total: 1 },
  );

// ---------------------------------------------------------------------------
// Second-correction review fixtures (2026-10-03 independent review of the
// correction). Each of the five invalid/incoherent reports below produced a
// false clean verdict (exit 0) through the real seam AND the real CLI despite
// explicit high/critical evidence or contradictory identity
// (`simulation-output/security-correction-review-2026-10-03/boundary-replay.json`).
// They are permanent executing regressions at BOTH seams.
// ---------------------------------------------------------------------------

const replayBraceAdvisory = (over: Record<string, unknown> = {}) => ({
  source: 1240913,
  name: 'brace-expansion',
  dependency: 'brace-expansion',
  title: 'brace-expansion documented high',
  url: 'https://github.com/advisories/GHSA-q2hr-2g5m-vwhr',
  severity: 'high',
  range: '<=1.1.20 || 2.0.0 - 2.1.6',
  ...over,
});

const replayBraceFinding = (over: Record<string, unknown> = {}) => ({
  name: 'brace-expansion',
  severity: 'high',
  nodes: ['node_modules/glob/node_modules/brace-expansion'],
  via: [replayBraceAdvisory()],
  ...over,
});

/** Second-review false green 1: an outer moderate finding whose explicit direct
 * advisory says high — the high was suppressed and the gate printed zero. */
const advisoryHighDisguisedByModerateReport = () =>
  report(
    {
      'node-forge': {
        name: 'node-forge',
        severity: 'moderate',
        nodes: ['node_modules/node-forge'],
        via: [advisoryEntry({ title: 'node-forge RSA signature validation defect' })],
      },
    },
    { moderate: 1, total: 1 },
  );

/** Second-review false green 2: a critical meta-parent whose reference chain
 * reaches only a moderate advisory — the critical evidence does not exist. */
const criticalMetaToModerateLeafReport = () =>
  report(
    {
      'meta-parent': {
        name: 'meta-parent',
        severity: 'critical',
        nodes: ['node_modules/meta-parent'],
        via: ['leaf-package'],
      },
      'leaf-package': {
        name: 'leaf-package',
        severity: 'moderate',
        nodes: ['node_modules/leaf-package'],
        via: [
          advisoryEntry({
            name: 'leaf-package',
            dependency: 'leaf-package',
            severity: 'moderate',
            title: 'leaf moderate advisory',
          }),
        ],
      },
    },
    { critical: 1, moderate: 1, total: 2 },
  );

/** Second-review false green 3: a critical meta-parent reaching only the
 * documented high brace advisory — the claimed critical is unsupported. */
const criticalMetaToAllowlistedHighReport = () =>
  report(
    {
      'meta-parent': {
        name: 'meta-parent',
        severity: 'critical',
        nodes: ['node_modules/meta-parent'],
        via: ['brace-expansion'],
      },
      'brace-expansion': replayBraceFinding(),
    },
    { critical: 1, high: 1, total: 2 },
  );

/** Second-review false green 4: the documented brace advisory reported with a
 * malformed URL whose slash suffix still impersonated the allowlisted id. */
const malformedUrlMasqueradingReport = () =>
  report(
    {
      'brace-expansion': replayBraceFinding({
        via: [replayBraceAdvisory({ url: 'not-a-url/GHSA-q2hr-2g5m-vwhr' })],
      }),
    },
    { high: 1, total: 1 },
  );

/** Second-review false green 5: the finding key/nodes/URL impersonate the
 * documented brace entry while the body and advisory name `node-forge`. */
const nameDependencyMismatchMasqueradingReport = () =>
  report(
    {
      'brace-expansion': replayBraceFinding({
        name: 'node-forge',
        via: [replayBraceAdvisory({ name: 'node-forge', dependency: 'node-forge' })],
      }),
    },
    { high: 1, total: 1 },
  );

/** Control: a documented high reached through a meta reference stays documented. */
const documentedGroupedMetaControlReport = () =>
  report(
    {
      'meta-parent': {
        name: 'meta-parent',
        severity: 'high',
        nodes: ['node_modules/meta-parent'],
        via: ['brace-expansion'],
      },
      'brace-expansion': replayBraceFinding(),
    },
    { high: 2, total: 2 },
  );

/** Control: a reference cycle whose evidence is a real high advisory is valid
 * and the leaf advisory still gates (undocumented forge high). */
const evidencedReferenceCycleControlReport = () =>
  report(
    {
      a: {
        name: 'a',
        severity: 'high',
        nodes: ['node_modules/a'],
        via: ['b'],
      },
      b: {
        name: 'b',
        severity: 'high',
        nodes: ['node_modules/b'],
        via: ['a', advisoryEntry({ name: 'b', dependency: 'b', title: 'b advisory' })],
      },
    },
    { high: 2, total: 2 },
  );

/** Control: npm meta references aggregate child advisories that need not all
 * apply to the parent — the pinned producer's genuine mixed-advisory/version
 * subset semantics (its leaf finding carries a HIGH advisory affecting only
 * version 1 and a separate MODERATE advisory affecting only version 2, while a
 * dependent meta-parent draws only the moderate contribution). A moderate
 * meta-parent below its leaf's mixed aggregate severity is valid, and both of
 * the leaf's version-specific advisories stay visible and gating. Provenance:
 * the producer-generated payloads in
 * `simulation-output/security-correction-rereview-2026-10-03/meta-bounds-replay.json`
 * (actual pinned npm `Advisory`/`Vuln`/`AuditReport.toJSON()`). */
const metaParentBelowLeafSeverityControlReport = () =>
  report(
    {
      'meta-parent': {
        name: 'meta-parent',
        severity: 'moderate',
        nodes: ['node_modules/meta-parent'],
        via: ['leaf-package'],
      },
      'leaf-package': {
        name: 'leaf-package',
        severity: 'high',
        nodes: ['node_modules/leaf-package'],
        via: [
          advisoryEntry({
            name: 'leaf-package',
            dependency: 'leaf-package',
            title: 'leaf high advisory affecting version 1 only',
            url: 'https://github.com/advisories/GHSA-leaf0-0000-leaf',
            severity: 'high',
            range: '=1.0.0',
          }),
          advisoryEntry({
            name: 'leaf-package',
            dependency: 'leaf-package',
            title: 'leaf moderate advisory affecting version 2 only',
            url: 'https://github.com/advisories/GHSA-l3af1-0000-mod2',
            severity: 'moderate',
            range: '=2.0.0',
          }),
        ],
      },
    },
    { moderate: 1, high: 1, total: 2 },
  );

/** Control: scoped package names and grouped references stay supported. */
const scopedNamesControlReport = () =>
  report(
    {
      '@scope/parent': {
        name: '@scope/parent',
        severity: 'high',
        nodes: ['node_modules/@scope/parent'],
        via: ['@scope/child'],
      },
      '@scope/child': {
        name: '@scope/child',
        severity: 'high',
        nodes: ['node_modules/@scope/child'],
        via: [
          advisoryEntry({
            name: '@scope/child',
            dependency: '@scope/child',
            title: 'scoped advisory',
            url: 'https://github.com/advisories/GHSA-sc0pe-0000-0000',
          }),
        ],
      },
    },
    { high: 2, total: 2 },
  );

/** Impossible shape: a reference cycle launders a moderate advisory into high
 * severities with no supporting evidence anywhere in the chain. */
const severityLaunderingCycleReport = () =>
  report(
    {
      a: {
        name: 'a',
        severity: 'high',
        nodes: ['node_modules/a'],
        via: ['b'],
      },
      b: {
        name: 'b',
        severity: 'high',
        nodes: ['node_modules/b'],
        via: [
          'a',
          advisoryEntry({
            name: 'b',
            dependency: 'b',
            severity: 'moderate',
            title: 'only moderate evidence',
            url: 'https://github.com/advisories/GHSA-l0nde-0000-0000',
          }),
        ],
      },
    },
    { high: 2, total: 2 },
  );

// ---------------------------------------------------------------------------
// Third-correction review fixtures (2026-10-03 re-review of the second
// correction). The producer-faithful pair below is shaped exactly from the
// actual pinned npm `Advisory`/`Vuln`/`AuditReport.toJSON()` payloads retained
// in `simulation-output/security-correction-rereview-2026-10-03/
// meta-bounds-replay.json`: the grouped brace finding carries a HIGH advisory
// affecting only version 1 plus a separate MODERATE advisory affecting only
// version 2 (aggregate high); `child-package` depends exclusively on the
// moderate-affected version 2 (contributing severity moderate);
// `parent-package` depends on that child. The valid control exits 0 at
// main()/seam/CLI; changing ONLY the parent's severity moderate → high (with
// matching counts) produced a FALSE GREEN (exit 0, "every high/critical
// finding is documented") at all three seams through the second-correction
// gate — permanent executing regressions at BOTH seams.
// ---------------------------------------------------------------------------

const producerTwoHopFindings = (parentSeverity: string) => ({
  'brace-expansion': {
    name: 'brace-expansion',
    severity: 'high',
    isDirect: false,
    via: [
      {
        source: 1240913,
        name: 'brace-expansion',
        dependency: 'brace-expansion',
        title: 'Synthetic high on version 1 only',
        url: 'https://github.com/advisories/GHSA-q2hr-2g5m-vwhr',
        severity: 'high',
        range: '=1.0.0',
      },
      {
        source: 1240914,
        name: 'brace-expansion',
        dependency: 'brace-expansion',
        title: 'Synthetic moderate on version 2 only',
        url: 'https://github.com/advisories/GHSA-qhr7-859c-m2p7',
        severity: 'moderate',
        range: '=2.0.0',
      },
    ],
    effects: ['child-package'],
    range: '*',
    nodes: [
      'node_modules/glob/node_modules/brace-expansion',
      'node_modules/test-exclude/node_modules/brace-expansion',
    ],
    fixAvailable: true,
  },
  'child-package': {
    name: 'child-package',
    severity: 'moderate',
    isDirect: false,
    via: ['brace-expansion'],
    effects: ['parent-package'],
    range: '*',
    nodes: ['node_modules/child-package'],
    fixAvailable: true,
  },
  'parent-package': {
    name: 'parent-package',
    severity: parentSeverity,
    isDirect: false,
    via: ['child-package'],
    effects: [],
    range: '*',
    nodes: ['node_modules/parent-package'],
    fixAvailable: true,
  },
});

/** Producer-valid two-hop subset control: brace high → child moderate → parent
 * moderate, exactly as the pinned npm serializer produced it. */
const producerTwoHopSubsetControlReport = () =>
  report(producerTwoHopFindings('moderate'), { moderate: 2, high: 1, total: 3 });

/** Third-review false green 1 (P1): only the parent's severity is changed
 * moderate → high with matching counts. The parent has no direct advisory and
 * only its moderate child as `via`; its sole contributing evidence is
 * moderate, so no producer can serialize the high. */
const impossibleHighParentViaModerateChildReport = () =>
  report(producerTwoHopFindings('high'), { moderate: 1, high: 2, total: 3 });

/** Third-review false green 2 (P1): a self-supporting reference cycle claims
 * high while the only distant high advisory sits behind a lower intermediary
 * (`mid-package` legitimately reports moderate below its leaf's high aggregate
 * — subset semantics). A local neighbor-only bound would let the a↔b cycle
 * bootstrap high from each other's claimed severities; the anchored evidence
 * chain reaches only moderate. The distant advisory is the DOCUMENTED
 * allowlisted brace one, so the old gate's verdict was a documented-success
 * green ("every high/critical finding is documented", exit 0) — not an exit 1
 * caused by an unrelated undocumented leaf. */
const highThroughLowerIntermediaryCycleReport = () =>
  report(
    {
      'brace-expansion': {
        name: 'brace-expansion',
        severity: 'high',
        nodes: ['node_modules/glob/node_modules/brace-expansion'],
        via: [replayBraceAdvisory()],
      },
      'mid-package': {
        name: 'mid-package',
        severity: 'moderate',
        nodes: ['node_modules/mid-package'],
        via: ['brace-expansion'],
      },
      'cycle-a': {
        name: 'cycle-a',
        severity: 'high',
        nodes: ['node_modules/cycle-a'],
        via: ['cycle-b'],
      },
      'cycle-b': {
        name: 'cycle-b',
        severity: 'high',
        nodes: ['node_modules/cycle-b'],
        via: ['cycle-a', 'mid-package'],
      },
    },
    { moderate: 1, high: 3, total: 4 },
  );

const ok = (result: CommandResult) => validateAuditCommandResult(result);
const asResult = (payload: unknown, status = 1): CommandResult => ({
  status,
  stdout: typeof payload === 'string' ? payload : JSON.stringify(payload),
  stderr: '',
});

describe('audit command/report seam (fail closed)', () => {
  it('matches documentation only on advisory id + package + full path coverage', () => {
    const documentedFinding = {
      advisory: 'GHSA-q2hr-2g5m-vwhr',
      name: 'brace-expansion',
      nodes: [
        'node_modules/glob/node_modules/brace-expansion',
        'node_modules/test-exclude/node_modules/brace-expansion',
      ],
    };
    expect(isDocumented(documentedFinding)).toBeTruthy();
    // A subset of the documented paths stays documented…
    expect(
      isDocumented({ ...documentedFinding, nodes: [documentedFinding.nodes[0]] }),
    ).toBeTruthy();
    // …but a new path, a new advisory id, or a new package never is.
    expect(
      isDocumented({
        ...documentedFinding,
        nodes: [...documentedFinding.nodes, 'node_modules/new/brace-expansion'],
      }),
    ).toBeNull();
    expect(isDocumented({ ...documentedFinding, advisory: 'GHSA-aaaa-bbbb-cccc' })).toBeNull();
    expect(isDocumented({ ...documentedFinding, name: 'other-package' })).toBeNull();
  });

  it('accepts a valid clean report and evaluates it as zero high/critical', () => {
    const audit = ok(asResult(cleanReport(), 0));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(0);
    expect(verdict.lines.join('\n')).toContain('OK — 0 high/critical in the production tree');
  });

  it('accepts a valid report with documented findings and keeps them visible', () => {
    const audit = ok(asResult(documentedBraceReport(), 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(0);
    expect(verdict.lines.join('\n')).toContain('[DOCUMENTED 2026-09-29');
    expect(verdict.lines.join('\n')).toContain('brace-expansion');
    expect(verdict.undocumented).toHaveLength(0);
  });

  it('keeps report-only lower severities below the gate', () => {
    const moderateOnly = report(
      {
        'some-package': {
          name: 'some-package',
          severity: 'moderate',
          nodes: ['node_modules/some-package'],
          range: '*',
          via: [
            advisoryEntry({
              name: 'some-package',
              dependency: 'some-package',
              severity: 'moderate',
              title: 'moderate thing',
            }),
          ],
        },
      },
      { moderate: 1, total: 1 },
    );
    const audit = ok(asResult(moderateOnly, 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(0);
    expect(verdict.lines.join('\n')).toContain('0 high/critical');
    expect(verdict.lines.join('\n')).toContain('1 moderate');
  });

  it('fails an undocumented node-forge high exactly like the live gate', () => {
    const audit = ok(asResult(forgeHighReport(), 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(1);
    const text = [...verdict.lines, ...verdict.errorLines].join('\n');
    expect(text).toContain('[UNDOCUMENTED] high node-forge GHSA-86w9-cpqp-85rv');
    expect(text).toContain('undocumented high/critical advisory(ies)');
  });

  it('fails a future critical advisory the same way', () => {
    const critical = report(
      {
        'future-package': {
          name: 'future-package',
          severity: 'critical',
          nodes: ['node_modules/future-package'],
          range: '<1.0.0',
          via: [
            advisoryEntry({
              name: 'future-package',
              dependency: 'future-package',
              severity: 'critical',
              title: 'future critical',
              url: 'https://github.com/advisories/GHSA-future-0000-crit',
            }),
          ],
        },
      },
      { critical: 1, total: 1 },
    );
    const audit = ok(asResult(critical, 1));
    expect(evaluateAudit(audit).exitCode).toBe(1);
  });

  it('fails a known advisory at an uncovered dependency path', () => {
    const uncovered = documentedBraceReport();
    (uncovered.vulnerabilities as Record<string, MutableFinding>)['brace-expansion'].nodes = [
      'node_modules/somewhere-else/brace-expansion',
    ];
    const audit = ok(asResult(uncovered, 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(1);
    expect(verdict.undocumented).toHaveLength(1);
  });

  it('fails a new advisory id on a known package at known paths', () => {
    const newAdvisory = documentedBraceReport();
    (newAdvisory.vulnerabilities as Record<string, MutableFinding>)['brace-expansion'].via = [
      advisoryEntry({
        name: 'brace-expansion',
        dependency: 'brace-expansion',
        title: 'brand new advisory',
        url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
      }),
    ];
    const audit = ok(asResult(newAdvisory, 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(1);
    expect(verdict.undocumented).toHaveLength(1);
  });

  it('rejects parseable npm error JSON instead of reporting a clean tree', () => {
    const errorJson = {
      error: {
        code: 'EAI_AGAIN',
        summary: 'request to https://registry.npmjs.org/ failed',
        detail: 'getaddrinfo EAI_AGAIN registry.npmjs.org',
      },
    };
    expect(() => ok(asResult(errorJson, 1))).toThrowError(AuditExecutionError);
    try {
      ok(asResult(errorJson, 1));
    } catch (error) {
      expect((error as Error).message).toContain('error object');
      expect((error as Error).message).toContain('EAI_AGAIN');
    }
  });

  it('rejects empty failed output instead of substituting an empty clean report', () => {
    expect(() => ok({ status: 1, stdout: '', stderr: 'npm ERR! network' })).toThrowError(
      /empty output/,
    );
  });

  it('rejects malformed JSON output', () => {
    expect(() => ok({ status: 1, stdout: 'this is not json', stderr: '' })).toThrowError(
      /could not parse/,
    );
  });

  it('rejects unsupported report shapes', () => {
    expect(() => ok(asResult({ vulnerabilities: {} }, 1))).toThrowError(/auditReportVersion/);
    expect(() =>
      ok(asResult({ auditReportVersion: 2, vulnerabilities: {}, metadata: {} }, 1)),
    ).toThrowError(/metadata\.vulnerabilities/);
    expect(() =>
      ok(asResult({ auditReportVersion: 2, metadata: { vulnerabilities: {} } }, 1)),
    ).toThrowError(/vulnerabilities object/);
    expect(() => ok(asResult([], 1))).toThrowError(/not a JSON object/);
  });

  it('rejects invalid finding shapes', () => {
    const badSeverity = report(
      {
        'broken-package': {
          name: 'broken-package',
          severity: 7,
          nodes: ['node_modules/broken-package'],
          via: [advisoryEntry()],
        },
      },
      { total: 1 },
    );
    expect(() => ok(asResult(badSeverity, 1))).toThrowError(/invalid finding shape/);

    const badVia = report(
      {
        'broken-package': {
          name: 'broken-package',
          severity: 'high',
          nodes: ['node_modules/broken-package'],
          via: [42],
        },
      },
      { high: 1, total: 1 },
    );
    expect(() => ok(asResult(badVia, 1))).toThrowError(/invalid advisory entry shape/);

    const badNodes = report(
      {
        'broken-package': {
          name: 'broken-package',
          severity: 'high',
          via: [advisoryEntry()],
        },
      },
      { high: 1, total: 1 },
    );
    expect(() => ok(asResult(badNodes, 1))).toThrowError(/dependency paths/);
  });

  it('rejects spawn/transport failure and signal termination', () => {
    expect(() =>
      ok({ status: null, stdout: '', stderr: '', error: new Error('spawnSync npm ENOENT') }),
    ).toThrowError(/failed to run/);
    expect(() => ok({ status: null, stdout: '', stderr: '', signal: 'SIGTERM' })).toThrowError(
      /terminated by signal/,
    );
  });

  it('rejects unexpected exit statuses', () => {
    expect(() => ok(asResult(cleanReport(), 2))).toThrowError(/unexpected status 2/);
    expect(() => ok({ status: null, stdout: '{}', stderr: '' })).toThrowError(/no exit status/);
  });

  it('rejects results whose exit status contradicts the report', () => {
    expect(() => ok(asResult(forgeHighReport(), 0))).toThrowError(/exited 0 while reporting/);
    expect(() => ok(asResult(cleanReport(), 1))).toThrowError(/exited 1 without reporting/);
  });

  it('main() fails closed on an invalid result and never prints a clean verdict', () => {
    const outLines: string[] = [];
    const errLines: string[] = [];
    const exitCode = main({
      runCommand: () => ({ status: 1, stdout: '{"error":{"code":"EAI_AGAIN"}}', stderr: '' }),
      out: (line: string) => outLines.push(line),
      err: (line: string) => errLines.push(line),
    });
    expect(exitCode).toBe(1);
    expect(outLines.join('\n')).not.toContain('OK — 0 high/critical');
    expect(errLines.join('\n')).toContain('audit execution failed');
    expect(errLines.join('\n')).toContain('refusing to report a clean production tree');
  });
});

// ---------------------------------------------------------------------------
// 2026-10-02 independent review corrections (P1): malformed, incoherent and
// structurally broken reports must fail closed BEFORE any clean/documented
// verdict. Each of the seven review fixtures below produced a false clean
// verdict (exit 0) through this real seam and the real CLI.
// ---------------------------------------------------------------------------

describe('invalid or incoherent audit reports fail closed (2026-10-02 review corrections)', () => {
  it('rejects an unsupported report schema version instead of trusting a clean body', () => {
    expect(() => ok(asResult(unsupportedVersionReport(), 0))).toThrowError(
      /unsupported auditReportVersion 999/,
    );
    const outLines: string[] = [];
    const errLines: string[] = [];
    const exitCode = main({
      runCommand: () => asResult(unsupportedVersionReport(), 0),
      out: (line: string) => outLines.push(line),
      err: (line: string) => errLines.push(line),
    });
    expect(exitCode).toBe(1);
    expect(outLines.join('\n')).not.toContain('OK — 0 high/critical');
    expect(errLines.join('\n')).toContain('refusing to report a clean production tree');
  });

  it('rejects metadata counts that contradict empty findings', () => {
    expect(() => ok(asResult(metadataHighEmptyFindingsReport(), 0))).toThrowError(
      /do not match the reported findings/,
    );
  });

  it('rejects negative or non-integer metadata counts', () => {
    expect(() => ok(asResult(invalidCountsReport(), 0))).toThrowError(/non-negative integers/);
  });

  it('rejects a severity outside the known npm severity enum ("HIGH")', () => {
    expect(() => ok(asResult(uppercaseSeverityReport(), 1))).toThrowError(/invalid finding shape/);
  });

  it('rejects a high finding that carries no via entries at all', () => {
    expect(() => ok(asResult(emptyViaReport(), 1))).toThrowError(/invalid finding shape/);
  });

  it('rejects a critical finding with an unresolved via reference', () => {
    expect(() => ok(asResult(unresolvedReferenceReport(), 1))).toThrowError(
      /unresolved via reference/,
    );
  });

  it('rejects via reference cycles with no usable advisory evidence', () => {
    expect(() => ok(asResult(referenceCycleReport(), 1))).toThrowError(
      /no usable advisory evidence/,
    );
  });

  it('rejects a documented advisory reported with no dependency paths', () => {
    expect(() => ok(asResult(emptyPathsReport(), 1))).toThrowError(/dependency paths/);
    // ...and the allowlist matcher itself refuses the vacuous every-path match
    // an empty path list would otherwise produce.
    expect(
      isDocumented({ advisory: 'GHSA-q2hr-2g5m-vwhr', name: 'brace-expansion', nodes: [] }),
    ).toBeNull();
  });

  it('accepts valid grouped meta-vulnerability references and gates the leaf advisory', () => {
    const audit = ok(asResult(groupedMetaReport(), 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(1);
    expect(verdict.undocumented.map((finding) => finding.name)).toEqual(['leaf-package']);
  });

  it('keeps every advisory of a valid multi-advisory finding visible and documented', () => {
    const audit = ok(asResult(multiAdvisoryReport(), 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(0);
    expect(verdict.documented).toHaveLength(2);
    expect(verdict.lines.join('\n')).toContain('GHSA-q2hr-2g5m-vwhr');
    expect(verdict.lines.join('\n')).toContain('GHSA-qhr7-859c-m2p7');
  });
});

// ---------------------------------------------------------------------------
// 2026-10-03 second independent review corrections (P1): severity/advisory/
// package/URL identity coherence must be validated against the supported npm
// producer schema BEFORE any clean or documented verdict. Each of the five
// review fixtures below produced a false clean verdict (exit 0) through this
// real seam and the real CLI even though its evidence contradicted itself.
// ---------------------------------------------------------------------------

describe('report identity/severity coherence fails closed (2026-10-03 review corrections)', () => {
  it('rejects an outer severity below its explicit high advisory instead of suppressing the high', () => {
    expect(() => ok(asResult(advisoryHighDisguisedByModerateReport(), 1))).toThrowError(
      /below its explicit advisory severity/,
    );
    const outLines: string[] = [];
    const errLines: string[] = [];
    const exitCode = main({
      runCommand: () => asResult(advisoryHighDisguisedByModerateReport(), 1),
      out: (line: string) => outLines.push(line),
      err: (line: string) => errLines.push(line),
    });
    expect(exitCode).toBe(1);
    expect(outLines.join('\n')).not.toContain('OK — 0 high/critical');
    expect(errLines.join('\n')).toContain('refusing to report a clean production tree');
  });

  it('rejects a critical meta-parent whose chain only reaches a moderate advisory', () => {
    expect(() => ok(asResult(criticalMetaToModerateLeafReport(), 1))).toThrowError(
      /unsupported by its advisory evidence/,
    );
  });

  it('rejects a critical meta-parent whose chain only reaches the documented high brace advisory', () => {
    expect(() => ok(asResult(criticalMetaToAllowlistedHighReport(), 1))).toThrowError(
      /unsupported by its advisory evidence/,
    );
  });

  it('rejects a malformed advisory URL masquerading as documentation', () => {
    expect(() => ok(asResult(malformedUrlMasqueradingReport(), 1))).toThrowError(
      /unusable documentation URL/,
    );
  });

  it('rejects contradictory finding/advisory package identity', () => {
    expect(() => ok(asResult(nameDependencyMismatchMasqueradingReport(), 1))).toThrowError(
      /contradictory package identity/,
    );
  });

  it('rejects a reference cycle that inflates severities beyond its evidence', () => {
    expect(() => ok(asResult(severityLaunderingCycleReport(), 1))).toThrowError(
      /unsupported by its advisory evidence/,
    );
  });

  it('fails main() closed on every incoherent fixture without printing a clean verdict', () => {
    const fixtures = [
      advisoryHighDisguisedByModerateReport,
      criticalMetaToModerateLeafReport,
      criticalMetaToAllowlistedHighReport,
      malformedUrlMasqueradingReport,
      nameDependencyMismatchMasqueradingReport,
      severityLaunderingCycleReport,
    ];
    for (const build of fixtures) {
      const outLines: string[] = [];
      const errLines: string[] = [];
      const exitCode = main({
        runCommand: () => asResult(build(), 1),
        out: (line: string) => outLines.push(line),
        err: (line: string) => errLines.push(line),
      });
      expect(exitCode).toBe(1);
      expect(outLines.join('\n')).not.toContain('OK — 0 high/critical');
      expect(outLines.join('\n')).not.toContain('every high/critical finding is documented');
      expect(errLines.join('\n')).toContain('refusing to report a clean production tree');
    }
  });

  it('keeps a documented high reached through a meta reference documented', () => {
    const audit = ok(asResult(documentedGroupedMetaControlReport(), 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(0);
    expect(verdict.documented).toHaveLength(1);
    expect(verdict.lines.join('\n')).toContain('[DOCUMENTED 2026-09-29');
  });

  it('keeps reference cycles with real advisory evidence valid and gates the leaf advisory', () => {
    const audit = ok(asResult(evidencedReferenceCycleControlReport(), 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(1);
    expect(verdict.undocumented.map((finding) => finding.name)).toEqual(['b']);
  });

  it('accepts a meta-parent below its leaf severity (aggregated child advisories need not all apply)', () => {
    const audit = ok(asResult(metaParentBelowLeafSeverityControlReport(), 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(1);
    // The leaf's two version-specific advisories both stay visible and gating
    // (one entry each); the moderate meta-parent is never flagged.
    expect(verdict.undocumented.map((finding) => finding.name)).toEqual([
      'leaf-package',
      'leaf-package',
    ]);
    expect(verdict.documented).toHaveLength(0);
  });

  it('keeps scoped package names and grouped references supported', () => {
    const audit = ok(asResult(scopedNamesControlReport(), 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(1);
    expect(verdict.undocumented.map((finding) => finding.name)).toEqual(['@scope/child']);
  });
});

// ---------------------------------------------------------------------------
// 2026-10-03 third independent review corrections (P1): multi-hop evidence
// propagated through meta references must stay bounded at EVERY intermediate
// finding's own reported severity — a high advisory reachable only through a
// moderate intermediary can never justify an impossible high meta-parent. The
// two producer-faithful fixtures come from the actual pinned npm serializer
// (`meta-bounds-replay.json`): the valid control passed at both seams, and
// changing ONLY the parent severity moderate → high produced a false green
// (exit 0, "every high/critical finding is documented") at seam/main/CLI.
// Negative assertions require AUDIT-EXECUTION failure (an incoherent report
// rejected before any verdict) and the absence of clean/documented-success
// verdicts — not merely exit 1 from an unrelated undocumented leaf.
// ---------------------------------------------------------------------------

describe('multi-hop evidence coherence fails closed (2026-10-03 third review corrections)', () => {
  const expectExecutionFailureWithoutVerdict = (build: () => unknown) => {
    expect(() => ok(asResult(build(), 1))).toThrowError(/unsupported by its advisory evidence/);
    const outLines: string[] = [];
    const errLines: string[] = [];
    const exitCode = main({
      runCommand: () => asResult(build(), 1),
      out: (line: string) => outLines.push(line),
      err: (line: string) => errLines.push(line),
    });
    expect(exitCode).toBe(1);
    const out = outLines.join('\n');
    expect(out).not.toContain('OK — 0 high/critical');
    expect(out).not.toContain('every high/critical finding is documented');
    const err = errLines.join('\n');
    expect(err).toContain('audit execution failed');
    expect(err).toContain('refusing to report a clean production tree');
  };

  it('rejects an impossible high meta-parent whose sole contributing child is moderate', () => {
    expectExecutionFailureWithoutVerdict(impossibleHighParentViaModerateChildReport);
  });

  it('rejects a high laundered through a self-supporting cycle behind a lower intermediary', () => {
    expectExecutionFailureWithoutVerdict(highThroughLowerIntermediaryCycleReport);
  });

  it('accepts the producer-faithful two-hop subset control (high → moderate → moderate)', () => {
    const audit = ok(asResult(producerTwoHopSubsetControlReport(), 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(0);
    expect(verdict.undocumented).toHaveLength(0);
    expect(verdict.documented).toHaveLength(2);
    expect(verdict.lines.join('\n')).toContain('every high/critical finding is documented');
    const outLines: string[] = [];
    const errLines: string[] = [];
    const exitCode = main({
      runCommand: () => asResult(producerTwoHopSubsetControlReport(), 1),
      out: (line: string) => outLines.push(line),
      err: (line: string) => errLines.push(line),
    });
    expect(exitCode).toBe(0);
    expect(errLines.join('\n')).toBe('');
    expect(outLines.join('\n')).toContain('[DOCUMENTED 2026-09-29');
    expect(outLines.join('\n')).toContain('every high/critical finding is documented');
  });
});

// ---------------------------------------------------------------------------
// 2026-10-02 independent review corrections (P2): the gate pins npm's audit
// exit threshold (`--audit-level=info`) so inherited npm configuration cannot
// change its status semantics. Valid lower-severity reports stay report-only
// (exit 0) even when npm's configured threshold would have hidden them, while
// exit 0 together with findings remains a fail-closed contradiction.
// ---------------------------------------------------------------------------

describe('npm audit exit-threshold normalization (2026-10-02 review corrections)', () => {
  it('evaluates a valid moderate-only report as a report-only pass', () => {
    const audit = ok(asResult(moderateOnlyReport(), 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(0);
    expect(verdict.lines.join('\n')).toContain('1 moderate');
  });

  it('keeps informational and low severities report-only', () => {
    const audit = ok(asResult(infoAndLowReport(), 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(0);
    expect(verdict.lines.join('\n')).toContain('0 high/critical');
  });

  it('still refuses to trust exit 0 together with findings (fail-closed preserved)', () => {
    expect(() => ok(asResult(moderateOnlyReport(), 0))).toThrowError(/exited 0 while reporting/);
    expect(() => ok(asResult(infoAndLowReport(), 0))).toThrowError(/exited 0 while reporting/);
  });
});

// ---------------------------------------------------------------------------
// The demonstrated false green of the ORIGINAL seam, pinned at the same
// fixtures (task 5.1): the pre-repair evaluation was
// `findings(JSON.parse(result.stdout || '{}'))` — parseable npm error JSON and
// empty failed output both produced "no findings" and exited 0. This shows the
// new tests are red-capable against that behavior: the original evaluation
// returns clean for both fixtures while the repaired seam rejects them.
// ---------------------------------------------------------------------------

describe('original seam false-green demonstration', () => {
  const originalEvaluationClean = (result: CommandResult) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout || '{}');
    } catch {
      return 'parse-failure-exit-1';
    }
    return findings(parsed).length === 0 ? 'clean-exit-0' : 'findings-exit-1';
  };

  it('the original gate wrongly passed npm error JSON and empty failed output', () => {
    const errorFixture = asResult({ error: { code: 'EAI_AGAIN' } }, 1);
    const emptyFixture: CommandResult = { status: 1, stdout: '', stderr: 'npm ERR!' };
    expect(originalEvaluationClean(errorFixture)).toBe('clean-exit-0');
    expect(originalEvaluationClean(emptyFixture)).toBe('clean-exit-0');
    // The repaired seam rejects the exact same fixtures.
    expect(() => validateAuditCommandResult(errorFixture)).toThrowError(AuditExecutionError);
    expect(() => validateAuditCommandResult(emptyFixture)).toThrowError(AuditExecutionError);
    // ...and still fails an undocumented high (the live forge shape) exactly
    // as the original did, so no policy strength was lost.
    expect(originalEvaluationClean(asResult(forgeHighReport(), 1))).toBe('findings-exit-1');
  });
});

// ---------------------------------------------------------------------------
// CLI-level contract (task 5.3 "CLI output/exit semantics"): run the real
// script as a child process against a stub `npm` that replays fixture command
// results, proving the spawn → validate → evaluate wiring and real exit codes.
// ---------------------------------------------------------------------------

describe('audit-runtime-deps CLI contract', () => {
  let shimDir = '';
  let pathKey = 'PATH';

  beforeAll(() => {
    shimDir = mkdtempSync(join(tmpdir(), 'audit-gate-shim-'));
    writeFileSync(
      join(shimDir, 'npm-fixture.js'),
      [
        "const fs = require('node:fs');",
        "const fixture = JSON.parse(fs.readFileSync(process.env.AUDIT_FIXTURE_FILE, 'utf8'));",
        'if (fixture.argsFile) fs.writeFileSync(fixture.argsFile, JSON.stringify(process.argv.slice(2)));',
        'if (fixture.envFile) fs.writeFileSync(fixture.envFile, JSON.stringify({',
        '  npm_config_offline: process.env.npm_config_offline ?? null,',
        '  npm_config_audit_level: process.env.npm_config_audit_level ?? null,',
        '}));',
        '// Pinned-producer model (npm 10.9.8): @npmcli/arborist/lib/audit-report.js',
        '// `AuditReport[_getReport]` returns null BEFORE the registry request when',
        '// the effective `offline` config is true (options.offline === true), while',
        '// `toJSON()` still serializes this clean-shaped report and npm exits 0.',
        '// Effective config follows real npm precedence (validated against the',
        '// pinned npm with `npm config get` and real `npm audit` runs): explicit CLI',
        '// flag > inherited npm_config_<key> env > project/user .npmrc > default.',
        `const PINNED_PRODUCER_OFFLINE_REPORT = ${JSON.stringify(JSON.stringify(PINNED_PRODUCER_OFFLINE_REPORT))};`,
        'const shimArgv = process.argv.slice(2);',
        'const flagValue = shimArgv',
        "  .map((arg) => (arg === '--no-offline' ? 'false' : arg.startsWith('--offline=') ? arg.slice('--offline='.length) : null))",
        '  .filter(Boolean)',
        '  .pop() ?? null;',
        'const envValue = process.env.npm_config_offline;',
        "const fileValue = fixture.npmrcOffline ? 'true' : undefined;",
        "const effectiveOffline = flagValue !== null ? flagValue : envValue !== undefined ? envValue : (fileValue ?? 'false');",
        "if (String(effectiveOffline).toLowerCase() === 'true') {",
        '  if (fixture.offlineSkipOutputFile) fs.writeFileSync(fixture.offlineSkipOutputFile, PINNED_PRODUCER_OFFLINE_REPORT);',
        '  process.stdout.write(PINNED_PRODUCER_OFFLINE_REPORT);',
        '  process.exit(0);',
        '}',
        'if (fixture.stdout) process.stdout.write(fixture.stdout);',
        'if (fixture.stderr) process.stderr.write(fixture.stderr);',
        'if (Number.isInteger(fixture.status)) process.exit(fixture.status);',
        'if (fixture.simulateAuditLevel) {',
        "  // Emulate npm's audit-level exit threshold: an explicit CLI flag beats",
        '  // inherited npm_config_audit_level, which beats the default (low).',
        '  const ranks = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };',
        '  const argLevel = process.argv',
        '    .slice(2)',
        "    .map((arg) => (arg.startsWith('--audit-level=') ? arg.slice('--audit-level='.length) : null))",
        '    .filter(Boolean)',
        '    .pop();',
        "  const level = argLevel || process.env.npm_config_audit_level || 'low';",
        '  const threshold = ranks[level] === undefined ? 0 : ranks[level];',
        '  const counts = JSON.parse(fixture.stdout).metadata.vulnerabilities;',
        "  const found = ['info', 'low', 'moderate', 'high', 'critical'].some(",
        '    (severity) => ranks[severity] >= threshold && counts[severity] > 0,',
        '  );',
        '  process.exit(found ? 1 : 0);',
        '}',
        'process.exit(0);',
      ].join('\n'),
    );
    writeFileSync(
      join(shimDir, 'npm.cmd'),
      '@echo off\r\nnode "%~dp0npm-fixture.js" %*\r\nexit /b %ERRORLEVEL%\r\n',
    );
    const sh = join(shimDir, 'npm');
    writeFileSync(sh, '#!/bin/sh\nexec node "$(dirname "$0")/npm-fixture.js" "$@"\n');
    chmodSync(sh, 0o755);
    pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  });

  afterAll(() => {
    if (shimDir) rmSync(shimDir, { recursive: true, force: true });
  });

  const runCli = (fixture: Record<string, unknown>, extraEnv: Record<string, string> = {}) => {
    const fixtureFile = join(shimDir, `fixture-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(fixtureFile, JSON.stringify(fixture));
    return spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      env: {
        ...process.env,
        [pathKey]: `${shimDir}${delimiter}${process.env[pathKey] ?? ''}`,
        AUDIT_FIXTURE_FILE: fixtureFile,
        ...extraEnv,
      },
    });
  };

  it('exits 0 with a clean-verdict line for a valid clean report', () => {
    const result = runCli({ status: 0, stdout: JSON.stringify(cleanReport()) });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('OK — 0 high/critical in the production tree');
  });

  it('exits 1 and names the advisory for an undocumented high', () => {
    const result = runCli({ status: 1, stdout: JSON.stringify(forgeHighReport()) });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[UNDOCUMENTED] high node-forge GHSA-86w9-cpqp-85rv');
    expect(result.stderr).toContain('undocumented high/critical advisory(ies)');
  });

  it('exits 1 on npm error JSON without printing a clean verdict', () => {
    const result = runCli({
      status: 1,
      stdout: JSON.stringify({ error: { code: 'EAI_AGAIN', summary: 'registry unreachable' } }),
    });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('OK — 0 high/critical');
    expect(result.stderr).toContain('audit execution failed');
    expect(result.stderr).toContain('EAI_AGAIN');
  });

  it('exits 1 on empty failed output without printing a clean verdict', () => {
    const result = runCli({ status: 1, stdout: '', stderr: 'npm ERR! code EAI_AGAIN' });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('OK — 0 high/critical');
    expect(result.stderr).toContain('empty output');
    expect(result.stderr).toContain('refusing to report a clean production tree');
  });

  it('still surfaces documented findings visibly and passes them', () => {
    const result = runCli({ status: 1, stdout: JSON.stringify(documentedBraceReport()) });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[DOCUMENTED 2026-09-29');
    expect(result.stdout).toContain('brace-expansion');
  });

  // 2026-10-02 review corrections (P1): the seven invalid/incoherent reports
  // plus the reference-cycle case replayed through the real CLI with the exact
  // command results from the review repro. Each previously exited 0 (false
  // security green); each must now fail visibly before any clean verdict.
  it.each([
    ['unsupported report version', unsupportedVersionReport, 0],
    ['metadata high with empty findings', metadataHighEmptyFindingsReport, 0],
    ['uppercase severity hiding a high', uppercaseSeverityReport, 1],
    ['high finding with empty via', emptyViaReport, 1],
    ['critical with unresolved via reference', unresolvedReferenceReport, 1],
    ['documented advisory with empty paths', emptyPathsReport, 1],
    ['invalid metadata counts', invalidCountsReport, 0],
    ['via reference cycle without evidence', referenceCycleReport, 1],
  ] as [string, () => unknown, number][])(
    'exits 1 without a clean verdict for %s',
    (_name, build, status) => {
      const result = runCli({ status, stdout: JSON.stringify(build()) });
      expect(result.status).toBe(1);
      expect(result.stdout).not.toContain('OK — 0 high/critical');
      expect(result.stdout).not.toContain('every high/critical finding is documented');
      expect(result.stderr).toContain('audit execution failed');
      expect(result.stderr).toContain('refusing to report a clean production tree');
    },
  );

  // 2026-10-02 review corrections (P2): the shim npm emulates npm's real
  // audit-level semantics (explicit flag > inherited config > default). The
  // fixture imitates npm 10.9.8 with `audit-level=critical` inherited: without
  // the gate's explicit `--audit-level=info` normalization the shim would exit
  // 0 and the gate would reject a perfectly valid moderate report.
  it('pins the audit exit threshold against inherited npm configuration', () => {
    const id = Math.random().toString(36).slice(2);
    const argsFile = join(shimDir, `args-${id}.json`);
    const fixtureFile = join(shimDir, `fixture-${id}.json`);
    writeFileSync(
      fixtureFile,
      JSON.stringify({
        stdout: JSON.stringify(moderateOnlyReport()),
        simulateAuditLevel: true,
        argsFile,
      }),
    );
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      env: {
        ...process.env,
        [pathKey]: `${shimDir}${delimiter}${process.env[pathKey] ?? ''}`,
        AUDIT_FIXTURE_FILE: fixtureFile,
        npm_config_audit_level: 'critical',
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('OK — 0 high/critical');
    expect(result.stdout).toContain('report-only by policy');
    const args = JSON.parse(readFileSync(argsFile, 'utf8')) as string[];
    expect(args).toContain('--audit-level=info');
    expect(args).toContain('--omit=dev');
    expect(args).toContain('--json');
  });

  it('evaluates lower-severity-only reports as report-only under the pinned threshold', () => {
    const result = runCli({ stdout: JSON.stringify(infoAndLowReport()), simulateAuditLevel: true });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('report-only by policy');
  });

  // 2026-10-03 second review corrections (P1): the five identity/severity/
  // URL incoherent reports plus the severity-laundering cycle replayed through
  // the real CLI with the exact shapes from the review repro. Each previously
  // exited 0 (false security green); each must fail visibly before any verdict.
  it.each([
    [
      'high advisory disguised by a moderate outer finding',
      advisoryHighDisguisedByModerateReport,
      1,
    ],
    ['critical meta-parent reaching only a moderate advisory', criticalMetaToModerateLeafReport, 1],
    [
      'critical meta-parent reaching only the documented high',
      criticalMetaToAllowlistedHighReport,
      1,
    ],
    ['malformed advisory URL masquerading as documentation', malformedUrlMasqueradingReport, 1],
    [
      'contradictory finding/advisory package identity',
      nameDependencyMismatchMasqueradingReport,
      1,
    ],
    ['reference cycle inflating severities beyond its evidence', severityLaunderingCycleReport, 1],
  ] as [string, () => unknown, number][])(
    'exits 1 without a clean verdict for %s',
    (_name, build, status) => {
      const result = runCli({ status, stdout: JSON.stringify(build()) });
      expect(result.status).toBe(1);
      expect(result.stdout).not.toContain('OK — 0 high/critical');
      expect(result.stdout).not.toContain('every high/critical finding is documented');
      expect(result.stderr).toContain('audit execution failed');
      expect(result.stderr).toContain('refusing to report a clean production tree');
    },
  );

  it('still passes a documented high reached through a meta reference at the CLI', () => {
    const result = runCli({
      status: 1,
      stdout: JSON.stringify(documentedGroupedMetaControlReport()),
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[DOCUMENTED 2026-09-29');
  });

  // 2026-10-03 third review corrections (P1): the producer-faithful multi-hop
  // pair replayed through the real CLI. The impossible high meta-parent (and
  // the high laundered through a cycle behind a lower intermediary) previously
  // exited 0 printing "every high/critical finding is documented" — a false
  // security green, not an exit 1 from an unrelated leaf. Each must now fail
  // as an audit-EXECUTION failure before any verdict.
  it.each([
    [
      'impossible high meta-parent via a moderate-only child',
      impossibleHighParentViaModerateChildReport,
    ],
    [
      'high laundered through a self-supporting cycle behind a lower intermediary',
      highThroughLowerIntermediaryCycleReport,
    ],
  ] as [string, () => unknown][])(
    'exits 1 without a clean or documented verdict for %s',
    (_name, build) => {
      const result = runCli({ status: 1, stdout: JSON.stringify(build()) });
      expect(result.status).toBe(1);
      expect(result.stdout).not.toContain('OK — 0 high/critical');
      expect(result.stdout).not.toContain('every high/critical finding is documented');
      expect(result.stderr).toContain('audit execution failed');
      expect(result.stderr).toContain('refusing to report a clean production tree');
    },
  );

  it('still passes the producer-faithful two-hop subset control at the CLI', () => {
    const result = runCli({
      status: 1,
      stdout: JSON.stringify(producerTwoHopSubsetControlReport()),
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[DOCUMENTED 2026-09-29');
    expect(result.stdout).toContain('every high/critical finding is documented');
    expect(result.stderr).toBe('');
  });

  it('still gates the leaf advisory of an evidenced reference cycle at the CLI', () => {
    const result = runCli({
      status: 1,
      stdout: JSON.stringify(evidencedReferenceCycleControlReport()),
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[UNDOCUMENTED] high b GHSA-86w9-cpqp-85rv');
  });

  // 2026-10-03 second review corrections (P1): the pinned producer skips the
  // registry request entirely when npm's effective `offline` config is true and
  // still serializes a clean-shaped report with exit 0 (actual reproduction in
  // `simulation-output/security-correction-review-2026-10-03/audit-offline.log`).
  // The shim below models that producer behavior and npm's real config
  // precedence (explicit CLI flag > inherited env > project/user config), so
  // these tests stay deterministic and network-free.
  it('models the pinned producer: effective offline skips the audit with a clean-shaped report', () => {
    const runShimDirectly = (
      extraEnv: Record<string, string>,
      argv: string[] = [],
      fixtureOver: Record<string, unknown> = {},
    ) => {
      const id = Math.random().toString(36).slice(2);
      const fixtureFile = join(shimDir, `fixture-shim-${id}.json`);
      writeFileSync(
        fixtureFile,
        JSON.stringify({ stdout: JSON.stringify(forgeHighReport()), ...fixtureOver }),
      );
      // Strip ambient npm config channels so the precedence under test is exact.
      const baseEnv = { ...process.env };
      for (const key of Object.keys(baseEnv)) {
        if (
          key.toLowerCase() === 'npm_config_offline' ||
          key.toLowerCase() === 'npm_config_audit_level'
        ) {
          delete baseEnv[key];
        }
      }
      const env = {
        ...baseEnv,
        [pathKey]: `${shimDir}${delimiter}${process.env[pathKey] ?? ''}`,
        AUDIT_FIXTURE_FILE: fixtureFile,
        ...extraEnv,
      };
      return spawnSync(process.execPath, [join(shimDir, 'npm-fixture.js'), ...argv], {
        encoding: 'utf8',
        env,
      });
    };
    const envOfflineOnly = (over: Record<string, string>) => {
      const env = { npm_config_offline: 'true', ...over };
      return env;
    };
    // Inherited npm_config_offline=true alone → the producer skips the request.
    const envSkip = runShimDirectly(envOfflineOnly({}));
    expect(envSkip.status).toBe(0);
    expect(JSON.parse(envSkip.stdout)).toEqual(PINNED_PRODUCER_OFFLINE_REPORT);
    // ...an explicit CLI --offline=false beats inherited env (npm precedence).
    const flagBeatsEnv = runShimDirectly(envOfflineOnly({}), ['audit', '--offline=false']);
    expect(flagBeatsEnv.stdout.trim()).toContain('node-forge');
    // ...a project/user .npmrc offline=true alone also skips...
    const fileSkip = runShimDirectly({}, [], { npmrcOffline: true });
    expect(fileSkip.status).toBe(0);
    expect(JSON.parse(fileSkip.stdout)).toEqual(PINNED_PRODUCER_OFFLINE_REPORT);
    // ...and the explicit CLI flag beats that config file channel too.
    const flagBeatsFile = runShimDirectly({}, ['audit', '--offline=false'], { npmrcOffline: true });
    expect(flagBeatsFile.stdout.trim()).toContain('node-forge');
  });

  it('fails closed when npm inherits offline mode instead of reporting a clean tree', () => {
    const id = Math.random().toString(36).slice(2);
    const argsFile = join(shimDir, `args-${id}.json`);
    const envFile = join(shimDir, `env-${id}.json`);
    const result = runCli(
      {
        stdout: JSON.stringify(forgeHighReport()),
        simulateAuditLevel: true,
        argsFile,
        envFile,
      },
      { npm_config_offline: 'true' },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[UNDOCUMENTED] high node-forge GHSA-86w9-cpqp-85rv');
    expect(result.stdout).not.toContain('OK — 0 high/critical');
    // The transport must normalize offline on the command line AND in config.
    const args = JSON.parse(readFileSync(argsFile, 'utf8')) as string[];
    expect(args).toContain('--offline=false');
    const envSeen = JSON.parse(readFileSync(envFile, 'utf8')) as Record<string, string | null>;
    expect(envSeen.npm_config_offline).toBe('false');
  });

  it('overrides a project/user npmrc offline=true through the explicit normalization', () => {
    const id = Math.random().toString(36).slice(2);
    const argsFile = join(shimDir, `args-npmrc-${id}.json`);
    const result = runCli({
      stdout: JSON.stringify(forgeHighReport()),
      simulateAuditLevel: true,
      npmrcOffline: true,
      argsFile,
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[UNDOCUMENTED] high node-forge GHSA-86w9-cpqp-85rv');
    const args = JSON.parse(readFileSync(argsFile, 'utf8')) as string[];
    expect(args).toContain('--offline=false');
  });

  it('demonstrates the un-normalized inherited-offline false green the shape cannot catch', () => {
    // The pre-fix transport inherited npm's offline config: the producer skipped
    // the registry request and the gate accepted the clean-shaped report —
    // reproduced exactly as the actual pinned npm did
    // (`simulation-output/security-correction-review-2026-10-03/audit-offline.log`:
    // exit 0, OK — 0 high/critical on the vulnerable tree).
    const id = Math.random().toString(36).slice(2);
    const fixtureFile = join(shimDir, `fixture-demo-${id}.json`);
    writeFileSync(
      fixtureFile,
      JSON.stringify({ stdout: JSON.stringify(forgeHighReport()), simulateAuditLevel: true }),
    );
    const raw = spawnSync(process.execPath, [join(shimDir, 'npm-fixture.js'), 'audit'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        [pathKey]: `${shimDir}${delimiter}${process.env[pathKey] ?? ''}`,
        AUDIT_FIXTURE_FILE: fixtureFile,
        npm_config_offline: 'true',
      },
    });
    expect(raw.status).toBe(0);
    expect(JSON.parse(raw.stdout)).toEqual(PINNED_PRODUCER_OFFLINE_REPORT);
    // The skipped-audit report is indistinguishable from a clean audit by shape:
    // the seam accepts it and the policy would print a clean verdict...
    // (the pre-fix gate did exactly this — reproduced false green exit 0.)
    const audit = validateAuditCommandResult({
      status: 0,
      stdout: raw.stdout,
      stderr: raw.stderr,
    });
    expect(evaluateAudit(audit).exitCode).toBe(0);
    // ...which is why the transport must normalize offline instead of trusting
    // the report shape (the fixed gate fails the same payload closed above).
  });
});
