import { describe, expect, it } from 'vitest';
import {
  defaultBehaviorParams,
  defineModel,
  definePersona,
  defineScenario,
  defineWorkflow,
} from '../simulation/model/builders';
import {
  isKnownStep,
  isMutatingStep,
  MUTATING_STEPS,
  SEMANTIC_STEP_CATALOG,
  SEMANTIC_STEP_NAMES,
} from '../simulation/model/steps';
import type {
  BehaviorParams,
  Oracle,
  SemanticStep,
  SimulationModel,
} from '../simulation/model/types';
import { validateSimulationModel } from '../simulation/model/validate';

const ROWS_ORACLE: Oracle = {
  kind: 'rows',
  sql: 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
};
const ACROSS_ORACLE: Oracle = { kind: 'across-surfaces', text: '3', tabs: ['overview', 'habits'] };

function validPersona(id = 'daily-driver') {
  return definePersona({
    id,
    name: 'Maya, the Daily Driver',
    description: 'Opens the app 5-10x a day on mobile web.',
    goals: ['track habits daily', 'log meals'],
    behavior: {
      mistakeRate: 0.1,
      thinkTime: { mu: 6.2, sigma: 0.4, minMs: 200, maxMs: 4000 },
      featureAffinity: { todos: 1, habits: 1 },
    },
    traits: ['frequent', 'mobile-web'],
  });
}

function validWorkflow(id = 'log-breakfast') {
  return defineWorkflow({
    id,
    description: 'Log a breakfast meal with macros.',
    parameters: ['food', 'calories'],
    steps: [
      { kind: 'switchSection', tab: 'calories' },
      {
        kind: 'logCalories',
        food: '{{food}}',
        calories: 550,
        mealType: 'breakfast',
        oracles: [ROWS_ORACLE, ACROSS_ORACLE],
      },
    ],
  });
}

function validScenario(id = 'week-of-habits') {
  return defineScenario({
    id,
    personaId: 'daily-driver',
    goal: 'Track habits for a week, logging meals along the way.',
    fixture: 'TYPICAL',
    workflows: [{ workflowId: 'log-breakfast', params: { food: 'Oatmeal', calories: 350 } }],
    steps: [
      { kind: 'switchSection', tab: 'habits' },
      {
        kind: 'tickHabit',
        name: 'Drink water',
        oracles: [ROWS_ORACLE, ACROSS_ORACLE],
      },
      {
        kind: 'createTodo',
        title: 'Buy groceries',
        oracles: [{ kind: 'rows', sql: "SELECT * FROM todos WHERE title = 'Buy groceries'" }],
      },
      { kind: 'advanceClockToNextDay' },
      {
        kind: 'expectAcrossSurfaces',
        text: 'Habits',
        tabs: ['habits', 'overview'],
      },
    ],
    risks: ['R1', 'R5'],
    tags: ['@p0'],
  });
}

function goodModel(): SimulationModel {
  return defineModel({
    personas: [validPersona()],
    workflows: [validWorkflow()],
    scenarios: [validScenario()],
  });
}

function issuesFor(model: SimulationModel): string[] {
  return validateSimulationModel(model).map((i) => i.message);
}

/**
 * Assert `needle` appears in the path or message of at least one validation
 * issue. Paths carry the field names (e.g. `...behavior.mistakeRate`) while
 * messages carry the human explanation — searching both keeps the tests stable.
 */
function hasIssue(model: SimulationModel, needle: string): boolean {
  return validateSimulationModel(model).some(
    (i) => i.path.includes(needle) || i.message.includes(needle),
  );
}

/* ------------------------------------------------------------------------ */
/* Builders: defaults                                                        */
/* ------------------------------------------------------------------------ */

