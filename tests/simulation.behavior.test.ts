import { describe, expect, it } from 'vitest';
import { defaultBehaviorParams } from '../simulation/model/builders';
import type { BehaviorParams, SemanticStep } from '../simulation/model/types';
import { buildRunPlan } from '../simulation/behavior/engine';
import { createInjectors } from '../simulation/behavior/injectors';
import { createSeededRng } from '../simulation/behavior/rng';
import { createThinkTimeSampler, DEFAULT_THINK_TIME_MS } from '../simulation/behavior/thinkTime';

/* ------------------------------------------------------------------ */
/* Fixtures                                                             */
/* ------------------------------------------------------------------ */

/** A long, injector-eligible action sequence (TYPICAL-style, no oracles needed). */
function actionSteps(n = 20): SemanticStep[] {
  const steps: SemanticStep[] = [];
  for (let i = 0; i < n; i++) {
    steps.push({ kind: 'createTodo', title: `todo ${i}` });
    steps.push({ kind: 'switchSection', tab: 'habits' });
    steps.push({ kind: 'createHabit', name: `habit ${i}` });
  }
  return steps;
}

/** High-mistake behavior: every gate and every own-rate fires on its own. */
function highMistakeBehavior(): BehaviorParams {
  const b = defaultBehaviorParams();
  b.mistakeRate = 1;
  b.doubleTapRate = 1;
  b.typoRate = 1;
  b.abandonmentRate = 1;
  b.offlineToggleRate = 1;
  b.tabHideRate = 1;
  return b;
}

/** A wide-±-clamp log-normal so sampling frequently lands outside raw bounds. */
function wideThinkTime(): BehaviorParams['thinkTime'] {
  return { mu: 2, sigma: 1.5, minMs: 10, maxMs: 10000 };
}

/* ------------------------------------------------------------------ */
/* Seeded RNG                                                           */
/* ------------------------------------------------------------------ */

