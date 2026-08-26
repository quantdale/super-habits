import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { POMODORO_SECTION_KEY } from '@/constants/sectionColors';
import { useAppNavigation } from '@/core/providers/navigationContext';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';

import type {
  CaloriesSummary,
  FocusWeekSummary,
  HabitsSummary,
  TodosSummary,
  WorkoutSummary,
} from './overview.domain';
import { OVERVIEW_CARD_META } from './overviewCards';
import { openCardTarget } from './cards/DashboardCard.shared';

type TodayProgressStripProps = {
  todayKey: string;
  todos: TodosSummary;
  habits: HabitsSummary;
  focus: FocusWeekSummary;
  workout: WorkoutSummary;
  calories: CaloriesSummary;
};

/**
 * Today progress strip (docs/ui-ux/03-feature-blueprints.md §1C): one compact
 * card summarizing tasks · habits · focus · workout · calories. Pinned daily
 * orientation — rendered regardless of card customization and NOT part of the
 * removable card registry. Each metric deep-links to its feature exactly like
 * the customizable cards do.
 */
export function TodayProgressStrip({
  todayKey,
  todos,
  habits,
  focus,
  workout,
  calories,
}: TodayProgressStripProps) {
  const { tokens, sectionAccents } = useAppTheme();
  const navigation = useAppNavigation();

  const focusMinutesToday =
    focus.perDayMinutes.find((day) => day.dateKey === todayKey)?.minutes ?? 0;
  const workoutState =
    workout.todayState ?? (workout.lastWorkoutDateKey === todayKey ? 'completed' : undefined);
  const workoutDoneToday = workoutState === 'completed';
  const workoutResumable = workoutState === 'resumable';
  const workoutPlanned = workoutState === 'planned';
  // Current-day semantics: the Tasks fraction counts today's completions
  // against today's actionable set (due today + overdue), not the whole open
  // backlog — an undated someday task is not part of "today".
  const tasksOpenToday = todos.overdueCount + todos.dueTodayCount;
  const tasksTotalToday = todos.completedTodayCount + tasksOpenToday;

  const metrics: {
    /** Card registry id; also a valid section-accent key. */
    id: 'todos' | 'habits' | 'focus' | 'workout' | 'calories';
    value: string;
    label: string;
    /** Full sentence read by screen readers. */
    spoken: string;
  }[] = [
    {
      id: 'todos',
      value: tasksTotalToday > 0 ? `${todos.completedTodayCount}/${tasksTotalToday}` : '—',
      label: 'Tasks',
      spoken:
        tasksTotalToday > 0
          ? `Tasks: ${todos.completedTodayCount} of ${tasksTotalToday} done`
          : 'Tasks: nothing due today',
    },
    {
      id: 'habits',
      value: `${habits.completedToday}/${habits.scheduledToday}`,
      label: 'Habits',
      spoken: `Habits: ${habits.completedToday} of ${habits.scheduledToday} complete`,
    },
    {
      id: 'focus',
      value: `${focusMinutesToday}`,
      label: 'min focus',
      spoken: `Focus: ${focusMinutesToday} minutes today`,
    },
    {
      id: 'workout',
      value: workoutResumable
        ? 'Resume'
        : workoutDoneToday
          ? 'Done'
          : workoutPlanned
            ? 'Planned'
            : workout.sessionsThisWeek > 0
              ? `${workout.sessionsThisWeek}/wk`
              : '—',
      label: 'Workout',
      spoken: workoutResumable
        ? 'Workout in progress and ready to resume'
        : workoutDoneToday
          ? 'Workout done today'
          : workoutPlanned
            ? `Workout planned today${workout.plannedWorkoutName ? `: ${workout.plannedWorkoutName}` : ''}`
            : workout.sessionsThisWeek > 0
              ? `Workout: ${workout.sessionsThisWeek} sessions this week`
              : 'Workout: none this week',
    },
    {
      id: 'calories',
      value: calories.goal > 0 ? `${calories.consumed}/${calories.goal}` : '—',
      label: 'kcal',
      spoken:
        calories.goal > 0
          ? `Calories: ${calories.consumed} of ${calories.goal}`
          : 'Calories: no goal set',
    },
  ];

  return (
    <Card className="mb-0">
      <View className="flex-row flex-wrap items-center">
        <View className="mr-1 flex-row items-center gap-1 py-2 pl-1 pr-2">
          <MaterialIcons name="today" size={16} color={sectionAccents[POMODORO_SECTION_KEY].text} />
          <Text
            className="text-xs font-semibold uppercase tracking-[0.6px]"
            style={{ color: tokens.textMuted }}
          >
            Today
          </Text>
        </View>
        {metrics.map((metric) => {
          const meta = OVERVIEW_CARD_META[metric.id];
          return (
            <Pressable
              key={metric.id}
              accessibilityRole="button"
              accessibilityLabel={`${metric.spoken}. Open ${meta.title}`}
              onPress={() => openCardTarget(navigation, meta)}
              className="min-h-[44px] justify-center rounded-lg px-2 active:opacity-70"
            >
              <View className="flex-row items-baseline gap-1.5">
                <Text
                  className="text-base font-bold tabular-nums"
                  style={{ color: sectionAccents[metric.id].text }}
                >
                  {metric.value}
                </Text>
                <Text
                  className="text-[11px] uppercase tracking-[0.6px]"
                  style={{ color: tokens.textMuted }}
                >
                  {metric.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
