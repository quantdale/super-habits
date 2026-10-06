import { Text } from '@/core/ui/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { useAppNavigation } from '@/core/providers/navigationContext';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing } from '@/core/theme/designTokens';

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
 * Today at a glance (docs/ui-ux/13 §3/§12): one compact cross-domain strip —
 * neutral surfaces, hairline borders, and section hue carried only by the
 * small icon. W5 correction for defect SYS-03: the Pop treatment tinted every
 * tile with its section hue, so the strip read as five competing color fields;
 * a neutral row with hue-marked icons scans as one measurement, not a rainbow.
 * Values use tabular numerals; state semantics stay in the text (never
 * color-only; never danger-red for neutral incomplete progress).
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
    /** Semantic state icon override (status, not decoration). */
    icon?: keyof typeof MaterialIcons.glyphMap;
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
      value: habits.scheduledToday > 0 ? `${habits.completedToday}/${habits.scheduledToday}` : '—',
      label: 'Habits',
      spoken:
        habits.scheduledToday > 0
          ? `Habits: ${habits.completedToday} of ${habits.scheduledToday} complete`
          : 'Habits: nothing scheduled today',
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
      icon: workoutDoneToday ? 'check-circle' : undefined,
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
    <View>
      <Text
        variant="caption"
        tone="muted"
        style={{ letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.sm }}
      >
        Today at a glance
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {metrics.map((metric) => {
          const meta = OVERVIEW_CARD_META[metric.id];
          // Hue marks identity on the icon only; value/label stay in primary
          // ink on the neutral surface so the strip reads as one measurement.
          return (
            <Pressable
              key={metric.id}
              accessibilityRole="button"
              accessibilityLabel={`${metric.spoken}. Open ${meta.title}`}
              onPress={() => openCardTarget(navigation, meta)}
              style={({ pressed }) => ({
                flexGrow: 1,
                flexBasis: 96,
                minWidth: 96,
                paddingVertical: spacing.sm + 2,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.md,
                alignItems: 'center',
                gap: 2,
                minHeight: 64,
                justifyContent: 'center',
                backgroundColor: tokens.surface,
                borderWidth: 1,
                borderColor: tokens.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <MaterialIcons
                name={metric.icon ?? meta.icon}
                size={16}
                color={sectionAccents[metric.id].text}
              />
              <Text
                variant="metric"
                style={{ color: tokens.text, fontSize: 19, lineHeight: 24 }}
                numberOfLines={1}
              >
                {metric.value}
              </Text>
              <Text variant="caption" tone="muted" style={{ fontSize: 10.5 }} numberOfLines={1}>
                {metric.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
