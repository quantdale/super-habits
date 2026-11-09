import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { inkOnFill, tintOver } from '@/core/theme/contrast';
import { radius, spacing } from '@/core/theme/designTokens';
import { useReducedMotion } from '@/core/theme/motion';
import { SECTION_HUES, SECTION_ON_BRIGHT_INK } from '@/constants/sectionColors';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';

/**
 * Switch — the Playful Momentum chunky switch (§7 Settings: "Sounds/Haptics
 * toggles (existing) use a chunky switch (Sprout track, white knob with lip)").
 *
 * Shape: a rounded **track** whose fill is the Sprout bright while the first
 * position is active and the quiet `surfaceSunken` pair (with a `border`
 * outline) otherwise, plus a **knob** carrying a 2px lip that sits over the
 * active position. Same physical vocabulary as `Pressable3D`: solid fill, lip,
 * no gradient, no blur shadow. The track hugs its two labels instead of
 * stretching across the row, so it reads as a switch rather than as a
 * full-width segmented control.
 *
 * Labelled positions are deliberate: the two preference controls this replaces
 * are addressed in the suite by their words (`Sounds off`, `Haptics off`), so
 * every state word stays a real, tappable control. Each position is a `radio`
 * whose accessible name is exactly its label.
 *
 * Contrast (§5.1, measured against the actual track fill):
 * - **on** — track = Sprout `bright`; labels take the bright-fill ink
 *   (`SECTION_ON_BRIGHT_INK`, 8.61:1), because white text is never painted on
 *   bright (§5.1 rule 1). The knob's white face carries the active label
 *   (ink on white). The knob slab itself is a near-white surface, so the
 *   control never relies on white-on-bright for its shape either.
 * - **off** — track = `surfaceSunken`, labels = `text` (14.2:1 light, 16.6:1
 *   dark); knob face `surfaceElevated`, lip `borderStrong` (§5.7 quiet pair).
 * - A caller-supplied `onTrackColor` still resolves its label ink through
 *   `inkOnFill`, so a hue swap can never silently land under AA.
 * - Selection never depends on colour alone: the active position carries the
 *   raised knob slab **and** an 800-weight label (inactive is 700).
 *
 * Motion: the knob slides to the newly active position with a 140ms
 * `withTiming`; under reduced motion it snaps with no translate at all. The
 * track fill changes instantly in both cases, so state is never
 * animation-gated.
 *
 * Accessibility: the group is a `radiogroup` named by `accessibilityLabel`;
 * each position is a `radio` with `accessibilityState.selected` +
 * `aria-checked` + `aria-pressed` (this react-native-web version does not map
 * `accessibilityState` to the DOM, and the previous pill pair exposed
 * `aria-pressed`). Arrow keys move the switch and Space/Enter activate the
 * focused position — RN-Web's press responder maps Space only to
 * `button`-shaped roles, and RN's `Pressable` typing has no keyboard handler
 * prop, so the web path binds a `keydown` listener the same way
 * `SegmentedControl` binds its arrow keys.
 *
 * Deliberately NOT react-native's `Switch`: the native control paints the
 * platform toggle (OS pill + circular thumb + platform chrome) and cannot carry
 * the lip, the Sprout track or labelled positions.
 */
export type SwitchOption<T extends string> = {
  value: T;
  /** Visible label and the position's accessible name. */
  label: string;
};

export type SwitchProps<T extends string> = {
  /** Exactly two options, left to right. */
  options: readonly [SwitchOption<T>, SwitchOption<T>];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the `radiogroup`. */
  accessibilityLabel: string;
  /** Track fill of the first ("on") position; defaults to Sprout bright. */
  onTrackColor?: string;
  disabled?: boolean;
  testID?: string;
};

/** Track height: the visible slab (§5.6 control geometry, ≥44 with padding). */
const TRACK_HEIGHT = 44;
const TRACK_PADDING = 2;
const KNOB_LIP = 2;
const SLIDE_DURATION = 140;

type SegmentLayout = { x: number; width: number };

