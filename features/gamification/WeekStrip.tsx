import { Text, View } from 'react-native';
import { REWARD_HUES } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing, typography } from '@/core/theme/designTokens';
import { FlameIcon, FreezeShieldIcon } from '@/core/ui/illustrations/icons';
import { dateKeyToLocalDate } from '@/lib/time';
import { weekDayNodeVisual } from './gamificationSurfaces.visual';
import type { StreakDay } from './gamification.types';

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export type WeekStripProps = {
  /** Trailing days, oldest first, ending today. */
  week: StreakDay[];
  todayKey: string;
  /**
   * Accepted for API stability with the existing call sites (Gold was the old
   * active-day face). The v2 strip paints the Flame streak hue instead, so XP
   * and streaks never read as the same object (§7), and this value is unused.
   */
  accent?: string;
};

/**
 * Weekly activity strip (Refero: Duolingo/Ahead streak screens, Brilliant
 * progress card).
 *
 * P20 (`docs/ui-ux/16-playful-momentum.md` §7 "WeekStrip = 7 Flame/Ice nodes
 * (frozen day = Ice shield)"): each day is a node with its weekday initial and
 * a state mark under it — a Flame for a real active day, an Ice shield for a
 * day a banked freeze saved, a quiet dot for an empty day. Three states are
 * visually distinct on purpose because a saved day is information, not a gap
 * (§2 "never imply moral failure"; the garden never wilts and a freeze is
 * never framed as loss).
 *
 * The accessible summary label is unchanged ("N active days in the last week,
 * plus M days saved by a streak freeze."), and node fills resolve their own ink
 * against the ACTUAL fill (`weekDayNodeVisual`), so the initials stay ≥4.5:1 in
 * all 14 themes.
 */
export function WeekStrip({ week, todayKey }: WeekStripProps) {
  const { tokens, rewardAccents, resolvedTheme } = useAppTheme();
  const activeDays = week.filter((day) => day.active).length;
  const frozenDays = week.filter((day) => day.frozen).length;
  const summary =
    activeDays === 0
      ? 'No active days in the last week yet.'
      : `${activeDays} active day${activeDays === 1 ? '' : 's'} in the last week` +
        (frozenDays > 0
          ? `, plus ${frozenDays} day${frozenDays === 1 ? '' : 's'} saved by a streak freeze.`
          : '.');

  return (
    <View accessible accessibilityLabel={summary} className="flex-row justify-between">
      {week.map((day) => {
        const isToday = day.dateKey === todayKey;
        const dayState = day.active ? 'active' : day.frozen ? 'frozen' : 'empty';
        const visual = weekDayNodeVisual({
          state: dayState,
          isToday,
          appearance: resolvedTheme,
          tokens: {
            surface: tokens.surface,
            surfaceSunken: tokens.surfaceSunken,
            text: tokens.text,
            textMuted: tokens.textMuted,
            border: tokens.border,
          },
          rewardText: { streak: rewardAccents.streak.text, frozen: rewardAccents.frozen.text },
        });
        return (
          <View key={day.dateKey} className="items-center" style={{ gap: spacing.xs }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.full,
                backgroundColor: visual.fill,
                borderWidth: visual.borderWidth,
                borderColor: visual.borderColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ ...typography.label, color: visual.ink }}>
                {WEEKDAY_INITIALS[dateKeyToLocalDate(day.dateKey).getDay()]}
              </Text>
            </View>
            {/* State mark: Flame (active), Ice shield (freeze-saved), or a
                quiet dot. Sized 16 so a shield's shape is legible at node scale. */}
            {visual.mark === 'flame' ? (
              <FlameIcon
                size={16}
                bright={REWARD_HUES.streak.bright}
                lip={REWARD_HUES.streak.lip}
              />
            ) : visual.mark === 'shield' ? (
              <FreezeShieldIcon
                size={16}
                bright={REWARD_HUES.frozen.bright}
                lip={REWARD_HUES.frozen.lip}
              />
            ) : (
              <View
                style={{
                  width: 6,
                  height: 6,
                  marginTop: 5,
                  marginBottom: 5,
                  borderRadius: radius.full,
                  backgroundColor: visual.markInk,
                }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
