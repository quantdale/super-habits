import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions, type ViewProps } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { POMODORO_SECTION_KEY, SECTION_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { type AppSection, useAppNavigation } from '@/core/providers/navigationContext';
import { Modal } from '@/core/ui/Modal';
import { OverviewScreen } from '@/features/overview/OverviewScreen';
import { TodosScreen } from '@/features/todos/TodosScreen';
import { HabitsScreen } from '@/features/habits/HabitsScreen';
import { PomodoroScreen } from '@/features/pomodoro/PomodoroScreen';
import { WorkoutScreen } from '@/features/workout/WorkoutScreen';
import { CaloriesScreen } from '@/features/calories/CaloriesScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { WeeklyReviewScreen } from '@/features/weekly-review/WeeklyReviewScreen';
import { PlanningHubScreen } from '@/features/planning-hub/PlanningHubScreen';
import { QuickCaptureOverlay } from '@/features/quick-capture/QuickCaptureOverlay';

type NavItem = {
  name: AppSection;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  sectionKey?: 'todos' | 'habits' | 'focus' | 'workout' | 'calories';
};

const NAV_ITEMS: NavItem[] = [
  { name: 'overview', label: 'Overview', icon: 'dashboard' },
  { name: 'todos', label: 'To Do', icon: 'check-circle-outline', sectionKey: 'todos' },
  { name: 'habits', label: 'Habits', icon: 'loop', sectionKey: 'habits' },
  { name: 'pomodoro', label: 'Focus', icon: 'timer', sectionKey: POMODORO_SECTION_KEY },
  { name: 'workout', label: 'Workout', icon: 'fitness-center', sectionKey: 'workout' },
  { name: 'calories', label: 'Calories', icon: 'restaurant-menu', sectionKey: 'calories' },
];

const NAV_TAB_COUNT = NAV_ITEMS.length;
const LAST_TAB_INDEX = NAV_TAB_COUNT - 1;

const SECTION_SCREENS: Record<AppSection, React.ComponentType<{ isActive: boolean }>> = {
  // Navigation changes only the active screen's `isActive` prop. Memoizing
  // the permanently mounted screens prevents inactive HEAVY lists/charts
  // from rebuilding on every tab switch while preserving their own state and
  // activation/foreground refresh effects.
  overview: memo(OverviewScreen),
  todos: memo(TodosScreen),
  habits: memo(HabitsScreen),
  pomodoro: memo(PomodoroScreen),
  workout: memo(WorkoutScreen),
  calories: memo(CaloriesScreen),
};

type TopTabItemProps = {
  isFocused?: boolean;
  label: string;
  icon: string;
  color: string;
  surfaceColor: string;
  tabRailColor: string;
  tabRailBorderColor: string;
  inactiveColor: string;
  focusRingColor: string;
  onPress?: () => void;
};

function TopTabItem({
  isFocused,
  label,
  icon,
  color,
  surfaceColor,
  tabRailColor,
  tabRailBorderColor,
  inactiveColor,
  focusRingColor,
  onPress,
}: TopTabItemProps) {
  // RN 0.83's Pressable style callback only exposes `pressed`, so keyboard
  // focus is tracked via onFocus/onBlur (functional on web) to draw the ring.
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      focusable
      onPress={onPress}
      onFocus={() => setKeyboardFocused(true)}
      onBlur={() => setKeyboardFocused(false)}
      style={[
        {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
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
          minHeight: 48,
        },
        // Visible keyboard-focus indication on web so the tab rail stays
        // fully keyboard-operable.
        keyboardFocused && Platform.OS === 'web'
          ? { outlineColor: focusRingColor, outlineStyle: 'solid', outlineWidth: 2 }
          : null,
      ]}
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
          fontWeight: isFocused ? '600' : '400',
          flexShrink: 1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionContainer({
  children,
  isActive,
  ...rest
}: { isActive: boolean; children: React.ReactNode } & ViewProps) {
  return (
    <View
      {...rest}
      aria-hidden={!isActive}
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: isActive ? 1 : 0,
          pointerEvents: isActive ? 'auto' : 'none',
          zIndex: isActive ? 1 : 0,
        },
      ]}
    >
      {children}
    </View>
  );
}

