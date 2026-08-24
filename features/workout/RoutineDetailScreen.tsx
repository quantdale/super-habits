import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View, Text, Pressable, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useAppTheme } from '@/core/providers/themeContext';
import { Modal } from '@/core/ui/Modal';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import {
  listExercises,
  addExercise,
  deleteExercise,
  listSets,
  addDefaultSet,
  updateSet,
  deleteSet,
  updateExercise,
  updateExerciseOrder,
  updateSetPrescription,
  listCustomExercises,
  createCustomExercise,
} from './workout.data';
import type { RoutineExercise, RoutineExerciseSet } from './types';
import type { CustomExercise, WorkoutModality, WorkoutProgressionMode } from '@/core/db/types';
import {
  BUILT_IN_EXERCISES,
  buildExerciseSearchText,
  exerciseSupportsExternalLoad,
  getExerciseAliases,
  type ExerciseCatalogItem,
} from './exerciseCatalog';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { ValidationError } from '@/core/ui/ValidationError';
import { validateExerciseName, validateSetTiming } from '@/lib/validation';
import { NumberStepperField } from '@/core/ui/NumberStepperField';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { PillChip } from '@/core/ui/PillChip';
import { TextField } from '@/core/ui/TextField';
import { RoutineExerciseCard } from './RoutineExerciseCard';

const COLOR = SECTION_COLORS.workout;

type ExerciseWithSets = RoutineExercise & { sets: RoutineExerciseSet[] };

function summarizeExerciseSets(sets: RoutineExerciseSet[]): string {
  if (sets.length === 0) return 'No sets';
  const first = sets[0];
  const allSameActive = sets.every((s) => s.active_seconds === first.active_seconds);
  const allSameRest = sets.every((s) => s.rest_seconds === first.rest_seconds);
  const head = `${sets.length} set${sets.length === 1 ? '' : 's'}`;
  if (allSameActive && allSameRest) {
    return `${head} · ${first.active_seconds}s / ${first.rest_seconds}s`;
  }
  return `${head} · mixed`;
}

function displayModality(exercise: RoutineExercise): WorkoutModality | null {
  if (!exercise.catalog_exercise_id) return null;
  return exercise.modality ?? 'timed';
}

const MODALITY_LABELS: Record<WorkoutModality, string> = {
  weighted_strength: 'Strength',
  bodyweight: 'Bodyweight',
  timed: 'Timed',
  cardio: 'Cardio',
};

