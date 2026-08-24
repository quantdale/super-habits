/**
 * Declarative model for the user-simulation platform (`add-user-simulation-platform`).
 *
 * These are the pure, tool-agnostic types every lane consumes — the scenario
 * runner (Playwright), the AI exploratory lane, repro replay, and the API
 * orchestration legs. Nothing here imports Playwright, e2e helpers, SQLite, or
 * any runtime dependency (design D1: no new runtime deps, no LLM SDK). The
 * model is authored in TypeScript via the typed builders in `builders.ts` and
 * validated at load by `validate.ts` (design D2).
 *
 * Semantic steps express *user intent* (`createTodo`, `tickHabit`,
 * `switchSection`, `goOffline`) and NEVER contain CSS selectors or Playwright
 * locators. Selector knowledge lives in the shared `e2e/helpers/*` layer; the
 * step catalog in `steps.ts` records which parent helper each step resolves to
 * at runtime.
 */

/* ------------------------------------------------------------------ */
/* Run modes (design D4)                                               */
/* ------------------------------------------------------------------ */

/**
 * Execution lane behavior mode.
 * - `deterministic`: fixed seed, all injectors off — used in any gating lane.
 * - `seeded`: a seed is chosen per run and recorded in the run report; a
 *   failure is exactly replayable via that seed.
 * - `exploratory`: the AI lane; no seed guarantee, no injectors applied.
 */
export type RunMode = 'deterministic' | 'seeded' | 'exploratory';

/* ------------------------------------------------------------------ */
/* Surfaces / sections / features                                      */
/* ------------------------------------------------------------------ */

/**
 * The six single-page sections (matches `TAB_LABELS` in `e2e/helpers/navigation.ts`).
 */
export type SectionName = 'overview' | 'todos' | 'habits' | 'pomodoro' | 'workout' | 'calories';

/**
 * Any surface the user can reach: the six sections plus the Settings modal and
 * the Command Center overlay. Used for openSurface-style steps and for a
 * persona's feature affinity.
 */
export type SurfaceName = SectionName | 'settings' | 'command';

/**
 * Aliased for readability of persona feature-affinity declarations.
 */
export type FeatureName = SurfaceName;

/**
 * Every entity that can ride the durable backup outbox. Keep this explicit so
 * simulation failure injection and reports can name Gym V2 rows without
 * importing runtime/core types into the tool-agnostic model layer.
 */
export type SyncEntityName =
  | 'todos'
  | 'habits'
  | 'habit_completions'
  | 'calorie_entries'
  | 'saved_meals'
  | 'workout_routines'
  | 'routine_exercises'
  | 'routine_exercise_sets'
  | 'workout_logs'
  | 'workout_session_exercises'
  | 'pomodoro_sessions'
  | 'linked_action_rules'
  | 'weekly_reviews'
  | 'projects'
  | 'goals'
  | 'daily_plans'
  | 'workout_session_sets'
  | 'custom_exercises'
  | 'workout_weekly_plan'
  | 'workout_schedule_overrides'
  | 'body_weight_entries'
  | 'user_backup_settings'
  | 'backup_manifest';

/** Fixture sizes, matching `FixtureSize` in `e2e/helpers/seed.ts`. */
export type FixtureSize = 'SMALL' | 'TYPICAL' | 'HEAVY';

/* ------------------------------------------------------------------ */
/* Behavior parameters (design D4)                                     */
/* ------------------------------------------------------------------ */

/**
 * Per-persona clamped log-normal think-time distribution.
 *
 * `mu` and `sigma` are the mean and standard deviation of the *underlying
 * normal* that the log-normal thinks are cooked from (i.e. `ln(ms)` is drawn
 * from `N(mu, sigma)`), then `minMs`/`maxMs` clamp the result. `deterministic`
 * mode ignores the sampler and returns fixed per-step values.
 */
export interface ThinkTimeParams {
  /** Log-scale mean (mean of `ln(ms)`). */
  mu: number;
  /** Log-scale standard deviation (std of `ln(ms)`). Must be >= 0. */
  sigma: number;
  /** Clamp floor for a sampled think time in ms. Must be >= 0. */
  minMs: number;
  /** Clamp ceiling for a sampled think time in ms. Must be >= minMs. */
  maxMs: number;
}

/** One of the bounded, user-reachable imperfection injectors (design D4). */
export type InjectionKind =
  /** Double-tap/click a submit control. */
  | 'double-tap'
  /** Type a typo, then correct it before submitting. */
  | 'typo-correction'
  /** Abandon a form mid-way (no row written). */
  | 'abandonment'
  /** Toggle connectivity off/on around an action. */
  | 'offline-toggle'
  /** Hide the tab while a timer is running. */
  | 'tab-hide';

/** Session-length profile (how long a persona typically uses the app per sit). */
export interface SessionLengthParams {
  /** Lower bound of a session, in minutes. Must be >= 0. */
  minMinutes: number;
  /** Upper bound of a session, in minutes. Must be >= minMinutes. */
  maxMinutes: number;
}

