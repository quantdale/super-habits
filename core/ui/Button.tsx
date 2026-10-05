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

/** Height of the 3D lip under the celebrate button face. */
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
  sm: { height: 36, padding: spacing.md, fontSize: 13 },
  md: { height: size.buttonHeight, padding: spacing.lg, fontSize: 15 },
  lg: { height: size.buttonHeightLg, padding: spacing.xl, fontSize: 16 },
};

/**
 * The V3 action hierarchy (docs/ui-ux/13 §7). One loud action per view:
 *
 * - `primary`   — solid accent fill, white ink. The "do it" button.
 * - `secondary` — tonal chip fill, accent-safe ink. Supporting actions.
 * - `ghost`     — quiet surface, hairline outline. Dismiss / rare paths.
 * - `danger`    — solid danger fill. Destructive confirms.
 * - `celebrate` — the retired Pop treatment (gradient face + 3D lip + spring):
 *                 reserved for gamification milestones only.
 *
 * Default buttons are calm: radius 12, no gradient, no lip, a 150ms press
 * settle instead of a spring. Reduced motion keeps the pressed state but
 * removes the travel.
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
  const isCelebration = variant === 'celebrate';

  // A caller-supplied hue paints the solid face carrying white text; deepen it
  // until the label clears WCAG AA (section hues measure ~4.2:1 as-is).
  const face = color ?? (variant === 'danger' ? tokens.dangerSolid : tokens.button);
  const solidFace =
    (variant === 'primary' || variant === 'danger' || isCelebration) && color
      ? readableSurface(face, tokens.buttonText)
      : face;
  const gradient: readonly [string, string] =
    isCelebration && !color ? tokens.brandGradient : [solidFace, solidFace];
  const lip = shade(solidFace, 0.76);
  const labelColor =
    variant === 'primary' || variant === 'danger' || isCelebration
      ? tokens.buttonText
      : variant === 'secondary'
        ? readableSurface(face, tokens.chipBackground)
        : tokens.text;

  const settle = (toValue: number) => {
    if (reducedMotion) {
      offset.setValue(toValue);
      return;
    }
    if (isCelebration) {
      Animated.spring(offset, { toValue, useNativeDriver: true, ...springs.press }).start();
    } else {
      Animated.timing(offset, {
        toValue,
        duration: 120,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <View
      className={className}
      style={{
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        borderRadius: radius.md,
        backgroundColor: isCelebration ? lip : 'transparent',
        paddingBottom: isCelebration ? LIP_HEIGHT : 0,
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
          onPressIn={() => settle(isCelebration ? LIP_HEIGHT : 1)}
          onPressOut={() => settle(0)}
          onPress={onPress}
          style={[
            {
              minHeight: metrics.height,
              paddingHorizontal: metrics.padding,
              borderRadius: radius.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              overflow: 'hidden',
            },
            isCelebration
              ? null
              : variant === 'ghost'
                ? {
                    backgroundColor: tokens.surface,
                    borderWidth: 1,
                    borderColor: tokens.border,
                  }
                : variant === 'secondary'
                  ? {
                      backgroundColor: tokens.chipBackground,
                      borderWidth: 1,
                      borderColor: tokens.chipBorder,
                    }
                  : null,
            focusRing.focusRingStyle,
          ]}
        >
          {isCelebration ? (
            <LinearGradient
              colors={[gradient[0], gradient[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
          ) : variant === 'primary' || variant === 'danger' ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: gradient[0],
                borderRadius: radius.md,
              }}
            />
          ) : null}
          {loading ? (
            <ActivityIndicator size="small" color={labelColor} />
          ) : (
            <>
              {icon ? (
                <MaterialIcons name={icon} size={metrics.fontSize + 4} color={labelColor} />
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
