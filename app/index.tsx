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
import {
  POMODORO_SECTION_KEY,
  SECTION_COLORS,
  SECTION_ON_BRIGHT_INK,
} from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { type AppSection, useAppNavigation } from '@/core/providers/navigationContext';
import { Modal } from '@/core/ui/Modal';
import { Text } from '@/core/ui/Text';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
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
 * Minimum width of a phone-bar destination. V3 §9/§13 require >=44pt touch
 * targets and >=11px labels; six destinations plus the capture slot still fit
 * a 360px viewport when each destination keeps this floor.
 */
const BAR_TAB_MIN_WIDTH = 44;

/**
 * Six phone destinations (D3 validation gate, W10 — measured evidence in
 * `docs/ui-ux/v3-audit/w10/`): Today, To Do, Habits, Focus, Workout,
 * Calories, plus the capture slot. The five-destination Health-parent model
 * added a tap to starting a workout and logging a meal, so the six-tab
 * fallback shipped with the V3 visual restyle. `health` remains a valid
 * AppSection (deep links, linked-action targets, command executor) without a
 * bar destination.
 * Labels are part of the test/observability contract
 * (`journey-label-parity`), so any label change updates the parity guard's
 * consumers in the same commit.
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

/**
 * Wide-rail destinations: the same six sections (every destination is
 * directly reachable on desktop, so rail items highlight exactly). The W4.5
 * Health group label is gone with the six-tab model.
 */
const RAIL_ITEMS: NavItem[] = NAV_ITEMS;

/** Rail index a given section reports for swipe/highlight purposes. */
function railIndexFor(section: AppSection): number {
  return NAV_ITEMS.findIndex((item) => item.name === section);
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

/** Sections reachable only through the Health parent on the phone rail. */
// The six-tab model (W10 D3) gives Workout and Calories their own
// destinations; `health` is still a valid section for deep links, linked
// actions and command routing, but it is not a bar destination.

type TabButtonProps = {
  item: NavItem;
  isFocused: boolean;
  accent: string;
  /** Contrast-safe accent for the icon/label (falls back to `accent`). */
  accentInk?: string;
  layout: 'bar' | 'rail';
  /** DOM id of the section panel this tab controls (`aria-controls`). */
  controlsId: string;
  onPress: () => void;
  /** Receives Arrow key presses; returns the section focus should follow. */
  onArrowKey?: (direction: -1 | 1) => AppSection | null;
};

/** DOM ids linking every nav tab to the section panel it controls. */
const sectionTabId = (section: AppSection) => `sh-section-tab-${section}`;
const sectionPanelId = (section: AppSection) => `sh-section-panel-${section}`;

/**
 * One navigation destination: icon over label, with a tinted active capsule.
 *
 * Audit C §11: this is a `tab` inside a `tablist` (matching
 * `core/ui/SegmentedControl.tsx`), not a `button` inside a `tablist` — a
 * `tablist` whose children are buttons is invalid ARIA, so assistive tech
 * neither announces position/count nor honours `aria-selected`.
 */
function TabButton({
  item,
  isFocused,
  accent,
  accentInk,
  layout: layoutRole,
  controlsId,
  onPress,
  onArrowKey,
}: TabButtonProps) {
  const { tokens } = useAppTheme();
  const ink = accentInk ?? accent;
  const focusRing = useKeyboardFocusRing(tokens.accent);
  const isRail = layoutRole === 'rail';
  const railRef = useRef<View>(null);
  // The parent rebuilds `onArrowKey` on every render; keeping it in a ref lets
  // the DOM listener subscribe once instead of churning on each layout pass.
  const arrowKeyRef = useRef(onArrowKey);
  useEffect(() => {
    arrowKeyRef.current = onArrowKey;
  }, [onArrowKey]);

  /**
   * WAI-ARIA tabs keyboard support (web only): ArrowRight/ArrowLeft move the
   * selection (and the roving tab stop) with the existing navigation path, so
   * the rail behaves the way `role="tablist"` promises. Registered as a DOM
   * listener on the tab element itself, matching
   * `core/ui/SegmentedControl.tsx`.
   */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // SAFETY: only web reaches here; on web the ref is an HTMLElement.
    const node = railRef.current as unknown as HTMLElement | null;
    if (!node) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const handler = arrowKeyRef.current;
      if (!handler) return;
      event.preventDefault();
      const nextSection = handler(event.key === 'ArrowLeft' ? -1 : 1);
      // Roving tabindex: focus follows selection, so the newly selected tab is
      // the tab stop the user continues from.
      if (nextSection) document.getElementById(sectionTabId(nextSection))?.focus();
    };
    node.addEventListener('keydown', listener);
    return () => node.removeEventListener('keydown', listener);
  }, []);

  return (
    <Pressable
      ref={railRef}
      id={sectionTabId(item.name)}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: isFocused }}
      aria-selected={isFocused}
      aria-controls={controlsId}
      // Roving tabindex (WAI-ARIA tabs): only the selected destination is a
      // tab stop, so a keyboard user tabs INTO the rail once and then moves
      // with the arrow keys instead of tabbing through all six destinations on
      // every pass. `tabIndex` is forwarded verbatim by RN-Web. Web only:
      // native RN maps `tabIndex={-1}` to `focusable={false}`, and the arrow-key
      // handler above is web-only, so native keeps every destination focusable.
      tabIndex={Platform.OS === 'web' ? (isFocused ? 0 : -1) : undefined}
      focusable
      onPress={onPress}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      style={[
        {
          // Bar destinations hug their label and share the leftover width, so a
          // six-destination bar never truncates a label at 360px (V3 §9: labels
          // >= 11px, no truncated tabs). The explicit width floor keeps every
          // destination at or above the 44pt touch-target minimum.
          flexGrow: isRail ? undefined : 1,
          flexShrink: isRail ? undefined : 1,
          flexBasis: isRail ? undefined : 'auto',
          // Rail items stretch; bar destinations keep a 44pt touch-target floor
          // (the old `minWidth: 0` let six destinations shrink under it at 360).
          minWidth: isRail ? undefined : BAR_TAB_MIN_WIDTH,
          width: isRail ? '100%' : undefined,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          paddingVertical: isRail ? spacing.sm : spacing.xs,
          paddingHorizontal: isRail ? spacing.sm : 0,
          minHeight: size.touchTargetMin,
          borderRadius: radius.md,
          backgroundColor: isFocused ? `${accent}1F` : 'transparent',
        },
        focusRing.focusRingStyle,
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
          fontSize: isRail ? 12 : 11,
          letterSpacing: 0.1,
          // W16 (native qualification): Android's Nunito metrics render wider
          // than the web build's, so `numberOfLines={1}` ellipsised long
          // destinations (measured on-device: `Tod…`, `Habi…`, `Worko…`,
          // `Calori…` inside a 55.6dp slot). Asking the label to use the full
          // slot width removes the false ellipsis without changing the label,
          // its size, the tab count or the touch targets. Web keeps the same
          // single-line contract and a 360px bar still fits every label.
          alignSelf: 'stretch',
          textAlign: 'center',
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
      {/*
        §5.1 rule 1: the capture face is the BRIGHT brand gradient (Sprout
        #4DC93A), where `buttonText` is white in light mode — 2.16:1. Ink is
        8.61:1 and matches dark mode, whose buttonText is already ink.
      */}
      <MaterialIcons name="add" size={variant === 'bar' ? 28 : 24} color={SECTION_ON_BRIGHT_INK} />
    </Pressable>
  );
}

