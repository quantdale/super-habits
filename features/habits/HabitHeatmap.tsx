import { View, Text } from "react-native";
import type { DayCompletion } from "./habits.domain";

type Props = {
  dayCompletions: DayCompletion[];
  accentColor: string; // habit.color hex string
};

/**
 * 30-day mini heatmap for a single habit.
 * Renders a 6-column × 5-row grid (30 cells) showing
 * completion status per day. Oldest day top-left,
 * newest day bottom-right.
 *
 * Uses plain View + backgroundColor instead of a charting
 * library — the heatmap grid is simple enough to build
 * directly and avoids charting library web compatibility
 * concerns for this specific component.
 *
 * react-native-gifted-charts will be used for bar/line
 * charts in later phases (calorie trends, workout progression).
 */
export function HabitHeatmap({ dayCompletions, accentColor }: Props) {
  const rows: DayCompletion[][] = [];
  for (let i = 0; i < dayCompletions.length; i += 6) {
    rows.push(dayCompletions.slice(i, i + 6));
  }

  return (
    <View className="mt-2 mb-1 px-1">
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} className="mb-1 flex-row gap-1">
          {row.map((day) => (
            <View
              key={day.dateKey}
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                backgroundColor: day.completed
                  ? accentColor
                  : day.count > 0
                    ? accentColor + "55"
                    : "#e2e8f0",
              }}
            />
          ))}
        </View>
      ))}
      <View className="mt-1 flex-row items-center gap-2">
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            backgroundColor: "#e2e8f0",
          }}
        />
        <Text className="text-xs text-slate-400">none</Text>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            backgroundColor: accentColor + "55",
          }}
        />
        <Text className="text-xs text-slate-400">partial</Text>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            backgroundColor: accentColor,
          }}
        />
        <Text className="text-xs text-slate-400">done</Text>
      </View>
    </View>
  );
}
