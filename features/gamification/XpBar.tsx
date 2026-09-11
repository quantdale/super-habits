import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useReducedMotion } from '@/core/theme/motion';

export type XpBarProps = {
  /** 0..1 fill. */
  progress: number;
  color: string;
  trackColor: string;
  height?: number;
  durationMs?: number;
  accessibilityLabel?: string;
};

/**
 * XP progress bar. Width-animated from the previous value so an XP award is
 * visible as movement; reduced motion snaps to the new value.
 */
export function XpBar({
  progress,
  color,
  trackColor,
  height = 10,
  durationMs = 550,
  accessibilityLabel,
}: XpBarProps) {
  const reducedMotion = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  // A lazily-created animated value: state keeps it stable for the component's
  // lifetime without reading a ref during render.
  const [animated] = useState(() => new Animated.Value(clamped));
  // Animation is reserved for a *change*: sweeping from zero at mount costs JS
  // frames on every cold start and reads as noise rather than progress.
  const lastTarget = useRef(clamped);

  useEffect(() => {
    if (lastTarget.current === clamped) {
      animated.setValue(clamped);
      return;
    }
    lastTarget.current = clamped;
    if (reducedMotion || durationMs <= 0) {
      animated.setValue(clamped);
      return;
    }
    const animation = Animated.timing(animated, {
      toValue: clamped,
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animated, clamped, durationMs, reducedMotion]);

  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: trackColor,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color,
          width: animated.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}
