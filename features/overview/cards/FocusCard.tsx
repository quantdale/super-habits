import { Text, View } from 'react-native';

import { useAppTheme } from '@/core/providers/themeContext';

import type { FocusWeekSummary } from '../overview.domain';
import { OVERVIEW_CARD_META } from '../overviewCards';
import { CardEmptyMessage, DashboardCard } from './DashboardCard';

export function FocusCard({ summary, loading }: { summary: FocusWeekSummary; loading: boolean }) {
  const { tokens } = useAppTheme();
  const maxMinutes = Math.max(1, ...summary.perDayMinutes.map((d) => d.minutes));
  const accent = OVERVIEW_CARD_META.focus.accentColor;

  return (
    <DashboardCard
      meta={OVERVIEW_CARD_META.focus}
      loading={loading}
      empty={
        summary.sessionCount === 0 ? (
          <CardEmptyMessage
            title="No focus yet"
            description="Start a session to build your week."
          />
        ) : undefined
      }
    >
      <View className="gap-3">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-3xl font-bold tabular-nums" style={{ color: tokens.text }}>
            {summary.focusMinutes}
          </Text>
          <Text className="text-sm font-semibold" style={{ color: tokens.textMuted }}>
            min · {summary.sessionCount} sessions this week
          </Text>
        </View>
        <View className="flex-row items-end gap-1.5" style={{ height: 56 }}>
          {summary.perDayMinutes.map((day) => (
            <View key={day.dateKey} className="flex-1 items-center gap-1">
              <View
                className="w-full rounded-t-md"
                style={{
                  height: Math.max(3, (day.minutes / maxMinutes) * 44),
                  backgroundColor: day.minutes > 0 ? accent : `${accent}33`,
                }}
              />
              <Text className="text-[9px]" style={{ color: tokens.textMuted }}>
                {day.dateKey.slice(8)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </DashboardCard>
  );
}
