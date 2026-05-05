import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";

/** Align with `Card` (rounded-2xl, border, shadow). */
const CARD_RADIUS = 16;

type Props = {
  onEdit: () => void;
  onDelete: () => void;
  editColor: string;
  compact?: boolean;
};

export function SwipeRightActions({ onEdit, onDelete, editColor, compact }: Props) {
  const { tokens } = useAppTheme();
  const btnWidth = compact ? 56 : 80;
  const actionStyle = {
    justifyContent: "center" as const,
    alignItems: "center" as const,
    width: btnWidth,
    alignSelf: "stretch" as const,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: tokens.border,
    shadowColor: tokens.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        alignSelf: "stretch",
        height: "100%",
        marginLeft: 4,
        gap: 4,
      }}
      >
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel="Edit item"
        style={[actionStyle, { backgroundColor: editColor }]}
      >
        <Text style={{ color: tokens.textOnAccent, fontSize: 13, fontWeight: "600" }}>Edit</Text>
      </Pressable>
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel="Delete item"
        style={[actionStyle, { backgroundColor: tokens.dangerSolid }]}
      >
        <Text style={{ color: tokens.textOnAccent, fontSize: 13, fontWeight: "600" }}>Delete</Text>
      </Pressable>
    </View>
  );
}
