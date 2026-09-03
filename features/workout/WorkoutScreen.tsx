import { useCallback, useState } from 'react';
import { Alert, Text, View, useWindowDimensions } from 'react-native';
import { layout, spacing } from '@/core/theme/designTokens';
import { MaterialIcons } from '@expo/vector-icons';
import { RectButton } from 'react-native-gesture-handler';
import { Screen } from '@/core/ui/Screen';
import { Card } from '@/core/ui/Card';
import { useCommandLauncherSuppressed } from '@/features/command/commandCenterContext';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { PageHeader } from '@/core/ui/PageHeader';
import { useAppTheme } from '@/core/providers/themeContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { TextField } from '@/core/ui/TextField';
import { Button } from '@/core/ui/Button';
import { FeatureStatCard } from '@/core/ui/FeatureStatCard';
import { MenuSheet } from '@/core/ui/MenuSheet';
import { Modal } from '@/core/ui/Modal';
import { PillChip } from '@/core/ui/PillChip';
import type { WorkoutRoutine, RoutineWithExercises, WorkoutLog } from './types';
import {
  addRoutine,
  clearWorkoutSessionDraft,
  completeRoutine,
  deleteRoutine,
  getRoutineWithExercises,
  getWorkoutSessionDraft,
  getLastPerformedByRoutine,
  listRoutines,
  listSessionTotalsForRange,
  listWorkoutLogsForRange,
  duplicateRoutine,
  listWeeklyPlan,
  upsertWeeklyPlanEntry,
  setWorkoutScheduleOverride,
  rescheduleWorkoutDate,
  resolveWorkoutScheduleForDate,
  listBodyWeightEntries,
  addBodyWeightEntry,
  updateBodyWeightEntry,
  deleteBodyWeightEntry,
  listCustomExercises,
  listWorkoutPerformanceRows,
  getWorkoutPreferences,
  saveWorkoutPreferences,
  type WorkoutPerformanceRow,
  type WorkoutSessionDraft,
  type WorkoutPreferences,
} from '@/features/workout/workout.data';
import {
  buildVolumePerWeek,
  buildWorkoutActivityDays,
  buildWorkoutHeatmapDays,
  computeWorkoutStreakFromHeatmapDays,
  formatLastPerformedLabel,
  computePersonalRecords,
  computeTrainingTotals,
  computeBodyAreaDistribution,
  type EnteredSetValues,
  type PhaseDisposition,
  type ScheduleResolution,
} from '@/features/workout/workout.domain';
import type {
  BodyWeightEntry,
  CustomExercise,
  WorkoutWeeklyPlanEntry,
  WorkoutWeightUnit,
} from '@/core/db/types';
import type { ActivityDay, HeatmapDay } from '@/features/shared/activityTypes';
import { GitHubHeatmap } from '@/features/shared/GitHubHeatmap';
import { isValidDateKey, toDateKey } from '@/lib/time';
import { sanitizeNumericInput } from '@/lib/numericInput';
import { useActiveForegroundRefresh } from '@/lib/useForegroundRefresh';
import { useGuardedAsyncRefresh } from '@/lib/useGuardedAsyncRefresh';
import { RoutineDetailModal } from './RoutineDetailScreen';
import { WorkoutSessionScreen, type SessionResume } from './WorkoutSessionScreen';
import { WorkoutHistoryDetailModal } from './WorkoutHistoryDetail';
import { WeeklyVolumeChart } from './WeeklyVolumeChart';

import { SECTION_COLORS } from '@/constants/sectionColors';
import { SwipeableCard } from '@/core/ui/SwipeableCard';
import { ValidationError } from '@/core/ui/ValidationError';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { validateRoutineName } from '@/lib/validation';
import {
  BodyWeightCard,
  WorkoutProgressCard,
  WorkoutTodayCard,
  WorkoutTotalsCard,
  WorkoutWeekCard,
} from './WorkoutGymPanels';
import { BUILT_IN_EXERCISES } from './exerciseCatalog';

const COLOR = SECTION_COLORS.workout;

type ViewState =
  { type: 'list' } | { type: 'session'; routine: RoutineWithExercises; resume?: SessionResume };

type RoutineModalState = { routineId: string; routineName: string };

