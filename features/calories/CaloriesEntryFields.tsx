import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { PillChip } from '@/core/ui/PillChip';
import { TextField } from '@/core/ui/TextField';
import { ValidationError } from '@/core/ui/ValidationError';
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
      <View className="mb-3">
        <View className="flex-row items-center gap-3">
          <Text className="text-sm font-medium" style={{ color: tokens.textMuted }}>
            Calories (kcal)
          </Text>
          <Text
            className="flex-1 rounded-xl border px-3 py-2 text-right text-base"
            style={{
              color: tokens.text,
              borderColor: tokens.border,
              backgroundColor: tokens.surfaceElevated,
            }}
          >
            {computedKcal > 0 ? computedKcal : '—'}
          </Text>
        </View>
        <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
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
