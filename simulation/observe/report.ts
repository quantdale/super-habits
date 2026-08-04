/**
 * Run-report schema + validator (`add-user-simulation-platform` task 4.1).
 *
 * Every execution lane emits a `run-report.json` describing a single run. The
 * schema is deliberately lane-agnostic so the scenario runner, a seeded run,
 * and a repro replay all produce reports the SAME validator accepts (design D6,
 * "one run report schema across all lanes"; task 4.4 verifies this).
 *
 * This module is PURE TypeScript — no fs, no Playwright, no browser. Artifact
 * *writing* lives in `observe/artifacts.ts`; this module only defines the
 * shape and the parse/validate functions, so it is unit-testable in isolation
 * (`tests/simulation.report.test.ts`).
 *
 * The report also carries an `actionLog`: a deterministic, duration-free list
 * of the semantic actions actually taken. Identical seeds + `deterministic`
 * mode must produce identical action logs (task 3.5) — the log is the
 * bit-for-bit fingerprint of a run at the action level.
 */

import type { Oracle, RunMode, SectionName, SemanticStepName } from '../model/types';

/** Current schema version. Bump on any breaking change to the JSON shape. */
export const RUN_REPORT_SCHEMA_VERSION = 1;

/** The execution lane that produced the report (design D10 / task 4.4). */
export type RunLane =
  /** Scenario library, deterministic mode (gating lane). */
  | 'scenario'
  /** Scenario library, seeded mode (nightly/local). */
  | 'seeded'
  /** Repro bundle replay (task 5). */
  | 'repro'
  /** AI exploratory lane (task 7). */
  | 'exploratory'
  /** Disposable-backend round trips (task 8). */
  | 'backend';

/** Outcome of a whole run. */
export type RunOutcome = 'passed' | 'failed' | 'errored' | 'skipped';

/** Per-step status. */
export type StepStatus = 'passed' | 'failed' | 'skipped';

/** Environment the run executed against. */
export interface RunEnvironment {
  /** Browser engine, e.g. `chromium`. */
  browser: string;
  /** Browser version string when known. */
  browserVersion?: string;
  /** Web for the PWA export; native lanes are a recorded capability gap. */
  platform: 'web' | 'ios' | 'android';
  /** Base URL the app was served from. */
  baseUrl: string;
  /** App version from package.json, when resolvable. */
  appVersion?: string;
  /** Git commit the build was exported from, when resolvable. */
  commit?: string;
}

/** Reference to the persona a run acted as (null for backend-only runs). */
export interface PersonaRef {
  id: string;
  name: string;
}

/** Reference to the scenario a run executed (null for repro/ad-hoc runs). */
export interface ScenarioRef {
  id: string;
  goal: string;
}

/** One oracle evaluated during a step. */
export interface EvaluatedOracle {
  kind: Oracle['kind'];
  /** For `rows` / `unchanged` oracles. */
  sql?: string;
  /** For `across-surfaces` oracles. */
  text?: string;
  /** For `across-surfaces` oracles. */
  tabs?: SectionName[];
  result: StepStatus;
  /** Human detail on failure (expected vs actual), empty on pass. */
  detail?: string;
}

/** A single executed semantic step. */
export interface RunStepEntry {
  /** 0-based position in the fully-expanded step graph. */
  index: number;
  kind: SemanticStepName;
  /** The step's `note`, if any. */
  note?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: StepStatus;
  /** Oracles evaluated for this step, in declaration order. */
  oracles?: EvaluatedOracle[];
  /** Relative artifact paths produced by this step. */
  artifacts?: { screenshots: string[] };
  /** Error message when the step failed. */
  error?: string;
}

