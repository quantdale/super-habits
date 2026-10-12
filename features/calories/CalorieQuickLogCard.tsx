import type { ReactNode } from 'react';
import { useState, memo, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { Text } from '@/core/ui/Text';
import { TextField } from '@/core/ui/TextField';
import { FrequentFoodChips, SavedMealChips } from './SavedMealChips';
import { QuickAddKcal } from './QuickAddKcal';
import { filterSavedMeals } from './calories.domain';
import type { FrequentFood } from './calories.domain';
import type { SavedMeal } from './types';

/**
 * Search-first add (Diary mode): query the saved-meal catalog inline, pick a
 * match, or fall through to the manual-add modal for a new food.
 */
export const DiaryQuickAddSearch = memo(function DiaryQuickAddSearch({
  accentColor,
  allSavedMeals,
  onSelectSavedMeal,
  onBrowseSavedMeals,
  onManualAdd,
}: {
  accentColor: string;
  allSavedMeals: SavedMeal[];
  onSelectSavedMeal: (meal: SavedMeal) => void;
  onBrowseSavedMeals: () => void;
  onManualAdd: (query: string) => void;
}) {
  const { tokens, sectionAccents } = useAppTheme();
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return filterSavedMeals(allSavedMeals, query).slice(0, 4);
  }, [allSavedMeals, query]);

  const handleSelect = (meal: SavedMeal) => {
    setQuery('');
    onSelectSavedMeal(meal);
  };

  return (
    <>
      <TextField
        label="Search saved meals"
        value={query}
        onChangeText={setQuery}
        placeholder="Chicken breast"
      />

      {query.trim() ? (
        matches.length > 0 ? (
          <View className="mb-3 gap-2">
            <Text variant="label" tone="muted" style={{ textTransform: 'uppercase' }}>
              Matches
            </Text>
            {matches.map((meal) => (
              <Pressable
                key={meal.id}
                onPress={() => handleSelect(meal)}
                className="rounded-2xl px-4 py-3"
                style={{ backgroundColor: sectionAccents.calories.tint }}
              >
                <Text className="text-sm font-medium" style={{ color: tokens.text }}>
                  {meal.food_name}
                </Text>
                <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
                  {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F {meal.fats}g
                  {meal.fiber > 0 ? ` · Fi ${meal.fiber}g` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View
            className="mb-3 rounded-2xl px-4 py-3"
            style={{ backgroundColor: tokens.surfaceSunken }}
          >
            <Text className="text-sm" style={{ color: tokens.textMuted }}>
              No saved meal matches “{query.trim()}”. Use Manual add to log it as a new food.
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
            onPress={onBrowseSavedMeals}
          />
        </View>
        <View className="flex-1">
          <Button label="Manual add" onPress={() => onManualAdd(query)} color={accentColor} />
        </View>
      </View>
    </>
  );
});

type Props = {
  accentColor: string;
  recentMeals: SavedMeal[];
  frequentFoods: FrequentFood[];
  savedMealCount: number;
  onSelectSavedMeal: (meal: SavedMeal) => void;
  onSelectFrequentFood: (food: FrequentFood) => void;
  onQuickAddKcal: (kcal: number) => Promise<void>;
  onBrowseSavedMeals: () => void;
  /** Form mode: the manual macro form. Diary mode: the search-first add. */
  children: ReactNode;
};

/**
 * One logging card (V3 W10, R5): every fast entry path in one place — recent
 * foods, frequent foods, kcal quick add, saved-meal browsing — followed by the
 * mode's primary entry path (the manual macro form in Form mode, search-first
 * add in Diary mode). The card owns exactly one primary action per mode.
 */
export function CalorieQuickLogCard({
  accentColor,
  recentMeals,
  frequentFoods,
  savedMealCount,
  onSelectSavedMeal,
  onSelectFrequentFood,
  onQuickAddKcal,
  onBrowseSavedMeals,
  children,
}: Props) {
  return (
    <ScreenSection>
      <Card className="mb-0">
        <SavedMealChips meals={recentMeals} onSelect={onSelectSavedMeal} />
        <FrequentFoodChips foods={frequentFoods} onSelect={onSelectFrequentFood} />
        <QuickAddKcal onSubmit={onQuickAddKcal} accentColor={accentColor} />
        {savedMealCount > 0 ? (
          <View className="mb-3 self-start">
            <Button
              label={`Browse saved meals (${savedMealCount})`}
              variant="secondary"
              icon="search"
              size="sm"
              onPress={onBrowseSavedMeals}
            />
          </View>
        ) : null}
        {children}
      </Card>
    </ScreenSection>
  );
}
