import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Modal } from '@/core/ui/Modal';
import { Button } from '@/core/ui/Button';
import { TextField } from '@/core/ui/TextField';
import type { Todo } from '@/core/db/types';
import { SECTION_COLORS } from '@/constants/sectionColors';
import type { PomodoroSession } from './types';
import { formatSessionDuration, formatSessionTime } from './pomodoro.domain';
import { setPomodoroSessionMeta } from './pomodoro.data';
import { TodoAssociationPicker } from './TodoAssociationPicker';
import type { SessionAssociation } from './pomodoro.sessionMeta';

const COLOR = SECTION_COLORS.focus;

type Props = {
  visible: boolean;
  session: PomodoroSession | null;
  todos: Todo[];
  todosLoading: boolean;
  onClose: () => void;
  onRetryLoadTodos: () => void;
  onSaved: () => void;
};

/**
 * Post-hoc correction for a completed focus session: fix or add the note and
 * relink/unlink the associated todo through the existing
 * `setPomodoroSessionMeta` contract (single durable update intent; the linked
 * title stays a snapshot so history survives todo renames and deletes).
 */
export function SessionMetaEditModal({
  visible,
  session,
  todos,
  todosLoading,
  onClose,
  onRetryLoadTodos,
  onSaved,
}: Props) {
  const { tokens } = useAppTheme();
  const [note, setNote] = useState('');
  const [association, setAssociation] = useState<SessionAssociation | null>(null);
  const [hadLinkedTodo, setHadLinkedTodo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNote(session.note ?? '');
    setHadLinkedTodo(Boolean(session.linked_todo_id));
    setAssociation(
      session.linked_todo_id
        ? { todoId: session.linked_todo_id, todoTitle: session.linked_todo_title ?? 'Linked todo' }
        : null,
    );
  }, [visible, session]);

  if (!session) return null;

  const noteChanged = note.trim() !== (session.note ?? '');
  const linkChanged = (association?.todoId ?? null) !== (session.linked_todo_id ?? null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setPomodoroSessionMeta({
        sessionId: session.id,
        note: noteChanged ? note.trim() : undefined,
        linkedTodoId: linkChanged ? (association?.todoId ?? null) : undefined,
        linkedTodoTitle: linkChanged ? (association?.todoTitle ?? null) : undefined,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Edit focus session" scroll>
      <View className="mb-4 gap-1">
        <Text className="text-sm" style={{ color: tokens.textMuted }}>
          {formatSessionTime(session.started_at)} ·{' '}
          {formatSessionDuration(session.duration_seconds)}
        </Text>
        {session.linked_todo_title && !association ? (
          <Text className="text-xs italic" style={{ color: tokens.textMuted }}>
            Originally linked: {session.linked_todo_title}
          </Text>
        ) : null}
      </View>

      <TextField
        label="Note (optional)"
        accessibilityLabel="Session note"
        value={note}
        onChangeText={setNote}
        multiline
        placeholder="What did you get done?"
      />

      <View className="mt-4">
        <Text className="mb-2 text-sm font-semibold" style={{ color: tokens.text }}>
          Linked todo
        </Text>
        <TodoAssociationPicker
          todos={todos}
          selected={association}
          onSelect={setAssociation}
          onRetryLoad={onRetryLoadTodos}
          loading={todosLoading}
        />
        {hadLinkedTodo && !association ? (
          <Text className="mt-2 text-xs" style={{ color: tokens.textMuted }}>
            Saving will unlink this session from its original todo. The session itself is kept.
          </Text>
        ) : null}
      </View>

      <View className="mt-5">
        <Button
          label="Save changes"
          accessibilityLabel="Save session changes"
          color={COLOR}
          loading={saving}
          onPress={() => void handleSave()}
        />
      </View>
    </Modal>
  );
}
