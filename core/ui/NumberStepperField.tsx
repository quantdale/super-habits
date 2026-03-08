import { Pressable, Text, TextInput, View } from "react-native";

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
      <Text className="mb-1 text-sm font-medium text-slate-700">{label}</Text>
      <View className="flex-row items-center">
        <Pressable
          onPress={handleMinus}
          className="items-center justify-center rounded-l-xl border border-r-0 border-slate-200 bg-slate-100"
          style={{ minWidth: 44, height: 44 }}
        >
          <Text className="text-lg font-semibold text-slate-700">−</Text>
        </Pressable>
        <TextInput
          className="flex-1 border border-slate-200 bg-white px-3 py-2 text-center text-slate-900"
          style={{ height: 44 }}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          keyboardType="numeric"
        />
        <Pressable
          onPress={handlePlus}
          className="items-center justify-center rounded-r-xl border border-l-0 border-slate-200 bg-slate-100"
          style={{ minWidth: 44, height: 44 }}
        >
          <Text className="text-lg font-semibold text-slate-700">+</Text>
        </Pressable>
      </View>
    </View>
  );
}
