import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { useGamification } from '@/features/gamification/gamificationContext';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { Button } from '@/core/ui/Button';
import { Modal } from '@/core/ui/Modal';
import { PageHeader } from '@/core/ui/PageHeader';
import { Screen } from '@/core/ui/Screen';
import { SegmentedControl } from '@/core/ui/SegmentedControl';
import { Text } from '@/core/ui/Text';
import { TextField } from '@/core/ui/TextField';
import { createSubmitGuard } from '@/lib/submitGuard';
import { createPreferencePrecedenceGuard } from '@/lib/preferencePrecedence';
import { parseNumericInput } from '@/lib/numericInput';
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
import { isValidDateKey, toDateKey } from '@/lib/time';
import { useActiveForegroundRefresh } from '@/lib/useForegroundRefresh';
import { useGuardedAsyncRefresh } from '@/lib/useGuardedAsyncRefresh';
import {
  validateCalorieComputedKcal,
  validateCalorieEntry,
  validateConsumedDateKey,
} from '@/lib/validation';
import { CalorieGoalModal } from './CalorieGoalModal';
import { loadMacroTargets, saveMacroTargets } from './caloriesTargets';
import { MacroTargetsModal } from './MacroTargetsModal';
import { CaloriesDailyHero } from './CaloriesDailyHero';
import { CaloriesDiaryView } from './CaloriesDiaryView';
import { CaloriesEntryFields } from './CaloriesEntryFields';
import { CaloriesFormView } from './CaloriesFormView';
import { CaloriesHistorySection } from './CaloriesHistorySection';
import { CaloriesMacroSummary } from './CaloriesMacroSummary';
import { SavedMealSearchModal } from './SavedMealSearchModal';
import { formatDayContextLabel, formatKcal } from './caloriesFormat';
import type { MealGroup } from './MealGroupedDayLog';

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

function ViewModeSwitch({
  value,
  onChange,
}: {
  value: CaloriesViewMode;
  onChange: (nextValue: CaloriesViewMode) => void;
}) {
  // The control stretches to the hero width so both segment labels get an
  // equal half and the sliding pill always lands exactly on its label.
  return (
    <SegmentedControl
      options={VIEW_MODE_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        accessibilityLabel: `${option.label} view`,
      }))}
      value={value}
      onChange={onChange}
      accentColor={COLOR}
      accessibilityLabel="Calories view"
    />
  );
}

/**
 * Calories (V3 W10 reconstruction, R5): one logging-first surface with two
 * entry modes. The remaining-kcal number is the dominant daily indicator
 * (screen title); a compact macro summary carries totals and targets; every
 * fast entry path sits in one quick-log card; the day's entries are
 * meal-grouped with immediately accessible edit/delete actions; and all
 * historical trends live behind one collapsed disclosure so analytics never
 * compete with logging. Doc-copy subtitles (SYS-06) are gone, food chips
 * wrap instead of truncating (SYS-18), and no floating control overlaps the
 * form (SUR-07).
 *
 * Persistence semantics are unchanged from the pre-W10 surface: the same
 * data-layer write paths, sync/backup intents, saved-meal maintenance rules,
 * goal/target persistence, and day-correction contract.
 */
