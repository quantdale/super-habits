import { Text } from '@/core/ui/Text';
import { Pressable, TextInput, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { sanitizeStepperInput } from '@/core/ui/stepperInput';
import { spacing, typography } from '@/core/theme/designTokens';

type NumberStepperFieldProps = {
  label: string;
  inputAccessibilityLabel?: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  placeholder?: string;
};

export function NumberStepperField({
  label,
  inputAccessibilityLabel,
  value,
  onChange,
  min = 1,
  max = 999,
  placeholder = '1',
}: NumberStepperFieldProps) {
  const { tokens } = useAppTheme();
  const num = Number(value);
  const validNum = Number.isFinite(num) ? num : min;
  const handleChangeText = (nextValue: string) => {
    onChange(sanitizeStepperInput(nextValue, max));
  };

  const handleMinus = () => {
    onChange(String(Math.max(min, validNum - 1)));
  };

  const handlePlus = () => {
    onChange(String(Math.min(max, Math.max(min, validNum + 1))));
  };

  return (
    <View className="mb-3">
      <Text variant="label" tone="muted" style={{ marginBottom: spacing.xs + 2 }}>
        {label}
      </Text>
      <View className="flex-row items-center">
        <Pressable
          onPress={handleMinus}
          className="items-center justify-center rounded-l-2xl border border-r-0"
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={{
            minWidth: 48,
            height: 48,
            borderColor: tokens.border,
            backgroundColor: tokens.surface,
          }}
        >
          <Text variant="titleMd" tone="muted">
            −
          </Text>
        </Pressable>
        <TextInput
          className="flex-1 border px-3 py-2 text-center"
          accessibilityLabel={inputAccessibilityLabel ?? label}
          style={{
            height: 48,
            fontSize: typography.bodyLg.fontSize,
            borderColor: tokens.border,
            backgroundColor: tokens.surfaceElevated,
            color: tokens.text,
          }}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.textMuted}
          keyboardType="numeric"
        />
        <Pressable
          onPress={handlePlus}
          className="items-center justify-center rounded-r-2xl border border-l-0"
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={{
            minWidth: 48,
            height: 48,
            borderColor: tokens.border,
            backgroundColor: tokens.surface,
          }}
        >
          <Text variant="titleMd" tone="muted">
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
