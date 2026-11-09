import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { PillChip } from '@/core/ui/PillChip';
import { SectionLabel } from '@/core/ui/SectionLabel';
import { CHIP_WRAP_MAX_LINES } from './chipWrap';
import { useChipWrapClamp } from './useChipWrapClamp';
import type { FrequentFood } from './calories.domain';
import type { SavedMeal } from './types';

type Props = {
  meals: SavedMeal[];
  onSelect: (meal: SavedMeal) => void;
  color?: string;
};

/**
 * Recent saved-meal chips (V3 W10 SYS-18, restyled by Playful Momentum P17):
 * content-hugging chips that WRAP into rows instead of hiding long food names
 * behind a fixed-width scroller, clamped to the P17 maximum of two lines.
 *
 * The clamp is measured, not guessed (`useChipWrapClamp`): each chip reports
 * its laid-out row, and only rows past the first two are dropped. The full
 * catalog stays reachable through the quick-log card's existing "Browse saved
 * meals" control, so nothing becomes unreachable. Wrap-container width changes
 * invalidate geometry so hidden chips can remasure into the two-line window.
 */
export function SavedMealChips({ meals, onSelect, color }: Props) {
  const { sectionAccents } = useAppTheme();
  const accent = color ?? sectionAccents.calories.fill;
  const ids = meals.map((meal) => meal.id);
  const labelSignature = meals.map((meal) => `${meal.food_name}·${meal.calories}`).join('\u0001');
  const { visibleIds, hiddenCount, onChipLayout, onWrapLayout, layoutGeneration } =
    useChipWrapClamp(ids, undefined, labelSignature);

  if (meals.length === 0) return null;

  const rendered = visibleIds ? meals.filter((meal) => visibleIds.includes(meal.id)) : meals;

  return (
    <View className="mb-3">
      <SectionLabel>Recent foods</SectionLabel>
      <View
        className="flex-row flex-wrap"
        onLayout={(event) => onWrapLayout(event.nativeEvent.layout.width)}
      >
        {rendered.map((meal) => (
          <View
            key={`${meal.id}:${layoutGeneration}`}
            style={{ maxWidth: '100%' }}
            onLayout={(event) => onChipLayout(meal.id, event.nativeEvent.layout.y)}
          >
            <PillChip
              label={`${meal.food_name} · ${meal.calories} kcal`}
              accessibilityLabel={`Log ${meal.food_name}, ${meal.calories} kcal`}
              active={false}
              color={accent}
              onPress={() => onSelect(meal)}
            />
          </View>
        ))}
      </View>
      {hiddenCount > 0 ? (
        <SectionLabel className="mb-0">{`${hiddenCount} more in saved meals`}</SectionLabel>
      ) : null}
    </View>
  );
}

type FrequentProps = {
  foods: FrequentFood[];
  onSelect: (food: FrequentFood) => void;
  color?: string;
};

/**
 * "Frequent" chips: most-logged foods of the last ~30 days. Tapping reuses the
 * exact recent-chip prefill/add path via `onSelect`. Two-line clamp, same
 * measurement contract as the recent chips (P17). Overflow is expandable —
 * frequent foods come from entry history, not the saved-meal catalog, so the
 * quiet "more" hint must surface the hidden shortcuts itself.
 */
export function FrequentFoodChips({ foods, onSelect, color }: FrequentProps) {
  const { sectionAccents } = useAppTheme();
  const accent = color ?? sectionAccents.calories.fill;
  const [expanded, setExpanded] = useState(false);
  const ids = foods.map((food) => food.foodName.toLowerCase());
  const labelSignature = foods.map((food) => `${food.foodName}·${food.logCount}`).join('\u0001');
  const { visibleIds, hiddenCount, onChipLayout, onWrapLayout, layoutGeneration } =
    useChipWrapClamp(
      ids,
      expanded ? Number.POSITIVE_INFINITY : CHIP_WRAP_MAX_LINES,
      labelSignature,
    );

  if (foods.length === 0) return null;

  const rendered = visibleIds
    ? foods.filter((food) => visibleIds.includes(food.foodName.toLowerCase()))
    : foods;

  return (
    <View className="mb-3">
      <SectionLabel>Frequent foods</SectionLabel>
      <View
        className="flex-row flex-wrap"
        onLayout={(event) => onWrapLayout(event.nativeEvent.layout.width)}
      >
        {rendered.map((food) => {
          const id = food.foodName.toLowerCase();
          return (
            <View
              key={`${id}:${layoutGeneration}`}
              style={{ maxWidth: '100%' }}
              onLayout={(event) => onChipLayout(id, event.nativeEvent.layout.y)}
            >
              <PillChip
                label={`${food.foodName} · ${food.logCount}×`}
                accessibilityLabel={`Log ${food.foodName}, logged ${food.logCount} times recently`}
                active={false}
                color={accent}
                onPress={() => onSelect(food)}
              />
            </View>
          );
        })}
      </View>
      {hiddenCount > 0 && !expanded ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Show ${hiddenCount} more frequent foods`}
          onPress={() => setExpanded(true)}
        >
          <SectionLabel className="mb-0">{`${hiddenCount} more in frequent foods`}</SectionLabel>
        </Pressable>
      ) : null}
    </View>
  );
}
