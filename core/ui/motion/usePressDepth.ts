import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MOTION_V2_DURATION, easeOutCubic, useReducedMotion } from '@/core/theme/motion';

/**
 * Press depth for the v2 "lip" pressable system (§5.7 / §5.8 "Press" row).
 *
 * Full motion: the face travels down by exactly its `lip` in 80ms and returns
 * in 120ms (`easeOutCubic`) — pressed translate = lip, no shadow games.
 * Reduced motion: no translate at all; the pressed state is a 120ms opacity
 * cross-fade (`MOTION_V2_DURATION.reducedFade`).
 *
 * Juice follows causality (§4.4): every animation starts from the pressed
 * shared values, and the handlers do no JS-thread work beyond assigning them —
 * the interpolation itself runs on the UI thread inside the style worklet.
 */

/** Opacity of the pressed face in the reduced-motion branch (§5.8). */
export const PRESS_DIM_OPACITY = 0.85;

export type UsePressDepthOptions = {
  /** Lip depth in px (§5.7): the face travels exactly this far when pressed. */
  lip: number;
};

export function usePressDepth({ lip }: UsePressDepthOptions) {
  const reduced = useReducedMotion();
  const depth = useSharedValue(0);
  const opacity = useSharedValue(1);

  const onPressIn = () => {
    if (reduced) {
      opacity.value = withTiming(PRESS_DIM_OPACITY, {
        duration: MOTION_V2_DURATION.reducedFade,
      });
      return;
    }
    depth.value = withTiming(lip, { duration: MOTION_V2_DURATION.pressDown });
  };

  const onPressOut = () => {
    if (reduced) {
      opacity.value = withTiming(1, { duration: MOTION_V2_DURATION.reducedFade });
      return;
    }
    depth.value = withTiming(0, {
      duration: MOTION_V2_DURATION.pressUp,
      easing: easeOutCubic,
    });
  };

  const animatedStyle = useAnimatedStyle(() =>
    reduced ? { opacity: opacity.value } : { transform: [{ translateY: depth.value }] },
  );

  return { onPressIn, onPressOut, depth, animatedStyle, reduced };
}

export type PressDepth = ReturnType<typeof usePressDepth>;
