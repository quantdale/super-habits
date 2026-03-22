import { Pressable, StyleSheet, Text } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Tabs, TabList, TabTrigger, TabSlot } from "expo-router/ui";
import { SECTION_COLORS } from "@/constants/sectionColors";

const NAV_ITEMS = [
  { name: "todos", href: "/(tabs)/todos" as const, label: "To Do", icon: "check-circle-outline", color: SECTION_COLORS.todos },
  { name: "habits", href: "/(tabs)/habits" as const, label: "Habits", icon: "loop", color: SECTION_COLORS.habits },
  { name: "pomodoro", href: "/(tabs)/pomodoro" as const, label: "Focus", icon: "timer", color: SECTION_COLORS.focus },
  { name: "workout", href: "/(tabs)/workout" as const, label: "Workout", icon: "fitness-center", color: SECTION_COLORS.workout },
  { name: "calories", href: "/(tabs)/calories" as const, label: "Calories", icon: "restaurant-menu", color: SECTION_COLORS.calories },
] as const;

/** Matches `Screen` / `bg-surface` so the active tab and tab content area read as one surface. */
const TAB_CONTENT_SURFACE = "#f8f7ff";

const TAB_RAIL_BG = "#eeecf8";
const TAB_RAIL_BORDER = "#d4d0ee";

type TopTabItemProps = {
  isFocused?: boolean;
  label: string;
  icon: string;
  color: string;
  onPress?: () => void;
  style?: object;
  [key: string]: unknown;
};

/** expo-router TabTrigger may inject layout — icon+label column is re-applied after flatten(style) so content stays centered. */
const TOP_TAB_PRESSABLE_STYLE = {
  flex: 1,
  minWidth: 0,
  flexDirection: "column" as const,
  justifyContent: "center" as const,
  alignItems: "center" as const,
};

function TopTabItem({ isFocused, label, icon, color, onPress, style, ...rest }: TopTabItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        TOP_TAB_PRESSABLE_STYLE,
        StyleSheet.flatten(style),
        {
          backgroundColor: isFocused ? TAB_CONTENT_SURFACE : TAB_RAIL_BG,
          borderBottomWidth: isFocused ? 0 : 1,
          borderBottomColor: TAB_RAIL_BORDER,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          marginTop: isFocused ? 0 : 3,
          paddingTop: isFocused ? 10 : 7,
          paddingBottom: 10,
          paddingHorizontal: 6,
        },
      ]}
      {...rest}
    >
      <MaterialIcons
        name={icon as keyof typeof MaterialIcons.glyphMap}
        size={18}
        color={isFocused ? color : "#94a3b8"}
      />
      <Text
        style={{
          fontSize: 11,
          marginTop: 2,
          color: isFocused ? color : "#94a3b8",
          fontWeight: isFocused ? "600" : "400",
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs className="flex-1 flex-col">
      <TabList
        style={{
          flexDirection: "row",
          width: "100%",
          alignItems: "stretch",
          backgroundColor: TAB_RAIL_BG,
          borderBottomWidth: 1,
          borderBottomColor: TAB_RAIL_BORDER,
          paddingHorizontal: 4,
          paddingTop: 4,
          gap: 2,
          zIndex: 10,
        }}
      >
        {NAV_ITEMS.map((item) => (
          <TabTrigger key={item.name} name={item.name} href={item.href} asChild>
            <TopTabItem label={item.label} icon={item.icon} color={item.color} />
          </TabTrigger>
        ))}
      </TabList>
      <TabSlot className="flex-1" style={{ flex: 1, backgroundColor: TAB_CONTENT_SURFACE }} />
    </Tabs>
  );
}
