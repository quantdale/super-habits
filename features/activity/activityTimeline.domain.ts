import type {
  ActivityTimelineCategory,
  ActivityTimelineItem,
  ActivityTimelineSource,
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
