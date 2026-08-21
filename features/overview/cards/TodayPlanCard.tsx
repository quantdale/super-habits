import { Text, View } from 'react-native';

import { useAppTheme } from '@/core/providers/themeContext';

import type { PlanProgressSummary } from '../overview.domain';
import { OVERVIEW_CARD_META } from '../overviewCards';
import { CardEmptyMessage, DashboardCard } from './DashboardCard';

const STATUS_LABELS: Record<NonNullable<PlanProgressSummary['status']>, string> = {
  draft: 'Draft',
  committed: 'Committed',
  completed: 'Completed',
};

export function TodayPlanCard({
  summary,
  loading,
}: {
  summary: PlanProgressSummary;
  loading: boolean;
}) {
  const { tokens } = useAppTheme();

  return (
    <DashboardCard
      meta={OVERVIEW_CARD_META.plan}
      loading={loading}
      empty={
        summary.hasPlan ? undefined : (
          <CardEmptyMessage
            title="No plan yet"
            description="Open Plan today to set your top priorities."
          />
        )
      }
    >
      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-lg font-semibold tabular-nums" style={{ color: tokens.text }}>
            {summary.completedPriorities} / {summary.totalPriorities} priorities
          </Text>
          {summary.status ? (
            <View
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: `${tokens.text}14` }}
            >
              <Text className="text-xs font-semibold" style={{ color: tokens.textMuted }}>
                {STATUS_LABELS[summary.status]}
              </Text>
            </View>
          ) : null}
        </View>
        {summary.intention ? (
          <Text
            className="text-sm italic leading-5"
            style={{ color: tokens.textMuted }}
            numberOfLines={2}
          >
            “{summary.intention}”
          </Text>
        ) : null}
        {summary.totalPriorities > 0 ? (
          <View
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: tokens.surfaceElevated }}
          >
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.round((summary.completedPriorities / Math.max(1, summary.totalPriorities)) * 100)}%`,
                backgroundColor: OVERVIEW_CARD_META.plan.accentColor,
              }}
            />
          </View>
        ) : null}
      </View>
    </DashboardCard>
  );
}