/** First failure + state summary for the failure digest (task 4.3). */
export interface FailureSummary {
  /** Index of the first failed step in the expanded graph (-1 for setup/teardown). */
  stepIndex: number;
  /** Kind of the first failed step; `setup`/`teardown` cover pre-loop failures. */
  stepKind: SemanticStepName | 'setup' | 'teardown';
  /** The thrown error message. */
  error: string;
  /** Expected (oracle) text, when the failure was an oracle mismatch. */
  expected?: string;
  /** Actual (oracle) text, when the failure was an oracle mismatch. */
  actual?: string;
  /** Free-text state summary (e.g. row counts at failure). */
  stateSummary?: string;
  /** Relative path to the failure digest, when written (task 4.3). */
  digestPath?: string;
}

/** Aggregate artifact pointers for the whole run. */
export interface RunArtifacts {
  /** Absolute or repo-relative path to this run's output directory. */
  root: string;
  /** Relative path to `run-report.json` itself. */
  report: string;
  /** Relative paths to per-step screenshots. */
  screenshots: string[];
  /** Relative path to a retained video, on failure only. */
  video?: string;
  /** Relative path to a retained Playwright trace, on failure only. */
  trace?: string;
  /** Relative path to a captured console log, on failure only. */
  consoleLog?: string;
  /** Relative path to the failure digest, on failure only. */
  digest?: string;
}

/** The full run report. */
export interface RunReport {
  schemaVersion: typeof RUN_REPORT_SCHEMA_VERSION;
  /** Stable identifier for the run, e.g. `run_<ts>_<8 chars>`. */
  runId: string;
  lane: RunLane;
  mode: RunMode;
  /** Seed used for the run. `null` for exploratory (no seed guarantee). */
  seed: string | null;
  environment: RunEnvironment;
  persona: PersonaRef | null;
  scenario: ScenarioRef | null;
  startedAt: string;
  finishedAt: string;
  outcome: RunOutcome;
  /** Total wall-clock ms of the run (from start to finish). */
  durationMs: number;
  /** Deterministic action-level fingerprint (see module doc). */
  actionLog: string[];
  steps: RunStepEntry[];
  artifacts: RunArtifacts;
  failure?: FailureSummary;
}

/** A validation finding, mirroring the model validator's shape. */
export interface ReportValidationIssue {
  path: string;
  message: string;
}

/* ------------------------------------------------------------------ */
/* Validation (pure)                                                   */
/* ------------------------------------------------------------------ */

function push(issues: ReportValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  return !Number.isNaN(Date.parse(v));
}

const RUN_MODES: readonly RunMode[] = ['deterministic', 'seeded', 'exploratory'];
const LANES: readonly RunLane[] = ['scenario', 'seeded', 'repro', 'exploratory', 'backend'];
const OUTCOMES: readonly RunOutcome[] = ['passed', 'failed', 'errored', 'skipped'];
const STEP_STATUSES: readonly StepStatus[] = ['passed', 'failed', 'skipped'];
const ORACLE_KINDS: readonly string[] = ['rows', 'across-surfaces', 'outbox', 'unchanged'];
const SECTIONS: readonly SectionName[] = [
  'overview',
  'todos',
  'habits',
  'pomodoro',
  'workout',
  'calories',
];

function validateOracle(issues: ReportValidationIssue[], path: string, o: unknown): void {
  if (!isRecord(o)) {
    push(issues, path, 'must be an object');
    return;
  }
  if (!ORACLE_KINDS.includes(String(o.kind))) {
    push(issues, `${path}.kind`, `unknown oracle kind: ${String(o.kind)}`);
  }
  if (!STEP_STATUSES.includes(String(o.result) as StepStatus)) {
    push(issues, `${path}.result`, `unknown oracle result: ${String(o.result)}`);
  }
  if (o.sql !== undefined && typeof o.sql !== 'string') {
    push(issues, `${path}.sql`, 'must be a string');
  }
  if (o.tabs !== undefined) {
    if (!Array.isArray(o.tabs)) {
      push(issues, `${path}.tabs`, 'must be an array');
    } else {
      for (const t of o.tabs) {
        if (!SECTIONS.includes(t as SectionName)) {
          push(issues, `${path}.tabs`, `unknown section: ${String(t)}`);
        }
      }
    }
  }
}

