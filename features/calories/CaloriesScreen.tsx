import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { Modal } from '@/core/ui/Modal';
import { PageHeader } from '@/core/ui/PageHeader';
import { Screen } from '@/core/ui/Screen';
import { ScreenSection } from '@/core/ui/ScreenSection';
import {
  DEFAULT_GOAL,
  addCalorieEntry,
  copyCalorieEntriesFromDay,
  deleteCalorieEntry,
  getCalorieGoal,
  getCalorieSummaryByRange,
  listCalorieEntries,
  listCalorieEntriesInRange,
  listRecentSavedMeals,
  searchSavedMeals,
  setCalorieGoal,
  updateCalorieEntry,
} from '@/features/calories/calories.data';
import {
  buildCalorieActivityDays,
  buildCalorieHeatmapDays,
  buildDailyTrend,
  buildFrequentFoods,
  calculateGoalProgress,
  caloriesTotal,
  kcalFromMacros,
  buildTargetProgress,
} from '@/features/calories/calories.domain';
import type {
  CalorieGoal,
  DailySummary,
  CalorieEntry,
  MealType,
  SavedMeal,
} from '@/features/calories/types';
import type { FrequentFood, MacroTargets } from '@/features/calories/calories.domain';

import { GitHubHeatmap } from '@/features/shared/GitHubHeatmap';
import { toDateKey } from '@/lib/time';
import { useActiveForegroundRefresh } from '@/lib/useForegroundRefresh';
import { validateCalorieComputedKcal, validateCalorieEntry } from '@/lib/validation';
import { CalorieGoalModal } from './CalorieGoalModal';
import { loadMacroTargets, saveMacroTargets } from './caloriesTargets';
import { CaloriesDiaryView } from './CaloriesDiaryView';
import type { MealSection } from './CaloriesDiaryView';
import { CaloriesEntryFields } from './CaloriesEntryFields';
import { CaloriesFormView } from './CaloriesFormView';
import { DailyCalorieChart } from './DailyCalorieChart';
import { MacroDonutChart } from './MacroDonutChart';
import { MacroTargetsModal } from './MacroTargetsModal';
import { MacroTrendChart } from './MacroTrendChart';
import { SavedMealSearchModal } from './SavedMealSearchModal';

const COLOR = SECTION_COLORS.calories;
const CALORIES_VIEW_MODE_STORAGE_KEY = 'superhabits.calories.viewMode';
/** Food name for kcal-only quick-add entries written through the normal create path. */
const QUICK_ADD_FOOD_NAME = 'Quick add';

type CaloriesViewMode = 'form' | 'diary';

/** Narrow prefill shape shared by saved-meal and frequent-food chip taps. */
type MealPrefillSource = Pick<
  SavedMeal,
  'food_name' | 'protein' | 'carbs' | 'fats' | 'fiber' | 'meal_type'
