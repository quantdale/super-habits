import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
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
  updateCalorieEntry,
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
  buildCalorieHeatmapDays,
  calculateGoalProgress,
  caloriesTotal,
  kcalFromMacros,
} from "@/features/calories/calories.domain";
import type { ActivityDay } from "@/features/shared/ActivityPreviewStrip";
import { GitHubHeatmap, type HeatmapDay } from "@/features/shared/GitHubHeatmap";
import { toDateKey } from "@/lib/time";
import type { CalorieEntry, MealType, SavedMeal } from "./types";
import { MacroDonutChart } from "./MacroDonutChart";
import { WeeklyCalorieChart } from "./WeeklyCalorieChart";
import { CalorieGoalSheet } from "./CalorieGoalSheet";
import { SavedMealChips } from "./SavedMealChips";
import { SavedMealSearchSheet } from "./SavedMealSearchSheet";
import { SwipeRightActions } from "@/core/ui/SwipeRightActions";
import { ValidationError } from "@/core/ui/ValidationError";
import { validateCalorieComputedKcal, validateCalorieEntry } from "@/lib/validation";

const COLOR = SECTION_COLORS.calories;

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

function buildWeeklyTotals(
  summaries: DailySummary[],
  weeks: number = 52,
): { weekLabel: string; value: number }[] {
  const buckets: number[] = Array(weeks).fill(0);
  const today = new Date();

  for (const s of summaries) {
    const d = new Date(s.dateKey + "T00:00:00");
    const daysAgo = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    const weekIndex = weeks - 1 - Math.floor(daysAgo / 7);
    if (weekIndex >= 0 && weekIndex < weeks) {
      buckets[weekIndex] += s.totalCalories;
    }
  }

  return buckets.map((value, i) => {
    const weeksAgo = weeks - 1 - i;
    const d = new Date();
    d.setDate(d.getDate() - weeksAgo * 7);
    const label = d.toLocaleDateString("en", { month: "short", day: "numeric" });
    return { weekLabel: label, value };
  });
}

function CalorieEntrySwipeRow({
  entry,
  accentColor,
  onEdit,
  onDelete,
}: {
  entry: CalorieEntry;
  accentColor: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={() => (
        <SwipeRightActions
          editColor={accentColor}
          onEdit={() => {
            swipeableRef.current?.close();
            onEdit();
          }}
          onDelete={() => {
            swipeableRef.current?.close();
            onDelete();
          }}
        />
      )}
      rightThreshold={40}
      overshootRight={false}
    >
      <Card accentColor={accentColor}>
        <Text className="text-base font-semibold text-slate-900">
          {entry.food_name} - {entry.calories} kcal
        </Text>
        <Text className="mt-1 text-sm capitalize text-slate-600">
          {entry.meal_type} · P {entry.protein}g / C {entry.carbs}g / F {entry.fats}g / Fiber{" "}
          {entry.fiber}g
        </Text>
      </Card>
    </Swipeable>
  );
}

