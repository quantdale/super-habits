import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { RewardFeedbackTier } from '@/lib/rewardFeedback';
import {
  MOTION_TIER_PROFILE,
  MOTION_V2_DURATION,
  MOTION_V2_SPRING,
  easeOutCubic,
  useReducedMotion,
} from '@/core/theme/motion';

/**
 * Check burst for check-in / todo-done moments (§5.8 `light` row): the check
 * node pops 1→1.2→1 (peak `withTiming`, settle `withSpring` damping 12,
 * stiffness 320) while `burstCount` dots spread outward, all within the tier's
 * motion budget (≤400ms for `light`).
 *
 * The burst geometry belongs to the consuming node (P6 `CheckNode`); this hook
 * owns only the motion state — `scale`, `burstProgress` (0→1, reset at each
 * trigger) and `burstCount` — so particles are pure UI-thread interpolation.
 *
 * The tier maps 1:1 to `lib/rewardFeedback` (`emitRewardFeedback` is still the
 * sole feedback emitter; this hook never triggers haptics or sound).
 * Reduced motion (§5.8): no scale, no particles — the settled state cross-fades
 * in over 120ms and `burstCount` is 0 so nothing translates.
 */

export type UseCheckBurstOptions = {
  /** Reward tier of the triggering action (§5.8); a check-off is `light`. */
  tier?: RewardFeedbackTier;
};

export function useCheckBurst({ tier = 'light' }: UseCheckBurstOptions = {}) {
  const reduced = useReducedMotion();
  const profile = MOTION_TIER_PROFILE[tier];
  const scale = useSharedValue(1);
  const burstProgress = useSharedValue(0);
  const opacity = useSharedValue(1);

  const trigger = () => {
    if (reduced) {
      opacity.value = 0.35;
      opacity.value = withTiming(1, { duration: profile.reducedFadeMs });
      burstProgress.value = 0;
      return;
    }
    scale.value = withSequence(
      withTiming(profile.popScale, { duration: MOTION_V2_DURATION.checkBurst / 2 }),
      withSpring(1, MOTION_V2_SPRING.checkBurst),
    );
    burstProgress.value = 0;
    burstProgress.value = withTiming(1, {
      duration: profile.durationMs,
      easing: easeOutCubic,
    });
  };

  const nodeStyle = useAnimatedStyle(() =>
    reduced ? { opacity: opacity.value } : { transform: [{ scale: scale.value }] },
  );

  const burstStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : 1 - burstProgress.value,
  }));

  return {
    trigger,
    nodeStyle,
    burstStyle,
    scale,
    burstProgress,
    /** Dots the consumer should render; 0 under reduced motion. */
    burstCount: reduced ? 0 : profile.burstCount,
    /** Full-motion budget for the moment (ms). */
    durationMs: profile.durationMs,
    reduced,
  };
}

export type CheckBurst = ReturnType<typeof useCheckBurst>;
