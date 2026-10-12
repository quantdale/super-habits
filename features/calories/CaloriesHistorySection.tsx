import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { SectionLabel } from '@/core/ui/SectionLabel';
import { Text } from '@/core/ui/Text';
import { DailyCalorieChart } from './DailyCalorieChart';
import { MacroTrendChart } from './MacroTrendChart';
import { GitHubHeatmap } from '@/features/shared/GitHubHeatmap';
import { formatKcal } from './caloriesFormat';
import type { HeatmapDay } from '@/features/shared/activityTypes';
import type { DailySummary } from './types';
import type { DailyTrendPoint } from './calories.domain';

type Props = {
  open: boolean;
  onToggle: () => void;
  accentColor: string;
  /** Precomputed while the disclosure is open (null while closed). */
  dailyTrend: DailyTrendPoint[] | null;
  summaries: DailySummary[];
  heatmapDays: HeatmapDay[] | null;
  goalKcal: number;
  daysLogged: number;
  averageKcal: number;
};

/**
 * Historical trends behind one disclosure (V3 W10, R5 "history elsewhere").
 * The rolling derivations only run while this section is open, so the logging
 * surface's refresh cost stays bounded; the numbers are identical once open.
 */
export function CaloriesHistorySection({
  open,
  onToggle,
  accentColor,
  dailyTrend,
  summaries,
  heatmapDays,
  goalKcal,
  daysLogged,
  averageKcal,
}: Props) {
  const { tokens } = useAppTheme();

  return (
    <ScreenSection className="mb-0">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel="History and insights"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center justify-between gap-3 py-2"
      >
        <View className="min-w-0 flex-1">
          <SectionLabel className="mb-0">History &amp; insights</SectionLabel>
          <Text variant="caption" tone="muted" className="mt-1">
            {daysLogged > 0
              ? `${daysLogged} day${daysLogged === 1 ? '' : 's'} logged · ${formatKcal(
                  averageKcal,
                )} kcal average · last 52 weeks`
              : 'Your intake history and weekly activity appear here.'}
          </Text>
        </View>
        <MaterialIcons
          name={open ? 'expand-less' : 'expand-more'}
          size={22}
          color={tokens.iconMuted}
        />
      </Pressable>

      {open ? (
        <View className="mt-2">
          {daysLogged === 0 ? (
            <EmptyStateCard
              accentColor={accentColor}
              className="mb-4"
              title="Log food to start tracking"
              description="Your daily trend, macro averages, and yearly activity map appear here."
            />
          ) : null}
          <Card variant="header" headerTitle="Daily calories" className="mb-4">
            {dailyTrend ? <DailyCalorieChart data={dailyTrend} goalKcal={goalKcal} /> : null}
          </Card>
          <Card variant="header" headerTitle="Macro trends" className="mb-4">
            <MacroTrendChart summaries={summaries} />
          </Card>
          <Card variant="header" headerTitle="Calories history" className="mb-0">
            <View className="w-full min-w-0 items-center justify-center">
              {heatmapDays ? (
                <GitHubHeatmap days={heatmapDays} color={accentColor} weeks={53} />
              ) : null}
            </View>
          </Card>
        </View>
      ) : null}
    </ScreenSection>
  );
}
