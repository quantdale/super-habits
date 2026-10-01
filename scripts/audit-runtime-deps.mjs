/**
 * Runtime dependency advisory gate for the `quality` job.
 *
 * What it guarantees: a NEW high or critical advisory in the production
 * dependency tree fails the gate, so the "critical/high must be zero" policy in
 * `.github/workflows/ci.yml` is actually enforced instead of merely asserted.
 *
 * What it does NOT do: hide documented findings. Every finding is printed with
 * its classification, so the report stays visible in the job log.
 *
 * The allowlist below is deliberately narrow, dated, and matched against the
 * exact dependency paths `npm audit` reports — a new path or a new advisory id
 * for the same package fails the gate. Removing an entry requires proving the
 * underlying bump landed.
 */
import { spawnSync } from 'node:child_process';

/**
 * Build-time-only advisories behind a deliberately pinned tooling chain
 * (allowlist dated 2026-09-29).
 *
 * `brace-expansion` 1.x/2.x are reached through `test-exclude`
 * (`babel-plugin-istanbul`, coverage only) and `glob@9` -> `minimatch@8`.
 * Neither chain has a non-breaking fixed version: the 1.x and 2.x release lines
 * are themselves the vulnerable ranges, and npm's only offered resolution is
 * `react-native@0.87.1` — a major bump the repository must decide on
 * deliberately (same policy as the framework-owned moderate findings). Neither
 * module is loaded by the web or native bundle.
 *
 * The 5.x `brace-expansion` copy IS fixed by an `overrides` entry
 * (`brace-expansion@^5.0.0` -> `^5.0.12`, added 2026-09-29) and is therefore
 * NOT allowlisted.
 */
const DOCUMENTED_BUILD_TIME_ADVISORIES = [
  {
    advisory: 'GHSA-q2hr-2g5m-vwhr',
    packageName: 'brace-expansion',
    nodes: [
      'node_modules/glob/node_modules/brace-expansion',
      'node_modules/test-exclude/node_modules/brace-expansion',
    ],
    reason: 'coverage/glob tooling only; no non-breaking fix (npm offers react-native@0.87.1)',
  },
  {
    advisory: 'GHSA-qhr7-859c-m2p7',
    packageName: 'brace-expansion',
    nodes: [
      'node_modules/glob/node_modules/brace-expansion',
      'node_modules/test-exclude/node_modules/brace-expansion',
    ],
    reason: 'coverage/glob tooling only; no non-breaking fix (npm offers react-native@0.87.1)',
  },
  {
    advisory: 'GHSA-6j4f-fj2g-mc7p',
    packageName: 'brace-expansion',
    nodes: [
      'node_modules/glob/node_modules/brace-expansion',
      'node_modules/test-exclude/node_modules/brace-expansion',
    ],
    reason: 'coverage/glob tooling only; no non-breaking fix (npm offers react-native@0.87.1)',
  },
];

function runAudit() {
  const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  try {
    return JSON.parse(result.stdout || '{}');
  } catch {
    console.error('audit-runtime-deps: could not parse `npm audit --json` output');
    console.error((result.stdout ?? '(no output)').slice(0, 2_000));
    process.exit(1);
  }
}

/** High/critical findings, one entry per advisory per vulnerable package. */
function findings(audit) {
  const out = [];
  for (const [name, vulnerability] of Object.entries(audit.vulnerabilities ?? {})) {
    if (vulnerability.severity !== 'high' && vulnerability.severity !== 'critical') continue;
    for (const via of vulnerability.via ?? []) {
      if (typeof via === 'string') continue; // grouped reference to another advisory
      out.push({
        name,
        nodes: vulnerability.nodes ?? [],
        advisory:
          String(via.url ?? '')
            .split('/')
            .pop() ||
          via.title ||
          'unknown',
        severity: vulnerability.severity,
        title: via.title,
        range: vulnerability.range,
        fixAvailable: vulnerability.fixAvailable,
      });
    }
  }
  return out;
}

/**
 * A finding is documented only when an allowlist entry names the same advisory,
 * the same package, AND covers every path npm reported for it — so a new path
 * for a known advisory is still a failure.
 */
function isDocumented(finding) {
  const entry = DOCUMENTED_BUILD_TIME_ADVISORIES.find(
    (candidate) =>
      candidate.advisory === finding.advisory && candidate.packageName === finding.name,
  );
  if (!entry) return null;
  const covered = finding.nodes.every((node) => entry.nodes.includes(node));
  return covered ? entry : null;
}

const audit = runAudit();
const highOrCritical = findings(audit);

if (highOrCritical.length === 0) {
  const counts = audit.metadata?.vulnerabilities ?? {};
  console.log(
    `audit-runtime-deps: OK — 0 high/critical in the production tree ` +
      `(${counts.moderate ?? 0} moderate, ${counts.low ?? 0} low; report-only by policy).`,
  );
  process.exit(0);
}

const undocumented = [];
for (const finding of highOrCritical) {
  const entry = isDocumented(finding);
  if (entry) {
    console.log(
      `audit-runtime-deps: [DOCUMENTED 2026-09-29 — ${entry.reason}] ` +
        `${finding.severity} ${finding.name} ${finding.advisory} [${finding.nodes.join(', ')}]`,
    );
  } else {
    undocumented.push(finding);
    console.log(
      `audit-runtime-deps: [UNDOCUMENTED] ${finding.severity} ${finding.name} ` +
        `${finding.advisory} [${finding.nodes.join(', ')}]`,
    );
  }
  console.log(`    ${finding.title ?? '(no title)'}`);
  console.log(`    range: ${finding.range ?? 'unknown'}`);
}

if (undocumented.length > 0) {
  console.error(
    `\naudit-runtime-deps: ${undocumented.length} undocumented high/critical advisory(ies) in the production tree.`,
  );
  console.error(
    'Policy (production-closure Phase 8): critical/high must be zero. Fix the dependency, or add a',
  );
  console.error(
    'dated, narrowly-scoped entry to DOCUMENTED_BUILD_TIME_ADVISORIES naming its paths and reason.',
  );
  process.exit(1);
}

console.log(
  '\naudit-runtime-deps: OK — every high/critical finding is documented, dated, and build-time-only.',
);
process.exit(0);
