import { MaterialIcons } from '@expo/vector-icons';
import { memo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { FeatureStatCard } from '@/core/ui/FeatureStatCard';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { SwipeableCard } from '@/core/ui/SwipeableCard';
import type { ActivityDay } from '@/features/shared/activityTypes';
import { CaloriesEntryFields } from './CaloriesEntryFields';
import { EntryMacroShareLine } from './EntryMacroShareLine';
import { FrequentFoodChips, SavedMealChips } from './SavedMealChips';
import { QuickAddKcal } from './QuickAddKcal';
import type { FrequentFood } from './calories.domain';
import type { CalorieEntry, MealType, SavedMeal } from './types';

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
    const { tokens } = useAppTheme();

    return (
      <SwipeableCard
        accentColor={accentColor}
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
        <EntryMacroShareLine
          protein={entry.protein}
          carbs={entry.carbs}
          fats={entry.fats}
          fiber={entry.fiber}
        />
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

type CaloriesFormViewProps = {
  accentColor: string;
  colorText: string;
  calorieActivityDays: ActivityDay[];
  goalProgress: { percent: number; remaining: number; over: boolean };
  hasCalorieStripActivity: boolean;
  recentMeals: SavedMeal[];
  frequentFoods: FrequentFood[];
  allSavedMeals: SavedMeal[];
  entries: CalorieEntry[];
  todayCard: ReactNode;
  food: string;
  protein: string;
  carbs: string;
  fats: string;
  fiber: string;
  mealType: MealType;
  mealOptions: readonly { value: MealType; label: string }[];
  computedKcal: number;
  calorieError: string | null;
  onSelectSavedMeal: (meal: SavedMeal) => void;
  onSelectFrequentFood: (food: FrequentFood) => void;
  onQuickAddKcal: (kcal: number) => Promise<void>;
  onBrowseSavedMeals: () => void;
  onFoodChange: (value: string) => void;
  onProteinChange: (value: string) => void;
  onCarbsChange: (value: string) => void;
  onFatsChange: (value: string) => void;
  onFiberChange: (value: string) => void;
  onMealTypeChange: (value: MealType) => void;
  onAddEntry: () => void;
  onEditEntry: (entry: CalorieEntry) => void;
  onDeleteEntry: (entry: CalorieEntry) => void;
};

export function CaloriesFormView({
  accentColor,
  colorText,
  calorieActivityDays,
  goalProgress,
  hasCalorieStripActivity,
  recentMeals,
  frequentFoods,
  allSavedMeals,
  entries,
  todayCard,
  food,
  protein,
  carbs,
  fats,
  fiber,
  mealType,
  mealOptions,
  computedKcal,
  calorieError,
  onSelectSavedMeal,
  onSelectFrequentFood,
  onQuickAddKcal,
  onBrowseSavedMeals,
  onFoodChange,
  onProteinChange,
  onCarbsChange,
  onFatsChange,
  onFiberChange,
  onMealTypeChange,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
}: CaloriesFormViewProps) {
  const { tokens } = useAppTheme();

  const addEntryFooter = (
    <Button
      label="Add entry"
      accessibilityLabel="Save calorie entry"
      onPress={onAddEntry}
      color={accentColor}
    />
  );

  return (
    <>
      <ScreenSection>
        <View className="flex-row flex-wrap gap-3">
          <View className="min-w-[160px] flex-1">
            <FeatureStatCard
              accentColor={accentColor}
              textColor={colorText}
              icon="restaurant-menu"
              title="Days logged"
              value={calorieActivityDays.filter((day) => day.active).length}
              subtitle="Rolling year"
              note={
                hasCalorieStripActivity ? 'Daily intake history is active' : 'No intake history yet'
              }
            />
          </View>
          <View className="min-w-[160px] flex-1">
            <FeatureStatCard
              accentColor={accentColor}
              textColor={colorText}
              icon="track-changes"
              title="Goal progress"
              value={`${goalProgress.percent}%`}
              subtitle="Today"
              note={
                goalProgress.over ? 'You are over goal' : `${goalProgress.remaining} kcal remaining`
              }
            />
          </View>
        </View>
      </ScreenSection>

      {/* Blueprint ordering: today's summary anchors the screen above the
          add-entry form (diary mode already renders the summary first). */}
      <ScreenSection>{todayCard}</ScreenSection>

      <ScreenSection>
        <Card
          variant="header"
          accentColor={accentColor}
          headerTitle="Add entry"
          headerSubtitle="Keep the current macro form and reuse foods when they repeat."
          className="mb-0"
        >
          <SavedMealChips meals={recentMeals} onSelect={onSelectSavedMeal} />
          <FrequentFoodChips foods={frequentFoods} onSelect={onSelectFrequentFood} />
          <QuickAddKcal onSubmit={onQuickAddKcal} accentColor={accentColor} />
          {allSavedMeals.length > 0 ? (
            <Pressable
              onPress={onBrowseSavedMeals}
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
            footer={addEntryFooter}
          />
        </Card>
      </ScreenSection>

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
              accentColor={accentColor}
              onEdit={() => onEditEntry(entry)}
              onDelete={() => onDeleteEntry(entry)}
            />
          ))}
        </ScreenSection>
      ) : null}
    </>
  );
}
