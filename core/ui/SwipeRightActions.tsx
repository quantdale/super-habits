import { Text, View } from "react-native";
import { RectButton } from "react-native-gesture-handler";

const DELETE_RED = "#ef4444";

/** Align with `Card` (rounded-2xl, border, shadow). */
const CARD_RADIUS = 16;
const CARD_BORDER = "#e8e8f0";
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
};

export function SwipeRightActions({ onEdit, onDelete, editColor }: Props) {
  const actionStyle = {
    justifyContent: "center" as const,
    alignItems: "center" as const,
    width: 80,
    alignSelf: "stretch" as const,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...CARD_SHADOW,
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        marginLeft: 4,
        gap: 4,
      }}
    >
      <RectButton onPress={onEdit} style={[actionStyle, { backgroundColor: editColor }]}>
        <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>Edit</Text>
      </RectButton>
      <RectButton onPress={onDelete} style={[actionStyle, { backgroundColor: DELETE_RED }]}>
        <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>Delete</Text>
      </RectButton>
    </View>
  );
}
