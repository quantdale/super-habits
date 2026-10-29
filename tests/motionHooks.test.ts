import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * P4 motion foundation contracts (docs/ui-ux/16-playful-momentum.md §5.8):
 *
 * 1. Token sanity — MOTION_V2_DURATION / MOTION_V2_SPRING / MOTION_TIER_PROFILE
 *    pin the brief's values (press 80/120, check spring 12/320, tier budgets).
 * 2. Each core/ui/motion hook's reduced-motion branch is opacity-only over the
 *    120ms cross-fade — no translate/scale, no particles, no sweep.
 * 3. Tier mapping — the `lib/rewardFeedback` tiers map 1:1 onto motion budgets
 *    and useCheckBurst spends only what its tier allows.
 *
 * The vitest unit project is node-environment with no renderer installed, so
 * the hooks are exercised through a minimal hook runtime (mocked react) plus a
 * recording react-native-reanimated mock; the real `useReducedMotion()` from
 * core/theme/motion drives the branch selection via setMotionPreference.
 */

type ReaConfig =
  { duration?: number; easing?: unknown; damping?: number; stiffness?: number } | undefined;

type TimingCall = {
  api: 'withTiming' | 'withSpring';
  toValue: unknown;
  config: ReaConfig;
};

const rea = vi.hoisted(() => {
  const calls: TimingCall[] = [];
  return {
    calls,
    reset() {
      calls.length = 0;
    },
  };
});

const storage = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

/**
 * Minimal hook runtime: a hook call is one "render". useState keeps only its
 * initializer (enough: the reduced-motion branch is selected from the
 * module-level motion preference read at first render), useEffect runs eagerly.
 */
vi.mock('react', () => ({
  useState: (init: unknown) => [
    typeof init === 'function' ? (init as () => unknown)() : init,
    () => {},
  ],
  useEffect: (effect: () => unknown) => {
    effect();
  },
  useCallback: (fn: unknown) => fn,
  useRef: (init: unknown) => ({ current: init }),
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (obj: Record<string, unknown>) => obj['ios'] ?? obj['default'],
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: async () => false,
    addEventListener: () => ({ remove: () => {} }),
  },
}));

vi.mock('react-native-reanimated', () => ({
  useSharedValue: (init: unknown) => ({ value: init }),
  useAnimatedStyle: (fn: () => unknown) => fn(),
  withTiming: (toValue: unknown, config?: ReaConfig, callback?: (f: boolean) => void) => {
    rea.calls.push({ api: 'withTiming', toValue, config });
    if (callback) callback(true);
    return toValue;
  },
  withSpring: (toValue: unknown, config?: ReaConfig) => {
    rea.calls.push({ api: 'withSpring', toValue, config });
    return toValue;
  },
  withSequence: (...steps: unknown[]) => steps[steps.length - 1],
}));

type MotionModule = typeof import('@/core/theme/motion');

async function loadMotion(): Promise<MotionModule> {
  vi.resetModules();
  return await import('@/core/theme/motion');
}

async function withPreference<T>(
  preference: 'reduced' | 'full',
  load: (motion: MotionModule) => Promise<T>,
): Promise<T> {
  const motion = await loadMotion();
  motion.setMotionPreference(preference);
  return load(motion);
}

function timingCalls() {
  return rea.calls.filter((call) => call.api === 'withTiming');
}

function styleKeys(style: unknown): string[] {
  return Object.keys(style ?? {});
}

beforeEach(() => {
  rea.reset();
  storage.store.clear();
  vi.clearAllMocks();
});

describe('v2 motion tokens (§5.8)', () => {
  it('pins the brief durations and check spring', async () => {
    const motion = await loadMotion();

    expect(motion.MOTION_V2_DURATION).toEqual({
      pressDown: 80,
      pressUp: 120,
      reducedFade: 120,
      checkBurst: 400,
      xpFloat: 600,
      progressFill: 450,
      progressSweep: 300,
    });
    expect(motion.MOTION_V2_SPRING.checkBurst).toEqual({ damping: 12, stiffness: 320 });
  });

  it('implements Easing.out(cubic) as plain math', async () => {
    const motion = await loadMotion();

    expect(motion.easeOutCubic(0)).toBe(0);
    expect(motion.easeOutCubic(1)).toBe(1);
    expect(motion.easeOutCubic(0.5)).toBeCloseTo(0.875, 10);
    expect(motion.easeOutCubic(0.25)).toBeCloseTo(1 - 0.75 ** 3, 10);
  });
});

