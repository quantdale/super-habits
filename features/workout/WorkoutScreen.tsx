import { Text } from '@/core/ui/Text';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View, useWindowDimensions } from 'react-native';
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
import { SectionLabel } from '@/core/ui/SectionLabel';
import { TextField } from '@/core/ui/TextField';
import { Button } from '@/core/ui/Button';
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
  getWorkoutPendingSave,
  clearWorkoutPendingSave,
  getLastPerformedByRoutine,
  listRoutines,
  listRoutineCounts,
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
  listWorkoutSessionExerciseCounts,
  getWorkoutPreferences,
  saveWorkoutPreferences,
  type WorkoutPerformanceRow,
  type WorkoutSessionDraft,
  type WorkoutPendingSave,
  reconcileWorkoutPendingSave,
  type WorkoutPreferences,
} from '@/features/workout/workout.data';
import {
  buildVolumePerWeek,
  buildWorkoutActivityDays,
  buildWorkoutHeatmapDays,
  computeWorkoutStreakFromHeatmapDays,
  computePersonalRecords,
  computeTrainingTotals,
  computeBodyAreaDistribution,
  isQuickLoggedSession,
  type EnteredSetValues,
  type PhaseDisposition,
  type ScheduleResolution,
} from '@/features/workout/workout.domain';
import {
  buildQuickStartRows,
  buildTrainingState,
  buildWeekStrip,
  weekdayLabel,
  type QuickStartRow,
  type WeekStripCell,
} from '@/features/workout/workoutLanding';
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
import { QuickLogBadge } from './QuickLogBadge';
import { WeeklyVolumeChart } from './WeeklyVolumeChart';

import { SECTION_COLORS } from '@/constants/sectionColors';
import { SwipeableCard } from '@/core/ui/SwipeableCard';
import { ValidationError } from '@/core/ui/ValidationError';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { useGamification } from '@/features/gamification/gamificationContext';
import { validateRoutineName } from '@/lib/validation';
import { createSubmitGuard } from '@/lib/submitGuard';
import { BodyWeightCard, WorkoutProgressCard, WorkoutTotalsCard } from './WorkoutGymPanels';
import { BUILT_IN_EXERCISES } from './exerciseCatalog';

const COLOR = SECTION_COLORS.workout;

type ViewState =
  { type: 'list' } | { type: 'session'; routine: RoutineWithExercises; resume?: SessionResume };

type RoutineModalState = { routineId: string; routineName: string };

/**
 * W9.1 quick-start row: one routine per flat row — identity, the facts needed
 * to choose (exercise/set counts, last performed), the schedule marker, and
 * one obvious Start. Row press opens the routine detail; the swipe actions
 * keep edit/delete. "Complete workout" stays as the quick-log action.
 */
