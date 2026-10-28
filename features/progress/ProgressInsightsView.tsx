import { Text } from '@/core/ui/Text';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { PillChip } from '@/core/ui/PillChip';
import { SectionLabel } from '@/core/ui/SectionLabel';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { spacing } from '@/core/theme/designTokens';
import { useForegroundRefresh } from '@/lib/useForegroundRefresh';
import { useGuardedAsyncRefresh } from '@/lib/useGuardedAsyncRefresh';
import { buildProgressSummary } from '@/features/progress/progress.summary';
import { PROGRESS_WINDOW_OPTIONS } from '@/features/progress/progress.domain';
import { buildProgressNarrative } from '@/features/progress/progress.narrative';
import type { ProgressPeriodStat, ProgressSummary } from '@/features/progress/progress.types';

type MetricRow = {
  key: string;
  label: string;
  stat: ProgressPeriodStat;
  unit?: string;
};

/**
 * Metric rows in a stable, meaningful order. Each row carries its own unit so
 * focus minutes are never conflated with focus sessions, and tracking days are
 * never presented as a target (design D12.4).
 */
function metricRows(summary: ProgressSummary): MetricRow[] {
  return [
    { key: 'todos', label: 'Tasks completed', stat: summary.todosCompleted },
    { key: 'habits', label: 'Habit check-ins', stat: summary.habitCompletions },
    { key: 'focusMinutes', label: 'Focus minutes', stat: summary.focusMinutes, unit: 'min' },
    { key: 'focusSessions', label: 'Focus sessions', stat: summary.focusSessions },
    { key: 'workouts', label: 'Workouts', stat: summary.workoutSessions },
    { key: 'calorieDays', label: 'Days tracked (calories)', stat: summary.calorieTrackingDays },
    { key: 'reviews', label: 'Weekly reviews', stat: summary.weeklyReviewsCompleted },
  ];
}

/**
 * Which metric a narrative line is about, so the headline row order follows the
 * story rather than a hardcoded card order (design D12.4).
 */
const NARRATIVE_METRIC_ORDER: { match: RegExp; key: string }[] = [
  { match: /habit check-ins/i, key: 'habits' },
  { match: /focused for/i, key: 'focusMinutes' },
  { match: /workouts/i, key: 'workouts' },
  { match: /completed .* tasks/i, key: 'todos' },
];