describe('createSeededRng', () => {
  it('is deterministic for the same seed and differs across seeds', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const c = createSeededRng(7);
    const a1 = a.next();
    const a2 = a.next();
    expect(b.next()).toBe(a1);
    expect(b.next()).toBe(a2);
    expect(c.next()).not.toBe(a1);
  });

  it('next() stays in [0, 1)', () => {
    const rng = createSeededRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('chance(p) honors p approximately (0 and 1 are exact)', () => {
    const rng = createSeededRng(1);
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('logNormal shapes a sample around the target median', () => {
    const rng = createSeededRng(5);
    const mu = 6.5;
    const sigma = 0.5;
    const samples: number[] = [];
    for (let i = 0; i < 2000; i++) samples.push(rng.logNormal(mu, sigma));
    const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
    const median = Math.exp(mu);
    // Log-normal sample mean ≈ exp(mu + sigma^2/2) = ~854ms; allow a loose tolerance.
    expect(mean).toBeGreaterThan(median * 0.8);
    expect(mean).toBeLessThan(median * 1.4);
  });
});

/* ------------------------------------------------------------------ */
/* Think time                                                           */
/* ------------------------------------------------------------------ */

describe('createThinkTimeSampler', () => {
  it('samples within the clamps', () => {
    const sampler = createThinkTimeSampler(wideThinkTime());
    const rng = createSeededRng(99);
    for (let i = 0; i < 2000; i++) {
      const ms = sampler.sample(rng);
      expect(ms).toBeGreaterThanOrEqual(10);
      expect(ms).toBeLessThanOrEqual(10000);
    }
  });

  it('returns the fixed deterministic value regardless of sampling', () => {
    const sampler = createThinkTimeSampler(wideThinkTime());
    expect(sampler.fixed()).toBe(DEFAULT_THINK_TIME_MS);
    expect(sampler.fixed()).toBe(DEFAULT_THINK_TIME_MS);
  });

  it('returns the contract value when minMs === maxMs', () => {
    const sampler = createThinkTimeSampler({ mu: 6, sigma: 0.5, minMs: 500, maxMs: 500 });
    const rng = createSeededRng(1);
    for (let i = 0; i < 50; i++) expect(sampler.sample(rng)).toBe(500);
  });
});

/* ------------------------------------------------------------------ */
/* Injectors                                                           */
/* ------------------------------------------------------------------ */

describe('createInjectors', () => {
  it('declares the five bounded kinds', () => {
    const kinds = createInjectors().map((i) => i.kind);
    expect(kinds).toEqual([
      'double-tap',
      'typo-correction',
      'abandonment',
      'offline-toggle',
      'tab-hide',
    ]);
  });

  it('never applies to a step outside its eligibility set', () => {
    const injectors = createInjectors();
    const switchStep: SemanticStep = { kind: 'switchSection', tab: 'todos' };
    for (const inj of injectors) {
      expect(inj.appliesTo(switchStep)).toBe(false);
    }
  });

  it('tab-hide only applies to a running timer (startPomodoro)', () => {
    const injectors = createInjectors();
    const tabHide = injectors.find((i) => i.kind === 'tab-hide')!;
    expect(tabHide.appliesTo({ kind: 'startPomodoro' })).toBe(true);
    expect(tabHide.appliesTo({ kind: 'createTodo', title: 'x' })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Engine                                                               */
/* ------------------------------------------------------------------ */

describe('buildRunPlan — determinism', () => {
  it('same seed → identical action plan', () => {
    const behavior = highMistakeBehavior();
    behavior.thinkTime = wideThinkTime();
    const steps = actionSteps(8);
    const a = buildRunPlan(steps, behavior, { mode: 'seeded', seed: 12345 });
    const b = buildRunPlan(steps, behavior, { mode: 'seeded', seed: 12345 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seed → different plan (over a long sequence)', () => {
    const behavior = highMistakeBehavior();
    behavior.thinkTime = wideThinkTime();
    const steps = actionSteps(12);
    const a = buildRunPlan(steps, behavior, { mode: 'seeded', seed: 111 });
    const b = buildRunPlan(steps, behavior, { mode: 'seeded', seed: 222 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe('buildRunPlan — deterministic mode', () => {
  it('emits zero injections regardless of persona rates', () => {
    const behavior = highMistakeBehavior();
    const steps = actionSteps(10);
    const plan = buildRunPlan(steps, behavior, { mode: 'deterministic', seed: 1 });
    expect(plan.injectionLog).toHaveLength(0);
    for (const s of plan.steps) expect(s.injection).toBeNull();
  });

  it('uses the fixed think time for every step', () => {
    const behavior = highMistakeBehavior();
    const steps = actionSteps(3);
    const plan = buildRunPlan(steps, behavior, { mode: 'deterministic', seed: 1 });
    for (const s of plan.steps) expect(s.thinkTimeMs).toBe(DEFAULT_THINK_TIME_MS);
  });

  it('honors an explicit waitThinkTime.ms over the fixed default', () => {
    const behavior = defaultBehaviorParams();
    const steps: SemanticStep[] = [
      { kind: 'waitThinkTime', ms: 250 },
      { kind: 'switchSection', tab: 'todos' },
    ];
    const plan = buildRunPlan(steps, behavior, { mode: 'deterministic', seed: 1 });
    expect(plan.steps[0].thinkTimeMs).toBe(250);
    expect(plan.steps[1].thinkTimeMs).toBe(DEFAULT_THINK_TIME_MS);
  });
});

describe('buildRunPlan — personas respect rates', () => {
  it('a 0-rate persona never injects, even in seeded mode', () => {
    const behavior = defaultBehaviorParams(); // all rates 0
    const steps = actionSteps(15);
    const plan = buildRunPlan(steps, behavior, { mode: 'seeded', seed: 777 });
    expect(plan.injectionLog).toHaveLength(0);
    for (const s of plan.steps) expect(s.injection).toBeNull();
  });

  it('high-rate seeded runs inject at least once over a long sequence', () => {
    const behavior = highMistakeBehavior();
    const steps = actionSteps(20);
    const plan = buildRunPlan(steps, behavior, { mode: 'seeded', seed: 777 });
    expect(plan.injectionLog.length).toBeGreaterThan(0);
  });

  it('parked specific rates suppress their injector even under a high mistake gate', () => {
    const behavior = highMistakeBehavior();
    behavior.doubleTapRate = 0;
    behavior.typoRate = 0;
    behavior.abandonmentRate = 0;
    behavior.offlineToggleRate = 0;
    // Only tab-hide survives, but none of the steps are startPomodoro here.
    const steps = actionSteps(10);
    const plan = buildRunPlan(steps, behavior, { mode: 'seeded', seed: 5 });
    expect(plan.injectionLog).toHaveLength(0);
  });

  it('records each injection in the flat log with a step index and description', () => {
    const behavior = highMistakeBehavior();
    const steps = actionSteps(10);
    const plan = buildRunPlan(steps, behavior, { mode: 'seeded', seed: 5 });
    for (const entry of plan.injectionLog) {
      expect(entry.stepIndex).toBeGreaterThanOrEqual(0);
      expect(entry.stepIndex).toBeLessThan(plan.steps.length);
      expect(entry.description.length).toBeGreaterThan(0);
      expect([
        'double-tap',
        'typo-correction',
        'abandonment',
        'offline-toggle',
        'tab-hide',
      ]).toContain(entry.kind);
      // The per-step injection matches the log entry.
      expect(plan.steps[entry.stepIndex].injection).toEqual(entry);
    }
  });
});

describe('buildRunPlan — think times stay within clamps (seeded)', () => {
  it('every sampled think time is within [minMs, maxMs]', () => {
    const behavior = highMistakeBehavior();
    behavior.thinkTime = wideThinkTime();
    const steps = actionSteps(25);
    const plan = buildRunPlan(steps, behavior, { mode: 'seeded', seed: 42 });
    for (const s of plan.steps) {
      expect(s.thinkTimeMs).toBeGreaterThanOrEqual(10);
      expect(s.thinkTimeMs).toBeLessThanOrEqual(10000);
    }
  });
});

describe('buildRunPlan — exploratory mode', () => {
  it('is handled by the AI lane, not the engine', () => {
    expect(() =>
      buildRunPlan(actionSteps(2), defaultBehaviorParams(), { mode: 'exploratory', seed: 1 }),
    ).toThrow(/exploratory|AI lane/i);
  });
});
