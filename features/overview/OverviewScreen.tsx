import { type ComponentType, type ReactNode, useCallback, useEffect, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SECTION_COLORS, SECTION_TEXT_COLORS } from "@/constants/sectionColors";
import { FeaturePanel } from "@/core/ui/FeaturePanel";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { getCalorieGoal, listCalorieEntries } from "@/features/calories/calories.data";
import { caloriesTotal } from "@/features/calories/calories.domain";
import {
  getAllHabitCompletionsForRange,
  getCompletionHistory,
  listHabits,
} from "@/features/habits/habits.data";
import {
  buildDayCompletions,
  buildHabitGrid,
  calculateCurrentStreak,
  calculateOverallConsistency,
} from "@/features/habits/habits.domain";
import { listPomodoroSessionsForDateRange } from "@/features/pomodoro/pomodoro.data";
import {
  buildPomodoroHeatmapDays,
  computeFocusStreakFromHeatmapDays,
} from "@/features/pomodoro/pomodoro.domain";
import { listTodos } from "@/features/todos/todos.data";
import type { Todo } from "@/features/todos/types";
import { listWorkoutLogsForRange } from "@/features/workout/workout.data";
import {
  buildWorkoutActivityDays,
  buildWorkoutHeatmapDays,
  computeWorkoutStreakFromHeatmapDays,
} from "@/features/workout/workout.domain";
import { isDemoMode } from "@/lib/demo";
import { buildDateRangeOldestFirst, toDateKey } from "@/lib/time";

type ViewMode = "grid" | "column" | "list";
type OverviewCardKey = "focus" | "habits" | "calories" | "todos" | "workout";
type OverviewCardTone = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accentColor: string;
  textColor: string;
};

const VIEW_MODE_OPTIONS: { mode: ViewMode; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { mode: "grid", icon: "grid-view" },
  { mode: "column", icon: "view-agenda" },
  { mode: "list", icon: "view-list" },
];
const OVERVIEW_CARD_META: Record<OverviewCardKey, OverviewCardTone> = {
  focus: {
    title: "Focus",
    subtitle: "This year",
    icon: "timer",
    accentColor: SECTION_COLORS.focus,
    textColor: SECTION_TEXT_COLORS.focus,
  },
  habits: {
    title: "Habits",
    subtitle: "Current streak",
    icon: "track-changes",
    accentColor: SECTION_COLORS.habits,
    textColor: SECTION_TEXT_COLORS.habits,
  },
  calories: {
    title: "Calories",
    subtitle: "Daily goal",
    icon: "restaurant-menu",
    accentColor: SECTION_COLORS.calories,
    textColor: SECTION_TEXT_COLORS.calories,
  },
  todos: {
    title: "To-Do",
    subtitle: "Top priorities",
    icon: "checklist",
    accentColor: SECTION_COLORS.todos,
    textColor: SECTION_TEXT_COLORS.todos,
  },
  workout: {
    title: "Workout",
    subtitle: "Last 52 weeks",
    icon: "fitness-center",
    accentColor: SECTION_COLORS.workout,
    textColor: SECTION_TEXT_COLORS.workout,
  },
};
const GRID_ROWS: OverviewCardKey[][] = [
  ["focus", "habits"],
  ["calories", "todos", "workout"],
];
const GRID_TOP_ROW_CARD_CLASS = "min-h-[248px]";
const GRID_BOTTOM_ROW_CARD_CLASS = "min-h-[214px]";
const MUTED_ICON = "#94a3b8";
type OverviewDemoPanelProps = { onDataChanged: () => Promise<void> };

function OverviewMetricCard({
  cardKey,
  viewMode,
  className,
  children,
}: {
  cardKey: OverviewCardKey;
  viewMode: ViewMode;
  className?: string;
  children: ReactNode;
}) {
  const meta = OVERVIEW_CARD_META[cardKey];
  const isDetailedView = viewMode !== "list";

  return (
    <FeaturePanel
      title={meta.title}
      subtitle={meta.subtitle}
      icon={meta.icon}
      accentColor={meta.accentColor}
      textColor={meta.textColor}
      className={["mb-0", className].filter(Boolean).join(" ")}
      bodyClassName={isDetailedView ? "flex-1 justify-between" : undefined}
    >
      {children}
    </FeaturePanel>
  );
}

