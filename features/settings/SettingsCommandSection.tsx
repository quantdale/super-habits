import { Pressable, Text } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { COMMAND_EXPERIMENT_ENABLED } from '@/features/command/types';
import { SettingsRow, SettingsSectionHeading } from './SettingsSharedUi';

type SettingsCommandSectionProps = {
  onOpenCommandCenter: () => void;
};

export function SettingsCommandSection({ onOpenCommandCenter }: SettingsCommandSectionProps) {
  const { tokens } = useAppTheme();

  return (
    <ScreenSection>
      <SettingsSectionHeading
        eyebrow="Capture"
        title="Advanced capture"
        subtitle="Describe what you want to add in plain language, then review the draft before saving."
        icon="edit-note"
        accentColor={tokens.textMuted}
      />
      <Card accentColor={tokens.textMuted} className="mb-0">
        <SettingsRow
          first
          label="Describe it"
          description="Write a task, habit, meal, workout, or focus action naturally. SuperHabits prepares a draft and waits for your review before anything is saved."
          statusLabel="Optional"
          statusTone="accent"
          accentColor={tokens.textMuted}
        />
        <SettingsRow
          label="Default path"
          description="Use the global Add button for ordinary capture. Choose Describe it inside Add when you want the advanced capture flow."
          statusLabel="Add"
          last
        />

        {COMMAND_EXPERIMENT_ENABLED ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open advanced capture from settings"
            className="mt-4 rounded-2xl px-4 py-3"
            style={{
              backgroundColor: tokens.textMuted,
              shadowColor: tokens.shadowColor,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 1,
            }}
            onPress={onOpenCommandCenter}
          >
            <Text
              className="text-center text-sm font-semibold"
              style={{ color: tokens.textOnAccent }}
            >
              Open advanced capture
            </Text>
          </Pressable>
        ) : null}
      </Card>
    </ScreenSection>
  );
}
