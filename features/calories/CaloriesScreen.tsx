import { memo, useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { FeaturePanel } from "@/core/ui/FeaturePanel";
import { FeatureStatCard } from "@/core/ui/FeatureStatCard";
import { TextField } from "@/core/ui/TextField";
import { Button } from "@/core/ui/Button";
import { PillChip } from "@/core/ui/PillChip";
import { SECTION_COLORS, SECTION_TEXT_COLORS } from "@/constants/sectionColors";
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
} from "@/features/calories/calories.data";
import type { CalorieGoal, DailySummary } from "@/features/calories/types";
import {
  buildCalorieActivityDays,
  buildCalorieHeatmapDays,
  buildDailyTrend,
  calculateGoalProgress,
  caloriesTotal,
  kcalFromMacros,
} from "@/features/calories/calories.domain";
import type { ActivityDay } from "@/features/shared/ActivityPreviewStrip";
import { GitHubHeatmap, type HeatmapDay } from "@/features/shared/GitHubHeatmap";
import { toDateKey } from "@/lib/time";
import { useFocusForegroundRefresh } from "@/lib/useForegroundRefresh";
import type { CalorieEntry, MealType, SavedMeal } from "./types";
import { MacroDonutChart } from "./MacroDonutChart";
import { DailyCalorieChart } from "./DailyCalorieChart";
import { CalorieGoalModal } from "./CalorieGoalModal";
import { SavedMealChips } from "./SavedMealChips";
import { SavedMealSearchModal } from "./SavedMealSearchModal";
import { Modal } from "@/core/ui/Modal";
import { SwipeableCard } from "@/core/ui/SwipeableCard";
import { ValidationError } from "@/core/ui/ValidationError";
import { validateCalorieComputedKcal, validateCalorieEntry } from "@/lib/validation";

const COLOR = SECTION_COLORS.calories;

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

const CalorieEntrySwipeRow = memo(
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
  return (
    <SwipeableCard
      accentColor={accentColor}
      style={{ marginBottom: 12 }}
      onEdit={onEdit}
      onDelete={onDelete}
    >
      <Text className="text-base font-semibold text-slate-900">
        {entry.food_name} - {entry.calories} kcal
      </Text>
      <Text className="mt-1 text-sm capitalize text-slate-600">
        {entry.meal_type} · P {entry.protein}g / C {entry.carbs}g / F {entry.fats}g / Fiber{" "}
        {entry.fiber}g
      </Text>
    </SwipeableCard>
  );
},
(prev, next) =>
  prev.entry.id === next.entry.id &&
  prev.entry.food_name === next.entry.food_name &&
  prev.entry.calories === next.entry.calories &&
  prev.entry.protein === next.entry.protein &&
  prev.entry.carbs === next.entry.carbs &&
  prev.entry.fats === next.entry.fats &&
  prev.entry.fiber === next.entry.fiber &&
  prev.entry.meal_type === next.entry.meal_type,
);

type CalorieEntryFormFieldsProps = {
  food: string;
  protein: string;
  carbs: string;
  fats: string;
  fiber: string;
  mealType: MealType;
  computedKcal: number;
  recentMeals: SavedMeal[];
  allSavedMeals: SavedMeal[];
  onSelectSavedMeal: (meal: SavedMeal) => void;
  onOpenSearch: () => void;
  onFoodChange: (value: string) => void;
  onProteinChange: (value: string) => void;
  onCarbsChange: (value: string) => void;
  onFatsChange: (value: string) => void;
  onFiberChange: (value: string) => void;
  onMealTypeChange: (value: MealType) => void;
  showSavedMeals?: boolean;
  fieldPrefix: "cal-entry" | "cal-edit";
};

