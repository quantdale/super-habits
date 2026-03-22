import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Tabs, TabList, TabTrigger, TabSlot } from "expo-router/ui";

const NAV_ITEMS = [
  { name: "todos", href: "/(tabs)/todos" as const, label: "To Do", icon: "check-circle-outline" },
  { name: "habits", href: "/(tabs)/habits" as const, label: "Habits", icon: "loop" },
  { name: "pomodoro", href: "/(tabs)/pomodoro" as const, label: "Focus", icon: "timer" },
  { name: "workout", href: "/(tabs)/workout" as const, label: "Workout", icon: "fitness-center" },
  { name: "calories", href: "/(tabs)/calories" as const, label: "Calories", icon: "restaurant-menu" },
] as const;

type TopTabItemProps = {
  isFocused?: boolean;
  label: string;
  icon: string;
  onPress?: () => void;
  style?: object;
  [key: string]: unknown;
};

/** expo-router TabTrigger injects { flexDirection: 'row', justifyContent: 'space-between' } — override so icon + label stack and stay centered. */
const TOP_TAB_PRESSABLE_STYLE = {
  flex: 1,
  minWidth: 0,
  flexDirection: "column" as const,
  justifyContent: "center" as const,
  alignItems: "center" as const,
};

function TopTabItem({ isFocused, label, icon, onPress, style, ...rest }: TopTabItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[StyleSheet.flatten(style), TOP_TAB_PRESSABLE_STYLE]}
      className="relative px-1 py-2"
      {...rest}
    >
      <MaterialIcons name={icon as keyof typeof MaterialIcons.glyphMap} size={20} color={isFocused ? "#4f79ff" : "#94a3b8"} />
      <Text
        className="mt-0.5 max-w-full text-xs"
        style={{ color: isFocused ? "#4f79ff" : "#94a3b8", textAlign: "center" }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {isFocused ? (
        <View
          className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
          style={{ backgroundColor: "#4f79ff" }}
        />
      ) : null}
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs className="flex-1 flex-col">
      <TabList
        className="z-10 w-full flex-row border-b border-slate-100 bg-white"
        style={{
          flexDirection: "row",
          justifyContent: "flex-start",
          alignItems: "stretch",
          width: "100%",
          paddingTop: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        {NAV_ITEMS.map((item) => (
          <TabTrigger key={item.name} name={item.name} href={item.href} asChild>
            <TopTabItem label={item.label} icon={item.icon} />
          </TabTrigger>
        ))}
      </TabList>
      <TabSlot className="flex-1" />
    </Tabs>
  );
}
