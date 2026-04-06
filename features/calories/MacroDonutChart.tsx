import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { SECTION_TEXT_COLORS } from "@/constants/sectionColors";

const RING_GRAY = "#e2e8f0";
const OVER_COLOR = "#ef4444";

const MACRO_CHIPS: {
  label: string;
  key: "protein" | "carbs" | "fats" | "fiber";
  color: string;
}[] = [
  { label: "Protein", key: "protein", color: SECTION_TEXT_COLORS.todos },
  { label: "Carbs", key: "carbs", color: SECTION_TEXT_COLORS.calories },
  { label: "Fats", key: "fats", color: SECTION_TEXT_COLORS.workout },
  { label: "Fiber", key: "fiber", color: SECTION_TEXT_COLORS.habits },
];

type Props = {
  totalKcal: number;
  goalKcal: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  sectionColor: string;
};

export function MacroDonutChart({
  totalKcal,
  goalKcal,
  protein,
  carbs,
  fats,
  fiber,
  sectionColor,
}: Props) {
  const consumed = totalKcal;
  const goal = Math.max(0, goalKcal);

  const progressData = useMemo(() => {
    if (goal <= 0) {
      if (consumed <= 0) {
        return [{ value: 1, color: RING_GRAY }];
      }
      return [{ value: Math.max(consumed, 1), color: sectionColor }];
    }
    if (consumed > goal) {
      return [{ value: Math.max(consumed, 1), color: OVER_COLOR }];
    }
    const remaining = goal - consumed;
    if (consumed <= 0) {
      return [{ value: Math.max(goal, 1), color: RING_GRAY }];
    }
    if (remaining <= 0) {
      return [{ value: Math.max(consumed, 1), color: sectionColor }];
    }
    return [
      { value: consumed, color: sectionColor },
      { value: remaining, color: RING_GRAY },
    ];
  }, [consumed, goal, sectionColor]);

  const macroValues = { protein, carbs, fats, fiber };

  return (
    <View className="items-center py-2">
      <PieChart
        data={progressData}
        donut
        radius={80}
        innerRadius={55}
        showText={false}
        centerLabelComponent={() => (
          <View className="items-center px-1">
            <Text className="text-lg font-semibold text-slate-800">
              {Math.round(consumed)}
            </Text>
            {goal > 0 ? (
              <Text className="text-xs text-slate-400">/ {Math.round(goal)}</Text>
            ) : null}
            <Text className="text-xs text-slate-400">kcal</Text>
          </View>
        )}
      />
      <View className="mt-3 flex-row justify-around px-2">
        {MACRO_CHIPS.map((m) => (
          <View key={m.label} className="items-center">
            <Text style={{ fontSize: 15, fontWeight: "700", color: m.color }}>
              {Math.round(macroValues[m.key])}g
            </Text>
            <Text style={{ fontSize: 11, color: "#94a3b8" }}>{m.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
