import { View } from 'react-native';

import { Text } from '@/core/ui/Text';
import { Sprout } from '@/core/ui/illustrations/Sprout';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing } from '@/core/theme/designTokens';

/**
 * Command Center prompt (P19, docs/ui-ux/16-playful-momentum.md §7 "Command
 * Center" — ref Brilliant's speech-bubble recommendation `08`).
 *
 * Sprout in the `think` pose says what the field is for, in one speech bubble
 * above the input. The bubble is `depth.card` (§5.7: 2px ring + 4px
 * `borderStrong` bottom lip) so it reads as a pressable-adjacent object without
 * being interactive. The mascot is decorative (§5.9) — the sentence carries the
 * meaning, so no accessible name changes anywhere; the bubble text is plain
 * static copy and sits on the theme's own surface, which keeps it AA in every
 * appearance (`validate:themes` owns the token pairs).
 *
 * One appearance per screen (§4 rule 7): the Command Center renders this and
 * nothing else mascot-shaped.
 */
export function CommandPrompt({ message }: { message: string }) {
  const { tokens } = useAppTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.sm,
        marginBottom: spacing.md,
      }}
    >
      <View pointerEvents="none" style={{ marginBottom: -spacing.xs }}>
        <Sprout pose="think" size={56} />
      </View>
      <View
        style={{
          flexShrink: 1,
          backgroundColor: tokens.surfaceElevated,
          borderWidth: 2,
          borderColor: tokens.border,
          borderBottomWidth: 4,
          borderBottomColor: tokens.borderStrong,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <Text variant="bodyMd" style={{ color: tokens.text }}>
          {message}
        </Text>
      </View>
    </View>
  );
}
