import React, { useLayoutEffect, useRef } from "react";
import { Dimensions, Platform, View, Text } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { SECTION_COLORS, SECTION_TEXT_COLORS } from "@/constants/sectionColors";
import {
  HorizontalScrollArea,
  type HorizontalScrollAreaHandle,
} from "@/core/ui/HorizontalScrollArea";
import type { DailyTrendPoint } from "./calories.domain";

type Props = {
  data: DailyTrendPoint[];
  goalKcal?: number;
};

/** Padding/margins outside the scroll strip (screen + Card). */
const HORIZONTAL_INSET = 64;
/** One viewport shows this many daily bars at a time. */
const DAYS_PER_VIEWPORT = 30;
/** Show an x-axis label every N days to avoid overlap. */
const X_LABEL_EVERY_N = 7;

/** Ignore absurd single-day totals so the Y scale and goal line stay readable. */
const DAILY_CHART_MAX_KCAL = 12_000;

function formatKcalTopLabel(kcal: number): string {
  if (kcal <= 0) return "";
  if (kcal < 10_000) return String(Math.round(kcal));
  if (kcal < 1_000_000) return `${Math.round(kcal / 1000)}k`;
  return `${(kcal / 1_000_000).toFixed(1)}M`;
}

function chartContentWidth(barCount: number, barWidth: number, spacing: number): number {
  const n = Math.max(1, barCount);
  return n * barWidth + (n - 1) * spacing;
}

export function DailyCalorieChart({ data, goalKcal }: Props) {
  const scrollRef = useRef<HorizontalScrollAreaHandle>(null);

  const windowWidth = Dimensions.get("window").width;
  const availableWidth = Math.max(200, windowWidth - HORIZONTAL_INSET);
  const slotWidth = availableWidth / DAYS_PER_VIEWPORT;
  const barWidth = slotWidth * 0.6;
  const spacing = slotWidth * 0.4;

  const chartWidth = chartContentWidth(data.length, barWidth, spacing);

  const peakKcal = data.length ? Math.max(...data.map((d) => d.value), 0) : 0;
  const cappedPeak = Math.min(peakKcal, DAILY_CHART_MAX_KCAL);
  const maxValue = Math.max(goalKcal ?? 0, 500, cappedPeak);

  const barData = data.map((d, index) => {
    const barValue = Math.min(d.value, maxValue);
    return {
      value: barValue,
      label: index % X_LABEL_EVERY_N === 0 ? d.label : "",
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
              <Text className="text-xs" style={{ color: SECTION_TEXT_COLORS.calories }}>
                Goal: {goalKcal} kcal
              </Text>
            </View>
          ) : null
        }
      >
        <View style={{ alignSelf: "flex-start" }}>
          <BarChart
            data={barData}
            barWidth={barWidth}
            spacing={spacing}
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
