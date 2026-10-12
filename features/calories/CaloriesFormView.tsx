import { Button } from '@/core/ui/Button';
import { CalorieQuickLogCard } from './CalorieQuickLogCard';
import { CaloriesEntryFields } from './CaloriesEntryFields';
import { MealGroupedDayLog } from './MealGroupedDayLog';
import { ScreenSection } from '@/core/ui/ScreenSection';
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

export type CaloriesFormViewProps = SharedProps & {
  groups: MealGroup[];
  collapsedMeals: Partial<Record<MealType, boolean>>;
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
 * Form mode (V3 W10): the manual macro entry path, always logging to today.
 * The quick-log card (recent/frequent chips, kcal quick add, saved-meal
 * browse) holds the fast entry paths, with the manual macro form as this
 * mode's single primary action — search-first add belongs to Diary mode,
 * where the form is a modal rather than an inline path. The meal-grouped
 * day log follows below.
 */
export function CaloriesFormView({
  accentColor,
  recentMeals,
  frequentFoods,
  savedMealCount,
  groups,
  collapsedMeals,
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
