import { Text, View } from 'react-native';

import { useAppTheme } from '@/core/providers/themeContext';

import type { GoalsSummary } from '../overview.domain';
import { OVERVIEW_CARD_META } from '../overviewCards';
import { CardEmptyMessage, DashboardCard } from './DashboardCard';

export function GoalsCard({ summary, loading }: { summary: GoalsSummary; loading: boolean }) {
  const { tokens } = useAppTheme();
  const accent = OVERVIEW_CARD_META.goals.accentColor;

  return (
    <DashboardCard
      meta={OVERVIEW_CARD_META.goals}
      loading={loading}
      empty={
        summary.activeCount === 0 ? (
          <CardEmptyMessage
            title="No active goals"
            description="Set a goal in the planning hub to track progress."
          />
        ) : undefined
      }
    >
      <View className="gap-2">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-lg font-semibold tabular-nums" style={{ color: tokens.text }}>
            {summary.activeCount} active
          </Text>
          <Text className="text-xs" style={{ color: tokens.textMuted }}>
            avg {summary.averageProgress}% progress
          </Text>
        </View>
        {summary.preview.map((goal) => (
          <View key={goal.id} className="gap-1">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-sm" style={{ color: tokens.text }} numberOfLines={1}>
                {goal.title}
              </Text>
              <Text className="text-xs tabular-nums" style={{ color: tokens.textMuted }}>
                {goal.progressPercent}%
              </Text>
            </View>
            <View
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: tokens.surfaceElevated }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(0, goal.progressPercent))}%`,
                  backgroundColor: accent,
                }}
              />
            </View>
          </View>
        ))}
      </View>
    </DashboardCard>
  );
}
