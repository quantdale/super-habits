/**
 * Per-persona clamped log-normal think-time sampler
 * (`add-user-simulation-platform` task 2.2, design D4).
 *
 * Think time is the delay the *driver* waits before executing a step — the
 * parent change's `clock.ts` controls app-visible time, while think time only
 * paces the driver, so it never advances the app's internal clock.
 *
 * Per `ThinkTimeParams`, `ln(ms)` is drawn from `N(mu, sigma)` and the result is
 * clamped to `[minMs, maxMs]`. `deterministic` mode ignores the sampler and
 * returns the fixed per-step value `DEFAULT_THINK_TIME_MS` (the median of the
 * default distribution, ≈665ms), so gating lanes never depend on sampling.
 */

import { DEFAULT_THINK_TIME } from '../model/builders';
import type { ThinkTimeParams } from '../model/types';
import type { SeededRng } from './rng';

/**
 * Fixed think time (ms) used in `deterministic` mode: the median of the default
 * log-normal (`exp(mu)` = exp(6.5) ≈ 665ms). Stable across runs and personas,
 * which is what a gating lane needs.
 */
export const DEFAULT_THINK_TIME_MS: number = Math.round(Math.exp(DEFAULT_THINK_TIME.mu));

/** Think-time decisions for one step (see `createThinkTimeSampler`). */
export interface ThinkTimeSampler {
  /**
   * Sample one clamped think time in ms for a `seeded` run. Draws from the
   * caller-provided rng; the same rng sequence yields the same samples.
   */
  sample(rng: SeededRng): number;
  /** The fixed per-step value used in `deterministic` mode. */
  fixed(): number;
}

/**
 * Build a sampler from a persona's think-time distribution. `params` is assumed
 * to be validated (`minMs >= 0`, `maxMs >= minMs`, `sigma >= 0` — see
 * `validate.ts`), but clamps defensively anyway.
 */
export function createThinkTimeSampler(params: ThinkTimeParams): ThinkTimeSampler {
  const clamp = (ms: number): number => {
    if (ms < params.minMs) return params.minMs;
    if (ms > params.maxMs) return params.maxMs;
    return ms;
  };

  return {
    sample(rng) {
      const ms = rng.logNormal(params.mu, params.sigma);
      return Math.round(clamp(ms));
    },
    fixed() {
      return DEFAULT_THINK_TIME_MS;
    },
  };
}