describe('definePersona defaults', () => {
  it('fills a zero-mistake deterministic behavior profile', () => {
    const persona = definePersona({
      id: 'p',
      name: 'P',
      description: 'd',
      goals: ['g'],
    });
    expect(persona.behavior.mistakeRate).toBe(0);
    expect(persona.behavior.doubleTapRate).toBe(0);
    expect(persona.behavior.typoRate).toBe(0);
    expect(persona.behavior.abandonmentRate).toBe(0);
    expect(persona.behavior.offlineToggleRate).toBe(0);
    expect(persona.behavior.tabHideRate).toBe(0);
    expect(persona.behavior.featureAffinity).toEqual({});
    expect(persona.behavior.thinkTime).toEqual(defaultBehaviorParams().thinkTime);
    expect(persona.behavior.sessionLength).toEqual(defaultBehaviorParams().sessionLength);
    expect(persona.traits).toBeUndefined();
  });

  it('deep-merges a partial behavior override over the defaults', () => {
    const persona = definePersona({
      id: 'p',
      name: 'P',
      description: 'd',
      goals: ['g'],
      behavior: {
        mistakeRate: 0.3,
        thinkTime: { ...defaultBehaviorParams().thinkTime, mu: 6.8 },
        featureAffinity: { calories: 2 },
      },
    });
    expect(persona.behavior.mistakeRate).toBe(0.3);
    expect(persona.behavior.doubleTapRate).toBe(0); // untouched default
    expect(persona.behavior.thinkTime.mu).toBe(6.8);
    expect(persona.behavior.thinkTime.minMs).toBe(defaultBehaviorParams().thinkTime.minMs);
    expect(persona.behavior.featureAffinity).toEqual({ calories: 2 });
  });
});

describe('defineScenario defaults', () => {
  it('defaults fixture to SMALL and mode to deterministic', () => {
    const scenario = defineScenario({
      id: 's',
      personaId: 'p',
      goal: 'g',
      steps: [{ kind: 'switchSection', tab: 'todos' }],
    });
    expect(scenario.fixture).toBe('SMALL');
    expect(scenario.mode).toBe('deterministic');
    expect(scenario.workflows).toEqual([]);
    expect(scenario.risks).toEqual([]);
    expect(scenario.tags).toEqual([]);
  });

  it('preserves explicit fields', () => {
    const scenario = defineScenario({
      id: 's',
      personaId: 'p',
      goal: 'g',
      fixture: 'HEAVY',
      mode: 'seeded',
      workflows: [{ workflowId: 'w', params: { a: 1 } }],
      risks: ['R1'],
      tags: ['@p0'],
      steps: [{ kind: 'switchSection', tab: 'overview' }],
    });
    expect(scenario.fixture).toBe('HEAVY');
    expect(scenario.mode).toBe('seeded');
    expect(scenario.workflows?.[0]?.workflowId).toBe('w');
    expect(scenario.risks).toEqual(['R1']);
  });
});

