import { useCallback, useEffect, useRef } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import { size } from '@/core/theme/designTokens';
import { nextSegmentValue } from '@/core/ui/segmentedControl.model';

type SegmentOption<T extends string> = {
  value: T;
  label: string;
  /** Optional per-option accessible name (defaults to `label`). */
  accessibilityLabel?: string;
  disabled?: boolean;
};

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accent color for the selected segment; defaults to the theme accent. */
  accentColor?: string;
  accessibilityLabel?: string;
};

/**
 * Shared segmented control for switching between 2–N mutually exclusive
 * modes/views (exactly-one selection). Distinguishable from filter chips
 * (`PillChip`, zero/one/many), status badges (informational), and action
 * chips (trigger): this primitive only ever represents a single-select
 * view/mode switch.
 *
 * Accessibility contract:
 * - group announces its `accessibilityLabel` (role `tablist`);
 * - each option is a `tab` with `accessibilityState.selected`;
 * - on web, Left/Right arrows move selection while focus is inside the
 *   group, and the focused option keeps a visible focus ring (2px outline).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accentColor,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { tokens } = useAppTheme();
  const resolvedAccent = accentColor ?? tokens.accent;
  const ring = useKeyboardFocusRing(resolvedAccent);
  const containerRef = useRef<View>(null);

  const moveSelection = useCallback(
    (direction: -1 | 1) => {
      const next = nextSegmentValue(options, value, direction);
      if (next === value) return;
      onChange(next);
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
      className="flex-row flex-wrap rounded-2xl border p-1"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            disabled={option.disabled}
            accessibilityRole="tab"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected: active, disabled: option.disabled ?? false }}
            onPress={() => {
              if (!option.disabled) onChange(option.value);
            }}
            onFocus={ring.onFocus}
            onBlur={ring.onBlur}
            className="items-center rounded-xl px-3"
            style={[
              {
                flexGrow: 1,
                flexBasis: 'auto',
                minHeight: size.touchTargetMin,
                justifyContent: 'center',
                backgroundColor: active ? resolvedAccent : undefined,
                opacity: option.disabled ? 0.4 : 1,
              },
              ring.focusRingStyle,
            ]}
          >
            <Text
              className={`text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}
              style={active ? { color: tokens.textOnAccent } : { color: tokens.textMuted }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
