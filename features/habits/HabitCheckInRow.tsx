import { Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import { readableSurface } from '@/core/theme/contrast';
import type { HabitCheckInRowModel } from './habitCheckIn.domain';
import type { Habit } from './types';
import { useHabitCheckboxKeyboard } from './useHabitCheckboxKeyboard';

type Props = {
  habit: Habit;
  row: HabitCheckInRowModel;
  busy?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onOpen: () => void;
};

/** Did I complete this scheduled habit, and what should I check in next? */
export function HabitCheckInRow({ row, busy = false, onIncrement, onDecrement, onOpen }: Props) {
  const { tokens, sectionAccents } = useAppTheme();
  const complete = row.state === 'complete';
  const accent = sectionAccents.habits.text;
  const completionFill = readableSurface(accent, tokens.onSolid);
  const actionFocus = useKeyboardFocusRing(accent);
  const detailFocus = useKeyboardFocusRing(accent);
  const removeFocus = useKeyboardFocusRing(accent);
  const disabled = !row.actionable || busy;
  const activate = () => {
    if (disabled) return;
    if (!row.quantitative && complete) onDecrement();
    else onIncrement();
  };
  const actionRef = useHabitCheckboxKeyboard(!row.quantitative, disabled, activate);
  const countColor = row.tone === 'complete' || row.tone === 'accent' ? accent : tokens.textMuted;
  const tertiary = !row.actionable
    ? row.actionLabel.replace(`${row.name}: `, '')
    : [row.scheduleLabel, row.reminderLabel ? `Reminder ${row.reminderLabel}` : null]
        .filter(Boolean)
        .join(' · ');

  return (
    <View
      className="min-h-[56px] flex-row items-center gap-2 border-b py-1"
      style={{ borderColor: tokens.border }}
    >
      <Pressable
        ref={actionRef}
        onPress={activate}
        disabled={disabled}
        accessibilityRole={row.quantitative ? 'button' : 'checkbox'}
        accessibilityLabel={row.actionLabel}
        aria-checked={row.quantitative ? undefined : complete}
        aria-busy={busy}
        accessibilityState={
          row.quantitative ? { disabled, busy } : { disabled, busy, checked: complete }
        }
        onFocus={actionFocus.onFocus}
        onBlur={actionFocus.onBlur}
        className="h-12 w-12 items-center justify-center rounded-xl"
        style={actionFocus.focusRingStyle}
      >
        <View
          className="h-7 w-7 items-center justify-center rounded-full border"
          style={{
            borderColor: complete ? completionFill : tokens.textMuted,
            backgroundColor: complete && !row.quantitative ? completionFill : 'transparent',
            opacity: disabled ? 0.55 : 1,
          }}
        >
          {row.quantitative ? (
            <MaterialIcons
              name="add"
              size={20}
              color={row.actionable ? accent : tokens.iconMuted}
            />
          ) : complete ? (
            <MaterialIcons name="check" size={18} color={tokens.onSolid} />
          ) : null}
        </View>
      </Pressable>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={row.detailsLabel}
        onFocus={detailFocus.onFocus}
        onBlur={detailFocus.onBlur}
        className="min-h-[48px] min-w-0 flex-1 justify-center rounded-lg py-1"
        style={detailFocus.focusRingStyle}
      >
        <Text variant="bodyMd">{row.name}</Text>
        {tertiary ? (
          <Text variant="caption" tone="muted" className="mt-0.5">
            {tertiary}
          </Text>
        ) : null}
      </Pressable>
      <View className="max-w-[112px] flex-row items-center justify-end gap-1">
        {row.secondaryLabel ? (
          <View className="flex-row items-center gap-1">
            {row.quantitative && complete ? (
              <MaterialIcons name="check" size={14} color={accent} />
            ) : null}
            <Text
              variant="label"
              style={{ color: countColor, textAlign: 'right' }}
              accessibilityLabel={
                row.quantitative
                  ? `${row.name} progress ${row.secondaryLabel}${complete ? ', complete' : ''}`
                  : row.currentStreak > 0
                    ? `Current streak: ${row.currentStreak} scheduled occurrences`
                    : row.secondaryLabel
              }
            >
              {row.secondaryLabel}
            </Text>
          </View>
        ) : null}
        {row.quantitative && row.count > 0 ? (
          <Pressable
            onPress={onDecrement}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={row.decrementLabel}
            accessibilityState={{ disabled }}
            onFocus={removeFocus.onFocus}
            onBlur={removeFocus.onBlur}
            className="h-11 w-12 items-center justify-center rounded-lg"
            style={removeFocus.focusRingStyle}
          >
            <MaterialIcons name="remove" size={20} color={tokens.iconMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
