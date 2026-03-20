import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { Card } from "@/core/ui/Card";
import { TextField } from "@/core/ui/TextField";
import { Button } from "@/core/ui/Button";
import type { WorkoutLog, WorkoutRoutine } from "./types";
import {
  addRoutine,
  completeRoutine,
  deleteRoutine,
  listRoutines,
  listWorkoutLogs,
} from "@/features/workout/workout.data";

export function WorkoutScreen() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);

  const refresh = useCallback(async () => {
    const [r, l] = await Promise.all([listRoutines(), listWorkoutLogs(8)]);
    setRoutines(r);
    setLogs(l);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onCreate = async () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Enter a routine name.");
      return;
    }
    await addRoutine(name.trim(), description.trim());
    setName("");
    setDescription("");
    refresh();
  };

  return (
    <Screen scroll>
      <SectionTitle title="Workout" subtitle="Create simple routines and mark completions." />
      <Card>
        <TextField label="Routine name" value={name} onChangeText={setName} placeholder="Push Day" />
        <TextField label="Description" value={description} onChangeText={setDescription} placeholder="Bench + accessories" />
        <Button label="Add routine" onPress={onCreate} />
      </Card>

      {routines.map((routine) => (
        <Card key={routine.id}>
          <Text className="text-base font-semibold text-slate-900">{routine.name}</Text>
          {routine.description ? <Text className="mt-1 text-sm text-slate-600">{routine.description}</Text> : null}
          <View className="mt-3 gap-2">
            <Button
              label="Complete workout"
              onPress={async () => {
                await completeRoutine(routine.id);
                refresh();
              }}
            />
            <Button
              label="Delete routine"
              variant="danger"
              onPress={async () => {
                await deleteRoutine(routine.id);
                refresh();
              }}
            />
          </View>
        </Card>
      ))}

      <SectionTitle title="Recent workout logs" />
      {logs.map((log) => (
        <Card key={log.id}>
          <Text className="text-sm text-slate-700">{new Date(log.completed_at).toLocaleString()}</Text>
        </Card>
      ))}
    </Screen>
  );
}
