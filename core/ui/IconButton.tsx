import { MaterialIcons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";

function withAlpha(color: string, opacity: number) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }

  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

type IconButtonProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  selected?: boolean;
  accentColor?: string;
  size?: number;
};

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  selected = false,
  accentColor,
  size = 22,
}: IconButtonProps) {
  const { tokens } = useAppTheme();
  const resolvedAccent = accentColor ?? tokens.iconMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      className="h-11 w-11 items-center justify-center rounded-2xl border"
      style={{
        borderColor: selected ? withAlpha(resolvedAccent, 0.28) : tokens.border,
        backgroundColor: selected ? withAlpha(resolvedAccent, 0.12) : tokens.surface,
      }}
    >
      <MaterialIcons
        name={icon}
        size={size}
        color={selected ? resolvedAccent : tokens.iconMuted}
      />
    </Pressable>
  );
}
