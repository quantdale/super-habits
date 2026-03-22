import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { Card } from "@/core/ui/Card";
import { TextField } from "@/core/ui/TextField";
import { Button } from "@/core/ui/Button";
import { PillChip } from "@/core/ui/PillChip";
import { SECTION_COLORS } from "@/constants/sectionColors";
import {
  addCalorieEntry,
  deleteCalorieEntry,
  listCalorieEntries,
  listRecentSavedMeals,
  searchSavedMeals,
  getCalorieSummaryByRange,
  getCalorieGoal,
  setCalorieGoal,
  DEFAULT_GOAL,
  type CalorieGoal,
  type DailySummary,
} from "@/features/calories/calories.data";
import {
  buildCalorieActivityDays,
  buildMacroDonutData,
  buildWeeklyTrend,
  calculateGoalProgress,
  caloriesTotal,
  kcalFromMacros,
} from "@/features/calories/calories.domain";
import { ActivityPreviewStrip, type ActivityDay } from "@/features/shared/ActivityPreviewStrip";
import { toDateKey } from "@/lib/time";
import type { CalorieEntry, MealType, SavedMeal } from "./types";
import { MacroDonutChart } from "./MacroDonutChart";
import { WeeklyCalorieChart } from "./WeeklyCalorieChart";
import { CalorieGoalSheet } from "./CalorieGoalSheet";
import { SavedMealChips } from "./SavedMealChips";
import { SavedMealSearchSheet } from "./SavedMealSearchSheet";

