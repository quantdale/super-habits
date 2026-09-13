import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { elevation, radius, spacing } from '@/core/theme/designTokens';
import { readableSurface } from '@/core/theme/contrast';

export type CardVariant = 'standard' | 'header' | 'stat';

type CardProps = {
  children: ReactNode;
  /** Tints the surface and its shadow with this hue — the Pop card identity. */
  accentColor?: string;
  className?: string;
  variant?: CardVariant;
  headerTitle?: string;
  /** Shown below `headerTitle` in the accent bar (header variant only). */
  headerSubtitle?: string;
  headerRight?: ReactNode;
  /** Merged onto the outer card `View` (border/elevation applied first). */
  style?: StyleProp<ViewStyle>;
  /** Standard variant only: replaces default inner padding when set (e.g. `p-0`). */
  innerClassName?: string;
  /** Uses the flat tinted treatment with no shadow (list rows, dense groups). */
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

/**
 * The Pop surface: generously rounded, softly colored, and floating in its own
 * hue. An `accentColor` tints both the fill and the shadow, so a Habits card
 * reads green and a Focus card reads violet at a glance.
 *
 * `header` keeps a saturated accent band above the body for cards that need a
 * title strip; `stat` is the compact numeric tile.
 */
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
  flat = false,
}: CardProps) {
  const { tokens } = useAppTheme();
  const extra = className?.trim() ?? '';
  const hasConsumerVerticalMargin = /\b(mb-|my-)/.test(extra);
  const marginClass = hasConsumerVerticalMargin ? '' : 'mb-4';

  const tint = accentColor ? withAlpha(accentColor, 0.1) : tokens.surface;
  const outline = accentColor ? withAlpha(accentColor, 0.28) : tokens.border;
  const shadow = accentColor ?? tokens.glow;

  const rootStyle: StyleProp<ViewStyle> = [
    { borderRadius: radius.lg, borderWidth: 1.5, borderColor: outline, backgroundColor: tint },
    flat
      ? null
      : {
          ...elevation.level1,
          shadowColor: shadow,
          shadowOpacity: 0.16,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
        },
    style,
  ];

  const rootClass = ['overflow-hidden', marginClass, extra].filter(Boolean).join(' ');

  if (variant === 'header') {
    // White text on a mid-tone section hue measures ~2.5:1; deepen the band
    // (hue preserved) until the title clears WCAG AA.
    const bandColor = readableSurface(accentColor ?? tokens.primary, tokens.onSolid);
    return (
      <View className={rootClass} style={rootStyle}>
        <View
          style={{
            backgroundColor: bandColor,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.md,
          }}
        >
          <View className="min-w-0 flex-1">
            {headerTitle ? (
              <Text variant="titleMd" style={{ color: tokens.onSolid }} numberOfLines={1}>
                {headerTitle}
              </Text>
            ) : null}
            {headerSubtitle ? (
              <Text
                variant="caption"
                style={{ color: tokens.onSolid, marginTop: 2 }}
                numberOfLines={2}
              >
                {headerSubtitle}
              </Text>
            ) : null}
          </View>
          {headerRight ? <View className="shrink-0">{headerRight}</View> : null}
        </View>
        <View className={innerClassName ?? 'p-4'}>{children}</View>
      </View>
    );
  }

  if (variant === 'stat') {
    return (
      <View
        className={['items-center', rootClass].filter(Boolean).join(' ')}
        style={[rootStyle, { paddingVertical: spacing.lg, paddingHorizontal: spacing.md }]}
      >
        {children}
      </View>
    );
  }

  return (
    <View className={rootClass} style={rootStyle}>
      <View className={innerClassName ?? 'p-[18px]'}>{children}</View>
    </View>
  );
}
