import { Pressable, Text } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  /** Optional section accent — overrides primary background when set */
  color?: string;
};

export function Button({ label, onPress, variant = "primary", disabled = false, color }: ButtonProps) {
  const { tokens } = useAppTheme();
  const useCustomPrimary = Boolean(color) && variant === "primary";
  const className =
    variant === "primary"
      ? useCustomPrimary
        ? ""
        : "bg-brand-500"
      : variant === "danger"
        ? ""
        : "";
  const labelClassName =
    variant === "primary" || variant === "danger"
      ? "text-white"
      : "";
  const style =
    variant === "primary"
      ? useCustomPrimary
        ? { backgroundColor: color }
        : undefined
      : variant === "danger"
        ? { backgroundColor: "#ef4444" }
        : { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border, borderWidth: 1 };

  return (
    <Pressable
      disabled={disabled}
      className={`rounded-xl px-4 py-3 ${className} ${disabled ? "opacity-40" : ""}`}
      style={style}
      onPress={onPress}
    >
      <Text className={`text-center font-semibold ${labelClassName}`} style={variant === "ghost" ? { color: tokens.text } : undefined}>
        {label}
      </Text>
    </Pressable>
  );
}
