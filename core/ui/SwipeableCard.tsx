import { useRef, type ReactNode } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useAppTheme } from "@/core/providers/ThemeProvider";
import { Card } from "./Card";
import { SwipeRightActions } from "./SwipeRightActions";

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

const STRIP_WIDTH = 4;

/**
 * A card whose outline (border, background, shadow) stays fixed while the row
 * slides left on swipe. A left accent strip (inside the outline) marks rows as
 * swipeable and matches section color when provided.
 */
export function SwipeableCard({ children, accentColor, style, compact, onEdit, onDelete }: Props) {
  const { tokens } = useAppTheme();
  const swipeableRef = useRef<Swipeable>(null);
  const stripColor = accentColor ?? tokens.border;

  const handleEdit = () => {
    swipeableRef.current?.close();
    onEdit();
  };

  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete();
  };

  return (
    <Card
      variant="standard"
      accentColor={accentColor}
      className="mb-0 overflow-hidden"
      innerClassName="p-0"
      style={style}
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "stretch",
            backgroundColor: tokens.surface,
          }}
        >
          <View style={{ width: STRIP_WIDTH, backgroundColor: stripColor }} />
          <View
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingLeft: 12,
              paddingRight: 16,
            }}
          >
            {children}
          </View>
        </View>
      </Swipeable>
    </Card>
  );
}
