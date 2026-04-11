import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { RectButton } from "react-native-gesture-handler";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { FeaturePanel } from "@/core/ui/FeaturePanel";
import { FeatureStatCard } from "@/core/ui/FeatureStatCard";
import { TextField } from "@/core/ui/TextField";
import { Button } from "@/core/ui/Button";
import type { WorkoutRoutine } from "./types";
import {
  addRoutine,
  completeRoutine,
  deleteRoutine,
  getRoutineWithExercises,
  listRoutines,
  listWorkoutLogsForRange,
} from "@/features/workout/workout.data";
import {
  buildWorkoutActivityDays,
  buildWorkoutHeatmapDays,
  computeWorkoutStreakFromHeatmapDays,
} from "@/features/workout/workout.domain";
import type { ActivityDay } from "@/features/shared/ActivityPreviewStrip";
import { GitHubHeatmap, type HeatmapDay } from "@/features/shared/GitHubHeatmap";
import { toDateKey } from "@/lib/time";
import { useFocusForegroundRefresh } from "@/lib/useForegroundRefresh";
import { RoutineDetailModal } from "./RoutineDetailScreen";
import { WorkoutSessionScreen } from "./WorkoutSessionScreen";
import type { RoutineWithExercises } from "./types";
import { SECTION_COLORS, SECTION_TEXT_COLORS } from "@/constants/sectionColors";
import { SwipeableCard } from "@/core/ui/SwipeableCard";
import { ValidationError } from "@/core/ui/ValidationError";
import { validateRoutineName } from "@/lib/validation";

const COLOR = SECTION_COLORS.workout;

type ViewState = { type: "list" } | { type: "session"; routine: RoutineWithExercises };

type RoutineModalState = { routineId: string; routineName: string };

function RoutineSwipeRow({
  routine,
  onOpenDetail,
  onCompleteWorkout,
  onRequestDelete,
  accentColor,
}: {
  routine: WorkoutRoutine;
  onOpenDetail: () => void;
  onCompleteWorkout: () => void;
  onRequestDelete: () => void | Promise<void>;
  accentColor: string;
}) {
  return (
    <SwipeableCard
      accentColor={accentColor}
      style={{ marginBottom: 12 }}
      onEdit={onOpenDetail}
      onDelete={onRequestDelete}
    >
      <RectButton onPress={onOpenDetail} style={{ backgroundColor: "transparent" }}>
        <Text className="text-base font-semibold text-slate-900">{routine.name}</Text>
        {routine.description ? (
          <Text className="mt-1 text-sm text-slate-600">{routine.description}</Text>
        ) : null}
      </RectButton>
      <View className="mt-3">
        <Button label="Complete workout" onPress={onCompleteWorkout} color={accentColor} />
      </View>
    </SwipeableCard>
  );
}

