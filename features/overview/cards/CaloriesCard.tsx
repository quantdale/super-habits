import { Text, View } from 'react-native';

import { useAppTheme } from '@/core/providers/themeContext';

import type { CaloriesSummary } from '../overview.domain';
import { OVERVIEW_CARD_META } from '../overviewCards';
import { CardEmptyMessage, DashboardCard } from './DashboardCard';

export function CaloriesCard({ summary, loading }: { summary: CaloriesSummary; loading: boolean }) {
  const { tokens } = useAppTheme();
  const accent = OVERVIEW_CARD_META.calories.accentColor;
  const over = summary.consumed > summary.goal && summary.goal > 0;

  return (
    <DashboardCard
      meta={OVERVIEW_CARD_META.calories}
      loading={loading}
      empty={
        summary.consumed === 0 ? (
          <CardEmptyMessage
            title="Nothing logged today"
            description="Add an entry to track today's intake."
          />
        ) : undefined
      }
    >
      <View className="gap-3">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-2xl font-bold tabular-nums" style={{ color: tokens.text }}>
            {summary.consumed}
          </Text>
          <Text className="text-sm font-semibold" style={{ color: tokens.textMuted }}>
            / {summary.goal} kcal
          </Text>
        </View>
        <View
          className="h-2 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: tokens.surfaceElevated }}
        >
          <View
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.round(summary.ratio * 100))}%`,
              backgroundColor: over ? '#EF4444' : accent,
            }}
          />
        </View>
        <Text className="text-xs" style={{ color: tokens.textMuted }}>
          {over
            ? `${summary.consumed - summary.goal} kcal over target`
            : `${summary.remaining} kcal remaining`}
        </Text>
      </View>
    </DashboardCard>
  );
}
