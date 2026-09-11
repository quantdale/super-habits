import { useEffect, useState, type ReactNode } from 'react';
import { Animated } from 'react-native';
import { springs } from '@/core/theme/designTokens';
import { useReducedMotion } from '@/core/theme/motion';

/** Pop list entrance: rows fade/slide in, staggered ~40ms, motion-safe. */
export function StaggerItem({ index, children }: { index: number; children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(reducedMotion ? 0 : 16));

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    Animated.sequence([
      Animated.delay(Math.min(index, 12) * 40),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, ...springs.enter }),
      ]),
    ]).start();
  }, [index, opacity, reducedMotion, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}
