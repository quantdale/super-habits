/**
 * Scenario executor (`add-user-simulation-platform` task 3.1).
 *
 * Executes a scenario's step graph through Playwright against the served
 * `dist/` export, reusing the parent harness helpers for reset/seed/clock/
 * failure/oracles. `workers: 1` semantics: ONE browser context per origin —
 * the caller passes a browser, the runner creates a single context + page and
 * reuses them for the entire run (OPFS single-writer lock).
 *
 * Step resolution (task 3.1): every `SemanticStep` kind maps to a parent-help
 * helper or a runner-owned interaction (see `actions.ts`); the full mapping is
 * documented at the bottom of this file and mirrors `simulation/model/steps.ts`
 * `parentHelper` declarations.
 *
 * The runner also owns the OBSERVABILITY contract: per-step durations,
 * evaluated oracles, screenshots, and the run report (task 4). It builds the
 * report incrementally, writes `run-report.json` (4.1) + a failure digest
 * (4.3), retains video/trace/console only on failure, and leaves a passing
 * run's directory with report + screenshots only (4.2).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { resetAll } from '../../e2e/helpers/reset';
import { seedFixture } from '../../e2e/helpers/seed';
import { expectOutbox, expectRows, expectUnchanged } from '../../e2e/helpers/oracles';
import { queryRows, returnToApp, APP_BASE_URL } from '../../e2e/helpers/dbHarness';
import { clearInjectedFailures, setOffline } from '../../e2e/helpers/failure';
import type { Oracle, RunMode, Scenario, SemanticStep, SimulationModel } from '../model/types';
import { validateSimulationModel } from '../model/validate';
import { defaultBehaviorParams } from '../model/builders';
import { buildRunPlan } from '../behavior/engine';
import type { StepLogEntry } from '../behavior/injectors';
import { buildFailureDigest } from '../observe/digest';
import {
  buildRunArtifacts,
  captureStepScreenshot,
  deleteRecordedTrace,
  deleteRecordedVideo,
  ensureRunOutputDir,
  findRecordedVideo,
  relativeToRoot,
  tracePath,
  writeConsoleLog,
  writeDigestMd,
  writeRunReportJson,
} from '../observe/artifacts';
import {
  createRunReport,
  finalizeRunReport,
  serializeRunReport,
  validateRunReport,
  type EvaluatedOracle,
  type RunLane,
  type RunReport,
  type RunStepEntry,
} from '../observe/report';
import {
  actionAbandonForm,
  actionAskQuestion,
  actionAdvanceClockToNextDay,
  actionBuildRoutine,
  actionCommandConfirm,
  actionCommandPreview,
  actionCreateHabit,
  actionCreateTodo,
  actionExpectAcrossSurfaces,
  actionGoOffline,
  actionGoOnline,
  actionSetCalorieGoal,
  actionInjectFailure,
  actionLogCalories,
  actionMaybeMakeMistake,
  actionOpenCommand,
  actionOpenSettings,
  actionReloadApp,
  actionStartPomodoro,
  actionSwitchSection,
  actionTickHabit,
  actionToggleTodo,
  actionWaitThinkTime,
  runnerExpectAcrossSurfaces,
} from './actions';
import { execApiLeg } from './apiLeg';

/* ------------------------------------------------------------------ */
/* Options / results                                                   */
/* ------------------------------------------------------------------ */

/**
 * A captured network event (task 5.x repro bundles). Recorded only when an
 * `onFailure` hook is registered, so green/ordinary runs pay no overhead.
 */
export interface NetworkEvent {
  url: string;
  /** HTTP status, or 0 when the request failed at the network layer. */
  status: number;
  failed: boolean;
  error?: string;
}

