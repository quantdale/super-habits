import { View } from 'react-native';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { NumberStepperField } from '@/core/ui/NumberStepperField';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { ValidationError } from '@/core/ui/ValidationError';
import { POMODORO_SECTION_KEY, SECTION_COLORS } from '@/constants/sectionColors';
import type { PomodoroSettings } from '@/features/pomodoro/pomodoro.domain';
import { formatPomodoroSummary, type PomodoroFormState } from './settingsShared';
import { SettingsRow, SettingsSectionHeading } from './SettingsSharedUi';

type SettingsPomodoroSectionProps = {
  pomodoroSettings: PomodoroSettings;
  pomodoroForm: PomodoroFormState;
  pomodoroLoading: boolean;
  pomodoroSaving: boolean;
  pomodoroError: string | null;
  onFieldChange: (field: keyof PomodoroFormState, value: string) => void;
  onSave: () => void;
  onRevert: () => void;
};

export function SettingsPomodoroSection({
  pomodoroSettings,
  pomodoroForm,
  pomodoroLoading,
  pomodoroSaving,
  pomodoroError,
  onFieldChange,
  onSave,
  onRevert,
}: SettingsPomodoroSectionProps) {
  return (
    <ScreenSection>
      <SettingsSectionHeading
        eyebrow="Notifications / Timer defaults"
        title="Focus defaults"
        subtitle="Save your timer defaults here. Notification behavior still lives with the Focus flow."
        icon="timer"
        accentColor={SECTION_COLORS[POMODORO_SECTION_KEY]}
      />
      <Card accentColor={SECTION_COLORS[POMODORO_SECTION_KEY]} className="mb-0">
        <SettingsRow
          first
          label="Saved timer sequence"
          description={
            pomodoroLoading
              ? 'Loading saved timer defaults...'
              : formatPomodoroSummary(pomodoroSettings)
          }
          statusLabel={pomodoroLoading ? 'Loading' : 'Saved'}
          statusTone={pomodoroLoading ? 'neutral' : 'accent'}
          accentColor={SECTION_COLORS[POMODORO_SECTION_KEY]}
        />
        <SettingsRow
          label="Notification behavior"
          description="On iOS and Android, the Focus timer can request notification permission and schedule end-of-timer alerts. Web does not schedule native timer notifications."
          statusLabel="Focus"
          last
        />

        <View className="mt-4">
          <NumberStepperField
            label="Focus minutes"
            value={pomodoroForm.focusMinutes}
            onChange={(value) => {
              onFieldChange('focusMinutes', value);
            }}
            min={1}
            max={120}
          />
          <NumberStepperField
            label="Short break minutes"
            value={pomodoroForm.shortBreakMinutes}
            onChange={(value) => {
              onFieldChange('shortBreakMinutes', value);
            }}
            min={1}
            max={60}
          />
          <NumberStepperField
            label="Long break minutes"
            value={pomodoroForm.longBreakMinutes}
            onChange={(value) => {
              onFieldChange('longBreakMinutes', value);
            }}
            min={1}
            max={120}
          />
          <NumberStepperField
            label="Focus sessions before long break"
            value={pomodoroForm.sessionsBeforeLongBreak}
            onChange={(value) => {
              onFieldChange('sessionsBeforeLongBreak', value);
            }}
            min={2}
            max={10}
          />
        </View>

        <ValidationError message={pomodoroError} />

        <View className="mt-2 flex-row gap-2">
          <View className="flex-1">
            <Button
              label={pomodoroSaving ? 'Saving...' : 'Save timer defaults'}
              onPress={onSave}
              disabled={pomodoroLoading || pomodoroSaving}
              color={SECTION_COLORS[POMODORO_SECTION_KEY]}
            />
          </View>
          <View className="flex-1">
            <Button
              label="Revert"
              variant="ghost"
              onPress={onRevert}
              disabled={pomodoroLoading || pomodoroSaving}
            />
          </View>
        </View>
      </Card>
    </ScreenSection>
  );
}
