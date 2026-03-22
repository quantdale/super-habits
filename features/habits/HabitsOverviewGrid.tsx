import React from "react";
import { View, Text } from "react-native";
import { GitHubHeatmap, type HeatmapDay } from "@/features/shared/GitHubHeatmap";
import { SECTION_COLORS } from "@/constants/sectionColors";

type Props = {
  consistencyPercent: number;
  heatmapDays: HeatmapDay[];
};

export function HabitsOverviewGrid({
  consistencyPercent,
  heatmapDays,
}: Props) {
  return (
    <View className="mt-2">
      <View className="mb-4 flex-row items-center gap-2">
        <Text
          style={{
            fontSize: 28,
            fontWeight: "700",
            color: SECTION_COLORS.habits,
          }}
        >
          {consistencyPercent}%
        </Text>
        <Text style={{ fontSize: 14, color: "#94a3b8" }}>consistency — last year</Text>
      </View>

      <GitHubHeatmap
        days={heatmapDays}
        color={SECTION_COLORS.habits}
        label="All habits — 52-week overview"
        weeks={52}
      />

      <View className="mt-3 flex-row flex-wrap items-center gap-3">
        {[
          { label: "None", color: "#e2e8f0" },
          { label: "Some", color: `${SECTION_COLORS.habits}55` },
          { label: "Most", color: `${SECTION_COLORS.habits}99` },
          { label: "All", color: SECTION_COLORS.habits },
        ].map((l) => (
          <View key={l.label} className="flex-row items-center gap-1">
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: l.color,
              }}
            />
            <Text style={{ fontSize: 11, color: "#94a3b8" }}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
