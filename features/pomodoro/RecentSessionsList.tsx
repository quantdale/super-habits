import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import type { PomodoroSession } from './types';
import { formatSessionDuration, formatSessionTime } from './pomodoro.domain';

type Props = {
  sessions: PomodoroSession[];
  /** When provided, rows become pressable for post-hoc note/link correction. */
  onEdit?: (session: PomodoroSession) => void;
};

const MAX_ROWS = 10;

/**
 * Recent completed-session history with durable per-row metadata (linked
 * todo snapshot, completion note) surfaced next to each row.
 */
export function RecentSessionsList({ sessions, onEdit }: Props) {
  const { tokens } = useAppTheme();
  const rows = sessions.filter((s) => s.session_type === 'focus').slice(0, MAX_ROWS);

  if (rows.length === 0) {
    return (
      <Text className="text-sm" style={{ color: tokens.textMuted }}>
        No completed focus sessions yet. Finish a timer to start your history.
      </Text>
    );
  }

  return (
    <View className="gap-2">
      {rows.map((session) => {
        const linkedTodoTitle = session.linked_todo_title ?? null;
        const note = session.note ?? null;
        const rowContent = (
          <>
            <View className="flex-row items-center justify-between">
              <Text
                className="flex-1 text-sm font-medium"
                style={{ color: tokens.text }}
                numberOfLines={1}
              >
                {linkedTodoTitle ?? 'Focus session'}
              </Text>
              <Text className="ml-2 text-sm" style={{ color: tokens.textMuted }}>
                {formatSessionDuration(session.duration_seconds)}
              </Text>
            </View>
            <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
              {formatSessionTime(session.started_at)}
            </Text>
            {note ? (
              <Text
                className="mt-1 text-xs italic"
                style={{ color: tokens.textMuted }}
                numberOfLines={2}
              >
                “{note}”
              </Text>
            ) : null}
          </>
        );
        const rowStyle = {
          borderColor: tokens.border,
          backgroundColor: tokens.surfaceElevated,
        };
        return onEdit ? (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            accessibilityLabel={`Edit focus session from ${formatSessionTime(session.started_at)}`}
            onPress={() => onEdit(session)}
            className="rounded-2xl border px-3 py-2"
            style={rowStyle}
          >
            {rowContent}
          </Pressable>
        ) : (
          <View key={session.id} className="rounded-2xl border px-3 py-2" style={rowStyle}>
            {rowContent}
          </View>
        );
      })}
    </View>
  );
}
