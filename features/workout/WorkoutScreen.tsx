import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { RectButton } from "react-native-gesture-handler";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { Card } from "@/core/ui/Card";
import { TextField } from "@/core/ui/TextField";
import { Button } from "@/core/ui/Button";
import { FeatureStatCard } from "@/core/ui/FeatureStatCard";
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
import type { ActivityDay, HeatmapDay } from "@/features/shared/activityTypes";
import { GitHubHeatmap } from "@/features/shared/GitHubHeatmap";
import { toDateKey } from "@/lib/time";
import { useFocusForegroundRefresh } from "@/lib/useForegroundRefresh";
import { RoutineDetailModal } from "./RoutineDetailScreen";
import { WorkoutSessionScreen } from "./WorkoutSessionScreen";
import type { RoutineWithExercises } from "./types";
import { SECTION_COLORS } from "@/constants/sectionColors";
import { SwipeableCard } from "@/core/ui/SwipeableCard";
import { ValidationError } from "@/core/ui/ValidationError";
import { useConfirmationDialog } from "@/core/ui/useConfirmationDialog";
import { validateRoutineName } from "@/lib/validation";
import { SECTION_TEXT_COLORS } from "@/constants/sectionColors";

const COLOR = SECTION_COLORS.workout;
const TEXT_COLOR = SECTION_TEXT_COLORS.workout;

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
      <View className="mt-4">
        <Button label="Complete workout" onPress={onCompleteWorkout} color={accentColor} />
      </View>
    </SwipeableCard>
  );
}

export function WorkoutScreen() {
  const { confirm, confirmationDialog } = useConfirmationDialog();
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

  const handleDeleteRoutine = useCallback(
    async (routine: WorkoutRoutine) => {
      const confirmed = await confirm({
        title: "Remove routine",
        message: `Remove "${routine.name}"?`,
        confirmLabel: "Delete routine",
        confirmVariant: "danger",
      });
      if (!confirmed) return;

      await deleteRoutine(routine.id);
      if (routineModal?.routineId === routine.id) {
        setRoutineModal(null);
      }
      await refresh();
    },
    [confirm, refresh, routineModal],
  );

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
      {confirmationDialog}
      <Screen scroll>
        <SectionTitle
          title="Workout"
          subtitle={
            workoutStripHasActivity
              ? "Create simple routines, update exercises, and mark completions without leaving the tab."
              : "Create simple routines and mark completions."
          }
        />

        <View className="mb-4 flex-row gap-3">
          <View className="flex-1">
            <FeatureStatCard
              accentColor={COLOR}
              textColor={TEXT_COLOR}
              icon="fitness-center"
              title="Workout days"
              value={workoutDaysCount}
              subtitle="Last 52 weeks"
              note={workoutStripHasActivity ? "Sessions logged this year" : "No sessions logged yet"}
            />
          </View>
          <View className="flex-1">
            <FeatureStatCard
              accentColor={COLOR}
              textColor={TEXT_COLOR}
              icon="calendar-today"
              title="Current streak"
              value={workoutStreak}
              subtitle="Back-to-back workout days"
              note={workoutStreak > 0 ? "Keep the run alive today" : "Your next session starts the streak"}
            />
          </View>
        </View>

        {!workoutStripHasActivity ? (
          <Card variant="standard" accentColor={COLOR}>
            <View className="items-center py-2">
              <MaterialIcons name="self-improvement" size={26} color={TEXT_COLOR} />
              <Text className="mt-3 text-center text-base font-semibold text-slate-900">
                Complete a workout to start tracking
              </Text>
              <Text className="mt-2 text-center text-sm text-slate-500">
                Your routine history and yearly intensity map will appear here once you log a session.
              </Text>
            </View>
          </Card>
        ) : null}
        <Card
          variant="header"
          accentColor={COLOR}
          headerTitle="Add new routine"
          headerSubtitle="Keep names short and descriptions specific so routines stay scannable."
          headerRight={<MaterialIcons name="add" size={22} color="#ffffff" />}
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
        </Card>

        {routines.length > 0 ? (
          <View className="mb-3 mt-1">
            <Text className="text-sm font-semibold text-slate-900">Your routines</Text>
            <Text className="mt-1 text-sm text-slate-500">
              Swipe to edit or delete. Open a routine to manage exercises and sets.
            </Text>
          </View>
        ) : null}

        {routines.map((routine) => (
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
              await handleDeleteRoutine(routine);
            }}
          />
        ))}

        <Card
          variant="header"
          accentColor={COLOR}
          headerTitle="Workout history"
          headerSubtitle="Session intensity over the last 52 weeks."
          headerRight={<MaterialIcons name="insights" size={22} color="#ffffff" />}
          className="mt-4"
        >
          <View className="w-full min-w-0 items-center justify-center">
            <GitHubHeatmap
              days={workoutHeatmapDays}
              color={COLOR}
              weeks={52}
            />
          </View>
        </Card>
      </Screen>
    </>
  );
}