export function Switch<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  onTrackColor,
  disabled = false,
  testID,
}: SwitchProps<T>) {
  const { tokens } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const ring = useKeyboardFocusRing(tokens.accent);
  const trackRef = useRef<View>(null);
  const [layouts, setLayouts] = useState<(SegmentLayout | null)[]>([null, null]);
  const knob = useSharedValue({ x: 0, width: 0 });

  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const active = layouts[activeIndex];

  useEffect(() => {
    if (!active) return;
    const next = { x: active.x, width: active.width };
    knob.value = reducedMotion ? next : withTiming(next, { duration: SLIDE_DURATION });
  }, [active, knob, reducedMotion]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knob.value.x }],
    width: knob.value.width,
  }));

  const select = (next: T) => {
    if (disabled) return;
    if (next === value) return;
    onChange(next);
  };

  const measure = (index: number) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setLayouts((current) => {
      const existing = current[index];
      if (existing && existing.x === x && existing.width === width) return current;
      const next = [...current];
      next[index] = { x, width };
      return next;
    });
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || disabled) return undefined;
    // SAFETY: only web reaches here; on web the ref is attached to a View,
    // which react-native-web renders as an HTMLElement — RN exposes no typed
    // keyboard handler for the native path.
    const node = trackRef.current as unknown as HTMLElement | null;
    if (!node) return undefined;
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        select(options[event.key === 'ArrowLeft' ? 0 : 1].value);
        return;
      }
      if (event.key !== ' ' && event.key !== 'Spacebar' && event.key !== 'Enter') return;
      // Space/Enter activate the focused position; Space would otherwise
      // scroll the settings sheet.
      event.preventDefault();
      const focusedLabel = (event.target as HTMLElement | null)?.textContent?.trim();
      const match = options.find((option) => option.label === focusedLabel);
      select((match ?? options[1 - activeIndex]).value);
    };
    node.addEventListener('keydown', listener);
    return () => node.removeEventListener('keydown', listener);
  });

  const onTrack = onTrackColor ?? SECTION_HUES.habits.bright;
  const isOn = activeIndex === 0;
  const trackFill = isOn ? onTrack : tokens.surfaceSunken;
  const trackBorder = isOn ? tintOver(onTrack, '#000000', 0.3) : tokens.border;
  // §7 says "white knob with lip", and white is also the only face that keeps
  // the label legible in BOTH readings of the control: the ink sits on the
  // knob's white slab (~18.6:1) and on the Sprout track behind it (8.61:1), so
  // the rendered-contrast audit and the human eye agree in every theme. The OFF
  // knob is the theme's own raised surface, which is the quiet §5.7 pair.
  const knobLip = isOn ? tintOver(onTrack, '#000000', 0.25) : tokens.borderStrong;
  const knobFace = isOn ? '#FFFFFF' : tokens.surfaceElevated;
  // §5.1: bright never carries white text. Both labels paint over the track
  // (the knob is a sliding slab behind them), so both resolve against the
  // track fill: ink on Sprout bright reads 8.61:1 and ink on the white knob
  // ~16:1, so the label is legible whichever of the two shows through. Position,
  // weight and the raised knob carry the selection — never colour alone.
  const trackInk = isOn ? inkOnFill(onTrack, SECTION_ON_BRIGHT_INK, '#FFFFFF') : tokens.text;
  const inactiveInk = isOn ? trackInk : tokens.textMuted;

  return (
    <View testID={testID} style={{ alignSelf: 'flex-start' }}>
      <View
        ref={trackRef}
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        style={{
          position: 'relative',
          flexDirection: 'row',
          minHeight: TRACK_HEIGHT,
          padding: TRACK_PADDING,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: trackBorder,
          backgroundColor: trackFill,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {layouts[activeIndex] ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: TRACK_PADDING,
                top: TRACK_PADDING,
                bottom: TRACK_PADDING,
                borderRadius: radius.full,
                backgroundColor: knobLip,
              },
              knobStyle,
            ]}
          >
            <View
              style={{
                flex: 1,
                marginBottom: KNOB_LIP,
                borderRadius: radius.full,
                backgroundColor: knobFace,
              }}
            />
          </Animated.View>
        ) : null}

        {options.map((option, index) => {
          const activeOption = index === activeIndex;
          return (
            <Pressable
              key={option.value}
              onLayout={measure(index)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: activeOption, disabled }}
              aria-checked={activeOption}
              aria-pressed={activeOption}
              disabled={disabled}
              onPress={() => select(option.value)}
              onFocus={ring.onFocus}
              onBlur={ring.onBlur}
              style={[
                {
                  minHeight: TRACK_HEIGHT - TRACK_PADDING * 2,
                  justifyContent: 'center',
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.md,
                  zIndex: 1,
                },
                ring.focusRingStyle,
              ]}
            >
              <Text
                variant="label"
                numberOfLines={1}
                className={activeOption ? 'font-bold' : 'font-semibold'}
                style={{ color: activeOption ? trackInk : inactiveInk }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
