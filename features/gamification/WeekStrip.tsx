import { Text, View } from 'react-native';
import { REWARD_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing, typography } from '@/core/theme/designTokens';
import { dateKeyToLocalDate } from '@/lib/time';
import type { StreakDay } from './gamification.types';

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export type WeekStripProps = {
  /** Trailing days, oldest first, ending today. */
  week: StreakDay[];
  todayKey: string;
  accent: string;
};

/**
 * Weekly activity strip (Refero: Duolingo/Ahead streak screens, Brilliant
 * progress card). Three states are visually distinct on purpose — active,
 * freeze-protected, and empty — because a saved day is information, not a gap.
 */
export function WeekStrip({ week, todayKey, accent }: WeekStripProps) {
  const { tokens } = useAppTheme();
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
        const background = day.active
          ? accent
          : day.frozen
            ? `${REWARD_COLORS.frozen}33`
            : tokens.surfaceElevated;
        const borderColor = isToday
          ? tokens.text
          : day.frozen
            ? REWARD_COLORS.frozen
            : tokens.border;
        return (
          <View key={day.dateKey} className="items-center" style={{ gap: spacing.xs }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: radius.full,
                backgroundColor: background,
                borderWidth: isToday || day.frozen ? 2 : 1,
                borderColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  ...typography.caption,
                  color: day.active ? tokens.buttonText : tokens.textMuted,
                }}
              >
                {WEEKDAY_INITIALS[dateKeyToLocalDate(day.dateKey).getDay()]}
              </Text>
            </View>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: radius.full,
                backgroundColor: day.active
                  ? accent
                  : day.frozen
                    ? REWARD_COLORS.frozen
                    : tokens.border,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}
