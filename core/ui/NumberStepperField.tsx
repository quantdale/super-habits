import { Pressable, Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/core/theme";

type NumberStepperFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  placeholder?: string;
};

export function NumberStepperField({
  label,
  value,
  onChange,
  min = 1,
  max = 999,
  placeholder = "1",
}: NumberStepperFieldProps) {
  const { colors } = useAppTheme();
  const num = Number(value);
  const validNum = Number.isFinite(num) ? num : min;

  const handleMinus = () => {
    onChange(String(Math.max(min, validNum - 1)));
  };

  const handlePlus = () => {
    onChange(String(Math.min(max, validNum + 1)));
  };

  return (
    <View className="mb-3">
      <Text className="mb-1 text-sm font-medium" style={{ color: colors.textMuted }}>
        {label}
      </Text>
      <View className="flex-row items-center">
        <Pressable
          onPress={handleMinus}
          className="items-center justify-center rounded-l-xl border border-r-0"
          style={{
            minWidth: 44,
            height: 44,
            borderColor: colors.inputBorder,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <Text className="text-lg font-semibold" style={{ color: colors.textMuted }}>
            −
          </Text>
        </Pressable>
        <TextInput
          className="flex-1 border px-3 py-2 text-center"
          style={{
            height: 44,
            borderColor: colors.inputBorder,
            backgroundColor: colors.inputBackground,
            color: colors.inputText,
          }}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.inputPlaceholder}
          keyboardType="numeric"
        />
        <Pressable
          onPress={handlePlus}
          className="items-center justify-center rounded-r-xl border border-l-0"
          style={{
            minWidth: 44,
            height: 44,
            borderColor: colors.inputBorder,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <Text className="text-lg font-semibold" style={{ color: colors.textMuted }}>
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
