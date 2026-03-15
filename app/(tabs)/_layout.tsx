import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Tabs, TabList, TabTrigger, TabSlot } from "expo-router/ui";

const NAV_ITEMS = [
  { name: "todos", href: "/(tabs)/todos" as const, label: "To Do", shortLabel: "T" },
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
  style?: unknown;
} & Record<string, unknown>;

function NavItem({ isFocused, onPress, onLongPress, label, shortLabel, collapsed, style, ...rest }: NavItemProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={style ? StyleSheet.flatten(style) : undefined}
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

const BURGER_STRIP_WIDTH = 56;
const SIDEBAR_PANEL_WIDTH = 144;

export default function TabsLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const panelWidth = sidebarCollapsed ? 0 : SIDEBAR_PANEL_WIDTH;

  return (
    <Tabs className="flex-1 flex-row">
      <TabList
        className="flex shrink-0 flex-col border-r border-slate-200 bg-white px-2 py-3"
        style={{
          width: BURGER_STRIP_WIDTH + panelWidth,
          minWidth: BURGER_STRIP_WIDTH + panelWidth,
          maxWidth: BURGER_STRIP_WIDTH + panelWidth,
          flexDirection: "column",
          justifyContent: "flex-start",
          overflow: "hidden",
        }}
      >
        <View
          className="flex-row items-center justify-center border-b border-slate-200 py-2.5"
          style={{
            width: BURGER_STRIP_WIDTH,
            minWidth: BURGER_STRIP_WIDTH,
            maxWidth: BURGER_STRIP_WIDTH,
          }}
        >
          <Pressable
            onPress={() => setSidebarCollapsed((c) => !c)}
            className="flex-row items-center justify-center rounded-lg py-2.5"
            style={{ minHeight: 44 }}
          >
            <MaterialIcons name="menu" size={24} color="#64748b" />
          </Pressable>
        </View>
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
          style={{ paddingHorizontal: 12 }}
        >
          <Text className="text-slate-500" selectable={false}>
            «
          </Text>
        </Pressable>
      </TabList>
      <TabSlot className="flex-1" />
    </Tabs>
  );
}
