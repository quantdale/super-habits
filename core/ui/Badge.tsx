import { Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';

type BadgeTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'success';

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  /** Accent color used when tone is 'accent'. Defaults to the theme accent. */
  accentColor?: string;
};

/**
 * Additive shared primitive: a compact status badge for counts and states.
 * Complements (does not replace) feature-local pills such as
 * `SettingsStatusPill`.
 */
export function Badge({ label, tone = 'neutral', accentColor }: BadgeProps) {
  const { tokens } = useAppTheme();
  const resolvedAccent = accentColor ?? tokens.accent;

  const palette: Record<BadgeTone, { background: string; text: string }> = {
    neutral: { background: tokens.surfaceElevated, text: tokens.iconMuted },
    accent: { background: `${resolvedAccent}18`, text: resolvedAccent },
    warning: { background: tokens.warningBackground, text: tokens.warningText },
    danger: { background: tokens.dangerBackground, text: tokens.dangerText },
    success: { background: `${resolvedAccent}18`, text: resolvedAccent },
  };

  const colors = palette[tone];

  return (
    <View
      className="self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: colors.background }}
    >
      <Text
        className="text-[11px] font-semibold uppercase tracking-[0.8px]"
        style={{ color: colors.text }}
      >
        {label}
      </Text>
    </View>
  );
}
