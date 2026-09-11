import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/core/ui/Text';
import { PillChip } from '@/core/ui/PillChip';
import { useAppTheme } from '@/core/providers/themeContext';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { dateKeyToLocalDate } from '@/lib/time';

export type HabitDayStripDay = {
  dateKey: string;
  /** Single-letter weekday label (Mon-start week, duplicate letters allowed). */
  weekdayLabel: string;
  dayOfMonth: string;
  scheduledCount: number;
  completedCount: number;
};

type HabitDayStripProps = {
  /** Oldest first; today is expected as the last entry (visually anchored). */
  days: HabitDayStripDay[];
  selectedDateKey: string;
  todayKey: string;
  onSelect: (dateKey: string) => void;
};

function fullWeekdayLabel(dateKey: string): string {
  return dateKeyToLocalDate(dateKey).toLocaleDateString('en', { weekday: 'long' });
}

function displayDateLabel(dateKey: string): string {
  return dateKeyToLocalDate(dateKey).toLocaleDateString('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Compact past-week selector for the habit grid (blueprint §3A): one row of
 * chunky day pills ending at today, which stays visually anchored and is the
 * default selection. Each pill carries a shape-coded completion mark (check =
 * all scheduled complete, dot = some progress) so state never relies on color
 * alone; exact counts are exposed through the accessibility label.
 */
export function HabitDayStrip({ days, selectedDateKey, todayKey, onSelect }: HabitDayStripProps) {
  const { tokens } = useAppTheme();
  const accent = SECTION_COLORS.habits;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel="Check-in day picker"
      >
        {days.map((day) => {
          const isSelected = day.dateKey === selectedDateKey;
          const isToday = day.dateKey === todayKey;
          const allComplete = day.scheduledCount > 0 && day.completedCount >= day.scheduledCount;
          const someProgress = !allComplete && day.completedCount > 0;
          const completionMark = allComplete ? ' ✓' : someProgress ? ' •' : '';
          return (
            <PillChip
              key={day.dateKey}
              label={`${day.weekdayLabel} ${day.dayOfMonth}${completionMark}`}
              accessibilityLabel={`${fullWeekdayLabel(day.dateKey)}${isToday ? ', today' : ''}: ${day.completedCount} of ${day.scheduledCount === 0 ? '0' : day.scheduledCount} scheduled habits complete`}
              active={isSelected}
              color={accent}
              onPress={() => onSelect(day.dateKey)}
            />
          );
        })}
      </ScrollView>
      {selectedDateKey !== todayKey ? (
        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="muted">
            Viewing {displayDateLabel(selectedDateKey)}
          </Text>
          <Pressable
            onPress={() => onSelect(todayKey)}
            accessibilityRole="button"
            accessibilityLabel="Back to today"
            className="min-h-[44px] justify-center px-2"
          >
            <Text variant="label" style={{ color: tokens.text }}>
              Back to today
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
