import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { HealthScreen } from '@/features/health/HealthScreen';
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
 * Five phone destinations (V3 five-destination model — docs/ui-ux/13 §9):
 * Health parents Workout + Calories; the bar's center slot is quick capture.
 * Labels are part of the test/observability contract (`journey-label-parity`),
 * so they stay verbatim while the rail they render into is free to change
 * shape. `workout`/`calories` remain first-class AppSections — deep links,
 * linked actions, and the command executor keep working; on phone they render
 * with the Health tab highlighted (see navActiveSection).
 */
const NAV_ITEMS: NavItem[] = [
  { name: 'overview', label: 'Today', icon: 'today' },
  { name: 'todos', label: 'To Do', icon: 'checklist', sectionKey: 'todos' },
  { name: 'habits', label: 'Habits', icon: 'auto-awesome', sectionKey: 'habits' },
  { name: 'pomodoro', label: 'Focus', icon: 'timer', sectionKey: POMODORO_SECTION_KEY },
  { name: 'health', label: 'Health', icon: 'favorite', sectionKey: 'health' },
];

const NAV_TAB_COUNT = NAV_ITEMS.length;
const LAST_TAB_INDEX = NAV_TAB_COUNT - 1;

/**
 * Desktop-rail extension (W4.5 Fix C): on >=900px layouts the rail exposes
 * direct Workout/Calories destinations under a Health group label. Phone keeps
 * the five-destination + capture-slot model (compression is a phone-width
 * problem; campaign §9 — "do not force phone and desktop to use identical
 * navigation density"). Rail items highlight exactly (no parent-covering),
 * because every child is directly reachable here.
 */
const RAIL_PRIMARY_ITEMS: NavItem[] = NAV_ITEMS.filter((item) => item.name !== 'health');
const RAIL_HEALTH_ITEMS: NavItem[] = [
  { name: 'health', label: 'Health', icon: 'favorite', sectionKey: 'health' },
  { name: 'workout', label: 'Workout', icon: 'fitness-center', sectionKey: 'workout' },
  { name: 'calories', label: 'Calories', icon: 'restaurant', sectionKey: 'calories' },
];

/** Rail index a given section reports for swipe/highlight purposes. */
function railIndexFor(section: AppSection): number {
  const direct = NAV_ITEMS.findIndex((item) => item.name === section);
  if (direct >= 0) return direct;
  if (section === 'workout' || section === 'calories') {
    return NAV_ITEMS.findIndex((item) => item.name === 'health');
  }
  return -1;
}

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
  health: memo(HealthScreen),
};

/** Sections that highlight the Health tab instead of their own (absent) tab. */
const HEALTH_CHILD_SECTIONS: ReadonlySet<AppSection> = new Set(['workout', 'calories']);

type TabButtonProps = {
  item: NavItem;
  isFocused: boolean;
  accent: string;
  /** Contrast-safe accent for the icon/label (falls back to `accent`). */
  accentInk?: string;
  layout: 'bar' | 'rail';
  onPress: () => void;
};

