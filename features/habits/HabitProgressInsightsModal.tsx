import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { Modal } from '@/core/ui/Modal';
import { getCompletionHistory } from '@/features/habits/habits.data';
import {
  calculateHabitProgressInsights,
  type HabitInsightRate,
  type HabitInsightTrendKind,
  type HabitProgressInsights,
} from '@/features/habits/habitInsights.domain';
import type { Habit } from '@/features/habits/types';
import { SECTION_COLORS } from '@/constants/sectionColors';

type HabitProgressInsightsModalProps = {
  visible: boolean;
  habit: Habit;
  onClose: () => void;
};

const TREND_LABELS: Record<HabitInsightTrendKind, string> = {
  improving: 'Improving',
  steady: 'Steady',
  declining: 'Declining',
  insufficient_data: 'Not enough data',
};

function rateDescription(rate: HabitInsightRate): string {
  if (rate.percentage === null) return `No scheduled history in the last ${rate.windowDays} days.`;
  return `${rate.completedOccurrences} of ${rate.eligibleOccurrences} scheduled occurrences complete (${rate.percentage} percent).`;
}

function rateAccessibleLabel(rate: HabitInsightRate): string {
  if (rate.percentage === null) return `Last ${rate.windowDays} days: no scheduled history.`;
  return `Last ${rate.windowDays} days scheduled completion rate: ${rate.percentage} percent, ${rate.completedOccurrences} of ${rate.eligibleOccurrences} scheduled occurrences complete. Actual count ${rate.actualTotal} against target total ${rate.targetTotal}.`;
}

