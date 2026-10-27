import { Button } from '@/core/ui/Button';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { Pressable, View } from 'react-native';
import { toDateKey } from '@/lib/time';
import { CalorieQuickLogCard } from './CalorieQuickLogCard';
import { CaloriesEntryFields } from './CaloriesEntryFields';
import { MealGroupedDayLog } from './MealGroupedDayLog';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { formatDayContextLabel } from './caloriesFormat';
import type { MealGroup } from './MealGroupedDayLog';
import type { FrequentFood } from './calories.domain';
import type { CalorieEntry, MealType, SavedMeal } from './types';

type SharedProps = {
  accentColor: string;
  recentMeals: SavedMeal[];
  frequentFoods: FrequentFood[];
  savedMealCount: number;
  onSelectSavedMeal: (meal: SavedMeal) => void;
  onSelectFrequentFood: (food: FrequentFood) => void;
  onQuickAddKcal: (kcal: number) => Promise<void>;
  onBrowseSavedMeals: () => void;
};

/**
 * Which day the form is logging to, and a one-tap way back to today.
 *
 * The form logs to the shared day selection, so when the diary navigator is
 * parked on a past day the form must SAY so — a silent retarget is exactly
 * the failure this line prevents. On today it renders only "Today", so it
 * never reads as decoration on the common path.
 */
function DayContextLine({
  logDateKey,
  onLogToToday,
  accentColor,
}: {
  logDateKey: string;
  onLogToToday: () => void;
  accentColor: string;
}) {
  const { tokens } = useAppTheme();
  const isToday = logDateKey === toDateKey();

  return (
    <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
      <Text variant="caption" tone="muted" accessibilityLabel="Calories logging day">
        {isToday ? 'Logging to today' : `Logging to ${formatDayContextLabel(logDateKey)}`}
      </Text>
      {isToday ? null : (
        <Pressable
          onPress={onLogToToday}
          accessibilityRole="button"
          accessibilityLabel="Log to today"
          className="rounded-full px-3 py-1.5"
          style={{ backgroundColor: `${accentColor}18` }}
        >
          <Text variant="label" style={{ color: tokens.text }}>
            Today
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export type CaloriesFormViewProps = SharedProps & {
  groups: MealGroup[];
  collapsedMeals: Partial<Record<MealType, boolean>>;
  /** Local day every control in this view logs to (today unless the diary
   *  navigator moved the shared selection). */
  logDateKey: string;
  /** Return the shared day selection to today. */
  onLogToToday: () => void;
  food: string;
  protein: string;
  carbs: string;
  fats: string;
  fiber: string;
  mealType: MealType;
  mealOptions: readonly { value: MealType; label: string }[];
  computedKcal: number;
  calorieError: string | null;
  /** Day-log write failure (a failed delete must never look deleted). */
  error?: string | null;
  onFoodChange: (value: string) => void;
  onProteinChange: (value: string) => void;
  onCarbsChange: (value: string) => void;
  onFatsChange: (value: string) => void;
  onFiberChange: (value: string) => void;
  onMealTypeChange: (value: MealType) => void;
  onAddEntry: () => void;
  onToggleGroup: (mealType: MealType) => void;
  onEditEntry: (entry: CalorieEntry) => void;
  onDeleteEntry: (entry: CalorieEntry) => void;
};

/**
 * Form mode (V3 W10): the manual macro entry path, logging to the day the
 * surface is showing (today unless the diary navigator moved the shared day
 * selection). The quick-log card (recent/frequent chips, kcal quick add,
 * saved-meal browse) holds the fast entry paths, with the manual macro form as
 * this mode's single primary action — search-first add belongs to Diary mode,
 * where the form is a modal rather than an inline path. The meal-grouped day
 * log follows below.
 */
export function CaloriesFormView({
  accentColor,
  recentMeals,
  frequentFoods,
  savedMealCount,
  groups,
  collapsedMeals,
  logDateKey,
  onLogToToday,
  onSelectSavedMeal,
  onSelectFrequentFood,
  onQuickAddKcal,
  onBrowseSavedMeals,
  food,
  protein,
  carbs,
  fats,
  fiber,
  mealType,
  mealOptions,
  computedKcal,
  calorieError,
  error,
  onFoodChange,
  onProteinChange,
  onCarbsChange,
  onFatsChange,
  onFiberChange,
  onMealTypeChange,
  onAddEntry,
  onToggleGroup,
  onEditEntry,
  onDeleteEntry,
}: CaloriesFormViewProps) {
  return (
    <>
      <CalorieQuickLogCard
        accentColor={accentColor}
        recentMeals={recentMeals}
        frequentFoods={frequentFoods}
        savedMealCount={savedMealCount}
        onSelectSavedMeal={onSelectSavedMeal}
        onSelectFrequentFood={onSelectFrequentFood}
        onQuickAddKcal={onQuickAddKcal}
        onBrowseSavedMeals={onBrowseSavedMeals}
      >
        <DayContextLine
          logDateKey={logDateKey}
          onLogToToday={onLogToToday}
          accentColor={accentColor}
        />
        <CaloriesEntryFields
          fieldIdPrefix="cal-entry"
          food={food}
          protein={protein}
          carbs={carbs}
          fats={fats}
          fiber={fiber}
          mealType={mealType}
          mealOptions={mealOptions}
          computedKcal={computedKcal}
          calorieError={calorieError}
          accentColor={accentColor}
          onFoodChange={onFoodChange}
          onProteinChange={onProteinChange}
          onCarbsChange={onCarbsChange}
          onFatsChange={onFatsChange}
          onFiberChange={onFiberChange}
          onMealTypeChange={onMealTypeChange}
          footer={
            <Button
              label="Add entry"
              accessibilityLabel="Save calorie entry"
              onPress={onAddEntry}
              color={accentColor}
            />
          }
        />
      </CalorieQuickLogCard>

      <ScreenSection accessibilityLabel="Daily log">
        <MealGroupedDayLog
          groups={groups}
          collapsedMeals={collapsedMeals}
          accentColor={accentColor}
          error={error}
          onToggleGroup={onToggleGroup}
          onEditEntry={onEditEntry}
          onDeleteEntry={onDeleteEntry}
        />
      </ScreenSection>
    </>
  );
}