const COLOR = SECTION_COLORS.calories;

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export function CaloriesScreen() {
  const [food, setFood] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [fiber, setFiber] = useState("");
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [formError, setFormError] = useState<string | null>(null);
  const [entries, setEntries] = useState<CalorieEntry[]>([]);
  const [goal, setGoal] = useState<CalorieGoal>(DEFAULT_GOAL);
  const [weeklyData, setWeeklyData] = useState<DailySummary[]>([]);
  const [goalSheetVisible, setGoalSheetVisible] = useState(false);
  const [weeklyVisible, setWeeklyVisible] = useState(false);
  const [calorieActivityDays, setCalorieActivityDays] = useState<ActivityDay[]>([]);
  const [recentMeals, setRecentMeals] = useState<SavedMeal[]>([]);
  const [allSavedMeals, setAllSavedMeals] = useState<SavedMeal[]>([]);
  const [searchSheetVisible, setSearchSheetVisible] = useState(false);

  const refresh = useCallback(async () => {
    const next = await listCalorieEntries();
    setEntries(next);

    const recent = await listRecentSavedMeals(5);
    const all = await searchSavedMeals("");
    setRecentMeals(recent);
    setAllSavedMeals(all);

    const start = new Date();
    start.setDate(start.getDate() - 6);
    const weekSummaries = await getCalorieSummaryByRange(toDateKey(start), toDateKey(new Date()));
    setWeeklyData(weekSummaries);

    const start30 = new Date();
    start30.setDate(start30.getDate() - 29);
    const range30 = await getCalorieSummaryByRange(toDateKey(start30), toDateKey(new Date()));
    const savedGoal = await getCalorieGoal();
    const activityDays30 = buildCalorieActivityDays(range30, savedGoal.calories, 30);
    setCalorieActivityDays(activityDays30);

    setGoal(savedGoal);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    setFormError(null);
  }, [food, protein, carbs, fats, fiber, mealType]);

  const todayTotals = {
    protein: entries.reduce((s, e) => s + e.protein, 0),
    carbs: entries.reduce((s, e) => s + e.carbs, 0),
    fats: entries.reduce((s, e) => s + e.fats, 0),
    fiber: entries.reduce((s, e) => s + e.fiber, 0),
  };
  const macroSlices = buildMacroDonutData(
    todayTotals.protein,
    todayTotals.carbs,
    todayTotals.fats,
    todayTotals.fiber,
  );
  const weeklyTrend = buildWeeklyTrend(weeklyData, 7);
  const goalProgress = calculateGoalProgress(caloriesTotal(entries), goal.calories);

  const hasCalorieStripActivity = calorieActivityDays.some((d) => d.active);
  const consistencyText = hasCalorieStripActivity
    ? `${goalProgress.percent}% of daily goal today`
    : "Log food to start tracking";

  const computedKcal = useMemo(
    () =>
      kcalFromMacros(
        Number(protein) || 0,
        Number(carbs) || 0,
        Number(fats) || 0,
        Number(fiber) || 0,
      ),
    [protein, carbs, fats, fiber],
  );

  const handleSelectSavedMeal = (meal: SavedMeal) => {
    setFood(meal.food_name);
    setProtein(String(meal.protein));
    setCarbs(String(meal.carbs));
    setFats(String(meal.fats));
    setFiber(String(meal.fiber));
    setMealType(meal.meal_type as MealType);
  };

  const onAdd = () => {
    void (async () => {
      setFormError(null);
      try {
        if (!food.trim()) {
          setFormError("Enter a food name.");
          return;
        }
        if (!Number.isFinite(computedKcal) || computedKcal <= 0) {
          setFormError("Calories work out to zero. Enter macro amounts that add up to energy.");
          return;
        }

        await addCalorieEntry({
          foodName: food.trim(),
          calories: computedKcal,
          protein: Number(protein) || 0,
          carbs: Number(carbs) || 0,
          fats: Number(fats) || 0,
          fiber: Number(fiber) || 0,
          mealType,
        });
        setFood("");
        setProtein("");
        setCarbs("");
        setFats("");
        setFiber("");
        await refresh();
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : "Could not save entry.";
        setFormError(msg);
      }
    })();
  };

  return (
    <Screen scroll>
      <SectionTitle title="Calories" subtitle="Manual nutrition entry for MVP." />
      <Card accentColor={COLOR}>
        <SavedMealChips meals={recentMeals} onSelect={handleSelectSavedMeal} />
        {allSavedMeals.length > 0 ? (
          <Pressable
            onPress={() => setSearchSheetVisible(true)}
            className="flex-row items-center gap-1 mb-3"
          >
            <Text className="text-xs text-calories">
              🔍 Search saved meals ({allSavedMeals.length})
            </Text>
          </Pressable>
        ) : null}
        <TextField label="Food" value={food} onChangeText={setFood} placeholder="Greek yogurt" />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <TextField label="Protein (g)" value={protein} onChangeText={setProtein} unsignedInteger />
          </View>
          <View className="flex-1">
            <TextField label="Carbs (g)" value={carbs} onChangeText={setCarbs} unsignedInteger />
          </View>
          <View className="flex-1">
            <TextField label="Fats (g)" value={fats} onChangeText={setFats} unsignedInteger />
          </View>
          <View className="flex-1">
            <TextField label="Fiber (g)" value={fiber} onChangeText={setFiber} unsignedInteger placeholder="0" />
          </View>
        </View>
        <View className="mb-3">
          <View className="flex-row items-center gap-3">
            <Text className="text-sm font-medium text-slate-700">Calories (kcal)</Text>
            <Text className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-base text-slate-900">
              {computedKcal > 0 ? computedKcal : "—"}
            </Text>
          </View>
          <Text className="mt-1 text-xs text-slate-500">
            Auto-calculated from protein, carbs, fat, and fiber.
          </Text>
        </View>
        <Text className="mb-2 text-sm font-medium text-slate-700">Meal</Text>
        <View className="mb-4 flex-row flex-wrap">
          {MEAL_OPTIONS.map(({ value, label }) => (
            <PillChip
              key={value}
              label={label}
              active={mealType === value}
              color={COLOR}
              onPress={() => setMealType(value)}
            />
          ))}
        </View>
        {formError ? <Text className="mb-2 text-sm text-rose-600">{formError}</Text> : null}
        <Button label="Add entry" onPress={onAdd} color={COLOR} />
      </Card>

      <Card accentColor={COLOR}>
        <View className="mb-3 items-center rounded-xl border border-calories bg-white p-3">
          <Text className="text-center text-sm font-medium text-slate-600">{consistencyText}</Text>
        </View>

        <View className="mb-4">
          <View className="mb-1 flex-row items-center justify-center gap-8">
            <Text className="text-sm text-slate-600">Today: {caloriesTotal(entries)} kcal</Text>
            <Pressable onPress={() => setGoalSheetVisible(true)}>
              <Text className="text-sm text-calories">
                Goal: {goal.calories} kcal ✎
              </Text>
            </Pressable>
          </View>
          <View className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <View
              className={`h-full rounded-full ${goalProgress.over ? "bg-rose-400" : "bg-calories"}`}
              style={{ width: `${goalProgress.percent}%` }}
            />
          </View>
          {goalProgress.over && (
            <Text className="text-xs text-rose-400 mt-1 text-center">
              {caloriesTotal(entries) - goal.calories} kcal over goal
            </Text>
          )}
        </View>

        <MacroDonutChart slices={macroSlices} totalKcal={caloriesTotal(entries)} goalKcal={goal.calories} />

        <ActivityPreviewStrip
          days={calorieActivityDays}
          accentColor={COLOR}
          statLabel=""
          emptyLabel="Log food to start tracking"
          showLabel={false}
        />
      </Card>

      <CalorieGoalSheet
        visible={goalSheetVisible}
        currentGoal={goal}
        onSave={async (newGoal) => {
          await setCalorieGoal(newGoal);
          setGoal(newGoal);
        }}
        onClose={() => setGoalSheetVisible(false)}
      />

      <SavedMealSearchSheet
        visible={searchSheetVisible}
        meals={allSavedMeals}
        onSelect={(meal) => {
          handleSelectSavedMeal(meal);
          setSearchSheetVisible(false);
        }}
        onClose={() => setSearchSheetVisible(false)}
        onDeleted={() => {
          void refresh();
        }}
      />

      {entries.map((entry) => (
        <Card key={entry.id} accentColor={COLOR}>
          <Text className="text-base font-semibold text-slate-900">
            {entry.food_name} - {entry.calories} kcal
          </Text>
          <Text className="mt-1 text-sm capitalize text-slate-600">
            {entry.meal_type} · P {entry.protein}g / C {entry.carbs}g / F {entry.fats}g / Fiber {entry.fiber}g
          </Text>
          <View className="mt-3">
            <Button
              label="Delete"
              variant="danger"
              onPress={async () => {
                await deleteCalorieEntry(entry.id);
                await refresh();
              }}
            />
          </View>
        </Card>
      ))}

      <View className="mt-4">
        <Pressable onPress={() => setWeeklyVisible((v) => !v)}>
          <Text className="text-xs text-calories text-center py-2">
            {weeklyVisible ? "▲ hide weekly trend" : "▼ weekly trend"}
          </Text>
        </Pressable>
        {weeklyVisible && (
          <WeeklyCalorieChart data={weeklyTrend} goalKcal={goal.calories} />
        )}
      </View>
    </Screen>
  );
}
