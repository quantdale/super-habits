import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { PillChip } from '@/core/ui/PillChip';
import { TextField } from '@/core/ui/TextField';
import { ValidationError } from '@/core/ui/ValidationError';
import { radius, spacing } from '@/core/theme/designTokens';
import type { MealType } from './types';

type MealOption = {
  value: MealType;
  label: string;
};

type CaloriesEntryFieldsProps = {
  fieldIdPrefix: string;
  food: string;
  protein: string;
  carbs: string;
  fats: string;
  fiber: string;
  mealType: MealType;
  mealOptions: readonly MealOption[];
  computedKcal: number;
  calorieError: string | null;
  accentColor: string;
  onFoodChange: (value: string) => void;
  onProteinChange: (value: string) => void;
  onCarbsChange: (value: string) => void;
  onFatsChange: (value: string) => void;
  onFiberChange: (value: string) => void;
  onMealTypeChange: (value: MealType) => void;
  footer: ReactNode;
};

export function CaloriesEntryFields({
  fieldIdPrefix,
  food,
  protein,
  carbs,
  fats,
  fiber,
  mealType,
  mealOptions,
  computedKcal,
  calorieError,
  accentColor,
  onFoodChange,
  onProteinChange,
  onCarbsChange,
  onFatsChange,
  onFiberChange,
  onMealTypeChange,
  footer,
}: CaloriesEntryFieldsProps) {
  const { tokens } = useAppTheme();

  return (
    <>
      <TextField
        label="Food"
        nativeID={`${fieldIdPrefix}-food`}
        accessibilityLabel={`Calories ${fieldIdPrefix === 'cal-edit' ? 'edit' : 'entry'} food`}
        value={food}
        onChangeText={onFoodChange}
        placeholder="Greek yogurt"
      />
      <View className="flex-row flex-wrap gap-2">
        <View className="min-w-[140px] grow basis-[22%]">
          <TextField
            label="Protein (g)"
            nativeID={`${fieldIdPrefix}-protein`}
            accessibilityLabel={`Calories ${fieldIdPrefix === 'cal-edit' ? 'edit' : 'entry'} protein`}
            value={protein}
            onChangeText={onProteinChange}
            unsignedInteger
          />
        </View>
        <View className="min-w-[140px] grow basis-[22%]">
          <TextField
            label="Carbs (g)"
            nativeID={`${fieldIdPrefix}-carbs`}
            accessibilityLabel={`Calories ${fieldIdPrefix === 'cal-edit' ? 'edit' : 'entry'} carbs`}
            value={carbs}
            onChangeText={onCarbsChange}
            unsignedInteger
          />
        </View>
        <View className="min-w-[140px] grow basis-[22%]">
          <TextField
            label="Fats (g)"
            nativeID={`${fieldIdPrefix}-fat`}
            accessibilityLabel={`Calories ${fieldIdPrefix === 'cal-edit' ? 'edit' : 'entry'} fat`}
            value={fats}
            onChangeText={onFatsChange}
            unsignedInteger
          />
        </View>
        <View className="min-w-[140px] grow basis-[22%]">
          <TextField
            label="Fiber (g)"
            nativeID={`${fieldIdPrefix}-fiber`}
            accessibilityLabel={`Calories ${fieldIdPrefix === 'cal-edit' ? 'edit' : 'entry'} fiber`}
            value={fiber}
            onChangeText={onFiberChange}
            unsignedInteger
            placeholder="0"
          />
        </View>
      </View>
      <View
        className="mb-3"
        style={{
          backgroundColor: tokens.surfaceSunken,
          borderRadius: radius.lg,
          padding: spacing.md,
        }}
      >
        <View className="flex-row items-center gap-3">
          <Text variant="bodyMd" tone="muted">
            Calories (kcal)
          </Text>
          <Text variant="metric" style={{ flex: 1, textAlign: 'right', color: tokens.text }}>
            {computedKcal > 0 ? computedKcal : '—'}
          </Text>
        </View>
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
          Auto-calculated from protein, carbs, fat, and fiber.
        </Text>
      </View>
      <Text className="mb-2 text-sm font-medium" style={{ color: tokens.textMuted }}>
        Meal
      </Text>
      <View className="mb-4 flex-row flex-wrap">
        {mealOptions.map(({ value, label }) => (
          <PillChip
            key={value}
            label={label}
            active={mealType === value}
            color={accentColor}
            onPress={() => onMealTypeChange(value)}
          />
        ))}
      </View>
      <ValidationError message={calorieError} />
      {footer}
    </>
  );
}
