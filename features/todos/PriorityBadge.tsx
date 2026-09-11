import { Text } from '@/core/ui/Text';
import React from 'react';
import { View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius } from '@/core/theme/designTokens';
import type { TodoPriority } from './types';

type Props = { priority: TodoPriority; compact?: boolean };

/**
 * Priority pill. Pop keeps every badge tinted — Normal is the section hue, Low
 * is the Habits green, Urgent is the danger family — so a row never reads as a
 * grey box. Text uses the `label` role at 11–12pt for a confident, scannable
 * chip.
 */
export function PriorityBadge({ priority, compact }: Props) {
  const { tokens, sectionAccents } = useAppTheme();
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
            bg: sectionAccents.habits.tint,
            text: sectionAccents.habits.text,
          }
        : {
            label: 'Normal',
            bg: sectionAccents.todos.tint,
            text: sectionAccents.todos.text,
          };

  return (
    <View
      className={`self-start rounded-full ${compact ? 'px-2 py-0.5' : 'px-2.5 py-1'}`}
      style={{ backgroundColor: cfg.bg, borderRadius: radius.full }}
    >
      <Text variant="label" style={{ color: cfg.text, fontSize: compact ? 11 : 12 }}>
        {compact ? cfg.label[0] : cfg.label}
      </Text>
    </View>
  );
}