/**
 * Behavior parameters describing how a persona acts. All rates are
 * probabilities in `[0, 1]` sampled by the seeded RNG; `deterministic` mode
 * forces every rate to 0. Validation enforces these ranges (see `validate.ts`).
 */
export interface BehaviorParams {
  /** Clamped log-normal think-time distribution. */
  thinkTime: ThinkTimeParams;
  /** Overall probability that a given action involves a mistake. */
  mistakeRate: number;
  /** Probability of a double-tap on a submit control. */
  doubleTapRate: number;
  /** Probability of a typo-with-correction before submitting. */
  typoRate: number;
  /** Probability of abandoning a form mid-way. */
  abandonmentRate: number;
  /** Probability of toggling connectivity around an action. */
  offlineToggleRate: number;
  /** Probability of hiding the tab while a timer runs. */
  tabHideRate: number;
  /** Session-length profile (minutes). */
  sessionLength: SessionLengthParams;
  /** Relative affinity for each surface (weights; higher = more likely). */
  featureAffinity: Partial<Record<FeatureName, number>>;
}

/* ------------------------------------------------------------------ */
/* Oracle (design D3, "Every step carries its own oracles")            */
/* ------------------------------------------------------------------ */

/**
 * A declarative verification, resolved at runtime through the parent's oracle
 * helpers (`e2e/helpers/oracles.ts`). A mutating step must declare at least one
 * oracle, and at least one of those must be a persisted-row or second-surface
 * check (`rows` or `across-surfaces`) — a bare toast or list re-render is never
 * the only evidence.
 */
export type Oracle =
  /** Assert the rows returned by `sql` match `expected` (→ `expectRows`). */
  | { kind: 'rows'; sql: string; expected?: unknown[] }
  /** Assert the same fact from >= 2 independent surfaces (+ optional reload) (→ `expectAcrossSurfaces`). */
  | { kind: 'across-surfaces'; text: string; tabs: SectionName[]; afterReload?: boolean }
  /** Assert the sync outbox contents (→ `expectOutbox`). */
  | { kind: 'outbox'; expected?: unknown[] }
  /** Negative oracle: rows for `sql` must NOT change across the step (→ `expectUnchanged`). */
  | { kind: 'unchanged'; sql: string };

/* ------------------------------------------------------------------ */
/* Semantic step                                                       */
/* ------------------------------------------------------------------ */

/** The set of semantic step names the catalog knows (see `steps.ts`). */
export type SemanticStepName =
  // navigation
  | 'switchSection'
  | 'openSettings'
  | 'openCommand'
  // Command Center V2
  | 'commandPreview'
  | 'commandConfirm'
  | 'askQuestion'
  // entity actions
  | 'createTodo'
  | 'toggleTodo'
  | 'createHabit'
  | 'tickHabit'
  | 'logCalories'
  | 'buildRoutine'
  | 'setCalorieGoal'
  | 'startPomodoro'
  // realism
  | 'waitThinkTime'
  | 'maybeMakeMistake'
  | 'abandonForm'
  // environment
  | 'goOffline'
  | 'goOnline'
  | 'advanceClockToNextDay'
  | 'injectFailure'
  | 'reloadApp'
  // verification
  | 'expectOracle'
  | 'expectAcrossSurfaces'
  // api
  | 'apiLeg';

/** Common fields on every semantic step. */
interface StepBase {
  /** Human-facing description for reviewers and run reports. */
  note?: string;
  /**
   * Verification this step declares. Optional at authoring time (defaults to
   * `[]`); `validateSimulationModel` requires mutating steps to carry at least
   * one oracle, with at least one `rows`/`across-surfaces` check.
   */
  oracles?: Oracle[];
}

/** A bounded assertion about one Command Center preview row. */
export interface CommandPreviewCheck {
  label: string;
  contains: string;
}

/** Outcomes the deterministic Command Center parser/review can expose. */
export type CommandPreviewOutcome = 'ready' | 'needs_input' | 'unsupported';

/** Outcomes the read-only Ask surface can expose. */
export type AskStepOutcome = 'answer' | 'unsupported' | 'unavailable';

/**
 * A single semantic step. This is a discriminated union keyed on `kind`; the
 * catalog in `steps.ts` records each kind's category, whether it mutates, and
 * which parent helper it resolves to.
 */
