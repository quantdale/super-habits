import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Tabs, TabList, TabTrigger, TabSlot } from "expo-router/ui";

const NAV_ITEMS = [
  { name: "todos", href: "/(tabs)/todos" as const, label: "Todos", shortLabel: "T" },
  { name: "habits", href: "/(tabs)/habits" as const, label: "Habits", shortLabel: "H" },
  { name: "pomodoro", href: "/(tabs)/pomodoro" as const, label: "Focus", shortLabel: "F" },
  { name: "workout", href: "/(tabs)/workout" as const, label: "Workout", shortLabel: "W" },
  { name: "calories", href: "/(tabs)/calories" as const, label: "Calories", shortLabel: "C" },
];

type NavItemProps = {
  isFocused?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  label: string;
  shortLabel: string;
  collapsed: boolean;
} & Record<string, unknown>;

function NavItem({ isFocused, onPress, onLongPress, label, shortLabel, collapsed, ...rest }: NavItemProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className={`mb-1 flex flex-row items-center rounded-lg px-3 py-2.5 ${
        isFocused ? "bg-brand-500" : "bg-transparent"
      } ${collapsed ? "justify-center" : ""}`}
      {...rest}
    >
      <Text
        className={`text-sm font-medium ${isFocused ? "text-white" : "text-slate-700"}`}
        numberOfLines={1}
      >
        {collapsed ? shortLabel : label}
      </Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? 56 : 200;

  return (
    <Tabs className="flex-1 flex-row">
      <TabList
        className="flex shrink-0 flex-col border-r border-slate-200 bg-white px-2 py-3"
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          maxWidth: sidebarWidth,
          flexDirection: "column",
          justifyContent: "flex-start",
        }}
      >
        {NAV_ITEMS.map((item) => (
          <TabTrigger key={item.name} name={item.name} href={item.href} asChild>
            <NavItem
              label={item.label}
              shortLabel={item.shortLabel}
              collapsed={sidebarCollapsed}
            />
          </TabTrigger>
        ))}
        <Pressable
          onPress={() => setSidebarCollapsed((c) => !c)}
          className="mt-auto border-t border-slate-200 py-3"
          style={{ alignItems: sidebarCollapsed ? "center" : "flex-start", paddingHorizontal: 12 }}
        >
          <Text className="text-slate-500" selectable={false}>
            {sidebarCollapsed ? "»" : "«"}
          </Text>
        </Pressable>
      </TabList>
      <View className="flex-1">
        <TabSlot />
      </View>
    </Tabs>
  );
}
