import { Text } from '@/core/ui/Text';
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { describePlanningWriteError } from '@/features/planning-hub/planningWriteError';
import { setPomodoroSessionMeta } from './pomodoro.data';

type Props = {
  sessionId: string;
  onSaved: () => void;
  onDismiss: () => void;
};

const MAX_NOTE_LENGTH = 500;

/**
 * Post-completion prompt: capture a short note about the focus session that
 * just finished. Notes are durable row metadata (`pomodoro_sessions.note`).
 */
export function SessionNotePrompt({ sessionId, onSaved, onDismiss }: Props) {
  const { tokens } = useAppTheme();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await setPomodoroSessionMeta({ sessionId, note });
      onSaved();
    } catch (e) {
      // A rejected note write must be visible with the typed value intact and
      // the prompt still open, never an unhandled rejection.
      setError(describePlanningWriteError(e, 'Could not save the note. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium" style={{ color: tokens.text }}>
        What did you focus on?
      </Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={MAX_NOTE_LENGTH}
        placeholder="Optional note for this session…"
        accessibilityLabel="Session note"
        className="rounded-2xl border px-3 py-2 text-sm"
        style={{
          borderColor: tokens.border,
          backgroundColor: tokens.surfaceElevated,
          color: tokens.text,
        }}
      />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button label={saving ? 'Saving…' : 'Save note'} onPress={() => void save()} />
        </View>
        <View className="flex-1">
          <Button label="Skip" variant="ghost" onPress={onDismiss} />
        </View>
      </View>
      {error ? (
        <Text accessibilityRole="alert" variant="bodyMd" style={{ color: tokens.dangerText }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
