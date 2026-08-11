import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/ThemeProvider';
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
  /** Outer ring fits around this diameter (default 56). */
  size?: number;
  scheduledToday?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
};

const DEFAULT_SIZE = 56;

export function HabitCircle({
  habit,
  todayCount,
  streak,
  showStreak = true,
  showName = true,
  size = DEFAULT_SIZE,
  scheduledToday = true,
  onIncrement,
  onDecrement,
}: HabitCircleProps) {
  const { tokens } = useAppTheme();
  const progress = scheduledToday ? calculateHabitProgress(todayCount, habit.target_per_day) : 0;
  const iconName = habit.icon ?? DEFAULT_HABIT_ICON;
  const habitColor = habit.color ?? tokens.textMuted;
  const iconTint = `${habitColor}18`;

  const strokeWidth = Math.max(3, Math.round(size / 14));
  const ringSize = size + strokeWidth * 2;
  const iconSize = Math.round(size * 0.5);

  return (
    <View className="items-center" style={{ width: Math.max(64, ringSize) }}>
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
            ? `${habit.name}: ${todayCount} of ${habit.target_per_day} today. Tap to add one. Long press to remove one.`
            : `${habit.name}: not scheduled today. Rest day.`
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
            backgroundColor={tokens.border}
            progressColor={habitColor}
          />
        </View>
        <View
          style={{
            position: 'absolute',
            left: (ringSize - size) / 2,
            top: (ringSize - size) / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: scheduledToday ? iconTint : tokens.surfaceElevated,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons
            name={iconName}
            size={iconSize}
            color={scheduledToday ? habitColor : tokens.iconMuted}
          />
        </View>
      </Pressable>
      {!scheduledToday ? (
        <Text className="mt-1 text-[10px] font-medium" style={{ color: tokens.textMuted }}>
          Rest day
        </Text>
      ) : null}
      {showStreak && streak > 0 && (
        <Text className="mt-0.5 text-xs font-medium text-amber-500">
          {streak > 2 ? '🔥' : '⚡'} {streak}
        </Text>
      )}
      {showName ? (
        <Text
          className="mt-2 text-center text-xs font-medium leading-4"
          style={{ color: tokens.text }}
          numberOfLines={2}
        >
          {habit.name}
        </Text>
      ) : null}
    </View>
  );
}
