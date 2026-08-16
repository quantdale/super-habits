/**
 * Semantic step catalog (`add-user-simulation-platform` task 1.6).
 *
 * The catalog is the single registry mapping each semantic step name to:
 *   - its category,
 *   - whether it mutates application state (drives the "every mutating step
 *     carries its own oracles" validation rule),
 *   - the parent harness helper(s) it resolves to at runtime.
 *
 * Step definitions reference the parent change's helpers by their REAL export
 * names (`e2e/helpers/{navigation,forms,gestures,clock,failure,oracles}.ts`).
 * The `parentHelper` field is a documentation/tooling contract — the runner
 * (task 3.1) performs the actual import. Steps with no dedicated parent helper
 * yet (surfaces/forms the harness has not extracted) are marked
 * `parentHelper: null` with a `note` naming the runner-owned interaction that
 * will own their selectors; scenario files themselves never contain selectors.
 */

import type {
  FeatureName,
  Oracle,
  SectionName,
  SemanticStep,
  SemanticStepName,
  SurfaceName,
} from './types';

/** Categories of catalogued steps. */
export type StepCategory =
  'navigation' | 'entity' | 'realism' | 'environment' | 'verification' | 'api';

/** Static metadata for one semantic step kind. */
export interface StepDefinition {
  /** The step kind this entry describes. */
  kind: SemanticStepName;
  /** Registry category. */
  category: StepCategory;
  /** One-line description of the step, in user-intent terms. */
  description: string;
  /**
   * Whether the step writes application state (creates/updates/deletes rows,
   * starts sessions, toggles persisted prefs). Drives the oracle requirement:
   * mutating steps must declare >= 1 oracle with a persisted-row or
   * second-surface check.
   */
  mutating: boolean;
  /**
   * Parent helper function name(s) this step delegates to — real exports of
   * `e2e/helpers/*`. `null` means the parent harness has no dedicated helper
   * for this interaction; see `note`.
   */
  parentHelper: string | null;
  /** Note on mapping/runtime ownership when `parentHelper` is null. */
  note?: string;
}

/* ------------------------- known names ------------------------- */

/** The six single-page sections (matches `TAB_LABELS` keys). */
export const KNOWN_SECTION_NAMES: readonly SectionName[] = [
  'overview',
  'todos',
  'habits',
  'pomodoro',
  'workout',
  'calories',
];

/** All surfaces: sections + settings modal + command overlay. */
export const KNOWN_SURFACE_NAMES: readonly SurfaceName[] = [
  ...KNOWN_SECTION_NAMES,
  'settings',
  'command',
];

/** Aliased for feature-affinity validation. */
export const KNOWN_FEATURE_NAMES: readonly FeatureName[] = KNOWN_SURFACE_NAMES;

/** Oracle discriminator values the model accepts. */
export const KNOWN_ORACLE_KINDS = ['rows', 'across-surfaces', 'outbox', 'unchanged'] as const;

/** Step kinds that persist application state (data writes or session starts). */
export const MUTATING_STEPS: ReadonlySet<SemanticStepName> = new Set<SemanticStepName>([
  'createTodo',
  'toggleTodo',
  'createHabit',
  'tickHabit',
  'logCalories',
  'buildRoutine',
  'setCalorieGoal',
  'startPomodoro',
  'commandConfirm',
  'injectFailure', // tolerated as state-affecting: offline toggling mutates connectivity
  'reloadApp', // tolerated as state-affecting: continuity may be broken by design
  'apiLeg', // setup/teardown/backend writes
]);

/* ------------------------- the catalog ------------------------- */