export default function Index() {
  const { tokens, resolvedTheme, sectionAccents } = useAppTheme();
  const {
    activeSection,
    mountedSections,
    setActiveSection,
    isSettingsOpen,
    closeSettings,
    isWeeklyReviewOpen,
    closeWeeklyReview,
    isPlanningHubOpen,
    planningHubInitialView,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    openPlanningHub: _openPlanningHub,
    closePlanningHub,
    isQuickCaptureOpen,
    openQuickCapture,
    closeQuickCapture,
  } = useAppNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const { top: safeAreaTop, bottom: safeAreaBottom } = useSafeAreaInsets();
  const overviewColor = resolvedTheme === 'dark' ? tokens.text : tokens.textMuted;

  const currentIndex = useMemo(
    () => NAV_ITEMS.findIndex((item) => item.name === activeSection),
    [activeSection],
  );

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
      tabIndex.value = index;
      setActiveSection(NAV_ITEMS[index].name);
    },
    [setActiveSection, tabIndex],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-30, 30])
        .onStart((event) => {
          'worklet';
          const w = screenWidthSV.value;
          isDeadZone.value = event.absoluteX < 40 || event.absoluteX > w - 40;
        })
        .onEnd((event) => {
          'worklet';
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
    // isDeadZone/screenWidthSV/tabIndex are Reanimated SharedValues: stable
    // refs read via `.value` inside worklets, not render-time dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigateToIndex],
  );

  return (
    <View
      className="flex-1 flex-col"
      style={{ backgroundColor: tokens.background, paddingTop: safeAreaTop }}
    >
      <View
        accessibilityLabel="Section tabs"
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          width: '100%',
          alignItems: 'stretch',
          backgroundColor: tokens.tabRail,
          borderBottomWidth: 1,
          borderBottomColor: tokens.tabRailBorder,
          paddingHorizontal: 4,
          paddingTop: 4,
          gap: 2,
          zIndex: 10,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const color =
            item.name === 'overview'
              ? overviewColor
              : item.sectionKey
                ? sectionAccents[item.sectionKey].text
                : tokens.text;
          return (
            <TopTabItem
              key={item.name}
              isFocused={activeSection === item.name}
              label={item.label}
              icon={item.icon}
              color={color}
              surfaceColor={tokens.background}
              tabRailColor={tokens.tabRail}
              tabRailBorderColor={tokens.tabRailBorder}
              inactiveColor={tokens.iconMuted}
              focusRingColor={tokens.accent}
              onPress={() => setActiveSection(item.name)}
            />
          );
        })}
      </View>

      <GestureDetector gesture={pan}>
        <View className="flex-1" style={{ flex: 1, backgroundColor: tokens.background }}>
          {NAV_ITEMS.map((item) => {
            const ScreenComponent = SECTION_SCREENS[item.name];
            const isActive = activeSection === item.name;
            const isMounted = mountedSections[item.name] || isActive;
            return (
              <SectionContainer key={item.name} isActive={isActive}>
                {isMounted ? <ScreenComponent isActive={isActive} /> : null}
              </SectionContainer>
            );
          })}
        </View>
      </GestureDetector>

      <Modal
        visible={isSettingsOpen}
        onClose={closeSettings}
        title="Settings"
        scroll
        layout="drawer"
      >
        <SettingsScreen visible={isSettingsOpen} onRequestClose={closeSettings} />
      </Modal>

      <Modal
        visible={isWeeklyReviewOpen}
        onClose={closeWeeklyReview}
        title="Weekly Review"
        scroll
        layout="drawer"
      >
        <WeeklyReviewScreen onClose={closeWeeklyReview} />
      </Modal>

      <Modal
        visible={isPlanningHubOpen}
        onClose={closePlanningHub}
        title="Planning Hub"
        scroll
        layout="drawer"
      >
        <PlanningHubScreen initialView={planningHubInitialView} />
      </Modal>

      <Modal
        visible={isQuickCaptureOpen}
        onClose={closeQuickCapture}
        title="Quick Capture"
        scroll
        layout="bottom-sheet"
      >
        <QuickCaptureOverlay />
      </Modal>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quick capture"
        onPress={openQuickCapture}
        className="absolute right-4 h-14 w-14 items-center justify-center rounded-full shadow-lg"
        style={{
          bottom: safeAreaBottom + 16,
          backgroundColor: SECTION_COLORS.focus,
          shadowColor: tokens.shadowColor,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <MaterialIcons name="add" size={26} color={tokens.textOnAccent} />
      </Pressable>
    </View>
  );
}