function RoutineSwipeRow({
  routine,
  onOpenDetail,
  onCompleteWorkout,
  onRequestDelete,
  accentColor,
  lastPerformedAt,
}: {
  routine: WorkoutRoutine;
  onOpenDetail: () => void;
  onCompleteWorkout: () => void;
  onRequestDelete: () => void | Promise<void>;
  accentColor: string;
  /** ISO completed_at of the routine's most recent session, if any. */
  lastPerformedAt: string | null;
}) {
  const { tokens } = useAppTheme();
  const lastPerformedLabel = lastPerformedAt ? formatLastPerformedLabel(lastPerformedAt) : null;
  return (
    <SwipeableCard
      accentColor={accentColor}
      style={{ marginBottom: 12 }}
      onEdit={onOpenDetail}
      onDelete={onRequestDelete}
    >
      <RectButton
        onPress={onOpenDetail}
        accessibilityRole="button"
        accessibilityLabel={`Open ${routine.name} routine`}
        style={{ backgroundColor: 'transparent' }}
      >
        <Text className="text-base font-semibold" style={{ color: tokens.text }}>
          {routine.name}
        </Text>
        {routine.description ? (
          <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
            {routine.description}
          </Text>
        ) : null}
        {lastPerformedLabel ? (
          <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
            Last: {lastPerformedLabel}
          </Text>
        ) : null}
      </RectButton>
      <View className="mt-4">
        <Button label="Complete workout" onPress={onCompleteWorkout} color={accentColor} />
      </View>
    </SwipeableCard>
  );
}

