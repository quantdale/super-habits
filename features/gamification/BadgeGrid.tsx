import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { REWARD_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing, typography } from '@/core/theme/designTokens';
import type { BadgeState } from './gamification.types';

export type BadgeGridProps = {
  badges: readonly BadgeState[];
  /** Only families with a badge in progress are listed; unlocked tiers first. */
  maxRows?: number;
};

/**
 * Unlocked tiers first, then the closest locked tier per family.
 *
 * Locked ordering is ratio descending *then* threshold ascending: with a fresh
 * account every ratio is 0, and the cheap next goal ("1 complete day") is far
 * more motivating than whatever happens to sort first alphabetically.
 */
function visibleBadges(badges: readonly BadgeState[], maxTiles: number): BadgeState[] {
  const unlocked = badges.filter((badge) => badge.unlocked);
  const inProgress = badges
    .filter((badge) => !badge.unlocked)
    .sort((a, b) => b.ratio - a.ratio || a.threshold - b.threshold || a.id.localeCompare(b.id));
  return [...unlocked, ...inProgress].slice(0, maxTiles);
}

/**
 * Badge board (Refero: Planny awards grid, Duolingo achievements list):
 * earned tiers in full color, locked tiers dimmed with their progress fraction
 * so the next goal is always visible.
 */
export function BadgeGrid({ badges, maxRows = 12 }: BadgeGridProps) {
  const { tokens } = useAppTheme();
  const visible = visibleBadges(badges, maxRows);

  if (visible.length === 0) {
    return (
      <Text style={{ ...typography.bodyMd, color: tokens.textMuted }}>No badges defined yet.</Text>
    );
  }

  return (
    <View className="flex-row flex-wrap" style={{ gap: spacing.md }}>
      {visible.map((badge) => (
        <View
          key={badge.id}
          accessible
          accessibilityLabel={
            badge.unlocked
              ? `${badge.label}: unlocked. ${badge.description}`
              : `${badge.label}: locked. ${Math.min(badge.progress, badge.threshold)} of ${badge.threshold} ${badge.description}`
          }
          style={{ width: 76, alignItems: 'center', gap: spacing.xs }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: badge.unlocked ? `${REWARD_COLORS.badge}22` : tokens.surfaceElevated,
              borderWidth: 1,
              borderColor: badge.unlocked ? REWARD_COLORS.badge : tokens.border,
            }}
          >
            <MaterialIcons
              name={badge.icon as keyof typeof MaterialIcons.glyphMap}
              size={28}
              color={badge.unlocked ? REWARD_COLORS.badge : tokens.iconMuted}
            />
          </View>
          <Text
            style={{
              ...typography.caption,
              color: badge.unlocked ? tokens.text : tokens.textMuted,
              textAlign: 'center',
            }}
            numberOfLines={2}
          >
            {badge.label}
          </Text>
          <Text style={{ ...typography.caption, color: tokens.textMuted }}>
            {badge.unlocked
              ? 'Earned'
              : `${Math.min(badge.progress, badge.threshold)}/${badge.threshold}`}
          </Text>
        </View>
      ))}
    </View>
  );
}