describe('defineWorkflow defaults', () => {
  it('defaults parameters to an empty list', () => {
    const wf = defineWorkflow({ id: 'w', steps: [{ kind: 'switchSection', tab: 'overview' }] });
    expect(wf.parameters).toEqual([]);
    expect(wf.steps).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------------ */
/* Known-good model                                                          */
/* ------------------------------------------------------------------------ */

describe('validateSimulationModel — known-good model', () => {
  it('passes a model with workflows + mutating steps carrying oracles', () => {
    expect(validateSimulationModel(goodModel())).toEqual([]);
  });
});

/* ------------------------------------------------------------------------ */
/* Rule: required fields                                                     */
/* ------------------------------------------------------------------------ */

describe('validation — required fields', () => {
  it('flags a persona missing its name', () => {
    const model = goodModel();
    model.personas[0].name = '';
    expect(issuesFor(model)).toContain('persona requires a non-empty name');
  });

  it('flags a persona with no goals', () => {
    const model = goodModel();
    model.personas[0].goals = [];
    expect(issuesFor(model)).toContain('persona requires at least one goal');
  });

  it('flags a persona without a behavior object', () => {
    const model = goodModel();
    delete (model.personas[0] as { behavior?: BehaviorParams }).behavior;
    expect(issuesFor(model)).toContain('persona requires a behavior object');
  });

  it('flags a scenario missing its goal', () => {
    const model = goodModel();
    model.scenarios[0].goal = '';
    expect(issuesFor(model)).toContain('scenario requires a non-empty goal');
  });

  it('flags a workflow with no steps', () => {
    const model = goodModel();
    if (model.workflows) model.workflows[0].steps = [];
    expect(issuesFor(model)).toContain('must contain at least one step');
  });

  it('flags an unknown step kind', () => {
    const model = goodModel();
    model.scenarios[0].steps = [{ kind: 'fakeStep', oracles: [] } as unknown as SemanticStep];
    expect(issuesFor(model)).toContain('unknown semantic step kind: fakeStep');
  });

  it('flags an unknown oracle kind', () => {
    const model = goodModel();
    model.scenarios[0].steps = [
      { kind: 'expectOracle', oracle: { kind: 'magic' } as unknown as Oracle },
    ];
    expect(issuesFor(model)).toContain('unknown oracle kind: magic');
  });
});

/* ------------------------------------------------------------------------ */
/* Rule: unknown feature / section names                                     */
/* ------------------------------------------------------------------------ */

describe('validation — unknown feature/section names', () => {
  it('flags an unknown feature in feature affinity', () => {
    const model = goodModel();
    model.personas[0].behavior.featureAffinity = { 'not-a-feature': 1 } as never;
    expect(issuesFor(model)).toContain(
      'unknown feature name; known: overview, todos, habits, pomodoro, workout, calories, settings, command',
    );
  });

  it('flags an unknown section in switchSection', () => {
    const model = goodModel();
    model.scenarios[0].steps = [{ kind: 'switchSection', tab: 'database' as never }];
    expect(hasIssue(model, "unknown section 'database'")).toBe(true);
  });

  it('flags an unknown section inside expectAcrossSurfaces tabs', () => {
    const model = goodModel();
    model.scenarios[0].steps = [
      { kind: 'expectAcrossSurfaces', text: 'x', tabs: ['overview', 'nope' as never] },
    ];
    expect(hasIssue(model, "unknown section 'nope'")).toBe(true);
  });

  it('flags expectAcrossSurfaces with fewer than two tabs', () => {
    const model = goodModel();
    model.scenarios[0].steps = [{ kind: 'expectAcrossSurfaces', text: 'x', tabs: ['overview'] }];
    expect(issuesFor(model)).toContain('expectAcrossSurfaces requires >= 2 tabs');
  });
});

/* ------------------------------------------------------------------------ */
/* Rule: out-of-range behavior params                                        */
/* ------------------------------------------------------------------------ */

describe('validation — out-of-range behavior params', () => {
  it('flags a mistake rate above 1', () => {
    const model = goodModel();
    model.personas[0].behavior.mistakeRate = 1.5;
    expect(hasIssue(model, 'mistakeRate')).toBe(true);
  });

  it('flags a negative rate', () => {
    const model = goodModel();
    model.personas[0].behavior.typoRate = -0.1;
    expect(hasIssue(model, 'typoRate')).toBe(true);
  });

  it('flags a negative min think time', () => {
    const model = goodModel();
    model.personas[0].behavior.thinkTime.minMs = -5;
    expect(hasIssue(model, 'thinkTime.minMs')).toBe(true);
  });

  it('flags max think time below min', () => {
    const model = goodModel();
    model.personas[0].behavior.thinkTime = { mu: 6, sigma: 0.5, minMs: 400, maxMs: 100 };
    expect(hasIssue(model, 'thinkTime.maxMs')).toBe(true);
  });

  it('flags negative sigma', () => {
    const model = goodModel();
    model.personas[0].behavior.thinkTime.sigma = -1;
    expect(hasIssue(model, 'thinkTime.sigma')).toBe(true);
  });

  it('flags session length max below min', () => {
    const model = goodModel();
    model.personas[0].behavior.sessionLength = { minMinutes: 30, maxMinutes: 5 };
    expect(hasIssue(model, 'sessionLength.maxMinutes')).toBe(true);
  });
});

/* ------------------------------------------------------------------------ */
/* Rule: oracle-less mutating steps                                          */
/* ------------------------------------------------------------------------ */

describe('validation — every mutating step carries its own oracles', () => {
  it('rejects a mutating step with no oracles', () => {
    const model = goodModel();
    model.scenarios[0].steps = [
      { kind: 'switchSection', tab: 'todos' }, // non-mutating: fine
      { kind: 'createTodo', title: 'X', oracles: [] },
    ];
    const messages = issuesFor(model);
    expect(messages).toContain(
      "mutating step 'createTodo' declares no oracles; every mutating step must carry its own oracles",
    );
  });

  it('rejects a mutating step whose only oracle is an outbox check (no persisted-row/second-surface check)', () => {
    const model = goodModel();
    model.scenarios[0].steps = [
      {
        kind: 'tickHabit',
        name: 'Water',
        oracles: [{ kind: 'outbox', expected: [] }],
      },
    ];
    expect(issuesFor(model)).toContain(
      "mutating step 'tickHabit' lacks a persisted-row or second-surface oracle (rows/across-surfaces)",
    );
  });

  it('accepts a non-mutating step with no oracles', () => {
    const model = goodModel();
    model.scenarios[0].steps = [
      { kind: 'switchSection', tab: 'overview' },
      { kind: 'goOffline' },
      { kind: 'waitThinkTime', ms: 250 },
    ];
    const messages = issuesFor(model);
    expect(messages.filter((m) => m.includes('oracles'))).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------------ */
/* Rule: dangling references                                                 */
/* ------------------------------------------------------------------------ */

describe('validation — dangling references', () => {
  it('rejects a scenario referencing an unknown persona', () => {
    const model = goodModel();
    model.scenarios[0].personaId = 'ghost';
    expect(issuesFor(model)).toContain("dangling persona reference: 'ghost' not found");
  });

  it('rejects a scenario referencing an unknown workflow', () => {
    const model = goodModel();
    model.scenarios[0].workflows = [{ workflowId: 'ghost-workflow' }];
    expect(issuesFor(model)).toContain("dangling workflow reference: 'ghost-workflow' not found");
  });

  it('accepts a scenario whose workflow refs resolve', () => {
    expect(validateSimulationModel(goodModel())).toEqual([]);
  });
});

/* ------------------------------------------------------------------------ */
/* Step catalog integrity                                                    */
/* ------------------------------------------------------------------------ */

describe('semantic step catalog', () => {
  it('contains exactly the task-specified step set, each mapping to a definition', () => {
    const expected: SemanticStep['kind'][] = [
      // navigation
      'switchSection',
      'openSettings',
      'openCommand',
      'commandPreview',
      'commandConfirm',
      'askQuestion',
      // entity actions
      'createTodo',
      'toggleTodo',
      'createHabit',
      'tickHabit',
      'logCalories',
      'buildRoutine',
      'startPomodoro',
      // realism
      'waitThinkTime',
      'maybeMakeMistake',
      'abandonForm',
      // environment
      'goOffline',
      'goOnline',
      'advanceClockToNextDay',
      'injectFailure',
      'reloadApp',
      // verification
      'expectOracle',
      'expectAcrossSurfaces',
      // api
      'apiLeg',
    ];
    expect([...SEMANTIC_STEP_NAMES].sort()).toEqual([...expected].sort());
    for (const name of expected) {
      expect(SEMANTIC_STEP_CATALOG[name]).toBeDefined();
      expect(isKnownStep(name)).toBe(true);
      expect(SEMANTIC_STEP_CATALOG[name].category).toBeTruthy();
    }
  });

  it('declares every entity action, the environment mutators, apiLeg, and only those, as mutating', () => {
    const mutating = new Set([
      'createTodo',
      'toggleTodo',
      'createHabit',
      'tickHabit',
      'logCalories',
      'buildRoutine',
      'startPomodoro',
      'commandConfirm',
      'injectFailure',
      'reloadApp',
      'apiLeg',
    ]);
    for (const name of SEMANTIC_STEP_NAMES) {
      expect(isMutatingStep(name)).toBe(mutating.has(name));
    }
    expect(MUTATING_STEPS.size).toBe(11);
  });

  it('maps every mutating step to the oracle requirement', () => {
    for (const name of SEMANTIC_STEP_NAMES) {
      if (!isMutatingStep(name)) continue;
      const def = SEMANTIC_STEP_CATALOG[name];
      expect(def.mutating).toBe(true);
      // Every mutating step either resolves to a parent helper or carries a
      // note naming the runner-owned interaction that owns it.
      expect(def.parentHelper !== null || !!def.note).toBe(true);
    }
  });

  it('every step with a real parent helper names an actual e2e/helpers function', () => {
    // Sanity: no step claims a helper file that does not exist.
    const helperFiles = new Set([
      'navigation',
      'forms',
      'gestures',
      'clock',
      'failure',
      'oracles',
      'dbHarness',
      'seed',
      'reset',
      'journey',
      'commandObservation',
    ]);
    for (const def of Object.values(SEMANTIC_STEP_CATALOG)) {
      // apiLeg resolves via page.evaluate against the data layer, not a helper file.
      if (def.kind === 'apiLeg') continue;
      if (!def.parentHelper) continue;
      const match = /^([a-zA-Z]+)\./.exec(def.parentHelper);
      if (match) expect(helperFiles.has(match[1])).toBe(true);
    }
  });
});