export const SEMANTIC_STEP_CATALOG: Record<SemanticStepName, StepDefinition> = {
  // ---- navigation ----
  switchSection: {
    kind: 'switchSection',
    category: 'navigation',
    description: 'Switch the active section without navigating/reloading (single-page shell).',
    mutating: false,
    parentHelper: 'oracles.switchSection',
  },
  openSettings: {
    kind: 'openSettings',
    category: 'navigation',
    description: 'Open the Settings full-screen drawer modal.',
    mutating: false,
    parentHelper: null,
    note: 'Runner-owned: parent harness has no openSettings helper; selector lives in the runner, never in scenario files.',
  },
  openCommand: {
    kind: 'openCommand',
    category: 'navigation',
    description: 'Open the Command Center global overlay (gated by COMMAND_EXPERIMENT_ENABLED).',
    mutating: false,
    parentHelper: null,
    note: 'Runner-owned: parent harness has no openCommand helper; overlay interaction belongs to the runner.',
  },
  commandPreview: {
    kind: 'commandPreview',
    category: 'entity',
    description: 'Parse and review a Command Center draft without confirming it.',
    mutating: false,
    parentHelper: 'commandObservation.openCommandScreen + parseCommand',
  },
  commandConfirm: {
    kind: 'commandConfirm',
    category: 'entity',
    description: 'Confirm one supported Command Center mutation through the normal product path.',
    mutating: true,
    parentHelper: 'commandObservation.openCommandScreen + parseCommand + Confirm and save',
  },
  askQuestion: {
    kind: 'askQuestion',
    category: 'verification',
    description: 'Submit one bounded read-only question to the Command Center Ask surface.',
    mutating: false,
    parentHelper: 'commandObservation.openCommandScreen + AskConversationView',
  },

  // ---- entity actions ----
  createTodo: {
    kind: 'createTodo',
    category: 'entity',
    description: 'Add a new todo through the FAB + modal form.',
    mutating: true,
    parentHelper: 'navigation.openNewTodoModal + navigation.submitTodoModal',
  },
  toggleTodo: {
    kind: 'toggleTodo',
    category: 'entity',
    description: 'Toggle a todo item completion state (checked/unchecked).',
    mutating: true,
    parentHelper: 'gestures.clickTodoCheckboxForTitle',
  },
  createHabit: {
    kind: 'createHabit',
    category: 'entity',
    description: 'Create a new habit with an optional daily target.',
    mutating: true,
    parentHelper: null,
    note: 'Runner-owned UI form; the apiLeg variant calls the real `features/habits/habits.data` create path via page.evaluate.',
  },
  tickHabit: {
    kind: 'tickHabit',
    category: 'entity',
    description: 'Increment a habit tick for today (count +1 up to the target).',
    mutating: true,
    parentHelper: null,
    note: 'Runner-owned habit-circle click; apiLeg variant calls `features/habits/habits.data` tick path.',
  },
  logCalories: {
    kind: 'logCalories',
    category: 'entity',
    description: 'Log a calorie entry through the Calories form.',
    mutating: true,
    parentHelper: 'forms.fillCaloriesMacros + forms.clickCaloriesAddEntry',
  },
  buildRoutine: {
    kind: 'buildRoutine',
    category: 'entity',
    description: 'Create a workout routine (name + exercise/set shape).',
    mutating: true,
    parentHelper: 'forms.fillRoutineName',
  },
  setCalorieGoal: {
    kind: 'setCalorieGoal',
    category: 'entity',
    description:
      'Save the daily calorie goal through the Settings → Nutrition UI (recoverable settings allowlist).',
    mutating: true,
    parentHelper: null,
    note: 'Runner-owned Settings modal interaction: fill the Calories (kcal) field and save nutrition defaults.',
  },
  startPomodoro: {
    kind: 'startPomodoro',
    category: 'entity',
    description: 'Start a Pomodoro timer (focus/break mode; session logs only on completion).',
    mutating: true,
    parentHelper: null,
    note: 'Runner-owned start-button interaction; completion relies on the clock/timeout the way the parent journeys do.',
  },

  // ---- realism ----
  waitThinkTime: {
    kind: 'waitThinkTime',
    category: 'realism',
    description:
      'Pause the driver for the persona think time (fixed ms in deterministic mode, sampled in seeded mode).',
    mutating: false,
    parentHelper: null,
    note: 'Behavior engine (task 2.2) owns the sampler; deterministic mode returns the fixed `ms` param or a per-step constant.',
  },
  maybeMakeMistake: {
    kind: 'maybeMakeMistake',
    category: 'realism',
    description:
      'Sample one bounded mistake from the persona injector set; seeded mode records it in the step log.',
    mutating: false,
    parentHelper: null,
    note: 'Behaviour injectors (task 2.3) own the injector set; deterministic mode always injects nothing.',
  },
  abandonForm: {
    kind: 'abandonForm',
    category: 'realism',
    description: 'Abandon the in-progress form without submitting (no row written).',
    mutating: false,
    parentHelper: null,
    note: 'Behaviour injector (task 2.3); the negative-oracle pattern asserts nothing persisted.',
  },

  // ---- environment ----
  goOffline: {
    kind: 'goOffline',
    category: 'environment',
    description: 'Simulate loss of connectivity (drives NetInfo offline).',
    mutating: false,
    parentHelper: 'failure.setOffline',
  },
  goOnline: {
    kind: 'goOnline',
    category: 'environment',
    description: 'Restore connectivity (drives NetInfo online + opportunistic flush).',
    mutating: false,
    parentHelper: 'failure.setOffline',
  },
  advanceClockToNextDay: {
    kind: 'advanceClockToNextDay',
    category: 'environment',
    description: 'Advance the browser clock past the next local midnight (day rollover).',
    mutating: false,
    parentHelper: 'clock.advanceToNextDay',
  },
  injectFailure: {
    kind: 'injectFailure',
    category: 'environment',
    description:
      'Inject a remote failure at the Supabase origin (503/timeout/malformed/partial/offline).',
    mutating: true, // tolerated: network-side state changes that mutating steps must still verify
    parentHelper:
      'failure.injectServerError / injectTimeout / injectMalformed / injectPartialFailure / setOffline',
  },
  reloadApp: {
    kind: 'reloadApp',
    category: 'environment',
    description: 'Hard-reload the app page (fresh bootstrap, service worker bypass).',
    mutating: true, // tolerated: breaks continuity; mutating steps must verify survival
    parentHelper: 'navigation.hardReload / dbHarness.returnToApp',
  },

  // ---- verification ----
  expectOracle: {
    kind: 'expectOracle',
    category: 'verification',
    description: 'Evaluate a single declared oracle (rows/outbox/unchanged) as a standalone check.',
    mutating: false,
    parentHelper: 'oracles.expectRows / expectOutbox / expectUnchanged',
  },
  expectAcrossSurfaces: {
    kind: 'expectAcrossSurfaces',
    category: 'verification',
    description:
      'Assert the same fact across >= 2 independent section surfaces (optional afterReload).',
    mutating: false,
    parentHelper: 'oracles.expectAcrossSurfaces',
  },

  // ---- api ----
  apiLeg: {
    kind: 'apiLeg',
    category: 'api',
    description:
      'Headless leg calling a real `*.data.ts` function via page.evaluate (never raw SQL).',
    mutating: true,
    parentHelper: 'page.evaluate → features/*.data.ts (parent seeding approach)',
  },
};

