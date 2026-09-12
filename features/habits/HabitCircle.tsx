import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { useReducedMotion } from '@/core/theme/motion';
import { springs } from '@/core/theme/designTokens';
import type { Habit } from './types';
import { calculateHabitProgress } from '@/features/habits/habits.domain';
import { ProgressRing } from '@/features/habits/ProgressRing';
import { DEFAULT_HABIT_ICON } from '@/features/habits/habitPresets';

type HabitCircleProps = {
  habit: Habit;
  todayCount: number;
  streak: number;
  showStreak?: boolean;
  /** When false, parent renders the habit name (e.g. Avocation-style row). */
  showName?: boolean;
  /** Outer ring fits around this diameter (minimum 64). */
  size?: number;
  scheduledToday?: boolean;
  /**
   * Date phrase for the accessibility label; defaults to "today". Pass e.g.
   * "on Aug 18" when the parent is viewing a past day.
   */
  dayPhrase?: string;
  onIncrement: () => void;
  onDecrement: () => void;
};

const MIN_SIZE = 64;

export function HabitCircle({
  habit,
  todayCount,
  streak,
  showStreak = true,
  showName = true,
  size = MIN_SIZE,
  scheduledToday = true,
  dayPhrase,
  onIncrement,
  onDecrement,
}: HabitCircleProps) {
  const { tokens, sectionAccents } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const diameter = Math.max(MIN_SIZE, size);
  const progress = scheduledToday ? calculateHabitProgress(todayCount, habit.target_per_day) : 0;
  const isComplete = scheduledToday && progress >= 1;
  const iconName = habit.icon ?? DEFAULT_HABIT_ICON;
  const habitColor = habit.color ?? sectionAccents.habits.fill;
  const iconTint = `${habitColor}1F`;

  const strokeWidth = Math.max(5, Math.round(diameter / 10));
  const ringSize = diameter + strokeWidth * 2;

  // Spring check-off: the ring pulses once when a check-in lands, so the
  // gesture has a physical result even before the count re-renders. Reduced
  // motion skips the pulse entirely — the count is the information.
  const [pulse] = useState(() => new Animated.Value(1));
  const previousCount = useRef(todayCount);
  useEffect(() => {
    const increased = todayCount > previousCount.current;
    previousCount.current = todayCount;
    if (!increased || reducedMotion) return;
    const animation = Animated.sequence([
      Animated.spring(pulse, { toValue: 1.12, useNativeDriver: true, ...springs.pop }),
      Animated.spring(pulse, { toValue: 1, useNativeDriver: true, ...springs.press }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion, todayCount]);

  return (
    <View className="items-center" style={{ width: Math.max(72, ringSize) }}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Pressable
          onPress={scheduledToday ? onIncrement : undefined}
          onLongPress={scheduledToday ? onDecrement : undefined}
          disabled={!scheduledToday}
          delayLongPress={400}
          style={{ width: ringSize, height: ringSize }}
          className="items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={
            scheduledToday
              ? `${habit.name}: ${todayCount} of ${habit.target_per_day} ${dayPhrase ?? 'today'}. Tap to add one. Long press to remove one.`
              : `${habit.name}: not scheduled ${dayPhrase ?? 'today'}. Rest day.`
          }
          accessibilityState={{ disabled: !scheduledToday }}
        >
          <View
            style={{
              position: 'absolute',
              width: ringSize,
              height: ringSize,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ProgressRing
              size={ringSize}
              strokeWidth={strokeWidth}
              progress={progress}
              backgroundColor={tokens.surfaceSunken}
              progressColor={habitColor}
            />
          </View>
          <View
            style={{
              position: 'absolute',
              left: (ringSize - diameter) / 2,
              top: (ringSize - diameter) / 2,
              width: diameter,
              height: diameter,
              borderRadius: diameter / 2,
              backgroundColor: isComplete
                ? habitColor
                : scheduledToday
                  ? iconTint
                  : tokens.surfaceSunken,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isComplete ? (
              <MaterialIcons name="check" size={30} color={tokens.onSolid} />
            ) : habit.target_per_day > 1 ? (
              <Text
                variant="titleMd"
                style={{ color: scheduledToday ? habitColor : tokens.iconMuted }}
              >
                {todayCount}/{habit.target_per_day}
              </Text>
            ) : (
              <MaterialIcons
                name={iconName}
                size={28}
                color={scheduledToday ? habitColor : tokens.iconMuted}
              />
            )}
          </View>
        </Pressable>
      </Animated.View>
      {!scheduledToday ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
          Rest day
        </Text>
      ) : null}
      {showStreak && streak > 0 ? (
        <View
          className="mt-1 flex-row items-center gap-1 rounded-full px-2 py-1"
          style={{ backgroundColor: sectionAccents.habits.tint }}
        >
          <MaterialIcons
            name={streak > 2 ? 'local-fire-department' : 'bolt'}
            size={12}
            color={sectionAccents.habits.text}
          />
          <Text variant="caption" style={{ color: sectionAccents.habits.text }}>
            {streak}
          </Text>
        </View>
      ) : null}
      {showName ? (
        <Text
          variant="caption"
          style={{ color: tokens.text, textAlign: 'center', marginTop: 8 }}
          numberOfLines={2}
        >
          {habit.name}
        </Text>
      ) : null}
    </View>
  );
}
