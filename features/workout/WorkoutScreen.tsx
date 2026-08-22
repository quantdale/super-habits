import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
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
  type WorkoutSessionDraft,
} from '@/features/workout/workout.data';
import {
  buildVolumePerWeek,
  buildWorkoutActivityDays,
  buildWorkoutHeatmapDays,
  computeWorkoutStreakFromHeatmapDays,
  formatLastPerformedLabel,
  type EnteredSetValues,
  type PhaseDisposition,
} from '@/features/workout/workout.domain';
import type { ActivityDay, HeatmapDay } from '@/features/shared/activityTypes';
import { GitHubHeatmap } from '@/features/shared/GitHubHeatmap';
import { toDateKey } from '@/lib/time';
import { useActiveForegroundRefresh } from '@/lib/useForegroundRefresh';
import { RoutineDetailModal } from './RoutineDetailScreen';
import { WorkoutSessionScreen, type SessionResume } from './WorkoutSessionScreen';
import { WorkoutHistoryDetailModal } from './WorkoutHistoryDetail';
import { WeeklyVolumeChart } from './WeeklyVolumeChart';

import { SECTION_COLORS } from '@/constants/sectionColors';
import { SwipeableCard } from '@/core/ui/SwipeableCard';
import { ValidationError } from '@/core/ui/ValidationError';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { validateRoutineName } from '@/lib/validation';

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [workoutActivityDays, setWorkoutActivityDays] = useState<ActivityDay[]>([]);
  const [workoutHeatmapDays, setWorkoutHeatmapDays] = useState<HeatmapDay[]>([]);
  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<ReturnType<typeof buildVolumePerWeek>>([]);
  const [detailLogId, setDetailLogId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>({ type: 'list' });
  const [routineModal, setRoutineModal] = useState<RoutineModalState | null>(null);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkoutSessionDraft | null>(null);
  const [chooserVisible, setChooserVisible] = useState(false);
  const [lastPerformed, setLastPerformed] = useState<Map<string, string>>(new Map());
  useCommandLauncherSuppressed('workout-session-active', currentView.type === 'session');

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
    setRecentLogs(allLogs.slice(0, 10));

    const volumeStart = new Date();
    volumeStart.setDate(volumeStart.getDate() - 7 * 7 - ((volumeStart.getDay() + 6) % 7));
    const totals = await listSessionTotalsForRange(toDateKey(volumeStart), endKey);
    setWeeklyVolume(buildVolumePerWeek(totals, 8));

    setLastPerformed(await getLastPerformedByRoutine());
    setDraft(await getWorkoutSessionDraft());
  }, []);

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

  const workoutStripHasActivity = workoutActivityDays.some((d) => d.active);
  const workoutStreak = computeWorkoutStreakFromHeatmapDays(workoutHeatmapDays);
  const workoutDaysCount = workoutActivityDays.filter((d) => d.active).length;

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

  return (
    <>
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
                ? 'Create simple routines, update exercises, and mark completions without leaving the tab.'
                : 'Create simple routines and mark completions.'
            }
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

        {recentLogs.length > 0 ? (
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
        ) : null}

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
      </Screen>
    </>
  );
}
