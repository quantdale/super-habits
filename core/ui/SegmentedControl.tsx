import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { useReducedMotion } from '@/core/theme/motion';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import { useSpaceActivation } from '@/core/ui/useSpaceActivation';
import { radius } from '@/core/theme/designTokens';
import {
  nextSegmentValue,
  resolveSegmentMinHeight,
  SEGMENT_TRACK_PADDING,
} from '@/core/ui/segmentedControl.model';

/** 40px track (§6): 36pt segment faces + 2pt padding. */
const TRACK_PADDING = SEGMENT_TRACK_PADDING;
/** Thumb lip under the white face (§6 "white Pressable3D (2px lip)"). */
const THUMB_LIP = 2;

type SegmentOption<T extends string> = {
  value: T;
  label: string;
  /** Optional per-option accessible name (defaults to `label`). */
  accessibilityLabel?: string;
  disabled?: boolean;
};

type SegmentOptionProps<T extends string> = {
  option: SegmentOption<T>;
  active: boolean;
  /** Accent used for the keyboard focus ring. */
  ringColor: string;
  /** Resolved face height; 36 (the V3 default) unless a caller opted up. */
  segmentMinHeight: number;
  onSelect: (value: T) => void;
};

/**
 * One segment. The focus ring lives on a per-option hook: a single shared
 * focus state at the control level would outline every option when one of them
 * is focused (keyboard or click), which reads as a rendering defect.
 */
function SegmentOptionButton<T extends string>({
  option,
  active,
  ringColor,
  segmentMinHeight,
  onSelect,
}: SegmentOptionProps<T>) {
  const { tokens } = useAppTheme();
  const ring = useKeyboardFocusRing(ringColor);
  const activate = useCallback(() => {
    if (!option.disabled) onSelect(option.value);
  }, [onSelect, option.disabled, option.value]);
  // CG-13 (`docs/testing/known-gaps.md`): RN-Web's press responder maps Space
  // only to button-shaped roles, so a `tab` needs the same Space binding the
  // habit checkbox and `Switch` carry. Enter and pointer presses stay RN-Web's.
  const spaceRef = useSpaceActivation({
    role: 'tab',
    onActivate: activate,
    disabled: option.disabled,
  });
  return (
    <Pressable
      ref={spaceRef}
      disabled={option.disabled}
      accessibilityRole="tab"
      accessibilityLabel={option.accessibilityLabel ?? option.label}
      aria-selected={active}
      accessibilityState={{ selected: active, disabled: option.disabled ?? false }}
      onPress={activate}
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
      // Vertical-only slop lifts the 36pt segment face to the 44pt touch
      // contract without overlapping horizontally adjacent segments. It is
      // deliberately NOT the mechanism that satisfies CG-12 on web (see
      // `minSegmentHeight`): react-native-web drops it entirely.
      hitSlop={{ top: 4, bottom: 4 }}
      style={[
        {
          flex: 1,
          minWidth: 0,
          minHeight: segmentMinHeight,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: radius.full,
          opacity: option.disabled ? 0.4 : 1,
          zIndex: 1,
        },
        ring.focusRingStyle,
      ]}
    >
      <Text
        variant="label"
        style={{ color: active ? ringColor : tokens.textMuted }}
        numberOfLines={1}
      >
        {option.label}
      </Text>
    </Pressable>
  );
}

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accent color for the selected segment; defaults to the theme accent. */
  accentColor?: string;
  accessibilityLabel?: string;
  /**
   * Opt up to a taller segment FACE, so the real DOM hit area (not `hitSlop`,
   * which react-native-web never applies — `docs/testing/known-gaps.md` CG-12)
   * reaches >= 44 CSS px on web. Omitted (every caller but Focus today) → 36pt
   * faces in a 40pt tray, pixel-identical to V3 §6. Clamped to 52 and ignored
   * off-web by `resolveSegmentMinHeight`; values <= 36 are the default.
   */
  minSegmentHeight?: number;
};

/**
 * Segmented control (V3): a compact sunken tray (36pt segments) with a solid
 * pill that *slides* between options, so switching modes reads as physical
 * motion rather than a repaint. Pop's 48pt tray made every mode switch a
 * dominant surface; V3 keeps it quiet.
 *
 * Accessibility contract (unchanged from the previous implementation):
 * - group announces its `accessibilityLabel` (role `tablist`);
 * - each option is a `tab` with `accessibilityState.selected`;
 * - on web, Left/Right arrows move selection while focus is inside the group,
 *   and the focused option keeps a visible focus ring.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accentColor,
  accessibilityLabel,
  minSegmentHeight,
}: SegmentedControlProps<T>) {
  const { tokens } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const resolvedAccent = accentColor ?? tokens.primary;
  // Web-only layout tier: off-web (and for every default caller) this is the
  // untouched 36pt V3 face.
  const segmentMinHeight = resolveSegmentMinHeight({
    minSegmentHeight,
    isWeb: Platform.OS === 'web',
  });
  const containerRef = useRef<View>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [indicator] = useState(() => new Animated.Value(0));

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segmentWidth = options.length > 0 ? trackWidth / options.length : 0;

  useEffect(() => {
    const target = selectedIndex * segmentWidth;
    if (reducedMotion || segmentWidth === 0) {
      indicator.setValue(target);
      return;
    }
    Animated.spring(indicator, {
      toValue: target,
      useNativeDriver: true,
      speed: 22,
      bounciness: 8,
    }).start();
  }, [indicator, reducedMotion, segmentWidth, selectedIndex]);

  const moveSelection = useCallback(
    (direction: -1 | 1) => {
      const next = nextSegmentValue(options, value, direction);
      if (next !== value) onChange(next);
    },
    [options, value, onChange],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // SAFETY: only web reaches here; on web the ref is attached to a View,
    // which react-native-web renders as an HTMLElement. Type checks the RN
    // ViewProps contract cannot express (a DOM node only exists on web).
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        moveSelection(event.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    node.addEventListener('keydown', listener);
    return () => node.removeEventListener('keydown', listener);
  }, [moveSelection]);

  return (
    <View
      ref={containerRef}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width - TRACK_PADDING * 2)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: TRACK_PADDING,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.surfaceSunken,
      }}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              left: TRACK_PADDING,
              top: TRACK_PADDING,
              bottom: TRACK_PADDING,
              width: segmentWidth,
              borderRadius: radius.full,
              backgroundColor: tokens.borderStrong,
              transform: [{ translateX: indicator }],
            },
          ]}
        >
          <View
            style={{
              flex: 1,
              marginBottom: THUMB_LIP,
              borderRadius: radius.full,
              backgroundColor: tokens.surface,
            }}
          />
        </Animated.View>
      ) : null}
      {options.map((option) => (
        <SegmentOptionButton
          key={option.value}
          option={option}
          active={option.value === value}
          ringColor={resolvedAccent}
          segmentMinHeight={segmentMinHeight}
          onSelect={onChange}
        />
      ))}
    </View>
  );
}
