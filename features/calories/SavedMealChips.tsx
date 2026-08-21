import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import type { FrequentFood } from './calories.domain';
import type { SavedMeal } from './types';

type Props = {
  meals: SavedMeal[];
  onSelect: (meal: SavedMeal) => void;
};

export function SavedMealChips({ meals, onSelect }: Props) {
  const { tokens } = useAppTheme();

  if (meals.length === 0) return null;

  return (
    <View className="mb-3">
      <Text
        className="mb-1.5 text-xs font-semibold uppercase tracking-[0.8px]"
        style={{ color: tokens.textMuted }}
      >
        Recent foods
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
        <View className="flex-row gap-2">
          {meals.map((meal) => (
            <Pressable
              key={meal.id}
              onPress={() => onSelect(meal)}
              accessibilityRole="button"
              accessibilityLabel={`Log ${meal.food_name}, ${meal.calories} kcal`}
              className="min-h-[44px] flex-row items-center gap-2 rounded-2xl border px-3 py-2.5"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
            >
              <Text className="text-sm font-medium" style={{ color: tokens.text }}>
                {meal.food_name}
              </Text>
              <Text className="text-xs" style={{ color: tokens.textMuted }}>
                {meal.calories} kcal
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

type FrequentProps = {
  foods: FrequentFood[];
  onSelect: (food: FrequentFood) => void;
};

/**
 * "Frequent" chips: most-logged foods of the last ~30 days. Tapping reuses
 * the exact recent-chip prefill/add path via `onSelect`.
 */
export function FrequentFoodChips({ foods, onSelect }: FrequentProps) {
  const { tokens } = useAppTheme();

  if (foods.length === 0) return null;

  return (
    <View className="mb-3">
      <Text
        className="mb-1.5 text-xs font-semibold uppercase tracking-[0.8px]"
        style={{ color: tokens.textMuted }}
      >
        Frequent foods
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
        <View className="flex-row gap-2">
          {foods.map((food) => (
            <Pressable
              key={food.foodName.toLowerCase()}
              onPress={() => onSelect(food)}
              accessibilityRole="button"
              accessibilityLabel={`Log ${food.foodName}, logged ${food.logCount} times recently`}
              className="min-h-[44px] flex-row items-center gap-2 rounded-2xl border px-3 py-2.5"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
            >
              <Text className="text-sm font-medium" style={{ color: tokens.text }}>
                {food.foodName}
              </Text>
              <Text className="text-xs" style={{ color: tokens.textMuted }}>
                {food.logCount}×
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
