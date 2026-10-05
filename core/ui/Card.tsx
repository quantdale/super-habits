import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { elevation, radius, spacing } from '@/core/theme/designTokens';

/**
 * Card variants (docs/ui-ux/13 §3/§8):
 * - `standard` — default grouping surface: flat fill one step from canvas,
 *   hairline border, no shadow.
 * - `header`   — standard surface plus a quiet title row on the same surface
 *   (the Pop saturated band is retired; 43 existing call sites keep working).
 * - `stat`     — compact numeric tile.
 * - `hero`     — the one emphasis surface a screen may own: section tint at
 *   low alpha, radius 24 (xl), level-2 elevation.
 * - `inset`    — sub-group inside a surface: sunken fill, no border, no shadow.
 *
 * An `accentColor` tints fill/border subtly; it no longer colors the shadow.
 */
export type CardVariant = 'standard' | 'header' | 'stat' | 'hero' | 'inset';

type CardProps = {
  children: ReactNode;
  /** Tints the surface/border with this hue at low alpha (no colored shadow). */
  accentColor?: string;
  className?: string;
  variant?: CardVariant;
  headerTitle?: string;
  /** Shown below `headerTitle` (header variant only). */
  headerSubtitle?: string;
  headerRight?: ReactNode;
  /** Merged onto the outer card `View` (border/elevation applied first). */
  style?: StyleProp<ViewStyle>;
  /** Standard/header variants: replaces default inner padding when set (e.g. `p-0`). */
  innerClassName?: string;
  /** Accepted for compatibility; V3 cards are flat by default and this is a no-op. */
  flat?: boolean;
};

/** Adds an alpha channel to a hex color; non-hex values pass through. */
function withAlpha(color: string, opacity: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export function Card({
  children,
  accentColor,
  className,
  variant = 'standard',
  headerTitle,
  headerSubtitle,
  headerRight,
  style,
  innerClassName,
}: CardProps) {
  const { tokens } = useAppTheme();
  const extra = className?.trim() ?? '';
  const hasConsumerVerticalMargin = /\b(mb-|my-)/.test(extra);
  const marginClass = hasConsumerVerticalMargin ? '' : 'mb-4';

  const isHero = variant === 'hero';
  const isInset = variant === 'inset';

  const backgroundColor = isHero
    ? withAlpha(accentColor ?? tokens.primary, 0.12)
    : isInset
      ? tokens.surfaceSunken
      : accentColor
        ? withAlpha(accentColor, 0.06)
        : tokens.surface;
  const borderColor = isInset
    ? 'transparent'
    : accentColor
      ? withAlpha(accentColor, 0.22)
      : tokens.border;

  const rootStyle: StyleProp<ViewStyle> = [
    {
      borderRadius: isHero ? radius.xl : radius.lg,
      borderWidth: isInset ? 0 : 1,
      borderColor,
      backgroundColor,
    },
    isHero ? elevation.level2 : null,
    style,
  ];

  const rootClass = ['overflow-hidden', marginClass, extra].filter(Boolean).join(' ');

  if (variant === 'header' || (headerTitle && variant === 'standard')) {
    // Quiet title row on the same surface — V3 replaces Pop's saturated band.
    // The title carries the hierarchy; no band, no white-on-hue contrast risk.
    return (
      <View className={rootClass} style={rootStyle}>
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: headerTitle && headerSubtitle ? spacing.xs : 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.md,
          }}
        >
          <View className="min-w-0 flex-1">
            {headerTitle ? (
              <Text variant="titleMd" style={{ color: tokens.text }} numberOfLines={1}>
                {headerTitle}
              </Text>
            ) : null}
            {headerSubtitle ? (
              <Text variant="caption" tone="muted" style={{ marginTop: 2 }} numberOfLines={2}>
                {headerSubtitle}
              </Text>
            ) : null}
          </View>
          {headerRight ? <View className="shrink-0">{headerRight}</View> : null}
        </View>
        <View className={innerClassName ?? 'p-4 pt-3'}>{children}</View>
      </View>
    );
  }

  if (variant === 'stat') {
    return (
      <View
        className={['items-center', rootClass].filter(Boolean).join(' ')}
        style={[rootStyle, { paddingVertical: spacing.md, paddingHorizontal: spacing.md }]}
      >
        {children}
      </View>
    );
  }

  return (
    <View className={rootClass} style={rootStyle}>
      <View className={innerClassName ?? 'p-4'}>{children}</View>
    </View>
  );
}
