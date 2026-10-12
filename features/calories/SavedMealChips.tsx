import { View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { PillChip } from '@/core/ui/PillChip';
import { SectionLabel } from '@/core/ui/SectionLabel';
import type { FrequentFood } from './calories.domain';
import type { SavedMeal } from './types';

type Props = {
  meals: SavedMeal[];
  onSelect: (meal: SavedMeal) => void;
  color?: string;
};

/**
 * Recent saved-meal chips (V3 W10, SYS-18): content-hugging chips that WRAP
 * into rows. The old fixed-width horizontal scroller truncated long food
 * names ("Chicken b…") with no affordance cue; a wrapping row keeps every
 * label fully readable at 360px and never hides content behind a scroll.
 */
export function SavedMealChips({ meals, onSelect, color }: Props) {
  const { sectionAccents } = useAppTheme();
  const accent = color ?? sectionAccents.calories.fill;

  if (meals.length === 0) return null;

  return (
    <View className="mb-3">
      <SectionLabel>Recent foods</SectionLabel>
      <View className="flex-row flex-wrap">
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
      <SectionLabel>Frequent foods</SectionLabel>
      <View className="flex-row flex-wrap">
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
    </View>
  );
}
