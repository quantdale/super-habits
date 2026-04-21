import { type ReactNode, useCallback, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from "react-native";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { POMODORO_SECTION_KEY, SECTION_COLORS, SECTION_TEXT_COLORS } from "@/constants/sectionColors";
import { Button } from "@/core/ui/Button";
import { Card } from "@/core/ui/Card";
import { EmptyStateCard } from "@/core/ui/EmptyStateCard";
import { PageHeader } from "@/core/ui/PageHeader";
import { Screen } from "@/core/ui/Screen";
import { ScreenSection } from "@/core/ui/ScreenSection";
import { COMMAND_EXPERIMENT_ENABLED } from "@/features/command/types";
import { getCalorieGoal, hasAnyCalorieEntries, listCalorieEntries } from "@/features/calories/calories.data";
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
import { listPomodoroSessions, listPomodoroSessionsForDateRange } from "@/features/pomodoro/pomodoro.data";
import {
  buildPomodoroHeatmapDays,
  computePomodoroStreakFromHeatmapDays,
} from "@/features/pomodoro/pomodoro.domain";
import { listTodos } from "@/features/todos/todos.data";
import type { Todo } from "@/features/todos/types";
import { listRoutines, listWorkoutLogs, listWorkoutLogsForRange } from "@/features/workout/workout.data";
import {
  buildWorkoutActivityDays,
  buildWorkoutHeatmapDays,
  computeWorkoutStreakFromHeatmapDays,
} from "@/features/workout/workout.domain";
import { buildDateRangeOldestFirst, toDateKey } from "@/lib/time";

type ViewMode = "grid" | "column" | "list";
type OverviewCardKey = "pomodoro" | "habits" | "calories" | "todos" | "workout";
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
  pomodoro: {
    title: "Focus",
    subtitle: "This year",
    icon: "timer",
    accentColor: SECTION_COLORS[POMODORO_SECTION_KEY],
    textColor: SECTION_TEXT_COLORS[POMODORO_SECTION_KEY],
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
  ["pomodoro", "habits"],
  ["calories", "todos", "workout"],
];
const GRID_TOP_ROW_CARD_CLASS = "min-h-[248px]";
const GRID_BOTTOM_ROW_CARD_CLASS = "min-h-[214px]";
const MUTED_ICON = "#94a3b8";
const SETTINGS_HREF = "/settings" as Href;
const CALORIES_HREF = "/(tabs)/calories" as Href;
const COMMAND_HREF = "/command" as Href;
const OVERVIEW_CARD_ORDER: OverviewCardKey[] = ["pomodoro", "habits", "calories", "todos", "workout"];
const POMODORO_HREF = "/(tabs)/pomodoro" as Href;

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
    <Card
      accentColor={meta.accentColor}
      className={["mb-0", className].filter(Boolean).join(" ")}
      innerClassName="p-0"
    >
      <View className="flex-1 p-4">
        <View className="flex-row items-center gap-3">
          <View
            className="h-11 w-11 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${meta.accentColor}18` }}
          >
            <MaterialIcons name={meta.icon} size={22} color={meta.textColor} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-base font-semibold text-slate-900">{meta.title}</Text>
            <Text className="mt-0.5 text-sm text-slate-500">{meta.subtitle}</Text>
          </View>
        </View>
        <View className={["mt-4", isDetailedView ? "flex-1 justify-between" : ""].join(" ").trim()}>
          {children}
        </View>
      </View>
    </Card>
  );
}

