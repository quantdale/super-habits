import { Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { Habit } from "./types";
import { calculateHabitProgress } from "@/features/habits/habits.domain";
import { ProgressRing } from "@/features/habits/ProgressRing";
import { DEFAULT_HABIT_ICON } from "@/features/habits/habitPresets";
import { useAppTheme } from "@/core/theme";

type HabitCircleProps = {
  habit: Habit;
  todayCount: number;
  streak: number;
  showStreak?: boolean;
  showName?: boolean;
  size?: number;
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
  onIncrement,
  onDecrement,
}: HabitCircleProps) {
  const { colors } = useAppTheme();
  const progress = calculateHabitProgress(todayCount, habit.target_per_day);
  const iconName = habit.icon ?? DEFAULT_HABIT_ICON;
  const habitColor = habit.color ?? colors.icon;

  const strokeWidth = Math.max(3, Math.round(size / 14));
  const ringSize = size + strokeWidth * 2;
  const iconSize = Math.round(size * 0.5);

  return (
    <View className="items-center" style={{ width: Math.max(64, ringSize) }}>
      <Pressable
        onPress={onIncrement}
        onLongPress={onDecrement}
        delayLongPress={400}
        style={{ width: ringSize, height: ringSize }}
        className="items-center justify-center"
      >
        <View
          style={{
            position: "absolute",
            width: ringSize,
            height: ringSize,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ProgressRing
            size={ringSize}
            strokeWidth={strokeWidth}
            progress={progress}
            backgroundColor={colors.progressTrack}
            progressColor={habitColor}
          />
        </View>
        <View
          style={{
            position: "absolute",
            left: (ringSize - size) / 2,
            top: (ringSize - size) / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name={iconName} size={iconSize} color={habitColor} />
        </View>
      </Pressable>
      {showStreak && streak > 0 && (
        <Text className="mt-0.5 text-xs font-medium" style={{ color: "#f59e0b" }}>
          {streak > 2 ? "🔥" : "⚡"} {streak}
        </Text>
      )}
      {showName ? (
        <Text className="mt-2 text-center text-xs font-medium" style={{ color: colors.textMuted }} numberOfLines={2}>
          {habit.name}
        </Text>
      ) : null}
    </View>
  );
}
