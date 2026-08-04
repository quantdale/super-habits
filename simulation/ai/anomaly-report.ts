/**
 * AI exploratory lane — anomaly report schema + validator
 * (`add-user-simulation-platform` task 7.1).
 *
 * Every anomaly an AI mission finds is recorded as a machine-readable
 * `anomaly-report.json` per the schema in this file, then triaged per the rule
 * in the RUNBOOK: the anomaly becomes a filed defect change, a new
 * deterministic scenario in the library, or a documented non-issue — never a
 * note that evaporates (design D7).
 *
 * Shape and style follow the run-report schema of task 4.1
 * (`simulation/observe/report.ts`, built concurrently): a single JSON artifact
 * for a single run, machine-parseable, validated by a pure function with zero
 * runtime dependencies (JSON is the interchange format for artifacts only —
 * design D2). Validation issues use the same `{ path, message }` shape as
 * `simulation/model/validate.ts` so tooling treats every simulated-artifact
 * validator identically.
 *
 * Required by design (D7): "attempted, expected vs. observed, trace, persisted
 * state, environment, severity guess" — an anomaly report must carry repro
 * evidence (trace + persisted state) to be actionable, so both are enforced by
 * the validator, not just documented.
 */

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

/** Bumped only on breaking schema changes; consumers must reject others. */
export const ANOMALY_REPORT_SCHEMA_VERSION = 1 as const;

/** Severity guess by the exploring agent. `info` = notable, not a defect. */
export const ANOMALY_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type AnomalySeverity = (typeof ANOMALY_SEVERITIES)[number];

/**
 * The rubric categories a mission's anomaly rubric advertises (design D7):
 * workflow breaks, unexpected states, usability friction, console errors, and
 * data inconsistencies across surfaces. `other` covers anything else the agent
 * judges reportable.
 */
export const ANOMALY_TYPES = [
  'workflow-break',
  'unexpected-state',
  'usability-friction',
  'console-error',
  'data-inconsistency',
  'other',
] as const;
export type AnomalyType = (typeof ANOMALY_TYPES)[number];

/**
 * Triage rule outcomes (inherits the parent's findings convention, D7). Every
 * anomaly ends in exactly one of these; `reference` names the change id,
 * scenario id, or gap-register entry.
 */
export const ANOMALY_TRIAGE_OUTCOMES = [
  'defect-change',
  'deterministic-scenario',
  'documented-non-issue',
] as const;
export type AnomalyTriageOutcome = (typeof ANOMALY_TRIAGE_OUTCOMES)[number];

/* ------------------------------------------------------------------ */
/* Schema                                                               */
/* ------------------------------------------------------------------ */

/** Environment the anomaly was observed in (exploratory lane, design D4). */
export interface AnomalyReportEnvironment {
  /** Build the mission ran against, e.g. `dist/` (relative to repo root). */
  buildDir: string;
  /** Browser the agent drove, e.g. `chromium 131.0.6778.204`. */
  browser: string;
  /** ISO 8601 start of the mission run. */
  startedAt: string;
  /** App version from `app.json` / `package.json` at build time, if known. */
  appVersion?: string;
  /** Commit SHA the build was exported from, if known. */
  commit?: string;
  /** Local timezone of the driven browser (day-scoped surfaces care). */
  timezone?: string;
  /**
   * Exploratory lane: normally absent or `null` — there is no seed guarantee.
   * Records a value only if the run happened to be clock- or rng-seeded.
   */
  seed?: string | null;
  /** Anything else worth recording (harness overrides, flags, ports). */
  notes?: string;
}

/** One thing the agent attempted, at semantic (not selector) level. */
export interface AnomalyAttempt {
  /** What the agent did, e.g. `Deleted the first todo, then cancelled`. */
  action: string;
  /** What the agent expected to happen for this attempt, if any. */
  expected?: string;
  /** What the agent actually observed for this attempt, if any. */
  observed?: string;
  /** Console errors/warnings seen during this attempt, verbatim. */
  consoleErrors?: string[];
  /** ISO 8601 timestamp of the attempt. */
  at?: string;
}

/** Repro-evidence artifact pointers, relative to the run's output directory. */
export interface AnomalyTraceEvidence {
  /** Path to a browser trace (e.g. `trace.zip`), if captured. */
  tracePath?: string;
  /** Path to a video recording, if captured. */
  videoPath?: string;
  /** Paths to per-step screenshots, if captured (relative to output dir). */
  screenshots?: string[];
  /** Path to the console log (`console.log`), if captured. */
  consoleLogPath?: string;
  /** Path to the network log (`network.har`), if captured. */
  networkHarPath?: string;
  /** Path to the mission narrative (`narrative.md`), if separate. */
  narrativePath?: string;
}

