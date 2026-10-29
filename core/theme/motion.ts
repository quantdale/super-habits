import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createPreferencePrecedenceGuard } from '@/lib/preferencePrecedence';
import type { RewardFeedbackTier } from '@/lib/rewardFeedback';

/**
 * Semantic motion presets ("Warm Momentum" design DNA — docs/ui-ux/02-design-dna.md §10).
 *
 * Durations are guidance, not frame-perfect requirements. Direct-manipulation
 * gestures should track the finger rather than wait on preset timing.
 */

/** Motion duration roles in milliseconds. */
export const MOTION_DURATION = {
  /** Pressed/hover response. */
  instant: 100,
  /** Completion/check/select feedback. */
  feedback: 200,
  /** Sheet/card state change. */
  transition: 280,
  /** Meaningful milestone only. */
  celebration: 450,
} as const;

export type MotionRole = keyof typeof MOTION_DURATION;

/**
 * User motion preference. `system` follows the OS Reduce Motion setting;
 * `reduced` forces reduced motion; `full` allows all motion.
 */
export type MotionPreference = 'system' | 'reduced' | 'full';

const STORAGE_KEY = 'superhabits.motionPreference';

let preference: MotionPreference = 'system';
let hydrated = false;
const listeners = new Set<() => void>();

/** AsyncStorage hydration must never overwrite a newer explicit choice (F-05). */
const preferencePrecedence = createPreferencePrecedenceGuard();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Load the persisted preference once. Exported for the hooks and the
 * preference-precedence contract test; a later explicit choice always wins
 * over an in-flight hydration (F-05).
 */
export function hydrateMotionPreference() {
  if (hydrated) {
    return;
  }
  hydrated = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => {
      if (!preferencePrecedence.shouldApplyPersisted()) return;
      if (stored === 'system' || stored === 'reduced' || stored === 'full') {
        preference = stored;
        notifyListeners();
      }
    })
    .catch(() => {
      // Storage unavailable (e.g. private mode): keep the default.
    });
}

/** Persist and apply the user's motion preference (Settings → Accessibility). */
export function setMotionPreference(next: MotionPreference): void {
  preferencePrecedence.markChoiceMade();
  preference = next;
  notifyListeners();
  AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
    // Preference still applies for this session even if persistence fails.
  });
}

export function getMotionPreference(): MotionPreference {
  return preference;
}

/**
 * True when motion should be reduced: large translations, looping ambient
 * animation, and parallax are replaced by opacity/direct state changes.
 * Feedback information must never depend on this being false.
 */
export function useReducedMotion(): boolean {
  const [observedPreference, setObservedPreference] = useState<MotionPreference>(preference);
  const [systemReduced, setSystemReduced] = useState(false);

  useEffect(() => {
    hydrateMotionPreference();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };

    function listener() {
      setObservedPreference(preference);
    }
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setSystemReduced)
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setSystemReduced,
    );
    return () => subscription.remove();
  }, []);

  if (observedPreference === 'reduced') {
    return true;
  }
  if (observedPreference === 'full') {
    return false;
  }
  return systemReduced;
}

/**
 * Resolve a motion role to a concrete duration. Reduced motion collapses
 * durations to ~0 so state changes remain instant while keeping the same
 * end state; callers must never gate information behind the animation.
 */
export function useMotionDuration(role: MotionRole): number {
  const reduced = useReducedMotion();
  return reduced ? 0 : MOTION_DURATION[role];
}

// ---------------------------------------------------------------------------
// "Playful Momentum" v2 motion tokens (docs/ui-ux/16-playful-momentum.md §5.8).
// P4 motion foundation: durations, springs, easing and the reward-tier map
// consumed by the core/ui/motion hooks. Plain values only — no Reanimated
// import — so this module keeps loading in pure/test contexts.
// ---------------------------------------------------------------------------

/** Duration roles for the v2 motion moments, in milliseconds (§5.8). */
export const MOTION_V2_DURATION = {
  /** Press face-down travel (lip). */
  pressDown: 80,
  /** Press release return. */
  pressUp: 120,
  /** Reduced motion: the single opacity cross-fade duration for every moment. */
  reducedFade: 120,
  /** Check-in pop + burst budget (`light` tier). */
  checkBurst: 400,
  /** "+XP" float rise + fade. */
  xpFloat: 600,
  /** Progress fill transition. */
  progressFill: 450,
  /** One progress highlight sweep. */
  progressSweep: 300,
} as const;

/** Spring configs for the v2 motion moments (§5.8). */
export const MOTION_V2_SPRING = {
  /** Check node settle after the 1→pop peak: `withSpring` damping 12, stiffness 320. */
  checkBurst: { damping: 12, stiffness: 320 },
} as const;

/**
 * `Easing.out(cubic)` as a plain worklet — usable as a Reanimated `withTiming`
 * easing and unit-testable as ordinary math (1 - (1 - t)³).
 */
export function easeOutCubic(t: number): number {
  'worklet';
  return 1 - Math.pow(1 - t, 3);
}

/** Per-tier motion budget for a reward moment (§5.8 rows). */
export type MotionTierProfile = {
  /** Full-motion budget in milliseconds. */
  durationMs: number;
  /** Peak scale of the check-node pop. */
  popScale: number;
  /** Burst particle count (check burst dots / celebration confetti). */
  burstCount: number;
  /** Reduced-motion opacity cross-fade in milliseconds. */
  reducedFadeMs: number;
};

/**
 * Reward tier → motion mapping (§8): the same `RewardFeedbackTier` that
 * `emitRewardFeedback` consumes selects the motion budget, so the tiers map
 * 1:1 to `light`/`success`/`milestone` and a check-off can never spend a
 * celebration budget. Call sites pass the tier they give `emitRewardFeedback`.
 */
export const MOTION_TIER_PROFILE: Readonly<Record<RewardFeedbackTier, MotionTierProfile>> = {
  // Check-in / todo done (§5.8 row 2): scale 1→1.2→1, 6-dot burst, ≤400ms.
  light: { durationMs: 400, popScale: 1.2, burstCount: 6, reducedFadeMs: 120 },
  // Quest complete (§5.8 row 5): 700ms stamp; burst budget shared with check-in.
  success: { durationMs: 700, popScale: 1.2, burstCount: 6, reducedFadeMs: 120 },
  // Milestone (§5.8 row 7): celebration card, 24 confetti pieces, 2.8s auto-dismiss.
  milestone: { durationMs: 2800, popScale: 1.2, burstCount: 24, reducedFadeMs: 120 },
};