export function ProgressInsightsView() {
  const { tokens } = useAppTheme();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<number>(7);
  const [showDetails, setShowDetails] = useState(false);
  // F8: the hub stays mounted across midnight — reload when the local day rolls over.
  const dayGeneration = useDayRolloverGeneration();

  const { begin } = useGuardedAsyncRefresh();

  const load = useCallback(
    async (days: number) => {
      // One guard instance per refresh unit (audit C §12): switching the window
      // or crossing local midnight mid-flight must not let the stale run write
      // its summary (or clear the newer load's spinner) over fresher state.
      const isCurrent = begin();
      setIsLoading(true);
      try {
        const nextSummary = await buildProgressSummary(days);
        if (!isCurrent()) return;
        setSummary(nextSummary);
        setLoadError(null);
      } catch (err) {
        if (!isCurrent()) return;
        // F8: no unhandled rejections; a failed load must not read as
        // "No progress data yet". The error panel below offers a retry.
        console.error('[ProgressInsightsView] load failed', err);
        setLoadError(err instanceof Error ? err.message : 'Could not load progress insights.');
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [begin],
  );

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

  // Blueprint §9: factual observations above the charts; empty when there is
  // nothing honest to say.
  const narrative = useMemo(() => (summary ? buildProgressNarrative(summary) : []), [summary]);

  const rows = useMemo(() => (summary ? metricRows(summary) : []), [summary]);

  // Headlines = one row per metric the narrative actually talks about, in the
  // narrative's order, capped at three. No metric is invented to fill a slot.
  const headlineRows = useMemo(() => {
    const picked: MetricRow[] = [];
    for (const line of narrative) {
      const match = NARRATIVE_METRIC_ORDER.find((m) => m.match.test(line));
      if (!match) continue;
      const row = rows.find((r) => r.key === match.key);
      if (row && !picked.some((p) => p.key === row.key)) picked.push(row);
    }
    return picked.slice(0, 3);
  }, [narrative, rows]);

  const headlineKeys = new Set(headlineRows.map((r) => r.key));
  const detailRows = rows.filter((r) => !headlineKeys.has(r.key));

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
      />
    );
  }

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
            accessibilityLabel={`Show the last ${days} days`}
            active={windowDays === days}
            color={SECTION_COLORS.todos}
            onPress={() => setWindowDays(days)}
          />
        ))}
      </View>

      {summary ? (
        <Text className="text-xs" style={{ color: tokens.textMuted }}>
          Last {summary.windowDays} days ({summary.range.currentStart} → {summary.range.currentEnd}
          ), compared with {summary.range.previousStart} → {summary.range.previousEnd}
        </Text>
      ) : null}

      {narrative.length > 0 ? (
        <View className="gap-1.5">
          {narrative.map((line, i) => (
            <Text key={`${i}-${line}`} className="text-sm" style={{ color: tokens.text }}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      {headlineRows.length > 0 ? (
        <View className="gap-2">
          <SectionLabel>Highlights</SectionLabel>
          <Card innerClassName="p-0">
            {headlineRows.map((row, index) => (
              <MetricRowView
                key={row.key}
                row={row}
                isFirst={index === 0}
                borderColor={tokens.border}
              />
            ))}
          </Card>
        </View>
      ) : null}

      {/* One accessible disclosure for the remaining metrics and planning. The
          brief allows only this — not an inscrutable icon hiding everything. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showDetails ? 'Hide metric details' : 'Show metric details'}
        accessibilityState={{ expanded: showDetails }}
        aria-expanded={showDetails}
        className="min-h-11 self-start justify-center rounded-xl border px-3"
        style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
        onPress={() => setShowDetails((open) => !open)}
      >
        <Text className="text-sm" style={{ color: tokens.text }}>
          More details {showDetails ? '−' : '+'}
        </Text>
      </Pressable>

      {showDetails ? (
        <View className="gap-3">
          <Card innerClassName="p-0">
            {detailRows.map((row, index) => (
              <MetricRowView
                key={row.key}
                row={row}
                isFirst={index === 0}
                borderColor={tokens.border}
              />
            ))}
          </Card>
          {summary ? (
            <View className="gap-1">
              <SectionLabel>Planning</SectionLabel>
              <Card innerClassName="p-0">
                <DetailRow label="Active projects" value={String(summary.activeProjects)} />
                <DetailRow label="Active goals" value={String(summary.activeGoals)} />
                <DetailRow
                  label="Average goal progress"
                  value={`${summary.goalsAverageProgress}%`}
                />
                <DetailRow label="Calorie goal" value={`${summary.calorieGoal} kcal`} />
              </Card>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * One metric row: label, current value with unit, and the prior-window
 * comparison. A zero prior window renders `new this period` rather than a
 * fabricated percentage, and a decrease is stated numerically — never painted
 * as failure (design D12.4).
 */
function MetricRowView({
  row,
  isFirst,
  borderColor,
}: {
  row: MetricRow;
  isFirst: boolean;
  borderColor: string;
}) {
  const { tokens } = useAppTheme();
  // The narrative above already states the percentage change, so the row
  // carries the numeric anchor in words instead of repeating the same
  // percentage string twice within one viewport (W12 density goal).
  const comparison =
    row.stat.previous === 0
      ? row.stat.current === 0
        ? 'nothing in the prior period'
        : 'new this period'
      : row.stat.current > row.stat.previous
        ? `up from ${row.stat.previous}`
        : row.stat.current < row.stat.previous
          ? `down from ${row.stat.previous}`
          : `level with ${row.stat.previous}`;
  return (
    <View
      style={
        isFirst
          ? undefined
          : { borderTopWidth: 1, borderTopColor: borderColor, marginHorizontal: spacing.lg }
      }
    >
      <View className="flex-row items-center justify-between px-4 py-3" style={{ minHeight: 56 }}>
        <View className="min-w-0 flex-1">
          <Text className="text-sm" style={{ color: tokens.text }}>
            {row.label}
          </Text>
          <Text className="text-xs" style={{ color: tokens.textMuted }}>
            Prior: {row.stat.previous}
            {row.unit ? ` ${row.unit}` : ''}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-base font-bold tabular-nums" style={{ color: tokens.text }}>
            {row.stat.current}
            {row.unit ? ` ${row.unit}` : ''}
          </Text>
          <Text className="text-xs" style={{ color: tokens.textMuted }}>
            {comparison}
          </Text>
        </View>
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { tokens } = useAppTheme();
  return (
    <View className="flex-row items-center justify-between px-4 py-3" style={{ minHeight: 48 }}>
      <Text className="text-sm" style={{ color: tokens.textMuted }}>
        {label}
      </Text>
      <Text className="text-sm font-medium tabular-nums" style={{ color: tokens.text }}>
        {value}
      </Text>
    </View>
  );
}
