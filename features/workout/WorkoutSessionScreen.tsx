import { Text } from '@/core/ui/Text';
import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useAppTheme } from '@/core/providers/themeContext';
import { Screen } from '@/core/ui/Screen';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { TextField } from '@/core/ui/TextField';
import { NumberStepperField } from '@/core/ui/NumberStepperField';
import { useMotionDuration } from '@/core/theme/motion';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { useGamification } from '@/features/gamification/gamificationContext';
import {
  buildPreviousSetLookup,
  buildSessionExerciseInputs,
  buildTimerSequence,
  collectSessionSetRecords,
  computeSessionTotalSets,
  computeSessionTotalVolume,
  estimate1RM,
  findNewPersonalRecords,
  formatWorkoutTime,
  buildSessionLogExercises,
  lookupPreviousSet,
  parseOptionalMeasurement,
  recommendProgression,
  summarizeCompletedSets,
  type EnteredSetValues,
  type LoggedSet,
  type PhaseDisposition,
  type PreviousSetLookup,
  type TimerPhase,
} from './workout.domain';
import {
  appendAddedSets,
  buildExerciseSetRows,
  buildSessionProgress,
  canAddSetToExercise,
  remapCurrentIndex,
  remapPhaseIndices,
  remapSessionMaps,
  resolveSessionSave,
  type SetRow,
} from './workoutSessionView';
import { tickCountdown } from './workoutTimerTick';
import {
  clearWorkoutPendingSave,
  clearWorkoutSessionDraft,
  listLoggedSetsForExerciseNames,
  listRecentLoggedSets,
  listRecentWorkoutSetOutcomes,
  logWorkoutSession,
  loadRestSecondsDefault,
  getWorkoutPreferences,
  saveRestSecondsDefault,
  saveWorkoutPendingSave,
  saveWorkoutSessionDraft,
} from './workout.data';
import { cancelScheduledNotification, scheduleTimerEndNotification } from '@/lib/notifications';
import { createSubmitGuard } from '@/lib/submitGuard';
import { sanitizeNumericInput } from '@/lib/numericInput';
import {
  DEFAULT_REST_SECONDS,
  REST_SECONDS_MAX,
  REST_SECONDS_MIN,
  REST_SECONDS_STEP,
  clampRestSeconds,
} from './restTimerPreferences';
import type { WorkoutEffortScale, WorkoutWeightUnit } from '@/core/db/types';
import type { RoutineWithExercises } from './types';
import { SECTION_COLORS } from '@/constants/sectionColors';

const WORKOUT_COLOR = SECTION_COLORS.workout;

/** How long the live PR celebration stays on screen before auto-dismissing. */
const PR_NOTICE_VISIBLE_MS = 4000;

/** Whole numbers stay bare; fractional estimates keep one decimal. */
function formatMetricNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Keep a restored phase cursor inside the (possibly edited) sequence. */
function clampPhaseIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(0, Math.trunc(index)), length - 1);
}

/** Draft state replayed into a resumed session. */
export type SessionResume = {
  phaseIndex: number;
  startedAtMs: number;
  elapsedSeconds: number;
  /** Prior-phase outcomes saved with the draft (empty for legacy drafts). */
  dispositions?: Record<number, PhaseDisposition>;
  /** Entered measurements saved with the draft (absent for legacy drafts). */
  enteredSets?: Record<number, EnteredSetValues>;
  /** Seconds left on the resumed phase when the draft was written. */
  remainingSeconds?: number;
  /** Session-local added sets by engine exercise index, replayed on resume. */
  addedSets?: Record<number, number>;
  /**
   * Restored from a PENDING-SAVE state rather than a resumable draft
   * (`AUD-SH04-B`): the session already reached its summary and only the save is
   * outstanding, so the screen opens on the summary with every value restored.
   */
  alreadyFinished?: boolean;
  notes?: string;
  effortScale?: WorkoutEffortScale;
};

type Props = {
  routine: RoutineWithExercises;
  onFinish: () => void;
  onCancel: () => void;
  /** Present when the session was resumed from a persisted draft. */
  resume?: SessionResume;
};