/** All step kinds, in catalog order. */
export const SEMANTIC_STEP_NAMES: readonly SemanticStepName[] = Object.keys(
  SEMANTIC_STEP_CATALOG,
) as SemanticStepName[];

/* ------------------------- helpers ------------------------- */

/** True if `name` is a known catalogued step kind. */
export function isKnownStep(name: string): name is SemanticStepName {
  return name in SEMANTIC_STEP_CATALOG;
}

/** True if the named step kind persists application state (per the catalog). */
export function isMutatingStep(name: SemanticStepName): boolean {
  return MUTATING_STEPS.has(name);
}

/** True if the step kind is mutating AND therefore must carry oracles. */
export function requiresOracle(name: SemanticStepName): boolean {
  return isMutatingStep(name);
}

/** True if `section` is one of the six single-page sections. */
export function isKnownSectionName(section: string): section is SectionName {
  return (KNOWN_SECTION_NAMES as readonly string[]).includes(section);
}

/** True if `feature` is a known feature/surface name (for feature affinity). */
export function isKnownFeatureName(feature: string): feature is FeatureName {
  return (KNOWN_FEATURE_NAMES as readonly string[]).includes(feature);
}

/** True if `oracle` is a recognized oracle discriminated union member. */
export function isKnownOracle(oracle: { kind: string }): oracle is Oracle {
  return (KNOWN_ORACLE_KINDS as readonly string[]).includes(oracle.kind);
}

/** Resolve a step to its catalog entry; throws on unknown kinds. */
export function stepDefinition(step: SemanticStep): StepDefinition {
  const def = SEMANTIC_STEP_CATALOG[step.kind];
  if (!def) {
    throw new Error(`Unknown semantic step kind: ${String(step.kind)}`);
  }
  return def;
}
