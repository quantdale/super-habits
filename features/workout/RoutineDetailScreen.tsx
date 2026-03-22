import React, { useState, useCallback } from "react";
import { View, Text, Pressable, Alert, TextInput } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/core/ui/Screen";
import { Button } from "@/core/ui/Button";
import { Card } from "@/core/ui/Card";
import { SectionTitle } from "@/core/ui/SectionTitle";
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

const COLOR = SECTION_COLORS.workout;

type ExerciseWithSets = RoutineExercise & { sets: RoutineExerciseSet[] };

type Props = {
  routineId: string;
  routineName: string;
  onStartWorkout: () => void;
  onBack: () => void;
};

export function RoutineDetailScreen({
  routineId,
  routineName,
  onStartWorkout,
  onBack,
}: Props) {
  const [exercises, setExercises] = useState<ExerciseWithSets[]>([]);
  const [newExerciseName, setNewExerciseName] = useState("");

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

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleAddExercise = async () => {
    if (!newExerciseName.trim()) return;
    const exId = await addExercise({
      routineId,
      name: newExerciseName.trim(),
      sortOrder: exercises.length + 1,
    });
    await addDefaultSet(exId);
    setNewExerciseName("");
    refresh();
  };

  const handleDeleteExercise = (id: string, name: string) => {
    Alert.alert("Remove exercise", `Remove "${name}" and all its sets?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deleteExercise(id);
          refresh();
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Pressable onPress={onBack} className="mb-4">
        <Text className="text-workout text-sm">← Back</Text>
      </Pressable>

      <SectionTitle title={routineName} />

      {exercises.length > 0 && (
        <Button label="Start workout" onPress={onStartWorkout} color={COLOR} />
      )}

      <View className="mt-6 gap-3">
        {exercises.map((ex) => (
          <Card key={ex.id} accentColor={COLOR}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-medium text-slate-800">{ex.name}</Text>
              <Pressable onPress={() => handleDeleteExercise(ex.id, ex.name)}>
                <Text className="text-rose-400 text-sm">Remove</Text>
              </Pressable>
            </View>

            {ex.sets.map((set) => (
              <View key={set.id} className="flex-row items-center gap-2 mb-2">
                <Text className="text-xs text-slate-400 w-12">Set {set.set_number}</Text>
                <View className="flex-1">
                  <Text className="text-xs text-slate-400 mb-0.5">Active</Text>
                  <View className="flex-row items-center gap-1">
                    <Pressable
                      onPress={async () => {
                        const next = Math.max(5, set.active_seconds - 5);
                        await updateSet(set.id, { activeSeconds: next });
                        refresh();
                      }}
                      className="w-7 h-7 bg-slate-100 rounded items-center justify-center"
                    >
                      <Text className="text-slate-600">−</Text>
                    </Pressable>
                    <Text className="text-sm text-slate-700 w-12 text-center">
                      {formatWorkoutTime(set.active_seconds)}
                    </Text>
                    <Pressable
                      onPress={async () => {
                        const next = Math.min(600, set.active_seconds + 5);
                        await updateSet(set.id, { activeSeconds: next });
                        refresh();
                      }}
                      className="w-7 h-7 bg-slate-100 rounded items-center justify-center"
                    >
                      <Text className="text-slate-600">+</Text>
                    </Pressable>
                  </View>
                </View>

                <View className="flex-1">
                  <Text className="text-xs text-slate-400 mb-0.5">Rest</Text>
                  <View className="flex-row items-center gap-1">
                    <Pressable
                      onPress={async () => {
                        const next = Math.max(0, set.rest_seconds - 5);
                        await updateSet(set.id, { restSeconds: next });
                        refresh();
                      }}
                      className="w-7 h-7 bg-slate-100 rounded items-center justify-center"
                    >
                      <Text className="text-slate-600">−</Text>
                    </Pressable>
                    <Text className="text-sm text-slate-700 w-12 text-center">
                      {formatWorkoutTime(set.rest_seconds)}
                    </Text>
                    <Pressable
                      onPress={async () => {
                        const next = Math.min(300, set.rest_seconds + 5);
                        await updateSet(set.id, { restSeconds: next });
                        refresh();
                      }}
                      className="w-7 h-7 bg-slate-100 rounded items-center justify-center"
                    >
                      <Text className="text-slate-600">+</Text>
                    </Pressable>
                  </View>
                </View>

                {ex.sets.length > 1 && (
                  <Pressable
                    onPress={async () => {
                      await deleteSet(set.id);
                      refresh();
                    }}
                    hitSlop={8}
                  >
                    <Text className="text-slate-300 text-sm">✕</Text>
                  </Pressable>
                )}
              </View>
            ))}

            <Pressable
              onPress={async () => {
                await addDefaultSet(ex.id);
                refresh();
              }}
              className="mt-1"
            >
              <Text className="text-xs text-workout">+ Add set</Text>
            </Pressable>
          </Card>
        ))}
      </View>

      <View className="mt-4">
        <Text className="text-sm text-slate-600 mb-2">Add exercise</Text>
        <View className="flex-row gap-2">
          <TextInput
            value={newExerciseName}
            onChangeText={setNewExerciseName}
            placeholder="e.g. Rows, Curls, Push-ups"
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800"
            onSubmitEditing={handleAddExercise}
            returnKeyType="done"
          />
          <Button label="Add" onPress={handleAddExercise} color={COLOR} />
        </View>
      </View>
    </Screen>
  );
}
