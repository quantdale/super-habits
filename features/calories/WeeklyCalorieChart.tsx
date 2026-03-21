import React from "react";
import { View, Text } from "react-native";
import { BarChart } from "react-native-gifted-charts";

type DayBar = {
  dateKey: string;
  value: number;
  label: string;
};

type Props = {
  data: DayBar[];
  goalKcal?: number;
};

export function WeeklyCalorieChart({ data, goalKcal }: Props) {
  const barData = data.map((d) => ({
    value: d.value,
    label: d.label,
    frontColor: d.value === 0 ? "#e2e8f0" : "#4f79ff",
    topLabelComponent: () =>
      d.value > 0 ? (
        <Text style={{ fontSize: 9, color: "#64748b", marginBottom: 2 }}>{d.value}</Text>
      ) : null,
  }));

  return (
    <View className="py-2">
      <Text className="text-xs text-slate-400 mb-2 px-1">Last 7 days</Text>
      <BarChart
        data={barData}
        barWidth={32}
        spacing={8}
        roundedTop
        xAxisThickness={1}
        yAxisThickness={0}
        yAxisTextStyle={{ color: "#94a3b8", fontSize: 10 }}
        xAxisLabelTextStyle={{ color: "#94a3b8", fontSize: 10 }}
        noOfSections={4}
        maxValue={Math.max(goalKcal ?? 0, ...data.map((d) => d.value), 500)}
        referenceLine1Position={goalKcal}
        referenceLine1Config={
          goalKcal
            ? {
                color: "#f59e0b",
                dashWidth: 4,
                dashGap: 4,
                thickness: 1,
              }
            : undefined
        }
        hideRules={false}
        rulesColor="#f1f5f9"
        rulesType="solid"
        width={280}
        height={160}
        isAnimated
      />
      {goalKcal ? (
        <View className="flex-row items-center gap-1 mt-1 px-1">
          <View style={{ width: 16, height: 1.5, backgroundColor: "#f59e0b" }} />
          <Text className="text-xs text-amber-500">Goal: {goalKcal} kcal</Text>
        </View>
      ) : null}
    </View>
  );
}