>;

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
  const [recentMeals, setRecentMeals] = useState<SavedMeal[]>([]);
  const [allSavedMeals, setAllSavedMeals] = useState<SavedMeal[]>([]);
  const [frequentFoods, setFrequentFoods] = useState<FrequentFood[]>([]);
  const [searchSheetVisible, setSearchSheetVisible] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<CaloriesViewMode>('form');
  const [collapsedMeals, setCollapsedMeals] = useState<Partial<Record<MealType, boolean>>>({});
  const [macroTargets, setMacroTargets] = useState<MacroTargets | null>(null);
  const [targetsSheetVisible, setTargetsSheetVisible] = useState(false);
  // Diary day selection (findings 1/6): defaults to today; the diary
  // navigator moves it and every entry read follows it.
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey());
  /** True while the diary selection tracks the current local day. An explicit
   * past-day navigation detaches it so a midnight tick never yanks the user
   * away from the day they deliberately opened (decided contract D9b). */
  const [followsToday, setFollowsToday] = useState(true);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const startYear = new Date();
    startYear.setDate(startYear.getDate() - 364);
    // Rolling 30-day window feeding the Frequent chips (most-logged foods).
    const startWindow = new Date();
    startWindow.setDate(startWindow.getDate() - 29);

    // The diary's saved-meal search is interactive as soon as the Calories
    // section appears. Start its small catalog independently of the heavier
    // entry/summary reads and publish it as soon as it is ready so an early
    // search never waits for unrelated aggregate work.
    const entriesPromise = listCalorieEntries(selectedDateKey);
    const savedMealsPromise = Promise.all([listRecentSavedMeals(5), searchSavedMeals('')]);
    const summaryPromise = getCalorieSummaryByRange(toDateKey(startYear), toDateKey(new Date()));
    const goalPromise = getCalorieGoal();
    const frequentEntriesPromise = listCalorieEntriesInRange(
      toDateKey(startWindow),
      toDateKey(new Date()),
    );

    const [recent, all] = await savedMealsPromise;
    setRecentMeals(recent);
    setAllSavedMeals(all);

    const [nextEntries, rangeYear, savedGoal, windowEntries] = await Promise.all([
      entriesPromise,
      summaryPromise,
      goalPromise,
      frequentEntriesPromise,
    ]);

    setEntries(nextEntries);
    setSummary364(rangeYear);
    setGoal(savedGoal);
    setFrequentFoods(buildFrequentFoods(windowEntries));
  }, [selectedDateKey]);

  useActiveForegroundRefresh(isActive, refresh, dayGeneration);

  useEffect(() => {
    // D9b: when the local day rolls over, a selection that pointed at
    // "today" must follow the new day so the active section never renders
    // yesterday's totals under the Today header. An explicitly selected
    // past day stays put.
    if (followsToday) {
      setSelectedDateKey(toDateKey());
    }
  }, [dayGeneration, followsToday]);

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

    loadMacroTargets()
      .then((stored) => {
        if (active && stored) setMacroTargets(stored);
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
  const todayKey = toDateKey();
  // Goal-driven chart normalization recomputes with the goal (finding 8):
  // deriving from summary364 + goal.calories keeps intensity buckets and
  // heatmap caps correct immediately after a goal change, not just after the
  // next refresh trigger.
  const calorieActivityDays = useMemo(
    () => buildCalorieActivityDays(summary364, goal.calories, 365),
    [summary364, goal.calories],
  );
  const calorieHeatmapDays = useMemo(
    () => buildCalorieHeatmapDays(summary364, goal.calories, 365),
    [summary364, goal.calories],
  );
  const selectedDateLabel = useMemo(() => formatDayContext(selectedDateKey), [selectedDateKey]);
  const dailyTrend = useMemo(() => buildDailyTrend(summary364), [summary364]);
  const goalProgress = useMemo(
    () => calculateGoalProgress(caloriesTotal(entries), goal.calories),
    [entries, goal.calories],
  );
  const effectiveTargets: MacroTargets = macroTargets ?? goal;
  const macroTargetBars = useMemo(
    () =>
      (
        [
          {
            key: 'protein',
            label: 'Protein',
            actual: todayTotals.protein,
            target: effectiveTargets.protein,
          },
          {
            key: 'carbs',
            label: 'Carbs',
            actual: todayTotals.carbs,
            target: effectiveTargets.carbs,
          },
          { key: 'fats', label: 'Fats', actual: todayTotals.fats, target: effectiveTargets.fats },
        ] as const
      ).map(({ key, label, actual, target }) => ({
        key,
        label,
        actual,
        target,
        progress: buildTargetProgress(actual, target),
      })),
    [todayTotals, effectiveTargets],
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
  const macroTrendSection = useMemo(
    () => (
      <Card
        variant="header"
        accentColor={COLOR}
        headerTitle="Macro trends"
        headerSubtitle="Rolling 7/30-day intake averages. Informational only."
        headerRight={
          <MaterialIcons name="stacked-line-chart" size={22} color={tokens.textOnAccent} />
        }
        className="mb-0"
      >
        <MacroTrendChart summaries={summary364} />
      </Card>
    ),
    [summary364, tokens.textOnAccent],
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
    if (nextMode === 'form') {
      // The form always logs to today: drop any diary day selection so the
      // Today-labeled totals can never silently show a past day.
      setFollowsToday(true);
      setSelectedDateKey(toDateKey());
      setCopyStatus(null);
    }
    void AsyncStorage.setItem(CALORIES_VIEW_MODE_STORAGE_KEY, nextMode).catch(() => undefined);
  }, []);

  /** Shared prefill for saved-meal and frequent-food chips; identical tap path. */
  const applyMealToDraft = useCallback((meal: MealPrefillSource) => {
    setCalorieError(null);
    setEditingEntryId(null);
    setFood(meal.food_name);
    setProtein(String(meal.protein));
    setCarbs(String(meal.carbs));
    setFats(String(meal.fats));
    setFiber(String(meal.fiber));
    setMealType(meal.meal_type as MealType);
  }, []);

  const handleSelectSavedMeal = useCallback(
    (meal: SavedMeal) => {
      applyMealToDraft(meal);
      if (viewMode === 'diary') {
        setEntryModalVisible(true);
      }
    },
    [applyMealToDraft, viewMode],
  );

  const handleSelectFrequentFood = useCallback(
    (food: FrequentFood) => {
      applyMealToDraft(food.latestEntry);
      if (viewMode === 'diary') {
        setEntryModalVisible(true);
      }
    },
    [applyMealToDraft, viewMode],
  );

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

  const handleSelectDiaryDate = useCallback((dateKey: string) => {
    setCopyStatus(null);
    setFollowsToday(dateKey === toDateKey());
    setSelectedDateKey(dateKey);
  }, []);

  /**
   * Copy a previous day into the selected diary day. The structured
   * CopyDayResult is surfaced as inline status text; refresh() then reloads
   * the selected day so copied entries appear immediately.
   */
  const handleCopyFromDay = useCallback(
    async (sourceDateKey: string) => {
      try {
        const result = await copyCalorieEntriesFromDay(sourceDateKey, selectedDateKey);
        if (result.status === 'copied') {
          setCopyStatus(
            `Copied ${result.copiedCount} ${
              result.copiedCount === 1 ? 'entry' : 'entries'
            } into ${formatDayContext(selectedDateKey)}.`,
          );
        } else if (result.status === 'source-empty') {
          setCopyStatus('No entries were logged on that day.');
        } else {
          setCopyStatus('That day cannot be copied onto the selected day.');
        }
      } catch {
        // The copy is all-or-nothing: a failure left the selected day intact.
        setCopyStatus('Copy failed. Nothing was changed.');
      }
      await refresh();
    },
    [refresh, selectedDateKey],
  );

  /**
   * Kcal-only quick add. calorie_entries stores an explicit calories column,
   * so a zero-macro entry needs no fabricated macros and no schema change;
   * it rides the same create path (sync/backup intents included) as the full
   * form and logs onto the diary's selected day (today in form mode).
   *
   * A one-off kcal log is not a reusable meal, so saved-meal catalog
   * maintenance is skipped ({@link addCalorieEntry} `maintainSavedMeal:
   * false`): no phantom "Quick add" row, no use_count inflation, no chip
   * pollution.
   */
  const handleQuickAddKcal = useCallback(
    async (kcal: number) => {
      await addCalorieEntry(
        {
          foodName: QUICK_ADD_FOOD_NAME,
          calories: kcal,
          protein: 0,
          carbs: 0,
          fats: 0,
          fiber: 0,
          mealType: 'snack',
          consumedOn: selectedDateKey,
        },
        { maintainSavedMeal: false },
      );
      await refresh();
    },
    [refresh, selectedDateKey],
  );

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
      headerTitle={
        viewMode === 'diary' && selectedDateKey !== todayKey
          ? formatDayContext(selectedDateKey)
          : 'Today'
      }
      headerSubtitle={
        viewMode === 'diary' ? selectedDateLabel : 'Live totals, goal progress, and macro split.'
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
            {selectedDateKey === todayKey ? 'Today' : formatDayContext(selectedDateKey)}:{' '}
            {caloriesTotal(entries)} kcal
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
          {/* Over-target stays informational (blueprint Gate F): accent fill,
              factual caption in the neutral-caution tone — never danger red. */}
          <View
            className="h-full rounded-full"
            style={{ width: `${goalProgress.percent}%`, backgroundColor: COLOR }}
          />
        </View>
        {goalProgress.over ? (
          <Text className="mt-1 text-center text-xs" style={{ color: tokens.warningText }}>
            {caloriesTotal(entries) - goal.calories} kcal over goal
          </Text>
        ) : null}
      </View>

      <View className="mb-4 gap-2">
        {macroTargetBars.map(({ key, label, actual, target, progress }) =>
          target > 0 ? (
            <View key={key}>
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="text-xs font-medium" style={{ color: tokens.textMuted }}>
                  {label} {actual}g / {target}g
                </Text>
                <Text className="text-xs" style={{ color: tokens.textMuted }}>
                  {progress.over ? `${actual - target}g over` : `${progress.remaining}g left`}
                </Text>
              </View>
              <View
                className="h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: tokens.border }}
              >
                {/* Macro over-target keeps the accent fill; the "n g over"
                    caption beside the label already carries the fact. */}
                <View
                  className="h-full rounded-full"
                  style={{ width: `${progress.percent}%`, backgroundColor: COLOR }}
                />
              </View>
            </View>
          ) : null,
        )}
        <Pressable
          onPress={() => setTargetsSheetVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Edit daily macro targets"
          className="self-start"
        >
          <Text className="text-xs font-medium" style={{ color: colorText }}>
            Edit daily targets ✎
          </Text>
        </Pressable>
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
          frequentFoods={frequentFoods}
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
          onSelectFrequentFood={handleSelectFrequentFood}
          onQuickAddKcal={handleQuickAddKcal}
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
          frequentFoods={frequentFoods}
          allSavedMeals={allSavedMeals}
          groupedEntries={groupedEntries}
          collapsedMeals={collapsedMeals}
          selectedDateKey={selectedDateKey}
          summaries={summary364}
          copyStatus={copyStatus}
          onSelectSavedMeal={handleSelectSavedMeal}
          onSelectFrequentFood={handleSelectFrequentFood}
          onQuickAddKcal={handleQuickAddKcal}
          onBrowseSavedMeals={() => setSearchSheetVisible(true)}
          onManualAdd={openManualAddModal}
          onToggleMealGroup={toggleMealGroup}
          onSelectDate={handleSelectDiaryDate}
          onCopyFromDay={handleCopyFromDay}
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

      <MacroTargetsModal
        visible={targetsSheetVisible}
        currentTargets={effectiveTargets}
        onSave={(next) => {
          setMacroTargets(next);
          void saveMacroTargets(next).catch(() => undefined);
        }}
        onClose={() => setTargetsSheetVisible(false)}
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
      <ScreenSection>{macroTrendSection}</ScreenSection>
      <ScreenSection className="mb-0">{calorieHistorySection}</ScreenSection>
    </Screen>
  );
}
