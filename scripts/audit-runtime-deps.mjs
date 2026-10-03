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
 *
 * CORRECTIVE HARDENING (2026-10-02 independent review of the apply): the
 * boundary now pins the supported npm report schema explicitly —
 * `auditReportVersion` 2, known severity enums, non-negative integer
 * `metadata.vulnerabilities` counts coherent with the reported findings,
 * non-empty dependency paths, and usable advisory evidence at the end of every
 * `via` reference chain (no dangling references, no evidence-free cycles) — so
 * malformed or incoherent reports fail visibly instead of producing false
 * security greens. The audit exit threshold is also normalized on the command
 * line (`--audit-level=info`, plus the matching `npm_config` override) so
 * inherited npm configuration cannot flip a valid lower-severity report into a
 * false red: npm exits 1 iff it reports a vulnerability entry, and the gate
 * still treats exit 0 together with findings as a contradiction.
 *
 * SECOND CORRECTIVE HARDENING (2026-10-03 second independent review): the
 * boundary now validates advisory/package/URL identity and severity coherence
 * against the supported producer's schema (`@npmcli/arborist` `Vuln.toJSON()` /
 * `Vuln.addAdvisory`, `@npmcli/metavuln-calculator` `Advisory`) before any
 * clean or documented verdict: every object `via` entry is a direct advisory
 * whose `name`/`dependency` equal its finding key, carries a usable http(s)
 * advisory URL (parseable, non-empty final path segment as the advisory id) and
 * an explicit severity enum; a finding's severity can never sit below its
 * explicit advisory severities, and never above the advisory evidence its
 * `via` reference chain actually reaches (meta references aggregate child
 * advisories that need not all apply to the parent, so a meta severity below
 * its referenced finding is legitimate — an unsupported higher one is not).
 * The transport also normalizes npm's `offline` config (command line and
 * `npm_config`) — an inherited offline mode made the pinned producer skip the
 * registry request entirely and serialize a clean-shaped report with exit 0,
 * which report shape alone cannot distinguish from a completed clean audit.
 *
 * THIRD CORRECTIVE HARDENING (2026-10-03 third independent review): the
 * evidence bound propagated through `via` reference chains is now capped at
 * EVERY intermediate finding's own reported severity, not just at the distant
 * descendant advisories reachable anywhere in the graph. A meta parent's
 * contributing set is a subset of its referenced finding's contributing
 * advisories (`Vuln.addAdvisory` takes their maximum), so a HIGH advisory that
 * is reachable only through a MODERATE intermediary can never justify an
 * impossible HIGH meta-parent — previously the unbounded maximum propagated
 * straight through the moderate intermediary and the gate printed a documented
 * security green (exactly the producer-backed `meta-bounds-replay.json` false
 * green). Each reference hop contributes at most
 * `min(anchoredEvidence, referencedFinding.severity)` over an evidence-anchored
 * least fixed point, so self-supporting reference cycles cannot bootstrap
 * severity from claimed severities alone, while legitimate subset shapes stay
 * valid (parents BELOW their referenced findings' aggregate severity,
 * evidenced cycles, multiple contributors, explicit advisory minimums).
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
        advisory: parseAdvisoryUrl(String(via.url ?? '')) || via.title || 'unknown',
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
 * for a known advisory is still a failure. An empty path list is never
 * documented: it would satisfy "every path" vacuously while carrying no
 * verifiable dependency path at all.
 */
export function isDocumented(finding) {
  const entry = DOCUMENTED_BUILD_TIME_ADVISORIES.find(
    (candidate) =>
      candidate.advisory === finding.advisory && candidate.packageName === finding.name,
  );
  if (!entry) return null;
  if (!Array.isArray(finding.nodes) || finding.nodes.length === 0) return null;
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

/**
 * Extract the advisory id from a usable documentation URL, or null when the
 * string is not one. The supported producer serializes the registry advisory's
 * `url` verbatim (https://github.com/advisories/GHSA-… or the npm advisory
 * page); the advisory id is the final path segment of that absolute http(s)
 * URL. Anything else — a bare `x/ID` string, a non-web scheme, an empty final
 * segment — is not a parseable advisory identity and must never satisfy the
 * documented allowlist by its slash suffix alone.
 */
function parseAdvisoryUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    return null;
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.hostname === '') return null;
  const segment = String(url.pathname).split('/').pop() ?? '';
  return segment.length > 0 ? segment : null;
}

