import { Text } from '@/core/ui/Text';
import { Pressable } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { readableSurface } from '@/core/theme/contrast';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { COMMAND_EXPERIMENT_ENABLED } from '@/features/command/types';
import { SettingsGroup, SettingsRow, SettingsSectionHeading } from './SettingsSharedUi';

type SettingsCommandSectionProps = {
  onOpenCommandCenter: () => void;
};

/**
 * Settings → Capture (Playful Momentum §7: bold group title, rows in a
 * `depth.flat` group, no narration paragraphs).
 *
 * The two rows state what "Describe it" is and which capture path is the
 * default; the supporting sentences live in Details instead of standing in
 * front of the control.
 */
export function SettingsCommandSection({ onOpenCommandCenter }: SettingsCommandSectionProps) {
  const { tokens } = useAppTheme();

  return (
    <ScreenSection>
      <SettingsSectionHeading
        eyebrow="Capture"
        title="Advanced capture"
        accentColor={tokens.textMuted}
      />
      <SettingsGroup>
        <SettingsRow
          label="Describe it"
          value="Write a task, habit, meal, workout, or focus action naturally."
          explanation="super-habits prepares a draft and waits for your review before anything is saved."
          statusLabel="Optional"
          statusTone="accent"
          accentColor={tokens.textMuted}
        />
        <SettingsRow
          label="Default path"
          value="Use the global Add button for ordinary capture."
          explanation="Choose Describe it inside Add when you want the advanced capture flow."
          statusLabel="Add"
          last
        />

        {COMMAND_EXPERIMENT_ENABLED ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open advanced capture from settings"
            className="mt-4 items-center justify-center"
            style={{
              // textMuted is a text-role token: in dark themes it lightens past
              // AA against fixed light label text. Deepen the fill until
              // textOnAccent clears 4.5 while keeping the hue; no-op where it
              // already passes (light).
              backgroundColor: readableSurface(tokens.textMuted, tokens.textOnAccent),
              borderRadius: 16,
              minHeight: 44,
              paddingHorizontal: 16,
            }}
            onPress={onOpenCommandCenter}
          >
            <Text variant="button" style={{ color: tokens.textOnAccent }}>
              Open advanced capture
            </Text>
          </Pressable>
        ) : null}
      </SettingsGroup>
    </ScreenSection>
  );
}
