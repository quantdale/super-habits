import type { MaterialIcons } from '@expo/vector-icons';

import { POMODORO_SECTION_KEY, SECTION_COLORS, type SectionKey } from '@/constants/sectionColors';
import type { PlanningHubView } from '@/core/providers/navigationContext';

import type { OverviewCardId } from './overview.domain';

export type OverviewCardMeta = {
  id: OverviewCardId;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accentColor: string;
  /** Primary section deep-link target, or a planning-hub view fallback. */
  section?: SectionKey;
  planningHubView?: PlanningHubView;
};

export const OVERVIEW_CARD_META: Record<OverviewCardId, OverviewCardMeta> = {
  plan: {
    id: 'plan',
    title: "Today's Plan",
    subtitle: 'Top priorities',
    icon: 'event-note',
    accentColor: SECTION_COLORS[POMODORO_SECTION_KEY],
    planningHubView: 'today',
  },
  todos: {
    id: 'todos',
    title: 'To-Do',
    subtitle: 'Due & pending',
    icon: 'checklist',
    accentColor: SECTION_COLORS.todos,
    section: 'todos',
  },
  habits: {
    id: 'habits',
    title: 'Habits',
    subtitle: 'Rings today',
    icon: 'track-changes',
    accentColor: SECTION_COLORS.habits,
    section: 'habits',
  },
  focus: {
    id: 'focus',
    title: 'Focus',
    subtitle: 'Minutes this week',
    icon: 'timer',
    accentColor: SECTION_COLORS[POMODORO_SECTION_KEY],
    section: POMODORO_SECTION_KEY,
  },
  workout: {
    id: 'workout',
    title: 'Workout',
    subtitle: 'This week',
    icon: 'fitness-center',
    accentColor: SECTION_COLORS.workout,
    section: 'workout',
  },
  calories: {
    id: 'calories',
    title: 'Calories',
    subtitle: 'Today vs target',
    icon: 'restaurant-menu',
    accentColor: SECTION_COLORS.calories,
    section: 'calories',
  },
  projects: {
    id: 'projects',
    title: 'Projects',
    subtitle: 'Active work',
    icon: 'folder-open',
    accentColor: SECTION_COLORS.todos,
    planningHubView: 'projects',
  },
  goals: {
    id: 'goals',
    title: 'Goals',
    subtitle: 'Active snapshot',
    icon: 'flag',
    accentColor: SECTION_COLORS.todos,
    planningHubView: 'goals',
  },
};
