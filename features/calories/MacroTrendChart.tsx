import { Text } from '@/core/ui/Text';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useAppTheme } from '@/core/providers/themeContext';
import { fonts } from '@/core/theme/designTokens';
import { SegmentedControl } from '@/core/ui/SegmentedControl';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { buildMacroTrendPoints, summarizeMacroTrend } from './calories.domain';
import type { DailySummary } from './types';

const COLOR = SECTION_COLORS.calories;

const WINDOW_OPTIONS = [7, 30] as const;

type WindowDays = (typeof WINDOW_OPTIONS)[number];

function WindowToggle({
  value,
  onChange,
}: {
  value: WindowDays;
  onChange: (next: WindowDays) => void;
}) {
  return (
    <SegmentedControl
      options={WINDOW_OPTIONS.map((option) => ({
        value: String(option),
        label: `${option}d`,
        accessibilityLabel: `${option}-day trend`,
      }))}
      value={String(value)}
      onChange={(next) => onChange(Number(next) as WindowDays)}
      accentColor={COLOR}
      accessibilityLabel="Macro trend window"
    />
  );
}

/**
 * Rolling 7/30-day macro trend: per-day kcal bars with the window average
 * overlaid, plus informational macro averages. Purely informational — no
 * medical or dietary guidance is implied.
 */
export function MacroTrendChart({ summaries }: { summaries: DailySummary[] }) {
  const { tokens } = useAppTheme();
  const [windowDays, setWindowDays] = useState<WindowDays>(7);

  const points = useMemo(
    () => buildMacroTrendPoints(summaries, windowDays),
    [summaries, windowDays],
  );
  const summary = useMemo(() => summarizeMacroTrend(points), [points]);

  const barData = points.map((p) => ({
    value: p.calories,
    label: p.label,
    frontColor: p.calories === 0 ? tokens.border : COLOR,
    topLabelComponent: () =>
      p.calories > 0 ? (
        <Text style={{ fontSize: 8, color: tokens.textMuted, marginBottom: 2 }}>
          {Math.round(p.calories)}
        </Text>
      ) : null,
  }));

  const maxValue = Math.max(summary.avgCalories * 1.4, 500, ...points.map((p) => p.calories));

  return (
    <View className="w-full">
      <View className="mb-2 flex-row items-center justify-between">
        <Text variant="label" tone="muted">
          Daily kcal ({windowDays}-day)
        </Text>
        <View className="w-[150px]">
          <WindowToggle value={windowDays} onChange={setWindowDays} />
        </View>
      </View>

      <BarChart
        data={barData}
        barWidth={windowDays === 7 ? 26 : 9}
        spacing={windowDays === 7 ? 10 : 3}
        roundedTop
        xAxisThickness={1}
        yAxisThickness={0}
        yAxisTextStyle={{ color: tokens.textMuted, fontSize: 10, fontFamily: fonts.semibold }}
        xAxisLabelTextStyle={{ color: tokens.textMuted, fontSize: 8, fontFamily: fonts.semibold }}
        noOfSections={4}
        maxValue={maxValue}
        referenceLine1Position={summary.avgCalories > 0 ? summary.avgCalories : undefined}
        referenceLine1Config={
          summary.avgCalories > 0
            ? { color: tokens.textMuted, dashWidth: 4, dashGap: 4, thickness: 1 }
            : undefined
        }
        rulesColor={tokens.border}
        rulesType="solid"
        width={windowDays === 7 ? 7 * 36 : 30 * 12}
        height={140}
        isAnimated
      />

      <View className="mt-1 flex-row items-center gap-1 px-1">
        <View style={{ width: 16, height: 1.5, backgroundColor: tokens.textMuted }} />
        <Text className="text-xs" style={{ color: tokens.textMuted }}>
          Avg {summary.avgCalories} kcal/day · logged {summary.daysWithData}/{summary.windowDays}{' '}
          days
        </Text>
      </View>

      <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-1">
        <Text className="text-xs" style={{ color: tokens.textMuted }}>
          Protein avg {summary.avgProtein}g
        </Text>
        <Text className="text-xs" style={{ color: tokens.textMuted }}>
          Carbs avg {summary.avgCarbs}g
        </Text>
        <Text className="text-xs" style={{ color: tokens.textMuted }}>
          Fats avg {summary.avgFats}g
        </Text>
      </View>
    </View>
  );
}