/** The app's persisted state at the time of the anomaly. */
export interface AnomalyPersistedState {
  /** Path to an exported SQLite snapshot (OPFS export), if captured. */
  dbPath?: string;
  /** Path to the AsyncStorage dump, if captured. */
  storagePath?: string;
  /** Sync outbox snapshot (rows pending push), if inspected. */
  outbox?: unknown[];
  /** Human summary: what rows existed / changed / were deleted. */
  summary?: string;
}

/** Triage decision, filled in by a maintainer after the mission run. */
export interface AnomalyTriage {
  /** One of the three triage outcomes; never left open forever. */
  outcome: AnomalyTriageOutcome;
  /**
   * Where the anomaly landed: change id (e.g. `fix-day-rollover-refresh`),
   * scenario id (e.g. `week-of-habit-tracking`), or gap-register entry
   * (e.g. `CG-1` / capability-gap #4).
   */
  reference: string;
  /** ISO 8601 timestamp of the triage decision. */
  decidedAt: string;
  /** Brief note on why this outcome was chosen. */
  note?: string;
}

/**
 * The `anomaly-report.json` schema. Required fields reflect design D7's core:
 * attempted / expected vs. observed / trace / persisted state / environment /
 * severity guess. `triage` starts empty and is completed per the triage rule.
 */
export interface AnomalyReport {
  /** Must equal `ANOMALY_REPORT_SCHEMA_VERSION`. */
  schemaVersion: typeof ANOMALY_REPORT_SCHEMA_VERSION;
  /** Stable unique id, e.g. `anomaly_2026-08-04_1719_erroneous-count`. */
  reportId: string;
  /** Mission id, e.g. `error-prone-user-todos-calories` (matches missions/*.md). */
  missionId: string;
  /** Persona ref as the mission names it, e.g. `P4` or `error-prone-user`. */
  personaId?: string;
  /** One-line title: what is wrong. */
  title: string;
  /** Rubric category (see `AnomalyType`). */
  anomalyType: AnomalyType;
  /** Step-level log of what the agent tried prior to the anomaly. */
  attempted: AnomalyAttempt[];
  /** The expectation that was violated, stated plainly. */
  expected: string;
  /** What actually happened, stated plainly. */
  observed: string;
  /** Agent's severity guess; triage may revise after reproduction. */
  severityGuess: AnomalySeverity;
  /** Where and on what build this was observed. */
  environment: AnomalyReportEnvironment;
  /** Persisted state at the time of the anomaly (repro evidence). */
  persistedState: AnomalyPersistedState;
  /** Artifact pointers backing the finding (repro evidence). */
  trace: AnomalyTraceEvidence;
  /** Free-form agent narrative attached to the report, if any. */
  narrative?: string;
  /** Completed per the triage rule; absent means "not yet triaged". */
  triage?: AnomalyTriage;
}

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

