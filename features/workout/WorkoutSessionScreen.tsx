import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { Screen } from "@/core/ui/Screen";
import { Button } from "@/core/ui/Button";
import { Card } from "@/core/ui/Card";
import {
  buildTimerSequence,
  formatWorkoutTime,
  summarizeCompletedSets,
  type TimerPhase,
} from "./workout.domain";
import { logWorkoutSession } from "./workout.data";
import type { RoutineWithExercises } from "./types";
import { SECTION_COLORS } from "@/constants/sectionColors";

const WORKOUT_COLOR = SECTION_COLORS.workout;

type Props = {
  routine: RoutineWithExercises;
  onFinish: () => void;
  onCancel: () => void;
};

export function WorkoutSessionScreen({ routine, onFinish, onCancel }: Props) {
  const sequence = useMemo(
    () =>
      buildTimerSequence(
        routine.exercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets.map((s) => ({
            set_number: s.set_number,
            active_seconds: s.active_seconds,
            rest_seconds: s.rest_seconds,
          })),
        })),
      ),
    [routine.exercises],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(() => sequence[0]?.durationSeconds ?? 0);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const currentPhase: TimerPhase | undefined = sequence[currentIndex];

  useEffect(() => {
    if (!isRunning || isComplete) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev > 1) return prev - 1;
        if (prev === 1) return 0;
        return prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, isComplete]);

  useEffect(() => {
    if (!isRunning || isComplete) return;
    if (sequence.length === 0) return;
    if (remaining > 0) return;

    const nextIdx = currentIndex + 1;
    if (nextIdx >= sequence.length) {
      setIsRunning(false);
      setIsComplete(true);
      return;
    }
    setCurrentIndex(nextIdx);
    setRemaining(sequence[nextIdx].durationSeconds);
  }, [remaining, isRunning, isComplete, currentIndex, sequence]);

  const handleStart = () => setIsRunning(true);

  const handleSkip = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= sequence.length) {
      setIsRunning(false);
      setIsComplete(true);
      return;
    }
    setCurrentIndex(nextIndex);
    setRemaining(sequence[nextIndex].durationSeconds);
  };

  const handleFinish = async () => {
    setIsRunning(false);
    const summary = summarizeCompletedSets(sequence, currentIndex);
    await logWorkoutSession({
      routineId: routine.id,
      exercises: summary,
    });
    onFinish();
  };

  const handleCancel = () => {
    Alert.alert("End workout?", "Progress will not be saved.", [
      { text: "Keep going", style: "cancel" },
      {
        text: "End",
        style: "destructive",
        onPress: () => {
          setIsRunning(false);
          onCancel();
        },
      },
    ]);
  };

  if (isComplete) {
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <Card accentColor={WORKOUT_COLOR}>
            <View className="items-center gap-4 py-4">
              <Text className="text-4xl">🎉</Text>
              <Text className="text-center text-2xl font-semibold text-slate-800">
                Workout complete!
              </Text>
              <Text className="text-center text-sm text-slate-500">
                {routine.name} is done. Save this session to update your history.
              </Text>
              <View className="w-full">
                <Button label="Save and finish" onPress={handleFinish} color={WORKOUT_COLOR} />
              </View>
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  if (!currentPhase || sequence.length === 0) {
    return (
      <Screen>
        <Text className="text-slate-400 text-center mt-10">No exercises in this routine.</Text>
        <Button label="Back" variant="ghost" onPress={onCancel} />
      </Screen>
    );
  }

  const isActive = currentPhase.phase === "active";
  const denom = currentPhase.durationSeconds > 0 ? currentPhase.durationSeconds : 1;
  const progress = 1 - remaining / denom;

  return (
    <Screen>
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable onPress={handleCancel}>
          <Text className="text-sm text-slate-400">End</Text>
        </Pressable>
        <Text className="text-sm text-slate-500">{routine.name}</Text>
        <Text className="text-xs text-slate-300">
          {currentIndex + 1}/{sequence.length}
        </Text>
      </View>

      <Card accentColor={WORKOUT_COLOR}>
        <View
          className={`self-center rounded-full px-3 py-1 ${
            isActive ? "bg-workout" : "bg-amber-400"
          }`}
        >
          <Text className="text-xs font-medium text-white">
            {isActive ? "ACTIVE" : "REST"}
          </Text>
        </View>

        <Text className="mt-4 text-center text-2xl font-semibold text-slate-800">
          {currentPhase.exerciseName}
        </Text>
        <Text className="mt-1 text-center text-sm text-slate-400">
          Set {currentPhase.setNumber} of {currentPhase.totalSets}
        </Text>

        <Text className="my-8 text-center text-7xl font-semibold text-slate-800">
          {formatWorkoutTime(remaining)}
        </Text>

        <View className="mb-8 h-2 overflow-hidden rounded-full bg-slate-100">
          <View
            className={`h-full rounded-full ${isActive ? "bg-workout" : "bg-amber-400"}`}
            style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
          />
        </View>

        <View className="gap-3">
          {!isRunning ? (
            <Button label="Start" onPress={handleStart} color={WORKOUT_COLOR} />
          ) : (
            <Button label="Skip" variant="ghost" onPress={handleSkip} />
          )}
        </View>

        {currentIndex + 1 < sequence.length ? (
          <Text className="mt-6 text-center text-xs text-slate-400">
            Next:{" "}
            {sequence[currentIndex + 1].phase === "rest"
              ? `Rest ${formatWorkoutTime(sequence[currentIndex + 1].durationSeconds)}`
              : `${sequence[currentIndex + 1].exerciseName} — Set ${sequence[currentIndex + 1].setNumber}`}
          </Text>
        ) : null}
      </Card>
    </Screen>
  );
}
