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
 *
 * FAIL-CLOSED COMMAND/REPORT BOUNDARY (added 2026-10-02, change
 * `resolve-windows-dependency-security`): the gate previously accepted parseable
 * npm error JSON and empty failed output as "no findings", exiting 0 — a false
 * clean verdict from a failed audit. `validateAuditCommandResult()` now rejects
 * transport errors, empty/malformed output, npm error objects, unsupported
 * report shapes, invalid finding shapes, unexpected termination and exit-status
 * results that contradict the report, before any finding is evaluated. npm
 * exiting 1 because valid advisories exist is expected and is still evaluated
 * under the unchanged advisory policy below.
 */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

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

/** High/critical findings, one entry per advisory per vulnerable package. */
export function findings(audit) {
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
export function isDocumented(finding) {
  const entry = DOCUMENTED_BUILD_TIME_ADVISORIES.find(
    (candidate) =>
      candidate.advisory === finding.advisory && candidate.packageName === finding.name,
  );
  if (!entry) return null;
  const covered = finding.nodes.every((node) => entry.nodes.includes(node));
  return covered ? entry : null;
}

/** An audit command result that cannot be trusted as a report either way. */
export class AuditExecutionError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'AuditExecutionError';
    this.detail = detail;
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Bounded diagnostic context — never echo an unbounded report. */
function snapshot(text, limit = 500) {
  return String(text ?? '')
    .slice(0, limit)
    .trim();
}

function describeNpmError(parsed) {
  const error = parsed.error ?? {};
  const parts = [error.code, error.summary, error.detail].filter(
    (part) => typeof part === 'string' && part.length > 0,
  );
  return parts.length > 0 ? ` (${parts.join(' — ')})` : '';
}

/**
 * Validate a raw `npm audit --json` command result before any finding is
 * evaluated. Returns the parsed audit report, or throws AuditExecutionError.
 *
 * Rejected (fail closed): spawn/transport errors, signal termination, missing or
 * unexpected exit status, empty or malformed output, parseable npm error
 * objects, unsupported report shapes, invalid finding shapes, and results whose
 * exit status contradicts the report (npm exits 1 iff it reports at least one
 * vulnerability at the default audit level). npm exiting 1 with a valid
 * vulnerability report is a normal advisory result and is returned, not
 * rejected.
 */
export function validateAuditCommandResult(result) {
  if (!isPlainObject(result)) {
    throw new AuditExecutionError('audit command returned no result object');
  }
  if (result.error) {
    throw new AuditExecutionError(
      `audit command failed to run: ${result.error.message ?? String(result.error)}`,
      snapshot(result.stderr),
    );
  }
  if (result.signal) {
    throw new AuditExecutionError(
      `audit command terminated by signal ${result.signal}`,
      snapshot(result.stderr),
    );
  }
  if (!Number.isInteger(result.status)) {
    throw new AuditExecutionError(
      `audit command produced no exit status (status=${String(result.status)})`,
      snapshot(result.stderr),
    );
  }
  if (result.status !== 0 && result.status !== 1) {
    throw new AuditExecutionError(
      `audit command exited with unexpected status ${result.status}`,
      snapshot(result.stderr),
    );
  }
  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  if (stdout.trim() === '') {
    throw new AuditExecutionError(
      `audit command failed (exit status ${result.status}) with empty output`,
      snapshot(result.stderr),
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new AuditExecutionError('could not parse `npm audit --json` output', snapshot(stdout));
  }
  if (!isPlainObject(parsed)) {
    throw new AuditExecutionError('audit report is not a JSON object', snapshot(stdout));
  }
  if (Object.prototype.hasOwnProperty.call(parsed, 'error')) {
    throw new AuditExecutionError(
      `npm returned an error object instead of an audit report${describeNpmError(parsed)}`,
      snapshot(stdout),
    );
  }
  if (!Number.isFinite(parsed.auditReportVersion)) {
    throw new AuditExecutionError(
      'audit report has no supported auditReportVersion',
      snapshot(stdout),
    );
  }
  if (!isPlainObject(parsed.vulnerabilities)) {
    throw new AuditExecutionError('audit report has no vulnerabilities object', snapshot(stdout));
  }
  if (!isPlainObject(parsed.metadata) || !isPlainObject(parsed.metadata.vulnerabilities)) {
    throw new AuditExecutionError(
      'audit report has no metadata.vulnerabilities object',
      snapshot(stdout),
    );
  }
  for (const [name, vulnerability] of Object.entries(parsed.vulnerabilities)) {
    if (!isPlainObject(vulnerability)) {
      throw new AuditExecutionError(`audit finding "${name}" is not an object`, snapshot(stdout));
    }
    if (typeof vulnerability.severity !== 'string' || !Array.isArray(vulnerability.via)) {
      throw new AuditExecutionError(
        `audit finding "${name}" has an invalid finding shape`,
        snapshot(stdout),
      );
    }
    if (!Array.isArray(vulnerability.nodes)) {
      throw new AuditExecutionError(
        `audit finding "${name}" has no reported dependency paths`,
        snapshot(stdout),
      );
    }
    for (const via of vulnerability.via) {
      if (typeof via === 'string') continue;
      if (!isPlainObject(via) || typeof via.title !== 'string' || typeof via.url !== 'string') {
        throw new AuditExecutionError(
          `audit finding "${name}" has an invalid advisory entry shape`,
          snapshot(stdout),
        );
      }
    }
  }
  const reported = Object.keys(parsed.vulnerabilities).length > 0;
  if (result.status === 0 && reported) {
    throw new AuditExecutionError(
      'audit command exited 0 while reporting vulnerabilities',
      snapshot(stdout),
    );
  }
  if (result.status === 1 && !reported) {
    throw new AuditExecutionError(
      'audit command exited 1 without reporting a vulnerability or an error',
      snapshot(stdout),
    );
  }
  return parsed;
}

/**
 * Apply the advisory policy to a VALIDATED audit report. Pure decision seam:
 * returns the exit code and the report lines; performs no I/O and never exits.
 */
export function evaluateAudit(audit) {
  const highOrCritical = findings(audit);
  const lines = [];
  const errorLines = [];

  if (highOrCritical.length === 0) {
    const counts = audit.metadata?.vulnerabilities ?? {};
    lines.push(
      `audit-runtime-deps: OK — 0 high/critical in the production tree ` +
        `(${counts.moderate ?? 0} moderate, ${counts.low ?? 0} low; report-only by policy).`,
    );
    return { exitCode: 0, lines, errorLines, undocumented: [], documented: [] };
  }

  const undocumented = [];
  const documented = [];
  for (const finding of highOrCritical) {
    const entry = isDocumented(finding);
    if (entry) {
      documented.push(finding);
      lines.push(
        `audit-runtime-deps: [DOCUMENTED 2026-09-29 — ${entry.reason}] ` +
          `${finding.severity} ${finding.name} ${finding.advisory} [${finding.nodes.join(', ')}]`,
      );
    } else {
      undocumented.push(finding);
      lines.push(
        `audit-runtime-deps: [UNDOCUMENTED] ${finding.severity} ${finding.name} ` +
          `${finding.advisory} [${finding.nodes.join(', ')}]`,
      );
    }
    lines.push(`    ${finding.title ?? '(no title)'}`);
    lines.push(`    range: ${finding.range ?? 'unknown'}`);
  }

  if (undocumented.length > 0) {
    errorLines.push(
      `\naudit-runtime-deps: ${undocumented.length} undocumented high/critical advisory(ies) in the production tree.`,
    );
    errorLines.push(
      'Policy (production-closure Phase 8): critical/high must be zero. Fix the dependency, or add a',
    );
    errorLines.push(
      'dated, narrowly-scoped entry to DOCUMENTED_BUILD_TIME_ADVISORIES naming its paths and reason.',
    );
    return { exitCode: 1, lines, errorLines, undocumented, documented };
  }

  lines.push(
    '\naudit-runtime-deps: OK — every high/critical finding is documented, dated, and build-time-only.',
  );
  return { exitCode: 0, lines, errorLines, undocumented, documented };
}

/** Command transport, separated from report validation and policy decisions. */
export function runAuditCommand() {
  return spawnSync('npm', ['audit', '--omit=dev', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
}

/**
 * Orchestrate transport -> validation -> policy. Returns the exit code; prints
 * through the injected loggers so tests can observe the exact CLI contract.
 *
 * @param {object} [options]
 * @param {() => object} [options.runCommand] raw command-result provider
 * @param {(line: string) => void} [options.out] report logger
 * @param {(line: string) => void} [options.err] diagnostic logger
 * @returns {number} process exit code
 */
export function main({ runCommand = runAuditCommand, out = console.log, err = console.error } = {}) {
  let audit;
  try {
    audit = validateAuditCommandResult(runCommand());
  } catch (error) {
    if (!(error instanceof AuditExecutionError)) throw error;
    err(`audit-runtime-deps: ${error.message}`);
    if (error.detail) err(error.detail);
    err(
      'audit-runtime-deps: audit execution failed — refusing to report a clean production tree from an invalid result.',
    );
    return 1;
  }
  const verdict = evaluateAudit(audit);
  for (const line of verdict.lines) out(line);
  for (const line of verdict.errorLines) err(line);
  return verdict.exitCode;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const exitCode = main();
  if (exitCode !== 0) {
    process.exit(1);
  }
  process.exit(0);
}
