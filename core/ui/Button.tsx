import { Pressable, Text } from "react-native";
import { useAppTheme } from "@/core/theme";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  color?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  color,
}: ButtonProps) {
  const { colors } = useAppTheme();

  const backgroundColor =
    variant === "primary"
      ? color ?? "#8B5CF6"
      : variant === "danger"
        ? "#ef4444"
        : colors.surfaceMuted;

  const labelColor = variant === "primary" || variant === "danger" ? "#ffffff" : colors.text;

  return (
    <Pressable
      disabled={disabled}
      className={`rounded-xl px-4 py-3 ${disabled ? "opacity-40" : ""}`}
      style={{ backgroundColor }}
      onPress={onPress}
    >
      <Text className="text-center font-semibold" style={{ color: labelColor }}>
        {label}
      </Text>
    </Pressable>
  );
}