function QuickStartRoutineRow({
  row,
  onOpenDetail,
  onStart,
  onCompleteWorkout,
  onRequestDelete,
  accentColor,
}: {
  row: QuickStartRow;
  onOpenDetail: () => void;
  onStart: () => void;
  onCompleteWorkout: () => void | Promise<void>;
  onRequestDelete: () => void | Promise<void>;
  accentColor: string;
}) {
  const { tokens } = useAppTheme();
  const meta = [
    `${row.exerciseCount} exercise${row.exerciseCount === 1 ? '' : 's'}`,
    `${row.setCount} set${row.setCount === 1 ? '' : 's'}`,
    row.lastPerformedLabel ? `Last: ${row.lastPerformedLabel}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <SwipeableCard
      accentColor={accentColor}
      style={{ marginBottom: 12 }}
      onEdit={onOpenDetail}
      onDelete={onRequestDelete}
    >
      <View className="flex-row items-center gap-3">
        <RectButton
          onPress={onOpenDetail}
          accessibilityRole="button"
          accessibilityLabel={`Open ${row.name} routine`}
          style={{ flex: 1, minWidth: 0, backgroundColor: 'transparent' }}
        >
          <View className="flex-row items-center gap-2">
            <Text
              className="text-base font-semibold"
              style={{ color: tokens.text, flexShrink: 1 }}
              numberOfLines={2}
            >
              {row.name}
            </Text>
            {row.isScheduledToday ? (
              <View
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: `${accentColor}22` }}
              >
                <Text className="text-[11px] font-semibold" style={{ color: accentColor }}>
                  Today
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
            {meta}
          </Text>
        </RectButton>
        <Button
          label="Start"
          size="sm"
          color={accentColor}
          accessibilityLabel={`Start ${row.name}`}
          onPress={onStart}
        />
      </View>
      <RectButton
        onPress={onCompleteWorkout}
        accessibilityRole="button"
        accessibilityLabel={`Complete workout ${row.name}`}
        hitSlop={4}
        style={{ alignSelf: 'flex-start', backgroundColor: 'transparent', paddingVertical: 6 }}
      >
        <Text className="text-xs font-semibold" style={{ color: tokens.textMuted }}>
          Complete workout
        </Text>
      </RectButton>
    </SwipeableCard>
  );
}

/**
 * One day of the collapsed weekly strip (SUR-06): readable assignment, explicit
 * Rest distinct from unplanned, today marked, and direct Rest/assign controls
 * that keep 44pt targets without repeating a row of pills per day.
 */
function WeekStripRow({
  cell,
  onRest,
  onAssign,
}: {
  cell: WeekStripCell;
  onRest: () => void;
  onAssign: () => void;
}) {
  const { tokens } = useAppTheme();
  const assignment = cell.routineName ?? (cell.state === 'rest' ? 'Rest' : 'Not planned');
  return (
    <View
      className="flex-row items-center gap-2 px-1 py-1"
      style={{
        borderTopWidth: cell.weekday === 1 ? 0 : 1,
        borderTopColor: tokens.border,
      }}
    >
      <Text
        className="w-9 text-sm font-semibold"
        style={{ color: cell.isToday ? tokens.text : tokens.textMuted }}
      >
        {cell.dayLabel}
      </Text>
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <Text
          className="text-sm"
          style={{
            color: cell.state === 'workout' ? tokens.text : tokens.textMuted,
            flexShrink: 1,
          }}
          // W16: the day and its assignment are separate visual nodes, so
          // assistive tech (and the native flows) had no way to relate the two.
          // Naming the pair fixes that and makes the weekly plan assertable.
          accessibilityLabel={`${weekdayLabel(cell.weekday)}: ${assignment}`}
          numberOfLines={2}
        >
          {assignment}
        </Text>
        {cell.isToday ? (
          <Text className="text-[10px] font-semibold uppercase" style={{ color: tokens.text }}>
            Today
          </Text>
        ) : null}
        {cell.isOverride ? (
          <Text className="text-[10px] font-semibold uppercase" style={{ color: tokens.textMuted }}>
            Override
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onRest}
        accessibilityRole="button"
        accessibilityLabel={`${weekdayLabel(cell.weekday)} rest`}
        accessibilityState={{ selected: cell.state === 'rest' }}
        className="items-center justify-center rounded-lg"
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: cell.state === 'rest' ? `${COLOR}22` : tokens.surfaceElevated,
        }}
      >
        <Text
          className="text-[11px] font-semibold"
          style={{ color: cell.state === 'rest' ? tokens.text : tokens.textMuted }}
        >
          Rest
        </Text>
      </Pressable>
      <Pressable
        onPress={onAssign}
        accessibilityRole="button"
        accessibilityLabel={`${weekdayLabel(cell.weekday)} assign routine`}
        className="items-center justify-center rounded-lg"
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.surfaceElevated,
        }}
      >
        <MaterialIcons
          name={cell.state === 'workout' ? 'swap-horiz' : 'add'}
          size={16}
          color={tokens.textMuted}
        />
      </Pressable>
    </View>
  );
}

export function WorkoutScreen({ isActive }: { isActive: boolean }) {
  const { tokens, sectionAccents } = useAppTheme();
  const { recordAction } = useGamification();
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
  // Synchronous re-entry guards for the async write paths: React state
  // updates are async, so two taps in the same tick would both pass a state
  // check and persist twice (CG-3 defect class). tryStart() is synchronous
  // and drops the second press before any write begins. Separate guards so
  // the two forms never block each other.
  const createRoutineGuardRef = useRef(createSubmitGuard());
  const quickCompleteGuardRef = useRef(createSubmitGuard());
  const [draft, setDraft] = useState<WorkoutSessionDraft | null>(null);
  /** Finished-but-unsaved session (`AUD-SH04-A`); cleared only by save or discard. */
  const [pendingSave, setPendingSave] = useState<WorkoutPendingSave | null>(null);
  const [chooserVisible, setChooserVisible] = useState(false);
  const [lastPerformed, setLastPerformed] = useState<Map<string, string>>(new Map());
  const [todaySchedule, setTodaySchedule] = useState<ScheduleResolution | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<WorkoutWeeklyPlanEntry[]>([]);
  const [todayRoutine, setTodayRoutine] = useState<RoutineWithExercises | null>(null);
  const [bodyWeightEntries, setBodyWeightEntries] = useState<BodyWeightEntry[]>([]);
  const [performanceRows, setPerformanceRows] = useState<WorkoutPerformanceRow[]>([]);
  const [sessionExerciseCounts, setSessionExerciseCounts] = useState<
    { logId: string; exerciseCount: number }[]
  >([]);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [selectedProgressExercise, setSelectedProgressExercise] = useState<string | null>(null);
  const [weekEditorVisible, setWeekEditorVisible] = useState(false);
  // W9.1: the focused per-day assignment sheet replaces the old "Change
  // today" modal. `scope` is explicit so a one-day override can never be
  // confused with the recurring weekly template.
  const [daySheet, setDaySheet] = useState<{
    weekday: number;
    scope: 'today' | 'weekly';
  } | null>(null);
  // History & insights disclosure: collapsed by default so training actions
  // lead, and the heavy history derivations below only run while it is open.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [routineCounts, setRoutineCounts] = useState<
    { routineId: string; exerciseCount: number; setCount: number }[]
  >([]);
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
      pendingSaveState,
      resolved,
      plan,
      weightEntries,
      performanceRowsLoaded,
      sessionExerciseCountsLoaded,
      customExercisesLoaded,
      preferences,
      routineCountsLoaded,
    ] = await Promise.all([
      listRoutines(),
      listWorkoutLogsForRange(startKey, todayKey),
      listSessionTotalsForRange(toDateKey(volumeStart), todayKey),
      getLastPerformedByRoutine(),
      getWorkoutSessionDraft(),
      getWorkoutPendingSave(),
      resolveWorkoutScheduleForDate(todayKey),
      listWeeklyPlan(),
      listBodyWeightEntries(),
      listWorkoutPerformanceRows(),
      listWorkoutSessionExerciseCounts(),
      listCustomExercises(),
      getWorkoutPreferences(),
      listRoutineCounts(),
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
    setPendingSave(pendingSaveState);
    setTodaySchedule(resolved);
    setWeeklyPlan(plan);
    setBodyWeightEntries(weightEntries);
    setPerformanceRows(performanceRowsLoaded);
    setSessionExerciseCounts(sessionExerciseCountsLoaded);
    setCustomExercises(customExercisesLoaded);
    setWorkoutPreferences(preferences);
    setRoutineCounts(routineCountsLoaded);
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
    if (!createRoutineGuardRef.current.tryStart()) return;
    try {
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
    } finally {
      createRoutineGuardRef.current.finish();
    }
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

  const startRoutineRef = useRef<(() => void) | null>(null);
  const startRoutineById = useCallback(
    async (routineId: string) => {
      // `AUD-SH04-A` (review findings 1 / R3-01): a finished workout awaiting save
      // lives in ONE durable slot. Starting a second session used to overwrite it
      // with the new session's state, silently destroying a completed-but-unsaved
      // workout with no history row and no explicit discard.
      //
      // R3-01: the check must read AUTHORITATIVE durable state, not the React
      // `pendingSave` snapshot. A cancelled session leaves the workout list
      // reachable before its async refresh finishes, so with `refresh` paused a
      // second start could slip past the stale React state and reach the slot.
      // The durable read below is what actually gates the slot.
      const durablePending = await getWorkoutPendingSave().catch(() => null);
      if (durablePending || pendingSave) {
        if (durablePending && !pendingSave) {
          // The slot changed underneath us: adopt it so the UI reflects reality.
          setPendingSave(durablePending);
        }
        const viewIt = await confirm({
          title: 'Finish the workout you have?',
          message:
            'A finished workout is still waiting to be saved. Save or discard it before starting another one.',
          confirmLabel: 'View it',
          cancelLabel: 'Not now',
        });
        if (viewIt) startRoutineRef.current?.();
        return;
      }
      const full = await getRoutineWithExercises(routineId);
      if (!full || full.exercises.length === 0) {
        Alert.alert('No exercises', 'Add exercises to this routine before starting.');
        return;
      }
      setCurrentView({ type: 'session', routine: full });
    },
    [pendingSave, confirm],
  );

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
        ...(draft.addedSets
          ? {
              addedSets: Object.fromEntries(
                Object.entries(draft.addedSets)
                  .map(([index, count]) => [Number.parseInt(index, 10), count] as const)
                  .filter(([index]) => Number.isInteger(index) && index >= 0),
              ),
            }
          : {}),
      },
    });
  }, [draft]);

  /**
   * Re-open a finished-but-unsaved session on its summary (`AUD-SH04-B`).
   *
   * The first step reconciles against committed logs: a crash AFTER the log
   * committed but BEFORE the pending state was cleared must not insert a second
   * log (`AUD-SH04-C`), so an already-committed session is reported as saved and
   * its recovery state is retired instead.
   */
  const handleRetryPendingSave = useCallback(async () => {
    if (!pendingSave) return;
    const reconciled = await reconcileWorkoutPendingSave(pendingSave);
    if (reconciled.status === 'saved') {
      setPendingSave(null);
      await refresh();
      return;
    }
    const full = await getRoutineWithExercises(pendingSave.routineId);
    if (!full || full.exercises.length === 0) {
      Alert.alert(
        'Workout unavailable',
        'The routine for this finished session no longer has any exercises, so it cannot be saved. Your entered values are kept until you discard it.',
        [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              void clearWorkoutPendingSave().catch(() => {});
              setPendingSave(null);
            },
          },
        ],
      );
      return;
    }
    const dispositions: Record<number, PhaseDisposition> = {};
    for (const [index, disposition] of Object.entries(pendingSave.dispositions)) {
      const parsed = Number.parseInt(index, 10);
      if (Number.isInteger(parsed)) dispositions[parsed] = disposition;
    }
    const enteredSets: Record<number, EnteredSetValues> = {};
    for (const [index, values] of Object.entries(pendingSave.enteredSets)) {
      const parsed = Number.parseInt(index, 10);
      if (Number.isInteger(parsed)) enteredSets[parsed] = values;
    }
    setCurrentView({
      type: 'session',
      routine: full,
      resume: {
        // `AUD-SH04-A`: a finished session must reopen at its FINAL cursor, not
        // at 0. The collectors only walk phases up to `completedUpToIndex`, so
        // reopening at 0 re-saved only the first exercise and silently dropped
        // every later one.
        phaseIndex: pendingSave.phaseIndex,
        startedAtMs: Date.parse(pendingSave.startedAtIso),
        elapsedSeconds: pendingSave.elapsedSeconds,
        alreadyFinished: true,
        ...(Object.keys(dispositions).length > 0 ? { dispositions } : {}),
        ...(Object.keys(enteredSets).length > 0 ? { enteredSets } : {}),
        ...(pendingSave.addedSets
          ? {
              addedSets: Object.fromEntries(
                Object.entries(pendingSave.addedSets)
                  .map(([index, count]) => [Number.parseInt(index, 10), count] as const)
                  .filter(([index]) => Number.isInteger(index) && index >= 0),
              ),
            }
          : {}),
      },
    });
  }, [pendingSave, refresh]);

  // `startRoutineById` is declared before `handleRetryPendingSave`; the handler is
  // reachable through this ref so the declaration order does not need reshuffling.
  useEffect(() => {
    startRoutineRef.current = () => {
      void handleRetryPendingSave();
    };
    return () => {
      startRoutineRef.current = null;
    };
  }, [handleRetryPendingSave]);

  /** Explicit discard of a finished-but-unsaved session. */
  const handleDiscardPendingSave = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Discard finished workout?',
      message:
        'The entered sets from this finished session will be removed and never saved to your history.',
      confirmLabel: 'Discard',
      confirmVariant: 'danger',
    });
    if (!confirmed) return;
    await clearWorkoutPendingSave();
    setPendingSave(null);
  }, [confirm]);

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
  const pendingSaveRoutineName = pendingSave
    ? (routines.find((r) => r.id === pendingSave.routineId)?.name ?? 'Workout')
    : null;
  const todayKey = toDateKey(new Date());
  const todayWeekdayNum = ((new Date().getDay() + 6) % 7) + 1;
  const completedWorkoutToday = allLogs.some(
    (log) => toDateKey(new Date(log.completed_at)) === todayKey,
  );

  // W9.1 landing view models. The training state decides the single dominant
  // action (resume > scheduled > quick-start chooser); rest context is compact
  // and never a hero (SYS-20).
  const trainingState = buildTrainingState({
    schedule: todaySchedule
      ? { planKind: todaySchedule.planKind, routineId: todaySchedule.routineId }
      : null,
    scheduledRoutine: todayRoutine
      ? {
          id: todayRoutine.id,
          name: todayRoutine.name,
          exerciseCount: todayRoutine.exercises.length,
          setCount: todayRoutine.exercises.reduce((total, ex) => total + ex.sets.length, 0),
        }
      : null,
    completedToday: completedWorkoutToday,
    draftRoutineName,
    hasDraft: draft !== null,
    routineCount: routines.length,
    // A finished-but-unsaved session outranks the draft and the schedule.
    pendingSave: pendingSave
      ? { routineName: pendingSaveRoutineName, lastError: pendingSave.lastError ?? null }
      : null,
  });

  const quickStartRows = useMemo(
    () =>
      buildQuickStartRows(routines, routineCounts, lastPerformed, todaySchedule?.routineId ?? null),
    [routines, routineCounts, lastPerformed, todaySchedule?.routineId],
  );

  const weekStrip = useMemo(
    () =>
      buildWeekStrip({
        weeklyPlan,
        routines,
        todayWeekday: todayWeekdayNum,
        todayResolution: todaySchedule
          ? {
              planKind: todaySchedule.planKind,
              routineId: todaySchedule.routineId,
              isOverride: todaySchedule.source === 'override',
            }
          : undefined,
      }),
    [weeklyPlan, routines, todayWeekdayNum, todaySchedule],
  );

  // Heavy history derivations (records, totals, body-area split) run only
  // while the History & insights disclosure is open — the training path never
  // pays for them, and a collapsed landing does not re-render them on ticks.
  const landingAnalytics = useMemo(() => {
    if (!historyOpen) return null;
    const records = computePersonalRecords(
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
    const totals = computeTrainingTotals(
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
    const bodyAreas = computeBodyAreaDistribution(
      performanceRows
        .filter((row) => row.completed === 1 && row.catalogExerciseId)
        .map((row) => ({
          primaryArea: catalogAreaById.get(row.catalogExerciseId ?? '') ?? '',
          setsCompleted: 1,
        })),
    );
    return { records, totals, bodyAreas };
  }, [historyOpen, performanceRows, allLogs, customExercises]);
  const personalRecords = landingAnalytics?.records ?? [];
  const trainingTotals = landingAnalytics?.totals ?? null;
  const bodyAreaDistribution = landingAnalytics?.bodyAreas ?? [];

  // Cheap per-render facts used by the history disclosure header.
  const workoutStripHasActivity = workoutActivityDays.some((d) => d.active);
  const workoutStreak = computeWorkoutStreakFromHeatmapDays(workoutHeatmapDays);
  const workoutDaysCount = workoutActivityDays.filter((d) => d.active).length;

  /**
   * Assign a day from the focused assignment sheet. `scope` is explicit:
   * 'today' writes a one-day override, 'weekly' edits the recurring template.
   * A one-day override can never silently rewrite the weekly plan.
   */
  const assignWeekday = useCallback(
    async (weekday: number, routineId: string | null, scope: 'today' | 'weekly') => {
      try {
        if (scope === 'today') {
          await setWorkoutScheduleOverride({
            dateKey: todayKey,
            overrideKind: routineId ? 'workout' : 'rest',
            ...(routineId ? { routineId } : {}),
          });
        } else {
          await upsertWeeklyPlanEntry({
            weekday,
            planKind: routineId ? 'workout' : 'rest',
            routineId,
          });
        }
      } catch (error) {
        // Keep the assignment sheet open with the reason instead of closing as
        // if the day was assigned.
        setWorkoutError(error instanceof Error ? error.message : 'Could not assign the day.');
        return;
      }
      setDaySheet(null);
      await refresh();
    },
    [refresh, todayKey],
  );

  /** The landing's single dominant training action. */
  const handlePrimaryAction = useCallback(() => {
    switch (trainingState.primaryAction) {
      case 'resume':
        void handleResumeDraft();
        break;
      case 'retry-save':
        void handleRetryPendingSave();
        break;
      case 'start-scheduled':
        if (trainingState.primaryRoutineId) {
          void startRoutineById(trainingState.primaryRoutineId);
        }
        break;
      case 'choose-routine':
        setChooserVisible(true);
        break;
      default:
        break;
    }
  }, [
    trainingState.primaryAction,
    trainingState.primaryRoutineId,
    handleResumeDraft,
    handleRetryPendingSave,
    startRoutineById,
  ]);

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
  // A log missing from the exercise-count map has no recorded exercises: the
  // quick-log contract (shared `isQuickLoggedSession` predicate).
  const exerciseCountByLog = new Map(
    sessionExerciseCounts.map((row) => [row.logId, row.exerciseCount]),
  );
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
          const isQuickLog = isQuickLoggedSession(exerciseCountByLog.get(log.id) ?? 0);
          return (
            <Card key={log.id} accentColor={COLOR} style={{ marginBottom: 12 }}>
              <RectButton
                onPress={() => setDetailLogId(log.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open session from ${log.completed_at}`}
                style={{ backgroundColor: 'transparent' }}
              >
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-base font-semibold" style={{ color: tokens.text }}>
                    {routine?.name ?? 'Workout'}
                  </Text>
                  {isQuickLog ? <QuickLogBadge /> : null}
                </View>
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

  // Rendered only while the History & insights disclosure is open; the
  // totals themselves are gated on `historyOpen` above.
  const analyticsCardSection = trainingTotals ? (
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
  ) : null;

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
        visible={daySheet !== null}
        onClose={() => setDaySheet(null)}
        title={
          daySheet === null
            ? ''
            : daySheet.weekday === todayWeekdayNum
              ? 'Plan today'
              : `Plan ${weekdayLabel(daySheet.weekday)}`
        }
        scroll
      >
        {daySheet !== null ? (
          <>
            {daySheet.weekday === todayWeekdayNum ? (
              <View className="mb-3 flex-row gap-2">
                <PillChip
                  label="Just today"
                  active={daySheet.scope === 'today'}
                  color={COLOR}
                  accessibilityLabel="Just today"
                  onPress={() =>
                    setDaySheet((current) => (current ? { ...current, scope: 'today' } : current))
                  }
                />
                <PillChip
                  label={`Every ${weekdayLabel(daySheet.weekday)}`}
                  active={daySheet.scope === 'weekly'}
                  color={COLOR}
                  accessibilityLabel={`Every ${weekdayLabel(daySheet.weekday)}`}
                  onPress={() =>
                    setDaySheet((current) => (current ? { ...current, scope: 'weekly' } : current))
                  }
                />
              </View>
            ) : null}
            <Text className="mb-3 text-sm" style={{ color: tokens.textMuted }}>
              {daySheet.scope === 'today'
                ? `Choose a one-day override for ${todayKey}. Your weekly plan stays unchanged.`
                : `Assign ${weekdayLabel(daySheet.weekday)} in your recurring weekly plan.`}
            </Text>
            <View className="flex-row flex-wrap">
              <PillChip
                label={daySheet.scope === 'today' ? 'Rest today' : 'Rest'}
                active={
                  daySheet.scope === 'today'
                    ? todaySchedule?.source === 'override' && todaySchedule.planKind === 'rest'
                    : weeklyPlan.find((entry) => entry.weekday === daySheet.weekday)?.plan_kind ===
                      'rest'
                }
                color={COLOR}
                onPress={() => void assignWeekday(daySheet.weekday, null, daySheet.scope)}
              />
              {routines.map((routine) => (
                <PillChip
                  key={routine.id}
                  label={routine.name}
                  active={
                    daySheet.scope === 'today'
                      ? todaySchedule?.source === 'override' &&
                        todaySchedule.routineId === routine.id
                      : weeklyPlan.find((entry) => entry.weekday === daySheet.weekday)
                          ?.routine_id === routine.id
                  }
                  color={COLOR}
                  onPress={() => void assignWeekday(daySheet.weekday, routine.id, daySheet.scope)}
                />
              ))}
            </View>
          </>
        ) : null}
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
            }).then(
              () => {
                setRescheduleVisible(false);
                void refresh();
              },
              (error) => {
                // The move is atomic in the data layer; a rejection keeps the
                // dialog open with the reason instead of vanishing silently.
                // The second-argument form keeps a later refresh failure from
                // being mislabeled as a failed move.
                setWorkoutError(
                  error instanceof Error ? error.message : 'Could not move the workout.',
                );
              },
            );
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
        onRenamed={(name) => {
          setRoutineModal((current) => (current ? { ...current, routineName: name } : current));
          void refresh();
        }}
      />
      <WorkoutHistoryDetailModal
        visible={detailLogId !== null}
        logId={detailLogId}
        onClose={() => setDetailLogId(null)}
        onDeleted={() => {
          setDetailLogId(null);
          void refresh();
        }}
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
      {/* Exactly one page-level scroll authority: a single scroll-enabled
          `Screen` owns the landing. A nested scroll-enabled Screen would
          duplicate the safe-area shell, scroll containers, responsive
          gutters, bottom-navigation clearance, and keyboard behavior. */}
      <Screen scroll>
        <ScreenSection>
          <PageHeader title="Workout" />
          <View className="mt-1 flex-row items-center gap-2">
            <MaterialIcons name="today" size={14} color={tokens.textMuted} />
            <Text className="min-w-0 flex-1 text-sm" style={{ color: tokens.textMuted }}>
              {trainingState.contextLine}
            </Text>
            {trainingState.completedToday ? (
              <Text className="text-xs font-semibold" style={{ color: tokens.successText }}>
                Logged
              </Text>
            ) : null}
          </View>
          <Card accentColor={COLOR} className="mt-3">
            <Text className="text-lg font-semibold" style={{ color: tokens.text }}>
              {trainingState.headline}
            </Text>
            <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
              {trainingState.detail}
            </Text>
            {trainingState.primaryLabel ? (
              <View className="mt-4">
                <Button
                  label={trainingState.primaryLabel}
                  accessibilityLabel={
                    trainingState.kind === 'resume' && draftRoutineName
                      ? `Resume workout · ${draftRoutineName}`
                      : undefined
                  }
                  onPress={handlePrimaryAction}
                  color={COLOR}
                  fullWidth
                />
              </View>
            ) : null}
            {trainingState.kind === 'resume' ? (
              <View className="mt-2">
                <Button
                  label="Discard workout"
                  variant="ghost"
                  onPress={() => void handleDiscardDraft()}
                  fullWidth
                />
              </View>
            ) : null}
            {trainingState.kind === 'pending-save' ? (
              <View className="mt-2">
                <Button
                  label="Discard finished workout"
                  variant="ghost"
                  onPress={() => void handleDiscardPendingSave()}
                  fullWidth
                />
              </View>
            ) : null}
            {trainingState.kind !== 'resume' ? (
              <View className="mt-3 flex-row flex-wrap gap-2">
                <View className="min-w-[140px] flex-1">
                  <Button
                    label="Change today"
                    variant="ghost"
                    size="sm"
                    onPress={() => setDaySheet({ weekday: todayWeekdayNum, scope: 'today' })}
                  />
                </View>
                {trainingState.kind === 'scheduled' ? (
                  <View className="min-w-[140px] flex-1">
                    <Button
                      label="Move workout to another day"
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        const next = new Date();
                        next.setDate(next.getDate() + 1);
                        setRescheduleDateInput(toDateKey(next));
                        setRescheduleVisible(true);
                      }}
                    />
                  </View>
                ) : (
                  <View className="min-w-[140px] flex-1">
                    <Button
                      label="Plan week"
                      variant="ghost"
                      size="sm"
                      onPress={() => setWeekEditorVisible(true)}
                    />
                  </View>
                )}
              </View>
            ) : null}
          </Card>
        </ScreenSection>

        <ScreenSection>
          <SectionLabel>Quick start</SectionLabel>
          {routines.length === 0 ? (
            <EmptyStateCard
              accentColor={COLOR}
              className="mb-0"
              title="No routines yet"
              description="Add a routine below — every routine starts a guided session with set logging and rest."
              icon={<MaterialIcons name="fitness-center" size={26} color={colorText} />}
            />
          ) : (
            quickStartRows.map((row) => (
              <QuickStartRoutineRow
                key={row.routineId}
                row={row}
                accentColor={COLOR}
                onOpenDetail={() => openRoutineModal(row.routineId, row.name)}
                onStart={() => void startRoutineById(row.routineId)}
                onCompleteWorkout={() => {
                  if (!quickCompleteGuardRef.current.tryStart()) return;
                  void (async () => {
                    try {
                      const result = await completeRoutine(row.routineId);
                      // Attribute the award to the log just written; a skipped
                      // write (missing routine) earns no XP.
                      if (result.status === 'applied' && result.logId) {
                        recordAction('workout', result.logId);
                      }
                      void refresh();
                    } finally {
                      quickCompleteGuardRef.current.finish();
                    }
                  })();
                }}
                onRequestDelete={async () => {
                  const routine = routines.find((item) => item.id === row.routineId);
                  if (routine) await handleDeleteRoutine(routine);
                }}
              />
            ))
          )}
        </ScreenSection>

        <ScreenSection>
          <View className="mb-2 flex-row items-center justify-between">
            <SectionLabel className="mb-0">This week</SectionLabel>
            <Button
              label="Edit plan"
              variant="ghost"
              size="sm"
              accessibilityLabel="Edit weekly plan"
              onPress={() => setWeekEditorVisible(true)}
            />
          </View>
          <Card accentColor={COLOR} className="mb-0">
            {weekStrip.map((cell) => (
              <WeekStripRow
                key={cell.weekday}
                cell={cell}
                onRest={() =>
                  void assignWeekday(cell.weekday, null, cell.isToday ? 'today' : 'weekly')
                }
                onAssign={() =>
                  setDaySheet({ weekday: cell.weekday, scope: cell.isToday ? 'today' : 'weekly' })
                }
              />
            ))}
          </Card>
        </ScreenSection>

        <ScreenSection>
          <SectionLabel>New routine</SectionLabel>
          <Card accentColor={COLOR} className="mb-0">
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

        <ScreenSection className="mb-0">
          <Pressable
            onPress={() => setHistoryOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: historyOpen }}
            accessibilityLabel="History and insights"
            className="flex-row items-center justify-between py-2"
          >
            <View className="min-w-0 flex-1">
              <SectionLabel className="mb-0">History &amp; insights</SectionLabel>
              <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                {workoutStripHasActivity
                  ? `${workoutDaysCount} workout days · streak ${workoutStreak} · last 52 weeks`
                  : 'Sessions, personal records, body weight, volume, and your training heatmap.'}
              </Text>
            </View>
            <MaterialIcons
              name={historyOpen ? 'expand-less' : 'expand-more'}
              size={22}
              color={tokens.iconMuted}
            />
          </Pressable>
          {historyOpen ? (
            <View className="mt-2">
              {!workoutStripHasActivity ? (
                <EmptyStateCard
                  accentColor={COLOR}
                  className="mb-4"
                  title="Complete a workout to start tracking"
                  description="Your routine history and yearly intensity map will appear here once you log a session."
                  icon={<MaterialIcons name="self-improvement" size={26} color={colorText} />}
                />
              ) : null}
              {historyAnalyticsComposition}
            </View>
          ) : null}
        </ScreenSection>
      </Screen>
    </>
  );
}
