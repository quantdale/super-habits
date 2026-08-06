import { Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { ValidationError } from '@/core/ui/ValidationError';
import { SettingsRow, SettingsSectionHeading } from './SettingsSharedUi';

const INTERNAL_ACCENT = '#7c2d12';

type SettingsDeveloperSectionProps = {
  commandInternalRolloutAvailable: boolean;
  commandRolloutEnabledOnDevice: boolean;
  commandRolloutLoading: boolean;
  commandRolloutError: string | null;
  onToggleParserRollout: (enabled: boolean) => void;
};

export function SettingsDeveloperSection({
  commandInternalRolloutAvailable,
  commandRolloutEnabledOnDevice,
  commandRolloutLoading,
  commandRolloutError,
  onToggleParserRollout,
}: SettingsDeveloperSectionProps) {
  const { tokens } = useAppTheme();

  return (
    <ScreenSection className="mb-0">
      <SettingsSectionHeading
        eyebrow="Developer / Internal"
        title="Rollout and diagnostics"
        subtitle="Internal controls stay here so they do not compete with normal settings."
        icon="build"
        accentColor={INTERNAL_ACCENT}
      />
      <Card accentColor={INTERNAL_ACCENT} className="mb-0">
        <View
          className="rounded-2xl border px-4 py-3"
          style={{
            borderColor: tokens.dangerBorder,
            backgroundColor: tokens.dangerBackground,
          }}
        >
          <Text
            className="text-[11px] font-semibold uppercase tracking-[1.1px]"
            style={{ color: tokens.dangerText }}
          >
            Internal only
          </Text>
          <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
            These controls and notes are for rollout testing and product diagnostics, not everyday
            setup.
          </Text>
        </View>

        <View className="mt-4">
          <SettingsRow
            first
            label="Internal parser rollout"
            description={
              commandInternalRolloutAvailable
                ? 'This build can test the model-backed parser with a device-local preference.'
                : 'This build does not expose the internal model parser rollout controls.'
            }
            statusLabel={commandInternalRolloutAvailable ? 'Available' : 'Unavailable'}
            statusTone={commandInternalRolloutAvailable ? 'accent' : 'warning'}
            accentColor={INTERNAL_ACCENT}
          />
          <SettingsRow
            label="Device preference"
            description={
              commandRolloutLoading
                ? 'Loading the saved internal parser preference for this device...'
                : commandRolloutEnabledOnDevice
                  ? 'Model-backed parsing is enabled on this device. Turn it off here to return to the mock parser immediately.'
                  : 'Model-backed parsing is disabled on this device. The command shell stays on the mock parser until you opt in here.'
            }
            statusLabel={
              commandRolloutLoading
                ? 'Loading'
                : commandRolloutEnabledOnDevice
                  ? 'Enabled'
                  : 'Disabled'
            }
            statusTone={
              commandRolloutLoading
                ? 'neutral'
                : commandRolloutEnabledOnDevice
                  ? 'accent'
                  : 'neutral'
            }
            accentColor={INTERNAL_ACCENT}
          />
          <SettingsRow
            label="Linked Actions editor"
            description="Create or edit a habit to manage linked rules. Applied rules still surface through the in-app notice banner."
            statusLabel="Habits"
            last
          />
        </View>

        <ValidationError message={commandRolloutError} />

        {commandInternalRolloutAvailable ? (
          <View className="mt-2 gap-2">
            <Button
              label={commandRolloutLoading ? 'Saving...' : 'Enable model parser'}
              onPress={() => onToggleParserRollout(true)}
              disabled={commandRolloutLoading || commandRolloutEnabledOnDevice}
              color={INTERNAL_ACCENT}
            />
            <Button
              label={commandRolloutLoading ? 'Saving...' : 'Use mock parser only'}
              onPress={() => onToggleParserRollout(false)}
              variant="ghost"
              disabled={commandRolloutLoading || !commandRolloutEnabledOnDevice}
            />
          </View>
        ) : null}
      </Card>
    </ScreenSection>
  );
}
