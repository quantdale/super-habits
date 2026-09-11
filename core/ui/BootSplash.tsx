import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing, typography } from '@/core/theme/designTokens';
import { useReducedMotion } from '@/core/theme/motion';
import { SECTION_COLORS } from '@/constants/sectionColors';

/**
 * Branded boot surface: shown while the display font loads so no screen ever
 * renders in a fallback face on native (where an unloaded family can render
 * invisible text).
 *
 * The pulse is deliberately small: five dots in the section colors, breathing
 * in sequence. It reads as "the app is waking up", not as a spinner.
 */
export function BootSplash() {
  const { tokens } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0));
  const dots = [
    SECTION_COLORS.todos,
    SECTION_COLORS.habits,
    tokens.primary,
    SECTION_COLORS.workout,
    SECTION_COLORS.calories,
  ];

  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="SuperHabits is starting"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.background,
        gap: spacing.xl,
      }}
    >
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Text variant="titleLg" style={{ fontSize: 34, letterSpacing: -0.8 }}>
          SuperHabits
        </Text>
        <Text variant="label" tone="muted">
          TODAY · HABITS · FOCUS · TRAIN · FOOD
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {dots.map((color, index) => {
          const leading = index % 2 === 0;
          return (
            <Animated.View
              key={color}
              style={{
                width: 10,
                height: 10,
                borderRadius: radius.full,
                backgroundColor: color,
                opacity: reducedMotion
                  ? 0.9
                  : pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: leading ? [0.35, 1] : [1, 0.35],
                    }),
                transform: [
                  {
                    scale: reducedMotion
                      ? 1
                      : pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: leading ? [0.85, 1.15] : [1.15, 0.85],
                        }),
                  },
                ],
              }}
            />
          );
        })}
      </View>
      <Text variant="caption" tone="muted" style={{ ...typography.caption }}>
        Offline-first. Your data stays on this device.
      </Text>
    </View>
  );
}
