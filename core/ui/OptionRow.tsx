import type { ReactNode } from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Text } from '@/core/ui/Text';
import { Pressable3D } from '@/core/ui/Pressable3D';
import { useAppTheme } from '@/core/providers/themeContext';
import { readableAccent, tintOver } from '@/core/theme/contrast';
import { radius, spacing } from '@/core/theme/designTokens';

type OptionRowProps = {
  label: string;
  /** Secondary line under the title (e.g. a preset's details). */
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** Section solid for the selected face/border/lip (§6); defaults to `primary`. */
  accentColor?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
  /** Optional trailing content (e.g. a live preview slot). */
  children?: ReactNode;
};

/**
 * OptionRow — the Duolingo "goal commit" row (Playful Momentum §6): full-width
 * 56px, radius 16, white face + 2px border + 3px lip riding `Pressable3D`.
 * Selected = section tint face, 2px section-solid border, solid-color lip, and
 * a trailing check badge. For theme, preset, quick-capture type, routine pick
 * and meal pick surfaces.
 *
 * Accessibility: a `radio` in a picker group with
 * `accessibilityState.selected` (plus `aria-checked` — this react-native-web
 * version does not map `accessibilityState` to the DOM). The check badge is
 * decorative; the accessible name is the label.
 */
export function OptionRow({
  label,
  description,
  selected,
  onPress,
  accentColor,
  accessibilityLabel,
  disabled = false,
  testID,
  children,
}: OptionRowProps) {
  const { tokens, resolvedTheme } = useAppTheme();
  const accent = accentColor ?? tokens.primary;
  // §5.1 tint: hue mixed 14% into white (light) / 18% into the dark face.
  const tintBase = resolvedTheme === 'dark' ? '#1A1F2B' : '#FFFFFF';
  const selectedFace = tintOver(tintBase, accent, resolvedTheme === 'dark' ? 0.18 : 0.14);
  const selectedInk = readableAccent(accent, selectedFace);

  return (
    <Pressable3D
      lip={3}
      faceColor={selected ? selectedFace : tokens.surface}
      lipColor={selected ? accent : tokens.borderStrong}
      radius={radius.md}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      aria-checked={selected}
      faceStyle={{
        borderWidth: 2,
        borderColor: selected ? accent : tokens.border,
        opacity: disabled ? 0.6 : 1,
      }}
      contentStyle={{
        minHeight: 56,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          variant="bodyMd"
          style={{ color: selected ? selectedInk : tokens.text, fontWeight: '700' }}
        >
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {children}
      {selected ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            width: 24,
            height: 24,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accent,
          }}
        >
          <MaterialIcons name="check" size={16} color={tokens.onSolid} />
        </View>
      ) : null}
    </Pressable3D>
  );
}
