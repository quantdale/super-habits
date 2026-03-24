import React, { useLayoutEffect, useRef } from "react";
import { Platform, View, Text } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { SECTION_COLORS } from "@/constants/sectionColors";
import {
  HorizontalScrollArea,
  type HorizontalScrollAreaHandle,
} from "@/core/ui/HorizontalScrollArea";
import type { DailyTrendPoint } from "./calories.domain";

type Props = {
  data: DailyTrendPoint[];
  goalKcal?: number;
};

/** Fixed geometry: chart scrolls horizontally (same idea as the calories heatmap strip). */
const BAR_WIDTH = 18;
const SPACING = 8;

/** Ignore absurd single-day totals so the Y scale and goal line stay readable. */
const DAILY_CHART_MAX_KCAL = 12_000;

function formatKcalTopLabel(kcal: number): string {
  if (kcal <= 0) return "";
  if (kcal < 10_000) return String(Math.round(kcal));
  if (kcal < 1_000_000) return `${Math.round(kcal / 1000)}k`;
  return `${(kcal / 1_000_000).toFixed(1)}M`;
}

function chartContentWidth(barCount: number): number {
  const n = Math.max(1, barCount);
  return n * BAR_WIDTH + (n - 1) * SPACING;
}

export function DailyCalorieChart({ data, goalKcal }: Props) {
  const scrollRef = useRef<HorizontalScrollAreaHandle>(null);

  const chartWidth = chartContentWidth(data.length);

  const peakKcal = data.length ? Math.max(...data.map((d) => d.value), 0) : 0;
  const cappedPeak = Math.min(peakKcal, DAILY_CHART_MAX_KCAL);
  const maxValue = Math.max(goalKcal ?? 0, 500, cappedPeak);

  const barData = data.map((d) => {
    const barValue = Math.min(d.value, maxValue);
    return {
      value: barValue,
      label: d.label,
      frontColor: d.value === 0 ? "#e2e8f0" : SECTION_COLORS.calories,
      topLabelComponent: () =>
        d.value > 0 ? (
          <Text style={{ fontSize: 9, color: "#64748b", marginBottom: 2 }}>
            {formatKcalTopLabel(d.value)}
          </Text>
        ) : null,
    };
  });

  useLayoutEffect(() => {
    const run = () => scrollRef.current?.scrollToEnd({ animated: false });
    if (Platform.OS === "web") {
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(run);
      });
      return () => cancelAnimationFrame(raf);
    }
    run();
  }, [data, goalKcal, chartWidth]);

  return (
    <View className="w-full min-w-0 py-2">
      <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 8 }}>
        Year trend (daily)
      </Text>
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
            xAxisLabelTextStyle={{ color: "#94a3b8", fontSize: 9 }}
            noOfSections={4}
            maxValue={maxValue}
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
            width={chartWidth}
            height={160}
            isAnimated
          />
        </View>
      </HorizontalScrollArea>
    </View>
  );
}
