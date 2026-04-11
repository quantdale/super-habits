import { useRef, type ReactNode } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Card } from "./Card";
import { SwipeRightActions } from "./SwipeRightActions";
import { useAppTheme } from "@/core/theme";

type Props = {
  children: ReactNode;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

const STRIP_WIDTH = 4;

export function SwipeableCard({ children, accentColor, style, compact, onEdit, onDelete }: Props) {
  const { colors } = useAppTheme();
  const swipeableRef = useRef<Swipeable>(null);
  const stripColor = accentColor ?? colors.borderStrong;

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
            editColor={accentColor ?? colors.icon}
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
            backgroundColor: colors.card,
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