export interface ExecuteScenarioOptions {
  scenario: Scenario;
  model: SimulationModel;
  /** Override the scenario's mode (defaults to `scenario.mode ?? 'deterministic'`). */
  mode?: RunMode;
  /** Explicit seed. Deterministic uses `'deterministic'` unless given; seeded picks one unless given. */
  seed?: string;
  /** Reuse an existing Browser (self-test spec). The runner opens its own otherwise. */
  browser?: Browser;
  /** Base URL of the served export (default `http://localhost:8081`). */
  baseUrl?: string;
  /** Lane recorded in the report (default: `'seeded'` when mode is seeded, else `'scenario'`). */
  lane?: RunLane;
  /** Progress callback: called after each step completes. */
  onStep?: (info: { index: number; kind: string; status: string }) => void;
  /**
   * Failure hook (task 5.2, repro bundles). Called AFTER a scenario failure is
   * recorded but BEFORE context teardown, with the page/context still alive so a
   * bundle capture can dump the DB + storage (see `simulation/repro/bundle.ts`).
   * The `report` here is the run report finalized at the failure point (outcome
   * `'failed'` + failure summary — the on-disk report is finalized after
   * teardown) and `steps` contains the EXECUTED steps only (0..failure index).
   * Only registered when the caller needs it — the hook otherwise adds a tiny
   * network-listener overhead per run.
   */
  onFailure?: (ctx: {
    page: Page;
    context: BrowserContext;
    report: RunReport;
    runId: string;
    baseUrl: string;
    consoleLines: string[];
    networkEvents: NetworkEvent[];
    /** The fully-expanded, param-bound steps (== the run's action log payload). */
    steps: SemanticStep[];
  }) => void | Promise<void>;
}

export interface ExecuteScenarioResult {
  runId: string;
  report: RunReport;
  /** Repo-root-relative path to `run-report.json`. */
  reportPath: string;
  /** Repo-root-relative path to the failure digest, if the run failed. */
  digestPath?: string;
  /** The deterministic action fingerprint (report.actionLog). */
  actionLog: string[];
  mode: RunMode;
  seed: string | null;
}

/* ------------------------------------------------------------------ */
/* Workflow expansion                                                  */
/* ------------------------------------------------------------------ */

/** Substitute `{{param}}` placeholders in a step's string fields. */
function bindParams<T extends SemanticStep>(step: T, params: Record<string, unknown>): T {
  if (Object.keys(params).length === 0) return step;
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') {
      let out = value;
      for (const [key, val] of Object.entries(params)) {
        out = out.split(`{{${key}}}`).join(String(val));
      }
      return out;
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value !== null && typeof value === 'object') {
      const next: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) next[k] = walk(v);
      return next;
    }
    return value;
  };
  return walk(step) as T;
}

/** Expand workflows (in order) + inline steps into a flat ordered graph. */
export function expandScenarioSteps(model: SimulationModel, scenario: Scenario): SemanticStep[] {
  const out: SemanticStep[] = [];
  for (const ref of scenario.workflows ?? []) {
    const workflow = model.workflows?.find((w) => w.id === ref.workflowId);
    if (!workflow) {
      throw new Error(`scenario '${scenario.id}' references missing workflow '${ref.workflowId}'`);
    }
    for (const step of workflow.steps) {
      out.push(bindParams(step, ref.params ?? {}));
    }
  }
  out.push(...scenario.steps);
  return out;
}

/* ------------------------------------------------------------------ */
/* Oracle evaluation                                                   */
/* ------------------------------------------------------------------ */

async function evaluateRowsOracle(
  page: Page,
  oracle: Extract<Oracle, { kind: 'rows' }>,
): Promise<EvaluatedOracle> {
  try {
    const expected = oracle.expected as Record<string, unknown>[] | undefined;
    if (expected === undefined) {
      const rows = await queryRows(page, oracle.sql);
      return { kind: 'rows', sql: oracle.sql, result: 'passed', detail: `${rows.length} rows` };
    }
    await expectRows(page, oracle.sql, expected);
    return { kind: 'rows', sql: oracle.sql, result: 'passed', detail: `${expected.length} rows` };
  } catch (err) {
    return {
      kind: 'rows',
      sql: oracle.sql,
      result: 'failed',
      detail: (err as Error).message,
    };
  }
}

async function evaluateOutboxOracle(page: Page): Promise<EvaluatedOracle> {
  try {
    const outbox = await queryRows(
      page,
      `SELECT entity, id, updated_at AS updatedAt, operation
       FROM sync_outbox
       ORDER BY revision ASC`,
    );
    return { kind: 'outbox', result: 'passed', detail: `${outbox.length} record(s)` };
  } catch (err) {
    return { kind: 'outbox', result: 'failed', detail: (err as Error).message };
  }
}

