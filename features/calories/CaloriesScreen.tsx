import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { useDayRolloverGeneration } from '@/core/providers/DayRolloverProvider';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { Modal } from '@/core/ui/Modal';
import { PageHeader } from '@/core/ui/PageHeader';
import { Screen } from '@/core/ui/Screen';
import { ScreenSection } from '@/core/ui/ScreenSection';
import {
  DEFAULT_GOAL,
  addCalorieEntry,
  deleteCalorieEntry,
  getCalorieGoal,
  getCalorieSummaryByRange,
  listCalorieEntries,
  listRecentSavedMeals,
  searchSavedMeals,
  setCalorieGoal,
  updateCalorieEntry,
} from '@/features/calories/calories.data';
import {
  buildCalorieActivityDays,
  buildCalorieHeatmapDays,
  buildDailyTrend,
  calculateGoalProgress,
  caloriesTotal,
  kcalFromMacros,
} from '@/features/calories/calories.domain';
import type {
  CalorieGoal,
  DailySummary,
  CalorieEntry,
  MealType,
  SavedMeal,
} from '@/features/calories/types';
import { GitHubHeatmap } from '@/features/shared/GitHubHeatmap';
import type { ActivityDay, HeatmapDay } from '@/features/shared/activityTypes';
import { toDateKey } from '@/lib/time';
import { useActiveForegroundRefresh } from '@/lib/useForegroundRefresh';
import { validateCalorieComputedKcal, validateCalorieEntry } from '@/lib/validation';
import { CalorieGoalModal } from './CalorieGoalModal';
import { CaloriesDiaryView } from './CaloriesDiaryView';
import type { MealSection } from './CaloriesDiaryView';
import { CaloriesEntryFields } from './CaloriesEntryFields';
import { CaloriesFormView } from './CaloriesFormView';
import { DailyCalorieChart } from './DailyCalorieChart';
import { MacroDonutChart } from './MacroDonutChart';
import { SavedMealSearchModal } from './SavedMealSearchModal';

const COLOR = SECTION_COLORS.calories;
const CALORIES_VIEW_MODE_STORAGE_KEY = 'superhabits.calories.viewMode';

type CaloriesViewMode = 'form' | 'diary';

