import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/themeContext';
import { Modal } from '@/core/ui/Modal';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { PillChip } from '@/core/ui/PillChip';
import { TextField } from '@/core/ui/TextField';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { SECTION_COLORS } from '@/constants/sectionColors';
import type { CustomExercise, WorkoutModality } from '@/core/db/types';
import {
  archiveCustomExercise,
  listCustomExercises,
  restoreCustomExercise,
  updateCustomExercise,
} from './workout.data';

const COLOR = SECTION_COLORS.workout;

const MODALITY_LABELS: Record<WorkoutModality, string> = {
  weighted_strength: 'Strength',
  bodyweight: 'Bodyweight',
  timed: 'Timed',
  cardio: 'Cardio',
};

function parseJsonStringArray(raw: string | null | undefined): string[] {
  try {
    const value = JSON.parse(raw ?? '[]') as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

type EditState = {
  id: string;
  name: string;
  area: string;
  equipment: string;
  aliases: string;
  instructions: string;
  modality: WorkoutModality;
  unilateral: boolean;
  supportsExternalLoad: boolean;
};

function toEditState(exercise: CustomExercise): EditState {
  return {
    id: exercise.id,
    name: exercise.name,
    area: exercise.primary_area,
    equipment: exercise.equipment ?? '',
    aliases: parseJsonStringArray(exercise.aliases).join(', '),
    instructions: exercise.instructions ?? '',
    modality: exercise.modality,
    unilateral: exercise.unilateral === 1,
    supportsExternalLoad:
      (exercise.supports_external_load ?? (exercise.modality === 'weighted_strength' ? 1 : 0)) ===
      1,
  };
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onChanged?: () => void;
};

/**
 * Management surface for user-authored exercises: rename/re-tag, archive, and
 * restore. Archiving only hides the exercise from new routine editing —
 * historical session snapshots keep their recorded identity.
 */
export function CustomExerciseManagerModal({ visible, onClose, onChanged }: Props) {
  const { tokens } = useAppTheme();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [exercises, setExercises] = useState<CustomExercise[]>([]);
  const [showArchived, setShowArchived] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);

  const refresh = useCallback(async () => {
    setExercises(await listCustomExercises(true));
  }, []);

  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [visible, refresh]);

  const notifyChanged = useCallback(() => {
    void refresh();
    onChanged?.();
  }, [onChanged, refresh]);

  const handleSaveEdit = useCallback(async () => {
    if (!editing) return;
    const trimmed = editing.name.trim();
    if (!trimmed) return;
    await updateCustomExercise(editing.id, {
      name: trimmed,
      primaryArea: editing.area.trim() || undefined,
      equipment: editing.equipment.trim(),
      aliases: editing.aliases
        .split(',')
        .map((alias) => alias.trim())
        .filter(Boolean),
      instructions: editing.instructions.trim(),
      modality: editing.modality,
      unilateral: editing.unilateral,
      supportsExternalLoad: editing.supportsExternalLoad,
    });
    setEditing(null);
    notifyChanged();
  }, [editing, notifyChanged]);

  const handleArchive = useCallback(
    async (exercise: CustomExercise) => {
      const confirmed = await confirm({
        title: 'Archive custom exercise',
        message: `Archive “${exercise.name}”? It will no longer appear in the exercise library for new routines. Sessions you already logged keep their history.`,
        confirmLabel: 'Archive exercise',
        confirmVariant: 'danger',
      });
      if (!confirmed) return;
      await archiveCustomExercise(exercise.id);
      if (editing?.id === exercise.id) setEditing(null);
      notifyChanged();
    },
    [confirm, editing, notifyChanged],
  );

  const handleRestore = useCallback(
    async (exercise: CustomExercise) => {
      await restoreCustomExercise(exercise.id);
      notifyChanged();
    },
    [notifyChanged],
  );

  const visibleExercises = showArchived ? exercises : exercises.filter((e) => !e.deleted_at);

  return (
    <Modal visible={visible} onClose={onClose} title="Custom exercises" scroll>
      <Text className="mb-3 text-xs" style={{ color: tokens.textMuted }}>
        Renames and metadata changes apply to future routine editing only — completed sessions keep
        the exercise snapshot recorded at completion.
      </Text>
      <View className="mb-3 flex-row flex-wrap">
        <PillChip
          label={showArchived ? 'Showing archived' : 'Hiding archived'}
          active={showArchived}
          color={COLOR}
          onPress={() => setShowArchived((value) => !value)}
        />
      </View>
      {visibleExercises.length === 0 ? (
        <EmptyStateCard
          accentColor={COLOR}
          title="No custom exercises yet"
          description="Create one from the exercise library to train movements the built-in catalog does not cover."
          icon={<MaterialIcons name="fitness-center" size={24} color={COLOR} />}
        />
      ) : (
        <View className="gap-3">
          {visibleExercises.map((exercise) => {
            const isEditing = editing?.id === exercise.id;
            const archived = Boolean(exercise.deleted_at);
            return (
              <Card key={exercise.id} accentColor={COLOR}>
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-medium" style={{ color: tokens.text }}>
                    {exercise.name}
                  </Text>
                  {archived ? (
                    <Text className="text-xs font-semibold" style={{ color: tokens.textMuted }}>
                      Archived
                    </Text>
                  ) : null}
                </View>
                <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
                  {MODALITY_LABELS[exercise.modality] ?? exercise.modality} ·{' '}
                  {exercise.primary_area}
                  {exercise.equipment ? ` · ${exercise.equipment}` : ''}
                </Text>
                {isEditing && editing ? (
                  <View className="mt-3 gap-2">
                    <TextField
                      label="Name"
                      accessibilityLabel="Edit custom exercise name"
                      value={editing.name}
                      onChangeText={(value) => setEditing({ ...editing, name: value })}
                    />
                    <TextField
                      label="Primary body area"
                      accessibilityLabel="Edit custom exercise primary area"
                      value={editing.area}
                      onChangeText={(value) => setEditing({ ...editing, area: value })}
                    />
                    <TextField
                      label="Equipment"
                      accessibilityLabel="Edit custom exercise equipment"
                      value={editing.equipment}
                      onChangeText={(value) => setEditing({ ...editing, equipment: value })}
                    />
                    <TextField
                      label="Search aliases (comma separated)"
                      accessibilityLabel="Edit custom exercise aliases"
                      value={editing.aliases}
                      onChangeText={(value) => setEditing({ ...editing, aliases: value })}
                    />
                    <TextField
                      label="Instructions (optional)"
                      accessibilityLabel="Edit custom exercise instructions"
                      value={editing.instructions}
                      onChangeText={(value) => setEditing({ ...editing, instructions: value })}
                    />
                    <View className="flex-row flex-wrap">
                      {(
                        ['weighted_strength', 'bodyweight', 'timed', 'cardio'] as WorkoutModality[]
                      ).map((modalityOption) => (
                        <PillChip
                          key={modalityOption}
                          label={MODALITY_LABELS[modalityOption]}
                          active={editing.modality === modalityOption}
                          color={COLOR}
                          onPress={() => setEditing({ ...editing, modality: modalityOption })}
                        />
                      ))}
                    </View>
                    <View className="flex-row flex-wrap">
                      <PillChip
                        label="Per side"
                        active={editing.unilateral}
                        color={COLOR}
                        onPress={() => setEditing({ ...editing, unilateral: !editing.unilateral })}
                      />
                      <PillChip
                        label="External load"
                        active={editing.supportsExternalLoad}
                        color={COLOR}
                        onPress={() =>
                          setEditing({
                            ...editing,
                            supportsExternalLoad: !editing.supportsExternalLoad,
                          })
                        }
                      />
                    </View>
                    <Button
                      label="Save changes"
                      accessibilityLabel="Save custom exercise changes"
                      color={COLOR}
                      onPress={() => void handleSaveEdit()}
                    />
                  </View>
                ) : (
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {!archived ? (
                      <Button
                        label="Edit"
                        accessibilityLabel={`Edit custom exercise ${exercise.name}`}
                        variant="ghost"
                        onPress={() => setEditing(toEditState(exercise))}
                      />
                    ) : null}
                    {archived ? (
                      <Button
                        label="Restore to library"
                        accessibilityLabel={`Restore custom exercise ${exercise.name} to library`}
                        variant="ghost"
                        onPress={() => void handleRestore(exercise)}
                      />
                    ) : (
                      <Button
                        label="Archive"
                        accessibilityLabel={`Archive custom exercise ${exercise.name}`}
                        variant="danger"
                        onPress={() => void handleArchive(exercise)}
                      />
                    )}
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}
      {confirmationDialog}
    </Modal>
  );
}
