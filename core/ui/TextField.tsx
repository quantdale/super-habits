import { Platform, Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "number-pad";
  /** When true, only digits 0–9 are kept; uses number-pad. */
  unsignedInteger?: boolean;
  /** Passed to TextInput (screen readers + stable E2E on web). Defaults to `label`. */
  accessibilityLabel?: string;
  /** Sets `nativeID` on TextInput (becomes `id` on web). */
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
  const { tokens } = useAppTheme();
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
      <Text className="mb-1.5 text-sm font-medium" style={{ color: tokens.textMuted }}>{label}</Text>
      <TextInput
        nativeID={nativeID}
        accessibilityLabel={accessibilityLabelProp ?? label}
        className="rounded-2xl border px-4 py-3"
        style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, color: tokens.text }}
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.textMuted}
        keyboardType={resolvedKeyboardType}
        {...(Platform.OS === "web" && nativeID ? { id: nativeID } : {})}
      />
    </View>
  );
}
