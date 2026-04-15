import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { View, Text } from "react-native";
import { Card } from "@/core/ui/Card";
import type { HeatmapDay } from "@/features/shared/activityTypes";
import { GitHubHeatmap } from "@/features/shared/GitHubHeatmap";
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
    <View className="w-full items-center">
      <Card
        variant="standard"
        accentColor={SECTION_COLORS.habits}
        className="w-full max-w-full"
        innerClassName="p-0"
      >
        <View className="w-full min-w-0 p-4">
          <View className="mb-4 flex-row items-start gap-3">
            <View
              className="h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${SECTION_COLORS.habits}18` }}
            >
              <MaterialIcons
                name="track-changes"
                size={22}
                color={SECTION_TEXT_COLORS.habits}
              />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-base font-semibold text-slate-900">Consistency</Text>
              <Text className="mt-0.5 text-sm text-slate-500">All habits over the last 52 weeks</Text>
            </View>
            <View className="items-end">
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "700",
                  color: SECTION_TEXT_COLORS.habits,
                }}
              >
                {consistencyPercent}%
              </Text>
            </View>
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
      </Card>
    </View>
  );
}

export const HabitsOverviewGrid = React.memo(HabitsOverviewGridInner);
