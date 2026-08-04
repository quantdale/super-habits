/**
 * Behavior engine (`add-user-simulation-platform` task 2.4, design D4).
 *
 * The engine turns a scenario's ordered semantic steps + a persona's behavior
 * params + a run mode into the **resolved action plan** the runner executes:
 * for every step, the think time to wait before it and any injection to apply,
 * plus a flat injection log. Pure and unit-testable — no browser, no I/O.
 *
 * Mode handling:
 * - `deterministic` — seed fixed (informative, reused for replay bookkeeping),
 *   injectors OFF (zero injections), every step waits the fixed
 *   `DEFAULT_THINK_TIME_MS` (or the `waitThinkTime.ms` the author set). This is
 *   the only mode allowed in gating lanes.
 * - `seeded` — think times sampled per step from the persona's clamped
 *   log-normal via the seeded rng; each step first passes the persona's overall
 *   `mistakeRate` gate, then eligible injectors decide on their own rates (first
 *   firing injector wins, at most one injection per step). Same seed → identical
 *   plan.
 * - `exploratory` — the AI lane owns execution; the engine is inactive and
 *   throws a clear error rather than pretending to plan.
 */

import type { BehaviorParams, RunMode, SemanticStep } from '../model/types';
import { createInjectors, type InjectorContext, type StepLogEntry } from './injectors';
import { createSeededRng, type SeededRng } from './rng';
import { createThinkTimeSampler, DEFAULT_THINK_TIME_MS } from './thinkTime';

/** Options for building a run plan. */
export interface EngineOptions {
  /** Execution lane behavior mode (design D4). */
  mode: RunMode;
  /** Run seed. Used for all sampling in `seeded` mode; recorded for replay. */
  seed: number;
  /**
   * Fixed think time (ms) for `deterministic` mode. Defaults to
   * `DEFAULT_THINK_TIME_MS`; a `waitThinkTime.ms` explicit value wins over this.
   */
  deterministicThinkTimeMs?: number;
}

/** One resolved step in the action plan. */
export interface ResolvedStep {
  /** Index into the original scenario `steps` array. */
  stepIndex: number;
  /** The step itself (unchanged; the runner executes it). */
  step: SemanticStep;
  /** Think time (ms) the driver waits before executing this step. */
  thinkTimeMs: number;
  /** The injection applied to this step, or `null`. */
  injection: StepLogEntry | null;
}

/** The full resolved action plan for a run. */
export interface RunPlan {
  /** Mode the plan was produced for. */
  mode: RunMode;
  /** Seed the plan was produced with. */
  seed: number;
  /** The ordered, resolved steps (think times + injections interleaved). */
  steps: ResolvedStep[];
  /** Flat injection log across the whole plan (also embedded per-step). */
  injectionLog: StepLogEntry[];
}

/**
 * Build the resolved action plan for `steps` under `behavior` in `options.mode`.
 * Pure: the only "effect" is consuming draws from the per-run seed.
 *
 * Throws for `exploratory` mode — the AI lane owns that execution path and the
 * engine is intentionally inactive there.
 */
export function buildRunPlan(
  steps: SemanticStep[],
  behavior: BehaviorParams,
  options: EngineOptions,
): RunPlan {
  if (options.mode === 'exploratory') {
    throw new Error(
      'exploratory mode is executed by the AI lane, not the behavior engine; ' +
        'use deterministic (gating) or seeded (variability) mode instead',
    );
  }

  const deterministic = options.mode === 'deterministic';
  const seed = options.seed >>> 0; // normalize for replay bookkeeping
  const rng: SeededRng = createSeededRng(seed);
  const sampler = createThinkTimeSampler(behavior.thinkTime);
  const injectors = createInjectors();
  const fixedThinkTimeMs = options.deterministicThinkTimeMs ?? DEFAULT_THINK_TIME_MS;

  const resolvedSteps: ResolvedStep[] = [];
  const injectionLog: StepLogEntry[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // --- think time: explicit waitThinkTime.ms wins everywhere; otherwise the
    //     fixed value in deterministic mode, a sampled one in seeded mode. ---
    let thinkTimeMs: number;
    if (step.kind === 'waitThinkTime' && step.ms !== undefined) {
      thinkTimeMs = step.ms;
    } else if (deterministic) {
      thinkTimeMs = fixedThinkTimeMs;
    } else {
      thinkTimeMs = sampler.sample(rng);
    }

    // --- injections: off in deterministic mode; in seeded mode gate each step
    //     on the persona's overall mistake rate, then let eligible injectors
    //     decide on their own rates (first firing injector wins). ---
    let injection: StepLogEntry | null = null;
    if (!deterministic) {
      const context: InjectorContext = { step, stepIndex: i, behavior };
      if (rng.chance(behavior.mistakeRate)) {
        for (const injector of injectors) {
          if (!injector.appliesTo(step)) continue;
          const entry = injector.decide(context, rng);
          if (entry !== null) {
            injection = entry;
            break;
          }
        }
      }
    }
    if (injection !== null) {
      injectionLog.push(injection);
    }

    resolvedSteps.push({ stepIndex: i, step, thinkTimeMs, injection });
  }

  return { mode: options.mode, seed, steps: resolvedSteps, injectionLog };
}
