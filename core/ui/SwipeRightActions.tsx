import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";

const DELETE_RED = "#ef4444";

/** Align with `Card` (rounded-2xl, border, shadow). */
const CARD_RADIUS = 16;
const CARD_SHADOW = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
} as const;

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
    ...CARD_SHADOW,
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
      <Pressable onPress={onEdit} style={[actionStyle, { backgroundColor: editColor }]}>
        <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>Edit</Text>
      </Pressable>
      <Pressable onPress={onDelete} style={[actionStyle, { backgroundColor: DELETE_RED }]}>
        <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>Delete</Text>
      </Pressable>
    </View>
  );
}
