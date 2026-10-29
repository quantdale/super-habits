import { Text } from '@/core/ui/Text';
import { TextInput, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Pressable3D } from '@/core/ui/Pressable3D';
import { sanitizeStepperInput } from '@/core/ui/stepperInput';
import { radius, spacing, typography } from '@/core/theme/designTokens';

/** Ink glyph on a section-bright face (§5.1 "ink `#10131A` on bright"). */
const INK = '#10131A';

type NumberStepperFieldProps = {
  label: string;
  inputAccessibilityLabel?: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  /** Section bright for the round +/- faces (§6); defaults to brand bright. */
  accentColor?: string;
  /** Lip slab under each +/- face — the section solid (§5.1); defaults to the brand lip. */
  lipColor?: string;
};

/**
 * NumberStepperField — v2 (Playful Momentum §6): a sunken field flanked by two
 * 40px round Pressable3D +/- controls in the section bright with ink glyphs
 * (2px lip, 44pt hit via slop). The field keeps its rapid-keystroke contract:
 * `sanitizeStepperInput` on every change, `min`/`max` clamped only on the
 * buttons, and the accessible names `Decrease/Increase <label>` unchanged.
 */
export function NumberStepperField({
  label,
  inputAccessibilityLabel,
  value,
  onChange,
  min = 1,
  max = 999,
  placeholder = '1',
  accentColor,
  lipColor,
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
      <View className="flex-row items-center" style={{ gap: spacing.sm }}>
        <Pressable3D
          lip={2}
          faceColor={accentColor ?? tokens.primaryBright}
          lipColor={lipColor ?? tokens.buttonLip}
          radius={radius.full}
          style={{ width: 40, height: 40 }}
          contentStyle={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
          onPress={handleMinus}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
        >
          <Text variant="titleMd" style={{ color: INK }}>
            −
          </Text>
        </Pressable3D>
        <TextInput
          className="flex-1 px-3 py-2 text-center"
          accessibilityLabel={inputAccessibilityLabel ?? label}
          style={{
            height: 48,
            fontSize: typography.bodyLg.fontSize,
            borderRadius: radius.sm,
            borderWidth: 2,
            borderColor: 'transparent',
            backgroundColor: tokens.surfaceSunken,
            color: tokens.text,
          }}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.textSubtle}
          keyboardType="numeric"
        />
        <Pressable3D
          lip={2}
          faceColor={accentColor ?? tokens.primaryBright}
          lipColor={lipColor ?? tokens.buttonLip}
          radius={radius.full}
          style={{ width: 40, height: 40 }}
          contentStyle={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
          onPress={handlePlus}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
        >
          <Text variant="titleMd" style={{ color: INK }}>
            +
          </Text>
        </Pressable3D>
      </View>
    </View>
  );
}
