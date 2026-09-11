import { Text } from '@/core/ui/Text';
import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { radius } from '@/core/theme/designTokens';
import type { HeatmapDay } from '@/features/shared/activityTypes';
import { GitHubHeatmap } from '@/features/shared/GitHubHeatmap';
import { SECTION_COLORS } from '@/constants/sectionColors';

type Props = {
  consistencyPercent: number;
  heatmapDays: HeatmapDay[];
};

function HabitsOverviewGridInner({ consistencyPercent, heatmapDays }: Props) {
  const { tokens, sectionAccents } = useAppTheme();
  const heatmapLegend: { label: string; color: string }[] = [
    { label: 'None', color: tokens.surfaceSunken },
    { label: 'Some', color: `${SECTION_COLORS.habits}55` },
    { label: 'Most', color: `${SECTION_COLORS.habits}99` },
    { label: 'All', color: SECTION_COLORS.habits },
  ];

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
              className="h-11 w-11 items-center justify-center"
              style={{
                backgroundColor: sectionAccents.habits.tint,
                borderRadius: radius.md,
              }}
            >
              <MaterialIcons name="track-changes" size={22} color={sectionAccents.habits.text} />
            </View>
            <View className="min-w-0 flex-1">
              <Text variant="titleMd">Consistency</Text>
              <Text variant="bodyMd" tone="muted" style={{ marginTop: 2 }}>
                All habits over the last 52 weeks
              </Text>
            </View>
            <View className="items-end">
              <Text variant="metric" style={{ color: sectionAccents.habits.text }}>
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
            {heatmapLegend.map((l) => (
              <View key={l.label} className="flex-row items-center gap-1">
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: radius.full,
                    backgroundColor: l.color,
                  }}
                />
                <Text variant="caption" tone="muted">
                  {l.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Card>
    </View>
  );
}

export const HabitsOverviewGrid = React.memo(HabitsOverviewGridInner);
