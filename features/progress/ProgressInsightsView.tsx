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
import { ListGroup } from '@/core/ui/ListGroup';
import { ProgressBar } from '@/core/ui/ProgressBar';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { radius, spacing, typography } from '@/core/theme/designTokens';
import { useForegroundRefresh } from '@/lib/useForegroundRefresh';
import { useGuardedAsyncRefresh } from '@/lib/useGuardedAsyncRefresh';
import { buildProgressSummary } from '@/features/progress/progress.summary';
import { PROGRESS_WINDOW_OPTIONS } from '@/features/progress/progress.domain';
import { buildProgressNarrative } from '@/features/progress/progress.narrative';
import { comparisonPercent, progressBarVisual } from '@/features/progress/progress.visual';
import type { ProgressPeriodStat, ProgressSummary } from '@/features/progress/progress.types';

const COLOR = SECTION_COLORS.todos;

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

/**
 * The prior-window comparison in words. A zero prior window says "new this
 * period" instead of fabricating a percentage, and a decrease is stated
 * numerically — never painted as failure (design D12.4).
 */
function comparisonLabel(stat: ProgressPeriodStat, unit?: string): string {
  const suffix = unit ? ` ${unit}` : '';
  if (stat.previous === 0) {
    return stat.current === 0 ? 'nothing in the prior period' : 'new this period';
  }
  if (stat.current > stat.previous) return `up from ${stat.previous}${suffix}`;
  if (stat.current < stat.previous) return `down from ${stat.previous}${suffix}`;
  return `level with ${stat.previous}${suffix}`;
}

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

  const bar = progressBarVisual({ surfaceSunken: tokens.surfaceSunken });

  if (loadError && !isLoading && !summary) {
    return (
      <View className="gap-3">
        <Text variant="titleLg" style={{ color: tokens.text }}>
          Progress
        </Text>
        <Card innerClassName="p-4">
          <View className="gap-3">
            <Text variant="titleMd" style={{ color: tokens.text }}>
              Progress is temporarily unavailable
            </Text>
            <Text variant="caption" tone="muted">
              Nothing was saved or changed.
            </Text>
            <Text variant="bodyMd" tone="muted">
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
        accentColor={COLOR}
        title="No progress data yet"
        description="Complete tasks, habits, and sessions to start seeing weekly comparisons."
      />
    );
  }

  return (
    <View style={{ gap: spacing.xl }}>
      {/* Header group: the surface name, the window control, and one caption
          that states both comparison windows. Progress rides Sky because it
          lives inside the Planning Hub drawer — one hue for the whole surface,
          never a rainbow of per-metric colors (§5.1). */}
      <View style={{ gap: spacing.md }}>
        <Text variant="titleLg" style={{ color: tokens.text }}>
          Progress
        </Text>
        <View className="flex-row flex-wrap">
          {PROGRESS_WINDOW_OPTIONS.map((days) => (
            <PillChip
              key={days}
              label={`${days}d`}
              accessibilityLabel={`Show the last ${days} days`}
              active={windowDays === days}
              color={COLOR}
              onPress={() => setWindowDays(days)}
            />
          ))}
        </View>

        {summary ? (
          <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
            Last {summary.windowDays} days ({summary.range.currentStart} →{' '}
            {summary.range.currentEnd}
            ), compared with {summary.range.previousStart} → {summary.range.previousEnd}
          </Text>
        ) : null}
      </View>

      {/* Highlights: the narrative-backed comparisons, one flat group. The
          former paragraph wall repeated these same numbers a third time; the
          story survives as row order + comparison caption (§"no narration
          walls"), and the rows keep their units and the no-invented-percentage
          rule (openspec `reflection-insights`). */}
      {headlineRows.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <SectionLabel>Highlights</SectionLabel>
          <ListGroup>
            {headlineRows.map((row) => (
              <HighlightRow key={row.key} row={row} barFill={bar.fill} track={bar.track} />
            ))}
          </ListGroup>
        </View>
      ) : null}

      {/* One accessible disclosure for the remaining metrics and planning. The
          brief allows only this — not an inscrutable icon hiding everything. */}
      <DisclosureChip
        label={`More details ${showDetails ? '−' : '+'}`}
        accessibilityLabel={showDetails ? 'Hide metric details' : 'Show metric details'}
        expanded={showDetails}
        onPress={() => setShowDetails((open) => !open)}
      />

      {showDetails ? (
        <View style={{ gap: spacing.xl }}>
          <ListGroup>
            {detailRows.map((row) => (
              <DetailMetricRow key={row.key} row={row} />
            ))}
          </ListGroup>
          {summary ? (
            <View style={{ gap: spacing.md }}>
              <SectionLabel>Planning</SectionLabel>
              <ListGroup>
                <DetailRow label="Active projects" value={String(summary.activeProjects)} />
                <DetailRow label="Active goals" value={String(summary.activeGoals)} />
                <DetailRow
                  label="Average goal progress"
                  value={`${summary.goalsAverageProgress}%`}
                />
                <DetailRow label="Calorie goal" value={`${summary.calorieGoal} kcal`} />
              </ListGroup>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * One headline comparison: label, prior anchor, the current value as a
 * `metric`-role number (800 + tabular figures, stepped to `titleLg` so three
 * rows never crowd a phone), and the §6 ProgressBar whose length is this
 * window's share of the larger of the two windows. The bar is proportion, not
 * text: the number beside it carries the value, so no label is ever painted on
 * the hue fill (§5.1 "never put white text on bright").
 */
function HighlightRow({ row, barFill, track }: { row: MetricRow; barFill: string; track: string }) {
  const { tokens } = useAppTheme();
  const percent = comparisonPercent(row.stat.current, row.stat.previous);
  const unitSuffix = row.unit ? ` ${row.unit}` : '';
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm }}>
      <View className="min-w-0 flex-row items-end justify-between" style={{ gap: spacing.md }}>
        <View className="min-w-0 flex-1">
          <Text variant="bodyMd" className="font-bold" numberOfLines={2}>
            {row.label}
          </Text>
          <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
            Prior: {row.stat.previous}
            {unitSuffix}
          </Text>
        </View>
        <Text
          variant="metric"
          style={{
            color: tokens.text,
            // The role's 800 weight and tabular figures, stepped down to the
            // title scale so a three-row group never crowds a 360pt phone.
            fontSize: typography.titleLg.fontSize,
            lineHeight: typography.titleLg.lineHeight,
          }}
        >
          {row.stat.current}
          {unitSuffix}
        </Text>
      </View>
      {/* §6 ProgressBar: the component's own 14px face (no height override),
          Sky bright fill on the theme's sunken rail, one 300ms sweep. */}
      <ProgressBar
        progress={percent / 100}
        accentColor={barFill}
        style={{ backgroundColor: track }}
        accessibilityLabel={`${row.label}: ${row.stat.current}${unitSuffix} this window, ${row.stat.previous}${unitSuffix} prior`}
      />
      <Text variant="caption" tone="muted">
        {comparisonLabel(row.stat, row.unit)}
      </Text>
    </View>
  );
}

/** One remaining metric behind the disclosure: label, current value, and the
 * prior-window comparison in words (units carried separately). */
function DetailMetricRow({ row }: { row: MetricRow }) {
  const { tokens } = useAppTheme();
  const unitSuffix = row.unit ? ` ${row.unit}` : '';
  return (
    <View
      className="flex-row items-center justify-between"
      style={{
        minHeight: 56,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        gap: spacing.md,
      }}
    >
      <View className="min-w-0 flex-1">
        <Text variant="bodyMd" style={{ color: tokens.text }}>
          {row.label}
        </Text>
        <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
          Prior: {row.stat.previous}
          {unitSuffix}
        </Text>
      </View>
      <View className="items-end">
        <Text
          variant="bodyMd"
          style={{ color: tokens.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}
        >
          {row.stat.current}
          {unitSuffix}
        </Text>
        <Text variant="caption" tone="muted">
          {comparisonLabel(row.stat, row.unit)}
        </Text>
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { tokens } = useAppTheme();
  return (
    <View
      className="flex-row items-center justify-between"
      style={{ minHeight: 48, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}
    >
      <Text variant="bodyMd" tone="muted">
        {label}
      </Text>
      <Text
        variant="bodyMd"
        style={{ color: tokens.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * The one disclosure control (a `depth.lip.sm` toggle chip).
 *
 * It is a plain `Pressable` rather than `Pressable3D` for one reason: this
 * react-native-web version does not map `accessibilityState.expanded`, and the
 * W12 contract asserts `aria-expanded` on the *button element itself*
 * (`e2e/planning-w12.spec.ts`). The lip is therefore composed by hand — a
 * `borderStrong` slab behind a 2px-bordered face — so the control still reads
 * as the same pressable family as every other chip on the surface.
 */
function DisclosureChip({
  label,
  accessibilityLabel,
  expanded,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  expanded: boolean;
  onPress: () => void;
}) {
  const { tokens, sectionAccents } = useAppTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: tokens.borderStrong,
        borderRadius: radius.md,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={onPress}
        className="flex-row items-center justify-center"
        style={{
          minHeight: 44,
          paddingHorizontal: spacing.lg,
          marginBottom: 2,
          borderRadius: radius.md,
          borderWidth: 2,
          borderColor: tokens.border,
          backgroundColor: tokens.surface,
        }}
      >
        {/* §5.1 appearance-resolved colored-text tier: the Sky `solid`
            (#1769D8) is 3.18:1 on a dark surface, while the accent's `text`
            tier is the same Sky in light mode and the readable bright in dark. */}
        <Text variant="bodyMd" style={{ color: sectionAccents.todos.text, fontWeight: '700' }}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
