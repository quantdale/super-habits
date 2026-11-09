import { View } from 'react-native';
import type { ResolvedTheme, ThemeMode } from '@/core/providers/themeContext';
import { useAppTheme } from '@/core/providers/themeContext';
import { DARK_THEME_IDS, LIGHT_THEME_IDS, THEME_REGISTRY, type ThemeId } from '@/core/theme';
import { OptionRow } from '@/core/ui/OptionRow';
import { PillChip } from '@/core/ui/PillChip';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { Text } from '@/core/ui/Text';
import { ThemePreviewCard } from '@/core/ui/ThemePreviewCard';
import { spacing } from '@/core/theme/designTokens';
import { SettingsGroup, SettingsRow, SettingsSectionHeading } from './SettingsSharedUi';

const THEME_OPTIONS: {
  mode: ThemeMode;
  label: string;
  /** Reachable detail; the visible surface shows only the state. */
  description: string;
}[] = [
  {
    mode: 'system',
    label: 'System',
    description: 'Follow your device appearance setting automatically.',
  },
  {
    mode: 'light',
    label: 'Light',
    description: 'Always use the light theme, even when the device is in dark mode.',
  },
  {
    mode: 'dark',
    label: 'Dark',
    description: 'Always use the dark theme, even when the device is in light mode.',
  },
];

function getAppearanceSummary(mode: ThemeMode, resolvedTheme: ResolvedTheme) {
  if (mode === 'system') {
    return {
      summary: `Following your device setting. ${resolvedTheme[0].toUpperCase() + resolvedTheme.slice(1)} mode is active right now.`,
      detail: 'System mode updates automatically when your device appearance changes.',
    };
  }

  return {
    summary: `Using ${mode} mode across the app.`,
    detail: `super-habits will stay in ${mode} mode until you change it here.`,
  };
}

type SettingsAppearanceSectionProps = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  themeId: ThemeId;
  onSelectMode: (mode: ThemeMode) => void;
  onSelectTheme: (themeId: ThemeId) => void;
};

/**
 * Settings → Appearance (Playful Momentum §7: bold group titles, rows in
 * `depth.flat` groups, theme picker = OptionRows with live mini-previews, no
 * narration paragraphs).
 *
 * The mode control deliberately stays a `Chip` row: it is a two/three-way
 * toggle the existing specs address as `button` + `aria-pressed`
 * (`getByRole('button', { name: 'Dark', exact: true })`), and turning a toggle
 * into a radio group would change that accessible contract. The theme pickers
 * are `OptionRow`s — a genuine one-of-N choice — with the theme's own colours
 * as the trailing live preview.
 */
export function SettingsAppearanceSection({
  mode,
  resolvedTheme,
  themeId,
  onSelectMode,
  onSelectTheme,
}: SettingsAppearanceSectionProps) {
  const { tokens } = useAppTheme();
  const appearanceCopy = getAppearanceSummary(mode, resolvedTheme);
  const themeModeDescription = THEME_OPTIONS.find((option) => option.mode === mode)?.description;

  return (
    <ScreenSection>
      <SettingsSectionHeading
        eyebrow="Appearance"
        title="Theme and display"
        accentColor={tokens.textMuted}
      />

      <SettingsGroup>
        <View
          style={{
            paddingBottom: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: tokens.border,
          }}
        >
          <Text variant="bodyMd" className="font-bold">
            Theme mode
          </Text>
          <View className="mt-2 flex-row flex-wrap">
            {THEME_OPTIONS.map((option) => (
              <PillChip
                key={option.mode}
                label={option.label}
                active={mode === option.mode}
                color={tokens.textMuted}
                onPress={() => onSelectMode(option.mode)}
              />
            ))}
          </View>
        </View>

        {/* SUR-08: the theme value is stated by the chips' selected state and
            this single row — not restated by `Current selection` +
            `Current behavior` rows. */}
        <SettingsRow
          label="Current appearance"
          value={`${appearanceCopy.summary} Active theme: ${THEME_REGISTRY[themeId]?.name ?? themeId}.`}
          explanation={themeModeDescription}
          statusLabel={mode}
          statusTone="accent"
          accentColor={tokens.textMuted}
          last
        />
      </SettingsGroup>

      <View className="mt-6">
        <Text variant="bodyMd" className="font-bold">
          Day theme
        </Text>
        <View className="mt-2" style={{ gap: spacing.sm }}>
          {LIGHT_THEME_IDS.map((id) => {
            const theme = THEME_REGISTRY[id];
            return (
              <OptionRow
                key={id}
                label={theme.name}
                selected={themeId === id}
                onPress={() => onSelectTheme(id)}
                accentColor={tokens.accent}
                accessibilityLabel={`${theme.name}, ${theme.appearance} theme`}
              >
                <ThemePreviewCard theme={theme} selected={themeId === id} />
              </OptionRow>
            );
          })}
        </View>
      </View>

      <View className="mt-6">
        <Text variant="bodyMd" className="font-bold">
          Night theme
        </Text>
        <View className="mt-2" style={{ gap: spacing.sm }}>
          {DARK_THEME_IDS.map((id) => {
            const theme = THEME_REGISTRY[id];
            return (
              <OptionRow
                key={id}
                label={theme.name}
                selected={themeId === id}
                onPress={() => onSelectTheme(id)}
                accentColor={tokens.accent}
                accessibilityLabel={`${theme.name}, ${theme.appearance} theme`}
              >
                <ThemePreviewCard theme={theme} selected={themeId === id} />
              </OptionRow>
            );
          })}
        </View>
      </View>
    </ScreenSection>
  );
}
