import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { FeatureStatCard } from '@/core/ui/FeatureStatCard';
import { Modal } from '@/core/ui/Modal';
import { PageHeader } from '@/core/ui/PageHeader';
import { Screen } from '@/core/ui/Screen';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { SwipeableCard } from '@/core/ui/SwipeableCard';
import { TextField } from '@/core/ui/TextField';
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
  filterSavedMeals,
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
import { CaloriesEntryFields } from './CaloriesEntryFields';
import { DailyCalorieChart } from './DailyCalorieChart';
import { MacroDonutChart } from './MacroDonutChart';
import { SavedMealChips } from './SavedMealChips';
import { SavedMealSearchModal } from './SavedMealSearchModal';

const COLOR = SECTION_COLORS.calories;
const CALORIES_VIEW_MODE_STORAGE_KEY = 'superhabits.calories.viewMode';

type CaloriesViewMode = 'form' | 'diary';

type MealSection = {
  mealType: MealType;
  label: string;
  entries: CalorieEntry[];
  totalCalories: number;
};

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

function formatEntryTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatMealCount(count: number) {
  return count === 1 ? '1 item' : `${count} items`;
}

const CalorieEntrySwipeRow = memo(
  function CalorieEntrySwipeRow({
    entry,
    onEdit,
    onDelete,
  }: {
    entry: CalorieEntry;
    onEdit: () => void;
    onDelete: () => void;
  }) {
    const { tokens } = useAppTheme();

    return (
      <SwipeableCard
        accentColor={COLOR}
        style={{ marginBottom: 12 }}
        onEdit={onEdit}
        onDelete={onDelete}
      >
        <Text className="text-base font-semibold" style={{ color: tokens.text }}>
          {entry.food_name} - {entry.calories} kcal
        </Text>
        <Text className="mt-1 text-sm capitalize" style={{ color: tokens.textMuted }}>
          {entry.meal_type} · P {entry.protein}g / C {entry.carbs}g / F {entry.fats}g / Fiber{' '}
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

function DiaryActionButton({
  icon,
  accessibilityLabel,
  color,
  backgroundColor,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  accessibilityLabel: string;
  color: string;
  backgroundColor: string;
  onPress: () => void;
}) {
  const { tokens } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="h-11 w-11 items-center justify-center rounded-2xl border"
      style={{ borderColor: tokens.border, backgroundColor }}
    >
      <MaterialIcons name={icon} size={18} color={color} />
    </Pressable>
  );
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

function DiaryMealGroupCard({
  section,
  collapsed,
  onToggle,
  onEdit,
  onDelete,
}: {
  section: MealSection;
  collapsed: boolean;
  onToggle: () => void;
  onEdit: (entry: CalorieEntry) => void;
  onDelete: (entry: CalorieEntry) => void;
}) {
  const { tokens, sectionAccents } = useAppTheme();
  const colorText = sectionAccents.calories.text;

  return (
    <Card className="mb-3" innerClassName="p-0">
      <Pressable onPress={onToggle} className="px-4 py-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <View
                className="rounded-full px-3 py-1"
                style={{ backgroundColor: sectionAccents.calories.tint }}
              >
                <Text className="text-xs font-semibold" style={{ color: colorText }}>
                  {section.label}
                </Text>
              </View>
              <Text className="text-xs font-medium" style={{ color: tokens.textMuted }}>
                {formatMealCount(section.entries.length)}
              </Text>
            </View>
            <Text className="mt-3 text-lg font-semibold" style={{ color: tokens.text }}>
              {section.totalCalories} kcal
            </Text>
          </View>
          <MaterialIcons
            name={collapsed ? 'expand-more' : 'expand-less'}
            size={22}
            color={tokens.iconMuted}
          />
        </View>
      </Pressable>

      {!collapsed ? (
        <View className="gap-3 border-t px-4 pb-4 pt-3" style={{ borderColor: tokens.border }}>
          {section.entries.map((entry) => (
            <View
              key={entry.id}
              className="rounded-2xl border px-4 py-3"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                      {entry.food_name}
                    </Text>
                    <View
                      className="rounded-full px-2.5 py-1"
                      style={{
                        backgroundColor: tokens.surface,
                        borderColor: tokens.border,
                        borderWidth: 1,
                      }}
                    >
                      <Text className="text-[11px] font-semibold" style={{ color: colorText }}>
                        {entry.calories} kcal
                      </Text>
                    </View>
                  </View>
                  <Text className="mt-2 text-xs" style={{ color: tokens.textMuted }}>
                    P {entry.protein}g · C {entry.carbs}g · F {entry.fats}g · Fiber {entry.fiber}g
                  </Text>
                  <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
                    Logged {formatEntryTimestamp(entry.created_at)}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <DiaryActionButton
                    icon="edit"
                    accessibilityLabel={`Edit ${entry.food_name}`}
                    color={colorText}
                    backgroundColor={tokens.surface}
                    onPress={() => onEdit(entry)}
                  />
                  <DiaryActionButton
                    icon="delete-outline"
                    accessibilityLabel={`Delete ${entry.food_name}`}
                    color={tokens.dangerText}
                    backgroundColor={tokens.dangerBackground}
                    onPress={() => onDelete(entry)}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function CaloriesScreen({ isActive }: { isActive: boolean }) {
  const { tokens, sectionAccents } = useAppTheme();
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
  const [diarySearch, setDiarySearch] = useState('');
  const [collapsedMeals, setCollapsedMeals] = useState<Partial<Record<MealType, boolean>>>({});

  const refresh = useCallback(async () => {
    const nextEntries = await listCalorieEntries();
    setEntries(nextEntries);

    const startYear = new Date();
    startYear.setDate(startYear.getDate() - 364);
    const [recent, all, rangeYear, savedGoal] = await Promise.all([
      listRecentSavedMeals(5),
      searchSavedMeals(''),
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

  useActiveForegroundRefresh(isActive, refresh);

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
  const diarySearchMatches = useMemo(() => {
    if (!diarySearch.trim()) return [];
    return filterSavedMeals(allSavedMeals, diarySearch).slice(0, 4);
  }, [allSavedMeals, diarySearch]);
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
    if (nextMode === 'form') {
      setDiarySearch('');
    }
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
    setDiarySearch('');
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

  const openManualAddModal = () => {
    const prefilledFood = diarySearch.trim();
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
        setDiarySearch('');
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

  const addEntryFooter = <Button label="Add entry" onPress={handleSubmit} color={COLOR} />;
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
        <>
          <ScreenSection>
            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[160px] flex-1">
                <FeatureStatCard
                  accentColor={COLOR}
                  textColor={colorText}
                  icon="restaurant-menu"
                  title="Days logged"
                  value={calorieActivityDays.filter((day) => day.active).length}
                  subtitle="Rolling year"
                  note={
                    hasCalorieStripActivity
                      ? 'Daily intake history is active'
                      : 'No intake history yet'
                  }
                />
              </View>
              <View className="min-w-[160px] flex-1">
                <FeatureStatCard
                  accentColor={COLOR}
                  textColor={colorText}
                  icon="track-changes"
                  title="Goal progress"
                  value={`${goalProgress.percent}%`}
                  subtitle="Today"
                  note={
                    goalProgress.over
                      ? 'You are over goal'
                      : `${goalProgress.remaining} kcal remaining`
                  }
                />
              </View>
            </View>
          </ScreenSection>

          <ScreenSection>
            <Card
              variant="header"
              accentColor={COLOR}
              headerTitle="Add entry"
              headerSubtitle="Keep the current macro form and reuse foods when they repeat."
              className="mb-0"
            >
              <SavedMealChips meals={recentMeals} onSelect={handleSelectSavedMeal} />
              {allSavedMeals.length > 0 ? (
                <Pressable
                  onPress={() => setSearchSheetVisible(true)}
                  className="mb-3 self-start flex-row items-center gap-2 rounded-full border px-3 py-2"
                  style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
                >
                  <MaterialIcons name="search" size={16} color={colorText} />
                  <Text className="text-xs font-medium" style={{ color: tokens.textMuted }}>
                    Browse saved meals ({allSavedMeals.length})
                  </Text>
                </Pressable>
              ) : null}
              <CaloriesEntryFields
                fieldIdPrefix="cal-entry"
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
                footer={addEntryFooter}
              />
            </Card>
          </ScreenSection>

          <ScreenSection>{dailySummaryCard}</ScreenSection>

          {entries.length > 0 ? (
            <ScreenSection>
              <View className="mb-4 px-1">
                <Text className="text-base font-semibold" style={{ color: tokens.text }}>
                  Logged today
                </Text>
                <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                  Swipe an entry to edit or remove it.
                </Text>
              </View>

              {entries.map((entry) => (
                <CalorieEntrySwipeRow
                  key={entry.id}
                  entry={entry}
                  onEdit={() => openEntryEditModal(entry)}
                  onDelete={() => handleDeleteEntry(entry)}
                />
              ))}
            </ScreenSection>
          ) : null}
        </>
      ) : (
        <>
          <ScreenSection>{dailySummaryCard}</ScreenSection>

          <ScreenSection>
            <Card
              variant="header"
              accentColor={COLOR}
              headerTitle="Quick add"
              headerSubtitle="Recent foods, saved meals, search-first add, and manual entry."
              headerRight={
                <MaterialIcons name="playlist-add" size={22} color={tokens.textOnAccent} />
              }
              className="mb-0"
            >
              <SavedMealChips meals={recentMeals} onSelect={handleSelectSavedMeal} />
              <TextField
                label="Search saved meals / start with a food name"
                value={diarySearch}
                onChangeText={setDiarySearch}
                placeholder="Chicken breast"
              />

              {diarySearch.trim() ? (
                diarySearchMatches.length > 0 ? (
                  <View className="mb-3 gap-2">
                    <Text
                      className="text-xs font-semibold uppercase"
                      style={{ color: tokens.textMuted }}
                    >
                      Matches
                    </Text>
                    {diarySearchMatches.map((meal) => (
                      <Pressable
                        key={meal.id}
                        onPress={() => handleSelectSavedMeal(meal)}
                        className="rounded-2xl border px-4 py-3"
                        style={{
                          borderColor: tokens.border,
                          backgroundColor: tokens.surfaceElevated,
                        }}
                      >
                        <Text className="text-sm font-medium" style={{ color: tokens.text }}>
                          {meal.food_name}
                        </Text>
                        <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
                          {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F {meal.fats}
                          g{meal.fiber > 0 ? ` · Fi ${meal.fiber}g` : ''}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View
                    className="mb-3 rounded-2xl border px-4 py-3"
                    style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
                  >
                    <Text className="text-sm" style={{ color: tokens.textMuted }}>
                      No saved meal matches “{diarySearch.trim()}”. Use Manual add to log it as a
                      new food.
                    </Text>
                  </View>
                )
              ) : null}

              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    label="Browse saved"
                    variant="ghost"
                    disabled={allSavedMeals.length === 0}
                    onPress={() => setSearchSheetVisible(true)}
                  />
                </View>
                <View className="flex-1">
                  <Button label="Manual add" onPress={openManualAddModal} color={COLOR} />
                </View>
              </View>
            </Card>
          </ScreenSection>

          <ScreenSection>
            {groupedEntries.length === 0 ? (
              <EmptyStateCard
                accentColor={COLOR}
                className="mb-0"
                icon={<MaterialIcons name="menu-book" size={22} color={colorText} />}
                title="No meals logged today"
                description="Use quick add or manual add to start your diary."
              />
            ) : (
              <>
                <View className="mb-4 px-1">
                  <Text className="text-base font-semibold" style={{ color: tokens.text }}>
                    Daily log
                  </Text>
                  <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                    Entries are grouped by stored meal type and default to expanded.
                  </Text>
                </View>
                {groupedEntries.map((section) => (
                  <DiaryMealGroupCard
                    key={section.mealType}
                    section={section}
                    collapsed={collapsedMeals[section.mealType] ?? false}
                    onToggle={() => toggleMealGroup(section.mealType)}
                    onEdit={openEntryEditModal}
                    onDelete={handleDeleteEntry}
                  />
                ))}
              </>
            )}
          </ScreenSection>
        </>
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
