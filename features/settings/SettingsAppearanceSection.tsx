import { Text, View } from 'react-native';
import type { ResolvedTheme, ThemeMode } from '@/core/providers/ThemeProvider';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { DARK_THEME_IDS, LIGHT_THEME_IDS, THEME_REGISTRY, type ThemeId } from '@/core/theme';
import { Card } from '@/core/ui/Card';
import { PillChip } from '@/core/ui/PillChip';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { ThemePreviewCard } from '@/core/ui/ThemePreviewCard';
import { SettingsRow, SettingsSectionHeading } from './SettingsSharedUi';

const THEME_OPTIONS: {
  mode: ThemeMode;
  label: string;
  description: string;
}[] = [
  {
    mode: 'system',
    label: 'System',
    description: 'Follow your device setting automatically.',
  },
  {
    mode: 'light',
    label: 'Light',
    description: 'Always use the light theme.',
  },
  {
    mode: 'dark',
    label: 'Dark',
    description: 'Always use the dark theme.',
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
    detail: `SuperHabits will stay in ${mode} mode until you change it here.`,
  };
}

type SettingsAppearanceSectionProps = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  themeId: ThemeId;
  onSelectMode: (mode: ThemeMode) => void;
  onSelectTheme: (themeId: ThemeId) => void;
};

export function SettingsAppearanceSection({
  mode,
  resolvedTheme,
  themeId,
  onSelectMode,
  onSelectTheme,
}: SettingsAppearanceSectionProps) {
  const { tokens } = useAppTheme();
  const appearanceCopy = getAppearanceSummary(mode, resolvedTheme);

  return (
    <ScreenSection>
      <SettingsSectionHeading
        eyebrow="Appearance"
        title="Theme and display"
        subtitle="Visual preferences that apply across the app."
        icon="palette"
        accentColor={tokens.textMuted}
      />
      <Card accentColor={tokens.textMuted} className="mb-0">
        <View className="gap-4">
          <View>
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              Theme mode
            </Text>
            <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
              Choose how SuperHabits should look on this device.
            </Text>
          </View>

          <View className="flex-row flex-wrap">
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

          <SettingsRow
            first
            label="Current selection"
            description={`${THEME_OPTIONS.find((option) => option.mode === mode)?.description} ${appearanceCopy.detail}`}
            statusLabel={mode}
            statusTone="accent"
            accentColor={tokens.textMuted}
          />
          <SettingsRow
            label="Current behavior"
            description={`${appearanceCopy.summary} Active theme: ${THEME_REGISTRY[themeId]?.name ?? themeId}.`}
            statusLabel={resolvedTheme}
            last
          />
        </View>
      </Card>

      <Card accentColor={tokens.textMuted} className="mb-0">
        <View className="gap-4">
          <View>
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              Day theme
            </Text>
            <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
              Used whenever the resolved appearance is light.
              {mode === 'dark' ? ' Switch to System or Light mode to see it applied now.' : ''}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {LIGHT_THEME_IDS.map((id) => (
              <ThemePreviewCard
                key={id}
                theme={THEME_REGISTRY[id]}
                selected={themeId === id}
                onPress={() => onSelectTheme(id)}
              />
            ))}
          </View>
        </View>
      </Card>

      <Card accentColor={tokens.textMuted} className="mb-0">
        <View className="gap-4">
          <View>
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              Night theme
            </Text>
            <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
              Used whenever the resolved appearance is dark.
              {mode === 'light' ? ' Switch to System or Dark mode to see it applied now.' : ''}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {DARK_THEME_IDS.map((id) => (
              <ThemePreviewCard
                key={id}
                theme={THEME_REGISTRY[id]}
                selected={themeId === id}
                onPress={() => onSelectTheme(id)}
              />
            ))}
          </View>
        </View>
      </Card>
    </ScreenSection>
  );
}
