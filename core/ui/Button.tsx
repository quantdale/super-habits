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
      ? ""
      : "";
  const style =
    variant === "primary"
      ? useCustomPrimary
        ? { backgroundColor: color }
        : undefined
      : variant === "danger"
        ? { backgroundColor: tokens.dangerSolid }
        : { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border, borderWidth: 1 };

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`min-h-[48px] rounded-2xl px-4 py-3 ${className} ${disabled ? "opacity-40" : ""}`}
      style={[
        style,
        variant === "primary" || variant === "danger"
          ? {
              shadowColor: tokens.shadowColor,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: disabled ? 0 : 0.08,
              shadowRadius: 12,
              elevation: disabled ? 0 : 1,
            }
          : undefined,
      ]}
      onPress={onPress}
    >
      <Text
        className={`text-center text-sm font-semibold ${labelClassName}`}
        style={
          variant === "ghost"
            ? { color: tokens.text }
            : { color: tokens.textOnAccent }
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
