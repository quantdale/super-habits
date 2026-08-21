import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
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
 * day pills ending at today, which stays visually anchored and is the default
 * selection. Each pill carries a shape-coded completion mark (check = all
 * scheduled complete, dot = some progress) so state never relies on color
 * alone; exact counts are exposed through the accessibility label.
 */
export function HabitDayStrip({ days, selectedDateKey, todayKey, onSelect }: HabitDayStripProps) {
  const { tokens } = useAppTheme();
  const accent = SECTION_COLORS.habits;

  return (
    <View>
      <View className="flex-row gap-1.5" accessibilityLabel="Check-in day picker">
        {days.map((day) => {
          const isSelected = day.dateKey === selectedDateKey;
          const isToday = day.dateKey === todayKey;
          const allComplete = day.scheduledCount > 0 && day.completedCount >= day.scheduledCount;
          const someProgress = !allComplete && day.completedCount > 0;
          const labelColor = isSelected
            ? tokens.textOnAccent
            : isToday
              ? tokens.text
              : tokens.textMuted;
          return (
            <Pressable
              key={day.dateKey}
              onPress={() => onSelect(day.dateKey)}
              accessibilityRole="button"
              accessibilityLabel={`${fullWeekdayLabel(day.dateKey)}${isToday ? ', today' : ''}: ${day.completedCount} of ${day.scheduledCount === 0 ? '0' : day.scheduledCount} scheduled habits complete`}
              accessibilityState={{ selected: isSelected }}
              className="h-14 min-w-[44px] flex-1 items-center justify-center rounded-xl border px-1"
              style={
                isSelected
                  ? { backgroundColor: accent, borderColor: accent }
                  : isToday
                    ? { backgroundColor: `${accent}18`, borderColor: accent }
                    : { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }
              }
            >
              <Text className="text-[10px] font-medium leading-3" style={{ color: labelColor }}>
                {day.weekdayLabel}
              </Text>
              <Text
                className="text-sm font-semibold leading-4 tabular-nums"
                style={{ color: labelColor }}
              >
                {day.dayOfMonth}
              </Text>
              {allComplete ? (
                <MaterialIcons
                  name="check"
                  size={10}
                  color={isSelected ? tokens.textOnAccent : accent}
                />
              ) : day.scheduledCount > 0 ? (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    marginTop: 2,
                    backgroundColor: someProgress
                      ? isSelected
                        ? tokens.textOnAccent
                        : accent
                      : isSelected
                        ? tokens.textOnAccent
                        : tokens.border,
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {selectedDateKey !== todayKey ? (
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-xs" style={{ color: tokens.textMuted }}>
            Viewing {displayDateLabel(selectedDateKey)}
          </Text>
          <Pressable
            onPress={() => onSelect(todayKey)}
            accessibilityRole="button"
            accessibilityLabel="Back to today"
            className="min-h-[44px] justify-center px-2"
          >
            <Text className="text-xs font-semibold" style={{ color: tokens.text }}>
              Back to today
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
