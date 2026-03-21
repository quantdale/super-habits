import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { Card } from "@/core/ui/Card";
import { TextField } from "@/core/ui/TextField";
import { Button } from "@/core/ui/Button";
import {
  addCalorieEntry,
  deleteCalorieEntry,
  listCalorieEntries,
  getCalorieSummaryByRange,
  getCalorieGoal,
  setCalorieGoal,
  DEFAULT_GOAL,
  type CalorieGoal,
  type DailySummary,
} from "@/features/calories/calories.data";
import {
  buildMacroDonutData,
  buildWeeklyTrend,
  calculateGoalProgress,
  caloriesTotal,
  kcalFromMacros,
} from "@/features/calories/calories.domain";
import { toDateKey } from "@/lib/time";
import type { CalorieEntry, MealType } from "./types";
import { MacroDonutChart } from "./MacroDonutChart";
import { WeeklyCalorieChart } from "./WeeklyCalorieChart";
import { CalorieGoalSheet } from "./CalorieGoalSheet";

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

  const refresh = useCallback(async () => {
    const next = await listCalorieEntries();
    setEntries(next);

    const start = new Date();
    start.setDate(start.getDate() - 6);
    const weekSummaries = await getCalorieSummaryByRange(toDateKey(start), toDateKey(new Date()));
    setWeeklyData(weekSummaries);

    const savedGoal = await getCalorieGoal();
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
      <Card>
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
        <View className="mb-4 flex-row flex-wrap gap-2">
          {MEAL_OPTIONS.map(({ value, label }) => (
            <Pressable
              key={value}
              onPress={() => setMealType(value)}
              className={`rounded-xl px-3 py-2 ${
                mealType === value ? "bg-brand-500" : "bg-slate-200"
              }`}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  mealType === value ? "text-white" : "text-slate-700"
                }`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {formError ? <Text className="mb-2 text-sm text-rose-600">{formError}</Text> : null}
        <Button label="Add entry" onPress={onAdd} />
      </Card>

      <Card>
        <View className="mb-4">
          <View className="flex-row justify-between mb-1">
            <Text className="text-sm text-slate-600">Today: {caloriesTotal(entries)} kcal</Text>
            <Pressable onPress={() => setGoalSheetVisible(true)}>
              <Text className="text-sm text-brand-500">
                Goal: {goal.calories} kcal ✎
              </Text>
            </Pressable>
          </View>
          <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <View
              className={`h-full rounded-full ${goalProgress.over ? "bg-rose-400" : "bg-brand-500"}`}
              style={{ width: `${goalProgress.percent}%` }}
            />
          </View>
          {goalProgress.over && (
            <Text className="text-xs text-rose-400 mt-1">
              {caloriesTotal(entries) - goal.calories} kcal over goal
            </Text>
          )}
        </View>

        <MacroDonutChart slices={macroSlices} totalKcal={caloriesTotal(entries)} goalKcal={goal.calories} />

        <Pressable onPress={() => setWeeklyVisible((v) => !v)} className="py-2">
          <Text className="text-xs text-brand-500 text-center">
            {weeklyVisible ? "▲ hide weekly" : "▼ weekly trend"}
          </Text>
        </Pressable>
        {weeklyVisible && <WeeklyCalorieChart data={weeklyTrend} goalKcal={goal.calories} />}
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

      {entries.map((entry) => (
        <Card key={entry.id}>
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
    </Screen>
  );
}