export function OverviewScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isLoading, setIsLoading] = useState(true);
  const [pendingTodosCount, setPendingTodosCount] = useState(0);
  const [topPendingTodos, setTopPendingTodos] = useState<Todo[]>([]);
  const [bestHabitStreak, setBestHabitStreak] = useState(0);
  const [habitConsistency, setHabitConsistency] = useState(0);
  const [pomodoroSessions, setPomodoroSessions] = useState(0);
  const [pomodoroStreak, setPomodoroStreak] = useState(0);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [hasAnyTrackedData, setHasAnyTrackedData] = useState(false);
  const [workoutDays, setWorkoutDays] = useState(0);
  const [workoutStreak, setWorkoutStreak] = useState(0);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = toDateKey();
      const yearRange = buildDateRangeOldestFirst(364);
      const startDate = yearRange[0];

      const [
        todos,
        calorieEntries,
        hasCalorieEntries,
        goal,
        recentPomodoroSessions,
        pomodoroSessions,
        routines,
        recentWorkoutLogs,
        workoutLogs,
        habits,
        allHabitCompletions,
      ] =
        await Promise.all([
          listTodos(),
          listCalorieEntries(today),
          hasAnyCalorieEntries(),
          getCalorieGoal(),
          listPomodoroSessions(1),
          listPomodoroSessionsForDateRange(startDate, today),
          listRoutines(),
          listWorkoutLogs(1),
          listWorkoutLogsForRange(startDate, today),
          listHabits(),
          getAllHabitCompletionsForRange(startDate, today),
        ]);

      const pending = todos.filter((t) => t.completed === 0);
      setPendingTodosCount(pending.length);
      setTopPendingTodos(pending.slice(0, 3));

      setCaloriesConsumed(caloriesTotal(calorieEntries));
      setCalorieGoal(goal.calories);
      setHasAnyTrackedData(
        todos.length > 0 ||
          habits.length > 0 ||
          hasCalorieEntries ||
          recentPomodoroSessions.length > 0 ||
          recentWorkoutLogs.length > 0 ||
          routines.length > 0,
      );

      const pomHeatmap = buildPomodoroHeatmapDays(pomodoroSessions, 364);
      setPomodoroSessions(pomodoroSessions.length);
      setPomodoroStreak(computePomodoroStreakFromHeatmapDays(pomHeatmap));

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
  const useSingleColumnGrid = width < 960;

  const renderCard = useCallback(
    (cardKey: OverviewCardKey, className?: string) => {
      switch (cardKey) {
        case "pomodoro":
          return (
            <OverviewMetricCard cardKey={cardKey} viewMode={viewMode} className={className}>
              {isListView ? (
                <View className="flex-row items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                      {pomodoroSessions} sessions
                    </Text>
                    <Text className="mt-1 text-sm text-slate-500">{pomodoroStreak} day streak</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Start focus session"
                    className="rounded-xl px-3.5 py-2.5 active:opacity-80"
                    style={{ backgroundColor: `${SECTION_COLORS.focus}26` }}
                    onPress={() => router.push(POMODORO_HREF)}
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
                      {pomodoroSessions}
                    </Text>
                    <Text className="mt-1 text-base font-semibold text-slate-700">sessions this year</Text>
                    <Text className="mt-2 text-sm text-slate-500">{pomodoroStreak} day streak</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Start focus session"
                    className="mt-5 w-full items-center rounded-xl px-4 py-3.5 active:opacity-80"
                    style={{ backgroundColor: `${SECTION_COLORS.focus}26` }}
                    onPress={() => router.push(POMODORO_HREF)}
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
                    className="rounded-xl border-2 px-3.5 py-2.5 active:opacity-80"
                    style={{ borderColor: SECTION_COLORS.calories }}
                    onPress={() => router.push(CALORIES_HREF)}
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
                    className="mt-4 self-start rounded-xl border-2 px-4 py-3 active:opacity-80"
                    style={{ borderColor: SECTION_COLORS.calories }}
                    onPress={() => router.push(CALORIES_HREF)}
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
      pomodoroSessions,
      pomodoroStreak,
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
      <ScreenSection>
        <PageHeader
          title="Overview"
          subtitle="A compact snapshot of focus, habits, calories, todos, and workouts."
          actions={
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open settings"
                className="rounded-xl p-2.5"
                onPress={() => router.push(SETTINGS_HREF)}
              >
                <MaterialIcons name="settings" size={24} color={MUTED_ICON} />
              </Pressable>
              {VIEW_MODE_OPTIONS.map(({ mode, icon }) => (
                <Pressable
                  key={mode}
                  accessibilityRole="button"
                  accessibilityState={{ selected: viewMode === mode }}
                  accessibilityLabel={`${mode} overview layout`}
                  className={`rounded-xl p-2.5 ${viewMode === mode ? "bg-focus-light" : ""}`}
                  onPress={() => setViewMode(mode)}
                >
                  <MaterialIcons
                    name={icon}
                    size={24}
                    color={viewMode === mode ? SECTION_TEXT_COLORS.focus : MUTED_ICON}
                  />
                </Pressable>
              ))}
            </>
          }
        />
      </ScreenSection>

      {COMMAND_EXPERIMENT_ENABLED ? (
        <ScreenSection>
          <Card accentColor="#475569" className="mb-0">
            <View className="flex-row items-center justify-between gap-4">
              <View className="min-w-0 flex-1">
                <Text className="text-base font-semibold text-slate-900">Quick command</Text>
                <Text className="mt-1 text-sm text-slate-500">
                  Experimental command shell for single todo or habit creation.
                </Text>
              </View>
              <View className="w-[148px]">
                <Button
                  label="Add with command"
                  onPress={() => router.push(COMMAND_HREF)}
                  color="#475569"
                />
              </View>
            </View>
          </Card>
        </ScreenSection>
      ) : null}

      {isLoading ? (
        <ScreenSection className="min-h-[220px] items-center justify-center py-14">
          <ActivityIndicator size="large" color={SECTION_TEXT_COLORS.focus} />
        </ScreenSection>
      ) : (
        <ScreenSection>
          {viewMode === "grid" ? (
            <View className="gap-4">
              {useSingleColumnGrid ? (
                <View className="gap-4">
                  {OVERVIEW_CARD_ORDER.map((cardKey) => renderCard(cardKey))}
                </View>
              ) : (
                <>
                  <View className="flex-row gap-4">
                    {GRID_ROWS[0].map((cardKey) => (
                      <View key={cardKey} className="flex-1">
                        {renderCard(cardKey, GRID_TOP_ROW_CARD_CLASS)}
                      </View>
                    ))}
                  </View>

                  <View className="flex-row gap-4">
                    {GRID_ROWS[1].map((cardKey) => (
                      <View key={cardKey} className="flex-1">
                        {renderCard(cardKey, GRID_BOTTOM_ROW_CARD_CLASS)}
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          ) : (
            <View className="flex-col gap-4">
              {OVERVIEW_CARD_ORDER.map((cardKey) => renderCard(cardKey))}
            </View>
          )}
        </ScreenSection>
      )}

      {!isLoading && !hasAnyTrackedData ? (
        <ScreenSection className="mb-0 mt-1">
          <EmptyStateCard
            accentColor={SECTION_COLORS.focus}
            className="mb-0"
            title="Nothing tracked yet"
            description="Start with any feature and this dashboard will begin filling in automatically."
            icon={<MaterialIcons name="auto-graph" size={24} color={SECTION_TEXT_COLORS.focus} />}
          />
        </ScreenSection>
      ) : null}
    </Screen>
  );
}