function parseCustomAreas(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

type Props = {
  visible: boolean;
  routineId: string;
  routineName: string;
  onClose: () => void;
  onStartWorkout: () => void | Promise<void>;
  onUseAsTemplate?: () => void | Promise<void>;
};

export function RoutineDetailModal({
  visible,
  routineId,
  routineName,
  onClose,
  onStartWorkout,
  onUseAsTemplate,
}: Props) {
  const { tokens } = useAppTheme();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [exercises, setExercises] = useState<ExerciseWithSets[]>([]);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerArea, setPickerArea] = useState<string | null>(null);
  const [pickerEquipment, setPickerEquipment] = useState<string | null>(null);
  const [pickerModality, setPickerModality] = useState<WorkoutModality | null>(null);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [customName, setCustomName] = useState('');
  const [customArea, setCustomArea] = useState('full-body');
  const [customEquipment, setCustomEquipment] = useState('');
  const [customModality, setCustomModality] = useState<WorkoutModality>('weighted_strength');
  const [customAliases, setCustomAliases] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [customUnilateral, setCustomUnilateral] = useState(false);
  const [customSupportsExternalLoad, setCustomSupportsExternalLoad] = useState(true);
  const pendingBuilderMutationsRef = useRef<Promise<void>>(Promise.resolve());

  const refresh = useCallback(async () => {
    const exList = await listExercises(routineId);
    const withSets = await Promise.all(
      exList.map(async (ex) => ({
        ...ex,
        sets: await listSets(ex.id),
      })),
    );
    setExercises(withSets);
  }, [routineId]);

  // Text inputs and prescription chips can emit several writes before React
  // has rendered the next snapshot. Serialize those writes and make the
  // primary action wait for them, so a session can never start from a stale
  // routine configuration.
  const queueBuilderMutation = useCallback((mutation: () => Promise<void>): Promise<void> => {
    const next = pendingBuilderMutationsRef.current.then(mutation, mutation);
    pendingBuilderMutationsRef.current = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }, []);

  const waitForBuilderMutations = useCallback(async () => {
    await pendingBuilderMutationsRef.current;
    await onStartWorkout();
  }, [onStartWorkout]);

  const queuedUpdateExercise = useCallback(
    (id: string, updates: Parameters<typeof updateExercise>[1]) =>
      queueBuilderMutation(() => updateExercise(id, updates)),
    [queueBuilderMutation],
  );

  const queuedUpdateSet = useCallback(
    (id: string, updates: Parameters<typeof updateSet>[1]) =>
      queueBuilderMutation(() => updateSet(id, updates)),
    [queueBuilderMutation],
  );

  const queuedUpdateSetPrescription = useCallback(
    (id: string, updates: Parameters<typeof updateSetPrescription>[1]) =>
      queueBuilderMutation(() => updateSetPrescription(id, updates)),
    [queueBuilderMutation],
  );

  const queuedDeleteSet = useCallback(
    (id: string) => queueBuilderMutation(() => deleteSet(id)),
    [queueBuilderMutation],
  );

  const queuedAddDefaultSet = useCallback(
    (exerciseId: string) => queueBuilderMutation(() => addDefaultSet(exerciseId)),
    [queueBuilderMutation],
  );

  useEffect(() => {
    if (!visible || !routineId) return;
    // Data fetch on open: setExercises fires after the awaits inside
    // refresh(), not synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [visible, routineId, refresh]);

  useEffect(() => {
    if (!pickerVisible) return;
    void listCustomExercises()
      .then(setCustomExercises)
      .catch(() => setCustomExercises([]));
  }, [pickerVisible]);

  // Collapse the open exercise when the modal closes, without an effect:
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) setExpandedId(null);
  }

  const handleAddExercise = async () => {
    const err = validateExerciseName(newExerciseName);
    if (err) {
      setWorkoutError(err);
      return;
    }
    setWorkoutError(null);
    const exId = await addExercise({
      routineId,
      name: newExerciseName.trim(),
      sortOrder: exercises.length + 1,
    });
    await queuedAddDefaultSet(exId);
    setNewExerciseName('');
    await refresh();
    setExpandedId(exId);
  };

  const handleAddCatalogExercise = async (item: ExerciseCatalogItem) => {
    const exId = await addExercise({
      routineId,
      name: item.name,
      catalogExerciseId: item.id,
      modality: item.modality,
      unilateral: item.unilateral,
      supportsExternalLoad: exerciseSupportsExternalLoad(item),
      sortOrder: exercises.length + 1,
    });
    await queuedAddDefaultSet(exId);
    setPickerVisible(false);
    await refresh();
    setExpandedId(exId);
  };

  const handleCreateCustomExercise = async () => {
    if (!customName.trim()) {
      setWorkoutError('Custom exercise name is required.');
      return;
    }
    try {
      const id = await createCustomExercise({
        name: customName,
        primaryArea: customArea,
        equipment: customEquipment || null,
        modality: customModality,
        aliases: customAliases.split(','),
        instructions: customInstructions,
        unilateral: customUnilateral,
        supportsExternalLoad: customSupportsExternalLoad,
      });
      const created: ExerciseCatalogItem = {
        id,
        name: customName.trim(),
        primaryArea: customArea,
        secondaryAreas: [],
        equipment: customEquipment.trim() || 'other',
        modality: customModality,
        unilateral: customUnilateral,
        aliases: customAliases.split(','),
        instructions: customInstructions.trim() || undefined,
        supportsExternalLoad: customSupportsExternalLoad,
      };
      await handleAddCatalogExercise(created);
      setCustomName('');
      setCustomEquipment('');
      setCustomAliases('');
      setCustomInstructions('');
      setCustomUnilateral(false);
      setCustomSupportsExternalLoad(customModality === 'weighted_strength');
      setWorkoutError(null);
    } catch (error) {
      setWorkoutError(error instanceof Error ? error.message : 'Could not create exercise.');
    }
  };

  const filteredCatalog = [
    ...BUILT_IN_EXERCISES,
    ...customExercises.map((exercise): ExerciseCatalogItem => ({
      id: exercise.id,
      name: exercise.name,
      description: exercise.description ?? undefined,
      primaryArea: exercise.primary_area,
      secondaryAreas: parseCustomAreas(exercise.secondary_areas),
      equipment: exercise.equipment ?? 'other',
      modality: exercise.modality,
      unilateral: exercise.unilateral === 1,
      aliases: exercise.aliases ? parseCustomAreas(exercise.aliases) : [],
      instructions: exercise.instructions ?? undefined,
      supportsExternalLoad:
        exercise.supports_external_load === undefined
          ? exercise.modality === 'weighted_strength'
          : exercise.supports_external_load === 1,
    })),
  ].filter((exercise) => {
    const query = pickerQuery.trim().toLowerCase();
    return (
      (!query ||
        buildExerciseSearchText(exercise).includes(query) ||
        getExerciseAliases(exercise).some((alias) => alias.includes(query))) &&
      (!pickerArea || exercise.primaryArea === pickerArea) &&
      (!pickerEquipment || exercise.equipment === pickerEquipment) &&
      (!pickerModality || exercise.modality === pickerModality)
    );
  });

  const moveExercise = async (id: string, direction: -1 | 1) => {
    const index = exercises.findIndex((exercise) => exercise.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= exercises.length) return;
    const next = [...exercises];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setExercises(next);
    await queueBuilderMutation(() => updateExerciseOrder(next.map((exercise) => exercise.id)));
    await refresh();
  };

  const handleDragEnd = async ({ data }: { data: ExerciseWithSets[] }) => {
    setExercises(data);
    await queueBuilderMutation(() => updateExerciseOrder(data.map((exercise) => exercise.id)));
    await refresh();
  };

  const handleDeleteExercise = useCallback(
    async (id: string, name: string) => {
      const confirmed = await confirm({
        title: 'Remove exercise',
        message: `Remove "${name}" and all its sets?`,
        confirmLabel: 'Remove exercise',
        confirmVariant: 'danger',
      });
      if (!confirmed) return;

      await deleteExercise(id);
      if (expandedId === id) setExpandedId(null);
      await refresh();
    },
    [confirm, expandedId, refresh],
  );

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <Modal visible={visible} onClose={onClose} title={routineName} scroll>
        <View
          className="mb-4 rounded-2xl border px-4 py-3"
          style={{ borderColor: `${COLOR}33`, backgroundColor: `${COLOR}14` }}
        >
          <Text className="text-sm font-semibold" style={{ color: COLOR }}>
            Routine builder
          </Text>
          <Text className="mt-1 text-sm" style={{ color: COLOR }}>
            Add exercises, tune work and rest intervals, then start the routine when it is ready.
          </Text>
        </View>

        {Platform.OS === 'web' ? (
          <View className="gap-3">
            {exercises.map((ex) => {
              const isOpen = expandedId === ex.id;
              const modality = displayModality(ex);
              const supportsExternalLoad =
                ex.supports_external_load === undefined
                  ? modality === 'weighted_strength' || modality === null
                  : ex.supports_external_load === 1;
              return (
                <Card key={ex.id} accentColor={COLOR}>
                  <View className="flex-row items-center justify-between">
                    <Pressable
                      onPress={() => toggleExpanded(ex.id)}
                      className="min-w-0 flex-1 flex-row items-center gap-2"
                      accessibilityRole="button"
                      accessibilityLabel={`Configure ${ex.name} exercise`}
                      accessibilityState={{ expanded: isOpen }}
                    >
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
                    <Pressable
                      onPress={() => void handleDeleteExercise(ex.id, ex.name)}
                      hitSlop={8}
                      className="ml-2"
                    >
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
                        onPress={() => void moveExercise(ex.id, -1)}
                        disabled={exercises[0]?.id === ex.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Move ${ex.name} up`}
                        className="rounded-lg px-2 py-1"
                        style={{
                          backgroundColor: tokens.surfaceElevated,
                          opacity: exercises[0]?.id === ex.id ? 0.35 : 1,
                        }}
                      >
                        <MaterialIcons
                          name="keyboard-arrow-up"
                          size={20}
                          color={tokens.textMuted}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => void moveExercise(ex.id, 1)}
                        disabled={exercises[exercises.length - 1]?.id === ex.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Move ${ex.name} down`}
                        className="rounded-lg px-2 py-1"
                        style={{
                          backgroundColor: tokens.surfaceElevated,
                          opacity: exercises[exercises.length - 1]?.id === ex.id ? 0.35 : 1,
                        }}
                      >
                        <MaterialIcons
                          name="keyboard-arrow-down"
                          size={20}
                          color={tokens.textMuted}
                        />
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
                        {(
                          [
                            'weighted_strength',
                            'bodyweight',
                            'timed',
                            'cardio',
                          ] as WorkoutModality[]
                        ).map((option) => (
                          <PillChip
                            key={option}
                            label={MODALITY_LABELS[option]}
                            active={modality === option}
                            color={COLOR}
                            onPress={() =>
                              void queuedUpdateExercise(ex.id, {
                                modality: option,
                                catalogExerciseId: ex.catalog_exercise_id ?? null,
                                supportsExternalLoad:
                                  option === 'weighted_strength'
                                    ? true
                                    : option === 'bodyweight'
                                      ? ex.supports_external_load === 1
                                      : false,
                              }).then(refresh)
                            }
                          />
                        ))}
                      </View>
                      {modality ? (
                        <View className="mb-3 flex-row flex-wrap">
                          <PillChip
                            label="Per side"
                            active={ex.unilateral === 1}
                            color={COLOR}
                            onPress={() =>
                              void queuedUpdateExercise(ex.id, {
                                unilateral: ex.unilateral !== 1,
                              }).then(refresh)
                            }
                          />
                          <PillChip
                            label="External load"
                            active={supportsExternalLoad}
                            color={COLOR}
                            onPress={() =>
                              void queuedUpdateExercise(ex.id, {
                                supportsExternalLoad: !supportsExternalLoad,
                              }).then(refresh)
                            }
                          />
                        </View>
                      ) : null}
                      <TextInput
                        accessibilityLabel={`${ex.name} notes`}
                        value={ex.notes ?? ''}
                        onChangeText={(value) => {
                          void queuedUpdateExercise(ex.id, { notes: value }).then(refresh);
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
                          void queuedUpdateExercise(ex.id, { supersetGroup: value }).then(refresh);
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
                      {modality === 'weighted_strength' ||
                      modality === 'bodyweight' ||
                      modality === null ? (
                        <>
                          <Text
                            className="mb-2 text-xs font-semibold uppercase"
                            style={{ color: tokens.textMuted }}
                          >
                            Progression
                          </Text>
                          <View className="mb-2 flex-row flex-wrap">
                            {(['none', 'linear', 'double'] as WorkoutProgressionMode[]).map(
                              (option) => (
                                <PillChip
                                  key={option}
                                  label={
                                    option === 'none'
                                      ? 'Manual'
                                      : option === 'double'
                                        ? 'Double'
                                        : 'Linear'
                                  }
                                  active={(ex.progression_mode ?? 'none') === option}
                                  color={COLOR}
                                  onPress={() =>
                                    void queuedUpdateExercise(ex.id, {
                                      progressionMode: option,
                                    }).then(refresh)
                                  }
                                />
                              ),
                            )}
                          </View>
                          <View className="flex-row gap-2">
                            <View className="min-w-0 flex-1">
                              <TextInput
                                accessibilityLabel={`${ex.name} progression increment`}
                                value={
                                  ex.progression_increment == null
                                    ? ''
                                    : String(ex.progression_increment)
                                }
                                onChangeText={(value) => {
                                  const parsed = Number(value.replace(/[^0-9.]/g, ''));
                                  void queuedUpdateExercise(ex.id, {
                                    progressionIncrement:
                                      Number.isFinite(parsed) && parsed > 0 ? parsed : null,
                                  }).then(refresh);
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
                                value={
                                  ex.progression_min_reps == null
                                    ? ''
                                    : String(ex.progression_min_reps)
                                }
                                onChangeText={(value) => {
                                  const parsed = Number(value.replace(/\D/g, ''));
                                  void queuedUpdateExercise(ex.id, {
                                    progressionMinReps:
                                      Number.isFinite(parsed) && parsed > 0 ? parsed : null,
                                  }).then(refresh);
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
                                value={
                                  ex.progression_max_reps == null
                                    ? ''
                                    : String(ex.progression_max_reps)
                                }
                                onChangeText={(value) => {
                                  const parsed = Number(value.replace(/\D/g, ''));
                                  void queuedUpdateExercise(ex.id, {
                                    progressionMaxReps:
                                      Number.isFinite(parsed) && parsed > 0 ? parsed : null,
                                  }).then(refresh);
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
                          <Text
                            className="mb-2 text-xs font-medium"
                            style={{ color: tokens.textMuted }}
                          >
                            Set {set.set_number}
                          </Text>
                          <NumberStepperField
                            label="Active (seconds)"
                            value={String(set.active_seconds)}
                            onChange={async (v) => {
                              const next = Math.round(Number(v.trim()));
                              if (!Number.isFinite(next)) return;
                              const timingErr = validateSetTiming(next, set.rest_seconds);
                              if (timingErr) {
                                setWorkoutError(timingErr);
                                return;
                              }
                              setWorkoutError(null);
                              try {
                                await queuedUpdateSet(set.id, { activeSeconds: next });
                              } catch (error) {
                                setWorkoutError(
                                  error instanceof Error
                                    ? error.message
                                    : 'Could not update the set.',
                                );
                                return;
                              }
                              void refresh();
                            }}
                            min={5}
                            max={3600}
                          />
                          <NumberStepperField
                            label="Rest (seconds)"
                            value={String(set.rest_seconds)}
                            onChange={async (v) => {
                              const next = Math.round(Number(v.trim()));
                              if (!Number.isFinite(next)) return;
                              const timingErr = validateSetTiming(set.active_seconds, next);
                              if (timingErr) {
                                setWorkoutError(timingErr);
                                return;
                              }
                              setWorkoutError(null);
                              try {
                                await queuedUpdateSet(set.id, { restSeconds: next });
                              } catch (error) {
                                setWorkoutError(
                                  error instanceof Error
                                    ? error.message
                                    : 'Could not update the set.',
                                );
                                return;
                              }
                              void refresh();
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
                                  value={
                                    set.target_reps_min == null ? '' : String(set.target_reps_min)
                                  }
                                  onChange={(value) =>
                                    void queuedUpdateSetPrescription(set.id, {
                                      targetRepsMin: value ? Number(value) : null,
                                    }).then(refresh)
                                  }
                                  min={1}
                                  max={200}
                                  placeholder="—"
                                />
                              </View>
                              <View className="min-w-0 flex-1">
                                <NumberStepperField
                                  label="Target reps max"
                                  value={
                                    set.target_reps_max == null ? '' : String(set.target_reps_max)
                                  }
                                  onChange={(value) =>
                                    void queuedUpdateSetPrescription(set.id, {
                                      targetRepsMax: value ? Number(value) : null,
                                    }).then(refresh)
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
                                  value={
                                    set.target_distance == null ? '' : String(set.target_distance)
                                  }
                                  onChangeText={(value) =>
                                    void queuedUpdateSetPrescription(set.id, {
                                      targetDistance: value ? Number(value) : null,
                                    }).then(refresh)
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
                                    void queuedUpdateSetPrescription(set.id, {
                                      targetPace: value ? Number(value) : null,
                                    }).then(refresh)
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
                                void queuedUpdateSetPrescription(set.id, {
                                  targetLoad: value ? Number(value) : null,
                                }).then(refresh)
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
                                set.target_duration_seconds == null
                                  ? ''
                                  : String(set.target_duration_seconds)
                              }
                              onChange={(value) =>
                                void queuedUpdateSetPrescription(set.id, {
                                  targetDurationSeconds: value ? Number(value) : null,
                                }).then(refresh)
                              }
                              min={5}
                              max={3600}
                              placeholder={String(set.active_seconds)}
                            />
                          ) : null}
                          {ex.sets.length > 1 ? (
                            <Pressable
                              onPress={async () => {
                                await queuedDeleteSet(set.id);
                                void refresh();
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
                          await queuedAddDefaultSet(ex.id);
                          void refresh();
                        }}
                      >
                        <Text className="text-xs text-workout">+ Add set</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        ) : (
          <DraggableFlatList
            data={exercises}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            activationDistance={8}
            ItemSeparatorComponent={() => <View className="h-3" />}
            onDragEnd={(result) => void handleDragEnd(result)}
            renderItem={({ item, drag, isActive }) => (
              <ScaleDecorator>
                <RoutineExerciseCard
                  exercise={item}
                  firstExerciseId={exercises[0]?.id}
                  lastExerciseId={exercises[exercises.length - 1]?.id}
                  isOpen={expandedId === item.id}
                  isActive={isActive}
                  onToggle={toggleExpanded}
                  onDelete={handleDeleteExercise}
                  onMove={moveExercise}
                  onDrag={drag}
                  onUpdateExercise={queuedUpdateExercise}
                  onUpdateSet={queuedUpdateSet}
                  onUpdateSetPrescription={queuedUpdateSetPrescription}
                  onDeleteSet={queuedDeleteSet}
                  onAddDefaultSet={queuedAddDefaultSet}
                  onRefresh={refresh}
                  onError={setWorkoutError}
                />
              </ScaleDecorator>
            )}
          />
        )}

        <View className="mt-6">
          <Text className="mb-2 text-sm font-semibold" style={{ color: tokens.text }}>
            Add exercise
          </Text>
          <Text className="mb-3 text-sm" style={{ color: tokens.textMuted }}>
            Pick a built-in/custom exercise for rich prescriptions, or keep using a legacy free-text
            name when you need a one-off movement.
          </Text>
          <ValidationError message={workoutError} />
          <Button
            label="Choose from exercise library"
            variant="ghost"
            onPress={() => {
              setWorkoutError(null);
              setPickerVisible(true);
            }}
          />
          <Text className="my-3 text-center text-xs" style={{ color: tokens.textMuted }}>
            or add a legacy free-text exercise
          </Text>
          <View className="flex-row gap-2">
            <TextInput
              value={newExerciseName}
              onChangeText={(t) => {
                setWorkoutError(null);
                setNewExerciseName(t);
              }}
              accessibilityLabel="Exercise name"
              placeholder="e.g. Rows, Curls, Push-ups"
              className="flex-1 rounded-xl border px-3 py-2 text-sm"
              style={{
                borderColor: tokens.border,
                backgroundColor: tokens.surfaceElevated,
                color: tokens.text,
              }}
              onSubmitEditing={handleAddExercise}
              returnKeyType="done"
              placeholderTextColor={tokens.textMuted}
            />
            <Button label="Add" onPress={handleAddExercise} color={COLOR} />
          </View>
        </View>

        {exercises.length > 0 ? (
          <View className="mt-6">
            <Button
              label="Start workout"
              onPress={() => void waitForBuilderMutations()}
              color={COLOR}
            />
          </View>
        ) : null}

        {exercises.length > 0 && onUseAsTemplate ? (
          <View className="mt-3">
            <Button
              label="Use as template (duplicate)"
              variant="ghost"
              onPress={() => void onUseAsTemplate()}
            />
            <Text className="mt-1 text-center text-xs" style={{ color: tokens.textMuted }}>
              Creates “{routineName} (copy)” with the same exercises and sets.
            </Text>
          </View>
        ) : null}
      </Modal>
      <Modal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        title="Exercise library"
        scroll
      >
        <TextField
          label="Search exercises"
          value={pickerQuery}
          onChangeText={setPickerQuery}
          placeholder="Bench, squat, cardio…"
        />
        <Text className="mb-2 text-xs font-semibold uppercase" style={{ color: tokens.textMuted }}>
          Body area
        </Text>
        <View className="mb-2 flex-row flex-wrap">
          {[
            'all',
            'chest',
            'back',
            'shoulders',
            'arms',
            'quads',
            'hamstrings',
            'glutes',
            'calves',
            'core',
            'full-body',
            'cardio',
          ].map((area) => (
            <PillChip
              key={area}
              label={area === 'all' ? 'All' : area}
              active={(pickerArea ?? 'all') === area}
              color={COLOR}
              onPress={() => setPickerArea(area === 'all' ? null : area)}
            />
          ))}
        </View>
        <Text className="mb-2 text-xs font-semibold uppercase" style={{ color: tokens.textMuted }}>
          Equipment
        </Text>
        <View className="mb-2 flex-row flex-wrap">
          {[
            'all',
            'barbell',
            'dumbbells',
            'cable',
            'machine',
            'bodyweight',
            'pull-up bar',
            'treadmill',
            'bike',
            'other',
          ].map((equipment) => (
            <PillChip
              key={equipment}
              label={equipment === 'all' ? 'All' : equipment}
              active={(pickerEquipment ?? 'all') === equipment}
              color={COLOR}
              onPress={() => setPickerEquipment(equipment === 'all' ? null : equipment)}
            />
          ))}
        </View>
        <Text className="mb-2 text-xs font-semibold uppercase" style={{ color: tokens.textMuted }}>
          Modality
        </Text>
        <View className="mb-3 flex-row flex-wrap">
          <PillChip
            label="All"
            active={pickerModality === null}
            color={COLOR}
            onPress={() => setPickerModality(null)}
          />
          {(['weighted_strength', 'bodyweight', 'timed', 'cardio'] as WorkoutModality[]).map(
            (modalityOption) => (
              <PillChip
                key={modalityOption}
                label={MODALITY_LABELS[modalityOption]}
                active={pickerModality === modalityOption}
                color={COLOR}
                onPress={() => setPickerModality(modalityOption)}
              />
            ),
          )}
        </View>
        <View className="gap-2">
          {filteredCatalog.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => void handleAddCatalogExercise(item)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.name}`}
              className="rounded-2xl border px-4 py-3"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
            >
              <View className="flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                    {item.name}
                  </Text>
                  <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
                    {MODALITY_LABELS[item.modality]} · {item.primaryArea} · {item.equipment}
                  </Text>
                </View>
                <MaterialIcons name="add-circle-outline" size={22} color={COLOR} />
              </View>
            </Pressable>
          ))}
        </View>
        <View className="mt-5 border-t pt-4" style={{ borderColor: tokens.border }}>
          <Text className="mb-1 text-sm font-semibold" style={{ color: tokens.text }}>
            Create custom exercise
          </Text>
          <Text className="mb-3 text-xs" style={{ color: tokens.textMuted }}>
            Custom exercises stay on this account and are included in backup/restore.
          </Text>
          <TextField
            label="Name"
            value={customName}
            onChangeText={setCustomName}
            placeholder="Cable press variation"
          />
          <TextField
            label="Primary body area"
            value={customArea}
            onChangeText={setCustomArea}
            placeholder="chest"
          />
          <TextField
            label="Equipment"
            value={customEquipment}
            onChangeText={setCustomEquipment}
            placeholder="cable, barbell, none"
          />
          <TextField
            label="Search aliases (comma separated)"
            value={customAliases}
            onChangeText={setCustomAliases}
            placeholder="close grip, narrow press"
          />
          <TextField
            label="Instructions (optional)"
            value={customInstructions}
            onChangeText={setCustomInstructions}
            placeholder="Short user-authored setup cue"
          />
          <View className="mb-2 flex-row flex-wrap">
            {(['weighted_strength', 'bodyweight', 'timed', 'cardio'] as WorkoutModality[]).map(
              (modalityOption) => (
                <PillChip
                  key={modalityOption}
                  label={MODALITY_LABELS[modalityOption]}
                  active={customModality === modalityOption}
                  color={COLOR}
                  onPress={() => {
                    setCustomModality(modalityOption);
                    if (modalityOption !== 'bodyweight' && modalityOption !== 'weighted_strength') {
                      setCustomSupportsExternalLoad(false);
                    } else if (modalityOption === 'weighted_strength') {
                      setCustomSupportsExternalLoad(true);
                    }
                  }}
                />
              ),
            )}
          </View>
          <View className="mb-3 flex-row flex-wrap">
            <PillChip
              label="Per side"
              active={customUnilateral}
              color={COLOR}
              onPress={() => setCustomUnilateral((value) => !value)}
            />
            <PillChip
              label="External load"
              active={customSupportsExternalLoad}
              color={COLOR}
              onPress={() => setCustomSupportsExternalLoad((value) => !value)}
            />
          </View>
          <Button
            label="Create and add"
            onPress={() => void handleCreateCustomExercise()}
            color={COLOR}
          />
        </View>
      </Modal>
      {confirmationDialog}
    </>
  );
}
