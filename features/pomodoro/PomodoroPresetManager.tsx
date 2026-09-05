import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Modal } from '@/core/ui/Modal';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { PillChip } from '@/core/ui/PillChip';
import { TextField } from '@/core/ui/TextField';
import { ValidationError } from '@/core/ui/ValidationError';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { createId } from '@/lib/id';
import { BUILT_IN_PRESETS, type PomodoroPreset } from './pomodoro.domain';
import { savePomodoroPresets } from './pomodoro.presets.store';

const COLOR = SECTION_COLORS.focus;

type Draft = {
  id: string | null;
  name: string;
  focusMinutes: string;
  shortBreakMinutes: string;
  longBreakMinutes: string;
  sessionsBeforeLongBreak: string;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
};

const EMPTY_DRAFT: Draft = {
  id: null,
  name: '',
  focusMinutes: '25',
  shortBreakMinutes: '5',
  longBreakMinutes: '15',
  sessionsBeforeLongBreak: '4',
  autoStartBreaks: false,
  autoStartFocus: false,
};

function toDraft(preset: PomodoroPreset): Draft {
  return {
    id: preset.id,
    name: preset.name,
    focusMinutes: String(preset.focusMinutes),
    shortBreakMinutes: String(preset.shortBreakMinutes),
    longBreakMinutes: String(preset.longBreakMinutes),
    sessionsBeforeLongBreak: String(preset.sessionsBeforeLongBreak),
    autoStartBreaks: preset.autoStartBreaks,
    autoStartFocus: preset.autoStartFocus,
  };
}

