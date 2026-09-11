import { Text } from '@/core/ui/Text';
import React from 'react';
import { View, ScrollView } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { PillChip } from '@/core/ui/PillChip';
import type { FrequentFood } from './calories.domain';
import type { SavedMeal } from './types';

type Props = {
  meals: SavedMeal[];
  onSelect: (meal: SavedMeal) => void;
  color?: string;
};

export function SavedMealChips({ meals, onSelect, color }: Props) {
  const { sectionAccents } = useAppTheme();
  const accent = color ?? sectionAccents.calories.fill;

  if (meals.length === 0) return null;

  return (
    <View className="mb-3">
      <Text
        className="mb-1.5 text-xs font-semibold uppercase tracking-[0.8px]"
        style={{ color: sectionAccents.calories.text }}
      >
        Recent foods
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
        <View className="flex-row items-center pr-1 pt-1">
          {meals.map((meal) => (
            <PillChip
              key={meal.id}
              label={`${meal.food_name} · ${meal.calories} kcal`}
              accessibilityLabel={`Log ${meal.food_name}, ${meal.calories} kcal`}
              active={false}
              color={accent}
              onPress={() => onSelect(meal)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

type FrequentProps = {
  foods: FrequentFood[];
  onSelect: (food: FrequentFood) => void;
  color?: string;
};

/**
 * "Frequent" chips: most-logged foods of the last ~30 days. Tapping reuses
 * the exact recent-chip prefill/add path via `onSelect`.
 */
export function FrequentFoodChips({ foods, onSelect, color }: FrequentProps) {
  const { sectionAccents } = useAppTheme();
  const accent = color ?? sectionAccents.calories.fill;

  if (foods.length === 0) return null;

  return (
    <View className="mb-3">
      <Text
        className="mb-1.5 text-xs font-semibold uppercase tracking-[0.8px]"
        style={{ color: sectionAccents.calories.text }}
      >
        Frequent foods
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
        <View className="flex-row items-center pr-1 pt-1">
          {foods.map((food) => (
            <PillChip
              key={food.foodName.toLowerCase()}
              label={`${food.foodName} · ${food.logCount}×`}
              accessibilityLabel={`Log ${food.foodName}, logged ${food.logCount} times recently`}
              active={false}
              color={accent}
              onPress={() => onSelect(food)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
