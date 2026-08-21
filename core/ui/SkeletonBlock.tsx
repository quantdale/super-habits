import { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { useReducedMotion } from '@/core/theme/motion';

type SkeletonBlockProps = {
  height?: number;
  width?: `${number}%` | number;
  radius?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * First-load placeholder block with a gentle opacity pulse. Under Reduce
 * Motion the pulse is disabled and the block renders statically.
 */
export function SkeletonBlock({
  height = 16,
  width = '100%',
  radius = 8,
  className,
  style,
}: SkeletonBlockProps) {
  const { tokens } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);

  const opacity = reducedMotion
    ? 0.5
    : pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.35, 0.7],
      });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={className}
      style={[
        {
          height,
          width,
          borderRadius: radius,
          backgroundColor: tokens.surfaceElevated,
          opacity,
        },
        style,
      ]}
    />
  );
}
