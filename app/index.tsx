import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewProps,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { POMODORO_SECTION_KEY, SECTION_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { type AppSection, useAppNavigation } from '@/core/providers/navigationContext';
import { Modal } from '@/core/ui/Modal';
import { Text } from '@/core/ui/Text';
import { elevation, layout, radius, size, spacing } from '@/core/theme/designTokens';
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
import { AchievementsScreen } from '@/features/gamification/AchievementsScreen';

type NavItem = {
  name: AppSection;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  sectionKey?: keyof typeof SECTION_COLORS;
};

/**
 * Six sections in product order. Labels are part of the test/observability
 * contract (`journey-label-parity`), so they stay verbatim while the rail they
 * render into is free to change shape.
 */
const NAV_ITEMS: NavItem[] = [
  { name: 'overview', label: 'Today', icon: 'today' },
  { name: 'todos', label: 'To Do', icon: 'checklist', sectionKey: 'todos' },
  { name: 'habits', label: 'Habits', icon: 'auto-awesome', sectionKey: 'habits' },
  { name: 'pomodoro', label: 'Focus', icon: 'timer', sectionKey: POMODORO_SECTION_KEY },
  { name: 'workout', label: 'Workout', icon: 'fitness-center', sectionKey: 'workout' },
  { name: 'calories', label: 'Calories', icon: 'restaurant', sectionKey: 'calories' },
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

type TabButtonProps = {
  item: NavItem;
  isFocused: boolean;
  accent: string;
  layout: 'bar' | 'rail';
  onPress: () => void;
};

/** One navigation destination: icon over label, with a tinted active capsule. */
function TabButton({ item, isFocused, accent, layout: layoutRole, onPress }: TabButtonProps) {
  const { tokens } = useAppTheme();
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const isRail = layoutRole === 'rail';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: isFocused }}
      focusable
      onPress={onPress}
      onFocus={() => setKeyboardFocused(true)}
      onBlur={() => setKeyboardFocused(false)}
      style={[
        {
          flex: isRail ? undefined : 1,
          width: isRail ? '100%' : undefined,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          minWidth: 0,
          paddingVertical: isRail ? spacing.sm : spacing.xs,
          paddingHorizontal: isRail ? spacing.sm : 2,
          minHeight: size.touchTargetMin,
          borderRadius: radius.md,
          backgroundColor: isFocused ? `${accent}1F` : 'transparent',
        },
        keyboardFocused && Platform.OS === 'web'
          ? { outlineColor: tokens.accent, outlineStyle: 'solid', outlineWidth: 2 }
          : null,
      ]}
    >
      <MaterialIcons
        name={item.icon}
        size={isRail ? 26 : 23}
        color={isFocused ? accent : tokens.iconMuted}
      />
      <Text
        variant="caption"
        style={{
          color: isFocused ? accent : tokens.textMuted,
          fontSize: isRail ? 12 : 10.5,
          letterSpacing: 0.1,
        }}
        numberOfLines={1}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

/** Cross-fades the active section while keeping every visited section mounted. */
function SectionContainer({
  children,
  isActive,
  ...rest
}: { isActive: boolean; children: React.ReactNode } & ViewProps) {
  const [opacity] = useState(() => new Animated.Value(isActive ? 1 : 0));
  const [translate] = useState(() => new Animated.Value(isActive ? 0 : 12));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: isActive ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: isActive ? 0 : 12,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isActive, opacity, translate]);

  return (
    <Animated.View
      {...rest}
      aria-hidden={!isActive}
      style={[
        StyleSheet.absoluteFill,
        {
          opacity,
          transform: [{ translateY: translate }],
          pointerEvents: isActive ? 'auto' : 'none',
          zIndex: isActive ? 1 : 0,
        },
      ]}
    >
      {children}
    </Animated.View>
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
    closePlanningHub,
    isQuickCaptureOpen,
    openQuickCapture,
    closeQuickCapture,
    isAchievementsOpen,
    closeAchievements,
  } = useAppNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const { top: safeAreaTop, bottom: safeAreaBottom } = useSafeAreaInsets();
  const overviewColor = resolvedTheme === 'dark' ? tokens.text : tokens.textMuted;
  const useSideRail = screenWidth >= layout.railBreakpoint;

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

  const sections = (
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
  );

  const navItems = NAV_ITEMS.map((item) => {
    const accent =
      item.name === 'overview'
        ? overviewColor
        : item.sectionKey
          ? sectionAccents[item.sectionKey].fill
          : tokens.primary;
    return (
      <TabButton
        key={item.name}
        item={item}
        isFocused={activeSection === item.name}
        accent={accent}
        layout={useSideRail ? 'rail' : 'bar'}
        onPress={() => setActiveSection(item.name)}
      />
    );
  });

  return (
    <View
      className="flex-1"
      style={{
        flex: 1,
        flexDirection: useSideRail ? 'row' : 'column',
        backgroundColor: tokens.background,
        paddingTop: safeAreaTop,
      }}
    >
      {useSideRail ? (
        <View
          accessibilityLabel="Section tabs"
          accessibilityRole="tablist"
          style={{
            width: 104,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.lg,
            gap: spacing.sm,
            backgroundColor: tokens.tabRail,
            borderRightWidth: 1,
            borderRightColor: tokens.tabRailBorder,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LinearGradient
                colors={[tokens.brandGradient[0], tokens.brandGradient[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <MaterialIcons name="bolt" size={24} color={tokens.buttonText} />
            </View>
          </View>
          {navItems}
        </View>
      ) : null}

      <View style={{ flex: 1 }}>{sections}</View>

      {!useSideRail ? (
        <View
          style={{
            position: 'absolute',
            left: spacing.md,
            right: spacing.md,
            bottom: Math.max(safeAreaBottom, spacing.sm),
            zIndex: 20,
          }}
        >
          <View
            accessibilityLabel="Section tabs"
            accessibilityRole="tablist"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              paddingHorizontal: spacing.xs,
              paddingVertical: spacing.xs,
              borderRadius: radius.xl,
              backgroundColor: tokens.tabRail,
              borderWidth: 1,
              borderColor: tokens.tabRailBorder,
              ...elevation.level2,
              shadowColor: tokens.glow,
              shadowOpacity: 0.18,
            }}
          >
            {navItems}
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quick capture"
        onPress={() => {
          // Open the sheet after the opening gesture completes. Creating
          // the modal window synchronously inside the press lets the
          // gesture's release re-target to freshly laid-out sheet content
          // under the finger, skipping the sheet straight into advanced
          // capture on small screens.
          setTimeout(() => openQuickCapture(), 0);
        }}
        style={{
          position: 'absolute',
          right: useSideRail ? spacing.xl : spacing.lg,
          bottom: useSideRail
            ? Math.max(safeAreaBottom, spacing.xl)
            : Math.max(safeAreaBottom, spacing.sm) + size.tabBarHeight + spacing.md,
          width: size.fab,
          height: size.fab,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          zIndex: 21,
          ...elevation.level2,
          shadowColor: tokens.glow,
          shadowOpacity: 0.35,
        }}
      >
        <LinearGradient
          colors={[tokens.brandGradient[0], tokens.brandGradient[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <MaterialIcons name="add" size={30} color={tokens.buttonText} />
      </Pressable>

      <Modal
        visible={isSettingsOpen}
        onClose={closeSettings}
        title="Settings"
        scroll
        modalLayout="drawer"
      >
        <SettingsScreen visible={isSettingsOpen} onRequestClose={closeSettings} />
      </Modal>

      <Modal
        visible={isWeeklyReviewOpen}
        onClose={closeWeeklyReview}
        title="Weekly Review"
        scroll
        modalLayout="drawer"
      >
        <WeeklyReviewScreen onClose={closeWeeklyReview} />
      </Modal>

      <Modal
        visible={isPlanningHubOpen}
        onClose={closePlanningHub}
        title="Plan"
        scroll
        modalLayout="drawer"
      >
        <PlanningHubScreen initialView={planningHubInitialView} />
      </Modal>

      <Modal
        visible={isQuickCaptureOpen}
        onClose={closeQuickCapture}
        title="Add"
        scroll
        modalLayout="bottom-sheet"
      >
        <QuickCaptureOverlay />
      </Modal>

      <Modal
        visible={isAchievementsOpen}
        onClose={closeAchievements}
        title="Level & Achievements"
        scroll
        modalLayout="drawer"
      >
        <AchievementsScreen />
      </Modal>
    </View>
  );
}
