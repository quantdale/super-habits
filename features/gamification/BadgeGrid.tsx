import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { SECTION_ON_BRIGHT_INK } from '@/constants/sectionColors';
import { inkOnFill, WCAG_AA_NON_TEXT } from '@/core/theme/contrast';
import { useAppTheme } from '@/core/providers/themeContext';
import { spacing, typography } from '@/core/theme/designTokens';
import { BadgePlate } from './BadgePlate';
import { BADGE_TIER_HUES, badgeTileVisual } from './gamificationSurfaces.visual';
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
 * Badge board (Refero: Planny awards grid, Duolingo achievements list).
 *
 * P20 (`docs/ui-ux/16-playful-momentum.md` §7 "Gamification surfaces"):
 * each badge is a **hexagon plate in its tier hue with a 4px lip**. An earned
 * tier is a full-color plate with the family glyph in the §5.1 bright-fill ink
 * (Bronze 6.41:1 … Platinum 10.12:1 — white on those fills is 1.55–2.90:1).
 * A locked tier is the same geometry in a sunken monochrome treatment, showing
 * its progress fraction so the next goal stays visible; the copy never calls
 * it missing. Accessible names, thresholds and ordering are unchanged.
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
      {visible.map((badge) => {
        const visual = badgeTileVisual({
          tier: badge.tier,
          unlocked: badge.unlocked,
          tokens: {
            surface: tokens.surface,
            surfaceSunken: tokens.surfaceSunken,
            text: tokens.text,
            textMuted: tokens.textMuted,
            border: tokens.border,
          },
        });
        const progress = Math.min(badge.progress, badge.threshold);
        return (
          <View
            key={badge.id}
            accessible
            accessibilityLabel={
              badge.unlocked
                ? `${badge.label}: unlocked. ${badge.description}`
                : `${badge.label}: locked. ${progress} of ${badge.threshold} ${badge.description}`
            }
            style={{ width: 84, alignItems: 'center', gap: spacing.xs }}
          >
            <BadgePlate
              fill={visual.fill}
              lipColor={visual.lip}
              outlineColor={visual.outline}
              size={64}
            >
              <MaterialIcons
                name={badge.icon as keyof typeof MaterialIcons.glyphMap}
                size={28}
                color={visual.glyphBright}
              />
            </BadgePlate>
            <Text
              style={{
                ...typography.caption,
                color: visual.labelInk,
                textAlign: 'center',
              }}
              numberOfLines={2}
            >
              {badge.label}
            </Text>
            <Text style={{ ...typography.caption, color: visual.metaInk }}>
              {badge.unlocked ? 'Earned' : `${progress}/${badge.threshold}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * A single badge-family glyph in a **small hexagon plate**, used by
 * `AchievementsScreen` for the "Latest milestone" and "Next target" cards so
 * both read as members of the badge system rather than as generic cards.
 *
 * `subdued` paints the locked/neutral treatment (sunken face, monochrome
 * glyph). The glyph ink is chosen against the ACTUAL face: the Gold-tier plate
 * uses the §5.1 bright-fill ink (11.98:1), never the theme's own text ink.
 *
 * Decorative: the card's title/progress text carries the meaning.
 */
export function BadgeFamilyTile({
  icon,
  size = 52,
  subdued = false,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  size?: number;
  subdued?: boolean;
}) {
  const { tokens } = useAppTheme();
  const hue = BADGE_TIER_HUES[3]; // the family plates wear the Gold tier
  const face = subdued ? tokens.surfaceSunken : hue.bright;
  const edge = subdued ? tokens.border : hue.lip;
  const outline = subdued
    ? inkOnFill(tokens.surface, tokens.textMuted, tokens.text, WCAG_AA_NON_TEXT)
    : hue.lip;
  const glyphInk = subdued ? tokens.textMuted : inkOnFill(face, SECTION_ON_BRIGHT_INK, '#FFFFFF');

  return (
    <BadgePlate fill={face} lipColor={edge} outlineColor={outline} size={Math.round(size)}>
      <MaterialIcons name={icon} size={Math.round(size / 2.4)} color={glyphInk} />
    </BadgePlate>
  );
}
