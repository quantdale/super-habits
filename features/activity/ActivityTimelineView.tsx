import { Text } from '@/core/ui/Text';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { PillChip } from '@/core/ui/PillChip';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { spacing } from '@/core/theme/designTokens';
import { toDateKey } from '@/lib/time';
import { useForegroundRefresh } from '@/lib/useForegroundRefresh';
import { buildActivityTimeline } from '@/features/activity/activityTimeline.data';
import {
  filterTimelineByDay,
  filterTimelineByRange,
  filterTimelineBySources,
  getTimelineDayKeys,
  groupTimelineByDay,
  hasClockTime,
} from '@/features/activity/activityTimeline.domain';
import type {
  ActivityTimelineItem,
  ActivityTimelineRangeFilter,
  ActivityTimelineSourceFilter,
} from '@/features/activity/activityTimeline.types';

const SOURCE_FILTERS: { key: ActivityTimelineSourceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'todos', label: 'Todos' },
  { key: 'habits', label: 'Habits' },
  { key: 'focus', label: 'Focus' },
  { key: 'workout', label: 'Workout' },
  { key: 'calories', label: 'Calories' },
  { key: 'planning', label: 'Planning' },
];

const RANGE_FILTERS: { key: ActivityTimelineRangeFilter; label: string }[] = [
  { key: '7', label: '7d' },
  { key: '30', label: '30d' },
  { key: '90', label: '90d' },
  { key: 'all', label: 'All' },
];

/** Short category label shown in each row's metadata line (never colour-only). */
const CATEGORY_LABEL: Record<string, string> = {
  productivity: 'Productivity',
  health: 'Health',
  planning: 'Planning',
};

const DEFAULT_SOURCE: ActivityTimelineSourceFilter = 'all';
const DEFAULT_RANGE: ActivityTimelineRangeFilter = '30';