export function CaloriesScreen() {
  const [food, setFood] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [fiber, setFiber] = useState("");
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [calorieError, setCalorieError] = useState<string | null>(null);
  const [entries, setEntries] = useState<CalorieEntry[]>([]);
  const [goal, setGoal] = useState<CalorieGoal>(DEFAULT_GOAL);
  const [summary364, setSummary364] = useState<DailySummary[]>([]);
  const [goalSheetVisible, setGoalSheetVisible] = useState(false);
  const [calorieActivityDays, setCalorieActivityDays] = useState<ActivityDay[]>([]);
  const [calorieHeatmapDays, setCalorieHeatmapDays] = useState<HeatmapDay[]>([]);
  const [recentMeals, setRecentMeals] = useState<SavedMeal[]>([]);
  const [allSavedMeals, setAllSavedMeals] = useState<SavedMeal[]>([]);
  const [searchSheetVisible, setSearchSheetVisible] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await listCalorieEntries();
    setEntries(next);

    const recent = await listRecentSavedMeals(5);
    const all = await searchSavedMeals("");
    setRecentMeals(recent);
    setAllSavedMeals(all);

    const start364 = new Date();
    start364.setDate(start364.getDate() - 363);
    const range364 = await getCalorieSummaryByRange(toDateKey(start364), toDateKey(new Date()));
    setSummary364(range364);
    const savedGoal = await getCalorieGoal();
    const activityDays364 = buildCalorieActivityDays(range364, savedGoal.calories, 364);
    setCalorieActivityDays(activityDays364);
    setCalorieHeatmapDays(buildCalorieHeatmapDays(range364, savedGoal.calories, 364));

    setGoal(savedGoal);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const todayTotals = {
    protein: entries.reduce((s, e) => s + e.protein, 0),
    carbs: entries.reduce((s, e) => s + e.carbs, 0),
    fats: entries.reduce((s, e) => s + e.fats, 0),
    fiber: entries.reduce((s, e) => s + e.fiber, 0),
  };
  const weeklyTotals = useMemo(() => buildWeeklyTotals(summary364, 52), [summary364]);
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
    setCalorieError(null);
    setEditingEntryId(null);
    setFood(meal.food_name);
    setProtein(String(meal.protein));
    setCarbs(String(meal.carbs));
    setFats(String(meal.fats));
    setFiber(String(meal.fiber));
    setMealType(meal.meal_type as MealType);
  };

  const resetCalorieForm = () => {
    setFood("");
    setProtein("");
    setCarbs("");
    setFats("");
    setFiber("");
    setMealType("breakfast");
    setEditingEntryId(null);
    setCalorieError(null);
  };

  const handleEditEntry = (entry: CalorieEntry) => {
    setFood(entry.food_name);
    setProtein(String(entry.protein));
    setCarbs(String(entry.carbs));
    setFats(String(entry.fats));
    setFiber(String(entry.fiber ?? 0));
    setMealType(entry.meal_type as MealType);
    setEditingEntryId(entry.id);
    setCalorieError(null);
  };

  const handleSubmit = () => {
    void (async () => {
      const entryErr = validateCalorieEntry(food, protein, carbs, fats, fiber);
      if (entryErr) {
        setCalorieError(entryErr);
        return;
      }
      const kcalErr = validateCalorieComputedKcal(computedKcal);
      if (kcalErr) {
        setCalorieError(kcalErr);
        return;
      }
      setCalorieError(null);
      try {
        const proteinN = Number(protein) || 0;
        const carbsN = Number(carbs) || 0;
        const fatsN = Number(fats) || 0;
        const fiberN = Number(fiber) || 0;

        if (editingEntryId) {
          await updateCalorieEntry(editingEntryId, {
            foodName: food.trim(),
            protein: proteinN,
            carbs: carbsN,
            fats: fatsN,
            fiber: fiberN,
            mealType,
          });
        } else {
          await addCalorieEntry({
            foodName: food.trim(),
            calories: computedKcal,
            protein: proteinN,
            carbs: carbsN,
            fats: fatsN,
            fiber: fiberN,
            mealType,
          });
        }
        resetCalorieForm();
        await refresh();
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : "Could not save entry.";
        setCalorieError(msg);
      }
    })();
  };

  return (
    <Screen scroll>
      <SectionTitle title="Calories" subtitle="Manual nutrition entry for MVP." />

      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Card accentColor={SECTION_COLORS.calories} className="mb-0">
            <View className="items-center py-1">
              <Text style={{ fontSize: 22 }}>🍽️</Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: SECTION_COLORS.calories,
                  marginTop: 2,
                }}
              >
                {calorieActivityDays.filter((d) => d.active).length}
              </Text>
              <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>days logged</Text>
            </View>
          </Card>
        </View>
        <View className="flex-1">
          <Card accentColor={SECTION_COLORS.calories} className="mb-0">
            <View className="items-center py-1">
              <Text style={{ fontSize: 22 }}>🎯</Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: SECTION_COLORS.calories,
                  marginTop: 2,
                }}
              >
                {goalProgress.percent}%
              </Text>
              <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>of goal today</Text>
            </View>
          </Card>
        </View>
      </View>

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
        <TextField
          label="Food"
          value={food}
          onChangeText={(t) => {
            setCalorieError(null);
            setFood(t);
          }}
          placeholder="Greek yogurt"
        />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <TextField
              label="Protein (g)"
              value={protein}
              onChangeText={(t) => {
                setCalorieError(null);
                setProtein(t);
              }}
              unsignedInteger
            />
          </View>
          <View className="flex-1">
            <TextField
              label="Carbs (g)"
              value={carbs}
              onChangeText={(t) => {
                setCalorieError(null);
                setCarbs(t);
              }}
              unsignedInteger
            />
          </View>
          <View className="flex-1">
            <TextField
              label="Fats (g)"
              value={fats}
              onChangeText={(t) => {
                setCalorieError(null);
                setFats(t);
              }}
              unsignedInteger
            />
          </View>
          <View className="flex-1">
            <TextField
              label="Fiber (g)"
              value={fiber}
              onChangeText={(t) => {
                setCalorieError(null);
                setFiber(t);
              }}
              unsignedInteger
              placeholder="0"
            />
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
              onPress={() => {
                setCalorieError(null);
                setMealType(value);
              }}
            />
          ))}
        </View>
        <ValidationError message={calorieError} />
        <Button
          label={editingEntryId ? "Save changes" : "Add entry"}
          onPress={handleSubmit}
          color={COLOR}
        />
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

        <MacroDonutChart
          totalKcal={caloriesTotal(entries)}
          goalKcal={goal.calories}
          protein={todayTotals.protein}
          carbs={todayTotals.carbs}
          fats={todayTotals.fats}
          fiber={todayTotals.fiber}
          sectionColor={SECTION_COLORS.calories}
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
        <CalorieEntrySwipeRow
          key={entry.id}
          entry={entry}
          accentColor={COLOR}
          onEdit={() => handleEditEntry(entry)}
          onDelete={async () => {
            await deleteCalorieEntry(entry.id);
            if (editingEntryId === entry.id) {
              resetCalorieForm();
            }
            await refresh();
          }}
        />
      ))}

      <Card accentColor={SECTION_COLORS.calories} className="mx-1 mt-4">
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 8 }}>
          Weekly trend
        </Text>
        <WeeklyCalorieChart data={weeklyTotals} goalKcal={goal.calories} />
      </Card>

      <View className="mt-4">
        <Card accentColor={SECTION_COLORS.calories} className="mx-1 mb-0">
          <View className="w-full min-w-0 items-center">
            <Text
              style={{
                fontSize: 12,
                color: "#94a3b8",
                marginBottom: 8,
                alignSelf: "flex-start",
              }}
            >
              Calories — last 52 weeks
            </Text>
            <GitHubHeatmap
              days={calorieHeatmapDays}
              color={SECTION_COLORS.calories}
              weeks={52}
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}
