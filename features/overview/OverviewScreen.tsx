import { useCallback, useEffect, useRef, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { POMODORO_SECTION_KEY } from '@/constants/sectionColors';
import { useAppNavigation } from '@/core/providers/navigationContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { useAppTheme } from '@/core/providers/themeContext';
import { useActiveForegroundRefresh } from '@/lib/useForegroundRefresh';
import { buildDateRangeOldestFirst, timestampToLocalDateKey, toDateKey } from '@/lib/time';

import { getDailyPlan } from '@/features/daily-plan/dailyPlan.data';
import { getMomentumGarden } from '@/features/momentum/momentum.data';
import { MomentumCard } from '@/features/momentum/MomentumCard';
import type { MomentumGardenModel } from '@/features/momentum/momentum.types';
import {
  getCalorieGoal,
  listCalorieEntries,
  listCalorieEntriesInRange,
} from '@/features/calories/calories.data';
import { getAllHabitCompletionsForRange, listHabits } from '@/features/habits/habits.data';
import {
  getPomodoroActiveTimer,
  listPomodoroSessionsForDateRange,
} from '@/features/pomodoro/pomodoro.data';
import { listProjects } from '@/features/projects/projects.data';
import { listGoals } from '@/features/goals/goals.data';
import { listTodos } from '@/features/todos/todos.data';
import {
  getWorkoutSessionDraft,
  listRoutines,
  listWorkoutLogsForRange,
  resolveWorkoutScheduleForDate,
} from '@/features/workout/workout.data';

import { CaloriesCard } from './cards/CaloriesCard';
import { FocusCard } from './cards/FocusCard';
import { GoalsCard } from './cards/GoalsCard';
import { HabitsCard } from './cards/HabitsCard';
import { ProjectsCard } from './cards/ProjectsCard';
import { TodosCard } from './cards/TodosCard';
import { TodayPlanCard } from './cards/TodayPlanCard';
import { WorkoutCard } from './cards/WorkoutCard';
import { CustomizeCardsPanel } from './CustomizeCardsPanel';
import { FirstRunOnboardingCard } from './FirstRunOnboardingCard';
import { NextBestActionHero } from './NextBestActionHero';
import { TodayProgressStrip } from './TodayProgressStrip';
import { loadCardLayout, saveCardLayout } from './cardLayout.storage';
import {
  formatTodayHeading,
  getGreeting,
  listEmptyStateCtas,
  pickNextBestAction,
  shapeCaloriesSummary,
  shapeFocusWeekSummary,
  shapeGoalsSummary,
  shapeHabitsSummary,
  shapePlanProgressSummary,
  shapeProjectsSummary,
  shapeTodosSummary,
  shapeWorkoutSummary,
  type CaloriesSummary,
  type EmptyStateCta,
  type FocusWeekSummary,
  type GoalsSummary,
  type HabitsSummary,
  type NextBestAction,
  type OverviewCardId,
  type PlanProgressSummary,
  type ProjectsSummary,
  type TodosSummary,
  type WorkoutSummary,
} from './overview.domain';

type OverviewSummaries = {
  plan: PlanProgressSummary;
  todos: TodosSummary;
  habits: HabitsSummary;
  focus: FocusWeekSummary;
  workout: WorkoutSummary;
  calories: CaloriesSummary;
  projects: ProjectsSummary;
  goals: GoalsSummary;
};

const EMPTY_SUMMARIES: OverviewSummaries = {
  plan: {
    hasPlan: false,
    status: null,
    intention: null,
    totalPriorities: 0,
    completedPriorities: 0,
  },
  todos: {
    overdueCount: 0,
    dueTodayCount: 0,
    pendingCount: 0,
    completedTodayCount: 0,
    preview: [],
  },
  habits: { scheduledToday: 0, completedToday: 0, rings: [] },
  focus: { focusMinutes: 0, sessionCount: 0, perDayMinutes: [] },
  workout: { sessionsThisWeek: 0, lastWorkoutName: null, lastWorkoutDateKey: null },
  calories: { consumed: 0, goal: 0, remaining: 0, ratio: 0 },
  projects: { activeCount: 0, preview: [] },
  goals: { activeCount: 0, averageProgress: 0, preview: [] },
};

type OverviewLoadResult = {
  summaries: OverviewSummaries;
  nextBestAction: NextBestAction | null;
};

async function loadSummaries(): Promise<OverviewLoadResult> {
  const today = toDateKey();
  const weekKeys = buildDateRangeOldestFirst(7);
  const weekStart = weekKeys[0];

  const [
    todos,
    plan,
    habits,
    completionsToday,
    weekSessions,
    weekLogs,
    routines,
    calorieEntries,
    calorieGoal,
    weekCalorieEntries,
    projects,
    goals,
    focusTimerIntent,
    todayWorkoutSchedule,
    workoutDraft,
  ] = await Promise.all([
    listTodos(),
    getDailyPlan(today),
    listHabits(),
    getAllHabitCompletionsForRange(today, today),
    listPomodoroSessionsForDateRange(weekStart, today),
    listWorkoutLogsForRange(weekStart, today),
    listRoutines(),
    listCalorieEntries(today),
    getCalorieGoal(),
    listCalorieEntriesInRange(weekStart, today),
    listProjects(),
    listGoals(),
    getPomodoroActiveTimer(),
    resolveWorkoutScheduleForDate(today),
    getWorkoutSessionDraft(),
  ]);

  const routineNames = new Map(routines.map((routine) => [routine.id, routine.name]));
  const completedWorkoutToday = weekLogs.some((log) => {
    const completedAt = log.completed_at;
    return completedAt ? timestampToLocalDateKey(completedAt) === today : false;
  });
  const plannedWorkoutName = todayWorkoutSchedule.routineId
    ? (routineNames.get(todayWorkoutSchedule.routineId) ?? null)
    : null;
  const todayWorkoutState = workoutDraft
    ? 'resumable'
    : completedWorkoutToday
      ? 'completed'
      : todayWorkoutSchedule.planKind === 'workout' && todayWorkoutSchedule.routineId
        ? 'planned'
        : todayWorkoutSchedule.planKind === 'rest'
          ? 'rest'
          : 'unplanned';

  const summaries: OverviewSummaries = {
    plan: shapePlanProgressSummary(plan, todos),
    todos: shapeTodosSummary(todos, today),
    habits: shapeHabitsSummary(habits, completionsToday, today),
    focus: shapeFocusWeekSummary(weekSessions, weekKeys),
    workout: shapeWorkoutSummary(weekLogs, routineNames, weekKeys, {
      state: todayWorkoutState,
      plannedWorkoutName,
    }),
    calories: shapeCaloriesSummary(calorieEntries, calorieGoal.calories),
    projects: shapeProjectsSummary(projects),
    goals: shapeGoalsSummary(goals),
  };

  // A persisted timer intent only counts as running/pausable when it belongs
  // to today; stale intents from previous days are ignored.
  const focusTimerActive =
    focusTimerIntent !== null &&
    !Number.isNaN(new Date(focusTimerIntent.startedAtIso).getTime()) &&
    timestampToLocalDateKey(focusTimerIntent.startedAtIso) === today;

  return {
    summaries,
    nextBestAction: pickNextBestAction({
      todayKey: today,
      todos: summaries.todos,
      habits: summaries.habits,
      focus: summaries.focus,
      focusTimerActive,
      workout: summaries.workout,
      workoutRoutineCount: routines.length,
      calories: summaries.calories,
      caloriesInUse: weekCalorieEntries.length > 0,
    }),
  };
}

export function OverviewScreen({ isActive }: { isActive: boolean }) {
  const { openPlanningHub, setActiveSection, openSettings } = useAppNavigation();
  const dayGeneration = useDayRolloverGeneration();
  const { tokens, sectionAccents } = useAppTheme();

  const [layout, setLayout] = useState<OverviewCardId[]>([]);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<OverviewSummaries>(EMPTY_SUMMARIES);
  const [nextBestAction, setNextBestAction] = useState<NextBestAction | null>(null);
  const [momentum, setMomentum] = useState<MomentumGardenModel | null>(null);
  const refreshRequestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequestRef.current;
    const isCurrent = () => mountedRef.current && refreshRequestRef.current === requestId;
    setIsRefreshing(true);
    try {
      const [nextLayout, nextLoad] = await Promise.all([loadCardLayout(), loadSummaries()]);
      if (!isCurrent()) return;
      setLayout(nextLayout);
      setSummaries(nextLoad.summaries);
      setNextBestAction(nextLoad.nextBestAction);
      setLoadError(null);

      // The Garden is a derived read model. Load it after the compact
      // dashboard facts so a bounded history query can never delay the
      // day-oriented shell or block switching into another section.
      void getMomentumGarden({ todayKey: toDateKey(), days: 1 })
        .then((nextMomentum) => {
          if (isCurrent()) setMomentum(nextMomentum);
        })
        .catch((err) => {
          if (isCurrent()) console.error('[OverviewScreen] momentum refresh failed', err);
        });
    } catch (err) {
      if (!isCurrent()) return;
      // F7: a failed load must stay visible — per-card empty copy would read
      // as fake "all clear" data. The error panel below offers a retry.
      console.error('[OverviewScreen] refresh failed', err);
      setLoadError(err instanceof Error ? err.message : 'Could not load your dashboard.');
    } finally {
      if (isCurrent()) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useActiveForegroundRefresh(
    isActive,
    useCallback(() => {
      void refresh();
    }, [refresh]),
    dayGeneration,
  );

  const handleLayoutChange = useCallback((next: OverviewCardId[]) => {
    setLayout(next);
    saveCardLayout(next).catch((err) =>
      console.error('[OverviewScreen] saveCardLayout failed', err),
    );
  }, []);

  const renderCard = useCallback(
    (id: OverviewCardId) => {
      switch (id) {
        case 'plan':
          return <TodayPlanCard summary={summaries.plan} loading={isLoading} />;
        case 'todos':
          return <TodosCard summary={summaries.todos} loading={isLoading} />;
        case 'habits':
          return <HabitsCard summary={summaries.habits} loading={isLoading} />;
        case 'focus':
          return (
            <FocusCard
              summary={
                summaries.focus.perDayMinutes.length > 0
                  ? summaries.focus
                  : {
                      ...summaries.focus,
                      perDayMinutes: buildDateRangeOldestFirst(7).map((dateKey) => ({
                        dateKey,
                        minutes: 0,
                      })),
                    }
              }
              loading={isLoading}
            />
          );
        case 'workout':
          return <WorkoutCard summary={summaries.workout} loading={isLoading} />;
        case 'calories':
          return <CaloriesCard summary={summaries.calories} loading={isLoading} />;
        case 'projects':
          return <ProjectsCard summary={summaries.projects} loading={isLoading} />;
        case 'goals':
          return <GoalsCard summary={summaries.goals} loading={isLoading} />;
      }
    },
    [isLoading, summaries],
  );

  const greeting = getGreeting(new Date().getHours());
  const todayHeading = formatTodayHeading(new Date());
  const todayKey = toDateKey();
  // F9: a committed daily plan counts as tracked data.
  const hasAnyData =
    summaries.plan.hasPlan ||
    summaries.todos.pendingCount > 0 ||
    summaries.habits.scheduledToday > 0 ||
    summaries.focus.sessionCount > 0 ||
    summaries.workout.sessionsThisWeek > 0 ||
    summaries.workout.todayState === 'planned' ||
    summaries.workout.todayState === 'resumable' ||
    summaries.calories.consumed > 0 ||
    summaries.projects.activeCount > 0 ||
    summaries.goals.activeCount > 0 ||
    (momentum?.activeDays ?? 0) > 0;
  // Guided starter: primary CTA from the existing chain plus up to two
  // follow-up options (rendered only in the zero-data panel below).
  const starterCtas = listEmptyStateCtas(summaries);
  const openCtaDestination = useCallback(
    (cta: EmptyStateCta) => {
      if (cta.destination.kind === 'planning') {
        openPlanningHub(cta.destination.view);
      } else {
        setActiveSection(cta.destination.section);
      }
    },
    [openPlanningHub, setActiveSection],
  );

  return (
    <View className="flex-1" style={{ backgroundColor: tokens.background }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 36 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              void refresh();
            }}
            tintColor={sectionAccents[POMODORO_SECTION_KEY].text}
            colors={[sectionAccents[POMODORO_SECTION_KEY].text]}
          />
        }
      >
        <View className="mx-auto w-full max-w-[1180px]">
          <View className="flex-row flex-wrap items-start justify-between gap-4">
            <View className="min-w-0 flex-1">
              <Text className="text-2xl font-bold leading-tight" style={{ color: tokens.text }}>
                {greeting}
              </Text>
              <Text className="mt-1.5 text-sm leading-6" style={{ color: tokens.textMuted }}>
                {todayHeading}
              </Text>
            </View>
            <View className="shrink-0 flex-row flex-wrap items-center justify-end gap-2 pt-0.5">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isCustomizing ? 'Done customizing' : 'Customize dashboard'}
                accessibilityState={{ selected: isCustomizing }}
                onPress={() => setIsCustomizing((prev) => !prev)}
                className="flex-row items-center gap-1.5 rounded-xl px-3 py-2 active:opacity-80"
                style={{
                  backgroundColor: isCustomizing
                    ? `${sectionAccents[POMODORO_SECTION_KEY].text}1f`
                    : tokens.surfaceElevated,
                }}
              >
                <MaterialIcons
                  name="tune"
                  size={18}
                  color={sectionAccents[POMODORO_SECTION_KEY].text}
                />
                <Text
                  className="text-sm font-semibold"
                  style={{ color: sectionAccents[POMODORO_SECTION_KEY].text }}
                >
                  {isCustomizing ? 'Done' : 'Customize'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open settings"
                onPress={openSettings}
                className="flex-row items-center gap-1.5 rounded-xl px-3 py-2 active:opacity-80"
                style={{ backgroundColor: tokens.surfaceElevated }}
              >
                <MaterialIcons
                  name="settings"
                  size={18}
                  color={sectionAccents[POMODORO_SECTION_KEY].text}
                />
                <Text
                  className="text-sm font-semibold"
                  style={{ color: sectionAccents[POMODORO_SECTION_KEY].text }}
                >
                  Settings
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Plan today"
                onPress={() => openPlanningHub('today')}
                className="flex-row items-center gap-1.5 rounded-xl px-3 py-2 active:opacity-80"
                style={{ backgroundColor: tokens.surfaceElevated }}
              >
                <MaterialIcons
                  name="event-note"
                  size={18}
                  color={sectionAccents[POMODORO_SECTION_KEY].text}
                />
                <Text
                  className="text-sm font-semibold"
                  style={{ color: sectionAccents[POMODORO_SECTION_KEY].text }}
                >
                  Plan
                </Text>
              </Pressable>
            </View>
          </View>

          {isCustomizing ? (
            <View className="mt-5">
              <CustomizeCardsPanel layout={layout} onChange={handleLayoutChange} />
            </View>
          ) : null}

          {/* Pinned daily orientation: Next Best Action hero + Today progress
              strip. Always rendered regardless of customization — they are
              NOT part of the removable card registry. */}
          {!isLoading && !loadError ? (
            <View className="mt-5 gap-4">
              {nextBestAction ? <NextBestActionHero action={nextBestAction} /> : null}
              <TodayProgressStrip
                todayKey={todayKey}
                todos={summaries.todos}
                habits={summaries.habits}
                focus={summaries.focus}
                workout={summaries.workout}
                calories={summaries.calories}
              />
              {momentum ? (
                <MomentumCard model={momentum} onViewGarden={() => openPlanningHub('progress')} />
              ) : null}
            </View>
          ) : null}

          {isLoading && !isRefreshing ? (
            <View className="mt-5 min-h-[220px] items-center justify-center">
              <ActivityIndicator size="large" color={sectionAccents[POMODORO_SECTION_KEY].text} />
            </View>
          ) : loadError ? (
            <View
              className="mt-5 items-center rounded-2xl border border-dashed py-8"
              style={{ borderColor: tokens.border }}
            >
              <MaterialIcons name="error-outline" size={24} color={tokens.dangerSolid} />
              <Text className="mt-2 text-base font-semibold" style={{ color: tokens.text }}>
                Your dashboard couldn&apos;t load
              </Text>
              <Text className="mt-1 px-8 text-center text-sm" style={{ color: tokens.textMuted }}>
                {loadError}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading the dashboard"
                onPress={() => {
                  void refresh();
                }}
                className="mt-4 rounded-xl px-4 py-2.5 active:opacity-80"
                style={{
                  backgroundColor: `${sectionAccents[POMODORO_SECTION_KEY].text}1f`,
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: sectionAccents[POMODORO_SECTION_KEY].text }}
                >
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="mt-5 gap-4">
              {layout.map((id) => (
                <View key={id}>{renderCard(id)}</View>
              ))}
              {!isCustomizing && !hasAnyData ? (
                <View
                  className="items-center rounded-2xl border border-dashed py-8"
                  style={{ borderColor: tokens.border }}
                >
                  <MaterialIcons
                    name="auto-graph"
                    size={24}
                    color={sectionAccents[POMODORO_SECTION_KEY].text}
                  />
                  <Text className="mt-2 text-base font-semibold" style={{ color: tokens.text }}>
                    Nothing tracked yet
                  </Text>
                  <Text
                    className="mt-1 px-8 text-center text-sm"
                    style={{ color: tokens.textMuted }}
                  >
                    Start with any feature and this dashboard will begin filling in automatically.
                  </Text>
                  <View className="mt-4 flex-row flex-wrap items-center justify-center gap-2">
                    {starterCtas.map((cta, index) => (
                      <Pressable
                        key={cta.label}
                        accessibilityRole="button"
                        accessibilityLabel={cta.label}
                        onPress={() => openCtaDestination(cta)}
                        className="min-h-[44px] justify-center rounded-xl px-4 py-2.5 active:opacity-80"
                        style={
                          index === 0
                            ? {
                                backgroundColor: `${sectionAccents[POMODORO_SECTION_KEY].text}1f`,
                              }
                            : {
                                backgroundColor: tokens.surfaceElevated,
                                borderWidth: 1,
                                borderColor: tokens.border,
                              }
                        }
                      >
                        <Text
                          className="text-sm font-semibold"
                          style={{
                            color:
                              index === 0 ? sectionAccents[POMODORO_SECTION_KEY].text : tokens.text,
                          }}
                        >
                          {cta.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              {/* Lightweight first-run onboarding (docs/ui-ux/03-feature-
                  blueprints.md §13): an ordinary card at the very bottom —
                  never a modal, hidden once completed/skipped or once real
                  data exists. */}
              {!isCustomizing ? (
                <FirstRunOnboardingCard
                  hasAnyData={hasAnyData}
                  onDataChanged={() => {
                    void refresh();
                  }}
                />
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