describe('reward tier → motion mapping (lib/rewardFeedback)', () => {
  it('maps every rewardFeedback tier 1:1 to its §5.8 motion budget', async () => {
    const motion = await loadMotion();

    expect(Object.keys(motion.MOTION_TIER_PROFILE).sort()).toEqual([
      'light',
      'milestone',
      'success',
    ]);
    expect(motion.MOTION_TIER_PROFILE.light).toEqual({
      durationMs: 400,
      popScale: 1.2,
      burstCount: 6,
      reducedFadeMs: 120,
    });
    expect(motion.MOTION_TIER_PROFILE.success).toEqual({
      durationMs: 700,
      popScale: 1.2,
      burstCount: 6,
      reducedFadeMs: 120,
    });
    expect(motion.MOTION_TIER_PROFILE.milestone).toEqual({
      durationMs: 2800,
      popScale: 1.2,
      burstCount: 24,
      reducedFadeMs: 120,
    });
  });
});

describe('usePressDepth', () => {
  it('full motion: face travels down by the lip (80ms) and returns (120ms ease-out)', async () => {
    await withPreference('full', async () => {
      const { usePressDepth } = await import('@/core/ui/motion/usePressDepth');
      const press = usePressDepth({ lip: 4 });

      expect(press.reduced).toBe(false);
      expect(styleKeys(press.animatedStyle)).toEqual(['transform']);

      press.onPressIn();
      expect(press.depth.value).toBe(4);
      expect(timingCalls()).toEqual([{ api: 'withTiming', toValue: 4, config: { duration: 80 } }]);

      press.onPressOut();
      expect(press.depth.value).toBe(0);
      expect(timingCalls()[1]).toEqual({
        api: 'withTiming',
        toValue: 0,
        config: { duration: 120, easing: expect.any(Function) },
      });
    });
  });

  it('reduced motion: opacity-only 120ms cross-fade, no translate', async () => {
    await withPreference('reduced', async () => {
      const { usePressDepth, PRESS_DIM_OPACITY } = await import('@/core/ui/motion/usePressDepth');
      const press = usePressDepth({ lip: 4 });

      expect(press.reduced).toBe(true);
      expect(styleKeys(press.animatedStyle)).toEqual(['opacity']);

      press.onPressIn();
      press.onPressOut();
      expect(press.depth.value).toBe(0);
      expect(timingCalls()).toEqual([
        { api: 'withTiming', toValue: PRESS_DIM_OPACITY, config: { duration: 120 } },
        { api: 'withTiming', toValue: 1, config: { duration: 120 } },
      ]);
    });
  });
});

describe('useCheckBurst', () => {
  it('full motion, light tier: pop 1→1.2→1 with the §5.8 spring and a 400ms burst', async () => {
    await withPreference('full', async () => {
      const { useCheckBurst } = await import('@/core/ui/motion/useCheckBurst');
      const check = useCheckBurst();

      expect(check.reduced).toBe(false);
      expect(check.burstCount).toBe(6);
      expect(check.durationMs).toBe(400);
      expect(styleKeys(check.nodeStyle)).toEqual(['transform']);

      check.trigger();
      expect(check.burstProgress.value).toBe(1);
      expect(timingCalls()).toEqual([
        { api: 'withTiming', toValue: 1.2, config: { duration: 200 } },
        { api: 'withTiming', toValue: 1, config: { duration: 400, easing: expect.any(Function) } },
      ]);
      expect(rea.calls).toContainEqual({
        api: 'withSpring',
        toValue: 1,
        config: { damping: 12, stiffness: 320 },
      });
    });
  });

  it('tier mapping: success spends 700ms, milestone bursts 24 confetti', async () => {
    await withPreference('full', async () => {
      const { useCheckBurst } = await import('@/core/ui/motion/useCheckBurst');

      const quest = useCheckBurst({ tier: 'success' });
      expect(quest.burstCount).toBe(6);
      expect(quest.durationMs).toBe(700);
      quest.trigger();
      expect(timingCalls().at(-1)?.config).toEqual({ duration: 700, easing: expect.any(Function) });

      rea.reset();
      const milestone = useCheckBurst({ tier: 'milestone' });
      expect(milestone.burstCount).toBe(24);
      expect(milestone.durationMs).toBe(2800);
      milestone.trigger();
      expect(timingCalls().at(-1)?.config).toEqual({
        duration: 2800,
        easing: expect.any(Function),
      });
    });
  });

  it('reduced motion: opacity-only 120ms cross-fade, no pop and no particles', async () => {
    await withPreference('reduced', async () => {
      const { useCheckBurst } = await import('@/core/ui/motion/useCheckBurst');
      const check = useCheckBurst({ tier: 'milestone' });

      expect(check.reduced).toBe(true);
      expect(check.burstCount).toBe(0);
      expect(styleKeys(check.nodeStyle)).toEqual(['opacity']);

      check.trigger();
      expect(check.scale.value).toBe(1);
      expect(check.burstProgress.value).toBe(0);
      expect(timingCalls()).toEqual([{ api: 'withTiming', toValue: 1, config: { duration: 120 } }]);
      expect(rea.calls.some((call) => call.api === 'withSpring')).toBe(false);
    });
  });
});