/** One validation finding, same shape as `simulation/model/validate.ts`. */
export interface AnomalyReportIssue {
  /** Dot-path into the report, e.g. `environment.buildDir`. */
  path: string;
  /** Human-readable description of the violation. */
  message: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/** Lightweight ISO-8601 check; rejects garbage without validating calendars. */
function isIsoDate(v: unknown): boolean {
  if (typeof v !== 'string' || v.trim() === '') return false;
  return !Number.isNaN(Date.parse(v));
}

function push(issues: AnomalyReportIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

function pushIfNonEmptyString(
  issues: AnomalyReportIssue[],
  path: string,
  label: string,
  value: unknown,
): void {
  if (!isNonEmptyString(value)) push(issues, path, `${label} must be a non-empty string`);
}

function validateOptionalString(
  issues: AnomalyReportIssue[],
  path: string,
  label: string,
  value: unknown,
): void {
  if (value === undefined) return;
  if (typeof value !== 'string') push(issues, path, `${label} must be a string when present`);
}

function validateEnvironment(issues: AnomalyReportIssue[], env: UnknownRecord): void {
  pushIfNonEmptyString(issues, 'environment.buildDir', 'environment.buildDir', env.buildDir);
  pushIfNonEmptyString(issues, 'environment.browser', 'environment.browser', env.browser);
  if (!isIsoDate(env.startedAt)) {
    push(
      issues,
      'environment.startedAt',
      'environment.startedAt must be a valid ISO 8601 timestamp',
    );
  }
  validateOptionalString(
    issues,
    'environment.appVersion',
    'environment.appVersion',
    env.appVersion,
  );
  validateOptionalString(issues, 'environment.commit', 'environment.commit', env.commit);
  validateOptionalString(issues, 'environment.timezone', 'environment.timezone', env.timezone);
  validateOptionalString(issues, 'environment.notes', 'environment.notes', env.notes);
  if (env.seed !== undefined && env.seed !== null && typeof env.seed !== 'string') {
    push(issues, 'environment.seed', 'environment.seed must be a string or null when present');
  }
}

function validateAttempted(issues: AnomalyReportIssue[], attempted: unknown): void {
  if (!Array.isArray(attempted) || attempted.length === 0) {
    push(issues, 'attempted', 'attempted must be a non-empty array of attempt entries');
    return;
  }
  attempted.forEach((entry, i) => {
    const path = `attempted[${i}]`;
    if (!isRecord(entry)) {
      push(issues, path, 'attempt entry must be an object');
      return;
    }
    pushIfNonEmptyString(issues, `${path}.action`, `attempted[${i}].action`, entry.action);
    validateOptionalString(issues, `${path}.expected`, 'expected', entry.expected);
    validateOptionalString(issues, `${path}.observed`, 'observed', entry.observed);
    validateOptionalString(issues, `${path}.at`, 'at', entry.at);
    if (entry.at !== undefined && !isIsoDate(entry.at)) {
      push(issues, `${path}.at`, `attempted[${i}].at must be a valid ISO 8601 timestamp`);
    }
    if (entry.consoleErrors !== undefined) {
      if (!Array.isArray(entry.consoleErrors)) {
        push(issues, `${path}.consoleErrors`, 'consoleErrors must be an array when present');
      } else {
        entry.consoleErrors.forEach((e, j) => {
          if (typeof e !== 'string' || e.trim() === '') {
            push(
              issues,
              `${path}.consoleErrors[${j}]`,
              'console error entries must be non-empty strings',
            );
          }
        });
      }
    }
  });
}

function validateTrace(issues: AnomalyReportIssue[], trace: UnknownRecord): void {
  const paths: [string, unknown][] = [
    ['tracePath', trace.tracePath],
    ['videoPath', trace.videoPath],
    ['consoleLogPath', trace.consoleLogPath],
    ['networkHarPath', trace.networkHarPath],
    ['narrativePath', trace.narrativePath],
  ];
  for (const [key, value] of paths) {
    if (value !== undefined && !isNonEmptyString(value)) {
      push(issues, `trace.${key}`, `trace.${key} must be a non-empty string when present`);
    }
  }
  if (trace.screenshots !== undefined) {
    if (!Array.isArray(trace.screenshots)) {
      push(issues, 'trace.screenshots', 'trace.screenshots must be an array when present');
    } else {
      trace.screenshots.forEach((s, i) => {
        if (typeof s !== 'string' || s.trim() === '') {
          push(issues, `trace.screenshots[${i}]`, 'screenshot paths must be non-empty strings');
        }
      });
    }
  }
  // Repro evidence (design D7): an anomaly without an artifact pointer is not
  // actionable. At least one trace artifact must be present.
  const hasArtifact =
    paths.some(([, value]) => isNonEmptyString(value)) ||
    (Array.isArray(trace.screenshots) && trace.screenshots.length > 0);
  if (!hasArtifact) {
    push(
      issues,
      'trace',
      'trace must carry at least one repro-evidence artifact (trace/video/console/HAR/narrative path or a screenshot)',
    );
  }
}

function validatePersistedState(issues: AnomalyReportIssue[], state: UnknownRecord): void {
  validateOptionalString(issues, 'persistedState.dbPath', 'persistedState.dbPath', state.dbPath);
  validateOptionalString(
    issues,
    'persistedState.storagePath',
    'persistedState.storagePath',
    state.storagePath,
  );
  if (state.outbox !== undefined && !Array.isArray(state.outbox)) {
    push(issues, 'persistedState.outbox', 'persistedState.outbox must be an array when present');
  }
  if (state.summary !== undefined && !isNonEmptyString(state.summary)) {
    push(
      issues,
      'persistedState.summary',
      'persistedState.summary must be a non-empty string when present',
    );
  }
  const hasState =
    isNonEmptyString(state.dbPath) ||
    isNonEmptyString(state.storagePath) ||
    isNonEmptyString(state.summary);
  if (!hasState) {
    push(
      issues,
      'persistedState',
      'persistedState must carry at least one of dbPath, storagePath, or a summary (repro evidence)',
    );
  }
}

function validateTriage(issues: AnomalyReportIssue[], triage: UnknownRecord): void {
  if (!ANOMALY_TRIAGE_OUTCOMES.includes(triage.outcome as AnomalyTriageOutcome)) {
    push(
      issues,
      'triage.outcome',
      `unknown triage outcome: ${String(triage.outcome)}; known: ${ANOMALY_TRIAGE_OUTCOMES.join(', ')}`,
    );
  }
  pushIfNonEmptyString(issues, 'triage.reference', 'triage.reference', triage.reference);
  if (!isIsoDate(triage.decidedAt)) {
    push(issues, 'triage.decidedAt', 'triage.decidedAt must be a valid ISO 8601 timestamp');
  }
  validateOptionalString(issues, 'triage.note', 'triage.note', triage.note);
}

/**
 * Validate an `anomaly-report.json` payload (already parsed from JSON, so the
 * input is `unknown`). Pure function: returns `[]` when valid, otherwise a
 * list of `AnomalyReportIssue`s. No I/O, no side effects.
 */
export function validateAnomalyReport(input: unknown): AnomalyReportIssue[] {
  const issues: AnomalyReportIssue[] = [];

  if (!isRecord(input)) {
    push(issues, 'report', 'anomaly report must be a JSON object');
    return issues;
  }

  if (input.schemaVersion !== ANOMALY_REPORT_SCHEMA_VERSION) {
    push(
      issues,
      'schemaVersion',
      `unsupported schema version: ${String(input.schemaVersion)}; expected ${ANOMALY_REPORT_SCHEMA_VERSION}`,
    );
  }
  pushIfNonEmptyString(issues, 'reportId', 'reportId', input.reportId);
  pushIfNonEmptyString(issues, 'missionId', 'missionId', input.missionId);
  validateOptionalString(issues, 'personaId', 'personaId', input.personaId);
  pushIfNonEmptyString(issues, 'title', 'title', input.title);

  if (!ANOMALY_TYPES.includes(input.anomalyType as AnomalyType)) {
    push(
      issues,
      'anomalyType',
      `unknown anomaly type: ${String(input.anomalyType)}; known: ${ANOMALY_TYPES.join(', ')}`,
    );
  }
  if (!ANOMALY_SEVERITIES.includes(input.severityGuess as AnomalySeverity)) {
    push(
      issues,
      'severityGuess',
      `unknown severity guess: ${String(input.severityGuess)}; known: ${ANOMALY_SEVERITIES.join(', ')}`,
    );
  }

  pushIfNonEmptyString(issues, 'expected', 'expected', input.expected);
  pushIfNonEmptyString(issues, 'observed', 'observed', input.observed);
  validateOptionalString(issues, 'narrative', 'narrative', input.narrative);

  validateAttempted(issues, input.attempted);

  if (!isRecord(input.environment)) {
    push(issues, 'environment', 'environment must be an object');
  } else {
    validateEnvironment(issues, input.environment);
  }

  if (!isRecord(input.persistedState)) {
    push(issues, 'persistedState', 'persistedState must be an object');
  } else {
    validatePersistedState(issues, input.persistedState);
  }

  if (!isRecord(input.trace)) {
    push(issues, 'trace', 'trace must be an object');
  } else {
    validateTrace(issues, input.trace);
  }

  if (input.triage !== undefined) {
    if (!isRecord(input.triage)) {
      push(issues, 'triage', 'triage must be an object when present');
    } else {
      validateTriage(issues, input.triage);
    }
  }

  return issues;
}

/** Convenience: true when the input is a structurally valid anomaly report. */
export function isAnomalyReportValid(input: unknown): boolean {
  return validateAnomalyReport(input).length === 0;
}

/**
 * Parse a raw parsed-JSON payload into a typed `AnomalyReport`. The report is
 * a plain JSON artifact (design D2), so narrowing happens here after
 * validation; the cast is safe because `validateAnomalyReport` already
 * enforced the shape.
 */
export type ParseAnomalyReportResult =
  { ok: true; report: AnomalyReport } | { ok: false; issues: AnomalyReportIssue[] };

export function parseAnomalyReport(input: unknown): ParseAnomalyReportResult {
  const issues = validateAnomalyReport(input);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, report: input as AnomalyReport };
}
