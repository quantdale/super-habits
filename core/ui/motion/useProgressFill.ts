import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MOTION_V2_DURATION, easeOutCubic, useReducedMotion } from '@/core/theme/motion';

/**
 * Progress fill (§5.8 "Progress bar fill" row): on each `fillTo` the fill
 * width eases to its new fraction over 450ms (`easeOutCubic`, the brief's
 * `Easing.out(cubic)`) while a single 300ms highlight sweep crosses the bar —
 * one sweep per fill, never a loop (§9 C6: no ambient animation).
 *
 * The consumer maps `progress` to its bar geometry (fillStyle uses a percent
 * width; `sweepStyle` drives the highlight overlay).
 *
 * Reduced motion (§5.8): the width snaps to its new fraction with no easing
 * and the change cross-fades via opacity over 120ms; no sweep is run.
 */

function clampFraction(fraction: number): number {
  'worklet';
  if (Number.isNaN(fraction)) return 0;
  return Math.min(1, Math.max(0, fraction));
}

export function useProgressFill() {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const sweepProgress = useSharedValue(0);
  const opacity = useSharedValue(1);

  const fillTo = (fraction: number) => {
    const next = clampFraction(fraction);
    if (reduced) {
      progress.value = next;
      opacity.value = 0.5;
      opacity.value = withTiming(1, { duration: MOTION_V2_DURATION.reducedFade });
      sweepProgress.value = 0;
      return;
    }
    progress.value = withTiming(next, {
      duration: MOTION_V2_DURATION.progressFill,
      easing: easeOutCubic,
    });
    sweepProgress.value = 0;
    sweepProgress.value = withTiming(1, {
      duration: MOTION_V2_DURATION.progressSweep,
      easing: easeOutCubic,
    });
  };

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(clampFraction(progress.value) * 1000) / 10}%`,
    opacity: opacity.value,
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : 1 - sweepProgress.value,
  }));

  return { fillTo, fillStyle, sweepStyle, progress, sweepProgress, reduced };
}

export type ProgressFill = ReturnType<typeof useProgressFill>;
