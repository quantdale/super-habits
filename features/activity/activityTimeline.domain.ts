import type {
  ActivityTimelineCategory,
  ActivityTimelineItem,
  ActivityTimelineRangeFilter,
  ActivityTimelineSource,
  ActivityTimelineSourceFilter,
} from '@/features/activity/activityTimeline.types';

export const SOURCE_CATEGORY: Record<ActivityTimelineSource, ActivityTimelineCategory> = {
  todo: 'productivity',
  project: 'productivity',
  goal: 'productivity',
  focus: 'productivity',
  habit: 'health',
  workout: 'health',
  calories: 'health',
  daily_plan: 'planning',
  weekly_review: 'planning',
};

export const SOURCE_ICON: Record<ActivityTimelineSource, string> = {
  todo: 'check-circle',
  project: 'folder',
  goal: 'flag',
  focus: 'timer',
  habit: 'loop',
  workout: 'fitness-center',
  calories: 'restaurant-menu',
  daily_plan: 'today',
  weekly_review: 'date-range',
};

export function categoryOf(source: ActivityTimelineSource): ActivityTimelineCategory {
  return SOURCE_CATEGORY[source];
}

export function filterTimeline(
  items: ActivityTimelineItem[],
  filter: 'all' | ActivityTimelineCategory,
): ActivityTimelineItem[] {
  if (filter === 'all') return items;
  return items.filter((item) => item.category === filter);
}

/** Entity-type chips → timeline sources. Projects/goals live under planning. */
export const SOURCE_FILTER_SOURCES: Record<
  Exclude<ActivityTimelineSourceFilter, 'all'>,
  ActivityTimelineSource[]
> = {
  todos: ['todo'],
  habits: ['habit'],
  focus: ['focus'],
  workout: ['workout'],
  calories: ['calories'],
  planning: ['daily_plan', 'weekly_review', 'project', 'goal'],
};

/** Pure entity-type filtering over already-fetched timeline items. */
export function filterTimelineBySources(
  items: ActivityTimelineItem[],
  filter: ActivityTimelineSourceFilter,
): ActivityTimelineItem[] {
  if (filter === 'all') return items;
  const sources = SOURCE_FILTER_SOURCES[filter];
  return items.filter((item) => sources.includes(item.source));
}

const RANGE_DAYS: Record<Exclude<ActivityTimelineRangeFilter, 'all'>, number> = {
  '7': 7,
  '30': 30,
  '90': 90,
};

/**
 * Pure date-range filtering over loaded items using their local `dateKey`.
 * `todayKey` is injectable for determinism; range is inclusive of today.
 */
export function filterTimelineByRange(
  items: ActivityTimelineItem[],
  range: ActivityTimelineRangeFilter,
  todayKey: string,
): ActivityTimelineItem[] {
  if (range === 'all') return items;
  const days = RANGE_DAYS[range];
  const cutoff = new Date(`${todayKey}T00:00:00`);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  // Compose the cutoff key locally to stay offset/DST-safe via Date arithmetic.
  const cutoffKey = [
    `${cutoff.getFullYear()}`,
    `${cutoff.getMonth() + 1}`.padStart(2, '0'),
    `${cutoff.getDate()}`.padStart(2, '0'),
  ].join('-');
  return items.filter((item) => item.dateKey >= cutoffKey);
}

/** Distinct day keys present in the feed, most recent first. */
export function getTimelineDayKeys(items: ActivityTimelineItem[]): string[] {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.dateKey) keys.add(item.dateKey);
  }
  return [...keys].sort((a, b) => (a < b ? 1 : -1));
}

/** Pure single-day filtering; `null` day key means "all days". */
export function filterTimelineByDay(
  items: ActivityTimelineItem[],
  dayKey: string | null,
): ActivityTimelineItem[] {
  if (!dayKey) return items;
  return items.filter((item) => item.dateKey === dayKey);
}

export function sortTimelineByOccurredAt(items: ActivityTimelineItem[]): ActivityTimelineItem[] {
  return [...items].sort((a, b) => {
    if (a.occurredAt === b.occurredAt) return a.id.localeCompare(b.id);
    return a.occurredAt < b.occurredAt ? 1 : -1;
  });
}

/**
 * Group items into local-day buckets ordered most-recent first. Items without a
 * resolvable date key fall into a synthetic bucket so nothing is dropped.
 */
export function groupTimelineByDay(items: ActivityTimelineItem[]): {
  dateKey: string;
  items: ActivityTimelineItem[];
}[] {
  const buckets = new Map<string, ActivityTimelineItem[]>();
  for (const item of items) {
    const key = item.dateKey || 'unknown';
    const group = buckets.get(key);
    if (group) group.push(item);
    else buckets.set(key, [item]);
  }
  return [...buckets.entries()]
    .map(([dateKey, groupItems]) => ({
      dateKey,
      items: sortTimelineByOccurredAt(groupItems),
    }))
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}