export function CaloriesScreen({ isActive }: { isActive: boolean }) {
  const { tokens } = useAppTheme();
  const { recordAction } = useGamification();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const dayGeneration = useDayRolloverGeneration();
  const { begin: beginRefresh } = useGuardedAsyncRefresh();
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
  const [entryDateKey, setEntryDateKey] = useState<string>(() => toDateKey());
  const [showEntryDatePicker, setShowEntryDatePicker] = useState(false);
  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const entrySubmitGuard = useRef(createSubmitGuard());
  const [viewMode, setViewMode] = useState<CaloriesViewMode>('form');
  /** AsyncStorage hydration resolves asynchronously; on a slow cold start it
   *  can settle AFTER the user already tapped the view switch, and a plain
   *  setViewMode(stored) would silently revert their choice. The shared
   *  precedence guard owns the F-05 contract (see lib/preferencePrecedence). */
  const viewPreferenceGuard = useMemo(() => createPreferencePrecedenceGuard(), []);
  const [collapsedMeals, setCollapsedMeals] = useState<Partial<Record<MealType, boolean>>>({});
  const [macroTargets, setMacroTargets] = useState<MacroTargets | null>(null);
  const [targetsSheetVisible, setTargetsSheetVisible] = useState(false);
  // Diary day selection (findings 1/6): defaults to today; the diary
  // navigator moves it and every entry read follows it.
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey());
  /** True while the diary selection tracks the current local day. An explicit
   *  past-day navigation detaches it so a midnight tick never yanks the user
   *  away from the day they deliberately opened (decided contract D9b). */
  const [followsToday, setFollowsToday] = useState(true);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  /** Day-log write failure (a failed delete must never look deleted). */
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /** History & insights disclosure (W10): collapsed by default so the logging
   *  surface leads and the heavy rolling derivations only run while open. */
  const [historyOpen, setHistoryOpen] = useState(false);

  const refresh = useCallback(async () => {
    const isCurrent = beginRefresh();
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
    if (!isCurrent()) return;
    setRecentMeals(recent);
    setAllSavedMeals(all);

    const [nextEntries, rangeYear, savedGoal, windowEntries] = await Promise.all([
      entriesPromise,
      summaryPromise,
      goalPromise,
      frequentEntriesPromise,
    ]);
    if (!isCurrent()) return;

    setEntries(nextEntries);
    setSummary364(rangeYear);
    setGoal(savedGoal);
    setFrequentFoods(buildFrequentFoods(windowEntries));
  }, [beginRefresh, selectedDateKey]);

  useActiveForegroundRefresh(isActive, refresh, dayGeneration);

  useEffect(() => {
    // D9b: when the local day rolls over, a selection that pointed at
    // "today" must follow the new day so the active section never renders
    // yesterday's totals under the Today header. An explicitly selected
    // past day stays put.
    if (!followsToday) return;
    queueMicrotask(() => setSelectedDateKey(toDateKey()));
  }, [dayGeneration, followsToday]);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(CALORIES_VIEW_MODE_STORAGE_KEY)
      .then((storedValue) => {
        if (!active || !viewPreferenceGuard.shouldApplyPersisted()) return;
        if (storedValue === 'form' || storedValue === 'diary') {
          viewPreferenceGuard.markChoiceMade();
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
  }, [viewPreferenceGuard]);

  const todayTotals = useMemo(
    () => ({
      protein: entries.reduce((sum, entry) => sum + entry.protein, 0),
      carbs: entries.reduce((sum, entry) => sum + entry.carbs, 0),
      fats: entries.reduce((sum, entry) => sum + entry.fats, 0),
      fiber: entries.reduce((sum, entry) => sum + entry.fiber, 0),
    }),
    [entries],
  );
  const consumedKcal = useMemo(() => caloriesTotal(entries), [entries]);
  const goalProgress = useMemo(
    () => calculateGoalProgress(consumedKcal, goal.calories),
    [consumedKcal, goal.calories],
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
      )
        .filter(({ target }) => target > 0)
        .map(({ key, label, actual, target }) => ({
          key,
          label,
          actual,
          target,
          progress: buildTargetProgress(actual, target),
        })),
    [todayTotals, effectiveTargets],
  );
  const groupedEntries = useMemo<MealGroup[]>(
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
  // History facts are cheap rollups over the already-loaded 365-day summary;
  // the expensive chart/heatmap derivations only run while the disclosure is
  // open, so the logging surface's refresh cost stays bounded.
  const daysLogged = useMemo(
    () => summary364.reduce((count, day) => (day.totalCalories > 0 ? count + 1 : count), 0),
    [summary364],
  );
  const averageKcal = useMemo(() => {
    if (daysLogged === 0) return 0;
    const total = summary364.reduce((sum, day) => sum + day.totalCalories, 0);
    return Math.round(total / daysLogged);
  }, [summary364, daysLogged]);
  const dailyTrend = useMemo(
    () => (historyOpen ? buildDailyTrend(summary364) : null),
    [historyOpen, summary364],
  );
  const calorieHeatmapDays = useMemo(
    () => (historyOpen ? buildCalorieHeatmapDays(summary364, goal.calories, 365) : null),
    [historyOpen, summary364, goal.calories],
  );
  const computedKcal = useMemo(
    () =>
      kcalFromMacros(
        parseNumericInput(protein) ?? 0,
        parseNumericInput(carbs) ?? 0,
        parseNumericInput(fats) ?? 0,
        parseNumericInput(fiber) ?? 0,
      ),
    [protein, carbs, fats, fiber],
  );
  /**
   * Pre-submit consumed-date validation for the edit modal (mirrors
   * `assertConsumableDateKey`): the error surfaces as soon as the date
   * becomes invalid/future, and Save stays disabled until it is saveable.
   * Null on the create path (no free date field there).
   */
  const entryDateError = useMemo(
    () => (editingEntryId ? validateConsumedDateKey(entryDateKey) : null),
    [editingEntryId, entryDateKey],
  );
  // End of today (local) capping the native date picker. Computed per
  // render (cheap) so a midnight rollover can never leave a stale cap.
  const entryDateMax = new Date();
  entryDateMax.setHours(23, 59, 59, 999);

  const resetCalorieForm = () => {
    setFood('');
    setProtein('');
    setCarbs('');
    setFats('');
    setFiber('');
    setMealType('breakfast');
    setEntryDateKey(toDateKey());
    setShowEntryDatePicker(false);
    setEditingEntryId(null);
    setCalorieError(null);
  };

  const setAndPersistViewMode = useCallback(
    (nextMode: CaloriesViewMode) => {
      // A manual choice always wins over the still-pending AsyncStorage
      // hydration (see viewPreferenceGuard).
      viewPreferenceGuard.markChoiceMade();
      setViewMode(nextMode);
      if (nextMode === 'form') {
        // The form always logs to today: drop any diary day selection so the
        // Today-labeled totals can never silently show a past day.
        setFollowsToday(true);
        setSelectedDateKey(toDateKey());
        setCopyStatus(null);
      }
      void AsyncStorage.setItem(CALORIES_VIEW_MODE_STORAGE_KEY, nextMode).catch(() => undefined);
    },
    [viewPreferenceGuard],
  );

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
    (food_: FrequentFood) => {
      applyMealToDraft(food_.latestEntry);
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
    setEntryDateKey(entry.consumed_on);
    setShowEntryDatePicker(false);
    setEditingEntryId(entry.id);
    // Surface a legacy future date immediately (Save is also disabled
    // via entryDateError); today/past entries clear any stale error.
    setCalorieError(validateConsumedDateKey(entry.consumed_on));
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
    async (entry: CalorieEntry) => {
      // Entries are deleted from a visible row action, so the destructive step
      // is confirmed explicitly (the retired swipe-to-reveal protected against
      // stray taps by hiding the action).
      const confirmed = await confirm({
        title: 'Delete entry',
        message: `Delete "${entry.food_name}" (${entry.calories} kcal)? This cannot be undone.`,
        confirmLabel: 'Delete entry',
        confirmVariant: 'danger',
      });
      if (!confirmed) return;
      setDeleteError(null);
      try {
        await deleteCalorieEntry(entry.id);
      } catch {
        // A failed delete must never look like a deleted row: the entry stays
        // in the log and the failure is surfaced next to it.
        setDeleteError('Could not delete entry. Please try again.');
        return;
      }
      if (editingEntryId === entry.id) {
        setEntryModalVisible(false);
        resetCalorieForm();
      }
      await refresh();
    },
    [confirm, editingEntryId, refresh],
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
            } into ${formatDayContextLabel(selectedDateKey)}.`,
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
      recordAction('nutrition');
      await refresh();
    },
    [recordAction, refresh, selectedDateKey],
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

    // Pre-submit consumed-date check (edit path only): refuse before the
    // submit guard with the exact data-layer message, so the user gets
    // feedback before — not after — the throw in `updateCalorieEntry`.
    if (editingEntryId) {
      const dateError = validateConsumedDateKey(entryDateKey);
      if (dateError) {
        setCalorieError(dateError);
        return;
      }
    }

    setCalorieError(null);
    // Double-submit guard: rapid re-taps must not create duplicate entries.
    if (!entrySubmitGuard.current.tryStart()) return;
    setIsSavingEntry(true);
    void (async () => {
      try {
        const proteinN = parseNumericInput(protein) ?? 0;
        const carbsN = parseNumericInput(carbs) ?? 0;
        const fatsN = parseNumericInput(fats) ?? 0;
        const fiberN = parseNumericInput(fiber) ?? 0;

        if (editingEntryId) {
          await updateCalorieEntry(editingEntryId, {
            foodName: food.trim(),
            protein: proteinN,
            carbs: carbsN,
            fats: fatsN,
            fiber: fiberN,
            mealType,
            consumedOn: entryDateKey,
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
        recordAction('nutrition');
        await refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Could not save entry.';
        setCalorieError(message);
      } finally {
        entrySubmitGuard.current.finish();
        setIsSavingEntry(false);
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
          loading={isSavingEntry}
          disabled={entryDateError !== null}
        />
      </View>
    </View>
  );

  const overBy = goalProgress.over ? consumedKcal - goal.calories : 0;
  const remainingLabel = goalProgress.over
    ? `${formatKcal(overBy)} kcal over`
    : `${formatKcal(goalProgress.remaining)} kcal left`;

  return (
    <Screen
      scroll
      hero={
        <View>
          <PageHeader eyebrow="Calories" title={remainingLabel} />
          <View className="mt-4">
            <ViewModeSwitch value={viewMode} onChange={setAndPersistViewMode} />
          </View>
        </View>
      }
    >
      {/* One daily summary + one compact macro summary; at content-max widths
          they compose side by side, on phones they stack (single responsive
          tree — only one branch renders). */}
      <View className="mb-6 flex-row flex-wrap" style={{ gap: 16 }}>
        <View className="min-w-[280px] flex-1">
          <CaloriesDailyHero
            consumed={consumedKcal}
            goal={goal.calories}
            over={goalProgress.over}
            overBy={overBy}
            percent={goalProgress.percent}
            dateKey={selectedDateKey}
            accentColor={COLOR}
            onEditGoal={() => setGoalSheetVisible(true)}
          />
        </View>
        <View className="min-w-[280px] flex-1">
          <CaloriesMacroSummary
            rows={macroTargetBars.map(({ key, label, actual, target, progress }) => ({
              key,
              label,
              actual,
              target,
              percent: progress.percent,
              remaining: progress.remaining,
              over: progress.over,
            }))}
            accentColor={COLOR}
            onEditTargets={() => setTargetsSheetVisible(true)}
          />
        </View>
      </View>

      {viewMode === 'form' ? (
        <CaloriesFormView
          accentColor={COLOR}
          recentMeals={recentMeals}
          frequentFoods={frequentFoods}
          savedMealCount={allSavedMeals.length}
          groups={groupedEntries}
          collapsedMeals={collapsedMeals}
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
          onToggleGroup={toggleMealGroup}
          onEditEntry={openEntryEditModal}
          onDeleteEntry={handleDeleteEntry}
          error={deleteError}
        />
      ) : (
        <CaloriesDiaryView
          accentColor={COLOR}
          recentMeals={recentMeals}
          frequentFoods={frequentFoods}
          allSavedMeals={allSavedMeals}
          groups={groupedEntries}
          collapsedMeals={collapsedMeals}
          selectedDateKey={selectedDateKey}
          summaries={summary364}
          copyStatus={copyStatus}
          error={deleteError}
          onSelectSavedMeal={handleSelectSavedMeal}
          onSelectFrequentFood={handleSelectFrequentFood}
          onQuickAddKcal={handleQuickAddKcal}
          onBrowseSavedMeals={() => setSearchSheetVisible(true)}
          onManualAdd={openManualAddModal}
          onToggleGroup={toggleMealGroup}
          onSelectDate={handleSelectDiaryDate}
          onCopyFromDay={handleCopyFromDay}
          onEditEntry={openEntryEditModal}
          onDeleteEntry={handleDeleteEntry}
        />
      )}

      <CaloriesHistorySection
        open={historyOpen}
        onToggle={() => setHistoryOpen((open) => !open)}
        accentColor={COLOR}
        dailyTrend={dailyTrend}
        summaries={summary364}
        heatmapDays={calorieHeatmapDays}
        goalKcal={goal.calories}
        daysLogged={daysLogged}
        averageKcal={averageKcal}
      />

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
        onSave={async (next) => {
          // Commit first; only reflect durable targets after persistence succeeds.
          await saveMacroTargets(next);
          setMacroTargets(next);
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
        {editingEntryId ? (
          <View className="mb-1">
            <Text className="mb-1 text-sm font-medium">Consumed on</Text>
            {Platform.OS === 'web' ? (
              <TextField
                label="Date (YYYY-MM-DD)"
                accessibilityLabel="Consumed date"
                value={entryDateKey}
                onChangeText={(t) => {
                  const next = t.trim();
                  setEntryDateKey(next);
                  setCalorieError(validateConsumedDateKey(next));
                }}
              />
            ) : (
              <>
                <Pressable
                  onPress={() => setShowEntryDatePicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Change consumed date"
                  className="py-2"
                >
                  <Text className="text-sm" style={{ color: tokens.textMuted }}>
                    {formatDayContextLabel(entryDateKey)}
                  </Text>
                </Pressable>
                {showEntryDatePicker ? (
                  <DateTimePicker
                    value={
                      isValidDateKey(entryDateKey)
                        ? new Date(entryDateKey + 'T12:00:00')
                        : new Date()
                    }
                    mode="date"
                    display="default"
                    maximumDate={entryDateMax}
                    onChange={(event, selectedDate) => {
                      setShowEntryDatePicker(false);
                      if (event.type === 'set' && selectedDate) {
                        const next = toDateKey(selectedDate);
                        setEntryDateKey(next);
                        setCalorieError(validateConsumedDateKey(next));
                      }
                    }}
                  />
                ) : null}
              </>
            )}
          </View>
        ) : null}
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

      {confirmationDialog}
    </Screen>
  );
}
