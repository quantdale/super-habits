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
import { SECTION_HUES } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { type AppSection, useAppNavigation } from '@/core/providers/navigationContext';
import { Modal } from '@/core/ui/Modal';
import { Pressable3D } from '@/core/ui/Pressable3D';
import { Text } from '@/core/ui/Text';
import { Sprout } from '@/core/ui/illustrations/Sprout';
import {
  CaloriesIcon,
  FocusIcon,
  HabitsIcon,
  TodayIcon,
  TodosIcon,
  WorkoutIcon,
  heroIconMonochromeTones,
  type HeroIconProps,
} from '@/core/ui/illustrations/icons';
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
import { ShellRewardChips } from '@/features/gamification/ShellRewardChips';

type NavItem = {
  name: AppSection;
  label: string;
  /** P10: duotone hero icon for the destination tile (§5.9). */
  heroIcon: React.ComponentType<HeroIconProps>;
  /** P10: section hue painting the active tile + duotone icon (§7 Shell). */
  hue: (typeof SECTION_HUES)[keyof typeof SECTION_HUES];
};

/** How a destination tile lays out: phone bar, narrow rail, wide sidebar. */
export type ShellNavLayout = 'bar' | 'rail' | 'rail-wide';

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
// NOTE: `journey-label-parity.mjs` parses `{ name: '…', label: '…'` pairs from
// this block — keep each entry's `name`/`label` prefix contiguous on one line.
const NAV_ITEMS: NavItem[] = [
  { name: 'overview', label: 'Today', heroIcon: TodayIcon, hue: SECTION_HUES.habits },
  { name: 'todos', label: 'To Do', heroIcon: TodosIcon, hue: SECTION_HUES.todos },
  { name: 'habits', label: 'Habits', heroIcon: HabitsIcon, hue: SECTION_HUES.habits },
  { name: 'pomodoro', label: 'Focus', heroIcon: FocusIcon, hue: SECTION_HUES.focus },
  { name: 'workout', label: 'Workout', heroIcon: WorkoutIcon, hue: SECTION_HUES.workout },
  { name: 'calories', label: 'Calories', heroIcon: CaloriesIcon, hue: SECTION_HUES.calories },
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
  layout: ShellNavLayout;
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
  layout: layoutRole,
  controlsId,
  onPress,
  onArrowKey,
}: TabButtonProps) {
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  // P10 tiles (§7 Shell): active tile = section tint face + 2px section-bright
  // ring; the duotone hero icon paints in the section hue when active and in
  // monochrome `iconMuted` when not.
  const hue = item.hue;
  const tint = isDark ? hue.tintDark : hue.tintLight;
  const ink = isDark ? hue.bright : hue.solid;
  // r2 defect fix: the inactive icon keeps its duotone detail in two distinct
  // muted tones (never one flat silhouette); both stay >= 3:1 vs the tile.
  const monochrome = heroIconMonochromeTones(tokens.textMuted, tokens.iconMuted);
  const focusRing = useKeyboardFocusRing(tokens.accent);
  const isRail = layoutRole !== 'bar';
  const isWide = layoutRole === 'rail-wide';
  const HeroIcon = item.heroIcon;
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
          flexDirection: isWide ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: isWide ? 'flex-start' : 'center',
          gap: isWide ? spacing.sm : 2,
          paddingVertical: isRail ? spacing.sm : spacing.xs,
          paddingHorizontal: isWide ? spacing.md : isRail ? spacing.sm : 0,
          minHeight: isWide ? 48 : size.touchTargetMin,
          borderRadius: 14,
          backgroundColor: isFocused ? tint : 'transparent',
        },
        focusRing.focusRingStyle,
      ]}
    >
      {isFocused ? (
        // The active tile's 2px section-bright border (§6 Tabs). Painted as an
        // absolute ring so the label keeps the full slot width and never
        // truncates at 360px.
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: hue.bright,
          }}
        />
      ) : null}
      <HeroIcon
        size={28}
        bright={isFocused ? hue.bright : monochrome.bright}
        lip={isFocused ? hue.lip : monochrome.lip}
      />
      <Text
        variant="caption"
        style={{
          color: isFocused ? ink : tokens.textMuted,
          fontSize: isWide ? 15 : isRail ? 12 : 11,
          fontWeight: isWide ? '800' : undefined,
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
 * The quick-capture affordance: the phone bar's round Sprout slot (or the
 * rail's header action on wide screens). P10 (§6 Tabs): a 52px round Sprout
 * Pressable3D with a white "+" — the brand face replaces the old gradient so
 * the capture control follows the §5.7 "no gradients on surfaces" rule. The
 * `add` glyph stays a MaterialIcons fallback where `a11yAudit` expects it.
 * The face is the SOLID Sprout tier (§5.1: solid = white-label AA variant):
 * white on solid #1A7F2B is 5.10:1, white on bright #4DC93A only 2.16:1.
 */
function CaptureButton({ onPress, variant }: { onPress: () => void; variant: 'bar' | 'rail' }) {
  const diameter = variant === 'bar' ? 52 : 44;
  return (
    <Pressable3D
      lip={4}
      faceColor={SECTION_HUES.habits.solid}
      lipColor={SECTION_HUES.habits.lip}
      radius={radius.full}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Quick capture"
      contentStyle={{
        width: diameter,
        height: diameter,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialIcons name="add" size={variant === 'bar' ? 28 : 24} color="#FFFFFF" />
    </Pressable3D>
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
  const { tokens } = useAppTheme();
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
  const useSideRail = screenWidth >= layout.railBreakpoint;
  // P10 (§7 Shell): 900–1279 keeps an 80px tile rail; >=1280 gets the full
  // 248px sidebar with labels, the Sprout Add button and the reward chips.
  const isWideSidebar = screenWidth >= 1280;

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
  function buildTabButton(item: NavItem, isFocused: boolean, layoutRole: ShellNavLayout) {
    return (
      <TabButton
        key={item.name}
        item={item}
        isFocused={isFocused}
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
    buildTabButton(
      item,
      navActiveSection === item.name,
      useSideRail ? (isWideSidebar ? 'rail-wide' : 'rail') : 'bar',
    ),
  );

  /** Rail/sidebar buttons highlight exactly — every child is directly visible. */
  const railLayout: ShellNavLayout = isWideSidebar ? 'rail-wide' : 'rail';
  const railItems = RAIL_ITEMS.map((item) =>
    buildTabButton(item, activeSection === item.name, railLayout),
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
            width: isWideSidebar ? 248 : 80,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.lg,
            gap: spacing.sm,
            backgroundColor: tokens.tabRail,
            borderRightWidth: 1,
            borderRightColor: tokens.tabRailBorder,
          }}
        >
          <View
            style={{
              alignItems: isWideSidebar ? 'stretch' : 'center',
              marginBottom: spacing.md,
              gap: spacing.sm,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: isWideSidebar ? 'flex-start' : 'center',
                gap: spacing.sm,
              }}
            >
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
              {/* Mascot mark (§7 Shell sidebar): Sprout beside the logo. */}
              {isWideSidebar ? <Sprout pose="idle" size={28} /> : null}
            </View>
            {isWideSidebar ? (
              <Pressable3D
                lip={4}
                faceColor={SECTION_HUES.habits.solid}
                lipColor={SECTION_HUES.habits.lip}
                radius={16}
                onPress={openCapture}
                accessibilityRole="button"
                accessibilityLabel="Quick capture"
                contentStyle={{
                  height: 52,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                }}
              >
                <MaterialIcons name="add" size={24} color="#FFFFFF" />
                <Text variant="label" style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>
                  Add
                </Text>
              </Pressable3D>
            ) : (
              <CaptureButton onPress={openCapture} variant="rail" />
            )}
          </View>
          {railItems}
          {/* Sidebar footer (§7 Shell): Streak + XP chips on desktop. */}
          {isWideSidebar ? (
            <View style={{ marginTop: 'auto', paddingTop: spacing.md }}>
              <ShellRewardChips />
            </View>
          ) : null}
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
              // P10 (§7 Shell): the bar is a 2px-border white pill of tiles.
              borderWidth: 2,
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
