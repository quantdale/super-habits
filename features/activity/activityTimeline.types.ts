export type ActivityTimelineCategory = 'productivity' | 'health' | 'planning';

export type ActivityTimelineSource =
  | 'todo'
  | 'habit'
  | 'focus'
  | 'workout'
  | 'calories'
  | 'weekly_review'
  | 'daily_plan'
  | 'project'
  | 'goal';

export type ActivityTimelineFilter = 'all' | ActivityTimelineCategory;

/**
 * Entity-type filter chips shown above the timeline. Each chip maps to a set of
 * timeline sources; `planning` covers the planning-hub entities (plans,
 * reviews, projects, goals).
 */
export type ActivityTimelineSourceFilter =
  'all' | 'todos' | 'habits' | 'focus' | 'workout' | 'calories' | 'planning';

/** Date-range filter over the loaded timeline window, in local days. */
export type ActivityTimelineRangeFilter = '7' | '30' | '90' | 'all';

export type ActivityTimelineItem = {
  id: string;
  occurredAt: string;
  dateKey: string;
  category: ActivityTimelineCategory;
  source: ActivityTimelineSource;
  title: string;
  subtitle?: string;
  icon: string;
};

export type ActivityTimelineDayGroup = {
  dateKey: string;
  label: string;
  items: ActivityTimelineItem[];
};
