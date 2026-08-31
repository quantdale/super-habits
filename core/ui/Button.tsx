import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';

type ButtonProps = {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  /** Shows an inline spinner instead of the label and suppresses presses. */
  loading?: boolean;
  /** Optional section accent — overrides primary background when set */
  color?: string;
};

export function Button({
  label,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  color,
}: ButtonProps) {
  const { tokens } = useAppTheme();
  const focusRing = useKeyboardFocusRing(tokens.accent);
  const useCustomPrimary = Boolean(color) && variant === 'primary';
  const inactive = disabled || loading;

  const fillFor = (pressed: boolean) => {
    if (variant === 'ghost') return undefined;
    if (variant === 'danger') return tokens.dangerSolid;
    if (useCustomPrimary) return color;
    return pressed ? tokens.buttonActive : tokens.button;
  };

  return (
    <Pressable
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      className={`min-h-[48px] rounded-2xl px-4 py-3 ${inactive ? 'opacity-40' : ''}`}
      style={({ pressed }) => ({
        ...(variant === 'ghost'
          ? { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border, borderWidth: 1 }
          : { backgroundColor: fillFor(pressed) }),
        ...(variant === 'primary' || variant === 'danger'
          ? {
              shadowColor: tokens.shadowColor,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: inactive ? 0 : 0.08,
              shadowRadius: 12,
              elevation: inactive ? 0 : 1,
            }
          : {}),
        // Visible keyboard-focus indication on web (Design DNA §15).
        ...(focusRing.focusRingStyle ?? {}),
      })}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'ghost' ? tokens.text : tokens.buttonText}
        />
      ) : (
        <Text
          className="text-center text-sm font-semibold"
          style={variant === 'ghost' ? { color: tokens.text } : { color: tokens.buttonText }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