const MEAL_OPTIONS: readonly { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

const VIEW_MODE_OPTIONS: readonly { value: CaloriesViewMode; label: string }[] = [
  { value: 'form', label: 'Form' },
  { value: 'diary', label: 'Diary' },
];

function formatDayContext(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function ViewModeSwitch({
  value,
  onChange,
}: {
  value: CaloriesViewMode;
  onChange: (nextValue: CaloriesViewMode) => void;
}) {
  const { tokens } = useAppTheme();

  return (
    <View
      className="mt-4 self-start flex-row rounded-2xl border p-1"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
    >
      {VIEW_MODE_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityLabel={`${option.label} view`}
            accessibilityState={{ selected: active }}
            className="rounded-2xl px-4 py-2.5"
            style={active ? { backgroundColor: COLOR } : undefined}
          >
            <Text
              className={active ? 'text-sm font-semibold' : 'text-sm font-medium'}
              style={active ? { color: tokens.textOnAccent } : { color: tokens.textMuted }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function CaloriesScreen({ isActive }: { isActive: boolean }) {
  const { tokens, sectionAccents } = useAppTheme();
  const dayGeneration = useDayRolloverGeneration();
  const colorText = sectionAccents.calories.text;
  const [food, setFood] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [fiber, setFiber] = useState('');
  const [mealType, setMealType] = useState<MealType>('breakfast');
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
  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<CaloriesViewMode>('form');
  const [collapsedMeals, setCollapsedMeals] = useState<Partial<Record<MealType, boolean>>>({});

  const refresh = useCallback(async () => {
    const startYear = new Date();
    startYear.setDate(startYear.getDate() - 364);

    // The diary's saved-meal search is interactive as soon as the Calories
    // section appears. Start its small catalog independently of the heavier
    // entry/summary reads and publish it as soon as it is ready so an early
    // search never waits for unrelated aggregate work.
    const entriesPromise = listCalorieEntries();
    const savedMealsPromise = Promise.all([listRecentSavedMeals(5), searchSavedMeals('')]);
    const summaryPromise = getCalorieSummaryByRange(toDateKey(startYear), toDateKey(new Date()));
    const goalPromise = getCalorieGoal();

    const [recent, all] = await savedMealsPromise;
    setRecentMeals(recent);
    setAllSavedMeals(all);

    const [nextEntries, rangeYear, savedGoal] = await Promise.all([
      entriesPromise,
      summaryPromise,
      goalPromise,
    ]);
    const activityDaysYear = buildCalorieActivityDays(rangeYear, savedGoal.calories, 365);

    setEntries(nextEntries);
    setSummary364(rangeYear);
    setCalorieActivityDays(activityDaysYear);
    setCalorieHeatmapDays(buildCalorieHeatmapDays(rangeYear, savedGoal.calories, 365));
    setGoal(savedGoal);
  }, []);

  useActiveForegroundRefresh(isActive, refresh, dayGeneration);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(CALORIES_VIEW_MODE_STORAGE_KEY)
      .then((storedValue) => {
        if (!active) return;
        if (storedValue === 'form' || storedValue === 'diary') {
          setViewMode(storedValue);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const todayTotals = useMemo(
    () => ({
      protein: entries.reduce((sum, entry) => sum + entry.protein, 0),
      carbs: entries.reduce((sum, entry) => sum + entry.carbs, 0),
      fats: entries.reduce((sum, entry) => sum + entry.fats, 0),
      fiber: entries.reduce((sum, entry) => sum + entry.fiber, 0),
    }),
    [entries],
  );
  const activeDateKey = entries[0]?.consumed_on ?? toDateKey();
  const activeDateLabel = useMemo(() => formatDayContext(activeDateKey), [activeDateKey]);
  const dailyTrend = useMemo(() => buildDailyTrend(summary364), [summary364]);
  const goalProgress = useMemo(
    () => calculateGoalProgress(caloriesTotal(entries), goal.calories),
    [entries, goal.calories],
  );
  const groupedEntries = useMemo<MealSection[]>(
    () =>
      MEAL_OPTIONS.map((option) => {
        const mealEntries = entries.filter((entry) => entry.meal_type === option.value);
        return {
          mealType: option.value,
          label: option.label,
          entries: mealEntries,
          totalCalories: caloriesTotal(mealEntries),
        };
      }).filter((section) => section.entries.length > 0),
    [entries],
  );
  const hasCalorieStripActivity = calorieActivityDays.some((day) => day.active);
  const consistencyText = hasCalorieStripActivity
    ? `${goalProgress.percent}% of daily goal today`
    : 'Log food to start tracking';
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
  const macroDonut = useMemo(
    () => (
      <MacroDonutChart
        totalKcal={caloriesTotal(entries)}
        goalKcal={goal.calories}
        protein={todayTotals.protein}
        carbs={todayTotals.carbs}
        fats={todayTotals.fats}
        fiber={todayTotals.fiber}
        sectionColor={COLOR}
      />
    ),
    [entries, goal.calories, todayTotals],
  );
  const dailyCaloriesSection = useMemo(
    () => (
      <Card
        variant="header"
        accentColor={COLOR}
        headerTitle="Daily calories"
        headerSubtitle="Year trend with your current goal overlaid."
        headerRight={<MaterialIcons name="bar-chart" size={22} color={tokens.textOnAccent} />}
        className="mb-0"
      >
        <DailyCalorieChart data={dailyTrend} goalKcal={goal.calories} />
      </Card>
    ),
    [dailyTrend, goal.calories, tokens.textOnAccent],
  );
  const calorieHistorySection = useMemo(
    () => (
      <Card
        variant="header"
        accentColor={COLOR}
        headerTitle="Calories history"
        headerSubtitle="Rolling 53-week activity."
        headerRight={<MaterialIcons name="insights" size={22} color={tokens.textOnAccent} />}
        className="mb-0"
      >
        <View className="w-full min-w-0 items-center justify-center">
          <GitHubHeatmap days={calorieHeatmapDays} color={COLOR} weeks={53} />
        </View>
      </Card>
    ),
    [calorieHeatmapDays, tokens.textOnAccent],
  );

  const resetCalorieForm = () => {
    setFood('');
    setProtein('');
    setCarbs('');
    setFats('');
    setFiber('');
    setMealType('breakfast');
    setEditingEntryId(null);
    setCalorieError(null);
  };

  const setAndPersistViewMode = useCallback((nextMode: CaloriesViewMode) => {
    setViewMode(nextMode);
    void AsyncStorage.setItem(CALORIES_VIEW_MODE_STORAGE_KEY, nextMode).catch(() => undefined);
  }, []);

  const applySavedMealToDraft = (meal: SavedMeal) => {
    setCalorieError(null);
    setEditingEntryId(null);
    setFood(meal.food_name);
    setProtein(String(meal.protein));
    setCarbs(String(meal.carbs));
    setFats(String(meal.fats));
    setFiber(String(meal.fiber));
    setMealType(meal.meal_type as MealType);
  };

  const handleSelectSavedMeal = (meal: SavedMeal) => {
    applySavedMealToDraft(meal);
    if (viewMode === 'diary') {
      setEntryModalVisible(true);
    }
  };

  const openEntryEditModal = (entry: CalorieEntry) => {
    setFood(entry.food_name);
    setProtein(String(entry.protein));
    setCarbs(String(entry.carbs));
    setFats(String(entry.fats));
    setFiber(String(entry.fiber ?? 0));
    setMealType(entry.meal_type);
    setEditingEntryId(entry.id);
    setCalorieError(null);
    setEntryModalVisible(true);
  };

  const openManualAddModal = (query = '') => {
    const prefilledFood = query.trim();
    resetCalorieForm();
    if (prefilledFood) {
      setFood(prefilledFood);
    }
    setEntryModalVisible(true);
  };

  const handleDeleteEntry = useCallback(
    (entry: CalorieEntry) => {
      void (async () => {
        await deleteCalorieEntry(entry.id);
        if (editingEntryId === entry.id) {
          setEntryModalVisible(false);
          resetCalorieForm();
        }
        await refresh();
      })();
    },
    [editingEntryId, refresh],
  );

  const toggleMealGroup = useCallback((meal: MealType) => {
    setCollapsedMeals((current) => ({
      ...current,
      [meal]: !(current[meal] ?? false),
    }));
  }, []);

  const handleSubmit = () => {
    const entryError = validateCalorieEntry(food, protein, carbs, fats, fiber);
    if (entryError) {
      setCalorieError(entryError);
      return;
    }

    const kcalError = validateCalorieComputedKcal(computedKcal);
    if (kcalError) {
      setCalorieError(kcalError);
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
        setEntryModalVisible(false);
        await refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Could not save entry.';
        setCalorieError(message);
      }
    })();
  };

  const editEntryFooter = (
    <View className="flex-row gap-2">
      <View className="flex-1">
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => {
            setEntryModalVisible(false);
            resetCalorieForm();
          }}
        />
      </View>
      <View className="flex-1">
        <Button
          label={editingEntryId ? 'Save changes' : 'Add entry'}
          onPress={handleSubmit}
          color={COLOR}
        />
      </View>
    </View>
  );

  const dailySummaryCard = (
    <Card
      variant="header"
      accentColor={COLOR}
      headerTitle="Today"
      headerSubtitle={
        viewMode === 'diary' ? activeDateLabel : 'Live totals, goal progress, and macro split.'
      }
      headerRight={<MaterialIcons name="pie-chart" size={22} color={tokens.textOnAccent} />}
      className="mb-0"
    >
      <View
        className="mb-3 items-center rounded-xl border p-3"
        style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
      >
        <Text className="text-center text-sm font-medium" style={{ color: tokens.textMuted }}>
          {consistencyText}
        </Text>
      </View>

      <View className="mb-4">
        <View className="mb-1 flex-row items-center justify-center gap-8">
          <Text className="text-sm" style={{ color: tokens.textMuted }}>
            Today: {caloriesTotal(entries)} kcal
          </Text>
          <Pressable onPress={() => setGoalSheetVisible(true)}>
            <Text className="text-sm font-medium" style={{ color: colorText }}>
              Goal: {goal.calories} kcal ✎
            </Text>
          </Pressable>
        </View>
        <View
          className="h-2 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: tokens.border }}
        >
          <View
            className="h-full rounded-full"
            style={{
              width: `${goalProgress.percent}%`,
              backgroundColor: goalProgress.over ? tokens.dangerSolid : COLOR,
            }}
          />
        </View>
        {goalProgress.over ? (
          <Text className="mt-1 text-center text-xs" style={{ color: tokens.dangerText }}>
            {caloriesTotal(entries) - goal.calories} kcal over goal
          </Text>
        ) : null}
      </View>

      {macroDonut}
    </Card>
  );

  return (
    <Screen scroll>
      <ScreenSection>
        <PageHeader
          title="Calories"
          subtitle="Switch between manual entry and a diary grouped by meal."
        />
        <ViewModeSwitch value={viewMode} onChange={setAndPersistViewMode} />
      </ScreenSection>

      {viewMode === 'form' ? (
        <CaloriesFormView
          accentColor={COLOR}
          colorText={colorText}
          calorieActivityDays={calorieActivityDays}
          goalProgress={goalProgress}
          hasCalorieStripActivity={hasCalorieStripActivity}
          recentMeals={recentMeals}
          allSavedMeals={allSavedMeals}
          entries={entries}
          todayCard={dailySummaryCard}
          food={food}
          protein={protein}
          carbs={carbs}
          fats={fats}
          fiber={fiber}
          mealType={mealType}
          mealOptions={MEAL_OPTIONS}
          computedKcal={computedKcal}
          calorieError={calorieError}
          onSelectSavedMeal={handleSelectSavedMeal}
          onBrowseSavedMeals={() => setSearchSheetVisible(true)}
          onFoodChange={(value) => {
            setCalorieError(null);
            setFood(value);
          }}
          onProteinChange={(value) => {
            setCalorieError(null);
            setProtein(value);
          }}
          onCarbsChange={(value) => {
            setCalorieError(null);
            setCarbs(value);
          }}
          onFatsChange={(value) => {
            setCalorieError(null);
            setFats(value);
          }}
          onFiberChange={(value) => {
            setCalorieError(null);
            setFiber(value);
          }}
          onMealTypeChange={(value) => {
            setCalorieError(null);
            setMealType(value);
          }}
          onAddEntry={handleSubmit}
          onEditEntry={openEntryEditModal}
          onDeleteEntry={handleDeleteEntry}
        />
      ) : (
        <CaloriesDiaryView
          accentColor={COLOR}
          colorText={colorText}
          todayCard={dailySummaryCard}
          recentMeals={recentMeals}
          allSavedMeals={allSavedMeals}
          groupedEntries={groupedEntries}
          collapsedMeals={collapsedMeals}
          onSelectSavedMeal={handleSelectSavedMeal}
          onBrowseSavedMeals={() => setSearchSheetVisible(true)}
          onManualAdd={openManualAddModal}
          onToggleMealGroup={toggleMealGroup}
          onEditEntry={openEntryEditModal}
          onDeleteEntry={handleDeleteEntry}
        />
      )}

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
        title={editingEntryId ? 'Edit entry' : 'Manual add'}
        visible={entryModalVisible}
        onClose={() => {
          setEntryModalVisible(false);
          resetCalorieForm();
        }}
        scroll
      >
        <CaloriesEntryFields
          fieldIdPrefix="cal-edit"
          food={food}
          protein={protein}
          carbs={carbs}
          fats={fats}
          fiber={fiber}
          mealType={mealType}
          mealOptions={MEAL_OPTIONS}
          computedKcal={computedKcal}
          calorieError={calorieError}
          accentColor={COLOR}
          onFoodChange={(value) => {
            setCalorieError(null);
            setFood(value);
          }}
          onProteinChange={(value) => {
            setCalorieError(null);
            setProtein(value);
          }}
          onCarbsChange={(value) => {
            setCalorieError(null);
            setCarbs(value);
          }}
          onFatsChange={(value) => {
            setCalorieError(null);
            setFats(value);
          }}
          onFiberChange={(value) => {
            setCalorieError(null);
            setFiber(value);
          }}
          onMealTypeChange={(value) => {
            setCalorieError(null);
            setMealType(value);
          }}
          footer={editEntryFooter}
        />
      </Modal>

      <ScreenSection>{dailyCaloriesSection}</ScreenSection>
      <ScreenSection className="mb-0">{calorieHistorySection}</ScreenSection>
    </Screen>
  );
}
