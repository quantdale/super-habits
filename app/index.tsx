import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, type ViewProps } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { POMODORO_SECTION_KEY } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { type AppSection, useAppNavigation } from '@/core/providers/NavigationProvider';
import { Modal } from '@/core/ui/Modal';
import { OverviewScreen } from '@/features/overview/OverviewScreen';
import { TodosScreen } from '@/features/todos/TodosScreen';
import { HabitsScreen } from '@/features/habits/HabitsScreen';
import { PomodoroScreen } from '@/features/pomodoro/PomodoroScreen';
import { WorkoutScreen } from '@/features/workout/WorkoutScreen';
import { CaloriesScreen } from '@/features/calories/CaloriesScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';

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
  overview: OverviewScreen,
  todos: TodosScreen,
  habits: HabitsScreen,
  pomodoro: PomodoroScreen,
  workout: WorkoutScreen,
  calories: CaloriesScreen,
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
  onPress,
}: TopTabItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      onPress={onPress}
      style={{
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
      }}
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
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: isActive ? 1 : 0,
        pointerEvents: isActive ? 'auto' : 'none',
        zIndex: isActive ? 1 : 0,
      }}
    >
      {children}
    </View>
  );
}

export default function Index() {
  const { tokens, resolvedTheme, sectionAccents } = useAppTheme();
  const { activeSection, setActiveSection, isSettingsOpen, closeSettings } = useAppNavigation();
  const [screenWidth, setScreenWidth] = useState(0);
  const overviewColor = resolvedTheme === 'dark' ? tokens.text : tokens.textMuted;

  useEffect(() => {
    setScreenWidth(window.innerWidth);
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [mountedSections, setMountedSections] = useState<Record<AppSection, boolean>>(() => {
    const initial: Record<AppSection, boolean> = {
      overview: false,
      todos: false,
      habits: false,
      pomodoro: false,
      workout: false,
      calories: false,
    };
    initial.overview = true;
    return initial;
  });

  useEffect(() => {
    setMountedSections((current) => {
      if (current[activeSection]) return current;
      return { ...current, [activeSection]: true };
    });
  }, [activeSection]);

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
      setActiveSection(NAV_ITEMS[index].name);
    },
    [setActiveSection],
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
    <View className="flex-1 flex-col" style={{ backgroundColor: tokens.background }}>
      <View
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
              onPress={() => setActiveSection(item.name)}
            />
          );
        })}
      </View>

      <GestureDetector gesture={pan}>
        <View className="flex-1" style={{ flex: 1, backgroundColor: tokens.background }}>
          {NAV_ITEMS.map((item) => {
            const ScreenComponent = SECTION_SCREENS[item.name];
            const isMounted = mountedSections[item.name];
            const isActive = activeSection === item.name;
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
    </View>
  );
}
