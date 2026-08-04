/**
 * Runner logic unit tests (`add-user-simulation-platform` tasks 3.1/3.5):
 * workflow expansion (order + `{{param}}` binding) and the string→numeric
 * seed mapping the behavior engine consumes (replay determinism).
 */

import { describe, expect, it } from 'vitest';
import { defineModel, defineScenario, defineWorkflow } from '../simulation/model/builders';
import { engineSeedFromString, expandScenarioSteps } from '../simulation/runner/execute';

function modelWithWorkflow() {
  const wf = defineWorkflow({
    id: 'log-breakfast',
    parameters: ['foodName'],
    steps: [{ kind: 'switchSection', tab: 'calories', note: 'before {{foodName}}' }],
  });
  const scenario = defineScenario({
    id: 's1',
    personaId: 'p1',
    goal: 'g',
    workflows: [{ workflowId: 'log-breakfast', params: { foodName: 'Oatmeal' } }],
    steps: [{ kind: 'switchSection', tab: 'overview' }],
  });
  const model = defineModel({
    personas: [
      { id: 'p1', name: 'P', description: 'd', goals: ['g'], behavior: undefined as never },
    ],
    workflows: [wf],
    scenarios: [scenario],
  });
  return { model, scenario, wf };
}

describe('expandScenarioSteps (3.1)', () => {
  it('expands workflows before inline steps, preserving order', () => {
    const { model, scenario, wf } = modelWithWorkflow();
    const steps = expandScenarioSteps(model, scenario);
    expect(steps).toHaveLength(2);
    expect(steps[0].kind).toBe(wf.steps[0].kind);
    expect(steps[1].kind).toBe('switchSection');
    // Binding replaces {{param}} placeholders in string fields:
    expect(steps[0].note).toBe('before Oatmeal');
  });

  it('throws on dangling workflow references', () => {
    const { model, scenario } = modelWithWorkflow();
    scenario.workflows = [{ workflowId: 'missing' }];
    expect(() => expandScenarioSteps(model, scenario)).toThrow(/missing workflow 'missing'/);
  });
});

describe('engineSeedFromString (3.5 replay determinism)', () => {
  it('maps hex-ish seeds directly', () => {
    expect(engineSeedFromString('0x5e1f7e57')).toBe(0x5e1f7e57);
    expect(engineSeedFromString('5e1f7e57')).toBe(0x5e1f7e57);
  });

  it('hashes non-hex labels deterministically', () => {
    const a = engineSeedFromString('deterministic');
    const b = engineSeedFromString('deterministic');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffffffff);
  });

  it('maps null/empty to 0', () => {
    expect(engineSeedFromString(null)).toBe(0);
    expect(engineSeedFromString('')).toBe(0);
  });
});
