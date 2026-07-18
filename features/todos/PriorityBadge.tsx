import React from 'react';
import { Text, View } from 'react-native';
import { SECTION_COLORS, SECTION_TEXT_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import type { TodoPriority } from './types';

function withAlpha(color: string, opacity: number) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }

  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

type Props = { priority: TodoPriority; compact?: boolean };

export function PriorityBadge({ priority, compact }: Props) {
  const { tokens } = useAppTheme();
  const cfg =
    priority === 'urgent'
      ? {
          label: 'Urgent',
          bg: tokens.dangerBackground,
          text: tokens.dangerText,
        }
      : priority === 'low'
        ? {
            label: 'Low',
            bg: withAlpha(SECTION_COLORS.habits, 0.12),
            text: SECTION_TEXT_COLORS.habits,
          }
        : {
            label: 'Normal',
            bg: tokens.surfaceElevated,
            text: tokens.textMuted,
          };
  return (
    <View
      className={`self-start rounded-full ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'}`}
      style={{ backgroundColor: cfg.bg }}
    >
      <Text
        className={compact ? 'text-[10px] font-semibold' : 'text-[11px] font-semibold'}
        style={{ color: cfg.text }}
      >
        {compact ? cfg.label[0] : cfg.label}
      </Text>
    </View>
  );
}
