import { View } from 'react-native';
import { Button } from '@/core/ui/Button';
import { SettingsGroup, SettingsRow, SettingsSectionHeading } from './SettingsSharedUi';
import { NumberStepperField } from '@/core/ui/NumberStepperField';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { ValidationError } from '@/core/ui/ValidationError';
import { SECTION_COLORS } from '@/constants/sectionColors';
import type { CalorieGoal } from '@/features/calories/types';
import { formatCalorieGoalSummary, type CalorieGoalFormState } from './settingsShared';

type SettingsCaloriesSectionProps = {
  calorieGoal: CalorieGoal;
  calorieGoalForm: CalorieGoalFormState;
  calorieGoalLoading: boolean;
  calorieGoalSaving: boolean;
  calorieGoalError: string | null;
  onFieldChange: (field: keyof CalorieGoalFormState, value: string) => void;
  onSave: () => void;
  onRevert: () => void;
};

export function SettingsCaloriesSection({
  calorieGoal,
  calorieGoalForm,
  calorieGoalLoading,
  calorieGoalSaving,
  calorieGoalError,
  onFieldChange,
  onSave,
  onRevert,
}: SettingsCaloriesSectionProps) {
  return (
    <ScreenSection>
      <SettingsSectionHeading
        eyebrow="Nutrition defaults"
        title="Daily calorie and macro goals"
        accentColor={SECTION_COLORS.calories}
      />
      <SettingsGroup accentColor={SECTION_COLORS.calories}>
        <SettingsRow
          first
          label="Saved goal"
          value={
            calorieGoalLoading
              ? 'Loading saved calorie and macro goals...'
              : formatCalorieGoalSummary(calorieGoal)
          }
          statusLabel={calorieGoalLoading ? 'Loading' : 'Saved'}
          statusTone={calorieGoalLoading ? 'neutral' : 'accent'}
          accentColor={SECTION_COLORS.calories}
        />
        <SettingsRow
          label="Where it shows up"
          value="The Calories screen uses this goal for daily progress and charts."
          explanation="Saved meals stay separate from the default goal."
          statusLabel="Calories"
          last
        />

        <View className="mt-4">
          <NumberStepperField
            label="Calories (kcal)"
            value={calorieGoalForm.calories}
            onChange={(value) => {
              onFieldChange('calories', value);
            }}
            min={500}
            max={6000}
          />
          <NumberStepperField
            label="Protein (g)"
            value={calorieGoalForm.protein}
            onChange={(value) => {
              onFieldChange('protein', value);
            }}
            min={0}
            max={999}
          />
          <NumberStepperField
            label="Carbs (g)"
            value={calorieGoalForm.carbs}
            onChange={(value) => {
              onFieldChange('carbs', value);
            }}
            min={0}
            max={999}
          />
          <NumberStepperField
            label="Fats (g)"
            value={calorieGoalForm.fats}
            onChange={(value) => {
              onFieldChange('fats', value);
            }}
            min={0}
            max={999}
          />
        </View>

        <ValidationError message={calorieGoalError} />

        {/* One primary action per state (§4.5), full width; Revert is a quiet
            ghost below so no label clips at 360/390. */}
        <View className="mt-2 gap-2">
          <Button
            label={calorieGoalSaving ? 'Saving...' : 'Save nutrition defaults'}
            onPress={onSave}
            disabled={calorieGoalLoading || calorieGoalSaving}
            color={SECTION_COLORS.calories}
            fullWidth
          />
          <Button
            label="Revert"
            variant="ghost"
            onPress={onRevert}
            disabled={calorieGoalLoading || calorieGoalSaving}
            fullWidth
          />
        </View>
      </SettingsGroup>
    </ScreenSection>
  );
}