export type SemanticStep =
  // ---- navigation ----
  | ({ kind: 'switchSection'; tab: SectionName } & StepBase)
  | ({ kind: 'openSettings'; bucket?: string } & StepBase)
  | ({ kind: 'openCommand' } & StepBase)
  | ({
      kind: 'commandPreview';
      input: string;
      expectedOutcome: CommandPreviewOutcome;
      previewRows?: CommandPreviewCheck[];
    } & StepBase)
  | ({
      kind: 'commandConfirm';
      input: string;
      previewRows?: CommandPreviewCheck[];
      successText?: string;
    } & StepBase)
  | ({
      kind: 'askQuestion';
      question: string;
      expectedOutcome: AskStepOutcome;
      contains?: string;
    } & StepBase)
  // ---- entity actions ----
  | ({
      kind: 'createTodo';
      title: string;
      priority?: 'urgent' | 'normal' | 'low';
    } & StepBase)
  | ({ kind: 'toggleTodo'; title: string } & StepBase)
  | ({ kind: 'createHabit'; name: string; targetPerDay?: number } & StepBase)
  | ({ kind: 'tickHabit'; name: string; times?: number } & StepBase)
  | ({
      kind: 'logCalories';
      food: string;
      calories: number;
      mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    } & StepBase)
  | ({ kind: 'buildRoutine'; name: string; exercises?: number } & StepBase)
  | ({
      kind: 'setCalorieGoal';
      /** Target daily calorie goal saved through the Settings → Nutrition UI. */
      calories: number;
    } & StepBase)
  | ({
      kind: 'startPomodoro';
      mode?: 'focus' | 'short_break' | 'long_break';
      durationSeconds?: number;
    } & StepBase)
  // ---- realism ----
  | ({ kind: 'waitThinkTime'; ms?: number } & StepBase)
  | ({ kind: 'maybeMakeMistake'; injection?: InjectionKind } & StepBase)
  | ({ kind: 'abandonForm' } & StepBase)
  // ---- environment ----
  | ({ kind: 'goOffline' } & StepBase)
  | ({ kind: 'goOnline' } & StepBase)
  | ({
      kind: 'advanceClockToNextDay';
      days?: number;
      afterMidnightMs?: number;
    } & StepBase)
  | ({
      kind: 'injectFailure';
      failure: 'server-error' | 'timeout' | 'malformed' | 'partial' | 'offline';
      status?: number;
      entities?: SyncEntityName[];
    } & StepBase)
  | ({ kind: 'reloadApp' } & StepBase)
  // ---- verification ----
  | ({ kind: 'expectOracle'; oracle: Oracle } & StepBase)
  | ({
      kind: 'expectAcrossSurfaces';
      text: string;
      tabs: SectionName[];
      afterReload?: boolean;
    } & StepBase)
  // ---- api ----
  | ({
      kind: 'apiLeg';
      /** Data-layer function to invoke, e.g. `createHabit` (no raw SQL). */
      functionName: string;
      args?: Record<string, unknown>;
      description?: string;
    } & StepBase);

/* ------------------------------------------------------------------ */
/* Persona / Workflow / Scenario / Model                               */
/* ------------------------------------------------------------------ */

/** A persona: reusable across every lane (scenario runner, AI lane, repro). */
export interface Persona {
  /** Stable identifier, e.g. `daily-driver`. Referenced by scenarios. */
  id: string;
  /** Human name, e.g. "Maya, the Daily Driver". */
  name: string;
  /** One-paragraph description of who this persona is. */
  description: string;
  /** The goals this persona pursues. */
  goals: string[];
  /** Behavior parameters sufficient to reproduce the persona's behaviour. */
  behavior: BehaviorParams;
  /** Optional trait tags, e.g. `['frequent', 'mobile-web']`. */
  traits?: string[];
}

/** A reference to a reusable workflow fragment, bound to parameters. */
export interface WorkflowRef {
  /** The `workflow.id` this scenario pulls in. */
  workflowId: string;
  /** Parameters passed to the workflow's parameterized steps. */
  params?: Record<string, unknown>;
}

/** A reusable workflow fragment: a named, parameterized sequence of steps. */
export interface Workflow {
  /** Stable identifier, e.g. `log-breakfast`. Referenced by scenarios. */
  id: string;
  /** Named parameters this fragment's steps consume. */
  parameters?: string[];
  /** The ordered semantic steps making up the fragment. */
  steps: SemanticStep[];
  /** Human-facing description. */
  description?: string;
}

/**
 * A scenario: persona × goal × starting fixture × ordered semantic steps ×
 * the risks it covers. Reads as a user journey, not a feature checklist.
 */
export interface Scenario {
  /** Stable identifier, e.g. `week-of-habit-tracking`. */
  id: string;
  /** Reference to a persona's `id` (must exist in the model). */
  personaId: string;
  /** One-line goal of this scenario. */
  goal: string;
  /** Starting fixture (`SMALL`/`TYPICAL`/`HEAVY`). Defaults to `SMALL`. */
  fixture?: FixtureSize;
  /** Ordered workflow fragments to expand (runner executes them in order). */
  workflows?: WorkflowRef[];
  /** The ordered inline semantic steps. */
  steps: SemanticStep[];
  /** Covered risk IDs (e.g. `['R1', 'R5']`). */
  risks?: string[];
  /** Run mode; defaults to `deterministic`. */
  mode?: RunMode;
  /** Playwright-style tags, e.g. `['@p0']`. */
  tags?: string[];
  /** Human-facing description. */
  description?: string;
}

/** The full model loaded from `simulation/personas/`, `workflows/`, `scenarios/`. */
export interface SimulationModel {
  personas: Persona[];
  workflows?: Workflow[];
  scenarios: Scenario[];
}
