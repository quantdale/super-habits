import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { cardDepth, flatDepth, radius, spacing } from '@/core/theme/designTokens';
import { CardInkContext } from '@/core/ui/cardInk';

/**
 * Card variants (docs/ui-ux/16-playful-momentum.md §5.7/§6):
 * - `flat`     — static info surface: white face, `depth.flat` (2px border,
 *   no lip, **no blur shadow**). This is the only depth a non-interactive
 *   surface may claim.
 * - `standard` — alias of `flat` (43 existing call sites keep working).
 * - `header`   — flat surface plus a quiet title row on the same surface.
 * - `stat`     — compact numeric tile (flat surface).
 * - `card`     — pressable-list surface: `depth.card` (2px ring + 4px
 *   `borderStrong` bottom lip). The Pressable3D half-pressed state is P5.
 * - `hero`     — the one emphasis surface a screen may own (≤1/screen):
 *   section **bright** face with ink text (default `faceTone="bright"`) or
 *   **solid** face with white text (`faceTone="solid"`), radius 20.
 * - `inset`    — plain sub-group container: no fill, no border (never a
 *   nested-card look).
 *
 * Bodies are never tinted and no card carries a blur shadow; depth comes from
 * P3's `depth` tokens only (§5.7).
 */
export type CardVariant = 'flat' | 'card' | 'standard' | 'header' | 'stat' | 'hero' | 'inset';
export type CardFaceTone = 'bright' | 'solid';

/** Ink on a bright face (§5.1 "ink `#10131A` on bright"). */
const HERO_INK = '#10131A';

type CardProps = {
  children: ReactNode;
  /** Tints the border with this hue at low alpha (never the body). */
  accentColor?: string;
  className?: string;
  variant?: CardVariant;
  /** Hero only: bright face + ink text (default) or solid face + white text. */
  faceTone?: CardFaceTone;
  headerTitle?: string;
  /** Shown below `headerTitle` (header variant only). */
  headerSubtitle?: string;
  headerRight?: ReactNode;
  /** Merged onto the outer card `View` (border applied first). */
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
  faceTone = 'bright',
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
  const isPressableCard = variant === 'card';

  const backgroundColor = isHero
    ? (accentColor ?? tokens.primaryBright)
    : isInset
      ? 'transparent'
      : tokens.surface;
  const borderColor = accentColor && !isInset ? withAlpha(accentColor, 0.22) : tokens.border;

  const surfaceDepth = isInset
    ? null
    : isHero
      ? null
      : isPressableCard
        ? cardDepth({
            border: borderColor,
            borderStrong: tokens.borderStrong,
            surfaceElevated: tokens.surfaceElevated,
          })
        : flatDepth({
            border: borderColor,
            borderStrong: tokens.borderStrong,
            surfaceElevated: tokens.surfaceElevated,
          });

  const rootStyle: StyleProp<ViewStyle> = [
    {
      borderRadius: radius.lg,
      backgroundColor,
    },
    surfaceDepth,
    style,
  ];

  const rootClass = ['overflow-hidden', marginClass, extra].filter(Boolean).join(' ');

  if (variant === 'header' || (headerTitle && (variant === 'standard' || variant === 'flat'))) {
    // Quiet title row on the same surface — the title carries the hierarchy;
    // no band, no white-on-hue contrast risk.
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

  if (isHero) {
    // §6 hero: colored face, ink text (bright) or white text (solid), the one
    // illustration/mascot slot a screen may own. No shadow, no tint wash.
    const ink = faceTone === 'solid' ? tokens.onSolid : HERO_INK;
    return (
      <CardInkContext.Provider value={ink}>
        <View className={rootClass} style={rootStyle}>
          <View className={innerClassName ?? 'p-5'}>{children}</View>
        </View>
      </CardInkContext.Provider>
    );
  }

  return (
    <View className={rootClass} style={rootStyle}>
      <View className={innerClassName ?? 'p-4'}>{children}</View>
    </View>
  );
}
