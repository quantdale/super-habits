import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, View, type TextStyle } from 'react-native';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, size, spacing, typography } from '@/core/theme/designTokens';
import { readableAccent, readableSurface } from '@/core/theme/contrast';
import { Pressable3D, type Pressable3DLip } from '@/core/ui/Pressable3D';
import { REWARD_HUES } from '@/constants/sectionColors';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | /** Celebration-scale tactile treatment (gamification milestones). */ 'celebrate';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Overrides the primary fill (keeps contrast enforcement). */
  color?: string;
  size?: ButtonSize;
  icon?: keyof typeof MaterialIcons.glyphMap;
  disabled?: boolean;
  /** Shows an inline spinner instead of the label and suppresses presses. */
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
};

/** Deterministic per-channel shade of a hex color; non-hex values pass through. */
function shade(color: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const channel = (offset: number) =>
    Math.max(0, Math.round(Number.parseInt(color.slice(offset, offset + 2), 16) * amount))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/**
 * Size → geometry plus the type role that paints the label (§5.5/§6). The
 * compact face uses the `label` role; `md`/`lg` use the `button` role, with
 * `lg` one step up ("16/20 (lg 17)") rather than a second hand-picked size.
 * `lip` is the §5.7 slab depth under the face: sm 36+2, md 44+3, lg 52+4.
 */
const SIZES: Record<
  ButtonSize,
  { height: number; lip: Pressable3DLip; padding: number; label: TextStyle }
> = {
  sm: { height: 36, lip: 2, padding: spacing.md, label: typography.label },
  md: { height: size.buttonHeight, lip: 3, padding: spacing.lg, label: typography.button },
  lg: {
    height: size.buttonHeightLg,
    lip: 4,
    padding: spacing.xl,
    label: { ...typography.button, fontSize: typography.button.fontSize + 1 },
  },
};

/** Leading icon size for a button label: a step above the text, per §6 ("icon 20"). */
function iconSizeFor(label: TextStyle): number {
  const fontSize = typeof label.fontSize === 'number' ? label.fontSize : 16;
  return Math.round(fontSize) + 4;
}

/**
 * Minimum logical-point interactive target (WCAG/HIG): a control's touch area
 * must reach 44 even when its visible face is smaller. The `sm` face is 36pt,
 * so it carries vertical hitSlop of 4pt top+bottom (36 + 8 = 44). Horizontal
 * slop is deliberately zero so adjacent compact controls never produce
 * ambiguous overlapping targets. `md`/`lg` already meet 44 visually.
 */
const COMPACT_TOUCH_TARGET = 44;
const SM_TOUCH_SLOP_VERTICAL = (COMPACT_TOUCH_TARGET - SIZES.sm.height) / 2;

/**
 * The v2 action hierarchy (Playful Momentum §6): the chunky lip slab, flat
 * solid fills, no gradient.
 *
 * **One primary per screen** (§4 "one dominant action per state"): a view
 * renders at most one `primary` Button — the screen's one loud action.
 * Supporting actions use `secondary`, quiet/dismiss paths `ghost`, destructive
 * confirms `danger`, and `celebrate` is reserved for gamification reward CTAs
 * (Gold face, ink label).
 *
 * Every variant rides `Pressable3D` (§5.7): face down into the lip on press
 * (80ms down / 120ms up), reduced motion = opacity only. Disabled/loading
 * (§5.7) = sunken face, subtle label, neutral lip.
 */
export function Button({
  label,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  color,
  size: sizeRole = 'md',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  className,
}: ButtonProps) {
  const { tokens } = useAppTheme();
  const inactive = disabled || loading;
  const metrics = SIZES[sizeRole];
  const isCelebration = variant === 'celebrate';
  const solid = variant === 'primary' || variant === 'danger' || isCelebration;

  // A caller-supplied hue paints the solid face carrying white text; deepen it
  // until the label clears WCAG AA (section hues measure ~4.2:1 as-is).
  const face = color ?? (variant === 'danger' ? tokens.dangerSolid : tokens.button);
  const solidFace = solid && color ? readableSurface(face, tokens.buttonText) : face;

  const faceColor = inactive
    ? tokens.surfaceSunken
    : variant === 'secondary'
      ? tokens.surface
      : variant === 'ghost'
        ? 'transparent'
        : isCelebration && !color
          ? REWARD_HUES.accent.bright
          : solidFace;
  const lipColor = inactive
    ? tokens.border
    : variant === 'secondary'
      ? tokens.borderStrong
      : variant === 'ghost'
        ? 'transparent'
        : isCelebration && !color
          ? REWARD_HUES.accent.lip
          : solidFace === tokens.button
            ? tokens.buttonLip
            : shade(solidFace, 0.76);
  const labelColor = inactive
    ? tokens.textSubtle
    : isCelebration && !color
      ? REWARD_HUES.accent.text
      : solid
        ? tokens.buttonText
        : readableAccent(
            color ?? tokens.button,
            variant === 'ghost' ? tokens.background : tokens.surface,
          );

  return (
    <View className={className} style={{ alignSelf: fullWidth ? 'stretch' : 'flex-start' }}>
      <Pressable3D
        lip={metrics.lip}
        faceColor={faceColor}
        lipColor={lipColor}
        radius={sizeRole === 'sm' ? radius.sm : radius.md}
        disabled={inactive}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: inactive, busy: loading }}
        hitSlop={
          sizeRole === 'sm'
            ? { top: SM_TOUCH_SLOP_VERTICAL, bottom: SM_TOUCH_SLOP_VERTICAL }
            : undefined
        }
        faceStyle={
          variant === 'secondary' ? { borderWidth: 2, borderColor: tokens.border } : undefined
        }
        contentStyle={{
          minHeight: metrics.height,
          paddingHorizontal: metrics.padding,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={labelColor} />
        ) : (
          <>
            {icon ? (
              <MaterialIcons name={icon} size={iconSizeFor(metrics.label)} color={labelColor} />
            ) : null}
            <Text
              // Sentence case by construction: the `button` role carries no
              // `textTransform`, so accessible names stay the product string.
              style={{
                ...metrics.label,
                color: labelColor,
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {label}
            </Text>
          </>
        )}
      </Pressable3D>
    </View>
  );
}
