import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { useReducedMotion } from '@/core/theme/motion';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import { radius } from '@/core/theme/designTokens';
import { nextSegmentValue } from '@/core/ui/segmentedControl.model';

/** 40px track (§6): 36pt segment faces + 2pt padding. */
const TRACK_PADDING = 2;
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
  onSelect,
}: SegmentOptionProps<T>) {
  const { tokens } = useAppTheme();
  const ring = useKeyboardFocusRing(ringColor);
  return (
    <Pressable
      disabled={option.disabled}
      accessibilityRole="tab"
      accessibilityLabel={option.accessibilityLabel ?? option.label}
      aria-selected={active}
      accessibilityState={{ selected: active, disabled: option.disabled ?? false }}
      onPress={() => {
        if (!option.disabled) onSelect(option.value);
      }}
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
      // Vertical-only slop lifts the 36pt segment face to the 44pt touch
      // contract without overlapping horizontally adjacent segments.
      hitSlop={{ top: 4, bottom: 4 }}
      style={[
        {
          flex: 1,
          minWidth: 0,
          minHeight: 36,
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
}: SegmentedControlProps<T>) {
  const { tokens } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const resolvedAccent = accentColor ?? tokens.primary;
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
          onSelect={onChange}
        />
      ))}
    </View>
  );
}
