import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { readableSurface } from '@/core/theme/contrast';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import { useHabitCheckboxKeyboard } from './useHabitCheckboxKeyboard';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: 'button' | 'checkbox';
  /** Identity swatch; otherwise the selected face uses readable Habits ink. */
  swatch?: string;
  children?: ReactNode;
};

/** The editor's date/icon/color choices share one 44pt, keyboard-safe contract. */
export function HabitEditorChoice({
  label,
  selected,
  onPress,
  role = 'button',
  swatch,
  children,
}: Props) {
  const { tokens, sectionAccents } = useAppTheme();
  const focus = useKeyboardFocusRing(sectionAccents.habits.text);
  const choiceRef = useHabitCheckboxKeyboard(role === 'checkbox', false, onPress);
  const backgroundColor =
    swatch ??
    (selected
      ? readableSurface(sectionAccents.habits.fill, tokens.onSolid)
      : tokens.surfaceElevated);
  return (
    <Pressable
      ref={choiceRef}
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      aria-checked={role === 'checkbox' ? selected : undefined}
      aria-pressed={role === 'button' ? selected : undefined}
      accessibilityState={role === 'checkbox' ? { checked: selected } : { selected }}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      className={`h-11 w-11 items-center justify-center ${swatch ? 'rounded-full border-2' : 'rounded-xl border'}`}
      style={[
        {
          backgroundColor,
          borderColor: swatch
            ? selected
              ? tokens.text
              : 'transparent'
            : selected
              ? sectionAccents.habits.text
              : tokens.border,
        },
        focus.focusRingStyle,
      ]}
    >
      {children}
    </Pressable>
  );
}
