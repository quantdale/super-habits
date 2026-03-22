import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";
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
  getRoutineWithExercises,
  listRoutines,
  listWorkoutLogsForRange,
} from "@/features/workout/workout.data";
import { buildWorkoutActivityDays, buildWorkoutFrequency } from "@/features/workout/workout.domain";
import { ActivityPreviewStrip, type ActivityDay } from "@/features/shared/ActivityPreviewStrip";
import { WorkoutFrequencyChart } from "@/features/workout/WorkoutFrequencyChart";
import { toDateKey } from "@/lib/time";
import { RoutineDetailScreen } from "./RoutineDetailScreen";
import { WorkoutSessionScreen } from "./WorkoutSessionScreen";
import type { RoutineWithExercises } from "./types";

type ViewState =
  | { type: "list" }
  | { type: "detail"; routineId: string; routineName: string }
  | { type: "session"; routine: RoutineWithExercises };

function RoutineSwipeRow({
  routine,
  onOpenDetail,
  onCompleteWorkout,
  onRequestDelete,
}: {
  routine: WorkoutRoutine;
  onOpenDetail: () => void;
  onCompleteWorkout: () => void;
  onRequestDelete: () => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <Pressable
      onPress={() => {
        swipeableRef.current?.close();
        onRequestDelete();
      }}
      className="my-0.5 items-center justify-center rounded-r-xl bg-rose-500 px-6"
    >
      <Text className="text-sm font-medium text-white">Delete</Text>
    </Pressable>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
    >
      <Card>
        <Pressable onPress={onOpenDetail}>
          <Text className="text-base font-semibold text-slate-900">{routine.name}</Text>
          {routine.description ? (
            <Text className="mt-1 text-sm text-slate-600">{routine.description}</Text>
          ) : null}
        </Pressable>
        <View className="mt-3">
          <Button
            label="Complete workout"
            onPress={onCompleteWorkout}
          />
        </View>
      </Card>
    </Swipeable>
  );
}

export function WorkoutScreen() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [workoutActivityDays, setWorkoutActivityDays] = useState<ActivityDay[]>([]);
  const [workoutFreqData, setWorkoutFreqData] = useState<
    { dateKey: string; label: string; value: number }[]
  >([]);
  const [currentView, setCurrentView] = useState<ViewState>({ type: "list" });

  const refresh = useCallback(async () => {
    const r = await listRoutines();
    setRoutines(r);

    const start30 = new Date();
    start30.setDate(start30.getDate() - 29);
    const startKey = toDateKey(start30);
    const endKey = toDateKey(new Date());
    const allLogs = await listWorkoutLogsForRange(startKey, endKey);
    setLogs(allLogs.slice(0, 30));
    setWorkoutActivityDays(buildWorkoutActivityDays(allLogs, 30));
    setWorkoutFreqData(buildWorkoutFrequency(allLogs, 30));
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

  const handleDeleteRoutine = useCallback(
    (routineId: string, routineName: string) => {
      Alert.alert("Delete routine", `Remove "${routineName}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await deleteRoutine(routineId);
              refresh();
            })();
          },
        },
      ]);
    },
    [refresh],
  );

  if (currentView.type === "detail") {
    return (
      <RoutineDetailScreen
        routineId={currentView.routineId}
        routineName={currentView.routineName}
        onBack={() => setCurrentView({ type: "list" })}
        onStartWorkout={async () => {
          const full = await getRoutineWithExercises(currentView.routineId);
          if (!full || full.exercises.length === 0) {
            Alert.alert("No exercises", "Add exercises to this routine before starting.");
            return;
          }
          setCurrentView({ type: "session", routine: full });
        }}
      />
    );
  }

  const workoutStripHasActivity = workoutActivityDays.some((d) => d.active);

  if (currentView.type === "session") {
    return (
      <WorkoutSessionScreen
        routine={currentView.routine}
        onFinish={() => {
          setCurrentView({ type: "list" });
          refresh();
        }}
        onCancel={() =>
          setCurrentView({
            type: "detail",
            routineId: currentView.routine.id,
            routineName: currentView.routine.name,
          })
        }
      />
    );
  }

  return (
    <Screen scroll>
      <SectionTitle
        title="Workout"
        subtitle={
          workoutStripHasActivity ? "Create simple routines and mark completions." : undefined
        }
      />
      {!workoutStripHasActivity ? (
        <View className="mb-3 items-center rounded-xl border border-slate-100 bg-white p-4">
          <Text className="text-center text-sm text-slate-500">
            Complete a workout to start tracking
          </Text>
          <Text className="mt-1 text-center text-xs text-slate-400">
            Create simple routines and mark completions.
          </Text>
        </View>
      ) : null}
      <Card>
        <TextField label="Routine name" value={name} onChangeText={setName} placeholder="Push Day" />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Bench + accessories"
        />
        <Button label="Add routine" onPress={onCreate} />
      </Card>

      {routines.map((routine) => (
        <RoutineSwipeRow
          key={routine.id}
          routine={routine}
          onOpenDetail={() =>
            setCurrentView({
              type: "detail",
              routineId: routine.id,
              routineName: routine.name,
            })
          }
          onCompleteWorkout={() => {
            void (async () => {
              await completeRoutine(routine.id);
              refresh();
            })();
          }}
          onRequestDelete={() => handleDeleteRoutine(routine.id, routine.name)}
        />
      ))}

      <View className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
        <Text className="mb-3 text-sm font-semibold text-slate-700">Workout history</Text>

        <ActivityPreviewStrip
          days={workoutActivityDays}
          accentColor="#4f79ff"
          statLabel={`${workoutActivityDays.filter((d) => d.active).length} workout days in last 30 days`}
          emptyLabel="Complete a workout to start tracking"
          showLabel={workoutStripHasActivity}
        />

        {logs.length === 0 ? (
          <View className="items-center py-4">
            <Text className="text-center text-sm text-slate-400">
              Complete a workout to start tracking
            </Text>
          </View>
        ) : (
          <View className="mb-4 gap-2">
            {logs.map((log) => (
              <View key={log.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <Text className="text-sm text-slate-700">{new Date(log.completed_at).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}

        <View className="mt-2">
          <WorkoutFrequencyChart data={workoutFreqData} />
        </View>
      </View>
    </Screen>
  );
}
