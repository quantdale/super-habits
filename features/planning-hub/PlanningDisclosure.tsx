import { Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing } from '@/core/theme/designTokens';
import { planningRowVisual } from '@/features/planning-hub/planningHub.visual';

/**
 * Quiet secondary disclosure (Playful Momentum §6 "one primary per state").
 *
 * A planning screen owns exactly ONE loud action per step/view, so expand
 * toggles (`Today's briefing`, `All numbers`, `Past reviews`, `Options`) render
 * as the §6 *secondary button* in its flat form: theme surface face, a 2px
 * outline floored to the 3:1 component boundary, a 2px `borderStrong` lip band
 * (static, no press travel — `depth.lip.sm`), a leading state glyph and a
 * trailing chevron. The target is ≥44pt and the expanded state is announced
 * (`accessibilityState.expanded` + the web `aria-expanded`).
 *
 * Why not `Pressable3D` here: `Pressable3D` owns the press animation but does
 * not forward `aria-expanded`, and every one of these controls is asserted on
 * that DOM attribute by the existing specs (`planning-w11`, `weekly-review`).
 * The depth is painted statically instead (outer lip band + face), which is the
 * same visual at rest and keeps the accessibility contract exact.
 */
export type PlanningDisclosureProps = {
  /** Visible label (may carry a −/+ suffix, per the specs). */
  label: string;
  /** Accessible name — defaults to `label`. */
  accessibilityLabel?: string;
  expanded: boolean;
  onPress: () => void;
  /** Leading glyph (status/topic), 20px. */
  icon?: keyof typeof MaterialIcons.glyphMap;
  /** Renders the trailing chevron (default true). */
  showChevron?: boolean;
  className?: string;
};

export function PlanningDisclosure({
  label,
  accessibilityLabel,
  expanded,
  onPress,
  icon,
  showChevron = true,
  className,
}: PlanningDisclosureProps) {
  const { tokens, resolvedTheme } = useAppTheme();
  const row = planningRowVisual({
    tone: 'sky',
    selected: false,
    appearance: resolvedTheme,
    surface: tokens.surface,
    border: tokens.border,
    borderStrong: tokens.borderStrong,
    text: tokens.text,
    textMuted: tokens.textMuted,
  });

  return (
    <View
      className={['self-start', className].filter(Boolean).join(' ')}
      style={{ borderRadius: radius.sm, backgroundColor: row.lip }}
    >
      <View style={{ marginBottom: 2, borderRadius: radius.sm, backgroundColor: row.face }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ expanded }}
          aria-expanded={expanded}
          onPress={onPress}
          style={{
            minHeight: 44,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.sm,
            borderWidth: 2,
            borderColor: row.border,
          }}
        >
          {icon ? <MaterialIcons name={icon} size={20} color={row.mark} /> : null}
          <Text variant="bodyMd" style={{ color: row.ink, fontWeight: '700' }}>
            {label}
          </Text>
          {showChevron ? (
            <MaterialIcons
              name={expanded ? 'expand-less' : 'expand-more'}
              size={20}
              color={row.mark}
            />
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}