function RateCard({ rate }: { rate: HabitInsightRate }) {
  const { tokens } = useAppTheme();
  const percentage = rate.percentage ?? 0;
  return (
    <Card accentColor={SECTION_COLORS.habits} className="mb-3">
      <View accessible accessibilityLabel={rateAccessibleLabel(rate)}>
        <View className="flex-row items-baseline justify-between gap-3">
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            Last {rate.windowDays} days
          </Text>
          <Text className="text-lg font-bold tabular-nums" style={{ color: SECTION_COLORS.habits }}>
            {rate.percentage === null ? '—' : `${rate.percentage}%`}
          </Text>
        </View>
        <View
          className="mt-2 h-2 overflow-hidden rounded-full"
          style={{ backgroundColor: tokens.border }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          <View
            className="h-full rounded-full"
            style={{
              width: `${percentage}%`,
              backgroundColor: SECTION_COLORS.habits,
            }}
          />
        </View>
        <Text className="mt-2 text-xs" style={{ color: tokens.textMuted }}>
          {rateDescription(rate)}
        </Text>
      </View>
    </Card>
  );
}

function trendDescription(insights: HabitProgressInsights): string {
  const { trend } = insights;
  if (trend.kind === 'insufficient_data') {
    return 'Trend: not enough scheduled history. Each comparison period needs at least two scheduled occurrences.';
  }
  return `Trend: ${TREND_LABELS[trend.kind]}. Recent scheduled rate ${trend.recentRate} percent versus ${trend.previousRate} percent in the preceding seven-day period.`;
}

function historyStatus(day: HabitProgressInsights['recentDays'][number]): {
  label: string;
  color: string;
} {
  if (!day.eligible) {
    return day.scheduled
      ? { label: 'Not yet eligible', color: 'textMuted' }
      : { label: 'Off day', color: 'textMuted' };
  }
  if (day.completed) return { label: 'Target met', color: 'success' };
  if (day.count > 0) return { label: 'In progress', color: 'warning' };
  return { label: 'Missed', color: 'dangerText' };
}

function HistoryRow({
  day,
  tokens,
}: {
  day: HabitProgressInsights['recentDays'][number];
  tokens: ReturnType<typeof useAppTheme>['tokens'];
}) {
  const status = historyStatus(day);
  const statusColor =
    status.color === 'success'
      ? tokens.successText
      : status.color === 'warning'
        ? tokens.warningText
        : status.color === 'dangerText'
          ? tokens.dangerText
          : tokens.textMuted;
  const accessibleLabel = `${day.dateKey}: ${status.label}. ${
    day.scheduled ? 'Scheduled' : 'Off day'
  }. Target ${day.targetPerDay}. Actual count ${day.count}.`;

  return (
    <View
      accessible
      accessibilityLabel={accessibleLabel}
      className="flex-row items-center justify-between gap-3 border-b py-3"
      style={{ borderColor: tokens.border }}
    >
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium" style={{ color: tokens.text }}>
          {day.dateKey}
        </Text>
        <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
          {day.scheduled ? `Target ${day.targetPerDay}` : 'Off day'} · Actual {day.count}
        </Text>
      </View>
      <Text className="text-xs font-semibold" style={{ color: statusColor }}>
        {status.label}
      </Text>
    </View>
  );
}

export function HabitProgressInsightsModal({
  visible,
  habit,
  onClose,
}: HabitProgressInsightsModalProps) {
  const { tokens } = useAppTheme();
  const [insights, setInsights] = useState<HabitProgressInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const load = async () => {
      try {
        const completions = await getCompletionHistory(habit.id);
        if (cancelled) return;
        setInsights(calculateHabitProgressInsights(habit, completions));
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load habit progress.');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [habit, visible]);

  return (
    <Modal visible={visible} onClose={onClose} title={`${habit.name} progress`} scroll>
      {!insights && !error ? (
        <View className="items-center py-8" accessible accessibilityLabel="Loading habit progress">
          <ActivityIndicator color={SECTION_COLORS.habits} />
          <Text className="mt-3 text-sm" style={{ color: tokens.textMuted }}>
            Loading progress…
          </Text>
        </View>
      ) : null}

      {error ? (
        <View accessible accessibilityRole="alert" className="py-4">
          <Text className="text-sm" style={{ color: tokens.dangerText }}>
            {error}
          </Text>
          <View className="mt-4">
            <Button label="Close" variant="ghost" onPress={onClose} />
          </View>
        </View>
      ) : null}

      {insights ? (
        <>
          <View
            accessible
            accessibilityLabel={`Current streak: ${insights.currentStreak} scheduled occurrences. Longest streak: ${insights.longestStreak} scheduled occurrences. ${insights.totalCompletedOccurrences} of ${insights.totalEligibleOccurrences} eligible scheduled occurrences complete.`}
            className="mb-4 rounded-2xl p-4"
            style={{ backgroundColor: `${SECTION_COLORS.habits}12` }}
          >
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              Consistency summary
            </Text>
            <Text className="mt-2 text-sm" style={{ color: tokens.text }}>
              Current streak: {insights.currentStreak} scheduled occurrence
              {insights.currentStreak === 1 ? '' : 's'}
            </Text>
            <Text className="mt-1 text-sm" style={{ color: tokens.text }}>
              Longest streak: {insights.longestStreak} scheduled occurrence
              {insights.longestStreak === 1 ? '' : 's'}
            </Text>
            <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
              {insights.totalCompletedOccurrences} of {insights.totalEligibleOccurrences} eligible
              scheduled occurrences complete · actual {insights.totalActual} of target{' '}
              {insights.totalTarget}
            </Text>
          </View>

          <Text className="mb-3 text-base font-semibold" style={{ color: tokens.text }}>
            Scheduled completion rate
          </Text>
          <RateCard rate={insights.last7} />
          <RateCard rate={insights.last30} />
          <RateCard rate={insights.last90} />

          <Card accentColor={SECTION_COLORS.habits} className="mb-4">
            <View accessible accessibilityLabel={trendDescription(insights)}>
              <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                Recent trend
              </Text>
              <Text className="mt-2 text-sm" style={{ color: tokens.text }}>
                {trendDescription(insights)}
              </Text>
            </View>
          </Card>

          <Text className="mb-2 text-base font-semibold" style={{ color: tokens.text }}>
            Recent target vs actual
          </Text>
          <Text className="mb-2 text-xs" style={{ color: tokens.textMuted }}>
            Scheduled rows use the target active on that date. Off-day activity is shown but stays
            neutral.
          </Text>
          <View
            accessible
            accessibilityLabel={`${insights.recentDays.length} recent habit history rows`}
          >
            {insights.recentDays.map((day) => (
              <HistoryRow key={day.dateKey} day={day} tokens={tokens} />
            ))}
          </View>
          <View className="mt-4">
            <Button label="Close" variant="ghost" onPress={onClose} />
          </View>
        </>
      ) : null}
    </Modal>
  );
}
