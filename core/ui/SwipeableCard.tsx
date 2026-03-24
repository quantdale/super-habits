import { useRef, type ReactNode } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SwipeRightActions } from "./SwipeRightActions";

const BORDER = "#e8e8f0";
const CARD_SHADOW = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
} as const;

type Props = {
  children: ReactNode;
  accentColor?: string;
  /** Extra styles applied to the outer fixed container (e.g. flex: 1, marginBottom). */
  style?: StyleProp<ViewStyle>;
  /** When true, reduces action button width for compact layouts. */
  compact?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * A card whose chrome (border, accent bar, background, shadow) stays fixed while
 * the inner content slides left on swipe to reveal edit/delete actions inside the
 * card's own boundary.
 */
export function SwipeableCard({ children, accentColor, style, compact, onEdit, onDelete }: Props) {
  const swipeableRef = useRef<Swipeable>(null);

  const handleEdit = () => {
    swipeableRef.current?.close();
    onEdit();
  };

  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete();
  };

  return (
    <View
      style={[
        {
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: "white",
          borderTopWidth: 1,
          borderRightWidth: 1,
          borderBottomWidth: 1,
          borderLeftWidth: accentColor ? 4 : 1,
          borderTopColor: BORDER,
          borderRightColor: BORDER,
          borderBottomColor: BORDER,
          borderLeftColor: accentColor ?? BORDER,
          ...CARD_SHADOW,
        },
        style,
      ]}
    >
      <Swipeable
        ref={swipeableRef}
        renderRightActions={() => (
          <SwipeRightActions
            editColor={accentColor ?? "#64748b"}
            onEdit={handleEdit}
            onDelete={handleDelete}
            compact={compact}
          />
        )}
        rightThreshold={40}
        overshootRight={false}
      >
        {/* Inner content — this is what slides; card chrome above stays fixed */}
        <View
          style={{
            backgroundColor: "white",
            paddingVertical: 12,
            paddingLeft: accentColor ? 8 : 16,
            paddingRight: 16,
          }}
        >
          {children}
        </View>
      </Swipeable>
    </View>
  );
}