/** Evaluate the oracles directly attached to a step (rows / across-surfaces / outbox). */
async function evaluateStepOracles(page: Page, step: SemanticStep): Promise<EvaluatedOracle[]> {
  const results: EvaluatedOracle[] = [];
  for (const oracle of step.oracles ?? []) {
    switch (oracle.kind) {
      case 'rows': {
        results.push(await evaluateRowsOracle(page, oracle));
        break;
      }
      case 'outbox': {
        results.push(await evaluateOutboxOracle(page));
        break;
      }
      case 'across-surfaces': {
        try {
          await runnerExpectAcrossSurfaces(page, {
            text: oracle.text,
            tabs: oracle.tabs,
            afterReload: oracle.afterReload,
          });
          results.push({
            kind: 'across-surfaces',
            text: oracle.text,
            tabs: oracle.tabs,
            result: 'passed',
          });
        } catch (err) {
          results.push({
            kind: 'across-surfaces',
            text: oracle.text,
            tabs: oracle.tabs,
            result: 'failed',
            detail: (err as Error).message,
          });
        }
        break;
      }
      case 'unchanged': {
        // A `steps`-level unchanged oracle is handled by the wrapper in
        // `runOneStep`; reaching here means it was a standalone, which is
        // handled by the `expectOracle` dispatcher. Nothing to do here.
        results.push({ kind: 'unchanged', sql: oracle.sql, result: 'skipped' });
        break;
      }
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* Step dispatch                                                       */
/* ------------------------------------------------------------------ */

/** Run one step's ACTION; returns the action-log label. */
async function dispatchAction(page: Page, step: SemanticStep): Promise<string> {
  switch (step.kind) {
    case 'switchSection':
      return actionSwitchSection(page, step.tab);
    case 'openSettings':
      return actionOpenSettings(page);
    case 'openCommand':
      return actionOpenCommand(page);
    case 'commandPreview':
      return actionCommandPreview(page, step);
    case 'commandConfirm':
      return actionCommandConfirm(page, step);
    case 'askQuestion':
      return actionAskQuestion(page, step);
    case 'createTodo':
      return actionCreateTodo(page, step);
    case 'toggleTodo':
      return actionToggleTodo(page, step);
    case 'createHabit':
      return actionCreateHabit(page, step);
    case 'tickHabit':
      return actionTickHabit(page, step);
    case 'logCalories':
      return actionLogCalories(page, step);
    case 'buildRoutine':
      return actionBuildRoutine(page, step);
    case 'setCalorieGoal':
      return actionSetCalorieGoal(page, step);
    case 'startPomodoro':
      return actionStartPomodoro(page, step);
    case 'waitThinkTime':
      return actionWaitThinkTime(page, step);
    case 'maybeMakeMistake':
      return actionMaybeMakeMistake(page, step);
    case 'abandonForm':
      return actionAbandonForm(page);
    case 'goOffline':
      return actionGoOffline(page);
    case 'goOnline':
      return actionGoOnline(page);
    case 'advanceClockToNextDay':
      return actionAdvanceClockToNextDay(page, step);
    case 'injectFailure':
      return actionInjectFailure(page, step);
    case 'reloadApp':
      return actionReloadApp(page);
    case 'expectOracle':
      return dispatchExpectOracle(page, step.oracle);
    case 'expectAcrossSurfaces':
      return actionExpectAcrossSurfaces(page, step);
    case 'apiLeg':
      return execApiLeg(page, { functionName: step.functionName, args: step.args });
  }
}

/** Action for a standalone `expectOracle` step (returns a log label). */
async function dispatchExpectOracle(page: Page, oracle: Oracle): Promise<string> {
  switch (oracle.kind) {
    case 'rows': {
      await evalRows(page, oracle);
      return 'expectOracle rows';
    }
    case 'outbox': {
      if (oracle.expected !== undefined) {
        await expectOutbox(page, oracle.expected as never);
      } else {
        await evaluateOutboxOracle(page);
      }
      return 'expectOracle outbox';
    }
    case 'across-surfaces': {
      await runnerExpectAcrossSurfaces(page, {
        text: oracle.text,
        tabs: oracle.tabs,
        afterReload: oracle.afterReload,
      });
      return 'expectOracle across-surfaces';
    }
    case 'unchanged': {
      // Standalone unchanged has no action to wrap around; record the state read.
      await queryRows(page, oracle.sql);
      return 'expectOracle unchanged';
    }
  }
}

/** Rows oracle with exact-expected or passthrough read. */
async function evalRows(page: Page, oracle: Extract<Oracle, { kind: 'rows' }>): Promise<void> {
  const expected = oracle.expected as Record<string, unknown>[] | undefined;
  if (expected !== undefined) {
    await expectRows(page, oracle.sql, expected);
  } else {
    await queryRows(page, oracle.sql);
  }
}

/* ------------------------------------------------------------------ */
/* State summary (failure digest input)                                */
/* ------------------------------------------------------------------ */

async function captureStateSummary(page: Page): Promise<string> {
  try {
    const rows = await queryRows(
      page,
      `SELECT
        (SELECT COUNT(*) FROM todos WHERE deleted_at IS NULL) AS todos,
        (SELECT COUNT(*) FROM habits WHERE deleted_at IS NULL) AS habits,
        (SELECT COUNT(*) FROM habit_completions) AS completions,
        (SELECT COUNT(*) FROM calorie_entries WHERE deleted_at IS NULL) AS calories,
        (SELECT COUNT(*) FROM pomodoro_sessions) AS pomodoro,
        (SELECT COUNT(*) FROM workout_routines WHERE deleted_at IS NULL) AS routines,
        (SELECT COUNT(*) FROM routine_exercises WHERE deleted_at IS NULL) AS routine_exercises,
        (SELECT COUNT(*) FROM custom_exercises WHERE deleted_at IS NULL) AS custom_exercises,
        (SELECT COUNT(*) FROM workout_weekly_plan WHERE deleted_at IS NULL) AS weekly_plan,
        (SELECT COUNT(*) FROM body_weight_entries WHERE deleted_at IS NULL) AS body_weight_entries`,
    );
    const r = rows[0] ?? {};
    return `todos=${String(r.todos)} habits=${String(r.habits)} completions=${String(r.completions)} calories=${String(r.calories)} pomodoro=${String(r.pomodoro)} routines=${String(r.routines)} routine_exercises=${String(r.routine_exercises)} custom_exercises=${String(r.custom_exercises)} weekly_plan=${String(r.weekly_plan)} body_weight_entries=${String(r.body_weight_entries)}`;
  } catch (err) {
    return `state summary unavailable: ${(err as Error).message}`;
  }
}

/* ------------------------------------------------------------------ */
/* Main executor                                                       */
/* ------------------------------------------------------------------ */

function resolveSeed(mode: RunMode, explicitSeed?: string): string | null {
  if (mode === 'exploratory') return null;
  if (explicitSeed !== undefined) return explicitSeed;
  if (mode === 'deterministic') return 'deterministic';
  return `0x${Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0')}`;
}

/**
 * Map the report's string seed onto the numeric seed the behavior engine
 * consumes (task 2.x: `buildRunPlan({ seed: number })`). Hex-ish strings map
 * directly (so `--seed 0x5e1f7e57` replays exactly); anything else (e.g.
 * a deterministic label) hashes via FNV-1a — deterministic, dependency-free.
 */
export function engineSeedFromString(seed: string | null): number {
  if (!seed) return 0;
  const cleaned = seed.trim().replace(/^0x/i, '');
  if (/^[0-9a-fA-F]{1,8}$/.test(cleaned)) {
    return parseInt(cleaned, 16) >>> 0;
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function makeRunId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `run_${Date.now().toString(36)}_${rand}`;
}

function readEnvironment(baseUrl: string): RunReport['environment'] {
  let appVersion: string | undefined;
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { version?: string };
    appVersion = pkg.version;
  } catch {
    // optional field
  }
  let commit: string | undefined;
  try {
    const head = fs.readFileSync(path.resolve(process.cwd(), '.git', 'HEAD'), 'utf8').trim();
    if (head.startsWith('ref:')) {
      const refPath = head.slice(4).trim();
      commit = fs.readFileSync(path.resolve(process.cwd(), '.git', refPath), 'utf8').trim();
    } else {
      commit = head;
    }
  } catch {
    // optional field
  }
  return { browser: 'chromium', platform: 'web', baseUrl, appVersion, commit };
}

/** Keep failure diagnostics useful without allowing a noisy page to grow them unbounded. */
function pushDiagnostic(target: string[], value: string): void {
  const normalized = value.trim();
  if (!normalized || target.includes(normalized) || target.length >= 20) return;
  target.push(normalized);
}

/**
 * Execute one scenario against the live build. Throws only on setup failures;
 * scenario (step) failures are captured in the report with `outcome: 'failed'`.
 */
export async function executeScenario(
  opts: ExecuteScenarioOptions,
): Promise<ExecuteScenarioResult> {
  const mode: RunMode = opts.mode ?? opts.scenario.mode ?? 'deterministic';
  const seed = resolveSeed(mode, opts.seed);
  const baseUrl = opts.baseUrl ?? APP_BASE_URL;
  const lane: RunLane = opts.lane ?? (mode === 'seeded' ? 'seeded' : 'scenario');
  const modelIssues = validateSimulationModel(opts.model);
  if (modelIssues.length > 0) {
    throw new Error(
      `model failed validation before run:\n` +
        modelIssues.map((i) => `  ${i.path}: ${i.message}`).join('\n'),
    );
  }

  const runId = makeRunId();
  const root = ensureRunOutputDir(runId);
  const steps = expandScenarioSteps(opts.model, opts.scenario);
  const persona = opts.model.personas.find((p) => p.id === opts.scenario.personaId) ?? null;
  if (mode === 'exploratory') {
    throw new Error(
      'exploratory mode is executed by the AI lane, not the behavior engine; ' +
        'run this scenario in deterministic (gating) or seeded (variability) mode',
    );
  }
  // Behavior engine (task 2.x): resolves think times + injections per step.
  // Deterministic mode: zero fixed think time unless `waitThinkTime.ms` is set,
  // zero injections — the plan is identical for every run of a given seed.
  const behavior = persona?.behavior ?? defaultBehaviorParams();
  const plan = buildRunPlan(steps, behavior, {
    mode,
    seed: engineSeedFromString(seed),
    deterministicThinkTimeMs: 0,
  });
  const report = createRunReport({
    runId,
    lane,
    mode,
    seed,
    environment: readEnvironment(baseUrl),
    persona: persona ? { id: persona.id, name: persona.name } : null,
    scenario: { id: opts.scenario.id, goal: opts.scenario.goal },
    artifacts: buildRunArtifacts({ runId, reportPath: '', screenshots: [] }),
  });
  const startedAt = new Date().toISOString();
  const screenshots: string[] = [];
  const consoleLines: string[] = [];
  const browserErrors: string[] = [];
  const serverErrors: string[] = [];

  const ownedBrowser = !opts.browser;
  const browser: Browser = opts.browser ?? (await chromium.launch());

  const context = await browser.newContext({
    baseURL: baseUrl,
    recordVideo: { dir: path.join(root, 'artifacts', 'video') },
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => {
    pushDiagnostic(browserErrors, `pageerror: ${error.name}: ${error.message}`);
  });
  page.on('console', (msg) => {
    const t = msg.type();
    const message = msg.text();
    if (t === 'error') {
      pushDiagnostic(browserErrors, `console.error: ${message}`);
    }
    if (t === 'error' || t === 'warning' || t === 'log') {
      consoleLines.push(`[${t}] ${message}`);
    }
  });
  page.on('response', (res) => {
    if (res.status() >= 500) {
      pushDiagnostic(serverErrors, `HTTP ${res.status()} ${res.request().method()} ${res.url()}`);
    }
  });
  page.on('requestfailed', (req) => {
    pushDiagnostic(
      serverErrors,
      `requestfailed ${req.method()} ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`,
    );
  });
  // Network capture is only needed by the repro-bundle failure hook (task 5.2);
  // keep it off for ordinary runs so they pay no listener overhead.
  const networkEvents: NetworkEvent[] = [];
  if (opts.onFailure) {
    page.on('response', (res) => {
      try {
        networkEvents.push({ url: res.url(), status: res.status(), failed: false });
      } catch {
        // URL/status can be unavailable on aborted responses — skip.
      }
    });
    page.on('requestfailed', (req) => {
      try {
        networkEvents.push({
          url: req.url(),
          status: 0,
          failed: true,
          error: req.failure()?.errorText,
        });
      } catch {
        // best-effort
      }
    });
  }
  await context.tracing.start({ screenshots: false, snapshots: false });

  let outcome: 'passed' | 'failed' = 'passed';
  let failure: RunReport['failure'] = undefined;
  let digestPath: string | undefined;

  try {
    // Reset + fixture: `seedFixture` resets internally and returns to app;
    // a fixture-less run resets and loads the app itself.
    if (opts.scenario.fixture) {
      await seedFixture(page, opts.scenario.fixture);
    } else {
      await resetAll(page);
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    }

    for (const resolved of plan.steps) {
      const { step, thinkTimeMs, injection } = resolved;
      if (thinkTimeMs > 0) {
        // Driver pacing only — never the app-visible clock (design D4).
        await page.waitForTimeout(thinkTimeMs);
      }
      const started = new Date().toISOString();
      const result = await runOneStep(page, step, resolved.stepIndex, {
        screenshots,
        runId,
        report,
        started,
        injection,
      });
      const entry = report.steps[report.steps.length - 1];
      opts.onStep?.({
        index: resolved.stepIndex,
        kind: step.kind,
        status: entry?.status ?? 'passed',
      });
      if (result.status === 'failed') {
        failure = {
          stepIndex: resolved.stepIndex,
          stepKind: step.kind,
          action: report.actionLog[resolved.stepIndex] ?? step.kind,
          error: entry?.error ?? 'step failed',
          expected: oracleExpectationText(step),
          actual: oracleActualText(entry?.oracles),
          stateSummary: await captureStateSummary(page).catch(() => undefined),
          browserErrors: browserErrors.length > 0 ? [...browserErrors] : undefined,
          serverErrors: serverErrors.length > 0 ? [...serverErrors] : undefined,
        };
        outcome = 'failed';
        break;
      }
    }
  } catch (err) {
    // Setup/teardown failure (e.g. the build is not served).
    outcome = 'failed';
    failure = {
      stepIndex: -1,
      stepKind: 'setup',
      action: 'setup',
      error: (err as Error).message,
      stateSummary: String((err as Error).stack ?? ''),
      browserErrors: browserErrors.length > 0 ? [...browserErrors] : undefined,
      serverErrors: serverErrors.length > 0 ? [...serverErrors] : undefined,
    };
  }

  // --- Teardown + artifact retention. Ordering matters: the video file is
  //     finalized by `context.close()`, so heavy-artifact retention decisions
  //     must be made AFTER the close; the trace must be stopped BEFORE it. ---
  if (outcome === 'failed') {
    try {
      await context.tracing.stop({ path: tracePath(runId) });
    } catch {
      // tracing may already be gone
    }
    // Repro-bundle capture hook (task 5.2): still has live page + context so it
    // can dump the DB and storage. Best-effort — a capture failure must not mask
    // the original scenario failure (or kill the run's teardown). The report is
    // passed FINALIZED-at-failure (outcome + failure summary): the run report is
    // normally finalized after teardown, but the bundle needs the failed state.
    // The steps are trimmed to those actually executed (0..failureIndex); the
    // run breaks at the first failure, so nothing after it ran.
    if (opts.onFailure) {
      try {
        const failureIndex = failure?.stepIndex ?? -1;
        await opts.onFailure({
          page,
          context,
          report: {
            ...report,
            outcome,
            failure,
            // The trace was just stopped to `tracePath(runId)`, so surface the
            // pointer in the captured report — the post-close artifact retention
            // (which normally adds it) runs after this hook.
            artifacts: { ...report.artifacts, trace: relativeToRoot(tracePath(runId)) },
          },
          runId,
          baseUrl,
          consoleLines,
          networkEvents,
          steps: failureIndex >= 0 ? plan.steps.slice(0, failureIndex + 1).map((s) => s.step) : [],
        });
      } catch {
        // best-effort
      }
    }
  }
  try {
    await context.close();
  } catch {
    // best-effort
  }
  if (outcome === 'passed') {
    deleteRecordedVideo(runId);
    deleteRecordedTrace(runId);
  } else {
    const video = findRecordedVideo(runId);
    const trace = relativeToRoot(tracePath(runId));
    const consoleLog = consoleLines.length > 0 ? writeConsoleLog(runId, consoleLines) : undefined;
    report.artifacts.video = video;
    report.artifacts.trace = trace;
    report.artifacts.consoleLog = consoleLog;
  }
  if (ownedBrowser) {
    await browser.close().catch(() => {});
  }
  if (outcome === 'failed') {
    await clearInjectedFailures(page).catch(() => {});
  }

  // Finalize the report FIRST so the failure digest (and its pointers) render
  // from final values: outcome, timestamps, and the run-report link.
  const reportRel = relativeToRoot(path.join(root, 'run-report.json'));
  report.artifacts = buildRunArtifacts({
    runId,
    reportPath: reportRel,
    screenshots,
    video: report.artifacts.video,
    trace: report.artifacts.trace,
    consoleLog: report.artifacts.consoleLog,
  });
  finalizeRunReport(report, {
    outcome,
    failure: outcome === 'failed' ? failure : undefined,
    startedAt,
  });
  if (outcome === 'failed' && failure) {
    const md = buildFailureDigest(report, { stateSummary: failure.stateSummary });
    digestPath = writeDigestMd(runId, md);
    failure.digestPath = digestPath;
    report.failure = failure;
  }

  const reportPath = writeRunReportJson(runId, serializeRunReport(report));

  const issues = validateRunReport(report);
  if (issues.length > 0) {
    throw new Error(
      `produced report failed its own validator:\n` +
        issues.map((i) => `  ${i.path}: ${i.message}`).join('\n'),
    );
  }

  return { runId, report, reportPath, digestPath, actionLog: report.actionLog, mode, seed };
}

/** Run one step: action (+ unchanged-wrapper), oracles, screenshot, report entry. */
async function runOneStep(
  page: Page,
  step: SemanticStep,
  index: number,
  ctx: {
    screenshots: string[];
    runId: string;
    report: RunReport;
    started: string;
    injection?: StepLogEntry | null;
  },
): Promise<{ label: string; status: 'passed' | 'failed' }> {
  const startedAt = ctx.started;
  let actionLabel = '';
  let errorMessage: string | undefined;
  let oracleResults: EvaluatedOracle[] = [];
  const injection = ctx.injection ?? null;

  try {
    const unchangedOracle = step.oracles?.find((o) => o.kind === 'unchanged');
    if (unchangedOracle) {
      // Negative-oracle pattern: snapshot → action → compare (parent helper).
      await expectUnchanged(page, unchangedOracle.sql, async (p) => {
        actionLabel = await dispatchWithInjection(p, step, injection);
      });
      oracleResults = await evaluateStepOracles(page, { ...step, oracles: [] });
    } else {
      actionLabel = await dispatchWithInjection(page, step, injection);
      oracleResults = await evaluateStepOracles(page, step);
    }
    // A failed declared oracle fails the step (and hence the run).
    const failedOracle = oracleResults.find((o) => o.result === 'failed');
    if (failedOracle) {
      throw new Error(`oracle '${failedOracle.kind}' failed: ${failedOracle.detail ?? 'mismatch'}`);
    }
  } catch (err) {
    errorMessage = (err as Error).message;
    if (!actionLabel) actionLabel = `${step.kind} (failed)`;
  }

  // Return to the app so screenshots show the UI, not the DB harness document.
  try {
    if (page.url().includes('/__sh__/db/')) {
      await returnToApp(page);
    }
  } catch {
    // best-effort; screenshot may fail afterwards
  }

  const screenshot = await captureStepScreenshot(page, {
    runId: ctx.runId,
    stepIndex: index,
    kind: step.kind,
    status: errorMessage ? 'failed' : 'passed',
  }).catch(() => '');
  if (screenshot) ctx.screenshots.push(screenshot);

  const finishedAt = new Date().toISOString();
  const status: 'passed' | 'failed' = errorMessage ? 'failed' : 'passed';
  ctx.report.actionLog.push(actionLabel || step.kind);

  const entry: RunStepEntry = {
    index,
    kind: step.kind,
    note: step.note,
    startedAt,
    finishedAt,
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
    status,
    oracles: oracleResults.length > 0 ? oracleResults : undefined,
    artifacts: { screenshots: screenshot ? [screenshot] : [] },
    error: errorMessage,
  };
  ctx.report.steps.push(entry);
  return { label: actionLabel, status };
}

/**
 * Apply an injected imperfection around a step's action (seeded mode only;
 * deterministic mode passes `injection === null`). Executable injectors:
 *   - `abandonment`  — skip the action entirely (no row written; oracles then
 *     surface the difference, which is the point of the seeded lane).
 *   - `offline-toggle` — context offline around the action.
 * Log-only injectors (`double-tap`, `typo-correction`, `tab-hide`) are
 * recorded in the action log but not yet automated — the seam is documented
 * in `actions.ts`; the log entry keeps the run reproducible.
 */
async function dispatchWithInjection(
  page: Page,
  step: SemanticStep,
  injection: StepLogEntry | null,
): Promise<string> {
  if (injection === null) {
    return dispatchAction(page, step);
  }
  if (injection.kind === 'abandonment') {
    return `${step.kind} skipped [injection:abandonment]`;
  }
  if (injection.kind === 'offline-toggle') {
    await setOffline(page, true);
    try {
      const label = await dispatchAction(page, step);
      return `${label} [injection:offline-toggle]`;
    } finally {
      await setOffline(page, false);
    }
  }
  const label = await dispatchAction(page, step);
  return `${label} [injection:${injection.kind}]`;
}

/** Best-effort oracle expectation text for the digest. */
function oracleExpectationText(step: SemanticStep): string | undefined {
  const oracle = step.oracles?.[0];
  if (!oracle) return undefined;
  switch (oracle.kind) {
    case 'rows':
      return oracle.expected !== undefined ? JSON.stringify(oracle.expected) : oracle.sql;
    case 'unchanged':
      return `rows unchanged for: ${oracle.sql}`;
    case 'across-surfaces':
      return oracle.text;
    case 'outbox':
      return oracle.expected !== undefined ? JSON.stringify(oracle.expected) : 'outbox parse';
  }
}

/** Best-effort oracle actual text for the digest. */
function oracleActualText(oracles: EvaluatedOracle[] | undefined): string | undefined {
  const failed = oracles?.find((o) => o.result === 'failed');
  return failed ? (failed.detail ?? String(failed.result)) : undefined;
}

/**
 * Replay executor (task 5.3, repro bundle replay). Re-executes an ordered list
 * of semantic steps against a live page whose DB + storage have already been
 * restored, and returns a `RunReport` of the outcomes. Reuses `runOneStep`, so
 * action dispatch, oracle evaluation, screenshots, and report entries are
 * byte-identical to a live run's machinery. The report is `lane: 'repro'` and
 * stops at the first failed step — the same semantics a scenario run has.
 */
export async function replaySteps(
  page: Page,
  steps: SemanticStep[],
  opts: { runId: string; onStep?: (info: { index: number; kind: string; status: string }) => void },
): Promise<RunReport> {
  const startedAt = new Date().toISOString();
  const report = createRunReport({
    runId: opts.runId,
    lane: 'repro',
    mode: 'deterministic',
    seed: null,
    environment: readEnvironment(APP_BASE_URL),
    persona: null,
    scenario: null,
    artifacts: buildRunArtifacts({ runId: opts.runId, reportPath: '', screenshots: [] }),
  });
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const started = new Date().toISOString();
    const result = await runOneStep(page, step, i, {
      screenshots: [],
      runId: opts.runId,
      report,
      started,
      injection: null,
    });
    const entry = report.steps[report.steps.length - 1];
    opts.onStep?.({ index: i, kind: step.kind, status: entry?.status ?? 'passed' });
    if (result.status === 'failed') {
      report.failure = {
        stepIndex: i,
        stepKind: step.kind,
        error: entry?.error ?? 'step failed',
        expected: oracleExpectationText(step),
        actual: oracleActualText(entry?.oracles),
      };
      break;
    }
  }
  finalizeRunReport(report, { outcome: report.failure ? 'failed' : 'passed', startedAt });
  return report;
}

/* ------------------------------------------------------------------ */
/* Step → resolution mapping (documentation contract, task 3.1)        */
/* ------------------------------------------------------------------ */

/**
 * Resolution table — mirrors `simulation/model/steps.ts` `parentHelper`:
 *
 * | step kind            | resolution                                                       |
 * |----------------------|------------------------------------------------------------------|
 * | switchSection        | `oracles.switchSection`                                          |
 * | openSettings         | runner-owned (Overview header "Open settings" → Modal "Close")   |
 * | openCommand          | runner-owned (launcher "Open command center" → `#command-input`) |
 * | commandPreview       | `commandObservation.openCommandScreen` + parse + preview       |
 * | commandConfirm       | `commandObservation.openCommandScreen` + parse + confirm       |
 * | askQuestion          | `commandObservation.openCommandScreen` + AskConversationView  |
 * | createTodo           | `navigation.openNewTodoModal` + `navigation.submitTodoModal`     |
 * | toggleTodo           | `gestures.clickTodoCheckboxForTitle`                             |
 * | createHabit          | runner-owned (Habits "Add" tile + "Habit name" form)             |
 * | tickHabit            | runner-owned (habit ring a11y label)                             |
 * | logCalories          | `forms.fillCaloriesMacros` + `forms.clickCaloriesAddEntry`       |
 * | buildRoutine         | `forms.fillRoutineName` + "Add routine"                          |
 * | startPomodoro        | runner-owned ("Start focus" button)                              |
 * | waitThinkTime        | behavior engine `buildRunPlan` (thinkTimeMs = step.ms)          |
 * | maybeMakeMistake     | behavior engine (deterministic injects nothing; log-only seam)  |
 * | abandonForm          | behavior engine (deterministic: no-op; `unchanged` oracle)      |
 * | goOffline            | `failure.setOffline(true)`                                       |
 * | goOnline             | `failure.setOffline(false)`                                      |
 * | advanceClockToNextDay| `clock.advanceToNextDay`                                         |
 * | injectFailure        | `failure.injectServerError/injectTimeout/injectMalformed/...`    |
 * | reloadApp            | `dbHarness.returnToApp`                                          |
 * | expectOracle         | `oracles.expectRows/expectOutbox/expectUnchanged`                |
 * | expectAcrossSurfaces | `oracles.expectAcrossSurfaces`                                   |
 * | apiLeg               | `apiLeg.execApiLeg` (DB-harness replay; guard rejects raw SQL)   |
 */