function parseBound(raw: string, min: number, max: number): number | null {
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

function validateDraft(draft: Draft): string | null {
  if (!draft.name.trim()) return 'Give the preset a name.';
  if (parseBound(draft.focusMinutes, 1, 120) === null) {
    return 'Focus minutes must be a whole number from 1 to 120.';
  }
  if (parseBound(draft.shortBreakMinutes, 1, 60) === null) {
    return 'Short break minutes must be a whole number from 1 to 60.';
  }
  if (parseBound(draft.longBreakMinutes, 1, 120) === null) {
    return 'Long break minutes must be a whole number from 1 to 120.';
  }
  if (parseBound(draft.sessionsBeforeLongBreak, 2, 10) === null) {
    return 'Sessions before the long break must be a whole number from 2 to 10.';
  }
  return null;
}

type Props = {
  visible: boolean;
  presets: PomodoroPreset[];
  onClose: () => void;
  onChanged: () => void;
};

/**
 * Authoring surface for custom focus rhythms on top of the existing
 * app_meta-backed preset store (recoverable via the backup settings
 * allowlist). Built-in presets stay protected — they can be selected on the
 * main card but never edited or deleted here.
 */
export function PomodoroPresetManagerModal({ visible, presets, onClose, onChanged }: Props) {
  const { tokens } = useAppTheme();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!draft) return;
    const message = validateDraft(draft);
    if (message) {
      setError(message);
      return;
    }
    const preset: PomodoroPreset = {
      id: draft.id ?? createId('ppre'),
      name: draft.name.trim().slice(0, 40),
      focusMinutes: Number(draft.focusMinutes.trim()),
      shortBreakMinutes: Number(draft.shortBreakMinutes.trim()),
      longBreakMinutes: Number(draft.longBreakMinutes.trim()),
      sessionsBeforeLongBreak: Number(draft.sessionsBeforeLongBreak.trim()),
      autoStartBreaks: draft.autoStartBreaks,
      autoStartFocus: draft.autoStartFocus,
    };
    const next = presets.some((p) => p.id === preset.id)
      ? presets.map((p) => (p.id === preset.id ? preset : p))
      : [...presets, preset];
    await savePomodoroPresets(next);
    setDraft(null);
    setError(null);
    onChanged();
  };

  const handleDelete = async (preset: PomodoroPreset) => {
    const confirmed = await confirm({
      title: 'Delete preset',
      message: `Delete “${preset.name}”? Sessions you already logged are unaffected.`,
      confirmLabel: 'Delete preset',
      confirmVariant: 'danger',
    });
    if (!confirmed) return;
    await savePomodoroPresets(presets.filter((p) => p.id !== preset.id));
    if (draft?.id === preset.id) setDraft(null);
    onChanged();
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Focus presets" scroll>
      <View className="gap-3">
        {presets.map((preset) => {
          const isBuiltIn = BUILT_IN_PRESETS.some((p) => p.id === preset.id);
          return (
            <Card key={preset.id} accentColor={COLOR}>
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-medium" style={{ color: tokens.text }}>
                  {preset.name}
                </Text>
                {isBuiltIn ? (
                  <Text className="text-xs" style={{ color: tokens.textMuted }}>
                    Built-in
                  </Text>
                ) : null}
              </View>
              <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
                {preset.focusMinutes} focus · {preset.shortBreakMinutes} short ·{' '}
                {preset.longBreakMinutes} long · every {preset.sessionsBeforeLongBreak} sessions
              </Text>
              {!isBuiltIn ? (
                <View className="mt-3 flex-row flex-wrap gap-2">
                  <Button
                    label="Edit"
                    accessibilityLabel={`Edit preset ${preset.name}`}
                    variant="ghost"
                    onPress={() => {
                      setError(null);
                      setDraft(toDraft(preset));
                    }}
                  />
                  <Button
                    label="Delete"
                    accessibilityLabel={`Delete preset ${preset.name}`}
                    variant="danger"
                    onPress={() => void handleDelete(preset)}
                  />
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>

      <View className="mt-5 border-t pt-4" style={{ borderColor: tokens.border }}>
        {draft === null ? (
          <Button
            label="New preset"
            accessibilityLabel="New preset"
            color={COLOR}
            onPress={() => {
              setError(null);
              setDraft({ ...EMPTY_DRAFT });
            }}
          />
        ) : (
          <View className="gap-2">
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              {draft.id === null ? 'Create preset' : `Edit “${draft.name}”`}
            </Text>
            {error ? <ValidationError message={error} /> : null}
            <TextField
              label="Preset name"
              accessibilityLabel="Preset name"
              value={draft.name}
              onChangeText={(value) => setDraft({ ...draft, name: value })}
              placeholder="Laptop focus"
            />
            <TextField
              label="Focus minutes (1-120)"
              accessibilityLabel="Preset focus minutes"
              value={draft.focusMinutes}
              onChangeText={(value) => setDraft({ ...draft, focusMinutes: value })}
              keyboardType="numeric"
            />
            <TextField
              label="Short break minutes (1-60)"
              accessibilityLabel="Preset short break minutes"
              value={draft.shortBreakMinutes}
              onChangeText={(value) => setDraft({ ...draft, shortBreakMinutes: value })}
              keyboardType="numeric"
            />
            <TextField
              label="Long break minutes (1-120)"
              accessibilityLabel="Preset long break minutes"
              value={draft.longBreakMinutes}
              onChangeText={(value) => setDraft({ ...draft, longBreakMinutes: value })}
              keyboardType="numeric"
            />
            <TextField
              label="Sessions before long break (2-10)"
              accessibilityLabel="Preset sessions before long break"
              value={draft.sessionsBeforeLongBreak}
              onChangeText={(value) => setDraft({ ...draft, sessionsBeforeLongBreak: value })}
              keyboardType="numeric"
            />
            <View className="flex-row flex-wrap">
              <PillChip
                label="Auto-start breaks"
                active={draft.autoStartBreaks}
                color={COLOR}
                onPress={() => setDraft({ ...draft, autoStartBreaks: !draft.autoStartBreaks })}
              />
              <PillChip
                label="Auto-start focus"
                active={draft.autoStartFocus}
                color={COLOR}
                onPress={() => setDraft({ ...draft, autoStartFocus: !draft.autoStartFocus })}
              />
            </View>
            <Button
              label={draft.id === null ? 'Create preset' : 'Save preset changes'}
              accessibilityLabel={draft.id === null ? 'Create preset' : 'Save preset changes'}
              color={COLOR}
              onPress={() => void handleSave()}
            />
          </View>
        )}
      </View>
      {confirmationDialog}
    </Modal>
  );
}
