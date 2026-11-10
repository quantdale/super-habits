import { Text } from '@/core/ui/Text';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/themeContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { PillChip } from '@/core/ui/PillChip';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { ListGroup } from '@/core/ui/ListGroup';
import { SectionLabel } from '@/core/ui/SectionLabel';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { radius, spacing } from '@/core/theme/designTokens';
import { toDateKey } from '@/lib/time';
import { useForegroundRefresh } from '@/lib/useForegroundRefresh';
import { useGuardedAsyncRefresh } from '@/lib/useGuardedAsyncRefresh';
import {
  ACTIVITY_TIMELINE_PAGE_SIZE,
  buildActivityTimeline,
} from '@/features/activity/activityTimeline.data';
import {
  filterTimelineByDay,
  filterTimelineByRange,
  filterTimelineBySources,
  formatTimelineDayLabel,
  getTimelineDayKeys,
  groupTimelineByDay,
  hasClockTime,
} from '@/features/activity/activityTimeline.domain';
import {
  activityItemTileVisual,
  type ActivitySourceTileVisual,
} from '@/features/activity/activityTimeline.visual';
import type {
  ActivityTimelineItem,
  ActivityTimelineRangeFilter,
  ActivityTimelineSourceFilter,
} from '@/features/activity/activityTimeline.types';

const COLOR = SECTION_COLORS.todos;

const SOURCE_FILTERS: { key: ActivityTimelineSourceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'todos', label: 'Todos' },
  { key: 'habits', label: 'Habits' },
  { key: 'focus', label: 'Focus' },
  { key: 'workout', label: 'Workout' },
  { key: 'calories', label: 'Calories' },
  { key: 'planning', label: 'Planning' },
];

const RANGE_FILTERS: { key: ActivityTimelineRangeFilter; label: string; spoken: string }[] = [
  { key: '7', label: '7d', spoken: 'the last 7 days' },
  { key: '30', label: '30d', spoken: 'the last 30 days' },
  { key: '90', label: '90d', spoken: 'the last 90 days' },
  { key: 'all', label: 'All', spoken: 'all time' },
];

/** Short category label shown in each row's metadata line (never colour-only). */
const CATEGORY_LABEL: Record<string, string> = {
  productivity: 'Productivity',
  health: 'Health',
  planning: 'Planning',
};

const DEFAULT_SOURCE: ActivityTimelineSourceFilter = 'all';
const DEFAULT_RANGE: ActivityTimelineRangeFilter = '30';

/** The SQL window a range chip asks for: only "All" is unbounded. */
const daysForRange = (range: ActivityTimelineRangeFilter) =>
  range === 'all' ? ('all' as const) : Number(range);

