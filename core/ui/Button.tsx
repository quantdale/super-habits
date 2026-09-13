import { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Animated, Pressable, View } from 'react-native';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { useReducedMotion } from '@/core/theme/motion';
import { radius, size, spacing, springs, typography } from '@/core/theme/designTokens';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import { readableSurface } from '@/core/theme/contrast';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Overrides the primary fill (keeps the 3D lip derived from it). */
  color?: string;
  size?: ButtonSize;
  icon?: keyof typeof MaterialIcons.glyphMap;
  disabled?: boolean;
  /** Shows an inline spinner instead of the label and suppresses presses. */
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
};

/** Height of the 3D lip under the button face. */
const LIP_HEIGHT = 5;

/** Deterministic per-channel shade of a hex color; non-hex values pass through. */
function shade(color: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const channel = (offset: number) =>
    Math.max(0, Math.round(Number.parseInt(color.slice(offset, offset + 2), 16) * amount))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

const SIZES: Record<ButtonSize, { height: number; padding: number; fontSize: number }> = {
  sm: { height: 44, padding: spacing.lg, fontSize: 14 },
  md: { height: size.buttonHeight, padding: spacing.xl, fontSize: 16 },
  lg: { height: 64, padding: spacing.xxl, fontSize: 18 },
};

/**
 * The product's primary action: a chunky, tactile, gradient-faced button that
 * rests on a darker lip and sinks into it under the finger. This is the single
 * most recognisable element of the Pop language.
 *
 * Variants:
 * - `primary`  — brand gradient face, white label (the "do it" button);
 * - `secondary`— tinted chip face, brand label (the "also fine" button);
 * - `ghost`    — quiet surface with a hairline outline (dismiss / tertiary);
 * - `danger`   — solid danger face, white label.
 *
 * Reduced motion keeps the pressed state but removes the travel.
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
  const reducedMotion = useReducedMotion();
  const focusRing = useKeyboardFocusRing(tokens.accent);
  const [offset] = useState(() => new Animated.Value(0));
  const inactive = disabled || loading;
  const metrics = SIZES[sizeRole];

  // A caller-supplied hue paints the solid face carrying white text; deepen it
  // until the label clears WCAG AA (section hues measure ~4.2:1 as-is).
  const face = color ?? (variant === 'danger' ? tokens.dangerSolid : tokens.button);
  const solidFace =
    (variant === 'primary' || variant === 'danger') && color
      ? readableSurface(face, tokens.buttonText)
      : face;
  const gradient: readonly [string, string] =
    variant === 'primary' && !color ? tokens.brandGradient : [solidFace, solidFace];
  const lip = variant === 'ghost' ? tokens.surfaceActive : shade(solidFace, 0.76);
  const labelColor =
    variant === 'primary' || variant === 'danger'
      ? tokens.buttonText
      : variant === 'secondary'
        ? readableSurface(face, tokens.chipBackground)
        : tokens.text;

  const settle = (toValue: number) => {
    if (reducedMotion) {
      offset.setValue(toValue);
      return;
    }
    Animated.spring(offset, { toValue, useNativeDriver: true, ...springs.press }).start();
  };

  return (
    <View
      className={className}
      style={{
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        borderRadius: radius.full,
        backgroundColor: variant === 'ghost' ? 'transparent' : lip,
        paddingBottom: variant === 'ghost' ? 0 : LIP_HEIGHT,
        opacity: inactive ? 0.5 : 1,
      }}
    >
      <Animated.View style={{ transform: [{ translateY: offset }] }}>
        <Pressable
          disabled={inactive}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled: inactive, busy: loading }}
          onFocus={focusRing.onFocus}
          onBlur={focusRing.onBlur}
          onPressIn={() => settle(LIP_HEIGHT)}
          onPressOut={() => settle(0)}
          onPress={onPress}
          style={[
            {
              minHeight: metrics.height,
              paddingHorizontal: metrics.padding,
              borderRadius: radius.full,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              overflow: 'hidden',
            },
            variant === 'ghost'
              ? {
                  backgroundColor: tokens.surface,
                  borderWidth: 1.5,
                  borderColor: tokens.border,
                }
              : variant === 'secondary'
                ? {
                    backgroundColor: tokens.chipBackground,
                    borderWidth: 1.5,
                    borderColor: tokens.chipBorder,
                  }
                : null,
            focusRing.focusRingStyle,
          ]}
        >
          {variant === 'primary' || variant === 'danger' ? (
            <LinearGradient
              colors={[gradient[0], gradient[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
          ) : null}
          {loading ? (
            <ActivityIndicator size="small" color={labelColor} />
          ) : (
            <>
              {icon ? (
                <MaterialIcons name={icon} size={metrics.fontSize + 5} color={labelColor} />
              ) : null}
              <Text
                style={{
                  ...typography.label,
                  fontSize: metrics.fontSize,
                  fontFamily: typography.label.fontFamily,
                  color: labelColor,
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {label}
              </Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}
