import { Pressable, Text } from 'react-native';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { Card } from '@/core/ui/Card';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { COMMAND_EXPERIMENT_ENABLED } from '@/features/command/types';
import { SettingsRow, SettingsSectionHeading } from './SettingsSharedUi';

type SettingsCommandSectionProps = {
  commandInternalRolloutAvailable: boolean;
  commandRolloutEnabledOnDevice: boolean;
  commandRolloutLoading: boolean;
  onOpenCommandCenter: () => void;
};

export function SettingsCommandSection({
  commandInternalRolloutAvailable,
  commandRolloutEnabledOnDevice,
  commandRolloutLoading,
  onOpenCommandCenter,
}: SettingsCommandSectionProps) {
  const { tokens } = useAppTheme();

  const effectiveParserLabel = commandRolloutLoading
    ? 'Loading'
    : commandInternalRolloutAvailable && commandRolloutEnabledOnDevice
      ? 'Model'
      : 'Mock';

  const effectiveParserDescription = commandInternalRolloutAvailable
    ? commandRolloutEnabledOnDevice
      ? 'Model-backed parsing is enabled on this device. You can turn it off in Developer / Internal to fall back to the mock parser immediately.'
      : 'The command shell still defaults to the local mock parser. Internal testers can opt in from Developer / Internal.'
    : 'This build keeps the command shell on the local mock parser only.';

  return (
    <ScreenSection>
      <SettingsSectionHeading
        eyebrow="AI / Command"
        title="Command center"
        subtitle="Status and entry point for the experimental command shell."
        icon="terminal"
        accentColor={tokens.textMuted}
      />
      <Card accentColor={tokens.textMuted} className="mb-0">
        <SettingsRow
          first
          label="Current scope"
          description="Command center drafts one todo or one habit from plain language, then waits for your review and confirmation before anything is saved."
          statusLabel="Experimental"
          statusTone="accent"
          accentColor={tokens.textMuted}
        />
        <SettingsRow
          label="Effective parser"
          description={effectiveParserDescription}
          statusLabel={effectiveParserLabel}
          statusTone={effectiveParserLabel === 'Model' ? 'accent' : 'neutral'}
          accentColor={tokens.textMuted}
        />
        <SettingsRow
          label="What it is not"
          description="This route is a command-focused shell for structured drafts. It is not a general-purpose assistant chat."
          statusLabel="Current"
          last
        />

        {COMMAND_EXPERIMENT_ENABLED ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open command center from settings"
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
              Open command center
            </Text>
          </Pressable>
        ) : null}
      </Card>
    </ScreenSection>
  );
}
