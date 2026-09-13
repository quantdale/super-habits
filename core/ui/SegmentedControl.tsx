import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { useReducedMotion } from '@/core/theme/motion';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import { radius, size, spacing } from '@/core/theme/designTokens';
import { readableSurface } from '@/core/theme/contrast';
import { nextSegmentValue } from '@/core/ui/segmentedControl.model';

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
      accessibilityState={{ selected: active, disabled: option.disabled ?? false }}
      onPress={() => {
        if (!option.disabled) onSelect(option.value);
      }}
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
      style={[
        {
          flex: 1,
          minWidth: 0,
          minHeight: size.touchTargetMin - 4,
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
        style={{ color: active ? tokens.onSolid : tokens.textMuted, fontSize: 13.5 }}
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
 * Pop segmented control: a sunken tray with a solid pill that *slides* between
 * options, so switching modes reads as physical motion rather than a repaint.
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
  // The sliding pill carries white labels; deepen a mid-tone accent so the
  // selected label clears WCAG AA (white on a section hue is ~2.5:1).
  const pillColor = readableSurface(resolvedAccent, tokens.onSolid);
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
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width - spacing.xs * 2)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.xs,
        borderRadius: radius.full,
        borderWidth: 1.5,
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
              left: spacing.xs,
              top: spacing.xs,
              bottom: spacing.xs,
              width: segmentWidth,
              borderRadius: radius.full,
              backgroundColor: pillColor,
              transform: [{ translateX: indicator }],
            },
          ]}
        />
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
