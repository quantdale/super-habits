/**
 * Typed builders for the simulation model (design D2).
 *
 * `definePersona`, `defineWorkflow`, and `defineScenario` give sensible defaults
 * so a model author writes only the intent-bearing fields. Models are validated
 * at load by `validateSimulationModel` (see `validate.ts`); the builders do NOT
 * attribute oracles for the author — a mutating step left without an oracle is
 * caught by validation, not silently patched here.
 */

import type {
  BehaviorParams,
  Persona,
  Scenario,
  SemanticStep,
  SimulationModel,
  Workflow,
  WorkflowRef,
} from './types';

/** Default clamped log-normal think-time distribution (≈660ms median). */
export const DEFAULT_THINK_TIME = {
  mu: 6.5, // ln(660) ≈ 6.49
  sigma: 0.5,
  minMs: 100,
  maxMs: 5000,
} as const;

/** Default session-length profile (5–30 minutes). */
export const DEFAULT_SESSION_LENGTH = { minMinutes: 5, maxMinutes: 30 } as const;

/** A fully deterministic, "no mistakes" behavior profile — the default. */
export const DEFAULT_BEHAVIOR_PARAMS: BehaviorParams = {
  thinkTime: { ...DEFAULT_THINK_TIME },
  mistakeRate: 0,
  doubleTapRate: 0,
  typoRate: 0,
  abandonmentRate: 0,
  offlineToggleRate: 0,
  tabHideRate: 0,
  sessionLength: { ...DEFAULT_SESSION_LENGTH },
  featureAffinity: {},
};

/** Build a deep copy of the default behavior params (callers may mutate). */
export function defaultBehaviorParams(): BehaviorParams {
  return {
    thinkTime: { ...DEFAULT_THINK_TIME },
    mistakeRate: 0,
    doubleTapRate: 0,
    typoRate: 0,
    abandonmentRate: 0,
    offlineToggleRate: 0,
    tabHideRate: 0,
    sessionLength: { ...DEFAULT_SESSION_LENGTH },
    featureAffinity: {},
  };
}

/** Shallow-merge a partial behavior override over the defaults. */
function mergeBehavior(behavior?: Partial<BehaviorParams>): BehaviorParams {
  const base = defaultBehaviorParams();
  if (!behavior) return base;
  return {
    ...base,
    ...behavior,
    thinkTime: { ...base.thinkTime, ...behavior.thinkTime },
    sessionLength: { ...base.sessionLength, ...behavior.sessionLength },
    featureAffinity: { ...base.featureAffinity, ...behavior.featureAffinity },
  };
}

/** Input shape for `definePersona`. */
export interface PersonaInput {
  id: string;
  name: string;
  description: string;
  goals: string[];
  behavior?: Partial<BehaviorParams>;
  traits?: string[];
}

/**
 * Define a persona. Behavior defaults to the deterministic "no mistakes"
 * profile; overrides are shallow-merged over those defaults.
 */
export function definePersona(input: PersonaInput): Persona {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    goals: input.goals,
    behavior: mergeBehavior(input.behavior),
    traits: input.traits,
  };
}

/** Input shape for `defineWorkflow`. */
export interface WorkflowInput {
  id: string;
  steps: SemanticStep[];
  parameters?: string[];
  description?: string;
}

/** Define a reusable workflow fragment. */
export function defineWorkflow(input: WorkflowInput): Workflow {
  return {
    id: input.id,
    parameters: input.parameters ?? [],
    steps: input.steps,
    description: input.description,
  };
}

/** Input shape for `defineScenario`. */
export interface ScenarioInput {
  id: string;
  personaId: string;
  goal: string;
  steps: SemanticStep[];
  fixture?: Scenario['fixture'];
  workflows?: WorkflowRef[];
  risks?: string[];
  mode?: Scenario['mode'];
  tags?: string[];
  description?: string;
}

/**
 * Define a scenario. Defaults: `fixture: 'SMALL'`, `mode: 'deterministic'`,
 * empty `workflows`/`risks`/`tags`. Steps are stored as given (oracles are NOT
 * backfilled — validation enforces them).
 */
export function defineScenario(input: ScenarioInput): Scenario {
  return {
    id: input.id,
    personaId: input.personaId,
    goal: input.goal,
    fixture: input.fixture ?? 'SMALL',
    workflows: input.workflows ?? [],
    steps: input.steps,
    risks: input.risks ?? [],
    mode: input.mode ?? 'deterministic',
    tags: input.tags ?? [],
    description: input.description,
  };
}

/** Assemble a full model from its parts. */
export function defineModel(input: {
  personas: Persona[];
  workflows?: Workflow[];
  scenarios: Scenario[];
}): SimulationModel {
  return {
    personas: input.personas,
    workflows: input.workflows ?? [],
    scenarios: input.scenarios,
  };
}
