/**
 * Seeded RNG for the behavior engine (`add-user-simulation-platform` task 2.1).
 *
 * Design D4 requires every stochastic decision in a scenario run — think-time
 * sampling, injector decisions, pacing — to flow through ONE seeded generator,
 * so a recorded seed replays a run bit-for-bit at the action level. This module
 * is a dependency-free mulberry32 PRNG (public domain, 32-bit state, good
 * distribution for a tests/controller hybrid) wrapped in the standard
 * distributions the engine needs. Nothing here imports React, Playwright, or
 * any runtime dependency.
 */

/** The deterministic stream of draws for a run. Every member consumes draws. */
export interface SeededRng {
  /** Uniform float in [0, 1). The primitive draw; all others build on it. */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Bernoulli draw: true with probability `p` (p outside [0,1] is clamped). */
  chance(p: number): boolean;
  /** Uniform pick from a non-empty array (undefined for an empty array). */
  pick<T>(items: readonly T[]): T | undefined;
  /** Standard normal via Box–Muller (consumes 2 draws). */
  normal(): number;
  /** Log-normal: exp(mu + sigma * Z), Z ~ N(0,1). */
  logNormal(mu: number, sigma: number): number;
}

/**
 * Create a fresh deterministic stream from an integer seed. The same seed always
 * produces the same sequence, regardless of caller (subject to the documented
 * distribution draw costs — see the interface doc comments).
 */
export function createSeededRng(seed: number): SeededRng {
  // mulberry32: seed normalized to uint32; the algorithm itself guarantees the
  // per-call mixing, adding the offset only strings it out over seed space.
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const normal = (): number => {
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };

  const clampP = (p: number): number => (p < 0 ? 0 : p > 1 ? 1 : p);

  return {
    next,
    range(min, max) {
      if (max <= min) return min;
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    chance(p) {
      return next() < clampP(p);
    },
    pick<T>(items: readonly T[]): T | undefined {
      if (items.length === 0) return undefined;
      return items[Math.floor(next() * items.length)];
    },
    normal,
    logNormal(mu, sigma) {
      return Math.exp(mu + sigma * normal());
    },
  };
}
