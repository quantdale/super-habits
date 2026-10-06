import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { useAppNavigation } from '@/core/providers/navigationContext';
import { useAppTheme } from '@/core/providers/themeContext';
import { Text } from '@/core/ui/Text';
import { radius, spacing } from '@/core/theme/designTokens';
import { readableSurface } from '@/core/theme/contrast';

import type { NextBestAction } from './overview.domain';
import { OVERVIEW_CARD_META } from './overviewCards';
import { openCardTarget } from './cards/DashboardCard.shared';

/**
 * UP NEXT hero (docs/ui-ux/13 §3: the one hero a screen may own).
 *
 * V3 treatment: a solid accent panel — the single loudest surface on Today —
 * with one status eyebrow, the action as the headline, the reason as a
 * subordinate line, and one white CTA. W4.5/W5 corrections:
 * - the reason no longer sits beside the eyebrow as a second competing chip
 *   (defect SYS-11: two status pills with unclear semantics);
 * - the face is contrast-enforced via `readableSurface`, so dark themes with
 *   light primaries get a deepened fill under white ink instead of white-on-
 *   light-lavender (defect SYS-10);
 * - flat accent fill replaces the brand gradient (gradients are reserved for
 *   the capture affordance and celebration per the reference lock).
 */
export function NextBestActionHero({ action }: { action: NextBestAction }) {
  const { tokens } = useAppTheme();
  const navigation = useAppNavigation();
  const meta = OVERVIEW_CARD_META[action.sectionKey];
  // Contrast-enforced hero face: deepens a light dark-theme primary until the
  // white ink clears WCAG AA (fixes the dark-theme hero contrast defect).
  const face = readableSurface(tokens.primary, tokens.onSolid);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Next best action: ${action.title}. ${action.reason}. Open ${meta.title}`}
      onPress={() => openCardTarget(navigation, meta)}
      style={({ pressed }) => ({
        borderRadius: radius.lg,
        backgroundColor: face,
        padding: spacing.lg,
        gap: spacing.sm,
        marginBottom: spacing.lg,
        opacity: pressed ? 0.96 : 1,
      })}
    >
      <View
        style={{
          alignSelf: 'flex-start',
          paddingVertical: 3,
          paddingHorizontal: spacing.sm + 2,
          borderRadius: radius.full,
          backgroundColor: 'rgba(255,255,255,0.22)',
        }}
      >
        <Text variant="label" style={{ color: tokens.onSolid, fontSize: 11, letterSpacing: 0.6 }}>
          UP NEXT
        </Text>
      </View>
      <Text variant="titleLg" style={{ color: tokens.onSolid }} numberOfLines={3}>
        {action.title}
      </Text>
      <Text variant="caption" style={{ color: 'rgba(255,255,255,0.82)' }} numberOfLines={1}>
        {action.reason}
      </Text>
      <View
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs + 2,
          marginTop: spacing.xs,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md + 2,
          borderRadius: radius.md,
          backgroundColor: tokens.onSolid,
        }}
      >
        <MaterialIcons name="arrow-forward" size={16} color={tokens.primary} />
        <Text variant="label" style={{ color: tokens.primary, fontSize: 13 }}>
          Open {meta.title}
        </Text>
      </View>
    </Pressable>
  );
}
