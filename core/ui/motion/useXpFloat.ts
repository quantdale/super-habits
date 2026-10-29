import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MOTION_V2_DURATION, easeOutCubic, useReducedMotion } from '@/core/theme/motion';

/**
 * "+XP" float (§5.8): the Gold `label` rises 24px and fades out over 600ms,
 * anchored to the control that earned the XP (§4.4 juice follows causality).
 * The label text/color are the consumer's job; this hook owns the motion.
 *
 * Reduced motion (§5.8): no translate — the label fades out in place over
 * 120ms. Information (the XP amount) is never gated behind the animation.
 */

/** Rise distance in px (§5.8: "+10" rises 24px and fades). */
export const XP_FLOAT_RISE_PX = 24;

export function useXpFloat() {
  const reduced = useReducedMotion();
  const rise = useSharedValue(0);
  const opacity = useSharedValue(1);

  const trigger = () => {
    if (reduced) {
      rise.value = 0;
      // Restore visibility first so repeat awards on a mounted float still show.
      opacity.value = 1;
      opacity.value = withTiming(0, { duration: MOTION_V2_DURATION.reducedFade });
      return;
    }
    rise.value = 0;
    opacity.value = 1;
    rise.value = withTiming(-XP_FLOAT_RISE_PX, {
      duration: MOTION_V2_DURATION.xpFloat,
      easing: easeOutCubic,
    });
    opacity.value = withTiming(0, {
      duration: MOTION_V2_DURATION.xpFloat,
      easing: easeOutCubic,
    });
  };

  const floatStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: opacity.value }
      : { opacity: opacity.value, transform: [{ translateY: rise.value }] },
  );

  return { trigger, floatStyle, rise, opacity, reduced };
}

export type XpFloat = ReturnType<typeof useXpFloat>;