function CalorieEntryFormFields({
  food,
  protein,
  carbs,
  fats,
  fiber,
  mealType,
  computedKcal,
  recentMeals,
  allSavedMeals,
  onSelectSavedMeal,
  onOpenSearch,
  onFoodChange,
  onProteinChange,
  onCarbsChange,
  onFatsChange,
  onFiberChange,
  onMealTypeChange,
  showSavedMeals = false,
  fieldPrefix,
}: CalorieEntryFormFieldsProps) {
  return (
    <>
      {showSavedMeals ? <SavedMealChips meals={recentMeals} onSelect={onSelectSavedMeal} /> : null}
      {showSavedMeals && allSavedMeals.length > 0 ? (
        <Pressable
          onPress={onOpenSearch}
          className="mb-3 flex-row items-center gap-1"
        >
          <Text className="text-xs text-calories">
            Search saved meals ({allSavedMeals.length})
          </Text>
        </Pressable>
      ) : null}
      <TextField
        label="Food"
        nativeID={`${fieldPrefix}-food`}
        accessibilityLabel={`${fieldPrefix === "cal-entry" ? "Calories entry" : "Calories edit"} food`}
        value={food}
        onChangeText={onFoodChange}
        placeholder="Greek yogurt"
      />
      <View className="flex-row flex-wrap gap-2">
        <View className="min-w-[140px] grow basis-[22%]">
          <TextField
            label="Protein (g)"
            nativeID={`${fieldPrefix}-protein`}
            accessibilityLabel={`${fieldPrefix === "cal-entry" ? "Calories entry" : "Calories edit"} protein`}
            value={protein}
            onChangeText={onProteinChange}
            unsignedInteger
          />
        </View>
        <View className="min-w-[140px] grow basis-[22%]">
          <TextField
            label="Carbs (g)"
            nativeID={`${fieldPrefix}-carbs`}
            accessibilityLabel={`${fieldPrefix === "cal-entry" ? "Calories entry" : "Calories edit"} carbs`}
            value={carbs}
            onChangeText={onCarbsChange}
            unsignedInteger
          />
        </View>
        <View className="min-w-[140px] grow basis-[22%]">
          <TextField
            label="Fats (g)"
            nativeID={`${fieldPrefix}-fat`}
            accessibilityLabel={`${fieldPrefix === "cal-entry" ? "Calories entry" : "Calories edit"} fat`}
            value={fats}
            onChangeText={onFatsChange}
            unsignedInteger
          />
        </View>
        <View className="min-w-[140px] grow basis-[22%]">
          <TextField
            label="Fiber (g)"
            nativeID={`${fieldPrefix}-fiber`}
            accessibilityLabel={`${fieldPrefix === "cal-entry" ? "Calories entry" : "Calories edit"} fiber`}
            value={fiber}
            onChangeText={onFiberChange}
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
            onPress={() => onMealTypeChange(value)}
          />
        ))}
      </View>
    </>
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
  const [entryEditModalVisible, setEntryEditModalVisible] = useState(false);

  const refresh = useCallback(async () => {
    // Phase 1: update the entry list immediately so the new row appears in the DOM
    // before saved-meal chips render. This keeps the E2E selector unambiguous and
    // allows React.memo to skip re-rendering unchanged rows.
    const next = await listCalorieEntries();
    setEntries(next);
    // Phase 2: fetch the remaining data concurrently and commit in one batch.
    // Using Promise.all reduces from 4 sequential awaits to 1, cutting React renders
    // from ~4 to 1 for the analytics section.
    const startYear = new Date();
    startYear.setDate(startYear.getDate() - 364);
    const [recent, all, rangeYear, savedGoal] = await Promise.all([
      listRecentSavedMeals(5),
      searchSavedMeals(""),
      getCalorieSummaryByRange(toDateKey(startYear), toDateKey(new Date())),
      getCalorieGoal(),
    ]);
    const activityDaysYear = buildCalorieActivityDays(rangeYear, savedGoal.calories, 365);
    setRecentMeals(recent);
    setAllSavedMeals(all);
    setSummary364(rangeYear);
    setCalorieActivityDays(activityDaysYear);
    setCalorieHeatmapDays(buildCalorieHeatmapDays(rangeYear, savedGoal.calories, 365));
    setGoal(savedGoal);
  }, []);

  useFocusForegroundRefresh(refresh);

  const todayTotals = useMemo(
    () => ({
      protein: entries.reduce((s, e) => s + e.protein, 0),
      carbs: entries.reduce((s, e) => s + e.carbs, 0),
      fats: entries.reduce((s, e) => s + e.fats, 0),
      fiber: entries.reduce((s, e) => s + e.fiber, 0),
    }),
    [entries],
  );
  const dailyTrend = useMemo(() => buildDailyTrend(summary364), [summary364]);
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

  const openEntryEditModal = (entry: CalorieEntry) => {
    handleEditEntry(entry);
    setEntryEditModalVisible(true);
  };

  const handleSubmit = () => {
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
    void (async () => {
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
        setEntryEditModalVisible(false);
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
          <FeatureStatCard
            icon="restaurant-menu"
            value={calorieActivityDays.filter((d) => d.active).length}
            label="Days Logged"
            accentColor={SECTION_COLORS.calories}
            textColor={SECTION_TEXT_COLORS.calories}
          />
        </View>
        <View className="flex-1">
          <FeatureStatCard
            icon="track-changes"
            value={`${goalProgress.percent}%`}
            label="Of Goal Today"
            accentColor={SECTION_COLORS.calories}
            textColor={SECTION_TEXT_COLORS.calories}
          />
        </View>
      </View>

      <FeaturePanel
        title="Add entry"
        subtitle="Track meals and reuse saved combinations."
        icon="restaurant-menu"
        accentColor={SECTION_COLORS.calories}
        textColor={SECTION_TEXT_COLORS.calories}
      >
        <CalorieEntryFormFields
          food={food}
          protein={protein}
          carbs={carbs}
          fats={fats}
          fiber={fiber}
          mealType={mealType}
          computedKcal={computedKcal}
          recentMeals={recentMeals}
          allSavedMeals={allSavedMeals}
          onSelectSavedMeal={handleSelectSavedMeal}
          onOpenSearch={() => setSearchSheetVisible(true)}
          onFoodChange={(t) => {
            setCalorieError(null);
            setFood(t);
          }}
          onProteinChange={(t) => {
            setCalorieError(null);
            setProtein(t);
          }}
          onCarbsChange={(t) => {
            setCalorieError(null);
            setCarbs(t);
          }}
          onFatsChange={(t) => {
            setCalorieError(null);
            setFats(t);
          }}
          onFiberChange={(t) => {
            setCalorieError(null);
            setFiber(t);
          }}
          onMealTypeChange={(value) => {
            setCalorieError(null);
            setMealType(value);
          }}
          showSavedMeals
          fieldPrefix="cal-entry"
        />
        <ValidationError message={calorieError} />
        <Button
          label={editingEntryId ? "Save changes" : "Add entry"}
          onPress={handleSubmit}
          color={COLOR}
        />
      </FeaturePanel>

      <FeaturePanel
        title="Today's overview"
        subtitle="Calories and macros versus your goal."
        icon="donut-large"
        accentColor={SECTION_COLORS.calories}
        textColor={SECTION_TEXT_COLORS.calories}
        className="mt-4"
      >
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

        {useMemo(
          () => (
            <MacroDonutChart
              totalKcal={caloriesTotal(entries)}
              goalKcal={goal.calories}
              protein={todayTotals.protein}
              carbs={todayTotals.carbs}
              fats={todayTotals.fats}
              fiber={todayTotals.fiber}
              sectionColor={SECTION_COLORS.calories}
            />
          ),
          // eslint-disable-next-line react-hooks/exhaustive-deps
          [entries, goal.calories, todayTotals],
        )}
      </FeaturePanel>

      <CalorieGoalModal
        visible={goalSheetVisible}
        currentGoal={goal}
        onSave={async (newGoal) => {
          await setCalorieGoal(newGoal);
          setGoal(newGoal);
        }}
        onClose={() => setGoalSheetVisible(false)}
      />

      <SavedMealSearchModal
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

      <Modal
        title="Edit entry"
        visible={entryEditModalVisible}
        onClose={() => {
          setEntryEditModalVisible(false);
          resetCalorieForm();
        }}
        scroll
      >
        <CalorieEntryFormFields
          food={food}
          protein={protein}
          carbs={carbs}
          fats={fats}
          fiber={fiber}
          mealType={mealType}
          computedKcal={computedKcal}
          recentMeals={recentMeals}
          allSavedMeals={allSavedMeals}
          onSelectSavedMeal={handleSelectSavedMeal}
          onOpenSearch={() => setSearchSheetVisible(true)}
          onFoodChange={(t) => {
            setCalorieError(null);
            setFood(t);
          }}
          onProteinChange={(t) => {
            setCalorieError(null);
            setProtein(t);
          }}
          onCarbsChange={(t) => {
            setCalorieError(null);
            setCarbs(t);
          }}
          onFatsChange={(t) => {
            setCalorieError(null);
            setFats(t);
          }}
          onFiberChange={(t) => {
            setCalorieError(null);
            setFiber(t);
          }}
          onMealTypeChange={(value) => {
            setCalorieError(null);
            setMealType(value);
          }}
          fieldPrefix="cal-edit"
        />
        <ValidationError message={calorieError} />
        <Button label="Save changes" onPress={handleSubmit} color={COLOR} />
      </Modal>

      <FeaturePanel
        title="Today's entries"
        subtitle={
          entries.length === 0
            ? "No meals logged today."
            : `${entries.length} ${entries.length === 1 ? "entry" : "entries"} logged`
        }
        icon="format-list-bulleted"
        accentColor={SECTION_COLORS.calories}
        textColor={SECTION_TEXT_COLORS.calories}
        className="mt-4"
      >
        {entries.length === 0 ? (
          <View className="items-center py-6">
            <Text className="text-center text-sm font-medium text-slate-700">
              No entries yet
            </Text>
            <Text className="mt-1 text-center text-xs text-slate-500">
              Add a meal above to start building today’s totals.
            </Text>
          </View>
        ) : (
          entries.map((entry) => (
            <CalorieEntrySwipeRow
              key={entry.id}
              entry={entry}
              accentColor={COLOR}
              onEdit={() => openEntryEditModal(entry)}
              onDelete={async () => {
                await deleteCalorieEntry(entry.id);
                if (editingEntryId === entry.id) {
                  resetCalorieForm();
                }
                await refresh();
              }}
            />
          ))
        )}
      </FeaturePanel>

      {useMemo(
        () => (
          <FeaturePanel
            title="Daily calories"
            subtitle="Year trend (daily)"
            icon="show-chart"
            accentColor={SECTION_COLORS.calories}
            textColor={SECTION_TEXT_COLORS.calories}
            className="mt-4"
          >
            <DailyCalorieChart data={dailyTrend} goalKcal={goal.calories} />
          </FeaturePanel>
        ),
        [dailyTrend, goal.calories],
      )}

      {useMemo(
        () => (
          <FeaturePanel
            title="Calories history"
            subtitle="Rolling 53-week activity"
            icon="calendar-view-week"
            accentColor={SECTION_COLORS.calories}
            textColor={SECTION_TEXT_COLORS.calories}
            className="mt-4"
          >
            <View className="w-full min-w-0 items-center justify-center">
              <GitHubHeatmap
                days={calorieHeatmapDays}
                color={SECTION_COLORS.calories}
                weeks={53}
              />
            </View>
          </FeaturePanel>
        ),
        [calorieHeatmapDays],
      )}
    </Screen>
  );
}
