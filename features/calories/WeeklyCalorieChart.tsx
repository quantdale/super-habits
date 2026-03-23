import React, { useLayoutEffect, useRef } from "react";
import { Platform, View, Text } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { SECTION_COLORS } from "@/constants/sectionColors";
import {
  HorizontalScrollArea,
  type HorizontalScrollAreaHandle,
} from "@/core/ui/HorizontalScrollArea";

type WeekBar = {
  weekLabel: string;
  value: number;
};

type Props = {
  data: WeekBar[];
  goalKcal?: number;
};

const WEEKS = 52;
const BAR_WIDTH = 20;
const SPACING = 8;
const CHART_WIDTH = WEEKS * (BAR_WIDTH + SPACING);

export function WeeklyCalorieChart({ data, goalKcal }: Props) {
  const scrollRef = useRef<HorizontalScrollAreaHandle>(null);

  const barData = data.map((d) => ({
    value: d.value,
    label: d.weekLabel,
    frontColor: d.value === 0 ? "#e2e8f0" : SECTION_COLORS.calories,
    topLabelComponent: () =>
      d.value > 0 ? (
        <Text style={{ fontSize: 9, color: "#64748b", marginBottom: 2 }}>{d.value}</Text>
      ) : null,
  }));

  useLayoutEffect(() => {
    const run = () => scrollRef.current?.scrollToEnd({ animated: false });
    if (Platform.OS === "web") {
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(run);
      });
      return () => cancelAnimationFrame(raf);
    }
    run();
  }, [data, goalKcal]);

  return (
    <View className="w-full min-w-0 py-2">
      <HorizontalScrollArea
        ref={scrollRef}
        footer={
          goalKcal ? (
            <View className="mt-1 flex-row items-center gap-1 px-1">
              <View style={{ width: 16, height: 1.5, backgroundColor: SECTION_COLORS.calories }} />
              <Text className="text-xs text-amber-500">Goal: {goalKcal} kcal</Text>
            </View>
          ) : null
        }
      >
        <View style={{ alignSelf: "flex-start" }}>
          <BarChart
            data={barData}
            barWidth={BAR_WIDTH}
            spacing={SPACING}
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
                    color: SECTION_COLORS.calories,
                    dashWidth: 4,
                    dashGap: 4,
                    thickness: 1,
                  }
                : undefined
            }
            hideRules={false}
            rulesColor="#f1f5f9"
            rulesType="solid"
            width={CHART_WIDTH}
            height={160}
            isAnimated
          />
        </View>
      </HorizontalScrollArea>
    </View>
  );
}
