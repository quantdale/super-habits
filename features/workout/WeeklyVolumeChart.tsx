import React from 'react';
import { Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useAppTheme } from '@/core/providers/themeContext';
import type { WeeklyVolumePoint } from './workout.domain';
import { SECTION_COLORS } from '@/constants/sectionColors';

const COLOR = SECTION_COLORS.workout;

type Props = {
  data: WeeklyVolumePoint[];
};

/** Sets-per-week bar chart over the last N weeks (oldest first). */
export function WeeklyVolumeChart({ data }: Props) {
  const { tokens } = useAppTheme();

  if (data.length === 0) {
    return (
      <Text className="text-sm" style={{ color: tokens.textMuted }}>
        No weeks to chart yet.
      </Text>
    );
  }

  const peak = Math.max(...data.map((d) => d.totalSets), 1);
  const barData = data.map((point) => ({
    value: point.totalSets,
    label: point.weekStartKey,
    frontColor: point.totalSets > 0 ? COLOR : tokens.border,
    topLabelComponent: () =>
      point.totalSets > 0 ? (
        <Text className="text-xs" style={{ color: tokens.textMuted }}>
          {point.totalSets}
        </Text>
      ) : null,
    labelTextStyle: { color: tokens.textMuted, fontSize: 10 },
  }));

  return (
    <View className="w-full">
      <BarChart
        data={barData}
        barWidth={26}
        spacing={12}
        roundedTop
        roundedBottom
        hideRules
        hideYAxisText
        yAxisThickness={0}
        xAxisThickness={0}
        noOfSections={Math.min(4, peak)}
        maxValue={peak}
        isAnimated
        disableScroll
      />
      <View className="mt-1 flex-row justify-between">
        {data.map((point) => (
          <Text
            key={point.weekStartKey}
            className="text-[10px]"
            style={{ color: tokens.textMuted }}
          >
            {point.label}
          </Text>
        ))}
      </View>
      <Text className="mt-2 text-xs" style={{ color: tokens.textMuted }}>
        Completed sets per week (last {data.length} weeks)
      </Text>
    </View>
  );
}
