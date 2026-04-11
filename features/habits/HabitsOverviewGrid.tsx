import React from "react";
import { View, Text } from "react-native";
import { FeaturePanel } from "@/core/ui/FeaturePanel";
import { GitHubHeatmap, type HeatmapDay } from "@/features/shared/GitHubHeatmap";
import { SECTION_COLORS } from "@/constants/sectionColors";
import { useAppTheme } from "@/core/theme";

type Props = {
  consistencyPercent: number;
  heatmapDays: HeatmapDay[];
};

function HabitsOverviewGridInner({ consistencyPercent, heatmapDays }: Props) {
  const { colors, getSectionColors } = useAppTheme();
  const section = getSectionColors("habits");
  const legend = [
    { label: "None", color: colors.progressTrack },
    { label: "Some", color: `${SECTION_COLORS.habits}55` },
    { label: "Most", color: `${SECTION_COLORS.habits}99` },
    { label: "All", color: SECTION_COLORS.habits },
  ];

  return (
    <FeaturePanel
      title="Consistency"
      subtitle="Last 52 weeks"
      icon="calendar-view-week"
      accentColor={SECTION_COLORS.habits}
<<<<<<< HEAD
      textColor={SECTION_TEXT_COLORS.habits}
=======
      textColor={section.text}
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
      className="w-full"
    >
      <View className="w-full min-w-0 items-center justify-center">
        <View className="mb-4 w-full flex-row items-center gap-2">
<<<<<<< HEAD
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
=======
          <Text style={{ fontSize: 28, fontWeight: "700", color: section.text }}>
            {consistencyPercent}%
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSubtle }}>consistent year to date</Text>
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
        </View>

        <GitHubHeatmap
          days={heatmapDays}
          color={SECTION_COLORS.habits}
          label="All habits — 52-week overview"
          weeks={52}
        />

        <View className="mt-3 w-full flex-row flex-wrap items-center gap-3">
<<<<<<< HEAD
          {HEATMAP_LEGEND.map((l) => (
=======
          {legend.map((l) => (
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
            <View key={l.label} className="flex-row items-center gap-1">
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: l.color,
                }}
              />
<<<<<<< HEAD
              <Text style={{ fontSize: 11, color: "#94a3b8" }}>{l.label}</Text>
=======
              <Text style={{ fontSize: 11, color: colors.textSubtle }}>{l.label}</Text>
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
            </View>
          ))}
        </View>
      </View>
    </FeaturePanel>
  );
}

export const HabitsOverviewGrid = React.memo(HabitsOverviewGridInner);
