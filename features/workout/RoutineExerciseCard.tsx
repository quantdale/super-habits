import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { NumberStepperField } from '@/core/ui/NumberStepperField';
import { PillChip } from '@/core/ui/PillChip';
import { validateSetTiming } from '@/lib/validation';
import { formatWorkoutTime } from './workout.domain';
import { SECTION_COLORS } from '@/constants/sectionColors';
import type {
  RoutineExercise,
  RoutineExerciseSet,
  WorkoutModality,
  WorkoutProgressionMode,
} from '@/core/db/types';
import type { RoutineExerciseUpdate, RoutineSetUpdate } from './workout.data';

const COLOR = SECTION_COLORS.workout;

type ExerciseWithSets = RoutineExercise & { sets: RoutineExerciseSet[] };

const MODALITY_LABELS: Record<WorkoutModality, string> = {
  weighted_strength: 'Strength',
  bodyweight: 'Bodyweight',
  timed: 'Timed',
  cardio: 'Cardio',
};

function summarizeExerciseSets(sets: RoutineExerciseSet[]): string {
  if (sets.length === 0) return 'No sets';
  const first = sets[0];
  const allSameActive = sets.every((s) => s.active_seconds === first.active_seconds);
  const allSameRest = sets.every((s) => s.rest_seconds === first.rest_seconds);
  const head = `${sets.length} set${sets.length === 1 ? '' : 's'}`;
  if (allSameActive && allSameRest) {
    return `${head} · ${formatWorkoutTime(first.active_seconds)} / ${formatWorkoutTime(first.rest_seconds)}`;
  }
  return `${head} · mixed`;
}

function displayModality(exercise: RoutineExercise): WorkoutModality | null {
  // A null catalog id is the deliberate legacy free-text compatibility path.
  if (!exercise.catalog_exercise_id) return null;
  return exercise.modality ?? 'timed';
}

type SetTimingUpdate = {
  activeSeconds?: number;
  restSeconds?: number;
} & RoutineSetUpdate;

export type RoutineExerciseCardProps = {
  exercise: ExerciseWithSets;
  firstExerciseId: string | undefined;
  lastExerciseId: string | undefined;
  isOpen: boolean;
  isActive?: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string, name: string) => void | Promise<void>;
  onMove: (id: string, direction: -1 | 1) => void | Promise<void>;
  onDrag?: () => void;
  onUpdateExercise: (id: string, updates: RoutineExerciseUpdate) => Promise<void>;
  onUpdateSet: (id: string, updates: SetTimingUpdate) => Promise<void>;
  onUpdateSetPrescription: (id: string, updates: RoutineSetUpdate) => Promise<void>;
  onDeleteSet: (id: string) => Promise<void>;
  onAddDefaultSet: (id: string) => Promise<void>;
  onRefresh: () => void | Promise<void>;
  onError: (message: string | null) => void;
};