describe('useXpFloat', () => {
  it('full motion: rises 24px and fades over 600ms ease-out', async () => {
    await withPreference('full', async () => {
      const { useXpFloat, XP_FLOAT_RISE_PX } = await import('@/core/ui/motion/useXpFloat');
      const float = useXpFloat();

      expect(XP_FLOAT_RISE_PX).toBe(24);
      expect(float.reduced).toBe(false);
      expect(styleKeys(float.floatStyle)).toEqual(['opacity', 'transform']);

      float.trigger();
      expect(float.rise.value).toBe(-24);
      expect(float.opacity.value).toBe(0);
      expect(timingCalls()).toEqual([
        {
          api: 'withTiming',
          toValue: -24,
          config: { duration: 600, easing: expect.any(Function) },
        },
        {
          api: 'withTiming',
          toValue: 0,
          config: { duration: 600, easing: expect.any(Function) },
        },
      ]);
    });
  });

  it('reduced motion: fades out in place over 120ms, no translate', async () => {
    await withPreference('reduced', async () => {
      const { useXpFloat } = await import('@/core/ui/motion/useXpFloat');
      const float = useXpFloat();

      expect(float.reduced).toBe(true);
      expect(styleKeys(float.floatStyle)).toEqual(['opacity']);

      float.trigger();
      expect(float.rise.value).toBe(0);
      expect(timingCalls()).toEqual([{ api: 'withTiming', toValue: 0, config: { duration: 120 } }]);

      // A second award on the same mounted float must start visible again.
      const writes: unknown[] = [];
      let current: unknown = float.opacity.value;
      Object.defineProperty(float.opacity, 'value', {
        configurable: true,
        get: () => current,
        set: (next: unknown) => {
          writes.push(next);
          current = next;
        },
      });
      float.trigger();
      expect(writes[0]).toBe(1);
      expect(writes).toHaveLength(2);
    });
  });
});

describe('useProgressFill', () => {
  it('full motion: fill eases over 450ms and runs one 300ms sweep', async () => {
    await withPreference('full', async () => {
      const { useProgressFill } = await import('@/core/ui/motion/useProgressFill');
      const fill = useProgressFill();

      expect(fill.reduced).toBe(false);

      fill.fillTo(0.5);
      expect(fill.progress.value).toBe(0.5);
      expect(fill.sweepProgress.value).toBe(1);
      expect(timingCalls()).toEqual([
        {
          api: 'withTiming',
          toValue: 0.5,
          config: { duration: 450, easing: expect.any(Function) },
        },
        {
          api: 'withTiming',
          toValue: 1,
          config: { duration: 300, easing: expect.any(Function) },
        },
      ]);

      // Out-of-range fractions clamp; NaN never reaches the bar geometry.
      fill.fillTo(2);
      expect(fill.progress.value).toBe(1);
      fill.fillTo(Number.NaN);
      expect(fill.progress.value).toBe(0);
    });
  });

  it('reduced motion: width snaps, 120ms opacity cross-fade, no sweep', async () => {
    await withPreference('reduced', async () => {
      const { useProgressFill } = await import('@/core/ui/motion/useProgressFill');
      const fill = useProgressFill();

      expect(fill.reduced).toBe(true);

      fill.fillTo(0.5);
      expect(fill.progress.value).toBe(0.5);
      expect(fill.sweepProgress.value).toBe(0);
      expect(timingCalls()).toEqual([{ api: 'withTiming', toValue: 1, config: { duration: 120 } }]);
    });
  });
});
