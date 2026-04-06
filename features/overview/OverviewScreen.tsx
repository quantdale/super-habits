import { useCallback, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SECTION_COLORS, SECTION_TEXT_COLORS } from "@/constants/sectionColors";
import { Card, type CardVariant } from "@/core/ui/Card";
import { Screen } from "@/core/ui/Screen";
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
import { buildDateRangeOldestFirst, toDateKey } from "@/lib/time";

type ViewMode = "grid" | "column" | "list";
type OverviewCardKey = "focus" | "habits" | "calories" | "todos" | "workout";

const VIEW_MODE_OPTIONS: { mode: ViewMode; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { mode: "grid", icon: "grid-view" },
  { mode: "column", icon: "view-agenda" },
  { mode: "list", icon: "view-list" },
];
const GRID_CARD_WIDTHS: Record<OverviewCardKey, string> = {
  focus: "w-[48%]",
  habits: "w-[48%]",
  calories: "w-[31%]",
  todos: "w-[31%]",
  workout: "w-[31%]",
};
const MUTED_ICON = "#94a3b8";

function getCardVariant(cardKey: OverviewCardKey, viewMode: ViewMode): CardVariant {
  if (viewMode === "list") {
    return "standard";
  }

  return cardKey === "workout" ? "stat" : "header";
}

function getCardWidthClass(cardKey: OverviewCardKey, viewMode: ViewMode) {
  return viewMode === "grid" ? GRID_CARD_WIDTHS[cardKey] : "w-full";
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

  useFocusEffect(
    useCallback(() => {
      void loadDashboardData();
    }, [loadDashboardData]),
  );

  const isListView = viewMode === "list";
  const layoutClassName = viewMode === "grid" ? "flex-row flex-wrap gap-3" : "flex-col gap-3";

  return (
    <Screen scroll>
      <View className="mb-4 flex-row items-start justify-between">
        <Text className="text-2xl font-bold text-slate-900">Overview</Text>
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
      </View>

      {isLoading ? (
        <View className="min-h-[200px] items-center justify-center py-12">
          <ActivityIndicator size="large" color={SECTION_TEXT_COLORS.focus} />
        </View>
      ) : (
        <View className={layoutClassName}>
          <Card
            variant={getCardVariant("focus", viewMode)}
            accentColor={SECTION_COLORS.focus}
            className={`${getCardWidthClass("focus", viewMode)} mb-0`}
            headerTitle="Focus"
            headerSubtitle={isListView ? undefined : "This year"}
          >
            {isListView ? (
              <View className="flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: SECTION_TEXT_COLORS.focus }}
                  >
                    Focus
                  </Text>
                  <Text className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                    {focusSessions} sessions
                  </Text>
                  <Text className="mt-0.5 text-sm text-slate-500">
                    {focusStreak} day streak
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Start focus session"
                  className="rounded-xl px-3 py-2 active:opacity-80"
                  style={{ backgroundColor: `${SECTION_COLORS.focus}26` }}
                >
                  <Text className="text-sm font-semibold" style={{ color: SECTION_TEXT_COLORS.focus }}>
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
                  <Text className="text-base font-semibold" style={{ color: SECTION_TEXT_COLORS.focus }}>
                    Start Focus
                  </Text>
                </Pressable>
              </>
            )}
          </Card>

          <Card
            variant={getCardVariant("habits", viewMode)}
            accentColor={SECTION_COLORS.habits}
            className={`${getCardWidthClass("habits", viewMode)} mb-0`}
            headerTitle="Habits"
            headerSubtitle={isListView ? undefined : "Current streak"}
          >
            {isListView ? (
              <View className="flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: SECTION_TEXT_COLORS.habits }}
                  >
                    Habits
                  </Text>
                  <Text className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                    {bestHabitStreak} day streak
                  </Text>
                </View>
                <Text className="text-sm text-slate-500">{habitConsistency}% consistent</Text>
              </View>
            ) : (
              <View className="items-start">
                <Text className="text-3xl font-bold tabular-nums text-slate-900">{bestHabitStreak}</Text>
                <Text className="mt-1 text-base font-semibold text-slate-700">days streak</Text>
                <Text className="mt-2 text-sm text-slate-500">{habitConsistency}% consistent</Text>
              </View>
            )}
          </Card>

          <Card
            variant={getCardVariant("calories", viewMode)}
            accentColor={SECTION_COLORS.calories}
            className={`${getCardWidthClass("calories", viewMode)} mb-0`}
            headerTitle="Calories"
            headerSubtitle={isListView ? undefined : "Daily goal"}
          >
            {isListView ? (
              <View className="flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: SECTION_TEXT_COLORS.calories }}
                  >
                    Calories
                  </Text>
                  <Text className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                    {caloriesConsumed} / {calorieGoal} kcal
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add calorie entry"
                  className="rounded-xl border-2 px-3 py-2 active:opacity-80"
                  style={{ borderColor: SECTION_COLORS.calories }}
                >
                  <Text className="text-sm font-semibold" style={{ color: SECTION_TEXT_COLORS.calories }}>
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
                  <Text className="text-sm font-semibold" style={{ color: SECTION_TEXT_COLORS.calories }}>
                    Add entry
                  </Text>
                </Pressable>
              </>
            )}
          </Card>

          <Card
            variant={getCardVariant("todos", viewMode)}
            accentColor={SECTION_COLORS.todos}
            className={`${getCardWidthClass("todos", viewMode)} mb-0`}
            headerTitle="To-Do"
            headerSubtitle={isListView ? undefined : "Top priorities"}
          >
            {isListView ? (
              <View className="gap-2">
                <Text
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: SECTION_TEXT_COLORS.todos }}
                >
                  To-Do
                </Text>
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
          </Card>

          <Card
            variant={getCardVariant("workout", viewMode)}
            accentColor={SECTION_COLORS.workout}
            className={`${getCardWidthClass("workout", viewMode)} mb-0`}
          >
            {isListView ? (
              <View className="flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: SECTION_TEXT_COLORS.workout }}
                  >
                    Workout
                  </Text>
                  <Text className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                    {workoutDays} workout days
                  </Text>
                </View>
                <Text className="text-sm text-slate-500">{workoutStreak} day streak</Text>
              </View>
            ) : (
              <View className="w-full flex-row justify-between gap-4">
                <View className="min-w-0 flex-1">
                  <Text className="text-2xl font-bold tabular-nums text-slate-900">{workoutDays}</Text>
                  <Text className="mt-0.5 text-xs text-slate-500">workout days</Text>
                </View>
                <View className="min-w-0 flex-1 items-end">
                  <Text className="text-2xl font-bold tabular-nums text-slate-900">{workoutStreak}</Text>
                  <Text className="mt-0.5 text-xs text-slate-500">day streak</Text>
                </View>
              </View>
            )}
          </Card>
        </View>
      )}

      <View className="h-2" />
    </Screen>
  );
}
