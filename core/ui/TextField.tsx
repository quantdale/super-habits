import { Platform, Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/core/theme";

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "number-pad";
  unsignedInteger?: boolean;
  accessibilityLabel?: string;
  nativeID?: string;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  unsignedInteger = false,
  accessibilityLabel: accessibilityLabelProp,
  nativeID,
}: TextFieldProps) {
  const { colors } = useAppTheme();
  const resolvedKeyboardType = unsignedInteger ? "number-pad" : keyboardType;

  const handleChangeText = (text: string) => {
    if (unsignedInteger) {
      onChangeText(text.replace(/\D/g, ""));
    } else {
      onChangeText(text);
    }
  };

  return (
    <View className="mb-3">
      <Text className="mb-1 text-sm font-medium" style={{ color: colors.textMuted }}>
        {label}
      </Text>
      <TextInput
        nativeID={nativeID}
        accessibilityLabel={accessibilityLabelProp ?? label}
        className="rounded-xl border px-3 py-2"
        style={{
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          color: colors.inputText,
        }}
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inputPlaceholder}
        keyboardType={resolvedKeyboardType}
        {...(Platform.OS === "web" && nativeID ? { id: nativeID } : {})}
      />
    </View>
  );
}
