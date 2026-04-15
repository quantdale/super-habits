import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Alert, TextInput } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Modal } from "@/core/ui/Modal";
import { Button } from "@/core/ui/Button";
import { Card } from "@/core/ui/Card";
import {
  listExercises,
  addExercise,
  deleteExercise,
  listSets,
  addDefaultSet,
  updateSet,
  deleteSet,
} from "./workout.data";
import { formatWorkoutTime } from "./workout.domain";
import type { RoutineExercise, RoutineExerciseSet } from "./types";
import { SECTION_COLORS } from "@/constants/sectionColors";
import { ValidationError } from "@/core/ui/ValidationError";
import { validateExerciseName, validateSetTiming } from "@/lib/validation";
import { NumberStepperField } from "@/core/ui/NumberStepperField";
import { useConfirmationDialog } from "@/core/ui/useConfirmationDialog";

const COLOR = SECTION_COLORS.workout;

type ExerciseWithSets = RoutineExercise & { sets: RoutineExerciseSet[] };

function summarizeExerciseSets(sets: RoutineExerciseSet[]): string {
  if (sets.length === 0) return "No sets";
  const first = sets[0];
  const allSameActive = sets.every((s) => s.active_seconds === first.active_seconds);
  const allSameRest = sets.every((s) => s.rest_seconds === first.rest_seconds);
  const head = `${sets.length} set${sets.length === 1 ? "" : "s"}`;
  if (allSameActive && allSameRest) {
    return `${head} · ${formatWorkoutTime(first.active_seconds)} / ${formatWorkoutTime(first.rest_seconds)}`;
  }
  return `${head} · mixed`;
}

type Props = {
  visible: boolean;
  routineId: string;
  routineName: string;
  onClose: () => void;
  onStartWorkout: () => void;
};

export function RoutineDetailModal({
  visible,
  routineId,
  routineName,
  onClose,
  onStartWorkout,
}: Props) {
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [exercises, setExercises] = useState<ExerciseWithSets[]>([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!visible || !routineId) return;
    void refresh();
  }, [visible, routineId, refresh]);

  useEffect(() => {
    if (!visible) setExpandedId(null);
  }, [visible]);

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
    await addDefaultSet(exId);
    setNewExerciseName("");
    await refresh();
    setExpandedId(exId);
  };

  const handleDeleteExercise = useCallback(
    async (id: string, name: string) => {
      const confirmed = await confirm({
        title: "Remove exercise",
        message: `Remove "${name}" and all its sets?`,
        confirmLabel: "Remove exercise",
        confirmVariant: "danger",
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
        <View className="mb-4 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3">
          <Text className="text-sm font-semibold text-orange-900">Routine builder</Text>
          <Text className="mt-1 text-sm text-orange-700">
            Add exercises, tune work and rest intervals, then start the routine when it is ready.
          </Text>
        </View>

        <View className="gap-3">
          {exercises.map((ex) => {
            const isOpen = expandedId === ex.id;
            return (
              <Card key={ex.id} accentColor={COLOR}>
                <View className="flex-row items-center justify-between">
                  <Pressable
                    onPress={() => toggleExpanded(ex.id)}
                    className="min-w-0 flex-1 flex-row items-center gap-2"
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                  >
                    <View className="min-w-0 flex-1">
                      <Text className="text-base font-medium text-slate-800">{ex.name}</Text>
                      <Text className="mt-0.5 text-xs text-slate-500">{summarizeExerciseSets(ex.sets)}</Text>
                    </View>
                    <MaterialIcons
                      name={isOpen ? "expand-less" : "expand-more"}
                      size={24}
                      color="#64748b"
                    />
                  </Pressable>
                  <Pressable onPress={() => void handleDeleteExercise(ex.id, ex.name)} hitSlop={8} className="ml-2">
                    <Text className="text-sm text-rose-400">Remove</Text>
                  </Pressable>
                </View>

                {isOpen ? (
                  <View className="mt-4 border-t border-slate-100 pt-3">
                    {ex.sets.map((set) => (
                      <View key={set.id} className="mb-4">
                        <Text className="mb-2 text-xs font-medium text-slate-500">Set {set.set_number}</Text>
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
                            await updateSet(set.id, { activeSeconds: next });
                            refresh();
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
                            await updateSet(set.id, { restSeconds: next });
                            refresh();
                          }}
                          min={0}
                          max={1800}
                        />
                        {ex.sets.length > 1 ? (
                          <Pressable
                            onPress={async () => {
                              await deleteSet(set.id);
                              refresh();
                            }}
                            className="self-end"
                            hitSlop={8}
                          >
                            <Text className="text-sm text-slate-400">Remove set</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                    <Pressable
                      onPress={async () => {
                        await addDefaultSet(ex.id);
                        refresh();
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

        <View className="mt-6">
          <Text className="mb-2 text-sm font-semibold text-slate-900">Add exercise</Text>
          <Text className="mb-3 text-sm text-slate-500">
            New exercises start with one default set so you can edit timing immediately.
          </Text>
          <ValidationError message={workoutError} />
          <View className="flex-row gap-2">
            <TextInput
              value={newExerciseName}
              onChangeText={(t) => {
                setWorkoutError(null);
                setNewExerciseName(t);
              }}
              placeholder="e.g. Rows, Curls, Push-ups"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
              onSubmitEditing={handleAddExercise}
              returnKeyType="done"
            />
            <Button label="Add" onPress={handleAddExercise} color={COLOR} />
          </View>
        </View>

        {exercises.length > 0 ? (
          <View className="mt-6">
            <Button label="Start workout" onPress={onStartWorkout} color={COLOR} />
          </View>
        ) : null}
      </Modal>
      {confirmationDialog}
    </>
  );
}
