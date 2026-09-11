import { Text } from '@/core/ui/Text';
import React from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius } from '@/core/theme/designTokens';
import { toDateKey } from '@/lib/time';

type Props = { dueDate: string; compact?: boolean };

/**
 * Due-date pill: danger when overdue, warm amber when due today, and the Todos
 * hue for upcoming dates. Icons are Material glyphs (never emoji) and the text
 * uses the `label` role at 11–12pt so it stays readable at a glance.
 */
export function DueDateBadge({ dueDate, compact }: Props) {
  const { tokens, sectionAccents } = useAppTheme();
  const today = toDateKey();
  const isOverdue = dueDate < today;
  const isToday = dueDate === today;

  const date = new Date(dueDate + 'T12:00:00');
  const formatted = date.toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
  });

  const label = isToday ? 'Today' : isOverdue ? `Overdue · ${formatted}` : formatted;
  const bgColor = isOverdue
    ? tokens.dangerBackground
    : isToday
      ? tokens.warningBackground
      : sectionAccents.todos.tint;
  const txtColor = isOverdue
    ? tokens.dangerText
    : isToday
      ? tokens.warningText
      : sectionAccents.todos.text;

  return (
    <View
      className={`self-start flex-row items-center gap-1 rounded-full ${
        compact ? 'px-2 py-0.5' : 'px-2.5 py-1'
      }`}
      style={{ backgroundColor: bgColor, borderRadius: radius.full }}
    >
      <MaterialIcons
        name={isOverdue ? 'error-outline' : 'event'}
        size={compact ? 11 : 12}
        color={txtColor}
      />
      <Text variant="label" style={{ color: txtColor, fontSize: compact ? 11 : 12 }}>
        {compact ? (isToday ? 'Today' : formatted) : label}
      </Text>
    </View>
  );
}
