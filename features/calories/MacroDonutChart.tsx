import React from "react";
import { View, Text } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import type { MacroSlice } from "./calories.domain";

type Props = {
  slices: MacroSlice[];
  totalKcal: number;
  goalKcal?: number;
};

export function MacroDonutChart({ slices, totalKcal, goalKcal }: Props) {
  if (slices.length === 0) {
    return (
      <View className="items-center py-4">
        <Text className="text-slate-400 text-sm">
          No entries yet — add food to see your macro breakdown
        </Text>
      </View>
    );
  }

  const pieData = slices.map((s) => ({
    value: s.value,
    color: s.color,
    text: `${s.value}%`,
  }));

  return (
    <View className="items-center py-2">
      <PieChart
        data={pieData}
        donut
        radius={80}
        innerRadius={55}
        centerLabelComponent={() => (
          <View className="items-center">
            <Text className="text-lg font-semibold text-slate-800">{totalKcal}</Text>
            <Text className="text-xs text-slate-400">kcal</Text>
            {goalKcal ? (
              <Text className="text-xs text-slate-400">/ {goalKcal}</Text>
            ) : null}
          </View>
        )}
      />
      <View className="flex-row flex-wrap justify-center gap-3 mt-3">
        {slices.map((s) => (
          <View key={s.label} className="flex-row items-center gap-1">
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: s.color,
              }}
            />
            <Text className="text-xs text-slate-600">
              {s.label} {s.grams}g
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