function formatDayLabel(dateKey: string): string {
  if (dateKey === 'unknown') return 'Earlier';
  // Browser-local day boundary, matching `toDateKey()`: never `new Date(key)`
  // (UTC-parsed) for the "today/yesterday" comparison.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateKey}T00:00:00`);
  const diffDays = Math.round((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return dateKey;
}

/**
 * Short local time for a row (`14:05`), from the event's local ISO instant.
 *
 * Returns null for a date-only `YYYY-MM-DD` occurrence (see
 * `hasClockTime`): calorie rows carry a deterministic date-only sort key so the
 * UI does not invent an event time. Formatting one would fabricate midnight and,
 * west of UTC, could even render the previous evening while the row stays
 * grouped under the consumed date. Only timestamp-backed sources get a clock.
 */
function formatTime(occurredAt: string): string | null {
  if (!hasClockTime(occurredAt)) return null;
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ActivityTimelineView() {
  const { tokens } = useAppTheme();
  const [items, setItems] = useState<ActivityTimelineItem[]>([]);
  const [sourceFilter, setSourceFilter] = useState<ActivityTimelineSourceFilter>(DEFAULT_SOURCE);
  const [rangeFilter, setRangeFilter] = useState<ActivityTimelineRangeFilter>(DEFAULT_RANGE);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // F8: the hub stays mounted across midnight — reload when the local day rolls over.
  const dayGeneration = useDayRolloverGeneration();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // Widest bounded window; narrower ranges are pure domain filtering.
      setItems(await buildActivityTimeline({ days: 90 }));
      setLoadError(null);
    } catch (err) {
      // F8: no unhandled rejections; a failed load must not read as
      // "Nothing to show yet". The error panel below offers a retry.
      console.error('[ActivityTimelineView] load failed', err);
      setLoadError(err instanceof Error ? err.message : 'Could not load your timeline.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional async data-load
    void load();
  }, [load, dayGeneration]);

  // F8: refresh while the hub modal is open after backgrounding the app.
  useForegroundRefresh(load);

  // Hooks run unconditionally (rules-of-hooks); the loadError early return
  // happens AFTER all hooks, using the already-computed values where needed.
  const todayKey = toDateKey();

  const ranged = useMemo(
    () => filterTimelineByRange(items, rangeFilter, todayKey),
    [items, rangeFilter, todayKey],
  );
  const typed = useMemo(
    () => filterTimelineBySources(ranged, sourceFilter),
    [ranged, sourceFilter],
  );
  // Day options derive from the RANGED set, so changing the range can never
  // leave a selected day that no longer exists in the feed.
  const dayKeys = useMemo(() => getTimelineDayKeys(typed), [typed]);
  const visible = useMemo(() => filterTimelineByDay(typed, selectedDay), [typed, selectedDay]);

  // A range change that removes the selected day must clear it rather than
  // silently show an empty list.
  useEffect(() => {
    if (selectedDay && !dayKeys.includes(selectedDay)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keep selection valid
      setSelectedDay(null);
    }
  }, [dayKeys, selectedDay]);

  const activeFilterCount =
    (sourceFilter !== DEFAULT_SOURCE ? 1 : 0) +
    (rangeFilter !== DEFAULT_RANGE ? 1 : 0) +
    (selectedDay !== null ? 1 : 0);

  const sourceSummary =
    sourceFilter === 'all'
      ? 'All sources'
      : (SOURCE_FILTERS.find((f) => f.key === sourceFilter)?.label ?? 'All sources');
  const rangeSummary = rangeFilter === 'all' ? 'All time' : `Last ${rangeFilter} days`;

  const resetFilters = useCallback(() => {
    setSourceFilter(DEFAULT_SOURCE);
    setRangeFilter(DEFAULT_RANGE);
    setSelectedDay(null);
  }, []);

  if (loadError && !isLoading && items.length === 0) {
    return (
      <View className="gap-3">
        <Text className="text-lg font-bold" style={{ color: tokens.text }}>
          Timeline
        </Text>
        <Card
          variant="header"
          accentColor={tokens.textMuted}
          headerTitle="Timeline is temporarily unavailable"
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
                void load();
              }}
              color={tokens.textMuted}
            />
          </View>
        </Card>
      </View>
    );
  }

  const groups = groupTimelineByDay(visible);
  const hasAnyActivity = items.length > 0;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold" style={{ color: tokens.text }}>
          Timeline
        </Text>
        {!isLoading ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              activeFilterCount > 0
                ? `Timeline filters, ${activeFilterCount} active`
                : 'Timeline filters'
            }
            accessibilityState={{ expanded: showFilters }}
            aria-expanded={showFilters}
            className="min-h-11 justify-center rounded-xl border px-3"
            style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
            onPress={() => setShowFilters((open) => !open)}
          >
            <Text className="text-sm" style={{ color: tokens.text }}>
              Filters{activeFilterCount > 0 ? ` · ${activeFilterCount} active` : ''}{' '}
              {showFilters ? '−' : '+'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {!hasAnyActivity && !isLoading ? (
        <EmptyStateCard
          accentColor={SECTION_COLORS.todos}
          title="Nothing logged yet"
          description="Completed tasks, habits, focus sessions, workouts, and plans will appear here."
        />
      ) : hasAnyActivity ? (
        <>
          {/* Current selection stays visible while the controls are collapsed
              (one text node, so it reads as one sentence to a screen reader). */}
          <Text className="text-xs" style={{ color: tokens.textMuted }}>
            {`${sourceSummary} · ${rangeSummary}${
              selectedDay ? ` · ${formatDayLabel(selectedDay)}` : ''
            }`}
          </Text>

          {showFilters ? (
            <Card innerClassName="p-3">
              <View className="gap-2">
                <View className="flex-row flex-wrap">
                  {SOURCE_FILTERS.map((f) => (
                    <PillChip
                      key={f.key}
                      label={f.label}
                      accessibilityLabel={`Filter timeline by ${f.label}`}
                      active={sourceFilter === f.key}
                      color={SECTION_COLORS.todos}
                      onPress={() => setSourceFilter(f.key)}
                    />
                  ))}
                </View>
                <View className="flex-row flex-wrap">
                  {RANGE_FILTERS.map((f) => (
                    <PillChip
                      key={f.key}
                      label={f.label}
                      accessibilityLabel={`Show activity from the last ${f.label}`}
                      active={rangeFilter === f.key}
                      color={SECTION_COLORS.focus}
                      onPress={() => setRangeFilter(f.key)}
                    />
                  ))}
                </View>
                {dayKeys.length > 0 ? (
                  <View className="flex-row flex-wrap">
                    <PillChip
                      label="All days"
                      active={selectedDay === null}
                      color={SECTION_COLORS.habits}
                      onPress={() => setSelectedDay(null)}
                    />
                    {dayKeys.slice(0, 14).map((key) => (
                      <PillChip
                        key={key}
                        label={formatDayLabel(key)}
                        accessibilityLabel={`Show activity from ${key}`}
                        active={selectedDay === key}
                        color={SECTION_COLORS.habits}
                        onPress={() => setSelectedDay(selectedDay === key ? null : key)}
                      />
                    ))}
                  </View>
                ) : null}
                <View className="flex-row">
                  <Button
                    label="Reset filters"
                    variant="ghost"
                    size="sm"
                    disabled={activeFilterCount === 0}
                    onPress={resetFilters}
                  />
                </View>
              </View>
            </Card>
          ) : null}

          {!isLoading && groups.length === 0 ? (
            <Card className="mb-0">
              <View className="items-center gap-2 py-4">
                <Text variant="titleMd" style={{ textAlign: 'center' }}>
                  No matching activity
                </Text>
                <Text variant="bodyMd" tone="muted" style={{ textAlign: 'center' }}>
                  Nothing logged matches these filters.
                </Text>
                <Button label="Reset filters" variant="ghost" size="sm" onPress={resetFilters} />
              </View>
            </Card>
          ) : (
            groups.map((group) => (
              <View key={group.dateKey} className="gap-1">
                <Text
                  variant="caption"
                  tone="muted"
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    marginTop: spacing.sm,
                  }}
                >
                  {formatDayLabel(group.dateKey)}
                </Text>
                <View
                  className="rounded-2xl border"
                  style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
                >
                  {group.items.map((item, index) => (
                    <TimelineRow
                      key={item.id}
                      item={item}
                      isFirst={index === 0}
                      borderColor={tokens.border}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </>
      ) : null}
    </View>
  );
}

/**
 * One flat activity row (48–56pt): title, then one metadata line naming the
 * category and the local time. No ornamental icon tile and no per-row border —
 * the row sits on a shared surface with a hairline separator (design D12.5).
 */
function TimelineRow({
  item,
  isFirst,
  borderColor,
}: {
  item: ActivityTimelineItem;
  isFirst: boolean;
  borderColor: string;
}) {
  const { tokens } = useAppTheme();
  const time = formatTime(item.occurredAt);
  const category = CATEGORY_LABEL[item.category] ?? item.category;
  return (
    <View
      style={
        isFirst
          ? undefined
          : { borderTopWidth: 1, borderTopColor: borderColor, marginHorizontal: spacing.lg }
      }
    >
      <View className="justify-center px-4" style={{ minHeight: 56, paddingVertical: spacing.sm }}>
        <Text className="text-sm font-medium" style={{ color: tokens.text }}>
          {item.title}
        </Text>
        <Text className="text-xs" style={{ color: tokens.textMuted }}>
          {category}
          {time ? ` · ${time}` : ''}
          {item.subtitle ? ` · ${item.subtitle}` : ''}
        </Text>
      </View>
    </View>
  );
}
