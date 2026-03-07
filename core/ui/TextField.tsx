import { Text, TextInput, View } from "react-native";

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
}: TextFieldProps) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-sm font-medium text-slate-700">{label}</Text>
      <TextInput
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
      />
    </View>
  );
}
