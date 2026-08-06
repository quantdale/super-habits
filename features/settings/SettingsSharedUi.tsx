import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import type { SettingsStatusTone } from './settingsShared';

type SettingsRowProps = {
  label: string;
  description: string;
  statusLabel?: string;
  statusTone?: SettingsStatusTone;
  accentColor?: string;
  first?: boolean;
  last?: boolean;
};

type SettingsSectionHeadingProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accentColor: string;
};

export function SettingsStatusPill({
  label,
  tone = 'neutral',
  accentColor,
}: {
  label: string;
  tone?: SettingsStatusTone;
  accentColor?: string;
}) {
  const { tokens } = useAppTheme();
  const resolvedAccentColor = accentColor ?? tokens.textMuted;

  const backgroundColor =
    tone === 'accent'
      ? `${resolvedAccentColor}18`
      : tone === 'warning'
        ? tokens.warningBackground
        : tone === 'danger'
          ? tokens.dangerBackground
          : tokens.surfaceElevated;

  const textColor =
    tone === 'accent'
      ? resolvedAccentColor
      : tone === 'warning'
        ? tokens.warningText
        : tone === 'danger'
          ? tokens.dangerText
          : tokens.iconMuted;

  return (
    <View className="rounded-full px-3 py-1.5" style={{ backgroundColor }}>
      <Text
        className="text-[11px] font-semibold uppercase tracking-[1px]"
        style={{ color: textColor }}
      >
        {label}
      </Text>
    </View>
  );
}

export function SettingsRow({
  label,
  description,
  statusLabel,
  statusTone = 'neutral',
  accentColor,
  first = false,
  last = false,
}: SettingsRowProps) {
  const { tokens } = useAppTheme();

  return (
    <View
      className={[!first ? 'pt-3' : '', !last ? 'border-b pb-3' : ''].filter(Boolean).join(' ')}
      style={!last ? { borderColor: tokens.border } : undefined}
    >
      <View className="flex-row items-start gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            {label}
          </Text>
          <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
            {description}
          </Text>
        </View>
        {statusLabel ? (
          <SettingsStatusPill label={statusLabel} tone={statusTone} accentColor={accentColor} />
        ) : null}
      </View>
    </View>
  );
}

export function SettingsSectionHeading({
  eyebrow,
  title,
  subtitle,
  icon,
  accentColor,
}: SettingsSectionHeadingProps) {
  const { tokens } = useAppTheme();

  return (
    <View className="mb-3 flex-row items-start gap-3">
      <View
        className="h-12 w-12 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${accentColor}18` }}
      >
        <MaterialIcons name={icon} size={24} color={accentColor} />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="text-[11px] font-semibold uppercase tracking-[1.2px]"
          style={{ color: accentColor }}
        >
          {eyebrow}
        </Text>
        <Text className="mt-1 text-xl font-semibold" style={{ color: tokens.text }}>
          {title}
        </Text>
        <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
