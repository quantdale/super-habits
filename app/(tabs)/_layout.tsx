import { useCallback, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useRouter, useSegments } from "expo-router";
import { Tabs, TabList, TabTrigger, TabSlot } from "expo-router/ui";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { POMODORO_SECTION_KEY, SECTION_COLORS, SECTION_TEXT_COLORS } from "@/constants/sectionColors";
import { useAppTheme } from "@/core/providers/ThemeProvider";

const OVERVIEW_HREF = "/(tabs)/overview" as Href;

const NAV_ITEMS = [
  { name: "overview", href: OVERVIEW_HREF, label: "Overview", icon: "dashboard", color: "#475569" },
  { name: "todos", href: "/(tabs)/todos" as const, label: "To Do", icon: "check-circle-outline", color: SECTION_TEXT_COLORS.todos },
  { name: "habits", href: "/(tabs)/habits" as const, label: "Habits", icon: "loop", color: SECTION_TEXT_COLORS.habits },
  { name: "pomodoro", href: "/(tabs)/pomodoro" as const, label: "Focus", icon: "timer", color: SECTION_TEXT_COLORS.focus },
  { name: "workout", href: "/(tabs)/workout" as const, label: "Workout", icon: "fitness-center", color: SECTION_TEXT_COLORS.workout },
  { name: "calories", href: "/(tabs)/calories" as const, label: "Calories", icon: "restaurant-menu", color: SECTION_TEXT_COLORS.calories },
] as const;

const NAV_TAB_COUNT = NAV_ITEMS.length;
const LAST_TAB_INDEX = NAV_TAB_COUNT - 1;
const NAV_TO_SECTION_KEY = {
  todos: "todos",
  habits: "habits",
  pomodoro: POMODORO_SECTION_KEY,
  workout: "workout",
  calories: "calories",
} as const;

type TopTabItemProps = {
  isFocused?: boolean;
  label: string;
  icon: string;
  color: string;
  surfaceColor: string;
  tabRailColor: string;
  tabRailBorderColor: string;
  inactiveColor: string;
  onPress?: () => void;
  style?: object;
  [key: string]: unknown;
};

/** expo-router TabTrigger may inject layout — row + center is re-applied after flatten(style). */
function TopTabItem({
  isFocused,
  label,
  icon,
  color,
  surfaceColor,
  tabRailColor,
  tabRailBorderColor,
  inactiveColor,
  onPress,
  style,
  ...rest
}: TopTabItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          minWidth: 0,
          backgroundColor: isFocused ? surfaceColor : tabRailColor,
          borderBottomWidth: isFocused ? 0 : 1,
          borderBottomColor: tabRailBorderColor,
          borderTopLeftRadius: isFocused ? 16 : 8,
          borderTopRightRadius: isFocused ? 16 : 8,
          marginTop: isFocused ? 0 : 3,
          marginBottom: isFocused ? -1 : 0,
          zIndex: isFocused ? 2 : 0,
          paddingVertical: 10,
          paddingHorizontal: 4,
        },
        StyleSheet.flatten(style),
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          minWidth: 0,
        },
      ]}
      {...rest}
    >
      <MaterialIcons
        name={icon as keyof typeof MaterialIcons.glyphMap}
        size={16}
        color={isFocused ? color : inactiveColor}
      />
      <Text
        style={{
          fontSize: 12,
          color: isFocused ? color : inactiveColor,
          fontWeight: isFocused ? "600" : "400",
          flexShrink: 1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { tokens, resolvedTheme } = useAppTheme();
  const router = useRouter();
  const segments = useSegments();
  const { width: screenWidth } = useWindowDimensions();
  const overviewColor = resolvedTheme === "dark" ? tokens.textMuted : "#475569";

  const currentIndex = useMemo(() => {
    const segs = segments as readonly string[];
    const tabsIdx = segs.indexOf("(tabs)");
    const tabSegment = tabsIdx !== -1 ? segs[tabsIdx + 1] : undefined;
    const idx = tabSegment ? NAV_ITEMS.findIndex((item) => item.name === tabSegment) : -1;
    return idx >= 0 ? idx : 0;
  }, [segments]);

  const isDeadZone = useSharedValue(false);
  const tabIndex = useSharedValue(currentIndex);
  const screenWidthSV = useSharedValue(screenWidth);

  useEffect(() => {
    tabIndex.value = currentIndex;
  }, [currentIndex, tabIndex]);

  useEffect(() => {
    screenWidthSV.value = screenWidth;
  }, [screenWidth, screenWidthSV]);

  const navigateToIndex = useCallback((index: number) => {
    if (index < 0 || index >= NAV_TAB_COUNT) return;
    router.navigate(NAV_ITEMS[index].href as Href);
  }, [router]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-30, 30])
        .onStart((event) => {
          "worklet";
          const w = screenWidthSV.value;
          isDeadZone.value = event.absoluteX < 40 || event.absoluteX > w - 40;
        })
        .onEnd((event) => {
          "worklet";
          const w = screenWidthSV.value;
          const idx = tabIndex.value;
          const tx = event.translationX;
          const vx = event.velocityX;

          if (!isDeadZone.value) {
            if ((tx > w / 3 || vx > 500) && idx > 0) {
              runOnJS(navigateToIndex)(idx - 1);
            } else if ((tx < -w / 3 || vx < -500) && idx < LAST_TAB_INDEX) {
              runOnJS(navigateToIndex)(idx + 1);
            }
          }
        }),
    [navigateToIndex],
  );

  return (
    <Tabs className="flex-1 flex-col">
      <TabList
        style={{
          flexDirection: "row",
          width: "100%",
          alignItems: "stretch",
          backgroundColor: tokens.tabRail,
          borderBottomWidth: 1,
          borderBottomColor: tokens.tabRailBorder,
          paddingHorizontal: 4,
          paddingTop: 4,
          gap: 2,
          zIndex: 10,
        }}
      >
        {NAV_ITEMS.map((item) => (
          <TabTrigger key={item.name} name={item.name} href={item.href} asChild>
            <TopTabItem
              label={item.label}
              icon={item.icon}
              color={
                item.name === "overview"
                  ? overviewColor
                  : resolvedTheme === "dark"
                    ? SECTION_COLORS[NAV_TO_SECTION_KEY[item.name]]
                    : item.color
              }
              surfaceColor={tokens.background}
              tabRailColor={tokens.tabRail}
              tabRailBorderColor={tokens.tabRailBorder}
              inactiveColor={tokens.iconMuted}
            />
          </TabTrigger>
        ))}
      </TabList>
      <GestureDetector gesture={pan}>
        <TabSlot className="flex-1" style={{ flex: 1, backgroundColor: tokens.background }} />
      </GestureDetector>
    </Tabs>
  );
}