/** One navigation destination: icon over label, with a tinted active capsule. */
function TabButton({
  item,
  isFocused,
  accent,
  accentInk,
  layout: layoutRole,
  onPress,
}: TabButtonProps) {
  const { tokens } = useAppTheme();
  const ink = accentInk ?? accent;
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
        size={isRail ? 24 : 23}
        color={isFocused ? ink : tokens.iconMuted}
      />
      <Text
        variant="caption"
        style={{
          color: isFocused ? ink : tokens.textMuted,
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

/**
 * The quick-capture affordance: the phone bar's raised center slot (or the
 * rail's header action on wide screens). V3 replaces Pop's free-floating FAB,
 * which overlapped card content and form fields on 4 of 6 sections (defect
 * SYS-04). This is the one surface the brand gradient survives on.
 */
function CaptureButton({ onPress, variant }: { onPress: () => void; variant: 'bar' | 'rail' }) {
  const { tokens } = useAppTheme();
  const diameter = variant === 'bar' ? 52 : 44;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Quick capture"
      onPress={onPress}
      style={{
        width: diameter,
        height: diameter,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...elevation.level2,
        shadowColor: tokens.glow,
        shadowOpacity: 0.3,
      }}
    >
      <LinearGradient
        colors={[tokens.brandGradient[0], tokens.brandGradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <MaterialIcons name="add" size={variant === 'bar' ? 28 : 24} color={tokens.buttonText} />
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
  const containerRef = useRef<View>(null);

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

  // Mounted-but-inactive sections keep their state for the cross-fade and are
  // aria-hidden, but that alone leaves their controls in the keyboard tab
  // order. Mark the subtree `inert` on web so focus cannot land on a control
  // the user cannot see.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.setAttribute !== 'function') return;
    if (isActive) node.removeAttribute('inert');
    else node.setAttribute('inert', '');
  }, [isActive]);

  return (
    <Animated.View
      ref={containerRef}
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

  // The tab a rail item highlights for the current section: Health covers its
  // workout/calories children on phone.
  const navActiveSection: AppSection = HEALTH_CHILD_SECTIONS.has(activeSection)
    ? 'health'
    : activeSection;

  const currentIndex = useMemo(() => railIndexFor(activeSection), [activeSection]);

  const isDeadZone = useSharedValue(false);
  const tabIndex = useSharedValue(Math.max(currentIndex, 0));
  const screenWidthSV = useSharedValue(screenWidth);

  useEffect(() => {
    if (currentIndex >= 0) tabIndex.value = currentIndex;
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

  const openCapture = useCallback(() => {
    // Open the sheet after the opening gesture completes. Creating
    // the modal window synchronously inside the press lets the
    // gesture's release re-target to freshly laid-out sheet content
    // under the finger, skipping the sheet straight into advanced
    // capture on small screens.
    setTimeout(() => openQuickCapture(), 0);
  }, [openQuickCapture]);

  const sections = (
    <GestureDetector gesture={pan}>
      <View className="flex-1" style={{ flex: 1, backgroundColor: tokens.background }}>
        {(Object.keys(SECTION_SCREENS) as AppSection[]).map((section) => {
          const ScreenComponent = SECTION_SCREENS[section];
          const isActive = activeSection === section;
          const isMounted = mountedSections[section] || isActive;
          return (
            <SectionContainer key={section} isActive={isActive}>
              {isMounted ? <ScreenComponent isActive={isActive} /> : null}
            </SectionContainer>
          );
        })}
      </View>
    </GestureDetector>
  );

  /** One navigation destination button; highlight + layout resolved by caller. */
  function buildTabButton(item: NavItem, isFocused: boolean, layoutRole: 'bar' | 'rail') {
    const accent =
      item.sectionKey && item.sectionKey !== POMODORO_SECTION_KEY
        ? sectionAccents[item.sectionKey].fill
        : item.name === 'overview'
          ? overviewColor
          : item.name === 'pomodoro'
            ? sectionAccents[POMODORO_SECTION_KEY].fill
            : sectionAccents.health.fill;
    // The active capsule tints from the fill; the icon/label use the
    // contrast-safe variant (identical on dark themes, darker on light).
    const accentInk =
      item.sectionKey && item.sectionKey !== POMODORO_SECTION_KEY
        ? sectionAccents[item.sectionKey].text
        : item.name === 'overview'
          ? overviewColor
          : item.name === 'pomodoro'
            ? sectionAccents[POMODORO_SECTION_KEY].text
            : sectionAccents.health.text;
    return (
      <TabButton
        key={item.name}
        item={item}
        isFocused={isFocused}
        accent={accent}
        accentInk={accentInk}
        layout={layoutRole}
        onPress={() => setActiveSection(item.name)}
      />
    );
  }

  const navItems = NAV_ITEMS.map((item) =>
    buildTabButton(item, navActiveSection === item.name, useSideRail ? 'rail' : 'bar'),
  );

  /** Rail buttons highlight exactly — every rail child is directly visible. */
  const buildRailButton = useCallback(
    (item: NavItem) => buildTabButton(item, activeSection === item.name, 'rail'),
    // buildTabButton closes over render-scope theme/navigation values; the
    // activeSection dep is the only reactive input the callback captures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSection],
  );

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
          <View style={{ alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm }}>
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
            <CaptureButton onPress={openCapture} variant="rail" />
          </View>
          {RAIL_PRIMARY_ITEMS.map(buildRailButton)}
          <View style={{ marginTop: spacing.sm, marginBottom: -spacing.xs }}>
            <Text
              variant="caption"
              tone="muted"
              style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' }}
              numberOfLines={1}
            >
              Health
            </Text>
          </View>
          {RAIL_HEALTH_ITEMS.map(buildRailButton)}
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
            {navItems.slice(0, 3)}
            <View style={{ width: 64, alignItems: 'center', justifyContent: 'center' }}>
              <CaptureButton onPress={openCapture} variant="bar" />
            </View>
            {navItems.slice(3)}
          </View>
        </View>
      ) : null}

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
