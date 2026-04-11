import React from "react";
import { View, Text } from "react-native";
import { FeaturePanel } from "@/core/ui/FeaturePanel";
import { GitHubHeatmap, type HeatmapDay } from "@/features/shared/GitHubHeatmap";
import { SECTION_COLORS, SECTION_TEXT_COLORS } from "@/constants/sectionColors";

type Props = {
  consistencyPercent: number;
  heatmapDays: HeatmapDay[];
};

const HEATMAP_LEGEND: Array<{ label: string; color: string }> = [
  { label: "None", color: "#e2e8f0" },
  { label: "Some", color: `${SECTION_COLORS.habits}55` },
  { label: "Most", color: `${SECTION_COLORS.habits}99` },
  { label: "All", color: SECTION_COLORS.habits },
];

function HabitsOverviewGridInner({ consistencyPercent, heatmapDays }: Props) {
  return (
    <FeaturePanel
      title="Consistency"
      subtitle="Last 52 weeks"
      icon="calendar-view-week"
      accentColor={SECTION_COLORS.habits}
      textColor={SECTION_TEXT_COLORS.habits}
      className="w-full"
    >
      <View className="w-full min-w-0 items-center justify-center">
        <View className="mb-4 w-full flex-row items-center gap-2">
          <Text
            style={{
              fontSize: 28,
              fontWeight: "700",
              color: SECTION_TEXT_COLORS.habits,
            }}
          >
            {consistencyPercent}%
          </Text>
          <Text style={{ fontSize: 14, color: "#94a3b8" }}>consistent year to date</Text>
        </View>

        <GitHubHeatmap
          days={heatmapDays}
          color={SECTION_COLORS.habits}
          label="All habits — 52-week overview"
          weeks={52}
        />

        <View className="mt-3 w-full flex-row flex-wrap items-center gap-3">
          {HEATMAP_LEGEND.map((l) => (
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
    </FeaturePanel>
  );
}

export const HabitsOverviewGrid = React.memo(HabitsOverviewGridInner);
