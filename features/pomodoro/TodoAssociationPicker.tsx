import React from 'react';
import { Text, View, Pressable } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import type { Todo } from '@/core/db/types';
import type { SessionAssociation } from './pomodoro.sessionMeta';

type Props = {
  todos: Todo[];
  selected: SessionAssociation | null;
  onSelect: (association: SessionAssociation | null) => void;
  onRetryLoad: () => void;
  loading: boolean;
};

const MAX_VISIBLE = 8;

/**
 * Pre-start picker: optionally attach an existing open todo to the next focus
 * session. Selection is local-only metadata keyed by session id once logged.
 */
export function TodoAssociationPicker({ todos, selected, onSelect, onRetryLoad, loading }: Props) {
  const { tokens } = useAppTheme();
  const openTodos = todos.filter((t) => t.completed === 0).slice(0, MAX_VISIBLE);

  if (loading) {
    return (
      <Text className="text-sm" style={{ color: tokens.textMuted }}>
        Loading todos…
      </Text>
    );
  }

  if (openTodos.length === 0) {
    return (
      <View className="gap-2">
        <Text className="text-sm" style={{ color: tokens.textMuted }}>
          No open todos to link. Add one on the Todos tab.
        </Text>
        <View className="self-start">
          <Button label="Reload" variant="ghost" onPress={onRetryLoad} />
        </View>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {selected ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear linked todo"
          onPress={() => onSelect(null)}
          className="self-start rounded-full px-3 py-1"
          style={{ backgroundColor: tokens.surfaceElevated }}
        >
          <Text className="text-xs" style={{ color: tokens.textMuted }}>
            Linked: {selected.todoTitle} ✕
          </Text>
        </Pressable>
      ) : null}
      {openTodos.map((todo) => {
        const isSelected = selected?.todoId === todo.id;
        return (
          <Pressable
            key={todo.id}
            accessibilityRole="button"
            accessibilityLabel={`Link todo ${todo.title}`}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect({ todoId: todo.id, todoTitle: todo.title })}
            className={`rounded-2xl border px-3 py-2 ${isSelected ? 'border-2' : ''}`}
            style={{
              borderColor: isSelected ? tokens.accent : tokens.border,
              backgroundColor: tokens.surfaceElevated,
            }}
          >
            <Text numberOfLines={1} className="text-sm" style={{ color: tokens.text }}>
              {todo.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