/** Cross-fades the active section while keeping every visited section mounted. */
function SectionContainer({
  children,
  isActive,
  section,
  ...rest
}: { isActive: boolean; children: React.ReactNode; section: AppSection } & ViewProps) {
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
    // SAFETY: only web reaches here; on web the ref is attached to a View,
    // which react-native-web renders as an HTMLElement. Type checks the RN
    // ViewProps contract cannot express (a DOM node only exists on web).
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.setAttribute !== 'function') return;
    if (isActive) node.removeAttribute('inert');
    else node.setAttribute('inert', '');
  }, [isActive]);

  return (
    <Animated.View
      ref={containerRef}
      {...rest}
      id={sectionPanelId(section)}
      // `role` (not `accessibilityRole`): RN's `AccessibilityRole` union omits
      // `tabpanel`, while the ARIA `Role` union includes it and RN maps `role`
      // to native accessibility on iOS/Android.
      role="tabpanel"
      aria-labelledby={sectionTabId(section)}
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

  // The highlighted bar destination: with the six-tab model every section
  // owns its destination, so the active section highlights exactly.
  const navActiveSection: AppSection = activeSection;

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
            <SectionContainer key={section} section={section} isActive={isActive}>
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
        controlsId={sectionPanelId(item.name)}
        onPress={() => setActiveSection(item.name)}
        onArrowKey={(direction) => {
          const index = railIndexFor(item.name);
          if (index < 0) return null;
          const nextIndex = (index + direction + NAV_TAB_COUNT) % NAV_TAB_COUNT;
          navigateToIndex(nextIndex);
          return NAV_ITEMS[nextIndex].name;
        }}
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
          {RAIL_ITEMS.map(buildRailButton)}
        </View>
      ) : null}

      <View style={{ flex: 1 }}>{sections}</View>

      {!useSideRail ? (
        <View
          style={{
            position: 'absolute',
            left: spacing.sm,
            right: spacing.sm,
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
            <View style={{ width: 52, alignItems: 'center', justifyContent: 'center' }}>
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
