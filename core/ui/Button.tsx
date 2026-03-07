import { Pressable, Text } from "react-native";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
};

export function Button({ label, onPress, variant = "primary" }: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-brand-500"
      : variant === "danger"
        ? "bg-rose-500"
        : "bg-slate-200";
  return (
    <Pressable className={`rounded-xl px-4 py-3 ${styles}`} onPress={onPress}>
      <Text className="text-center font-semibold text-white">{label}</Text>
    </Pressable>
  );
}
