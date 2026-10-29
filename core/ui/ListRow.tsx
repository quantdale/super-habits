import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing } from '@/core/theme/designTokens';

export type ListRowProps = {
  /** Row title — 700 weight (§7 rows). */
  title: string;
  /** Quiet second line. */
  subtitle?: string;
  /**
   * Leading slot (§6): a 40px icon tile (pass `icon` + `accentColor`) or a
   * CheckNode / custom node. A custom `leading` replaces the built-in tile.
   */
  leading?: ReactNode;
  /** Glyph for the built-in 40px icon tile. */
  icon?: keyof typeof MaterialIcons.glyphMap;
  /** Section solid (§5.1) — tints the icon tile and paints the glyph. */
  accentColor?: string;
  /** Trailing control / value / chevron slot. */
  trailing?: ReactNode;
  /** Row height; §6 rows are 52–60 (default 56). */
  height?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * ListRow (v2 §6): one 52–60px row inside a `ListGroup` — leading 40px icon
 * tile (section tint + solid glyph) or check node, 700 title with optional
 * caption, trailing accessory. Presentational: interaction lives in the
 * leading node or trailing control, so the row itself claims no press state.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  icon,
  accentColor,
  trailing,
  height = 56,
  className,
  style,
  testID,
}: ListRowProps) {
  const { tokens } = useAppTheme();

  return (
    <View
      testID={testID}
      className={['flex-row items-center gap-3 px-4', className].filter(Boolean).join(' ')}
      style={[{ minHeight: Math.min(60, Math.max(52, height)) }, style]}
    >
      {leading ??
        (icon ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: accentColor ? `${accentColor}24` : tokens.surfaceSunken,
            }}
          >
            <MaterialIcons name={icon} size={22} color={accentColor ?? tokens.textMuted} />
          </View>
        ) : null)}
      <View className="min-w-0 flex-1" style={{ gap: spacing.xs / 2 }}>
        <Text variant="bodyMd" className="font-bold" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View className="shrink-0">{trailing}</View> : null}
    </View>
  );
}
