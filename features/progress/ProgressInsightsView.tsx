import { useCallback, useEffect, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { PillChip } from '@/core/ui/PillChip';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { useForegroundRefresh } from '@/lib/useForegroundRefresh';
import { buildProgressSummary } from '@/features/progress/progress.summary';
import { pctDelta, PROGRESS_WINDOW_OPTIONS, trendOf } from '@/features/progress/progress.domain';
import type { ProgressSummary } from '@/features/progress/progress.types';

type StatCard = {
  label: string;
  current: number;
  previous: number;
  unit?: string;
  color: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

const TREND_ICON: Record<'up' | 'down' | 'flat', keyof typeof MaterialIcons.glyphMap> = {
  up: 'trending-up',
  down: 'trending-down',
  flat: 'trending-flat',
};

export function ProgressInsightsView() {
  const { tokens } = useAppTheme();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<number>(7);
  // F8: the hub stays mounted across midnight — reload when the local day rolls over.
  const dayGeneration = useDayRolloverGeneration();

  const load = useCallback(async (days: number) => {
    setIsLoading(true);
    try {
      setSummary(await buildProgressSummary(days));
      setLoadError(null);
    } catch (err) {
      // F8: no unhandled rejections; a failed load must not read as
      // "No progress data yet". The error panel below offers a retry.
      console.error('[ProgressInsightsView] load failed', err);
      setLoadError(err instanceof Error ? err.message : 'Could not load progress insights.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional async data-load
    void load(windowDays);
  }, [load, windowDays, dayGeneration]);

  // F8: refresh while the hub modal is open after backgrounding the app.
  useForegroundRefresh(
    useCallback(() => {
      void load(windowDays);
    }, [load, windowDays]),
  );

  if (loadError && !isLoading && !summary) {
    return (
      <View className="gap-3">
        <Text className="text-lg font-bold" style={{ color: tokens.text }}>
          Progress
        </Text>
        <Card
          variant="header"
          accentColor={tokens.textMuted}
          headerTitle="Progress is temporarily unavailable"
          headerSubtitle="Nothing was saved or changed."
          className="mb-0"
        >
          <View className="gap-3">
            <Text className="text-sm" style={{ color: tokens.textMuted }}>
              {loadError}
            </Text>
            <Button
              label="Try again"
              onPress={() => {
                void load(windowDays);
              }}
              color={tokens.textMuted}
            />
          </View>
        </Card>
      </View>
    );
  }

  if (!isLoading && !summary) {
    return (
      <EmptyStateCard
        accentColor={SECTION_COLORS.todos}
        title="No progress data yet"
        description="Complete tasks, habits, and sessions to start seeing weekly comparisons."
        icon={<Text style={{ fontSize: 18 }}>•</Text>}
      />
    );
  }

  const cards: StatCard[] = summary
    ? [
        {
          label: 'Tasks completed',
          current: summary.todosCompleted.current,
          previous: summary.todosCompleted.previous,
          color: SECTION_COLORS.todos,
          icon: 'check-circle',
        },
        {
          label: 'Habit completions',
          current: summary.habitCompletions.current,
          previous: summary.habitCompletions.previous,
          color: SECTION_COLORS.habits,
          icon: 'loop',
        },
        {
          label: 'Focus minutes',
          current: summary.focusMinutes.current,
          previous: summary.focusMinutes.previous,
          unit: 'min',
          color: SECTION_COLORS.focus,
          icon: 'timer',
        },
        {
          label: 'Workouts',
          current: summary.workoutSessions.current,
          previous: summary.workoutSessions.previous,
          color: SECTION_COLORS.workout,
          icon: 'fitness-center',
        },
        {
          label: 'Calorie days',
          current: summary.calorieTrackingDays.current,
          previous: summary.calorieTrackingDays.previous,
          color: SECTION_COLORS.calories,
          icon: 'restaurant-menu',
        },
        {
          label: 'Weekly reviews',
          current: summary.weeklyReviewsCompleted.current,
          previous: summary.weeklyReviewsCompleted.previous,
          color: SECTION_COLORS.focus,
          icon: 'date-range',
        },
      ]
    : [];

  return (
    <View className="gap-3">
      <Text className="text-lg font-bold" style={{ color: tokens.text }}>
        Progress
      </Text>
      <View className="flex-row flex-wrap">
        {PROGRESS_WINDOW_OPTIONS.map((days) => (
          <PillChip
            key={days}
            label={`${days}d`}
            active={windowDays === days}
            color={SECTION_COLORS.todos}
            onPress={() => setWindowDays(days)}
          />
        ))}
      </View>

      {summary ? (
        <Text className="text-xs" style={{ color: tokens.textMuted }}>
          Last {summary.windowDays} days ({summary.range.currentStart} → {summary.range.currentEnd})
          vs prior {summary.windowDays} days
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-3">
        {cards.map((card) => {
          const delta = pctDelta(card.current, card.previous);
          const trend = trendOf(card.current, card.previous);
          const trendColor =
            trend === 'up'
              ? SECTION_COLORS.habits
              : trend === 'down'
                ? tokens.dangerSolid
                : tokens.textMuted;
          return (
            <Card key={card.label} accentColor={card.color} className="flex-1" innerClassName="p-3">
              <View className="flex-row items-center gap-2">
                <Text style={{ fontSize: 18 }}>•</Text>
                <Text className="text-sm" style={{ color: tokens.textMuted }} numberOfLines={1}>
                  {card.label}
                </Text>
              </View>
              <View className="mt-2 flex-row items-center gap-2">
                <Text className="text-2xl font-bold tabular-nums" style={{ color: tokens.text }}>
                  {card.current}
                  {card.unit ? ` ${card.unit}` : ''}
                </Text>
                <MaterialIcons name={TREND_ICON[trend]} size={18} color={trendColor} />
              </View>
              <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
                Prior: {card.previous}
                {delta === null ? ' (new)' : ` · ${delta >= 0 ? '+' : ''}${delta}%`}
              </Text>
            </Card>
          );
        })}
      </View>

      {summary ? (
        <Card accentColor={SECTION_COLORS.todos} className="flex-1" innerClassName="p-3">
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            Planning
          </Text>
          <View className="mt-2 gap-1">
            <Text className="text-sm" style={{ color: tokens.text }}>
              Active projects: {summary.activeProjects}
            </Text>
            <Text className="text-sm" style={{ color: tokens.text }}>
              Active goals: {summary.activeGoals}
            </Text>
            <Text className="text-sm" style={{ color: tokens.text }}>
              Avg goal progress: {summary.goalsAverageProgress}%
            </Text>
            <Text className="text-sm" style={{ color: tokens.text }}>
              Calorie goal: {summary.calorieGoal} kcal
            </Text>
          </View>
        </Card>
      ) : null}
    </View>
  );
}
