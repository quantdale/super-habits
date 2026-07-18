import React from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { toDateKey } from '@/lib/time';

type Props = { dueDate: string; compact?: boolean };

export function DueDateBadge({ dueDate, compact }: Props) {
  const { tokens } = useAppTheme();
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
      : tokens.surfaceElevated;
  const txtColor = isOverdue ? tokens.dangerText : isToday ? tokens.warningText : tokens.textMuted;

  if (compact) {
    return (
      <View className="self-start rounded-full px-2 py-1" style={{ backgroundColor: bgColor }}>
        <Text className="text-[10px] font-semibold" style={{ color: txtColor }}>
          {isOverdue ? '⚠' : isToday ? '•' : formatted}
        </Text>
      </View>
    );
  }

  return (
    <View className="self-start rounded-full px-2.5 py-1.5" style={{ backgroundColor: bgColor }}>
      <Text className="text-[11px] font-semibold" style={{ color: txtColor }}>
        {isOverdue ? '⚠ ' : '📅 '}
        {label}
      </Text>
    </View>
  );
}