export function RoutineExerciseCard({
  exercise: ex,
  firstExerciseId,
  lastExerciseId,
  isOpen,
  isActive = false,
  onToggle,
  onDelete,
  onMove,
  onDrag,
  onUpdateExercise,
  onUpdateSet,
  onUpdateSetPrescription,
  onDeleteSet,
  onAddDefaultSet,
  onRefresh,
  onError,
}: RoutineExerciseCardProps) {
  const { tokens } = useAppTheme();
  const modality = displayModality(ex);

  return (
    <Card accentColor={COLOR} style={isActive ? { opacity: 0.88 } : undefined}>
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => onToggle(ex.id)}
          className="min-w-0 flex-1 flex-row items-center gap-2"
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
        >
          {onDrag ? (
            <Pressable
              onLongPress={onDrag}
              delayLongPress={150}
              accessibilityRole="button"
              accessibilityLabel={`Reorder ${ex.name}`}
              hitSlop={8}
              className="rounded-lg p-1"
            >
              <MaterialIcons name="drag-handle" size={22} color={tokens.iconMuted} />
            </Pressable>
          ) : null}
          <View className="min-w-0 flex-1">
            <Text className="text-base font-medium" style={{ color: tokens.text }}>
              {ex.name}
            </Text>
            <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
              {summarizeExerciseSets(ex.sets)}
              {modality ? ` · ${MODALITY_LABELS[modality]}` : ' · Legacy free-text'}
            </Text>
          </View>
          <MaterialIcons
            name={isOpen ? 'expand-less' : 'expand-more'}
            size={24}
            color={tokens.iconMuted}
          />
        </Pressable>
        <Pressable onPress={() => void onDelete(ex.id, ex.name)} hitSlop={8} className="ml-2">
          <Text className="text-sm" style={{ color: tokens.dangerText }}>
            Remove
          </Text>
        </Pressable>
      </View>

      <View
        className="mt-3 flex-row items-center justify-between border-t pt-2"
        style={{ borderColor: tokens.border }}
      >
        <Text className="text-xs" style={{ color: tokens.textMuted }}>
          Order {ex.sort_order}
        </Text>
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => void onMove(ex.id, -1)}
            disabled={firstExerciseId === ex.id}
            accessibilityRole="button"
            accessibilityLabel={`Move ${ex.name} up`}
            className="rounded-lg px-2 py-1"
            style={{
              backgroundColor: tokens.surfaceElevated,
              opacity: firstExerciseId === ex.id ? 0.35 : 1,
            }}
          >
            <MaterialIcons name="keyboard-arrow-up" size={20} color={tokens.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => void onMove(ex.id, 1)}
            disabled={lastExerciseId === ex.id}
            accessibilityRole="button"
            accessibilityLabel={`Move ${ex.name} down`}
            className="rounded-lg px-2 py-1"
            style={{
              backgroundColor: tokens.surfaceElevated,
              opacity: lastExerciseId === ex.id ? 0.35 : 1,
            }}
          >
            <MaterialIcons name="keyboard-arrow-down" size={20} color={tokens.textMuted} />
          </Pressable>
        </View>
      </View>

      {isOpen ? (
        <View className="mt-4 border-t pt-3" style={{ borderColor: tokens.border }}>
          <Text
            className="mb-2 text-xs font-semibold uppercase"
            style={{ color: tokens.textMuted }}
          >
            Exercise setup
          </Text>
          <View className="mb-2 flex-row flex-wrap">
            {(['weighted_strength', 'bodyweight', 'timed', 'cardio'] as WorkoutModality[]).map(
              (option) => (
                <PillChip
                  key={option}
                  label={MODALITY_LABELS[option]}
                  active={modality === option}
                  color={COLOR}
                  onPress={() =>
                    void onUpdateExercise(ex.id, {
                      modality: option,
                      catalogExerciseId: ex.catalog_exercise_id ?? null,
                    }).then(onRefresh)
                  }
                />
              ),
            )}
          </View>
          <TextInput
            accessibilityLabel={`${ex.name} notes`}
            value={ex.notes ?? ''}
            onChangeText={(value) => {
              void onUpdateExercise(ex.id, { notes: value }).then(onRefresh);
            }}
            placeholder="Cues or setup notes"
            placeholderTextColor={tokens.textMuted}
            className="mb-3 rounded-xl border px-3 py-2 text-sm"
            style={{
              borderColor: tokens.border,
              backgroundColor: tokens.surfaceElevated,
              color: tokens.text,
            }}
          />
          <TextInput
            accessibilityLabel={`${ex.name} superset group`}
            value={ex.superset_group ?? ''}
            onChangeText={(value) => {
              void onUpdateExercise(ex.id, { supersetGroup: value }).then(onRefresh);
            }}
            placeholder="Superset group (optional)"
            placeholderTextColor={tokens.textMuted}
            className="mb-3 rounded-xl border px-3 py-2 text-sm"
            style={{
              borderColor: tokens.border,
              backgroundColor: tokens.surfaceElevated,
              color: tokens.text,
            }}
          />
          {modality === 'weighted_strength' || modality === 'bodyweight' || modality === null ? (
            <>
              <Text
                className="mb-2 text-xs font-semibold uppercase"
                style={{ color: tokens.textMuted }}
              >
                Progression
              </Text>
              <View className="mb-2 flex-row flex-wrap">
                {(['none', 'linear', 'double'] as WorkoutProgressionMode[]).map((option) => (
                  <PillChip
                    key={option}
                    label={option === 'none' ? 'Manual' : option === 'double' ? 'Double' : 'Linear'}
                    active={(ex.progression_mode ?? 'none') === option}
                    color={COLOR}
                    onPress={() =>
                      void onUpdateExercise(ex.id, { progressionMode: option }).then(onRefresh)
                    }
                  />
                ))}
              </View>
              <View className="flex-row gap-2">
                <View className="min-w-0 flex-1">
                  <TextInput
                    accessibilityLabel={`${ex.name} progression increment`}
                    value={ex.progression_increment == null ? '' : String(ex.progression_increment)}
                    onChangeText={(value) => {
                      const parsed = Number(value.replace(/[^0-9.]/g, ''));
                      void onUpdateExercise(ex.id, {
                        progressionIncrement: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
                      }).then(onRefresh);
                    }}
                    placeholder="Load + (kg)"
                    placeholderTextColor={tokens.textMuted}
                    keyboardType="decimal-pad"
                    className="rounded-xl border px-3 py-2 text-sm"
                    style={{
                      borderColor: tokens.border,
                      backgroundColor: tokens.surfaceElevated,
                      color: tokens.text,
                    }}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <TextInput
                    accessibilityLabel={`${ex.name} minimum reps`}
                    value={ex.progression_min_reps == null ? '' : String(ex.progression_min_reps)}
                    onChangeText={(value) => {
                      const parsed = Number(value.replace(/\D/g, ''));
                      void onUpdateExercise(ex.id, {
                        progressionMinReps: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
                      }).then(onRefresh);
                    }}
                    placeholder="Min reps"
                    placeholderTextColor={tokens.textMuted}
                    keyboardType="number-pad"
                    className="rounded-xl border px-3 py-2 text-sm"
                    style={{
                      borderColor: tokens.border,
                      backgroundColor: tokens.surfaceElevated,
                      color: tokens.text,
                    }}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <TextInput
                    accessibilityLabel={`${ex.name} maximum reps`}
                    value={ex.progression_max_reps == null ? '' : String(ex.progression_max_reps)}
                    onChangeText={(value) => {
                      const parsed = Number(value.replace(/\D/g, ''));
                      void onUpdateExercise(ex.id, {
                        progressionMaxReps: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
                      }).then(onRefresh);
                    }}
                    placeholder="Max reps"
                    placeholderTextColor={tokens.textMuted}
                    keyboardType="number-pad"
                    className="rounded-xl border px-3 py-2 text-sm"
                    style={{
                      borderColor: tokens.border,
                      backgroundColor: tokens.surfaceElevated,
                      color: tokens.text,
                    }}
                  />
                </View>
              </View>
            </>
          ) : null}
          {ex.sets.map((set) => (
            <View key={set.id} className="mb-4">
              <Text className="mb-2 text-xs font-medium" style={{ color: tokens.textMuted }}>
                Set {set.set_number}
              </Text>
              <NumberStepperField
                label="Active (seconds)"
                value={String(set.active_seconds)}
                onChange={async (value) => {
                  const next = Math.round(Number(value.trim()));
                  if (!Number.isFinite(next)) return;
                  const timingErr = validateSetTiming(next, set.rest_seconds);
                  if (timingErr) {
                    onError(timingErr);
                    return;
                  }
                  onError(null);
                  try {
                    await onUpdateSet(set.id, { activeSeconds: next });
                  } catch (error) {
                    onError(error instanceof Error ? error.message : 'Could not update the set.');
                    return;
                  }
                  void onRefresh();
                }}
                min={5}
                max={3600}
              />
              <NumberStepperField
                label="Rest (seconds)"
                value={String(set.rest_seconds)}
                onChange={async (value) => {
                  const next = Math.round(Number(value.trim()));
                  if (!Number.isFinite(next)) return;
                  const timingErr = validateSetTiming(set.active_seconds, next);
                  if (timingErr) {
                    onError(timingErr);
                    return;
                  }
                  onError(null);
                  try {
                    await onUpdateSet(set.id, { restSeconds: next });
                  } catch (error) {
                    onError(error instanceof Error ? error.message : 'Could not update the set.');
                    return;
                  }
                  void onRefresh();
                }}
                min={0}
                max={1800}
              />
              {modality === 'weighted_strength' ||
              modality === 'bodyweight' ||
              modality === null ? (
                <View className="flex-row gap-2">
                  <View className="min-w-0 flex-1">
                    <NumberStepperField
                      label="Target reps min"
                      value={set.target_reps_min == null ? '' : String(set.target_reps_min)}
                      onChange={(value) =>
                        void onUpdateSetPrescription(set.id, {
                          targetRepsMin: value ? Number(value) : null,
                        }).then(onRefresh)
                      }
                      min={1}
                      max={200}
                      placeholder="—"
                    />
                  </View>
                  <View className="min-w-0 flex-1">
                    <NumberStepperField
                      label="Target reps max"
                      value={set.target_reps_max == null ? '' : String(set.target_reps_max)}
                      onChange={(value) =>
                        void onUpdateSetPrescription(set.id, {
                          targetRepsMax: value ? Number(value) : null,
                        }).then(onRefresh)
                      }
                      min={1}
                      max={200}
                      placeholder="—"
                    />
                  </View>
                </View>
              ) : null}
              {modality === 'cardio' ? (
                <View className="flex-row gap-2">
                  <View className="min-w-0 flex-1">
                    <TextInput
                      accessibilityLabel="Target distance"
                      value={set.target_distance == null ? '' : String(set.target_distance)}
                      onChangeText={(value) =>
                        void onUpdateSetPrescription(set.id, {
                          targetDistance: value ? Number(value) : null,
                        }).then(onRefresh)
                      }
                      placeholder="Distance"
                      placeholderTextColor={tokens.textMuted}
                      keyboardType="decimal-pad"
                      className="rounded-xl border px-3 py-2 text-sm"
                      style={{
                        borderColor: tokens.border,
                        backgroundColor: tokens.surfaceElevated,
                        color: tokens.text,
                      }}
                    />
                  </View>
                  <View className="min-w-0 flex-1">
                    <TextInput
                      accessibilityLabel="Target pace"
                      value={set.target_pace == null ? '' : String(set.target_pace)}
                      onChangeText={(value) =>
                        void onUpdateSetPrescription(set.id, {
                          targetPace: value ? Number(value) : null,
                        }).then(onRefresh)
                      }
                      placeholder="Pace / speed"
                      placeholderTextColor={tokens.textMuted}
                      keyboardType="decimal-pad"
                      className="rounded-xl border px-3 py-2 text-sm"
                      style={{
                        borderColor: tokens.border,
                        backgroundColor: tokens.surfaceElevated,
                        color: tokens.text,
                      }}
                    />
                  </View>
                </View>
              ) : null}
              {modality === 'weighted_strength' || modality === 'bodyweight' ? (
                <TextInput
                  accessibilityLabel="Target load"
                  value={set.target_load == null ? '' : String(set.target_load)}
                  onChangeText={(value) =>
                    void onUpdateSetPrescription(set.id, {
                      targetLoad: value ? Number(value) : null,
                    }).then(onRefresh)
                  }
                  placeholder={
                    modality === 'bodyweight'
                      ? 'Additional load (optional)'
                      : 'Target load (optional)'
                  }
                  placeholderTextColor={tokens.textMuted}
                  keyboardType="decimal-pad"
                  className="mb-3 rounded-xl border px-3 py-2 text-sm"
                  style={{
                    borderColor: tokens.border,
                    backgroundColor: tokens.surfaceElevated,
                    color: tokens.text,
                  }}
                />
              ) : null}
              {modality === 'timed' || modality === 'cardio' ? (
                <NumberStepperField
                  label="Target duration (seconds)"
                  value={
                    set.target_duration_seconds == null ? '' : String(set.target_duration_seconds)
                  }
                  onChange={(value) =>
                    void onUpdateSetPrescription(set.id, {
                      targetDurationSeconds: value ? Number(value) : null,
                    }).then(onRefresh)
                  }
                  min={5}
                  max={3600}
                  placeholder={String(set.active_seconds)}
                />
              ) : null}
              {ex.sets.length > 1 ? (
                <Pressable
                  onPress={async () => {
                    await onDeleteSet(set.id);
                    void onRefresh();
                  }}
                  className="self-end"
                  hitSlop={8}
                >
                  <Text className="text-sm" style={{ color: tokens.textMuted }}>
                    Remove set
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable
            onPress={async () => {
              await onAddDefaultSet(ex.id);
              void onRefresh();
            }}
          >
            <Text className="text-xs text-workout">+ Add set</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}
