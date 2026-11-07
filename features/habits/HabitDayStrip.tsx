import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { SECTION_HUES } from '@/constants/sectionColors';
import { dateKeyToLocalDate } from '@/lib/time';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import { habitDayNodeVisual } from '@/features/habits/habitDayNode.visual';

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
  const visual = habitDayNodeVisual({
    allComplete,
    selected,
    isToday,
    surface: tokens.surface,
    border: tokens.border,
    text: tokens.text,
    onSolid: tokens.onSolid,
  });
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
            backgroundColor: visual.lip,
          }}
        />
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radiusFull,
            borderWidth: visual.borderWidth,
            borderColor: visual.borderColor,
            backgroundColor: visual.fill,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Selection ring: drawn for a selected COMPLETED day, where the
              completed fill would otherwise win every property and hide the
              selection. It sits inside the face (inset by its own width) and
              uses the Sprout lip, which is independent of the bright fill
              (3.83:1 — past the 3:1 non-text floor) and theme-invariant. A
              selected non-completed day keeps its `readableSurface` fill, and
              an unselected day is untouched. */}
          {visual.selectionRing ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: visual.selectionRingWidth,
                right: visual.selectionRingWidth,
                bottom: visual.selectionRingWidth,
                left: visual.selectionRingWidth,
                borderRadius: radiusFull,
                borderWidth: visual.selectionRingWidth,
                borderColor: visual.selectionRing,
              }}
            />
          ) : null}
          <Text variant="label" style={{ color: visual.ink }}>
            {weekdayLabel}
          </Text>
          <Text variant="label" style={{ color: visual.ink }}>
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