/** The paging cursor after a page: its last row (the feed is newest-first). */
function cursorAfter(page: ActivityTimelineItem[]) {
  const last = page[page.length - 1];
  return last ? { occurredAt: last.occurredAt, id: last.id } : null;
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
  const { tokens, sectionAccents } = useAppTheme();
  const [items, setItems] = useState<ActivityTimelineItem[]>([]);
  // Cursor for the next page: the last loaded item identifies the resume point,
  // so a page appended after a refresh can never skip or duplicate rows the way
  // a raw `items.length` offset would.
  const [nextCursor, setNextCursor] = useState<{ occurredAt: string; id: string } | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<ActivityTimelineSourceFilter>(DEFAULT_SOURCE);
  const [rangeFilter, setRangeFilter] = useState<ActivityTimelineRangeFilter>(DEFAULT_RANGE);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // F8: the hub stays mounted across midnight — reload when the local day rolls over.
  const dayGeneration = useDayRolloverGeneration();
  const { begin } = useGuardedAsyncRefresh();

  const load = useCallback(
    async (window: ActivityTimelineRangeFilter = DEFAULT_RANGE) => {
      // One guard instance per refresh unit: `begin()` is acquired once here and
      // shared by every sub-read, so a filter change or unmount invalidates the
      // whole unit instead of letting a stale run clear the newer spinner
      // (audit C §12).
      const isCurrent = begin();
      // A reload unit takes ownership of BOTH spinners: it supersedes any
      // in-flight page append, whose own finally will (correctly) decline to
      // write. Clearing the paging flag here is what keeps a superseded append
      // from stranding "Loading…" on the Load more button forever.
      setIsLoadingMore(false);
      setIsLoading(true);
      try {
        const page = await buildActivityTimeline({
          days: daysForRange(window),
          limit: ACTIVITY_TIMELINE_PAGE_SIZE,
        });
        if (!isCurrent()) return;
        setItems(page.items);
        setNextCursor(page.hasMore ? cursorAfter(page.items) : null);
        setLoadError(null);
      } catch (err) {
        if (!isCurrent()) return;
        // F8: no unhandled rejections; a failed load must not read as
        // "Nothing to show yet". The error panel below offers a retry.
        console.error('[ActivityTimelineView] load failed', err);
        setLoadError(err instanceof Error ? err.message : 'Could not load your timeline.');
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [begin],
  );

  useEffect(() => {
    // The initial/unbounded read is asynchronous; scheduling it on a microtask
    // keeps the effect free of a synchronous setState cascade.
    queueMicrotask(() => void load(rangeFilter));
  }, [dayGeneration, load, rangeFilter]);

  // F8: refresh while the hub modal is open after backgrounding the app.
  useForegroundRefresh(useCallback(() => void load(rangeFilter), [load, rangeFilter]));

  /** Append the next page of the same window; never re-reads from zero. */
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !nextCursor) return;
    const isCurrent = begin();
    // Symmetrically, a page unit supersedes the reload it interrupts and owns
    // both spinners, so the stale reload's finally cannot strand the initial
    // spinner.
    setIsLoading(false);
    setIsLoadingMore(true);
    try {
      const page = await buildActivityTimeline({
        days: daysForRange(rangeFilter),
        after: nextCursor,
        limit: ACTIVITY_TIMELINE_PAGE_SIZE,
      });
      if (!isCurrent()) return;
      setItems((previous) => [...previous, ...page.items]);
      setNextCursor(page.hasMore ? cursorAfter(page.items) : null);
    } catch (err) {
      if (!isCurrent()) return;
      console.error('[ActivityTimelineView] load more failed', err);
      setLoadError(err instanceof Error ? err.message : 'Could not load more activity.');
    } finally {
      if (isCurrent()) setIsLoadingMore(false);
    }
  }, [begin, isLoadingMore, nextCursor, rangeFilter]);

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
      queueMicrotask(() => {
        // Re-check inside the microtask: a newer render may have restored it.
        setSelectedDay((current) => (current === selectedDay ? null : current));
      });
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
      <View style={{ gap: spacing.xl }}>
        <Text variant="titleLg" style={{ color: tokens.text }}>
          Timeline
        </Text>
        <Card innerClassName="p-4">
          <View style={{ gap: spacing.md }}>
            <Text variant="titleMd" style={{ color: tokens.text }}>
              Timeline is temporarily unavailable
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
                void load(rangeFilter);
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
    <View style={{ gap: spacing.xl }}>
      {/* Header group: surface name + the one collapsed disclosure. Events
          render before this chrome once any activity exists (§"Activity shows
          events before filter chrome"). */}
      <View style={{ gap: spacing.sm }}>
        <View className="flex-row items-center justify-between" style={{ gap: spacing.md }}>
          <Text variant="titleLg" style={{ color: tokens.text }}>
            Timeline
          </Text>
          {!isLoading ? (
            <DisclosureChip
              label={`Filters${activeFilterCount > 0 ? ` · ${activeFilterCount} active` : ''} ${
                showFilters ? '−' : '+'
              }`}
              accessibilityLabel={
                activeFilterCount > 0
                  ? `Timeline filters, ${activeFilterCount} active`
                  : 'Timeline filters'
              }
              expanded={showFilters}
              onPress={() => setShowFilters((open) => !open)}
            />
          ) : null}
        </View>

        {/* Current selection stays visible while the controls are collapsed
            (one text node, so it reads as one sentence to a screen reader). */}
        {hasAnyActivity ? (
          <Text variant="caption" tone="muted">
            {`${sourceSummary} · ${rangeSummary}${
              selectedDay ? ` · ${formatTimelineDayLabel(selectedDay, todayKey)}` : ''
            }`}
          </Text>
        ) : null}
      </View>

      {showFilters && hasAnyActivity ? (
        <Card innerClassName="p-3">
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <SectionLabel>Source</SectionLabel>
              <View className="flex-row flex-wrap">
                {SOURCE_FILTERS.map((f) => (
                  <PillChip
                    key={f.key}
                    label={f.label}
                    accessibilityLabel={`Filter timeline by ${f.label}`}
                    active={sourceFilter === f.key}
                    color={COLOR}
                    onPress={() => setSourceFilter(f.key)}
                  />
                ))}
              </View>
            </View>
            <View style={{ gap: spacing.xs }}>
              <SectionLabel>Range</SectionLabel>
              <View className="flex-row flex-wrap">
                {RANGE_FILTERS.map((f) => (
                  <PillChip
                    key={f.key}
                    label={f.label}
                    accessibilityLabel={`Show activity from ${f.spoken}`}
                    active={rangeFilter === f.key}
                    color={COLOR}
                    onPress={() => setRangeFilter(f.key)}
                  />
                ))}
              </View>
            </View>
            {dayKeys.length > 0 ? (
              <View style={{ gap: spacing.xs }}>
                <SectionLabel>Day</SectionLabel>
                <View className="flex-row flex-wrap">
                  <PillChip
                    label="All days"
                    active={selectedDay === null}
                    color={COLOR}
                    onPress={() => setSelectedDay(null)}
                  />
                  {dayKeys.slice(0, 14).map((key) => (
                    <PillChip
                      key={key}
                      label={formatTimelineDayLabel(key, todayKey)}
                      accessibilityLabel={`Show activity from ${key}`}
                      active={selectedDay === key}
                      color={COLOR}
                      onPress={() => setSelectedDay(selectedDay === key ? null : key)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            <Button
              label="Reset filters"
              variant="ghost"
              size="sm"
              disabled={activeFilterCount === 0}
              onPress={resetFilters}
            />
          </View>
        </Card>
      ) : null}

      {!hasAnyActivity && !isLoading ? (
        <EmptyStateCard
          accentColor={COLOR}
          title="Nothing logged yet"
          description="Completed tasks, habits, focus sessions, workouts, and plans will appear here."
        />
      ) : !isLoading && groups.length === 0 ? (
        <Card innerClassName="p-4">
          <View className="items-center" style={{ gap: spacing.sm, paddingVertical: spacing.md }}>
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
        <View style={{ gap: spacing.xl }}>
          {groups.map((group) => (
            <View key={group.dateKey} style={{ gap: spacing.sm }}>
              <SectionLabel>{formatTimelineDayLabel(group.dateKey, todayKey)}</SectionLabel>
              <ListGroup>
                {group.items.map((item) => (
                  <TimelineRow
                    key={item.id}
                    item={item}
                    tile={activityItemTileVisual(item, sectionAccents, tokens.surface)}
                  />
                ))}
              </ListGroup>
            </View>
          ))}
        </View>
      )}

      {/* Older pages of the same window; the button is the whole
          affordance, so the feed never silently truncates. */}
      {nextCursor && !isLoading ? (
        <View className="items-center">
          <Button
            label={isLoadingMore ? 'Loading…' : 'Load more'}
            variant="ghost"
            size="sm"
            disabled={isLoadingMore}
            onPress={() => void loadMore()}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * One activity row (§6 `ListRow` grammar, 56–60pt): a 40px leading tile in the
 * event source's own section hue, then the title and ONE metadata line naming
 * the category and the local time. The tile is what makes a merged feed
 * scannable without per-row colour claims on the text; the category word stays
 * in the line so the row never encodes meaning in colour alone.
 */
function TimelineRow({
  item,
  tile,
}: {
  item: ActivityTimelineItem;
  tile: ActivitySourceTileVisual;
}) {
  const time = formatTime(item.occurredAt);
  const category = CATEGORY_LABEL[item.category] ?? item.category;
  return (
    <View
      className="flex-row items-center"
      style={{
        minHeight: 56,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tile.face,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <MaterialIcons
          name={tile.glyph as keyof typeof MaterialIcons.glyphMap}
          size={20}
          color={tile.ink}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text variant="bodyMd" className="font-bold" numberOfLines={2} style={{ lineHeight: 20 }}>
          {item.title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
          {category}
          {time ? ` · ${time}` : ''}
          {item.subtitle ? ` · ${item.subtitle}` : ''}
        </Text>
      </View>
    </View>
  );
}

/**
 * The timeline's one collapsed filter control (a `depth.lip.sm` toggle chip).
 *
 * A plain `Pressable`, not `Pressable3D`: this react-native-web version does
 * not map `accessibilityState` to the DOM, and the W12 contract asserts
 * `aria-expanded` on the button element itself
 * (`e2e/planning-w12.spec.ts`). The lip is composed by hand — a
 * `borderStrong` slab behind a bounded frame — so the control still reads as
 * the same pressable family as every other chip on this surface.
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
        {/* §5.1 appearance-resolved colored-text tier — the raw Sky `solid`
            is 3.18:1 on a dark surface. */}
        <Text variant="bodyMd" style={{ color: sectionAccents.todos.text, fontWeight: '700' }}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
