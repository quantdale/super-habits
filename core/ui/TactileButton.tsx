import { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Animated, Pressable, Text } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing, typography } from '@/core/theme/designTokens';
import { useReducedMotion } from '@/core/theme/motion';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';

export type TactileButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  /** Surface color; the pressed "lip" below it is derived from this value. */
  color?: string;
  textColor?: string;
  disabled?: boolean;
  size?: 'md' | 'lg';
  className?: string;
};

/** Height of the 3D lip under the button face. */
const LIP_HEIGHT = 4;

/**
 * The lip is a darker plate the face sinks onto. Theme colors are hex, so the
 * shade is a deterministic per-channel multiplication; anything else (rgba,
 * named color) falls back to the face color and simply loses the shading.
 */
function shade(color: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const channel = (offset: number) =>
    Math.max(0, Math.round(Number.parseInt(color.slice(offset, offset + 2), 16) * amount))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/**
 * Tactile 3D action button (Refero: Duolingo / Brilliant primary CTAs): a
 * rounded face resting on a darker lip that compresses under the finger with
 * spring physics, then springs back. Reduced motion keeps the press state but
 * removes the travel.
 */
export function TactileButton({
  label,
  onPress,
  accessibilityLabel,
  icon,
  color,
  textColor,
  disabled = false,
  size = 'md',
  className,
}: TactileButtonProps) {
  const { tokens } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const focusRing = useKeyboardFocusRing(tokens.accent);
  const [offset] = useState(() => new Animated.Value(0));
  const face = color ?? tokens.button;
  const lip = shade(face, 0.78);
  const ink = textColor ?? tokens.buttonText;
  const minHeight = size === 'lg' ? 56 : 48;
  const paddingVertical = size === 'lg' ? spacing.md : spacing.sm;

  const settle = (toValue: number) => {
    if (reducedMotion) {
      offset.setValue(toValue);
      return;
    }
    Animated.spring(offset, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  return (
    <Animated.View
      className={className}
      style={{
        backgroundColor: lip,
        borderRadius: radius.full,
        paddingBottom: LIP_HEIGHT,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Animated.View style={{ transform: [{ translateY: offset }] }}>
        <Pressable
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled }}
          onPress={onPress}
          onPressIn={() => settle(LIP_HEIGHT)}
          onPressOut={() => settle(0)}
          onFocus={focusRing.onFocus}
          onBlur={focusRing.onBlur}
          style={[
            {
              minHeight,
              paddingVertical,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.full,
              backgroundColor: face,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
            },
            focusRing.focusRingStyle,
          ]}
        >
          {icon ? <MaterialIcons name={icon} size={20} color={ink} /> : null}
          <Text
            style={{
              ...typography.label,
              color: ink,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
