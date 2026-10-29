import { useState } from 'react';
import { Animated, Pressable } from 'react-native';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing, springs, typography } from '@/core/theme/designTokens';
import { readableAccent, tintOver } from '@/core/theme/contrast';
import { useReducedMotion } from '@/core/theme/motion';

type Props = {
  label: string;
  accessibilityLabel?: string;
  active: boolean;
  color: string;
  onPress: () => void;
  icon?: React.ReactNode; // optional decorative prefix
};

export type ChipProps = Props;

/**
 * Chip — the v2 compact pill (Playful Momentum §6): radius full, 2px border,
 * `label` type; selected = section tint face + section solid border/text so a
 * selected chip reads as "chosen", not "filled". Inactive = neutral
 * `chipBackground`/`chipBorder` so a row of inactive chips stops competing
 * with content.
 *
 * The visible face stays at the W4.5 touch-contract 40pt minimum (the §6
 * 32px pill cannot shrink below the repo's 44pt hit contract without slop
 * games on web, where `hitSlop` does not expand the DOM hit box).
 *
 * Chips hug their content and never exceed their container width: inside a
 * wrapping row a long label wraps instead of overflowing or truncating
 * (SYS-18), and inside a horizontal scroller the natural width is preserved.
 */
export function Chip({ label, accessibilityLabel, active, color, onPress, icon }: Props) {
  const { tokens, resolvedTheme } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  const settle = (toValue: number) => {
    if (reducedMotion) {
      scale.setValue(toValue);
      return;
    }
    Animated.spring(scale, { toValue, useNativeDriver: true, ...springs.press }).start();
  };

  // §5.1 tint: the hue mixed 14% into white (light) / 18% into the dark card
  // face; the selected label is the solid, contrast-guaranteed on that tint.
  const tintBase = resolvedTheme === 'dark' ? '#1A1F2B' : '#FFFFFF';
  const activeBackground = tintOver(tintBase, color, resolvedTheme === 'dark' ? 0.18 : 0.14);
  const activeInk = readableAccent(color, activeBackground);

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
        // W13: `accessibilityState` is not mapped to the DOM by this
        // react-native-web version, so the chip's selected state was invisible
        // to web assistive tech and to tests. `aria-pressed` is the attribute
        // the rest of the app already uses for a toggle-style control
        // (HabitDayStrip / HabitEditorChoice); the chip is a toggle, so it sets
        // it directly instead of relying on the unmapped state object.
        aria-pressed={active}
        hitSlop={{ top: 2, bottom: 2 }}
        style={{
          borderRadius: radius.full,
          borderWidth: 2,
          paddingHorizontal: spacing.md + 2,
          paddingVertical: spacing.xs + 2,
          minHeight: 40,
          maxWidth: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          backgroundColor: active ? activeBackground : tokens.chipBackground,
          borderColor: active ? color : tokens.chipBorder,
        }}
      >
        {icon ? (
          <Text style={{ ...typography.label, color: active ? activeInk : tokens.textMuted }}>
            {icon}
          </Text>
        ) : null}
        <Text variant="label" style={{ color: active ? activeInk : tokens.text }}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** Back-compat alias: callers keep importing `PillChip` unchanged. */
export const PillChip = Chip;
