import { useState } from 'react';
import { Animated, Pressable } from 'react-native';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing, springs, typography } from '@/core/theme/designTokens';
import { readableSurface } from '@/core/theme/contrast';
import { useReducedMotion } from '@/core/theme/motion';

type Props = {
  label: string;
  accessibilityLabel?: string;
  active: boolean;
  color: string;
  onPress: () => void;
  icon?: string; // optional emoji or text prefix
};

/**
 * Chip: a compact pill that fills with its accent when selected and settles
 * quickly under the finger. Used for filters, time-of-day pickers, quick
 * presets, and food quick-log chips. V3 quiets the inactive state (neutral
 * surface, hairline border, muted ink) so a row of inactive chips stops
 * competing with content.
 *
 * Chips hug their content and never exceed their container width: inside a
 * wrapping row a long label wraps instead of overflowing or truncating
 * (SYS-18), and inside a horizontal scroller the natural width is preserved.
 */
export function PillChip({ label, accessibilityLabel, active, color, onPress, icon }: Props) {
  const { tokens } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  const settle = (toValue: number) => {
    if (reducedMotion) {
      scale.setValue(toValue);
      return;
    }
    Animated.spring(scale, { toValue, useNativeDriver: true, ...springs.press }).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
        maxWidth: '100%',
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => settle(0.96)}
        onPressOut={() => settle(1)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ selected: active }}
        hitSlop={{ top: 2, bottom: 2 }}
        style={{
          borderRadius: radius.full,
          borderWidth: 1,
          paddingHorizontal: spacing.md + 2,
          paddingVertical: spacing.xs + 2,
          minHeight: 40,
          maxWidth: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          backgroundColor: active ? readableSurface(color, tokens.onSolid) : tokens.surface,
          borderColor: active ? readableSurface(color, tokens.onSolid) : tokens.border,
        }}
      >
        {icon ? (
          <Text style={{ ...typography.label, color: active ? tokens.onSolid : tokens.textMuted }}>
            {icon}
          </Text>
        ) : null}
        <Text
          variant="label"
          style={{ color: active ? tokens.onSolid : tokens.text, fontSize: 13.5 }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
