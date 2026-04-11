import { useCallback, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useRouter, useSegments } from "expo-router";
import { Tabs, TabList, TabTrigger, TabSlot } from "expo-router/ui";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { SECTION_TEXT_COLORS } from "@/constants/sectionColors";
import { useAppTheme } from "@/core/theme";

const OVERVIEW_HREF = "/(tabs)/overview" as Href;
const NAV_TAB_COUNT = 6;
const LAST_TAB_INDEX = NAV_TAB_COUNT - 1;

<<<<<<< HEAD
/** Matches `Screen` / `bg-surface` so the active tab and tab content area read as one surface. */
const TAB_CONTENT_SURFACE = "#f8f7ff";

const TAB_RAIL_BG = "#eeecf8";
const TAB_RAIL_BORDER = "#d4d0ee";
const SETTINGS_ICON_COLOR = "#64748b";
const SETTINGS_BUTTON_BG = "#f6f4ff";
const SETTINGS_BUTTON_BORDER = "#d8d4f2";

=======
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
type TopTabItemProps = {
  isFocused?: boolean;
  label: string;
  icon: string;
  color: string;
  mutedColor: string;
  railBackground: string;
  railBorder: string;
  activeBackground: string;
  onPress?: () => void;
  style?: object;
  [key: string]: unknown;
};

function TopTabItem({
  isFocused,
  label,
  icon,
  color,
  mutedColor,
  railBackground,
  railBorder,
  activeBackground,
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
          backgroundColor: isFocused ? activeBackground : railBackground,
          borderBottomWidth: isFocused ? 0 : 1,
          borderBottomColor: railBorder,
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
        color={isFocused ? color : mutedColor}
      />
      <Text
        style={{
          fontSize: 12,
          color: isFocused ? color : mutedColor,
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
  const router = useRouter();
  const segments = useSegments();
  const { width: screenWidth } = useWindowDimensions();
  const { colors, overviewColor } = useAppTheme();

  const navItems = useMemo(
    () => [
      { name: "overview", href: OVERVIEW_HREF, label: "Overview", icon: "dashboard", color: overviewColor },
      { name: "todos", href: "/(tabs)/todos" as const, label: "To Do", icon: "check-circle-outline", color: SECTION_TEXT_COLORS.todos },
      { name: "habits", href: "/(tabs)/habits" as const, label: "Habits", icon: "loop", color: SECTION_TEXT_COLORS.habits },
      { name: "pomodoro", href: "/(tabs)/pomodoro" as const, label: "Focus", icon: "timer", color: SECTION_TEXT_COLORS.focus },
      { name: "workout", href: "/(tabs)/workout" as const, label: "Workout", icon: "fitness-center", color: SECTION_TEXT_COLORS.workout },
      { name: "calories", href: "/(tabs)/calories" as const, label: "Calories", icon: "restaurant-menu", color: SECTION_TEXT_COLORS.calories },
    ],
    [overviewColor],
  );

  const currentIndex = useMemo(() => {
    const segs = segments as readonly string[];
    const tabsIdx = segs.indexOf("(tabs)");
    const tabSegment = tabsIdx !== -1 ? segs[tabsIdx + 1] : undefined;
    const idx = tabSegment ? navItems.findIndex((item) => item.name === tabSegment) : -1;
    return idx >= 0 ? idx : 0;
  }, [navItems, segments]);

  const isDeadZone = useSharedValue(false);
  const tabIndex = useSharedValue(currentIndex);
  const screenWidthSV = useSharedValue(screenWidth);

  useEffect(() => {
    tabIndex.value = currentIndex;
  }, [currentIndex, tabIndex]);

  useEffect(() => {
    screenWidthSV.value = screenWidth;
  }, [screenWidth, screenWidthSV]);

  const navigateToIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= NAV_TAB_COUNT) return;
      router.navigate(navItems[index].href as Href);
    },
    [navItems, router],
  );

  const openSettings = useCallback(() => {
    router.push("/settings" as Href);
  }, [router]);

  const openSettings = useCallback(() => {
    router.push("/settings");
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
          backgroundColor: colors.tabRailBackground,
          borderBottomWidth: 1,
<<<<<<< HEAD
          borderBottomColor: TAB_RAIL_BORDER,
=======
          borderBottomColor: colors.tabRailBorder,
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
          paddingHorizontal: 8,
          paddingTop: 4,
          zIndex: 10,
        }}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "stretch", gap: 2 }}>
<<<<<<< HEAD
          {NAV_ITEMS.map((item) => (
            <TabTrigger key={item.name} name={item.name} href={item.href} asChild>
              <TopTabItem label={item.label} icon={item.icon} color={item.color} />
=======
          {navItems.map((item) => (
            <TabTrigger key={item.name} name={item.name} href={item.href} asChild>
              <TopTabItem
                label={item.label}
                icon={item.icon}
                color={item.color}
                mutedColor={colors.iconMuted}
                railBackground={colors.tabRailBackground}
                railBorder={colors.tabRailBorder}
                activeBackground={colors.tabActiveBackground}
              />
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
            </TabTrigger>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={openSettings}
          style={{
            marginLeft: 10,
            marginBottom: 1,
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 14,
            borderWidth: 1,
<<<<<<< HEAD
            borderColor: SETTINGS_BUTTON_BORDER,
            backgroundColor: SETTINGS_BUTTON_BG,
=======
            borderColor: colors.settingsButtonBorder,
            backgroundColor: colors.settingsButtonBackground,
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
            paddingHorizontal: 10,
          }}
          hitSlop={6}
        >
<<<<<<< HEAD
          <MaterialIcons name="settings" size={20} color={SETTINGS_ICON_COLOR} />
=======
          <MaterialIcons name="settings" size={20} color={colors.icon} />
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
        </Pressable>
      </TabList>
      <GestureDetector gesture={pan}>
        <TabSlot className="flex-1" style={{ flex: 1, backgroundColor: colors.surface }} />
      </GestureDetector>
    </Tabs>
  );
}