function validateStep(issues: ReportValidationIssue[], path: string, s: unknown): void {
  if (!isRecord(s)) {
    push(issues, path, 'must be an object');
    return;
  }
  if (typeof s.index !== 'number' || !Number.isInteger(s.index) || s.index < 0) {
    push(issues, `${path}.index`, 'must be a non-negative integer');
  }
  if (typeof s.kind !== 'string' || s.kind.trim() === '') {
    push(issues, `${path}.kind`, 'must be a non-empty string');
  }
  if (!isIsoDate(s.startedAt)) {
    push(issues, `${path}.startedAt`, 'must be an ISO date string');
  }
  if (!isIsoDate(s.finishedAt)) {
    push(issues, `${path}.finishedAt`, 'must be an ISO date string');
  }
  if (typeof s.durationMs !== 'number' || s.durationMs < 0) {
    push(issues, `${path}.durationMs`, 'must be a number >= 0');
  }
  if (!STEP_STATUSES.includes(String(s.status) as StepStatus)) {
    push(issues, `${path}.status`, `unknown status: ${String(s.status)}`);
  }
  if (s.oracles !== undefined) {
    if (!Array.isArray(s.oracles)) {
      push(issues, `${path}.oracles`, 'must be an array');
    } else {
      s.oracles.forEach((o, i) => validateOracle(issues, `${path}.oracles[${i}]`, o));
    }
  }
}

/** Validate a full run report. Returns `[]` when valid. */
export function validateRunReport(report: unknown): ReportValidationIssue[] {
  const issues: ReportValidationIssue[] = [];
  if (!isRecord(report)) {
    push(issues, 'report', 'must be an object');
    return issues;
  }
  if (report.schemaVersion !== RUN_REPORT_SCHEMA_VERSION) {
    push(issues, 'schemaVersion', `must be ${RUN_REPORT_SCHEMA_VERSION}`);
  }
  if (!isNonEmptyString(report.runId)) {
    push(issues, 'runId', 'must be a non-empty string');
  }
  if (!LANES.includes(String(report.lane) as RunLane)) {
    push(issues, 'lane', `unknown lane: ${String(report.lane)}`);
  }
  if (!RUN_MODES.includes(String(report.mode) as RunMode)) {
    push(issues, 'mode', `unknown mode: ${String(report.mode)}`);
  }
  if (report.seed !== null && typeof report.seed !== 'string') {
    push(issues, 'seed', 'must be a string or null');
  }
  if (!isRecord(report.environment)) {
    push(issues, 'environment', 'must be an object');
  } else {
    if (!isNonEmptyString(report.environment.browser)) {
      push(issues, 'environment.browser', 'must be a non-empty string');
    }
    if (!['web', 'ios', 'android'].includes(String(report.environment.platform))) {
      push(issues, 'environment.platform', 'must be web | ios | android');
    }
    if (!isNonEmptyString(report.environment.baseUrl)) {
      push(issues, 'environment.baseUrl', 'must be a non-empty string');
    }
  }
  if (report.persona !== null && !isRecord(report.persona)) {
    push(issues, 'persona', 'must be an object or null');
  }
  if (report.scenario !== null && !isRecord(report.scenario)) {
    push(issues, 'scenario', 'must be an object or null');
  }
  if (!isIsoDate(report.startedAt)) {
    push(issues, 'startedAt', 'must be an ISO date string');
  }
  if (!isIsoDate(report.finishedAt)) {
    push(issues, 'finishedAt', 'must be an ISO date string');
  }
  if (!OUTCOMES.includes(String(report.outcome) as RunOutcome)) {
    push(issues, 'outcome', `unknown outcome: ${String(report.outcome)}`);
  }
  if (typeof report.durationMs !== 'number' || report.durationMs < 0) {
    push(issues, 'durationMs', 'must be a number >= 0');
  }
  if (!Array.isArray(report.actionLog)) {
    push(issues, 'actionLog', 'must be an array');
  } else {
    for (const [i, entry] of report.actionLog.entries()) {
      if (typeof entry !== 'string') {
        push(issues, `actionLog[${i}]`, 'must be a string');
      }
    }
  }
  if (!Array.isArray(report.steps)) {
    push(issues, 'steps', 'must be an array');
  } else {
    report.steps.forEach((s, i) => validateStep(issues, `steps[${i}]`, s));
  }
  if (!isRecord(report.artifacts)) {
    push(issues, 'artifacts', 'must be an object');
  } else {
    if (typeof report.artifacts.root !== 'string') {
      push(issues, 'artifacts.root', 'must be a string');
    }
    if (typeof report.artifacts.report !== 'string') {
      push(issues, 'artifacts.report', 'must be a string');
    }
    if (
      report.artifacts.screenshots !== undefined &&
      !Array.isArray(report.artifacts.screenshots)
    ) {
      push(issues, 'artifacts.screenshots', 'must be an array');
    }
  }
  if (report.failure !== undefined && !isRecord(report.failure)) {
    push(issues, 'failure', 'must be an object');
  }
  // A failed run must carry a failure summary.
  if (report.outcome === 'failed' && report.failure === undefined) {
    push(issues, 'failure', 'failed run must carry a failure summary');
  }
  return issues;
}