export function OverviewScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isLoading, setIsLoading] = useState(true);
  const [pendingTodosCount, setPendingTodosCount] = useState(0);
  const [topPendingTodos, setTopPendingTodos] = useState<Todo[]>([]);
  const [bestHabitStreak, setBestHabitStreak] = useState(0);
  const [habitConsistency, setHabitConsistency] = useState(0);
  const [focusSessions, setFocusSessions] = useState(0);
  const [focusStreak, setFocusStreak] = useState(0);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [workoutDays, setWorkoutDays] = useState(0);
  const [workoutStreak, setWorkoutStreak] = useState(0);
  const [DemoPanelComponent, setDemoPanelComponent] = useState<ComponentType<OverviewDemoPanelProps> | null>(null);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = toDateKey();
      const yearRange = buildDateRangeOldestFirst(364);
      const startDate = yearRange[0];

      const [todos, calorieEntries, goal, pomodoroSessions, workoutLogs, habits, allHabitCompletions] =
        await Promise.all([
          listTodos(),
          listCalorieEntries(today),
          getCalorieGoal(),
          listPomodoroSessionsForDateRange(startDate, today),
          listWorkoutLogsForRange(startDate, today),
          listHabits(),
          getAllHabitCompletionsForRange(startDate, today),
        ]);

      const pending = todos.filter((t) => t.completed === 0);
      setPendingTodosCount(pending.length);
      setTopPendingTodos(pending.slice(0, 3));

      setCaloriesConsumed(caloriesTotal(calorieEntries));
      setCalorieGoal(goal.calories);

      const pomHeatmap = buildPomodoroHeatmapDays(pomodoroSessions, 364);
      setFocusSessions(pomodoroSessions.length);
      setFocusStreak(computeFocusStreakFromHeatmapDays(pomHeatmap));

      const workoutActivity = buildWorkoutActivityDays(workoutLogs, 364);
      const workoutHeatmap = buildWorkoutHeatmapDays(workoutLogs, 364);
      setWorkoutDays(workoutActivity.filter((d) => d.active).length);
      setWorkoutStreak(computeWorkoutStreakFromHeatmapDays(workoutHeatmap));

      const gridBuilt = buildHabitGrid(
        habits.map((h) => ({
          id: h.id,
          name: h.name,
          color: h.color,
          target_per_day: h.target_per_day,
        })),
        allHabitCompletions,
        364,
      );
      setHabitConsistency(calculateOverallConsistency(gridBuilt));

      const streakEntries = await Promise.all(
        habits.map(async (habit) => {
          const completions = await getCompletionHistory(habit.id, 30);
          const dayCompletions = buildDayCompletions(completions, habit.target_per_day, 30);
          return calculateCurrentStreak(dayCompletions);
        }),
      );
      setBestHabitStreak(streakEntries.length === 0 ? 0 : Math.max(0, ...streakEntries));
    } catch (err) {
      console.error("[OverviewScreen] loadDashboardData failed", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isDemoMode) return;

    let isMounted = true;

    void import("./OverviewDemoPanel")
      .then((module) => {
        if (isMounted) {
          setDemoPanelComponent(() => module.OverviewDemoPanel);
        }
      })
      .catch((error) => {
        console.error("[OverviewScreen] failed to load demo panel", error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboardData();
    }, [loadDashboardData]),
  );

  const isListView = viewMode === "list";

  const renderCard = useCallback(
    (cardKey: OverviewCardKey, className?: string) => {
      switch (cardKey) {
        case "focus":
          return (
            <OverviewMetricCard cardKey={cardKey} viewMode={viewMode} className={className}>
              {isListView ? (
                <View className="flex-row items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                      {focusSessions} sessions
                    </Text>
                    <Text className="mt-1 text-sm text-slate-500">{focusStreak} day streak</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Start focus session"
                    className="rounded-xl px-3 py-2 active:opacity-80"
                    style={{ backgroundColor: `${SECTION_COLORS.focus}26` }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: SECTION_TEXT_COLORS.focus }}
                    >
                      Start
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View className="items-center">
                    <Text className="text-center text-5xl font-bold tabular-nums tracking-tight text-slate-900">
                      {focusSessions}
                    </Text>
                    <Text className="mt-1 text-base font-semibold text-slate-700">sessions this year</Text>
                    <Text className="mt-2 text-sm text-slate-500">{focusStreak} day streak</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Start focus session"
                    className="mt-5 w-full items-center rounded-xl py-3.5 active:opacity-80"
                    style={{ backgroundColor: `${SECTION_COLORS.focus}26` }}
                  >
                    <Text
                      className="text-base font-semibold"
                      style={{ color: SECTION_TEXT_COLORS.focus }}
                    >
                      Start Focus
                    </Text>
                  </Pressable>
                </>
              )}
            </OverviewMetricCard>
          );
        case "habits":
          return (
            <OverviewMetricCard cardKey={cardKey} viewMode={viewMode} className={className}>
              {isListView ? (
                <View className="flex-row items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-lg font-semibold tabular-nums text-slate-900">
                      {bestHabitStreak} day streak
                    </Text>
                  </View>
                  <Text className="text-sm text-slate-500">{habitConsistency}% consistent</Text>
                </View>
              ) : (
                <View className="items-start">
                  <Text className="text-3xl font-bold tabular-nums text-slate-900">
                    {bestHabitStreak}
                  </Text>
                  <Text className="mt-1 text-base font-semibold text-slate-700">days streak</Text>
                  <Text className="mt-2 text-sm text-slate-500">{habitConsistency}% consistent</Text>
                </View>
              )}
            </OverviewMetricCard>
          );
        case "calories":
          return (
            <OverviewMetricCard cardKey={cardKey} viewMode={viewMode} className={className}>
              {isListView ? (
                <View className="flex-row items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-lg font-semibold tabular-nums text-slate-900">
                      {caloriesConsumed} / {calorieGoal} kcal
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add calorie entry"
                    className="rounded-xl border-2 px-3 py-2 active:opacity-80"
                    style={{ borderColor: SECTION_COLORS.calories }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: SECTION_TEXT_COLORS.calories }}
                    >
                      Add
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text className="text-lg font-semibold tabular-nums text-slate-900">
                    {caloriesConsumed} / {calorieGoal} kcal
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add calorie entry"
                    className="mt-4 self-start rounded-xl border-2 px-4 py-2.5 active:opacity-80"
                    style={{ borderColor: SECTION_COLORS.calories }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: SECTION_TEXT_COLORS.calories }}
                    >
                      Add entry
                    </Text>
                  </Pressable>
                </>
              )}
            </OverviewMetricCard>
          );
        case "todos":
          return (
            <OverviewMetricCard cardKey={cardKey} viewMode={viewMode} className={className}>
              {isListView ? (
                <View className="gap-2">
                  <Text className="text-sm font-semibold text-slate-700">
                    {pendingTodosCount} pending {pendingTodosCount === 1 ? "task" : "tasks"}
                  </Text>
                  {topPendingTodos.length === 0 ? (
                    <Text className="text-sm text-slate-500">No pending tasks</Text>
                  ) : (
                    topPendingTodos.slice(0, 2).map((todo) => (
                      <View key={todo.id} className="flex-row items-center gap-3">
                        <View className="h-4 w-4 rounded border-2 border-slate-300 bg-white" />
                        <Text className="flex-1 text-sm text-slate-700" numberOfLines={2}>
                          {todo.title}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              ) : (
                <View className="gap-3">
                  <Text className="text-sm font-semibold text-slate-700">
                    {pendingTodosCount} pending {pendingTodosCount === 1 ? "task" : "tasks"}
                  </Text>
                  {topPendingTodos.length === 0 ? (
                    <Text className="text-base text-slate-500">No pending tasks</Text>
                  ) : (
                    topPendingTodos.map((todo) => (
                      <View key={todo.id} className="flex-row items-center gap-3">
                        <View className="h-5 w-5 rounded border-2 border-slate-300 bg-white" />
                        <Text className="flex-1 text-base text-slate-700" numberOfLines={2}>
                          {todo.title}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </OverviewMetricCard>
          );
        case "workout":
          return (
            <OverviewMetricCard cardKey={cardKey} viewMode={viewMode} className={className}>
              {isListView ? (
                <View className="flex-row items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-lg font-semibold tabular-nums text-slate-900">
                      {workoutDays} workout days
                    </Text>
                  </View>
                  <Text className="text-sm text-slate-500">{workoutStreak} day streak</Text>
                </View>
              ) : (
                <View className="w-full flex-row justify-between gap-4">
                  <View className="min-w-0 flex-1">
                    <Text className="text-2xl font-bold tabular-nums text-slate-900">
                      {workoutDays}
                    </Text>
                    <Text className="mt-0.5 text-xs text-slate-500">workout days</Text>
                  </View>
                  <View className="min-w-0 flex-1 items-end">
                    <Text className="text-2xl font-bold tabular-nums text-slate-900">
                      {workoutStreak}
                    </Text>
                    <Text className="mt-0.5 text-xs text-slate-500">day streak</Text>
                  </View>
                </View>
              )}
            </OverviewMetricCard>
          );
      }
    },
    [
      bestHabitStreak,
      calorieGoal,
      caloriesConsumed,
      focusSessions,
      focusStreak,
      habitConsistency,
      isListView,
      pendingTodosCount,
      topPendingTodos,
      viewMode,
      workoutDays,
      workoutStreak,
    ],
  );

  return (
    <Screen scroll>
      <SectionTitle
        title="Overview"
        right={(
          <View className="flex-row gap-1">
            {VIEW_MODE_OPTIONS.map(({ mode, icon }) => (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected: viewMode === mode }}
                accessibilityLabel={`${mode} overview layout`}
                className={`rounded-lg p-2 ${viewMode === mode ? "bg-focus-light" : ""}`}
                onPress={() => setViewMode(mode)}
              >
                <MaterialIcons
                  name={icon}
                  size={24}
                  color={viewMode === mode ? SECTION_TEXT_COLORS.focus : MUTED_ICON}
                />
              </Pressable>
            ))}
          </View>
        )}
      />

      {isDemoMode && DemoPanelComponent ? <DemoPanelComponent onDataChanged={loadDashboardData} /> : null}

      {isLoading ? (
        <View className="min-h-[200px] items-center justify-center py-12">
          <ActivityIndicator size="large" color={SECTION_TEXT_COLORS.focus} />
        </View>
      ) : (
        <>
          {viewMode === "grid" ? (
            <View className="gap-3">
              <View className="flex-row gap-3">
                {GRID_ROWS[0].map((cardKey) => (
                  <View key={cardKey} className="flex-1">
                    {renderCard(cardKey, GRID_TOP_ROW_CARD_CLASS)}
                  </View>
                ))}
              </View>

              <View className="flex-row gap-3">
                {GRID_ROWS[1].map((cardKey) => (
                  <View key={cardKey} className="flex-1">
                    {renderCard(cardKey, GRID_BOTTOM_ROW_CARD_CLASS)}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View className="flex-col gap-3">
              {(["focus", "habits", "calories", "todos", "workout"] as OverviewCardKey[]).map(
                (cardKey) => renderCard(cardKey),
              )}
            </View>
          )}
        </>
      )}

      <View className="h-2" />
    </Screen>
  );
}