export function WorkoutScreen({ isActive }: { isActive: boolean }) {
  const { tokens, sectionAccents } = useAppTheme();
  const dayGeneration = useDayRolloverGeneration();
  const colorText = sectionAccents.workout.text;
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { begin: beginRefresh } = useGuardedAsyncRefresh();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [workoutActivityDays, setWorkoutActivityDays] = useState<ActivityDay[]>([]);
  const [workoutHeatmapDays, setWorkoutHeatmapDays] = useState<HeatmapDay[]>([]);
  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
  const [allLogs, setAllLogs] = useState<WorkoutLog[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<ReturnType<typeof buildVolumePerWeek>>([]);
  const [detailLogId, setDetailLogId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>({ type: 'list' });
  const [routineModal, setRoutineModal] = useState<RoutineModalState | null>(null);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkoutSessionDraft | null>(null);
  const [chooserVisible, setChooserVisible] = useState(false);
  const [lastPerformed, setLastPerformed] = useState<Map<string, string>>(new Map());
  const [todaySchedule, setTodaySchedule] = useState<ScheduleResolution | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<WorkoutWeeklyPlanEntry[]>([]);
  const [todayRoutine, setTodayRoutine] = useState<RoutineWithExercises | null>(null);
  const [bodyWeightEntries, setBodyWeightEntries] = useState<BodyWeightEntry[]>([]);
  const [performanceRows, setPerformanceRows] = useState<WorkoutPerformanceRow[]>([]);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [selectedProgressExercise, setSelectedProgressExercise] = useState<string | null>(null);
  const [weekEditorVisible, setWeekEditorVisible] = useState(false);
  const [todayOverrideVisible, setTodayOverrideVisible] = useState(false);
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [rescheduleDateInput, setRescheduleDateInput] = useState('');
  const [bodyWeightModalVisible, setBodyWeightModalVisible] = useState(false);
  const [editingBodyWeight, setEditingBodyWeight] = useState<BodyWeightEntry | null>(null);
  const [bodyWeightValue, setBodyWeightValue] = useState('');
  const [bodyWeightUnit, setBodyWeightUnit] = useState<WorkoutWeightUnit>('kg');
  const [bodyWeightNote, setBodyWeightNote] = useState('');
  const [bodyWeightGoalValue, setBodyWeightGoalValue] = useState('');
  const [workoutPreferences, setWorkoutPreferences] = useState<WorkoutPreferences | null>(null);
  useCommandLauncherSuppressed('workout-session-active', currentView.type === 'session');
  // At content-max widths the history/analytics stack composes into a
  // two-column grid; below it the single-column flow stays (one responsive
  // tree — only one branch renders, no duplicated reads).
  const isWide = useWindowDimensions().width >= layout.contentMaxWidth;

  const refresh = useCallback(async () => {
    const isCurrent = beginRefresh();
    const start364 = new Date();
    start364.setDate(start364.getDate() - 363);
    const startKey = toDateKey(start364);
    const todayKey = toDateKey(new Date());
    const volumeStart = new Date();
    volumeStart.setDate(volumeStart.getDate() - 7 * 7 - ((volumeStart.getDay() + 6) % 7));

    // Every read here is mutually independent, so they run as ONE concurrent
    // batch instead of ~ten serialized round trips through the async SQLite
    // bridge on each tab activation. Only the routine-detail fetch depends on
    // another read (the resolved schedule) and stays sequential after.
    const [
      r,
      allLogs,
      totals,
      lastPerformedMap,
      sessionDraft,
      resolved,
      plan,
      weightEntries,
      performanceRowsLoaded,
      customExercisesLoaded,
      preferences,
    ] = await Promise.all([
      listRoutines(),
      listWorkoutLogsForRange(startKey, todayKey),
      listSessionTotalsForRange(toDateKey(volumeStart), todayKey),
      getLastPerformedByRoutine(),
      getWorkoutSessionDraft(),
      resolveWorkoutScheduleForDate(todayKey),
      listWeeklyPlan(),
      listBodyWeightEntries(),
      listWorkoutPerformanceRows(),
      listCustomExercises(),
      getWorkoutPreferences(),
    ]);
    if (!isCurrent()) return;

    setRoutines(r);
    setWorkoutActivityDays(buildWorkoutActivityDays(allLogs, 364));
    setWorkoutHeatmapDays(buildWorkoutHeatmapDays(allLogs, 364));
    setAllLogs(allLogs);
    setRecentLogs(allLogs.slice(0, 10));
    setWeeklyVolume(buildVolumePerWeek(totals, 8));
    setLastPerformed(lastPerformedMap);
    setDraft(sessionDraft);
    setTodaySchedule(resolved);
    setWeeklyPlan(plan);
    setBodyWeightEntries(weightEntries);
    setPerformanceRows(performanceRowsLoaded);
    setCustomExercises(customExercisesLoaded);
    setWorkoutPreferences(preferences);
    setBodyWeightGoalValue(preferences.goalWeight ? String(preferences.goalWeight.value) : '');
    if (preferences.goalWeight) setBodyWeightUnit(preferences.goalWeight.unit);
    if (resolved.routineId) {
      if (!isCurrent()) return;
      setTodayRoutine(await getRoutineWithExercises(resolved.routineId));
    } else {
      setTodayRoutine(null);
    }
  }, [beginRefresh]);

  useActiveForegroundRefresh(isActive, refresh, dayGeneration);

  const onCreate = async () => {
    const err = validateRoutineName(name);
    if (err) {
      setWorkoutError(err);
      return;
    }
    setWorkoutError(null);
    await addRoutine(name.trim(), description.trim());
    setName('');
    setDescription('');
    void refresh();
  };

  const openRoutineModal = useCallback((routineId: string, routineName: string) => {
    setRoutineModal({ routineId, routineName });
  }, []);

  const handleDeleteRoutine = useCallback(
    async (routine: WorkoutRoutine) => {
      const confirmed = await confirm({
        title: 'Remove routine',
        message: `Remove "${routine.name}"?`,
        confirmLabel: 'Delete routine',
        confirmVariant: 'danger',
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

  const startRoutineById = useCallback(async (routineId: string) => {
    const full = await getRoutineWithExercises(routineId);
    if (!full || full.exercises.length === 0) {
      Alert.alert('No exercises', 'Add exercises to this routine before starting.');
      return;
    }
    setCurrentView({ type: 'session', routine: full });
  }, []);

  const handleResumeDraft = useCallback(async () => {
    if (!draft) return;
    const full = await getRoutineWithExercises(draft.routineId);
    if (!full || full.exercises.length === 0) {
      Alert.alert(
        'Workout unavailable',
        'The routine for this saved session no longer has any exercises.',
        [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Discard draft',
            style: 'destructive',
            onPress: () => {
              void clearWorkoutSessionDraft().catch(() => {});
              setDraft(null);
            },
          },
        ],
      );
      return;
    }
    const startedAtMs = Date.parse(draft.startedAtIso);
    const dispositions: Record<number, PhaseDisposition> = {};
    for (const [index, disposition] of Object.entries(draft.dispositions ?? {})) {
      const parsed = Number.parseInt(index, 10);
      if (Number.isInteger(parsed)) dispositions[parsed] = disposition;
    }
    const enteredSets: Record<number, EnteredSetValues> = {};
    for (const [index, values] of Object.entries(draft.enteredSets ?? {})) {
      const parsed = Number.parseInt(index, 10);
      if (Number.isInteger(parsed)) enteredSets[parsed] = values;
    }
    setCurrentView({
      type: 'session',
      routine: full,
      resume: {
        phaseIndex: draft.phaseIndex,
        startedAtMs: Number.isFinite(startedAtMs) ? startedAtMs : Date.now(),
        elapsedSeconds: draft.elapsedAdjustSeconds ?? 0,
        ...(Object.keys(dispositions).length > 0 ? { dispositions } : {}),
        ...(Object.keys(enteredSets).length > 0 ? { enteredSets } : {}),
        ...(typeof draft.remainingSeconds === 'number'
          ? { remainingSeconds: draft.remainingSeconds }
          : {}),
      },
    });
  }, [draft]);

  const handleDiscardDraft = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Discard workout?',
      message: 'Saved progress for this session will be removed.',
      confirmLabel: 'Discard',
      confirmVariant: 'danger',
    });
    if (!confirmed) return;
    await clearWorkoutSessionDraft();
    setDraft(null);
  }, [confirm]);

  const draftRoutineName = draft
    ? (routines.find((r) => r.id === draft.routineId)?.name ?? 'Workout')
    : null;
  const todayKey = toDateKey(new Date());
  const completedWorkoutToday = allLogs.some(
    (log) => toDateKey(new Date(log.completed_at)) === todayKey,
  );

  const workoutStripHasActivity = workoutActivityDays.some((d) => d.active);
  const workoutStreak = computeWorkoutStreakFromHeatmapDays(workoutHeatmapDays);
  const workoutDaysCount = workoutActivityDays.filter((d) => d.active).length;
  const personalRecords = computePersonalRecords(
    performanceRows
      .filter((row) => row.completed === 1)
      .map((row) => ({
        exerciseName: row.exerciseName,
        catalogExerciseId: row.catalogExerciseId,
        modality: row.modality ?? undefined,
        weight: row.weight,
        reps: row.reps,
        durationSeconds: row.durationSeconds,
        distance: row.distance,
      })),
  );
  const performanceByLog = new Map<string, WorkoutPerformanceRow[]>();
  for (const row of performanceRows) {
    const bucket = performanceByLog.get(row.logId) ?? [];
    bucket.push(row);
    performanceByLog.set(row.logId, bucket);
  }
  const trainingTotals = computeTrainingTotals(
    allLogs.map((log) => ({
      completedAt: log.completed_at,
      durationSeconds: log.duration_seconds,
      sets: (performanceByLog.get(log.id) ?? []).map((row) => ({
        completed: row.completed === 1,
        weight: row.weight,
        reps: row.reps,
        modality: row.modality ?? undefined,
      })),
    })),
  );
  const catalogAreaById = new Map<string, string>([
    ...BUILT_IN_EXERCISES.map((exercise) => [exercise.id, exercise.primaryArea] as const),
    ...customExercises.map((exercise) => [exercise.id, exercise.primary_area] as const),
  ]);
  const bodyAreaDistribution = computeBodyAreaDistribution(
    performanceRows
      .filter((row) => row.completed === 1 && row.catalogExerciseId)
      .map((row) => ({
        primaryArea: catalogAreaById.get(row.catalogExerciseId ?? '') ?? '',
        setsCompleted: 1,
      })),
  );

  const openBodyWeightModal = (entry?: BodyWeightEntry) => {
    setEditingBodyWeight(entry ?? null);
    setBodyWeightValue(entry ? String(entry.weight) : '');
    setBodyWeightUnit(entry?.unit ?? workoutPreferences?.goalWeight?.unit ?? 'kg');
    setBodyWeightNote(entry?.note ?? '');
    setBodyWeightModalVisible(true);
  };

  const handleDeleteBodyWeight = async (entry: BodyWeightEntry) => {
    const confirmed = await confirm({
      title: 'Delete body-weight entry',
      message: `Delete the ${entry.weight} ${entry.unit} measurement?`,
      confirmLabel: 'Delete entry',
      confirmVariant: 'danger',
    });
    if (!confirmed) return;
    await deleteBodyWeightEntry(entry.id);
    await refresh();
  };

  if (currentView.type === 'session') {
    return (
      <WorkoutSessionScreen
        routine={currentView.routine}
        resume={currentView.resume}
        onFinish={() => {
          setCurrentView({ type: 'list' });
          void refresh();
        }}
        onCancel={() => {
          setCurrentView({ type: 'list' });
          setRoutineModal({
            routineId: currentView.routine.id,
            routineName: currentView.routine.name,
          });
          void refresh();
        }}
      />
    );
  }

  // History/analytics sections, composed into a two-column grid at content-max
  // widths (isWide) and stacked on phones. One responsive tree — only one
  // branch renders, so there are no duplicated SQLite reads or chart mounts.
  const recentSessionsSection =
    recentLogs.length > 0 ? (
      <ScreenSection>
        <View className="mb-4 mt-1">
          <Text className="text-base font-semibold" style={{ color: tokens.text }}>
            Recent sessions
          </Text>
          <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
            Tap a session to see every exercise and set you completed.
          </Text>
        </View>
        {recentLogs.map((log) => {
          const routine = routines.find((r) => r.id === log.routine_id);
          return (
            <Card key={log.id} accentColor={COLOR} style={{ marginBottom: 12 }}>
              <RectButton
                onPress={() => setDetailLogId(log.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open session from ${log.completed_at}`}
                style={{ backgroundColor: 'transparent' }}
              >
                <Text className="text-base font-semibold" style={{ color: tokens.text }}>
                  {routine?.name ?? 'Workout'}
                </Text>
                <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                  {new Date(log.completed_at).toLocaleString('en', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </RectButton>
            </Card>
          );
        })}
      </ScreenSection>
    ) : null;

  const analyticsCardSection = (
    <ScreenSection>
      <WorkoutTotalsCard
        sessions={trainingTotals.sessions}
        sets={trainingTotals.completedSets}
        durationSeconds={trainingTotals.durationSeconds}
        volume={trainingTotals.measurableVolume}
        trainingDays={trainingTotals.trainingDays}
      />
      <WorkoutProgressCard
        rows={performanceRows}
        records={personalRecords}
        bodyAreas={bodyAreaDistribution}
        selectedExercise={selectedProgressExercise}
        onSelectExercise={setSelectedProgressExercise}
      />
      <BodyWeightCard
        entries={bodyWeightEntries}
        goalWeight={workoutPreferences?.goalWeight ?? null}
        onAdd={() => openBodyWeightModal()}
        onEdit={openBodyWeightModal}
        onDelete={(entry) => void handleDeleteBodyWeight(entry)}
      />
    </ScreenSection>
  );

  const volumeSection = (
    <ScreenSection className="mb-0">
      <Card
        variant="header"
        accentColor={COLOR}
        headerTitle="Weekly volume"
        headerSubtitle="Completed sets per week over the last 8 weeks."
        headerRight={<MaterialIcons name="bar-chart" size={22} color={tokens.textOnAccent} />}
        className="mb-0"
      >
        {weeklyVolume.some((w) => w.totalSets > 0) ? (
          <WeeklyVolumeChart data={weeklyVolume} />
        ) : (
          <Text className="text-sm" style={{ color: tokens.textMuted }}>
            Complete a session to start filling your weekly volume chart.
          </Text>
        )}
      </Card>
    </ScreenSection>
  );

  const historySection = (
    <ScreenSection className="mb-0">
      <Card
        variant="header"
        accentColor={COLOR}
        headerTitle="Workout history"
        headerSubtitle="Session intensity over the last 52 weeks."
        headerRight={<MaterialIcons name="insights" size={22} color={tokens.textOnAccent} />}
        className="mb-0"
      >
        <View className="w-full min-w-0 items-center justify-center">
          <GitHubHeatmap days={workoutHeatmapDays} color={COLOR} weeks={52} />
        </View>
      </Card>
    </ScreenSection>
  );

  const historyAnalyticsComposition = isWide ? (
    <View className="flex-row flex-wrap" style={{ gap: spacing.lg, alignItems: 'flex-start' }}>
      <View className="flex-1" style={{ minWidth: 300, gap: spacing.lg }}>
        {recentSessionsSection}
        {volumeSection}
      </View>
      <View className="flex-1" style={{ minWidth: 300, gap: spacing.lg }}>
        {analyticsCardSection}
        {historySection}
      </View>
    </View>
  ) : (
    <>
      {recentSessionsSection}
      {analyticsCardSection}
      {volumeSection}
      {historySection}
    </>
  );

  return (
    <>
      <Modal
        visible={weekEditorVisible}
        onClose={() => setWeekEditorVisible(false)}
        title="Plan your week"
        scroll
      >
        <Text className="mb-3 text-sm" style={{ color: tokens.textMuted }}>
          This recurring template uses Monday–Sunday local calendar days. A date override never
          edits these rows.
        </Text>
        <View className="gap-4">
          {Array.from({ length: 7 }, (_, index) => index + 1).map((weekday) => (
            <View key={weekday}>
              <Text className="mb-2 text-sm font-semibold" style={{ color: tokens.text }}>
                {
                  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][
                    weekday - 1
                  ]
                }
              </Text>
              <View className="flex-row flex-wrap">
                <PillChip
                  label="Rest"
                  accessibilityLabel={`${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][weekday - 1]} rest`}
                  active={
                    weeklyPlan.find((entry) => entry.weekday === weekday)?.plan_kind === 'rest'
                  }
                  color={COLOR}
                  onPress={() =>
                    void upsertWeeklyPlanEntry({ weekday, planKind: 'rest', routineId: null }).then(
                      refresh,
                    )
                  }
                />
                {routines.map((routine) => (
                  <PillChip
                    key={routine.id}
                    label={routine.name}
                    accessibilityLabel={`${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][weekday - 1]} ${routine.name}`}
                    active={
                      weeklyPlan.find((entry) => entry.weekday === weekday)?.routine_id ===
                      routine.id
                    }
                    color={COLOR}
                    onPress={() =>
                      void upsertWeeklyPlanEntry({
                        weekday,
                        planKind: 'workout',
                        routineId: routine.id,
                      }).then(refresh)
                    }
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      </Modal>
      <Modal
        visible={todayOverrideVisible}
        onClose={() => setTodayOverrideVisible(false)}
        title="Change today"
        scroll
      >
        <Text className="mb-3 text-sm" style={{ color: tokens.textMuted }}>
          Choose a one-day override for {toDateKey(new Date())}. Your normal week remains unchanged.
        </Text>
        <View className="flex-row flex-wrap">
          <PillChip
            label="Rest today"
            active={todaySchedule?.source === 'override' && todaySchedule.planKind === 'rest'}
            color={COLOR}
            onPress={() =>
              void setWorkoutScheduleOverride({
                dateKey: toDateKey(new Date()),
                overrideKind: 'rest',
              }).then(async () => {
                setTodayOverrideVisible(false);
                await refresh();
              })
            }
          />
          {routines.map((routine) => (
            <PillChip
              key={routine.id}
              label={routine.name}
              active={
                todaySchedule?.source === 'override' && todaySchedule.routineId === routine.id
              }
              color={COLOR}
              onPress={() =>
                void setWorkoutScheduleOverride({
                  dateKey: toDateKey(new Date()),
                  overrideKind: 'workout',
                  routineId: routine.id,
                }).then(async () => {
                  setTodayOverrideVisible(false);
                  await refresh();
                })
              }
            />
          ))}
        </View>
      </Modal>
      <Modal
        visible={rescheduleVisible}
        onClose={() => setRescheduleVisible(false)}
        title="Move workout"
      >
        <Text className="mb-3 text-sm" style={{ color: tokens.textMuted }}>
          Move this scheduled workout to a single date. The recurring week stays intact.
        </Text>
        <TextField
          label="New date"
          value={rescheduleDateInput}
          onChangeText={setRescheduleDateInput}
          placeholder="YYYY-MM-DD"
        />
        <Button
          label="Move workout"
          color={COLOR}
          onPress={() => {
            const fromDateKey = toDateKey(new Date());
            const routineId = todaySchedule?.routineId ?? todayRoutine?.id;
            if (!routineId || !isValidDateKey(rescheduleDateInput)) {
              Alert.alert('Enter a date', 'Use a valid date as YYYY-MM-DD.');
              return;
            }
            void rescheduleWorkoutDate({
              fromDateKey,
              toDateKey: rescheduleDateInput,
              routineId,
            }).then(async () => {
              setRescheduleVisible(false);
              await refresh();
            });
          }}
        />
      </Modal>
      <Modal
        visible={bodyWeightModalVisible}
        onClose={() => setBodyWeightModalVisible(false)}
        title={editingBodyWeight ? 'Edit body weight' : 'Log body weight'}
      >
        <TextField
          label="Weight"
          value={bodyWeightValue}
          onChangeText={(value) =>
            setBodyWeightValue(sanitizeNumericInput(value, { allowDecimal: true }))
          }
          placeholder="80.0"
          keyboardType="numeric"
        />
        <Text className="mb-2 text-sm font-semibold" style={{ color: tokens.text }}>
          Unit
        </Text>
        <View className="mb-3 flex-row">
          <PillChip
            label="kg"
            active={bodyWeightUnit === 'kg'}
            color={COLOR}
            onPress={() => setBodyWeightUnit('kg')}
          />
          <PillChip
            label="lb"
            active={bodyWeightUnit === 'lb'}
            color={COLOR}
            onPress={() => setBodyWeightUnit('lb')}
          />
        </View>
        <TextField
          label="Note (optional)"
          value={bodyWeightNote}
          onChangeText={setBodyWeightNote}
          placeholder="Morning, post-workout…"
        />
        <TextField
          label="Goal weight (optional)"
          value={bodyWeightGoalValue}
          onChangeText={(value) =>
            setBodyWeightGoalValue(sanitizeNumericInput(value, { allowDecimal: true }))
          }
          placeholder="75.0"
          keyboardType="numeric"
        />
        <Button
          label={editingBodyWeight ? 'Save changes' : 'Save weight and goal'}
          color={COLOR}
          onPress={() => {
            const value = Number(bodyWeightValue);
            const goal = Number(bodyWeightGoalValue);
            const hasMeasurement = Number.isFinite(value) && value > 0;
            const hasGoal =
              bodyWeightGoalValue.trim() === '' || (Number.isFinite(goal) && goal > 0);
            const clearingExistingGoal = workoutPreferences?.goalWeight != null;
            if (!hasMeasurement && bodyWeightGoalValue.trim() === '' && !clearingExistingGoal) {
              Alert.alert(
                'Enter a weight or goal',
                'Add a positive measurement, a goal weight, or both.',
              );
              return;
            }
            if (!hasGoal) {
              Alert.alert('Enter a valid goal', 'Use a positive number for the goal weight.');
              return;
            }
            void (async () => {
              if (editingBodyWeight) {
                await updateBodyWeightEntry(editingBodyWeight.id, {
                  weight: value,
                  unit: bodyWeightUnit,
                  note: bodyWeightNote,
                });
              } else if (hasMeasurement) {
                await addBodyWeightEntry({
                  weight: value,
                  unit: bodyWeightUnit,
                  note: bodyWeightNote,
                });
              }
              const nextPreferences: WorkoutPreferences = {
                ...(workoutPreferences ?? { effortScale: 'off', workoutReminder: null }),
                goalWeight:
                  bodyWeightGoalValue.trim() === '' ? null : { value: goal, unit: bodyWeightUnit },
              };
              await saveWorkoutPreferences(nextPreferences);
              setWorkoutPreferences(nextPreferences);
              setBodyWeightValue('');
              setBodyWeightNote('');
              setEditingBodyWeight(null);
              setBodyWeightModalVisible(false);
              await refresh();
            })();
          }}
        />
      </Modal>
      <RoutineDetailModal
        visible={routineModal !== null}
        routineId={routineModal?.routineId ?? ''}
        routineName={routineModal?.routineName ?? ''}
        onClose={() => setRoutineModal(null)}
        onUseAsTemplate={async () => {
          if (!routineModal) return;
          await duplicateRoutine(routineModal.routineId);
          setRoutineModal(null);
          void refresh();
        }}
        onStartWorkout={() => {
          if (!routineModal) return;
          const routineId = routineModal.routineId;
          setRoutineModal(null);
          void startRoutineById(routineId);
        }}
      />
      <WorkoutHistoryDetailModal
        visible={detailLogId !== null}
        logId={detailLogId}
        onClose={() => setDetailLogId(null)}
      />
      <MenuSheet
        visible={chooserVisible}
        onClose={() => setChooserVisible(false)}
        title="Start workout — choose a routine"
        items={routines.map((routine) => ({
          icon: 'fitness-center' as const,
          label: routine.name,
          onPress: () => {
            void startRoutineById(routine.id);
          },
        }))}
      />
      {confirmationDialog}
      <Screen scroll>
        <ScreenSection>
          <PageHeader
            title="Workout"
            subtitle={
              workoutStripHasActivity
                ? 'Plan your week, build prescriptions, train with guidance, and review progress in one place.'
                : 'Build a training plan, start a guided workout, and track your progress.'
            }
          />
        </ScreenSection>

        <ScreenSection>
          <WorkoutTodayCard
            schedule={todaySchedule}
            routine={todayRoutine}
            lastPerformedAt={todayRoutine ? (lastPerformed.get(todayRoutine.id) ?? null) : null}
            completedToday={completedWorkoutToday}
            draftRoutineName={draftRoutineName}
            isResumable={draft !== null}
            exerciseCount={todayRoutine?.exercises.length ?? 0}
            setCount={
              todayRoutine?.exercises.reduce(
                (total, exercise) => total + exercise.sets.length,
                0,
              ) ?? 0
            }
            onStart={() => {
              if (draft) void handleResumeDraft();
              else if (todayRoutine) void startRoutineById(todayRoutine.id);
              else setChooserVisible(true);
            }}
            onPlanWeek={() => setWeekEditorVisible(true)}
            onChangeToday={() => setTodayOverrideVisible(true)}
            onReschedule={() => {
              const next = new Date();
              next.setDate(next.getDate() + 1);
              setRescheduleDateInput(toDateKey(next));
              setRescheduleVisible(true);
            }}
          />
        </ScreenSection>

        <ScreenSection>
          <WorkoutWeekCard
            entries={weeklyPlan}
            routines={routines}
            onSelect={(weekday, routineId) => {
              void upsertWeeklyPlanEntry({
                weekday,
                planKind: routineId ? 'workout' : 'rest',
                routineId,
              }).then(refresh);
            }}
          />
        </ScreenSection>

        <ScreenSection>
          <Card accentColor={COLOR} className="mb-0">
            {draft && draftRoutineName ? (
              <>
                <Text
                  className="text-xs font-semibold uppercase"
                  style={{ color: tokens.textMuted }}
                >
                  Session in progress
                </Text>
                <Text className="mt-1 text-base font-semibold" style={{ color: tokens.text }}>
                  {draftRoutineName}
                </Text>
                <View className="mt-4 gap-3">
                  <Button
                    label={`Resume workout · ${draftRoutineName}`}
                    onPress={() => void handleResumeDraft()}
                    color={COLOR}
                  />
                  <Button
                    label="Discard"
                    variant="ghost"
                    onPress={() => void handleDiscardDraft()}
                  />
                </View>
              </>
            ) : (
              <>
                <Text className="text-base font-semibold" style={{ color: tokens.text }}>
                  Ready to train?
                </Text>
                <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                  Pick a routine and the guided timer walks you through every set.
                </Text>
                <View className="mt-4">
                  <Button
                    label="Start workout"
                    onPress={() => {
                      if (routines.length === 0) {
                        Alert.alert(
                          'No routines yet',
                          'Create a routine first, then start your workout.',
                        );
                        return;
                      }
                      setChooserVisible(true);
                    }}
                    color={COLOR}
                  />
                </View>
              </>
            )}
          </Card>
        </ScreenSection>

        <ScreenSection>
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[160px] flex-1">
              <FeatureStatCard
                accentColor={COLOR}
                textColor={colorText}
                icon="fitness-center"
                title="Workout days"
                value={workoutDaysCount}
                subtitle="Last 52 weeks"
                note={
                  workoutStripHasActivity ? 'Sessions logged this year' : 'No sessions logged yet'
                }
              />
            </View>
            <View className="min-w-[160px] flex-1">
              <FeatureStatCard
                accentColor={COLOR}
                textColor={colorText}
                icon="calendar-today"
                title="Current streak"
                value={workoutStreak}
                subtitle="Back-to-back workout days"
                note={
                  workoutStreak > 0
                    ? 'Keep the run alive today'
                    : 'Your next session starts the streak'
                }
              />
            </View>
          </View>
        </ScreenSection>

        {!workoutStripHasActivity ? (
          <ScreenSection>
            <EmptyStateCard
              accentColor={COLOR}
              className="mb-0"
              title="Complete a workout to start tracking"
              description="Your routine history and yearly intensity map will appear here once you log a session."
              icon={<MaterialIcons name="self-improvement" size={26} color={colorText} />}
            />
          </ScreenSection>
        ) : null}
        <ScreenSection>
          <Card
            variant="header"
            accentColor={COLOR}
            headerTitle="Add new routine"
            headerSubtitle="Keep names short and descriptions specific so routines stay scannable."
            headerRight={<MaterialIcons name="add" size={22} color={tokens.textOnAccent} />}
            className="mb-0"
          >
            <TextField
              label="Routine name"
              accessibilityLabel="New routine name"
              value={name}
              onChangeText={(t) => {
                setWorkoutError(null);
                setName(t);
              }}
              placeholder="Push Day"
            />
            <TextField
              label="Description"
              accessibilityLabel="New routine description"
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
        </ScreenSection>

        {routines.length > 0 ? (
          <ScreenSection>
            <View className="mb-4 mt-1">
              <Text className="text-base font-semibold" style={{ color: tokens.text }}>
                Your routines
              </Text>
              <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                Swipe to edit or delete. Open a routine to manage exercises and sets.
              </Text>
            </View>

            {routines.map((routine) => (
              <RoutineSwipeRow
                key={routine.id}
                routine={routine}
                accentColor={COLOR}
                lastPerformedAt={lastPerformed.get(routine.id) ?? null}
                onOpenDetail={() => openRoutineModal(routine.id, routine.name)}
                onCompleteWorkout={() => {
                  void (async () => {
                    await completeRoutine(routine.id);
                    void refresh();
                  })();
                }}
                onRequestDelete={async () => {
                  await handleDeleteRoutine(routine);
                }}
              />
            ))}
          </ScreenSection>
        ) : null}

        {historyAnalyticsComposition}
      </Screen>
    </>
  );
}
