import React from "react";
import { View, Text, ScrollView } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { SECTION_COLORS } from "@/constants/sectionColors";

type Props = {
  data: { dateKey: string; label: string; value: number }[];
};

export function WorkoutFrequencyChart({ data }: Props) {
  const chartData = [...data].reverse().map((d) => ({
    value: d.value,
    label: d.label,
    frontColor: d.value > 0 ? SECTION_COLORS.workout : "#e2e8f0",
    topLabelComponent: () =>
      d.value > 0 ? (
        <Text style={{ fontSize: 9, color: "#64748b", marginBottom: 2 }}>
          {d.value}
        </Text>
      ) : null,
  }));

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <BarChart
          data={chartData}
          barWidth={20}
          spacing={6}
          roundedTop
          xAxisThickness={1}
          yAxisThickness={0}
          yAxisTextStyle={{ color: "#94a3b8", fontSize: 9 }}
          xAxisLabelTextStyle={{ color: "#94a3b8", fontSize: 8 }}
          noOfSections={maxValue}
          maxValue={maxValue}
          hideRules={false}
          rulesColor="#f1f5f9"
          rulesType="solid"
          width={600}
          height={120}
          isAnimated
        />
      </ScrollView>
    </View>
  );
}
