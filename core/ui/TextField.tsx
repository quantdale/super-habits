import { Platform, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { resolveTextFieldA11y } from '@/core/ui/textFieldA11y';

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
  const resolvedKeyboardType = unsignedInteger ? 'number-pad' : keyboardType;
  const { helperId, errorId, describedBy } = resolveTextFieldA11y(nativeID, error, helperText);

  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-sm font-medium" style={{ color: tokens.textMuted }}>
        {label}
      </Text>
      <TextInput
        nativeID={nativeID}
        accessibilityLabel={accessibilityLabelProp ?? label}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className="rounded-2xl border px-4 py-3 text-base"
        style={{
          minHeight: 48,
          borderColor: error ? tokens.dangerText : tokens.border,
          backgroundColor: tokens.surfaceElevated,
          color: tokens.text,
          opacity: disabled ? 0.6 : 1,
        }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.textMuted}
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
        <Text nativeID={errorId} className="mt-1.5 text-sm" style={{ color: tokens.dangerText }}>
          {error}
        </Text>
      ) : helperText ? (
        <Text nativeID={helperId} className="mt-1.5 text-sm" style={{ color: tokens.textMuted }}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
