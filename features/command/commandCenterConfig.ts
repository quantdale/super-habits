import { POMODORO_SECTION_KEY, SECTION_COLORS } from '@/constants/sectionColors';

export type CommandCenterLaunchContext =
  'overview' | 'todos' | 'habits' | 'pomodoro' | 'workout' | 'calories';

export type CommandCenterContextCopy = {
  sectionLabel: string;
  helperCopy: string;
  inputPlaceholder: string;
  accentColor: string;
};

export const COMMAND_CENTER_CONTEXT_COPY: Record<
  CommandCenterLaunchContext,
  CommandCenterContextCopy
> = {
  overview: {
    sectionLabel: 'Overview',
    helperCopy: 'Quick-add a todo or habit without leaving the dashboard.',
    inputPlaceholder: 'Add a todo to call mom tomorrow',
    accentColor: '#475569',
  },
  todos: {
    sectionLabel: 'Todos',
    helperCopy: 'Try a single-task command with today, tomorrow, or an exact date.',
    inputPlaceholder: 'Add a todo to send the invoice tomorrow',
    accentColor: SECTION_COLORS.todos,
  },
  habits: {
    sectionLabel: 'Habits',
    helperCopy: 'Try creating one habit with a simple daily cadence.',
    inputPlaceholder: 'Create a habit to stretch every morning',
    accentColor: SECTION_COLORS.habits,
  },
  pomodoro: {
    sectionLabel: 'Focus',
    helperCopy: 'Capture the next task or supporting habit between focus sessions.',
    inputPlaceholder: 'Add a todo to plan tomorrow before lunch',
    accentColor: SECTION_COLORS[POMODORO_SECTION_KEY],
  },
  workout: {
    sectionLabel: 'Workout',
    helperCopy: 'Capture prep work as a todo or a repeatable support habit.',
    inputPlaceholder: 'Create a habit to warm up every evening',
    accentColor: SECTION_COLORS.workout,
  },
  calories: {
    sectionLabel: 'Calories',
    helperCopy: 'Capture nutrition-related todos or habits without changing screens.',
    inputPlaceholder: 'Create a habit to log lunch every afternoon',
    accentColor: SECTION_COLORS.calories,
  },
};

export function getCommandCenterContextCopy(
  context: CommandCenterLaunchContext | null | undefined,
): CommandCenterContextCopy | null {
  if (!context) return null;
  return COMMAND_CENTER_CONTEXT_COPY[context];
}