/** Convenience: true when the report has no validation issues. */
export function isRunReportValid(report: unknown): boolean {
  return validateRunReport(report).length === 0;
}

/**
 * Parse a JSON string into a `RunReport`. Throws on malformed JSON or a report
 * that fails validation. Pass `{ validate: false }` to skip validation (e.g. to
 * report on a corrupted file).
 */
export function parseRunReport(json: string, opts: { validate?: boolean } = {}): RunReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`run-report is not valid JSON: ${(err as Error).message}`);
  }
  if (opts.validate !== false) {
    const issues = validateRunReport(parsed);
    if (issues.length > 0) {
      const detail = issues.map((i) => `${i.path}: ${i.message}`).join('; ');
      throw new Error(`run-report failed validation: ${detail}`);
    }
  }
  return parsed as RunReport;
}

/** Serialize a report to pretty JSON. */
export function serializeRunReport(report: RunReport): string {
  return JSON.stringify(report, null, 2);
}

/* ------------------------------------------------------------------ */
/* Builder helpers (used by the runner / repro / CLI)                  */
/* ------------------------------------------------------------------ */

/** Create a fresh report with zero steps. `lane`/`mode`/`seed` set up front. */
export function createRunReport(input: {
  runId: string;
  lane: RunLane;
  mode: RunMode;
  seed: string | null;
  environment: RunEnvironment;
  persona: PersonaRef | null;
  scenario: ScenarioRef | null;
  artifacts: RunArtifacts;
}): RunReport {
  return {
    schemaVersion: RUN_REPORT_SCHEMA_VERSION,
    runId: input.runId,
    lane: input.lane,
    mode: input.mode,
    seed: input.seed,
    environment: input.environment,
    persona: input.persona,
    scenario: input.scenario,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    outcome: 'skipped',
    durationMs: 0,
    actionLog: [],
    steps: [],
    artifacts: input.artifacts,
  };
}

/** Finalize a report after execution: set outcome/duration/failure. */
export function finalizeRunReport(
  report: RunReport,
  input: {
    outcome: RunOutcome;
    failure?: FailureSummary;
    startedAt: string;
  },
): RunReport {
  report.outcome = input.outcome;
  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.parse(report.finishedAt) - Date.parse(input.startedAt);
  if (input.failure) {
    report.failure = input.failure;
  }
  return report;
}
