import { Pressable, Text } from "react-native";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  /** Optional section accent — overrides primary background when set */
  color?: string;
};

export function Button({ label, onPress, variant = "primary", disabled = false, color }: ButtonProps) {
  const useCustomPrimary = Boolean(color) && variant === "primary";
  const styles =
    variant === "primary"
      ? useCustomPrimary
        ? ""
        : "bg-brand-500"
      : variant === "danger"
        ? "bg-rose-500"
        : "bg-slate-200 dark:bg-slate-700";
  const labelStyles =
    variant === "primary" || variant === "danger"
      ? "text-white"
      : "text-slate-900 dark:text-slate-100";
  return (
    <Pressable
      disabled={disabled}
      className={`rounded-xl px-4 py-3 ${styles} ${disabled ? "opacity-40" : ""}`}
      style={useCustomPrimary ? { backgroundColor: color } : undefined}
      onPress={onPress}
    >
      <Text className={`text-center font-semibold ${labelStyles}`}>{label}</Text>
    </Pressable>
  );
}
