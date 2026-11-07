import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from '@/core/ui/Text';
import { inkOnFill, readableSurface } from '@/core/theme/contrast';
import { useAppTheme } from '@/core/providers/themeContext';
import { SECTION_HUES, SECTION_ON_BRIGHT_INK } from '@/constants/sectionColors';
import { dateKeyToLocalDate } from '@/lib/time';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';

const HUE = SECTION_HUES.habits;

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
 * One round 44px day node (§7): a done day fills Sprout bright with the lip,
 * today wears the 2px Sprout ring, and each node keeps a shape-coded mark
 * (check = all scheduled complete, dot = some progress) so state never relies
 * on color alone. Exact counts live in the accessibility label.
 */
function HabitDayButton({
  weekdayLabel,
  dayOfMonth,
  allComplete,
  someProgress,
  isToday,
  selected,
  accessibilityLabel,
  onPress,
}: {
  weekdayLabel: string;
  dayOfMonth: string;
  allComplete: boolean;
  someProgress: boolean;
  isToday: boolean;
  selected: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { tokens } = useAppTheme();
  const focus = useKeyboardFocusRing(HUE.bright);
  const activeFill = readableSurface(HUE.bright, tokens.onSolid);
  // The done face is the FIXED §5.1 Sprout bright, which is not theme-aware, so
  // the label ink must be chosen against that actual fill — not against the
  // theme. `tokens.text` reads 7.19:1 on it in the light default but only
  // 2.00:1 in dark (white-ish ink on a mid-tone green), so light keeps its
  // native ink and dark falls back to the §5.1 bright-fill ink (8.61:1).
  // Selected fills the `readableSurface` deep tint, whose whole purpose is to
  // be dark enough for `onSolid` (white clears 5.41:1 there). State is still
  // shape-coded (check/dot), never color alone.
  const doneInk = inkOnFill(HUE.bright, tokens.text, SECTION_ON_BRIGHT_INK);
  const contentColor = allComplete ? doneInk : selected ? tokens.onSolid : tokens.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      aria-pressed={selected}
      accessibilityState={{ selected }}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      className="mb-2 mr-1.5 items-center justify-center"
      style={focus.focusRingStyle}
    >
      <View className="h-[46px] w-11 items-center justify-center">
        {/* Lip slab under the done face (§7 day nodes). */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 2,
            width: 44,
            height: 44,
            borderRadius: radiusFull,
            backgroundColor: allComplete ? HUE.lip : 'transparent',
          }}
        />
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radiusFull,
            borderWidth: isToday ? 2 : 1,
            borderColor: isToday
              ? allComplete
                ? HUE.solid
                : HUE.bright
              : allComplete
                ? HUE.bright
                : selected
                  ? activeFill
                  : tokens.border,
            backgroundColor: allComplete ? HUE.bright : selected ? activeFill : tokens.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="label" style={{ color: contentColor }}>
            {weekdayLabel}
          </Text>
          <Text variant="label" style={{ color: contentColor }}>
            {dayOfMonth}
          </Text>
        </View>
        {/* Shape-coded completion mark (check = all complete, dot = some). */}
        {allComplete ? (
          <View
            className="absolute right-0 top-0 h-3.5 w-3.5 items-center justify-center rounded-full"
            style={{ backgroundColor: tokens.surface }}
          >
            <MaterialIcons name="check" size={10} color={HUE.solid} />
          </View>
        ) : someProgress ? (
          <View
            className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full"
            style={{ backgroundColor: HUE.solid }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const radiusFull = 9999;

/**
 * Compact past-week selector: round day nodes ending at today, which stays
 * visually anchored and is the default selection.
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
          return (
            <HabitDayButton
              key={day.dateKey}
              weekdayLabel={day.weekdayLabel}
              dayOfMonth={day.dayOfMonth}
              allComplete={allComplete}
              someProgress={someProgress}
              isToday={isToday}
              selected={isSelected}
              accessibilityLabel={`${fullWeekdayLabel(day.dateKey)}${isToday ? ', today' : ''}: ${day.completedCount} of ${day.scheduledCount === 0 ? '0' : day.scheduledCount} scheduled habits complete`}
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
