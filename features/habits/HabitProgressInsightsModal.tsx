import { Text } from '@/core/ui/Text';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { Modal } from '@/core/ui/Modal';
import { StatBlock } from '@/core/ui/StatBlock';
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
  const { tokens, sectionAccents } = useAppTheme();
  const percentage = rate.percentage ?? 0;
  return (
    <Card accentColor={SECTION_COLORS.habits} className="mb-3">
      <View accessible accessibilityLabel={rateAccessibleLabel(rate)}>
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="titleMd">Last {rate.windowDays} days</Text>
          <Text variant="titleLg" style={{ color: sectionAccents.habits.text }}>
            {rate.percentage === null ? '—' : `${rate.percentage}%`}
          </Text>
        </View>
        <View
          className="mt-2 h-2 overflow-hidden rounded-full"
          style={{ backgroundColor: tokens.surfaceSunken }}
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
        <Text variant="caption" tone="muted" className="mt-2">
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
  // Neutral wording instead of danger-red: a past day without completion is
  // information, not failure (blueprint: consistency without guilt).
  return { label: 'Not completed', color: 'textMuted' };
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
        : tokens.textMuted;
  const accessibleLabel = `${day.dateKey}: ${status.label}. ${
    day.scheduled ? 'Scheduled' : 'Off day'
  }. Target ${day.targetPerDay}. Actual count ${day.count}.`;

  return (
    <View
      accessible
      accessibilityLabel={accessibleLabel}
      className="mb-2 flex-row items-center justify-between gap-3 rounded-2xl px-3 py-3"
      style={{ backgroundColor: tokens.surfaceSunken }}
    >
      <View className="min-w-0 flex-1">
        <Text variant="bodyMd" style={{ color: tokens.text }}>
          {day.dateKey}
        </Text>
        <Text variant="caption" tone="muted" className="mt-0.5">
          {day.scheduled ? `Target ${day.targetPerDay}` : 'Off day'} · Actual {day.count}
        </Text>
      </View>
      <Text variant="label" style={{ color: statusColor }}>
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
          <Text variant="bodyMd" tone="muted" className="mt-3">
            Loading progress…
          </Text>
        </View>
      ) : null}

      {error ? (
        <View accessible accessibilityRole="alert" className="py-4">
          <Text variant="bodyMd" style={{ color: tokens.dangerText }}>
            {error}
          </Text>
          <View className="mt-4">
            <Button label="Close" variant="ghost" onPress={onClose} />
          </View>
        </View>
      ) : null}

      {insights ? (
        <>
          <Card
            variant="header"
            accentColor={SECTION_COLORS.habits}
            headerTitle="Consistency summary"
            headerSubtitle="Streaks and eligible check-ins"
          >
            <View
              accessible
              accessibilityLabel={`Current streak: ${insights.currentStreak} scheduled occurrences. Longest streak: ${insights.longestStreak} scheduled occurrences. ${insights.totalCompletedOccurrences} of ${insights.totalEligibleOccurrences} eligible scheduled occurrences complete.`}
            >
              <View className="flex-row flex-wrap gap-3">
                <StatBlock
                  accentColor={SECTION_COLORS.habits}
                  className="min-w-[100px] flex-1"
                  value={insights.currentStreak}
                  label="Current streak"
                  detail="scheduled occurrences"
                />
                <StatBlock
                  accentColor={SECTION_COLORS.habits}
                  className="min-w-[100px] flex-1"
                  value={insights.longestStreak}
                  label="Longest streak"
                  detail="scheduled occurrences"
                />
                <StatBlock
                  accentColor={SECTION_COLORS.habits}
                  className="min-w-[100px] flex-1"
                  value={`${insights.totalCompletedOccurrences}/${insights.totalEligibleOccurrences}`}
                  label="Complete"
                  detail="eligible scheduled occurrences"
                />
              </View>
              <Text variant="bodyMd" style={{ color: tokens.text }}>
                Current streak: {insights.currentStreak} scheduled occurrence
                {insights.currentStreak === 1 ? '' : 's'}
              </Text>
              <Text variant="bodyMd" className="mt-1" style={{ color: tokens.text }}>
                Longest streak: {insights.longestStreak} scheduled occurrence
                {insights.longestStreak === 1 ? '' : 's'}
              </Text>
              <Text variant="caption" tone="muted" className="mt-3">
                {insights.totalCompletedOccurrences} of {insights.totalEligibleOccurrences} eligible
                scheduled occurrences complete · actual {insights.totalActual} of target{' '}
                {insights.totalTarget}
              </Text>
            </View>
          </Card>

          <Text variant="titleMd" className="mb-3">
            Scheduled completion rate
          </Text>
          <RateCard rate={insights.last7} />
          <RateCard rate={insights.last30} />
          <RateCard rate={insights.last90} />

          <Card
            variant="header"
            accentColor={SECTION_COLORS.habits}
            headerTitle="Recent trend"
            className="mb-4"
          >
            <View accessible accessibilityLabel={trendDescription(insights)}>
              <Text variant="bodyMd" style={{ color: tokens.text }}>
                {trendDescription(insights)}
              </Text>
            </View>
          </Card>

          <Text variant="titleMd" className="mb-2">
            Recent target vs actual
          </Text>
          <Text variant="caption" tone="muted" className="mb-2">
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