/** Bounded diagnostic context — never echo an unbounded report. */
function snapshot(text, limit = 500) {
  return String(text ?? '')
    .slice(0, limit)
    .trim();
}

/** The npm `audit --json` report schema this gate supports (npm 7+ = version 2). */
export const SUPPORTED_AUDIT_REPORT_VERSION = 2;

/** Severity values npm reports; anything else is an invalid finding shape. */
const SEVERITY_LEVELS = ['info', 'low', 'moderate', 'high', 'critical'];

/** metadata.vulnerabilities keys: one non-negative integer count per severity + total. */
const METADATA_COUNT_KEYS = [...SEVERITY_LEVELS, 'total'];

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
 * objects, unsupported report schemas (only `auditReportVersion` 2 is
 * supported), invalid finding shapes (unknown severity enums, empty `via`,
 * unusable dependency paths, malformed advisory entries), incoherent reports
 * (metadata counts that are not non-negative integers or that contradict the
 * reported findings), advisory/reference defects (dangling `via` references,
 * reference chains with no usable advisory evidence), and results whose exit
 * status contradicts the report. The status invariant is sound because
 * `runAuditCommand()` pins `--audit-level=info`: npm exits 1 iff it reports at
 * least one vulnerability entry (every severity is at or above `info`). npm
 * exiting 1 with a valid vulnerability report is a normal advisory result and
 * is returned, not rejected.
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
  if (parsed.auditReportVersion !== SUPPORTED_AUDIT_REPORT_VERSION) {
    throw new AuditExecutionError(
      `audit report has an unsupported auditReportVersion ${JSON.stringify(parsed.auditReportVersion ?? null)} (supported schema: ${SUPPORTED_AUDIT_REPORT_VERSION})`,
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
  const counts = parsed.metadata.vulnerabilities;
  if (
    Object.keys(counts).some((key) => !METADATA_COUNT_KEYS.includes(key)) ||
    METADATA_COUNT_KEYS.some((key) => !Number.isSafeInteger(counts[key]) || counts[key] < 0)
  ) {
    throw new AuditExecutionError(
      'audit report metadata.vulnerabilities counts must be non-negative integers for info, low, moderate, high, critical, and total',
      snapshot(stdout),
    );
  }
  for (const [name, vulnerability] of Object.entries(parsed.vulnerabilities)) {
    if (!isPlainObject(vulnerability)) {
      throw new AuditExecutionError(`audit finding "${name}" is not an object`, snapshot(stdout));
    }
    // Known severity enum + at least one advisory or meta-vulnerability via
    // entry: a high/critical finding with no via entry hides its advisory
    // evidence, and an unknown severity enum (e.g. "HIGH") hides a real high.
    if (
      !SEVERITY_LEVELS.includes(vulnerability.severity) ||
      !Array.isArray(vulnerability.via) ||
      vulnerability.via.length === 0
    ) {
      throw new AuditExecutionError(
        `audit finding "${name}" has an invalid finding shape`,
        snapshot(stdout),
      );
    }
    // Producer identity: the report keys findings by package name and the
    // producer serializes that same name as `vulnerability.name`. A body that
    // names a different package is contradictory identity, never documentation.
    if (vulnerability.name !== name) {
      throw new AuditExecutionError(
        `audit finding "${name}" has contradictory package identity (body name ${JSON.stringify(vulnerability.name)})`,
        snapshot(stdout),
      );
    }
    const usableNodes =
      Array.isArray(vulnerability.nodes) &&
      vulnerability.nodes.length > 0 &&
      vulnerability.nodes.every((node) => typeof node === 'string' && node.length > 0);
    if (!usableNodes) {
      throw new AuditExecutionError(
        `audit finding "${name}" has no usable reported dependency paths`,
        snapshot(stdout),
      );
    }
    let maxExplicitSeverityRank = -1;
    for (const via of vulnerability.via) {
      if (typeof via === 'string') continue;
      const usableAdvisory =
        isPlainObject(via) &&
        typeof via.title === 'string' &&
        via.title.length > 0 &&
        typeof via.url === 'string' &&
        via.url.length > 0 &&
        typeof via.name === 'string' &&
        via.name.length > 0 &&
        typeof via.dependency === 'string' &&
        via.dependency.length > 0 &&
        SEVERITY_LEVELS.includes(via.severity);
      if (!usableAdvisory) {
        throw new AuditExecutionError(
          `audit finding "${name}" has an invalid advisory entry shape`,
          snapshot(stdout),
        );
      }
      // Every object `via` entry is a DIRECT advisory on this finding in the
      // supported producer (metavulns serialize as string references): its
      // `name` and `dependency` both equal the finding key. Anything else is a
      // package-identity contradiction.
      if (via.name !== name || via.dependency !== name) {
        throw new AuditExecutionError(
          `audit finding "${name}" has an advisory entry with contradictory package identity (advisory name ${JSON.stringify(via.name)}, dependency ${JSON.stringify(via.dependency)})`,
          snapshot(stdout),
        );
      }
      // Advisory identity URL: a parseable absolute http(s) URL whose final
      // path segment is the advisory id — not any string with a slash suffix.
      if (parseAdvisoryUrl(via.url) === null) {
        throw new AuditExecutionError(
          `audit finding "${name}" has an advisory entry with an unusable documentation URL ${JSON.stringify(String(via.url))}`,
          snapshot(stdout),
        );
      }
      const viaSeverityRank = SEVERITY_LEVELS.indexOf(via.severity);
      if (viaSeverityRank > maxExplicitSeverityRank) maxExplicitSeverityRank = viaSeverityRank;
    }
    // Producer severity coherence: a finding's severity is the maximum severity
    // of its contributing advisories, so it can never sit BELOW an explicit
    // advisory severity — that would silently erase a high advisory behind a
    // moderate finding.
    if (SEVERITY_LEVELS.indexOf(vulnerability.severity) < maxExplicitSeverityRank) {
      throw new AuditExecutionError(
        `audit finding "${name}" reports severity "${vulnerability.severity}" below its explicit advisory severity "${SEVERITY_LEVELS[maxExplicitSeverityRank]}"`,
        snapshot(stdout),
      );
    }
  }
  // Advisory/reference structure: a string via entry is npm's meta-vulnerability
  // reference to another finding in the same report. Every reference must
  // resolve, and every finding must reach usable advisory evidence — a dangling
  // reference or an evidence-free reference cycle is never silently accepted.
  for (const [name, vulnerability] of Object.entries(parsed.vulnerabilities)) {
    for (const via of vulnerability.via) {
      if (
        typeof via === 'string' &&
        !Object.prototype.hasOwnProperty.call(parsed.vulnerabilities, via)
      ) {
        throw new AuditExecutionError(
          `audit finding "${name}" has an unresolved via reference "${via}"`,
          snapshot(stdout),
        );
      }
    }
  }
  const evidenced = new Set(
    Object.entries(parsed.vulnerabilities)
      .filter(([, vulnerability]) => vulnerability.via.some((via) => typeof via !== 'string'))
      .map(([name]) => name),
  );
  for (let grew = true; grew;) {
    grew = false;
    for (const [name, vulnerability] of Object.entries(parsed.vulnerabilities)) {
      if (evidenced.has(name)) continue;
      if (vulnerability.via.some((via) => typeof via === 'string' && evidenced.has(via))) {
        evidenced.add(name);
        grew = true;
      }
    }
  }
  for (const name of Object.keys(parsed.vulnerabilities)) {
    if (!evidenced.has(name)) {
      throw new AuditExecutionError(
        `audit finding "${name}" has no usable advisory evidence: its via reference chain never reaches an advisory (reference cycle)`,
        snapshot(stdout),
      );
    }
  }
  // Severity/evidence coherence across meta references. The supported producer
  // gives a finding the MAXIMUM severity of its contributing advisories
  // (`Vuln.addAdvisory`); object `via` entries are direct advisories (checked
  // above) while string entries are metavuln references whose contributing
  // advisory set is a SUBSET of the referenced finding's own contributing
  // advisories. Two bounds therefore apply to every reference hop (third
  // review): the contribution is capped by the referenced finding's own
  // REPORTED severity (the maximum its contributing advisories can hand on —
  // a parent can sit below its child's aggregate, never above it) AND by the
  // advisory evidence that reference is anchored to (a least fixed point over
  // the graph starting only from direct advisories, so evidenced cycles
  // resolve but claimed severities alone can never self-support a rank).
  // Propagating the bare maximum of distant descendant advisories — the
  // previous behavior — let a high advisory behind a moderate intermediary
  // justify an impossible high meta-parent (false security green).
  const evidenceRank = new Map();
  for (const [name, vulnerability] of Object.entries(parsed.vulnerabilities)) {
    let rank = -1;
    for (const via of vulnerability.via) {
      if (typeof via !== 'string') rank = Math.max(rank, SEVERITY_LEVELS.indexOf(via.severity));
    }
    evidenceRank.set(name, rank);
  }
  for (let grew = true; grew;) {
    grew = false;
    for (const [name, vulnerability] of Object.entries(parsed.vulnerabilities)) {
      let rank = evidenceRank.get(name);
      for (const via of vulnerability.via) {
        if (typeof via !== 'string') continue;
        // Dangling references were rejected above, so the referenced finding
        // and its severity enum are present and known.
        const referenced = parsed.vulnerabilities[via];
        const contribution = Math.min(
          evidenceRank.get(via),
          SEVERITY_LEVELS.indexOf(referenced.severity),
        );
        rank = Math.max(rank, contribution);
      }
      if (rank !== evidenceRank.get(name)) {
        evidenceRank.set(name, rank);
        grew = true;
      }
    }
  }
  for (const [name, vulnerability] of Object.entries(parsed.vulnerabilities)) {
    if (SEVERITY_LEVELS.indexOf(vulnerability.severity) > evidenceRank.get(name)) {
      throw new AuditExecutionError(
        `audit finding "${name}" reports severity "${vulnerability.severity}" unsupported by its advisory evidence`,
        snapshot(stdout),
      );
    }
  }
  // Metadata coherence: npm counts every finding once under its severity and
  // reports the same population as `total`. Counts that contradict the findings
  // (e.g. `high: 1` with no findings) are an incoherent report, not a clean one.
  const computedCounts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const vulnerability of Object.values(parsed.vulnerabilities)) {
    computedCounts[vulnerability.severity] += 1;
  }
  const computedTotal = Object.keys(parsed.vulnerabilities).length;
  const countsCoherent =
    SEVERITY_LEVELS.every((level) => counts[level] === computedCounts[level]) &&
    counts.total === computedTotal &&
    counts.total === SEVERITY_LEVELS.reduce((sum, level) => sum + counts[level], 0);
  if (!countsCoherent) {
    throw new AuditExecutionError(
      'audit report metadata.vulnerabilities counts do not match the reported findings',
      snapshot(stdout),
    );
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

/**
 * Command transport, separated from report validation and policy decisions.
 *
 * The audit exit threshold is pinned explicitly (`--audit-level=info`, plus the
 * matching `npm_config_audit_level` override) so inherited npm configuration
 * (user/project `.npmrc`, exported `npm_config_audit_level`, global config)
 * cannot change the gate's status semantics. With the threshold pinned at
 * `info` — the lowest level npm knows — npm exits 1 iff it reports at least one
 * vulnerability entry, which is exactly the invariant
 * `validateAuditCommandResult()` enforces. Without this pin, a configured
 * `audit-level=critical` made npm exit 0 for a valid moderate-only report and
 * the gate rejected it as contradictory instead of applying its report-only
 * lower-severity policy (review P2).
 *
 * npm's `offline` config is normalized the same way (`--offline=false`, plus
 * the matching `npm_config_offline` override): the pinned producer
 * (`@npmcli/arborist` `AuditReport[_getReport]`) returns before the registry
 * request when effective `offline` is true and still serializes a clean-shaped
 * report with exit 0 — a skipped audit that report shape alone cannot
 * distinguish from a completed clean one (second review P1). Both pins follow
 * npm's verified config precedence (explicit CLI flag > inherited
 * `npm_config_*` env > project/user `.npmrc`), and any case-variant duplicate
 * of a pinned env key is removed first so the override is unambiguous on
 * case-insensitive environments. If the real request cannot run (including
 * offline hosts), npm fails and the transport/error path fails the gate
 * visibly instead.
 */
export const AUDIT_COMMAND_ARGS = [
  'audit',
  '--omit=dev',
  '--json',
  '--audit-level=info',
  '--offline=false',
];

const PINNED_NPM_CONFIG = { npm_config_audit_level: 'info', npm_config_offline: 'false' };

function pinnedAuditEnv(base = process.env) {
  const pinnedKeys = new Set(Object.keys(PINNED_NPM_CONFIG));
  const env = {};
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) continue;
    if (pinnedKeys.has(key.toLowerCase())) continue;
    env[key] = value;
  }
  return { ...env, ...PINNED_NPM_CONFIG };
}

export function runAuditCommand() {
  return spawnSync('npm', AUDIT_COMMAND_ARGS, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: pinnedAuditEnv(),
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
export function main({
  runCommand = runAuditCommand,
  out = console.log,
  err = console.error,
} = {}) {
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