export function WorkoutScreen() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [workoutActivityDays, setWorkoutActivityDays] = useState<ActivityDay[]>([]);
  const [workoutHeatmapDays, setWorkoutHeatmapDays] = useState<HeatmapDay[]>([]);
  const [currentView, setCurrentView] = useState<ViewState>({ type: "list" });
  const [routineModal, setRoutineModal] = useState<RoutineModalState | null>(null);
  const [workoutError, setWorkoutError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await listRoutines();
    setRoutines(r);

    const start364 = new Date();
    start364.setDate(start364.getDate() - 363);
    const startKey = toDateKey(start364);
    const endKey = toDateKey(new Date());
    const allLogs = await listWorkoutLogsForRange(startKey, endKey);
    setWorkoutActivityDays(buildWorkoutActivityDays(allLogs, 364));
    setWorkoutHeatmapDays(buildWorkoutHeatmapDays(allLogs, 364));
  }, []);

  useFocusForegroundRefresh(refresh);

  const onCreate = async () => {
    const err = validateRoutineName(name);
    if (err) {
      setWorkoutError(err);
      return;
    }
    setWorkoutError(null);
    await addRoutine(name.trim(), description.trim());
    setName("");
    setDescription("");
    refresh();
  };

  const openRoutineModal = useCallback((routineId: string, routineName: string) => {
    setRoutineModal({ routineId, routineName });
  }, []);

  const workoutStripHasActivity = workoutActivityDays.some((d) => d.active);
  const workoutStreak = computeWorkoutStreakFromHeatmapDays(workoutHeatmapDays);
  const workoutDaysCount = workoutActivityDays.filter((d) => d.active).length;

  if (currentView.type === "session") {
    return (
      <WorkoutSessionScreen
        routine={currentView.routine}
        onFinish={() => {
          setCurrentView({ type: "list" });
          refresh();
        }}
        onCancel={() => {
          setCurrentView({ type: "list" });
          setRoutineModal({
            routineId: currentView.routine.id,
            routineName: currentView.routine.name,
          });
        }}
      />
    );
  }

  return (
    <>
      <RoutineDetailModal
        visible={routineModal !== null}
        routineId={routineModal?.routineId ?? ""}
        routineName={routineModal?.routineName ?? ""}
        onClose={() => setRoutineModal(null)}
        onStartWorkout={async () => {
          if (!routineModal) return;
          const full = await getRoutineWithExercises(routineModal.routineId);
          if (!full || full.exercises.length === 0) {
            Alert.alert("No exercises", "Add exercises to this routine before starting.");
            return;
          }
          setRoutineModal(null);
          setCurrentView({ type: "session", routine: full });
        }}
      />
      <Screen scroll>
        <SectionTitle
          title="Workout"
          subtitle="Create simple routines and mark completions."
        />
        <View className="mb-4 flex-row gap-3">
          <View className="flex-1">
            <FeatureStatCard
              icon="fitness-center"
              value={workoutDaysCount}
              label="Workout Days"
              accentColor={SECTION_COLORS.workout}
              textColor={SECTION_TEXT_COLORS.workout}
            />
          </View>
          <View className="flex-1">
            <FeatureStatCard
              icon="calendar-month"
              value={workoutStreak}
              label="Day Streak"
              accentColor={SECTION_COLORS.workout}
              textColor={SECTION_TEXT_COLORS.workout}
            />
          </View>
        </View>

        <FeaturePanel
          title="Add new routine"
          subtitle="Create a repeatable session with simple timed sets."
          icon="add-circle-outline"
          accentColor={SECTION_COLORS.workout}
          textColor={SECTION_TEXT_COLORS.workout}
        >
          <TextField
            label="Routine name"
            value={name}
            onChangeText={(t) => {
              setWorkoutError(null);
              setName(t);
            }}
            placeholder="Push Day"
          />
          <TextField
            label="Description"
            value={description}
            onChangeText={(t) => {
              setWorkoutError(null);
              setDescription(t);
            }}
            placeholder="Bench + accessories"
          />
          <ValidationError message={workoutError} />
          <Button label="Add routine" onPress={onCreate} color={COLOR} />
        </FeaturePanel>

        <FeaturePanel
          title="Routines"
          subtitle={
            routines.length === 0
              ? "No routines yet."
              : `${routines.length} active ${routines.length === 1 ? "routine" : "routines"}`
          }
          icon="view-list"
          accentColor={SECTION_COLORS.workout}
          textColor={SECTION_TEXT_COLORS.workout}
          className="mt-4"
        >
          {routines.length === 0 ? (
            <View className="items-center py-6">
              <Text className="text-center text-sm font-medium text-slate-700">
                Add your first routine
              </Text>
              <Text className="mt-1 text-center text-xs text-slate-500">
                Create a routine above, then add exercises before starting.
              </Text>
            </View>
          ) : (
            routines.map((routine) => (
              <RoutineSwipeRow
                key={routine.id}
                routine={routine}
                accentColor={COLOR}
                onOpenDetail={() => openRoutineModal(routine.id, routine.name)}
                onCompleteWorkout={() => {
                  void (async () => {
                    await completeRoutine(routine.id);
                    refresh();
                  })();
                }}
                onRequestDelete={async () => {
                  await deleteRoutine(routine.id);
                  if (routineModal?.routineId === routine.id) {
                    setRoutineModal(null);
                  }
                  await refresh();
                }}
              />
            ))
          )}
        </FeaturePanel>

        <FeaturePanel
          title="Workout history"
          subtitle="Session intensity — last 52 weeks"
          icon="insights"
          accentColor={SECTION_COLORS.workout}
          textColor={SECTION_TEXT_COLORS.workout}
          className="mt-4"
        >
          <View className="w-full min-w-0 items-center justify-center">
            {!workoutStripHasActivity ? (
              <View className="items-center py-6">
                <Text className="text-center text-sm font-medium text-slate-700">
                  Complete a workout to start tracking
                </Text>
                <Text className="mt-1 text-center text-xs text-slate-500">
                  Your 52-week activity view will appear here.
                </Text>
              </View>
            ) : (
              <GitHubHeatmap
                days={workoutHeatmapDays}
                color={SECTION_COLORS.workout}
                weeks={52}
              />
            )}
          </View>
        </FeaturePanel>
      </Screen>
    </>
  );
}