export function WorkoutSessionScreen({ routine, onFinish, onCancel, resume }: Props) {
  const { tokens } = useAppTheme();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { recordAction } = useGamification();
  // Rest policy (Option A): stored `rest_seconds === 0` is intentional no
  // rest and runs back-to-back. The preference below only seeds sets created
  // afterwards — it never rewrites this live sequence. Mid-session tweaks stay
  // local until explicitly saved ("Save as default").
  const [restDefault, setRestDefault] = useState<number | null>(null);
  const [persistedRestDefault, setPersistedRestDefault] = useState<number | null>(null);
  const [effortScale, setEffortScale] = useState<WorkoutEffortScale>(resume?.effortScale ?? 'off');
  // The user's weight unit (same resolution as the body-weight modal): stamped
  // on logged sets so history never fabricates 'kg' for an lb user.
  const [weightUnit, setWeightUnit] = useState<WorkoutWeightUnit>('kg');
  // The engine exercises, mapped once. The live sequence composes these
  // with any session-local added sets — the routine template is never written.
  const baseExercises = useMemo(() => buildSessionExerciseInputs(routine), [routine]);

  // Session-local added sets, keyed by engine exercise index. Persisted with
  // the draft so a resumed session reconstructs the identical sequence.
  const [addedSets, setAddedSets] = useState<Record<number, number>>(() => ({
    ...(resume?.addedSets ?? {}),
  }));
  const effectiveExercises = useMemo(
    () => appendAddedSets(baseExercises, addedSets),
    [baseExercises, addedSets],
  );
  const sequence = useMemo(() => buildTimerSequence(effectiveExercises), [effectiveExercises]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadRestSecondsDefault(), getWorkoutPreferences()]).then(
      ([seconds, preferences]) => {
        if (!cancelled) {
          setRestDefault(seconds);
          setPersistedRestDefault(seconds);
          if (!resume?.effortScale) setEffortScale(preferences.effortScale);
          setWeightUnit(preferences.goalWeight?.unit ?? 'kg');
        }
      },
    );
    // Seed entry defaults and retain skipped/unknown outcomes for progression.
    void Promise.all([listRecentLoggedSets(), listRecentWorkoutSetOutcomes()])
      .then(([rows, outcomes]) => {
        if (!cancelled) {
          setPreviousLookup(buildPreviousSetLookup(rows));
          setRecentSetOutcomes(outcomes);
        }
      })
      .catch(() => {
        // Defaults stay empty when history cannot be read.
      });
    return () => {
      cancelled = true;
    };
  }, [resume?.effortScale]);

  const handleAdjustRestDefault = (delta: number) => {
    // Session-local only: future workouts are unaffected until the user
    // presses "Save as default".
    const next = clampRestSeconds((restDefault ?? DEFAULT_REST_SECONDS) + delta);
    setRestDefault(next);
    setRestPersistError(false);
  };

  const [restPersistError, setRestPersistError] = useState(false);

  const handlePersistRestDefault = () => {
    if (restDefault === null) return;
    void saveRestSecondsDefault(restDefault).then((persisted) => {
      if (persisted) {
        setPersistedRestDefault(restDefault);
        setRestPersistError(false);
      } else {
        // The write is retriable; the adjustable value stays as-is.
        setRestPersistError(true);
      }
    });
  };

  // A resumed session restarts paused at the saved phase cursor, replaying the
  // draft's saved dispositions and entered measurements. Legacy drafts (which
  // predate those fields) reconstruct with prior phases counted as completed
  // and their measurements unrecorded.
  const resumedIndex = resume ? clampPhaseIndex(resume.phaseIndex, sequence.length) : 0;
  const [currentIndex, setCurrentIndex] = useState(resumedIndex);
  const [remaining, setRemaining] = useState(() => {
    const phase = sequence[resumedIndex];
    if (!phase) return 0;
    const saved = Math.round(resume?.remainingSeconds ?? NaN);
    return Number.isFinite(saved) && saved > 0
      ? Math.min(saved, phase.durationSeconds)
      : phase.durationSeconds;
  });
  const [isRunning, setIsRunning] = useState(false);
  // A session whose save did NOT commit re-opens directly on the summary
  // (`AUD-SH04-B`): the user's finished workout is restored from the durable
  // pending-save state instead of being lost, and every entered value is back in
  // the fields the summary re-computes from.
  const [isComplete, setIsComplete] = useState(resume?.alreadyFinished === true);
  // Active-time tick counter; the persisted duration is this counter for
  // resumed sessions (wall-clock would include time the app was closed) and
  // real timestamps (startedAtMsRef → handleFinish) otherwise.
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    Math.max(0, Math.round(resume?.elapsedSeconds ?? 0)),
  );
  // Per-phase outcome: natural timeout marks 'completed', Skip marks
  // 'skipped'. Skipped active phases are never counted as completed work.
  const [dispositions, setDispositions] = useState<Record<number, PhaseDisposition>>(() => ({
    ...(resume?.dispositions ?? {}),
  }));
  // Optional weight/reps entry keyed by sequence index of each active phase.
  const [enteredSets, setEnteredSets] = useState<Record<number, EnteredSetValues>>(() => ({
    ...(resume?.enteredSets ?? {}),
  }));
  const [notes, setNotes] = useState(resume?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  // Synchronous re-entry guard for the async finish path: React state updates
  // are async, so two taps in the same tick would both pass an `isSaving`
  // check and log two workouts (CG-3 defect class). tryStart() is synchronous
  // and drops the second press before any write begins.
  const finishGuardRef = useRef(createSubmitGuard());
  const [savedOutcome, setSavedOutcome] = useState<{
    newRecords: string[];
    /** True when the log committed but secondary post-commit bookkeeping
     *  (draft cleanup, reward attribution) failed — the save is still real. */
    bookkeepingFailed?: boolean;
  } | null>(null);
  // Truthful finish: a failed save keeps the session and offers a retry.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previousLookup, setPreviousLookup] = useState<PreviousSetLookup | null>(null);
  const [recentSetOutcomes, setRecentSetOutcomes] = useState<
    Awaited<ReturnType<typeof listRecentWorkoutSetOutcomes>>
  >([]);
  // Wall-clock start captured on the FIRST Start press (not mount — users
  // idle before starting); null when the timer never ran. A resumed session
  // replays the draft's original start so logged duration stays truthful.
  const startedAtMsRef = useRef<number | null>(resume?.startedAtMs ?? null);

  const currentPhase: TimerPhase | undefined = sequence[currentIndex];

  // An in-session Add set grows the sequence: remap the index-keyed session
  // maps (dispositions, entered values, cursor) so every recorded phase keeps
  // pointing at the same set.
  const previousSequenceRef = useRef(sequence);
  useEffect(() => {
    const before = previousSequenceRef.current;
    if (before === sequence || before.length === 0) {
      previousSequenceRef.current = sequence;
      return;
    }
    const remap = remapPhaseIndices(before, sequence);
    if (remap.size > 0) {
      setDispositions((prev) => remapSessionMaps(prev, remap));
      setEnteredSets((prev) => remapSessionMaps(prev, remap));
      setCurrentIndex((prev) => {
        const next = remapCurrentIndex(prev, remap);
        currentIndexRef.current = next;
        return next;
      });
    }
    previousSequenceRef.current = sequence;
  }, [sequence]);

  /** Session-local Add set for the exercise at the cursor. */
  const handleAddSet = useCallback(() => {
    const exerciseIndex = currentPhase?.exerciseIndex;
    if (exerciseIndex === undefined) return;
    if (!canAddSetToExercise(baseExercises, exerciseIndex)) return;
    setAddedSets((prev) => ({ ...prev, [exerciseIndex]: (prev[exerciseIndex] ?? 0) + 1 }));
  }, [baseExercises, currentPhase?.exerciseIndex]);
  const canAddSet =
    currentPhase?.phase === 'active' &&
    canAddSetToExercise(baseExercises, currentPhase.exerciseIndex);

  const progressionRecommendation = useMemo(() => {
    if (!currentPhase || currentPhase.phase !== 'active') return null;
    const exercise = routine.exercises[currentPhase.exerciseIndex];
    if (!exercise) return null;
    const mode = exercise.progression_mode ?? 'none';
    if (mode === 'none') return null;
    const exerciseHistory = recentSetOutcomes.filter((row) =>
      currentPhase.catalogExerciseId
        ? row.catalogExerciseId === currentPhase.catalogExerciseId
        : row.catalogExerciseId === null && row.exerciseName === currentPhase.exerciseName,
    );
    const latestLogId = exerciseHistory[0]?.logId;
    const history = latestLogId
      ? exerciseHistory
          .filter((row) => row.logId === latestLogId)
          .map((row) => ({
            completed: row.completed === 1,
            weight: row.weight,
            reps: row.reps,
            durationSeconds: row.durationSeconds,
            distance: row.distance,
          }))
      : [];
    const previous = lookupPreviousSet(
      previousLookup,
      currentPhase.exerciseName,
      currentPhase.setNumber,
      currentPhase.catalogExerciseId,
    );
    return recommendProgression({
      mode,
      modality: currentPhase.modality,
      supportsExternalLoad: currentPhase.supportsExternalLoad,
      currentLoad:
        currentPhase.supportsExternalLoad === false
          ? null
          : (currentPhase.targetLoad ?? previous?.weight ?? null),
      increment: exercise.progression_increment ?? null,
      minReps: currentPhase.targetRepsMin ?? exercise.progression_min_reps ?? null,
      maxReps: currentPhase.targetRepsMax ?? exercise.progression_max_reps ?? null,
      currentDurationSeconds:
        currentPhase.targetDurationSeconds ??
        (currentPhase.modality === 'timed' || currentPhase.modality === 'cardio'
          ? currentPhase.durationSeconds
          : null),
      durationIncrementSeconds:
        currentPhase.modality === 'timed' || currentPhase.modality === 'cardio'
          ? (exercise.progression_increment ?? null)
          : null,
      latestSets: history,
    });
  }, [currentPhase, previousLookup, recentSetOutcomes, routine.exercises]);

  const timerNotificationIdRef = useRef<string | null>(null);

  // Best-effort native wake lock for the active workout. The tag is released
  // on every transition away from an active session and on unmount; web uses
  // the browser wake-lock implementation when available and otherwise no-ops.
  useEffect(() => {
    if (isRunning && !isComplete) {
      void activateKeepAwakeAsync('superhabits-workout-session').catch(() => {});
    } else {
      void deactivateKeepAwake('superhabits-workout-session').catch(() => {});
    }
    return () => {
      void deactivateKeepAwake('superhabits-workout-session').catch(() => {});
    };
  }, [isRunning, isComplete]);

  // When a rest phase is running, schedule the existing timer-end notification
  // seam. Native platforms may deliver it while backgrounded; web returns a
  // truthful no-op rather than pretending browser notifications are active.
  useEffect(() => {
    let cancelled = false;
    const previousId = timerNotificationIdRef.current;
    timerNotificationIdRef.current = null;
    if (previousId) void cancelScheduledNotification(previousId);
    if (!isRunning || isComplete || currentPhase?.phase !== 'rest') return;
    void scheduleTimerEndNotification(
      Math.max(1, Math.round(remainingRef.current)),
      'Rest complete',
      `Next: ${sequence[currentIndex + 1]?.exerciseName ?? routine.name}`,
    ).then((id) => {
      if (!cancelled) timerNotificationIdRef.current = id;
      else if (id) void cancelScheduledNotification(id);
    });
    return () => {
      cancelled = true;
      const id = timerNotificationIdRef.current;
      timerNotificationIdRef.current = null;
      if (id) void cancelScheduledNotification(id);
    };
  }, [currentIndex, currentPhase?.phase, isComplete, isRunning, routine.name, sequence]);

  const currentIndexRef = useRef(currentIndex);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  });

  const elapsedSecondsRef = useRef(elapsedSeconds);
  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  });

  const enteredSetsRef = useRef(enteredSets);
  useEffect(() => {
    enteredSetsRef.current = enteredSets;
  });

  const dispositionsRef = useRef(dispositions);
  useEffect(() => {
    dispositionsRef.current = dispositions;
  });

  const remainingRef = useRef(remaining);
  useEffect(() => {
    remainingRef.current = remaining;
  });

  // Draft persistence: written on Start, measurement edits, and every phase
  // transition so an app restart can offer to resume; cleared on
  // finish/abandon/discard. Timer ticks do not write a row every second.
  // Writes are async and best-effort, so a clear generation counter keeps a
  // late-resolving write from resurrecting a draft that was cleared while
  // that write was in flight.
  const draftClearGenerationRef = useRef(0);
  const persistDraft = useCallback(
    (phaseIndex: number): Promise<void> => {
      const startedAtMs = startedAtMsRef.current;
      if (startedAtMs === null) return Promise.resolve();
      const clearGenerationAtWrite = draftClearGenerationRef.current;
      // JSON keys are strings; the normalizer keeps only valid entries.
      const draftDispositions = Object.fromEntries(
        Object.entries(dispositionsRef.current).map(([index, disposition]) => [
          String(index),
          disposition,
        ]),
      );
      const draftEnteredSets = Object.fromEntries(
        Object.entries(enteredSetsRef.current).map(([index, values]) => [String(index), values]),
      );
      const draftAddedSets = Object.fromEntries(
        Object.entries(addedSets).map(([index, count]) => [String(index), count]),
      );
      return saveWorkoutSessionDraft({
        routineId: routine.id,
        routineSnapshot: routine,
        notes,
        effortScale,
        startedAtIso: new Date(startedAtMs).toISOString(),
        phaseIndex,
        elapsedAdjustSeconds: elapsedSecondsRef.current,
        ...(Object.keys(draftDispositions).length > 0 ? { dispositions: draftDispositions } : {}),
        ...(Object.keys(draftEnteredSets).length > 0 ? { enteredSets: draftEnteredSets } : {}),
        remainingSeconds: remainingRef.current,
        ...(Object.keys(draftAddedSets).length > 0 ? { addedSets: draftAddedSets } : {}),
      })
        .catch(() => {
          // Best-effort: the live session never depends on the draft. The
          // resolved promise still gates the Start readiness contract — a
          // failed write is surfaced as "not durable", not as a hang.
        })
        .then(() => {
          // A clear happened while this write was in flight: the clear is
          // the newer act, so re-assert it instead of leaving a resurrected
          // draft behind.
          if (draftClearGenerationRef.current !== clearGenerationAtWrite) {
            void clearWorkoutSessionDraft({
              routineId: routine.id,
              startedAtIso: new Date(startedAtMs).toISOString(),
            }).catch(() => {});
          }
        });
    },
    [routine, addedSets, notes, effortScale],
  );

  const clearDraft = useCallback(() => {
    // Bump the clear generation so a draft write already in flight cannot
    // resurrect the draft after this clear lands (the write re-asserts the
    // delete below).
    draftClearGenerationRef.current += 1;
    const startedAtMs = startedAtMsRef.current;
    if (startedAtMs === null) return;
    void clearWorkoutSessionDraft({
      routineId: routine.id,
      startedAtIso: new Date(startedAtMs).toISOString(),
    }).catch(() => {
      // A stale draft only offers a resume that re-validates the routine.
    });
  }, [routine.id]);

  // Keep the draft's phase cursor in step with every transition once the
  // timer has started (no-op before Start; harmless rewrite on resume mount).
  useEffect(() => {
    if (startedAtMsRef.current === null) return;
    void persistDraft(currentIndex);
  }, [currentIndex, persistDraft]);

  // Seed the entry fields for a newly-current active phase from the most
  // recent recorded values for that exercise (exact set number first).
  useEffect(() => {
    const phase = sequence[currentIndex];
    if (!phase || phase.phase !== 'active') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnteredSets((prev) => {
      if (prev[currentIndex]) return prev;
      const prior = lookupPreviousSet(
        previousLookup,
        phase.exerciseName,
        phase.setNumber,
        phase.catalogExerciseId,
      );
      if (!prior) return prev;
      return {
        ...prev,
        [currentIndex]: {
          weight: phase.supportsExternalLoad === false ? '' : String(prior.weight),
          reps: String(prior.reps),
        },
      };
    });
  }, [currentIndex, sequence, previousLookup]);

  // --- Live PR feedback -----------------------------------------------------
  // History per exercise is fetched once per session and cached; each
  // completed set is compared against prior sessions plus earlier sets of
  // this session so only genuine improvements are celebrated.

  const celebrationDurationMs = useMotionDuration('celebration');
  const [prNotice, setPrNotice] = useState<{ exerciseName: string; estimated1RM: number } | null>(
    null,
  );
  const prNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prHistoryCacheRef = useRef<Map<string, LoggedSet[]>>(new Map());
  const sessionWeightedSetsRef = useRef<LoggedSet[]>([]);
  // Stable across renders without touching `.current` during render.
  const [prNoticeOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!prNotice) {
      prNoticeOpacity.setValue(0);
      return;
    }
    if (celebrationDurationMs === 0) {
      prNoticeOpacity.setValue(1);
      return;
    }
    Animated.timing(prNoticeOpacity, {
      toValue: 1,
      duration: celebrationDurationMs,
      useNativeDriver: true,
    }).start();
  }, [prNotice, celebrationDurationMs, prNoticeOpacity]);

  useEffect(() => {
    return () => {
      if (prNoticeTimerRef.current) clearTimeout(prNoticeTimerRef.current);
    };
  }, []);

  const showPrNotice = useCallback((exerciseName: string, estimated1RM: number) => {
    if (prNoticeTimerRef.current) clearTimeout(prNoticeTimerRef.current);
    setPrNotice({ exerciseName, estimated1RM });
    prNoticeTimerRef.current = setTimeout(() => setPrNotice(null), PR_NOTICE_VISIBLE_MS);
  }, []);

  const dismissPrNotice = useCallback(() => {
    if (prNoticeTimerRef.current) {
      clearTimeout(prNoticeTimerRef.current);
      prNoticeTimerRef.current = null;
    }
    setPrNotice(null);
  }, []);

  const flagPersonalRecordForSet = useCallback(
    async (index: number) => {
      const phase = sequence[index];
      if (!phase || phase.phase !== 'active') return;
      const entered = enteredSetsRef.current[index];
      const weight = parseOptionalMeasurement(entered?.weight);
      const reps = parseOptionalMeasurement(entered?.reps);
      if (weight === null || reps === null || weight <= 0 || reps <= 0) return;

      let history = prHistoryCacheRef.current.get(phase.exerciseName);
      if (!history) {
        try {
          history = await listLoggedSetsForExerciseNames(
            [phase.exerciseName],
            phase.catalogExerciseId ? [phase.catalogExerciseId] : [],
          );
        } catch {
          history = [];
        }
        prHistoryCacheRef.current.set(phase.exerciseName, history);
      }

      const records = findNewPersonalRecords(
        [
          {
            exerciseName: phase.exerciseName,
            catalogExerciseId: phase.catalogExerciseId,
            weight,
            reps,
          },
        ],
        [...history, ...sessionWeightedSetsRef.current],
      );
      sessionWeightedSetsRef.current.push({
        exerciseName: phase.exerciseName,
        catalogExerciseId: phase.catalogExerciseId,
        weight,
        reps,
      });
      if (records.length === 0) return;
      showPrNotice(phase.exerciseName, estimate1RM(weight, reps));
    },
    [sequence, showPrNotice],
  );

  // Fire the live PR check when the cursor advances past a naturally
  // completed active phase (Skip marks 'skipped' before advancing).
  const lastAdvancedFromRef = useRef<number | null>(null);
  useEffect(() => {
    const from = lastAdvancedFromRef.current;
    lastAdvancedFromRef.current = currentIndex;
    if (from === null || currentIndex !== from + 1) return;
    if (dispositions[from] === 'skipped') return;
    void flagPersonalRecordForSet(from);
  }, [currentIndex, dispositions, flagPersonalRecordForSet]);

  // Reaching the summary converts the resumable DRAFT into a durable
  // PENDING-SAVE recovery state (AUD-SH04-A/B).
  //
  // ORDERING IS THE CONTRACT. `AUD-SH04-B` caught the first attempt at this:
  // the pending-save write was fired without awaiting, its rejection was
  // swallowed by `.catch()`, and `clearDraft()` then ran unconditionally — so a
  // failed write plus the cleared draft left the device with NEITHER durable
  // recovery record. The transition must be acknowledged before the old record
  // is retired: write first, clear only on a reported success, and otherwise
  // keep the draft exactly as it is.
  useEffect(() => {
    if (!isComplete) return;
    const startedAtMs = startedAtMsRef.current;
    if (startedAtMs === null) return;
    let cancelled = false;
    const preserveRecovery = async () => {
      const pendingDispositions = Object.fromEntries(
        Object.entries(dispositionsRef.current).map(([index, disposition]) => [
          String(index),
          disposition,
        ]),
      );
      const pendingEnteredSets = Object.fromEntries(
        Object.entries(enteredSetsRef.current).map(([index, values]) => [String(index), values]),
      );
      const pendingAddedSets = Object.fromEntries(
        Object.entries(addedSets).map(([index, count]) => [String(index), count]),
      );
      try {
        await saveWorkoutPendingSave({
          routineId: routine.id,
          // Retain the complete performed structure. Names alone cannot map
          // positional measurements after same-name exercises are reordered.
          routineName: routine.name,
          routineSnapshot: routine,
          notes,
          effortScale,
          exerciseNames: sequence.map((phase) => phase.exerciseName),
          startedAtIso: new Date(startedAtMs).toISOString(),
          phaseIndex: currentIndexRef.current,
          elapsedSeconds: Math.max(0, elapsedSecondsRef.current),
          enteredSets: pendingEnteredSets,
          dispositions: pendingDispositions,
          ...(Object.keys(pendingAddedSets).length > 0 ? { addedSets: pendingAddedSets } : {}),
        });
      } catch {
        // The recovery payload could NOT be written. Keep the resumable draft:
        // retiring it here is exactly the audited data loss.
        return;
      }
      if (cancelled) return;
      // Acknowledged replacement: the durable recovery state now exists, so the
      // draft has no phase left to continue and may be retired.
      clearDraft();
    };
    void preserveRecovery();
    return () => {
      cancelled = true;
    };
  }, [isComplete, clearDraft, routine, sequence, addedSets, notes, effortScale]);

  const updateEnteredValues = (index: number, patch: Partial<EnteredSetValues>) => {
    setEnteredSets((prev) => {
      const current = prev[index] ?? { weight: '', reps: '' };
      return { ...prev, [index]: { ...current, ...patch } };
    });
  };

  // Measurements are user-authored session state. Persist them after the
  // render settles so a background kill does not discard the last edit, while
  // avoiding a database write on every countdown tick.
  useEffect(() => {
    if (startedAtMsRef.current === null || isComplete) return;
    const id = setTimeout(() => {
      void persistDraft(currentIndexRef.current);
    }, 250);
    return () => clearTimeout(id);
  }, [enteredSets, isComplete, persistDraft]);

  useEffect(() => {
    if (!isRunning || isComplete) return;
    const id = setInterval(() => {
      setElapsedSeconds((e) => e + 1);
      // The countdown updater is pure (decrement/clamp only): React may
      // invoke an updater twice (StrictMode / concurrent retry), so phase
      // advancement must never run inside one — the second call would see
      // the advanced index ref and skip a whole phase (bughunt31 F1).
      // tickCountdown applies the on-zero advancement exactly once per tick.
      tickCountdown({
        remaining: remainingRef,
        setRemaining,
        getCurrentIndex: () => currentIndexRef.current,
        getSequence: () => sequence,
        onPhaseExpired: (outcome) => {
          const finishedIndex = outcome.finishedIndex;
          // Weighted and bodyweight strength sets are manual logging events
          // (pause-at-zero): a configured active duration is a pacing aid,
          // never an auto-confirmed result. Timed/cardio auto-enter target.
          if (outcome.kind === 'pause-at-zero') {
            setIsRunning(false);
            return;
          }
          const autoDurationSeconds = outcome.autoEnterDurationSeconds;
          if (autoDurationSeconds !== undefined) {
            setEnteredSets((values) => ({
              ...values,
              [finishedIndex]: {
                ...(values[finishedIndex] ?? { weight: '', reps: '' }),
                duration: String(autoDurationSeconds),
              },
            }));
          }
          setDispositions((d) => ({ ...d, [finishedIndex]: 'completed' }));
          if (outcome.kind === 'finish-session') {
            setIsRunning(false);
            setIsComplete(true);
            return;
          }
          setCurrentIndex(outcome.nextIndex);
          currentIndexRef.current = outcome.nextIndex;
        },
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, isComplete, sequence]);

  const handleStart = () => {
    if (startedAtMsRef.current === null) startedAtMsRef.current = Date.now();
    // Durability readiness contract: the running state (which is what makes
    // the session resumable after a reload) is presented only after the
    // resume draft has been written. A reload that lands before this write
    // commits used to destroy the session record while the UI already
    // promised it was in progress — the exact durability defect exercised by
    // e2e/workout-gym-v2.spec.ts ("resumes an interrupted guided session").
    // Failed writes stay best-effort (session starts anyway) but the user's
    // measurements are re-persisted on every later edit/transition.
    void persistDraft(currentIndexRef.current).finally(() => {
      setIsRunning(true);
    });
  };

  const phaseRunsOnTimer = (phase: TimerPhase | undefined): boolean =>
    phase?.phase === 'rest' ||
    phase?.modality === undefined ||
    phase?.modality === 'timed' ||
    phase?.modality === 'cardio';

  const advanceFromCurrent = (disposition: PhaseDisposition) => {
    const finishedIndex = currentIndexRef.current;
    setDispositions((d) => ({ ...d, [finishedIndex]: disposition }));
    let nextIndex = finishedIndex + 1;
    // Defensive: zero-duration rests are omitted at build time (0 = no rest),
    // so this only guards legacy sequences that still contain one.
    while (nextIndex < sequence.length) {
      const phase = sequence[nextIndex];
      if (phase.phase !== 'rest' || phase.durationSeconds > 0) break;
      nextIndex += 1;
    }
    if (nextIndex >= sequence.length) {
      setIsRunning(false);
      setIsComplete(true);
      return;
    }
    setCurrentIndex(nextIndex);
    currentIndexRef.current = nextIndex;
    setRemaining(sequence[nextIndex].durationSeconds);
    remainingRef.current = sequence[nextIndex].durationSeconds;
    setIsRunning(phaseRunsOnTimer(sequence[nextIndex]));
  };

  const handleSkip = () => {
    advanceFromCurrent('skipped');
  };

  const handleCompleteSet = () => {
    if (currentPhase?.phase !== 'active') return;
    if (startedAtMsRef.current === null) startedAtMsRef.current = Date.now();
    if (currentPhase.modality === 'timed' || currentPhase.modality === 'cardio') {
      const existingDuration = parseOptionalMeasurement(
        enteredSetsRef.current[currentIndexRef.current]?.duration,
      );
      if (existingDuration === null) {
        const elapsedInPhase = isRunning
          ? Math.max(0, currentPhase.durationSeconds - remainingRef.current)
          : 0;
        if (elapsedInPhase <= 0) return;
        setEnteredSets((values) => ({
          ...values,
          [currentIndexRef.current]: {
            ...(values[currentIndexRef.current] ?? { weight: '', reps: '' }),
            duration: String(Math.round(elapsedInPhase)),
          },
        }));
      }
    }
    advanceFromCurrent('completed');
  };

  /**
   * Persist the durable pending-save recovery state (`AUD-SH04-B`).
   *
   * Called BEFORE every save attempt and again on failure, so the recovery
   * payload is never older than the summary the user is looking at. A failed or
   * skipped save therefore retains every entered value through a restart.
   *
   * @param lastError optional user-facing failure reason to record
   */
  const persistPendingSave = useCallback(
    async (lastError?: string) => {
      const startedAtMs = startedAtMsRef.current;
      if (startedAtMs === null) return;
      await saveWorkoutPendingSave({
        routineId: routine.id,
        // `AUD-SH09-A` (review finding 2): the performed identity snapshot.
        routineName: routine.name,
        routineSnapshot: routine,
        notes,
        effortScale,
        exerciseNames: sequence.map((phase) => phase.exerciseName),
        startedAtIso: new Date(startedAtMs).toISOString(),
        // The live cursor, so a reopened summary re-collects every exercise the
        // user actually completed (AUD-SH04-A).
        phaseIndex: currentIndexRef.current,
        elapsedSeconds: Math.max(0, elapsedSecondsRef.current),
        enteredSets: Object.fromEntries(
          Object.entries(enteredSetsRef.current).map(([index, values]) => [String(index), values]),
        ),
        dispositions: Object.fromEntries(
          Object.entries(dispositionsRef.current).map(([index, disposition]) => [
            String(index),
            disposition,
          ]),
        ),
        ...(Object.keys(addedSets).length > 0 ? { addedSets } : {}),
        ...(lastError ? { lastError } : {}),
      });
    },
    [routine, sequence, addedSets, notes, effortScale],
  );

  const handleFinish = async () => {
    if (!finishGuardRef.current.tryStart()) return;
    setIsRunning(false);
    setIsSaving(true);
    try {
      const endedAtMs = Date.now();
      const startedAtMs = startedAtMsRef.current;
      // Re-assert the recovery payload before the write so a stale or missing
      // pending state cannot cost the user their summary.
      await persistPendingSave();
      const records = collectSessionSetRecords(
        sequence,
        currentIndex,
        dispositions,
        enteredSets,
        effortScale,
      );
      const summary = summarizeCompletedSets(sequence, currentIndex, dispositions);

      // Compare against PRIOR sessions only — queried before this log is
      // inserted, so the current session is excluded by construction.
      const weightedRecords = records.filter(
        (r): r is typeof r & { weight: number; reps: number } =>
          r.completed && r.weight !== null && r.reps !== null,
      );
      let newRecords: string[] = [];
      if (weightedRecords.length > 0) {
        const names = Array.from(new Set(weightedRecords.map((r) => r.exerciseName)));
        const catalogExerciseIds = Array.from(
          new Set(
            weightedRecords
              .map((r) => r.catalogExerciseId)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        const historySets = await listLoggedSetsForExerciseNames(names, catalogExerciseIds);
        const sessionSets: LoggedSet[] = weightedRecords.map((r) => ({
          exerciseName: r.exerciseName,
          catalogExerciseId: r.catalogExerciseId,
          modality: r.modality,
          weight: r.weight,
          reps: r.reps,
        }));
        newRecords = findNewPersonalRecords(sessionSets, historySets);
      }

      const logResult = await logWorkoutSession({
        routineId: routine.id,
        notes: notes.trim() ? notes.trim() : undefined,
        exercises: buildSessionLogExercises(routine, summary, records, weightUnit),
        startedAt: startedAtMs !== null ? new Date(startedAtMs).toISOString() : null,
        endedAt: new Date(endedAtMs).toISOString(),
        // Resumed sessions log active time, not wall-clock: the gap between the
        // original start and the restart must not count as workout minutes.
        ...(resume ? { activeDurationSeconds: Math.max(0, elapsedSecondsRef.current) } : {}),
      });

      // The durable commit decides saved-vs-not-saved: `logWorkoutSession`
      // can return `skipped` WITHOUT throwing (e.g. its routine was
      // soft-deleted mid-session), so success requires BOTH an applied
      // status and the committed log id. Anything else fails closed.
      const save = resolveSessionSave(logResult);
      if (save.saved && save.logId) {
        // Post-commit bookkeeping is secondary: the workout is already
        // durable, so a failure here must not rewrite a committed save into
        // a false "not saved" and must never invite a second insert.
        let bookkeepingFailed = false;
        try {
          clearDraft();
          // AUD-SH04-C: only a COMMITTED log clears the recovery state. A kill
          // between the log commit and this line leaves the pending-save state
          // intact, so the next mount reconciles against the committed log
          // instead of inventing a duplicate (see the resume path).
          if (startedAtMs !== null) {
            await clearWorkoutPendingSave({
              routineId: routine.id,
              startedAtIso: new Date(startedAtMs).toISOString(),
            });
          }
          // Reward after the log is durable, attributed to THIS log id:
          // without it the award would fall back to the oldest unrewarded
          // log instead.
          recordAction('workout', save.logId);
        } catch {
          bookkeepingFailed = true;
        }
        setSaveError(null);
        setSavedOutcome({ newRecords, bookkeepingFailed });
      } else {
        // Not saved: the session and every entered value stay exactly as they
        // are, and the durable recovery state records the real cause so an
        // honest message survives a restart.
        setSavedOutcome(null);
        setSaveError(save.message);
        await persistPendingSave(save.message ?? undefined);
      }
    } catch {
      // Truthful failure: the session stays and the recovery payload is
      // re-persisted, so the user can retry — even after a restart.
      setSaveError('This workout could not be saved. Your progress is still here — try again.');
      await persistPendingSave(
        'This workout could not be saved. Your progress is still here — try again.',
      ).catch(() => {
        // Keep the live summary and any earlier durable draft when storage is unavailable.
      });
    } finally {
      finishGuardRef.current.finish();
      setIsSaving(false);
    }
  };

  const handleAdjustRemaining = (delta: number) => {
    remainingRef.current = Math.max(1, remainingRef.current + delta);
    setRemaining((prev) => Math.max(1, prev + delta));
  };

  const handleCancel = async () => {
    // Leaving keeps the draft: the landing offers a dominant Resume. Nothing
    // is logged, and discarding is the landing's separate confirmed path.
    // The shared confirmation primitive renders real buttons on web and
    // native, so the paired actions always exist.
    const leave = await confirm({
      title: 'Leave workout?',
      message:
        'Your entered sets are saved as a draft you can resume from the Workout tab. Nothing is logged until you finish.',
      confirmLabel: 'Leave',
      cancelLabel: 'Keep going',
    });
    if (!leave) return;
    setIsRunning(false);
    if (isComplete) {
      try {
        await persistPendingSave();
      } catch {
        setSaveError(
          'Your finished workout could not be kept for recovery. Stay here and try again.',
        );
        return;
      }
    } else {
      void persistDraft(currentIndexRef.current);
    }
    onCancel();
  };

  const finishProgress = buildSessionProgress(sequence, dispositions, currentIndex);
  const skippedCount = finishProgress.skippedSets;

  if (isComplete && savedOutcome) {
    const summary = summarizeCompletedSets(sequence, currentIndex, dispositions);
    const totalSets = computeSessionTotalSets(summary);
    const totalVolume = computeSessionTotalVolume(
      collectSessionSetRecords(sequence, currentIndex, dispositions, enteredSets, effortScale),
    );
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <Card accentColor={WORKOUT_COLOR}>
            <View className="items-center gap-4 py-4">
              <Text className="text-4xl">🎉</Text>
              <Text className="text-center text-2xl font-semibold" style={{ color: tokens.text }}>
                Workout saved
              </Text>
              <Text className="text-center text-sm" style={{ color: tokens.textMuted }}>
                {routine.name} is in your history.
              </Text>
              <View className="flex-row gap-6">
                <View className="items-center">
                  <Text className="text-lg font-semibold" style={{ color: tokens.text }}>
                    {formatWorkoutTime(elapsedSeconds)}
                  </Text>
                  <Text className="text-xs" style={{ color: tokens.textMuted }}>
                    Duration
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-lg font-semibold" style={{ color: tokens.text }}>
                    {totalSets}
                  </Text>
                  <Text className="text-xs" style={{ color: tokens.textMuted }}>
                    Sets done
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-lg font-semibold" style={{ color: tokens.text }}>
                    {summary.length}
                  </Text>
                  <Text className="text-xs" style={{ color: tokens.textMuted }}>
                    Exercises
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-lg font-semibold" style={{ color: tokens.text }}>
                    {formatMetricNumber(totalVolume)}
                  </Text>
                  <Text className="text-xs" style={{ color: tokens.textMuted }}>
                    Volume
                  </Text>
                </View>
              </View>
              {finishProgress.skippedSets > 0 ? (
                <Text className="text-sm" style={{ color: tokens.textMuted }}>
                  {finishProgress.skippedSets} set{finishProgress.skippedSets === 1 ? '' : 's'}{' '}
                  skipped
                </Text>
              ) : null}
              {savedOutcome.bookkeepingFailed ? (
                // Honest secondary note: the log is durable; only the
                // post-commit bookkeeping did not finish. The user is never
                // invited to insert a second workout.
                <Text
                  className="text-sm"
                  style={{ color: tokens.textMuted }}
                  accessibilityLiveRegion="polite"
                >
                  Your workout is saved. Some cleanup after saving didn&apos;t finish — nothing more
                  is needed.
                </Text>
              ) : null}
              {savedOutcome.newRecords.length > 0 ? (
                <View
                  className="w-full rounded-2xl border px-4 py-3"
                  style={{
                    borderColor: `${WORKOUT_COLOR}33`,
                    backgroundColor: `${WORKOUT_COLOR}14`,
                  }}
                >
                  <Text className="text-sm font-semibold" style={{ color: WORKOUT_COLOR }}>
                    🏆 New personal records
                  </Text>
                  {savedOutcome.newRecords.map((name) => (
                    <Text key={name} className="mt-1 text-sm" style={{ color: tokens.text }}>
                      {name}
                    </Text>
                  ))}
                </View>
              ) : null}
              <View className="w-full">
                <Button label="Done" onPress={onFinish} color={WORKOUT_COLOR} />
              </View>
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  if (isComplete) {
    const summary = summarizeCompletedSets(sequence, currentIndex, dispositions);
    const totalSets = computeSessionTotalSets(summary);
    const totalVolume = computeSessionTotalVolume(
      collectSessionSetRecords(sequence, currentIndex, dispositions, enteredSets, effortScale),
    );
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <Card accentColor={WORKOUT_COLOR}>
            <View className="items-center gap-4 py-4">
              <Text className="text-4xl">🎉</Text>
              <Text className="text-center text-2xl font-semibold" style={{ color: tokens.text }}>
                Workout complete!
              </Text>
              <Text className="text-center text-sm" style={{ color: tokens.textMuted }}>
                {routine.name} is done. Save this session to update your history.
              </Text>
              <View className="flex-row gap-6">
                <View className="items-center">
                  <Text className="text-lg font-semibold" style={{ color: tokens.text }}>
                    {formatWorkoutTime(elapsedSeconds)}
                  </Text>
                  <Text className="text-xs" style={{ color: tokens.textMuted }}>
                    Duration
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-lg font-semibold" style={{ color: tokens.text }}>
                    {totalSets}
                  </Text>
                  <Text className="text-xs" style={{ color: tokens.textMuted }}>
                    Sets done
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-lg font-semibold" style={{ color: tokens.text }}>
                    {summary.length}
                  </Text>
                  <Text className="text-xs" style={{ color: tokens.textMuted }}>
                    Exercises
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-lg font-semibold" style={{ color: tokens.text }}>
                    {formatMetricNumber(totalVolume)}
                  </Text>
                  <Text className="text-xs" style={{ color: tokens.textMuted }}>
                    Volume
                  </Text>
                </View>
              </View>
              {skippedCount > 0 ? (
                <Text className="text-sm" style={{ color: tokens.textMuted }}>
                  {skippedCount} set{skippedCount === 1 ? '' : 's'} skipped
                </Text>
              ) : null}
              {saveError ? (
                <View
                  className="w-full rounded-2xl border px-4 py-3"
                  style={{
                    borderColor: `${tokens.dangerSolid}55`,
                    backgroundColor: `${tokens.dangerSolid}12`,
                  }}
                  accessibilityLiveRegion="polite"
                >
                  <Text className="text-sm font-semibold" style={{ color: tokens.dangerText }}>
                    Not saved
                  </Text>
                  <Text className="mt-1 text-sm" style={{ color: tokens.text }}>
                    {saveError}
                  </Text>
                </View>
              ) : null}
              <View className="w-full">
                <TextField
                  label="Notes (optional)"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="How did it go?"
                />
              </View>
              <View className="w-full">
                <Button
                  label={isSaving ? 'Saving…' : saveError ? 'Try saving again' : 'Save and finish'}
                  onPress={() => {
                    setSaveError(null);
                    void handleFinish();
                  }}
                  color={WORKOUT_COLOR}
                  loading={isSaving}
                />
              </View>
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  if (!currentPhase || sequence.length === 0) {
    return (
      <Screen scroll>
        <ScreenSection className="flex-1 justify-center">
          <EmptyStateCard
            accentColor={WORKOUT_COLOR}
            title="No exercises in this routine"
            description="Add at least one exercise before starting the workout timer."
            icon={<Text style={{ fontSize: 24 }}>🏋️</Text>}
          />
        </ScreenSection>
        <ScreenSection className="mb-0">
          <Button label="Back" variant="ghost" onPress={onCancel} />
        </ScreenSection>
      </Screen>
    );
  }

  const isActive = currentPhase.phase === 'active';
  // The set-logging-first view model: accurate progress plus one row per
  // prescribed set of the current exercise. The engine cursor still decides
  // which row is actionable — completed and skipped rows are read-only.
  const sessionProgress = buildSessionProgress(sequence, dispositions, currentIndex);
  const setRows = buildExerciseSetRows(
    sequence,
    currentPhase.exerciseIndex,
    dispositions,
    enteredSets,
    currentIndex,
    previousLookup,
  );
  const actionableRow = setRows.find((row) => row.state === 'current') ?? null;
  const nextActivePhase = sequence
    .slice(currentIndex + 1)
    .find((phase) => phase.phase === 'active');
  const previousRestPhase = sequence
    .slice(0, currentIndex)
    .reverse()
    .find((phase) => phase.phase === 'rest');
  void previousRestPhase;

  // The modality readouts below describe the actionable set while one exists,
  // and the upcoming set while resting, so the table never shows stale context.
  const descriptorPhase = actionableRow?.phase ?? nextActivePhase ?? currentPhase;
  const isLegacyFreeText = descriptorPhase.modality === undefined;
  const isLoadBased =
    isLegacyFreeText ||
    descriptorPhase.modality === 'weighted_strength' ||
    descriptorPhase.modality === 'bodyweight';
  const isCardio = descriptorPhase.modality === 'cardio';
  const allowsExternalLoad = descriptorPhase.supportsExternalLoad !== false;
  const targetText = isLoadBased
    ? [
        descriptorPhase.targetLoad != null ? `target ${descriptorPhase.targetLoad} kg` : null,
        descriptorPhase.targetRepsMin != null || descriptorPhase.targetRepsMax != null
          ? `${descriptorPhase.targetRepsMin ?? descriptorPhase.targetRepsMax}–${descriptorPhase.targetRepsMax ?? descriptorPhase.targetRepsMin} reps`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : isCardio
      ? [
          `target ${formatWorkoutTime(descriptorPhase.durationSeconds)}`,
          descriptorPhase.targetDistance != null
            ? `${descriptorPhase.targetDistance} distance`
            : null,
          descriptorPhase.targetPace != null ? `${descriptorPhase.targetPace} pace` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : `target ${formatWorkoutTime(descriptorPhase.durationSeconds)}`;
  const progressionGuidance = progressionRecommendation ? (
    <View
      className="mt-3 rounded-xl border px-3 py-2"
      style={{
        borderColor: `${WORKOUT_COLOR}55`,
        backgroundColor: `${WORKOUT_COLOR}12`,
      }}
    >
      <Text className="text-xs font-semibold" style={{ color: WORKOUT_COLOR }}>
        Progression guidance
      </Text>
      <Text className="mt-1 text-xs" style={{ color: tokens.text }}>
        {progressionRecommendation.explanation}
      </Text>
    </View>
  ) : null;

  /** Per-modality inputs for the actionable set row. */
  const renderSetInputs = (row: SetRow) => {
    const phase = row.phase;
    const rowIsBodyweight = phase.modality === 'bodyweight';
    const rowAllowsExternalLoad = phase.supportsExternalLoad !== false;
    const rowIsLoadBased =
      phase.modality === undefined ||
      phase.modality === 'weighted_strength' ||
      phase.modality === 'bodyweight';
    const rowIsCardio = phase.modality === 'cardio';
    if (rowIsLoadBased) {
      return (
        <View className="min-w-0 flex-1 flex-row items-end gap-2">
          {rowAllowsExternalLoad ? (
            <View className="min-w-0 flex-1">
              <Text className="mb-1 text-[11px] font-medium" style={{ color: tokens.textMuted }}>
                {rowIsBodyweight ? 'Added load' : 'Weight'}
              </Text>
              <TextInput
                accessibilityLabel={rowIsBodyweight ? 'Additional load input' : 'Weight'}
                className="rounded-xl border px-3 py-2 text-center text-base"
                style={{
                  height: 48,
                  borderColor: tokens.border,
                  backgroundColor: tokens.surfaceElevated,
                  color: tokens.text,
                }}
                value={row.entered.weight}
                onChangeText={(t) =>
                  updateEnteredValues(row.phaseIndex, {
                    weight: sanitizeNumericInput(t, { allowDecimal: true }),
                  })
                }
                placeholder={rowIsBodyweight ? 'optional' : 'e.g. 60'}
                placeholderTextColor={tokens.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          ) : null}
          <View className={rowAllowsExternalLoad ? 'min-w-0 flex-1' : 'min-w-0 w-full'}>
            <NumberStepperField
              label={phase.unilateral ? 'Reps / side' : 'Reps'}
              inputAccessibilityLabel={phase.unilateral ? 'Reps / side input' : 'Reps'}
              value={row.entered.reps}
              onChange={(v) => updateEnteredValues(row.phaseIndex, { reps: v })}
              min={1}
              max={200}
              placeholder="—"
            />
          </View>
        </View>
      );
    }
    if (rowIsCardio) {
      return (
        <View className="min-w-0 flex-1 gap-2">
          <NumberStepperField
            label="Duration (seconds)"
            value={row.entered.duration ?? ''}
            onChange={(value) => updateEnteredValues(row.phaseIndex, { duration: value })}
            min={1}
            max={86400}
            placeholder={String(Math.round(phase.durationSeconds))}
          />
          <View className="flex-row gap-2">
            <View className="min-w-0 flex-1">
              <TextInput
                accessibilityLabel="Distance"
                className="rounded-xl border px-3 py-2 text-base"
                style={{
                  height: 48,
                  borderColor: tokens.border,
                  backgroundColor: tokens.surfaceElevated,
                  color: tokens.text,
                }}
                value={row.entered.distance ?? ''}
                onChangeText={(value) =>
                  updateEnteredValues(row.phaseIndex, {
                    distance: sanitizeNumericInput(value, { allowDecimal: true }),
                  })
                }
                placeholder="Distance"
                placeholderTextColor={tokens.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="min-w-0 flex-1">
              <TextInput
                accessibilityLabel="Pace"
                className="rounded-xl border px-3 py-2 text-base"
                style={{
                  height: 48,
                  borderColor: tokens.border,
                  backgroundColor: tokens.surfaceElevated,
                  color: tokens.text,
                }}
                value={row.entered.pace ?? ''}
                onChangeText={(value) =>
                  updateEnteredValues(row.phaseIndex, {
                    pace: sanitizeNumericInput(value, { allowDecimal: true }),
                  })
                }
                placeholder="Pace / speed"
                placeholderTextColor={tokens.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>
      );
    }
    return (
      <View className="min-w-0 flex-1">
        <NumberStepperField
          label="Duration (seconds)"
          value={row.entered.duration ?? ''}
          onChange={(value) => updateEnteredValues(row.phaseIndex, { duration: value })}
          min={1}
          max={86400}
          placeholder={String(Math.round(phase.durationSeconds))}
        />
      </View>
    );
  };

  /** Read-only display of a recorded set row. */
  const renderRecordedSet = (row: SetRow) => {
    const parts: string[] = [];
    if (row.entered.weight) parts.push(`${row.entered.weight} kg`);
    if (row.entered.reps)
      parts.push(`${row.entered.reps}${row.phase.unilateral ? '/side' : ''} reps`);
    if (row.entered.duration) parts.push(`${row.entered.duration}s`);
    if (row.entered.distance) parts.push(`${row.entered.distance} dist`);
    if (row.entered.pace) parts.push(`${row.entered.pace} pace`);
    return (
      <Text className="min-w-0 flex-1 text-sm" style={{ color: tokens.text }} numberOfLines={2}>
        {parts.length > 0 ? parts.join(' · ') : '—'}
      </Text>
    );
  };

  const previousText = (row: SetRow) =>
    row.previous
      ? allowsExternalLoad
        ? `${row.previous.weight}×${row.previous.reps}`
        : `${row.previous.reps} reps`
      : '—';

  const progressLabel = `${sessionProgress.completedSets}/${sessionProgress.totalPrescribedSets} sets`;
  const skippedLabel =
    sessionProgress.skippedSets > 0 ? ` · ${sessionProgress.skippedSets} skipped` : '';

  return (
    <Screen>
      {confirmationDialog}
      <View className="mb-3 flex-row items-center justify-between gap-2">
        <Pressable
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="End workout"
          hitSlop={8}
        >
          <Text className="text-sm" style={{ color: tokens.textMuted }}>
            End
          </Text>
        </Pressable>
        <Text
          className="min-w-0 flex-1 text-center text-sm"
          style={{ color: tokens.textMuted }}
          numberOfLines={1}
        >
          {routine.name}
        </Text>
        <Text className="text-xs" style={{ color: tokens.iconMuted }}>
          {formatWorkoutTime(elapsedSeconds)}
        </Text>
      </View>

      <View className="mb-3 flex-row items-center justify-center gap-2">
        <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
          {progressLabel}
        </Text>
        <Text className="text-xs" style={{ color: tokens.textMuted }}>
          {skippedLabel}
        </Text>
      </View>

      {prNotice ? (
        <Animated.View
          className="mb-3"
          style={{ opacity: prNoticeOpacity }}
          accessibilityLiveRegion="polite"
        >
          <View
            className="flex-row items-center gap-3 rounded-2xl border px-4 py-3"
            style={{
              backgroundColor: tokens.successBackground,
              borderColor: tokens.successBorder,
            }}
          >
            <MaterialIcons name="emoji-events" size={20} color={tokens.successText} />
            <Text
              className="min-w-0 flex-1 text-sm font-semibold"
              style={{ color: tokens.successText }}
              numberOfLines={2}
            >
              {`PR! ${prNotice.exerciseName} · est. ${formatMetricNumber(prNotice.estimated1RM)} kg`}
            </Text>
            <Pressable
              onPress={dismissPrNotice}
              accessibilityRole="button"
              accessibilityLabel="Dismiss personal record notice"
              hitSlop={8}
            >
              <MaterialIcons name="close" size={18} color={tokens.successText} />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      <Card accentColor={WORKOUT_COLOR}>
        <View className="flex-row items-center justify-between gap-2">
          <Text
            className="min-w-0 flex-1 text-lg font-semibold"
            style={{ color: tokens.text }}
            numberOfLines={2}
          >
            {descriptorPhase.exerciseName}
          </Text>
          {descriptorPhase.totalSets > 0 ? (
            <Text className="text-xs" style={{ color: tokens.textMuted }}>
              {`Set ${descriptorPhase.setNumber} of ${descriptorPhase.totalSets}`}
            </Text>
          ) : null}
        </View>
        <Text className="mt-1 text-xs" style={{ color: WORKOUT_COLOR }}>
          {isLegacyFreeText ? 'Legacy strength entry' : descriptorPhase.modality?.replace('_', ' ')}{' '}
          · {targetText}
        </Text>
        <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
          {descriptorPhase.unilateral ? 'Reps are recorded per side' : 'Previous set shown per row'}
        </Text>

        <View className="mt-3">
          <View className="flex-row items-center gap-2 pb-1">
            <Text
              className="text-[11px] font-semibold uppercase"
              style={{ color: tokens.textMuted, width: 32 }}
            >
              Set
            </Text>
            <Text
              className="min-w-0 flex-1 text-[11px] font-semibold uppercase"
              style={{ color: tokens.textMuted }}
            >
              {isLoadBased
                ? 'Previous · Log this set'
                : isCardio
                  ? 'Previous · Duration · Distance'
                  : 'Previous · Duration'}
            </Text>
            <Text
              className="w-11 text-center text-[11px] font-semibold uppercase"
              style={{ color: tokens.textMuted }}
            >
              Done
            </Text>
          </View>
          {setRows.map((row) => {
            const isCurrent = row.state === 'current';
            return (
              <View
                key={row.phaseIndex}
                className="flex-row items-center gap-2 border-t py-2"
                style={{
                  borderTopColor: tokens.border,
                  backgroundColor: isCurrent ? `${WORKOUT_COLOR}0D` : 'transparent',
                  borderRadius: isCurrent ? 12 : 0,
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{
                    width: 32,
                    color:
                      row.state === 'skipped' || row.state === 'upcoming'
                        ? tokens.textMuted
                        : tokens.text,
                  }}
                >
                  {row.setNumber}
                </Text>
                <View className="min-w-0 flex-1">
                  <Text className="text-[11px]" style={{ color: tokens.textMuted }}>
                    {previousText(row)}
                  </Text>
                  {row.state === 'upcoming' ? (
                    <Text className="text-sm" style={{ color: tokens.textMuted }}>
                      —
                    </Text>
                  ) : row.state === 'current' ? (
                    renderSetInputs(row)
                  ) : (
                    renderRecordedSet(row)
                  )}
                </View>
                {row.state === 'completed' ? (
                  <View className="w-11 items-center">
                    <MaterialIcons name="check-circle" size={22} color={tokens.successText} />
                    <Text
                      className="text-[9px] font-semibold uppercase"
                      style={{ color: tokens.successText }}
                    >
                      Done
                    </Text>
                  </View>
                ) : row.state === 'skipped' ? (
                  <View className="w-11 items-center">
                    <MaterialIcons
                      name="remove-circle-outline"
                      size={22}
                      color={tokens.textMuted}
                    />
                    <Text
                      className="text-[9px] font-semibold uppercase"
                      style={{ color: tokens.textMuted }}
                    >
                      Skip
                    </Text>
                  </View>
                ) : row.state === 'current' ? (
                  <Pressable
                    onPress={handleCompleteSet}
                    accessibilityRole="button"
                    accessibilityLabel={`Complete set ${row.setNumber}`}
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: WORKOUT_COLOR,
                    }}
                  >
                    <MaterialIcons name="check" size={22} color={tokens.textOnAccent} />
                  </Pressable>
                ) : (
                  <View className="w-11 items-center">
                    <View
                      className="rounded-full border"
                      style={{ width: 22, height: 22, borderColor: tokens.border }}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {effortScale !== 'off' && actionableRow ? (
          <View className="mt-3">
            <NumberStepperField
              label={effortScale === 'rir' ? 'RIR (reps in reserve)' : 'RPE (1–10)'}
              value={actionableRow.entered.effort ?? ''}
              onChange={(value) => updateEnteredValues(actionableRow.phaseIndex, { effort: value })}
              min={effortScale === 'rir' ? 0 : 1}
              max={10}
              placeholder="—"
            />
          </View>
        ) : null}

        {progressionGuidance}

        <View className="mt-4 flex-row flex-wrap items-center gap-2">
          {!isRunning ? <Button label="Start" onPress={handleStart} color={WORKOUT_COLOR} /> : null}
          {isActive ? (
            <Button
              label="Skip set"
              variant="ghost"
              onPress={handleSkip}
              accessibilityLabel="Skip set"
            />
          ) : null}
          {canAddSet ? (
            <Button
              label="Add set"
              variant="ghost"
              onPress={handleAddSet}
              accessibilityLabel="Add set"
            />
          ) : null}
        </View>

        {isRunning && isActive && actionableRow ? (
          <Text className="mt-3 text-center text-xs" style={{ color: tokens.textMuted }}>
            {phaseRunsOnTimer(actionableRow.phase)
              ? `Work timer ${formatWorkoutTime(remaining)}`
              : `Work timer ${formatWorkoutTime(remaining)} · pacing aid — complete the set when done`}
          </Text>
        ) : null}
      </Card>

      {!isActive ? (
        <View
          className="mt-3 rounded-2xl border px-4 py-3"
          style={{
            borderColor: `${WORKOUT_COLOR}55`,
            backgroundColor: tokens.surfaceElevated,
          }}
          accessibilityLiveRegion="polite"
        >
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-xs font-semibold uppercase" style={{ color: WORKOUT_COLOR }}>
                Rest
              </Text>
              <Text className="mt-0.5 text-2xl font-semibold" style={{ color: tokens.text }}>
                {formatWorkoutTime(remaining)}
              </Text>
              <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
                {nextActivePhase
                  ? `Next: ${nextActivePhase.exerciseName} — Set ${nextActivePhase.setNumber} of ${nextActivePhase.totalSets}`
                  : 'Next: finish'}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => handleAdjustRemaining(-REST_SECONDS_STEP)}
                accessibilityRole="button"
                accessibilityLabel={`Reduce rest by ${REST_SECONDS_STEP} seconds`}
                className="items-center justify-center rounded-full"
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tokens.surface,
                  borderWidth: 1,
                  borderColor: tokens.border,
                }}
              >
                <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                  −{REST_SECONDS_STEP}s
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleAdjustRemaining(REST_SECONDS_STEP)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${REST_SECONDS_STEP} seconds of rest`}
                className="items-center justify-center rounded-full"
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tokens.surface,
                  borderWidth: 1,
                  borderColor: tokens.border,
                }}
              >
                <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                  +{REST_SECONDS_STEP}s
                </Text>
              </Pressable>
              <Button
                label="Skip rest"
                variant="ghost"
                onPress={handleSkip}
                accessibilityLabel="Skip rest"
              />
            </View>
          </View>
        </View>
      ) : null}

      <View className="mt-3 flex-row items-center justify-center gap-3">
        <Text className="text-xs" style={{ color: tokens.textMuted }}>
          Default for new sets: {restDefault === null ? '…' : `${restDefault}s`}
        </Text>
        <Pressable
          onPress={() => handleAdjustRestDefault(-REST_SECONDS_STEP)}
          accessibilityRole="button"
          accessibilityLabel={`Decrease default rest to at least ${REST_SECONDS_MIN} seconds`}
          hitSlop={8}
        >
          <Text className="text-sm font-semibold text-workout">−</Text>
        </Pressable>
        <Pressable
          onPress={() => handleAdjustRestDefault(REST_SECONDS_STEP)}
          accessibilityRole="button"
          accessibilityLabel={`Increase default rest up to ${REST_SECONDS_MAX} seconds`}
          hitSlop={8}
        >
          <Text className="text-sm font-semibold text-workout">+</Text>
        </Pressable>
      </View>
      {restDefault !== null &&
      persistedRestDefault !== null &&
      restDefault !== persistedRestDefault ? (
        <Pressable
          onPress={handlePersistRestDefault}
          accessibilityRole="button"
          accessibilityLabel="Save default rest for future workouts"
          className="self-center"
          hitSlop={8}
        >
          <Text className="mt-2 text-xs font-semibold text-workout">
            Save as default for future workouts
          </Text>
        </Pressable>
      ) : null}
      <Text className="mt-2 text-center text-xs" style={{ color: tokens.textMuted }}>
        Sets at 0s skip rest and run back-to-back.
      </Text>
      {restPersistError ? (
        <Text
          accessibilityRole="alert"
          className="mt-2 text-center text-xs"
          style={{ color: tokens.dangerText }}
        >
          Could not save the default rest. Try again.
        </Text>
      ) : null}
    </Screen>
  );
}
