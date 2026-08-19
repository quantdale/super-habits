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
