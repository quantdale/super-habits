import { View } from 'react-native';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { NumberStepperField } from '@/core/ui/NumberStepperField';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { ValidationError } from '@/core/ui/ValidationError';
import { SECTION_COLORS } from '@/constants/sectionColors';
import type { CalorieGoal } from '@/features/calories/types';
import { formatCalorieGoalSummary, type CalorieGoalFormState } from './settingsShared';
import { SettingsRow, SettingsSectionHeading } from './SettingsSharedUi';

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
        subtitle="Saved defaults for the Calories feature."
        icon="local-dining"
        accentColor={SECTION_COLORS.calories}
      />
      <Card accentColor={SECTION_COLORS.calories} className="mb-0">
        <SettingsRow
          first
          label="Saved goal"
          description={
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
          description="The Calories screen uses this goal for daily progress and charts. Saved meals stay separate from the default goal."
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

        <View className="mt-2 flex-row gap-2">
          <View className="flex-1">
            <Button
              label={calorieGoalSaving ? 'Saving...' : 'Save nutrition defaults'}
              onPress={onSave}
              disabled={calorieGoalLoading || calorieGoalSaving}
              color={SECTION_COLORS.calories}
            />
          </View>
          <View className="flex-1">
            <Button
              label="Revert"
              variant="ghost"
              onPress={onRevert}
              disabled={calorieGoalLoading || calorieGoalSaving}
            />
          </View>
        </View>
      </Card>
    </ScreenSection>
  );
}
