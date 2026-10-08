import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/core/ui/Text';
import { readableSurface } from '@/core/theme/contrast';
import { useAppTheme } from '@/core/providers/themeContext';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { dateKeyToLocalDate } from '@/lib/time';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';

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

function HabitDayButton({
  label,
  accessibilityLabel,
  selected,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { tokens, sectionAccents } = useAppTheme();
  const focus = useKeyboardFocusRing(sectionAccents.habits.text);
  const activeFill = readableSurface(SECTION_COLORS.habits, tokens.onSolid);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      aria-pressed={selected}
      accessibilityState={{ selected }}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      className="mb-2 mr-2 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border px-3"
      style={[
        {
          backgroundColor: selected ? activeFill : tokens.surface,
          borderColor: selected ? activeFill : tokens.border,
        },
        focus.focusRingStyle,
      ]}
    >
      <Text variant="label" style={{ color: selected ? tokens.onSolid : tokens.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Compact past-week selector: quiet day pills ending at today,
 * which stays visually anchored and is the
 * default selection. Each pill carries a shape-coded completion mark (check =
 * all scheduled complete, dot = some progress) so state never relies on color
 * alone; exact counts are exposed through the accessibility label.
 */
export function HabitDayStrip({ days, selectedDateKey, todayKey, onSelect }: HabitDayStripProps) {
  const { tokens, sectionAccents } = useAppTheme();
  const backFocus = useKeyboardFocusRing(sectionAccents.habits.text);
  const stripRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (selectedDateKey === todayKey) stripRef.current?.scrollToEnd({ animated: false });
  }, [selectedDateKey, todayKey]);

  return (
    <View>
      <ScrollView
        ref={stripRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel="Check-in day picker"
        onLayout={() => {
          // A viewport resize changes the clipping window, not content size.
          if (selectedDateKey === todayKey) stripRef.current?.scrollToEnd({ animated: false });
        }}
        onContentSizeChange={() => {
          if (selectedDateKey === todayKey) stripRef.current?.scrollToEnd({ animated: false });
        }}
      >
        {days.map((day) => {
          const isSelected = day.dateKey === selectedDateKey;
          const isToday = day.dateKey === todayKey;
          const allComplete = day.scheduledCount > 0 && day.completedCount >= day.scheduledCount;
          const someProgress = !allComplete && day.completedCount > 0;
          const completionMark = allComplete ? ' ✓' : someProgress ? ' •' : '';
          return (
            <HabitDayButton
              key={day.dateKey}
              label={`${day.weekdayLabel} ${day.dayOfMonth}${completionMark}`}
              accessibilityLabel={`${fullWeekdayLabel(day.dateKey)}${isToday ? ', today' : ''}: ${day.completedCount} of ${day.scheduledCount === 0 ? '0' : day.scheduledCount} scheduled habits complete`}
              selected={isSelected}
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
            onFocus={backFocus.onFocus}
            onBlur={backFocus.onBlur}
            style={backFocus.focusRingStyle}
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
