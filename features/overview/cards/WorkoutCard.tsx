import { Text, View } from 'react-native';

import { useAppTheme } from '@/core/providers/themeContext';

import type { WorkoutSummary } from '../overview.domain';
import { OVERVIEW_CARD_META } from '../overviewCards';
import { CardEmptyMessage, DashboardCard } from './DashboardCard';

export function WorkoutCard({ summary, loading }: { summary: WorkoutSummary; loading: boolean }) {
  const { tokens } = useAppTheme();

  return (
    <DashboardCard
      meta={OVERVIEW_CARD_META.workout}
      loading={loading}
      empty={
        summary.sessionsThisWeek === 0 && summary.lastWorkoutDateKey === null ? (
          <CardEmptyMessage
            title="No workouts yet"
            description="Log a session to see your week here."
          />
        ) : undefined
      }
    >
      <View className="gap-2">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-3xl font-bold tabular-nums" style={{ color: tokens.text }}>
            {summary.sessionsThisWeek}
          </Text>
          <Text className="text-sm font-semibold" style={{ color: tokens.textMuted }}>
            sessions this week
          </Text>
        </View>
        {summary.lastWorkoutName ? (
          <Text className="text-sm" style={{ color: tokens.textMuted }} numberOfLines={1}>
            Last: {summary.lastWorkoutName} ({summary.lastWorkoutDateKey})
          </Text>
        ) : summary.lastWorkoutDateKey ? (
          <Text className="text-sm" style={{ color: tokens.textMuted }}>
            Last session: {summary.lastWorkoutDateKey}
          </Text>
        ) : null}
      </View>
    </DashboardCard>
  );
}
