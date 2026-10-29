import { useState } from 'react';
import { Text } from '@/core/ui/Text';
import { Platform, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/themeContext';
import { resolveTextFieldA11y } from '@/core/ui/textFieldA11y';
import { radius, spacing, typography } from '@/core/theme/designTokens';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'number-pad';
  /** When true, only digits 0–9 are kept; uses number-pad. */
  unsignedInteger?: boolean;
  /** Passed to TextInput (screen readers + stable E2E on web). Defaults to `label`. */
  accessibilityLabel?: string;
  /** Sets `nativeID` on TextInput (becomes `id` on web). */
  nativeID?: string;
  /** Validation error text. Renders below the input with error styling and
   *  is programmatically associated with the input on web. */
  error?: string | null;
  /** Static helper text rendered below the input (hidden when `error` is set). */
  helperText?: string;
  /** Multiline input (RN `multiline` + `numberOfLines` on native). */
  multiline?: boolean;
  /** Native TextInput pass-through for entry ergonomics. */
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  submitBehavior?: 'submit' | 'blurAndSubmit' | 'newline';
  onSubmitEditing?: () => void;
  disabled?: boolean;
};

/**
 * TextField — v2 input well (Playful Momentum §6): 52px, radius 12, a
 * `surfaceSunken` face with a 2px transparent border (so focus can swap in the
 * 2px `accent` ring without a layout shift); focused = `accent` border + white
 * face. `label` 13/700 above; error = Cherry text + icon, still
 * programmatically associated via `resolveTextFieldA11y`.
 */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  unsignedInteger = false,
  accessibilityLabel: accessibilityLabelProp,
  nativeID,
  error,
  helperText,
  multiline = false,
  autoCapitalize,
  autoCorrect,
  returnKeyType,
  submitBehavior,
  onSubmitEditing,
  disabled = false,
}: TextFieldProps) {
  const { tokens } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const resolvedKeyboardType = unsignedInteger ? 'number-pad' : keyboardType;
  const { helperId, errorId, describedBy } = resolveTextFieldA11y(nativeID, error, helperText);

  return (
    <View className="mb-3">
      {label ? (
        <Text variant="label" tone="muted" style={{ marginBottom: spacing.xs + 2 }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        nativeID={nativeID}
        accessibilityLabel={accessibilityLabelProp ?? label}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          minHeight: 52,
          fontSize: typography.bodyLg.fontSize,
          borderRadius: radius.sm,
          borderWidth: 2,
          borderColor: error ? tokens.dangerText : focused ? tokens.accent : 'transparent',
          backgroundColor: focused ? tokens.surface : tokens.surfaceSunken,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          color: tokens.text,
          opacity: disabled ? 0.6 : 1,
        }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.textSubtle}
        keyboardType={resolvedKeyboardType}
        editable={!disabled}
        multiline={multiline}
        numberOfLines={multiline ? 3 : undefined}
        textAlignVertical={multiline ? 'top' : undefined}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        returnKeyType={returnKeyType}
        submitBehavior={submitBehavior}
        onSubmitEditing={onSubmitEditing}
        {...(Platform.OS === 'web' && nativeID ? { id: nativeID } : {})}
      />
      {error ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginTop: spacing.xs + 2,
          }}
        >
          <MaterialIcons name="error-outline" size={16} color={tokens.dangerText} />
          <Text
            nativeID={errorId}
            variant="label"
            style={{ color: tokens.dangerText, flexShrink: 1 }}
          >
            {error}
          </Text>
        </View>
      ) : helperText ? (
        <Text
          nativeID={helperId}
          variant="label"
          tone="muted"
          style={{ marginTop: spacing.xs + 2 }}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
