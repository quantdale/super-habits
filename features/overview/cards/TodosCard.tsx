import { Text, View } from 'react-native';

import { SECTION_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';

import type { TodosSummary } from '../overview.domain';
import { OVERVIEW_CARD_META } from '../overviewCards';
import { CardEmptyMessage, DashboardCard } from './DashboardCard';

export function TodosCard({ summary, loading }: { summary: TodosSummary; loading: boolean }) {
  const { tokens } = useAppTheme();

  return (
    <DashboardCard
      meta={OVERVIEW_CARD_META.todos}
      loading={loading}
      empty={
        summary.pendingCount === 0 ? (
          <CardEmptyMessage title="All clear" description="No pending tasks right now." />
        ) : undefined
      }
    >
      <View className="gap-2">
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
          <Text className="text-lg font-semibold tabular-nums" style={{ color: tokens.text }}>
            {summary.pendingCount} pending
          </Text>
          {summary.overdueCount > 0 ? (
            <Text className="text-xs font-semibold text-red-500">
              {summary.overdueCount} overdue
            </Text>
          ) : null}
          {summary.dueTodayCount > 0 ? (
            <Text className="text-xs font-semibold" style={{ color: SECTION_COLORS.todos }}>
              {summary.dueTodayCount} due today
            </Text>
          ) : null}
        </View>
        {summary.preview.map((todo) => (
          <View key={todo.id} className="flex-row items-center gap-2.5">
            <View
              className="h-4 w-4 rounded border-2"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
            />
            <Text className="flex-1 text-sm" style={{ color: tokens.text }} numberOfLines={1}>
              {todo.title}
            </Text>
          </View>
        ))}
      </View>
    </DashboardCard>
  );
}
