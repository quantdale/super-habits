import { Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Habit } from "@/core/db/types";
import { calculateHabitProgress } from "@/features/habits/habits.domain";
import { ProgressRing } from "@/features/habits/ProgressRing";

type HabitCircleProps = {
  habit: Habit;
  todayCount: number;
  onIncrement: () => void;
  onDecrement: () => void;
};

const CIRCLE_SIZE = 72;
const STROKE_WIDTH = 4;
const DEFAULT_ICON_COLOR = "#64748b";
const DEFAULT_BG_COLOR = "#f1f5f9";
const PROGRESS_COLOR = "#94a3b8";

export function HabitCircle({ habit, todayCount, onIncrement, onDecrement }: HabitCircleProps) {
  const progress = calculateHabitProgress(todayCount, habit.target_per_day);

  const ringSize = CIRCLE_SIZE + STROKE_WIDTH * 2;

  return (
    <View className="items-center" style={{ width: 88 }}>
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
            strokeWidth={STROKE_WIDTH}
            progress={progress}
            backgroundColor="#e2e8f0"
            progressColor={PROGRESS_COLOR}
          />
        </View>
        <View
          style={{
            position: "absolute",
            left: (ringSize - CIRCLE_SIZE) / 2,
            top: (ringSize - CIRCLE_SIZE) / 2,
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            borderRadius: CIRCLE_SIZE / 2,
            backgroundColor: DEFAULT_BG_COLOR,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name="check-circle" size={36} color={DEFAULT_ICON_COLOR} />
        </View>
      </Pressable>
      <Text
        className="mt-2 text-center text-xs font-medium text-slate-700"
        numberOfLines={2}
      >
        {habit.name}
      </Text>
    </View>
  );
}
