import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { Animated, View, Text, Pressable, Alert, TextInput } from 'react-native';
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
import {
  applyRestDefault,
  buildPreviousSetLookup,
  buildTimerSequence,
  collectSessionSetRecords,
  computeSessionTotalSets,
  computeSessionTotalVolume,
  estimate1RM,
  findNewPersonalRecords,
  formatWorkoutTime,
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
  clearWorkoutSessionDraft,
  listLoggedSetsForExerciseNames,
  listRecentLoggedSets,
  listRecentWorkoutSetOutcomes,
  logWorkoutSession,
  loadRestSecondsDefault,
  getWorkoutPreferences,
  saveRestSecondsDefault,
  saveWorkoutSessionDraft,
} from './workout.data';
import { cancelScheduledNotification, scheduleTimerEndNotification } from '@/lib/notifications';
import {
  DEFAULT_REST_SECONDS,
  REST_SECONDS_MAX,
  REST_SECONDS_MIN,
  REST_SECONDS_STEP,
  clampRestSeconds,
} from './restTimerPreferences';
import type { WorkoutEffortScale } from '@/core/db/types';
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
  // Loaded from app_meta; zero-rest sets inherit this default. Adjustments
  // during the session stay session-local until explicitly saved (the
  // persisted preference is only rewritten by "Save as default").
  const [restDefault, setRestDefault] = useState<number | null>(null);
  const [persistedRestDefault, setPersistedRestDefault] = useState<number | null>(null);
  const [effortScale, setEffortScale] = useState<WorkoutEffortScale>('off');
  const sequence = useMemo(
    () =>
      buildTimerSequence(
        applyRestDefault(
          routine.exercises.map((ex) => {
            const isLegacyFreeText = !ex.catalog_exercise_id;
            return {
              name: ex.name,
              // Keep the old missing-catalog path modality-less so historic
              // free-text exercises continue to offer weight/reps and PRs.
              ...(isLegacyFreeText ? {} : { catalog_exercise_id: ex.catalog_exercise_id }),
              ...(isLegacyFreeText ? {} : { modality: ex.modality ?? 'timed' }),
              ...(isLegacyFreeText ? {} : { unilateral: ex.unilateral === 1 }),
              ...(isLegacyFreeText
                ? {}
                : {
                    supports_external_load:
                      ex.supports_external_load === undefined
                        ? ex.modality === 'weighted_strength'
                        : ex.supports_external_load === 1,
                  }),
              ...(ex.superset_group !== undefined ? { superset_group: ex.superset_group } : {}),
              sets: ex.sets.map((s) => ({
                set_number: s.set_number,
                active_seconds: s.active_seconds,
                rest_seconds: s.rest_seconds,
                target_reps_min: s.target_reps_min,
                target_reps_max: s.target_reps_max,
                target_load: s.target_load,
                target_duration_seconds: s.target_duration_seconds,
                target_distance: s.target_distance,
                target_pace: s.target_pace,
              })),
            };
          }),
          restDefault ?? 0,
        ),
      ),
    [routine.exercises, restDefault],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadRestSecondsDefault(), getWorkoutPreferences()]).then(
      ([seconds, preferences]) => {
        if (!cancelled) {
          setRestDefault(seconds);
          setPersistedRestDefault(seconds);
          setEffortScale(preferences.effortScale);
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
  }, []);

  const handleAdjustRestDefault = (delta: number) => {
    // Session-local only: future workouts are unaffected until the user
    // presses "Save as default".
    const next = clampRestSeconds((restDefault ?? DEFAULT_REST_SECONDS) + delta);
    setRestDefault(next);
  };

  const handlePersistRestDefault = () => {
    if (restDefault === null) return;
    void saveRestSecondsDefault(restDefault).then(() => setPersistedRestDefault(restDefault));
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
  const [isComplete, setIsComplete] = useState(false);
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
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedOutcome, setSavedOutcome] = useState<{ newRecords: string[] } | null>(null);
  const [previousLookup, setPreviousLookup] = useState<PreviousSetLookup | null>(null);
  const [recentSetOutcomes, setRecentSetOutcomes] = useState<
    Awaited<ReturnType<typeof listRecentWorkoutSetOutcomes>>
  >([]);
  // Wall-clock start captured on the FIRST Start press (not mount — users
  // idle before starting); null when the timer never ran. A resumed session
  // replays the draft's original start so logged duration stays truthful.
  const startedAtMsRef = useRef<number | null>(resume?.startedAtMs ?? null);

  const currentPhase: TimerPhase | undefined = sequence[currentIndex];

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
      Math.max(1, Math.round(remaining)),
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
  const persistDraft = useCallback(
    (phaseIndex: number) => {
      const startedAtMs = startedAtMsRef.current;
      if (startedAtMs === null) return;
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
      void saveWorkoutSessionDraft({
        routineId: routine.id,
        startedAtIso: new Date(startedAtMs).toISOString(),
        phaseIndex,
        elapsedAdjustSeconds: elapsedSecondsRef.current,
        ...(Object.keys(draftDispositions).length > 0 ? { dispositions: draftDispositions } : {}),
        ...(Object.keys(draftEnteredSets).length > 0 ? { enteredSets: draftEnteredSets } : {}),
        remainingSeconds: remainingRef.current,
      }).catch(() => {
        // Best-effort: the live session never depends on the draft.
      });
    },
    [routine.id],
  );

  const clearDraft = useCallback(() => {
    void clearWorkoutSessionDraft().catch(() => {
      // A stale draft only offers a resume that re-validates the routine.
    });
  }, []);

  // Keep the draft's phase cursor in step with every transition once the
  // timer has started (no-op before Start; harmless rewrite on resume mount).
  useEffect(() => {
    if (startedAtMsRef.current === null) return;
    persistDraft(currentIndex);
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

  // Reaching the summary ends the draft — there is no phase left to resume.
  useEffect(() => {
    if (isComplete) clearDraft();
  }, [isComplete, clearDraft]);

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
    const id = setTimeout(() => persistDraft(currentIndexRef.current), 250);
    return () => clearTimeout(id);
  }, [enteredSets, isComplete, persistDraft]);

  useEffect(() => {
    if (!isRunning || isComplete) return;
    const id = setInterval(() => {
      setElapsedSeconds((e) => e + 1);
      setRemaining((prev) => {
        if (prev > 1) return prev - 1;

        // Phase just hit zero: advance immediately instead of waiting for
        // a second effect to notice `remaining === 0` on the next render.
        const finishedIndex = currentIndexRef.current;
        const finishedPhase = sequence[finishedIndex];
        // Weighted and bodyweight strength sets are manual logging events. A
        // configured active duration is still shown as a pacing aid, but it
        // must not silently turn an unconfirmed set into performed history.
        // Legacy free-text routines remain timer-driven for V1 compatibility;
        // typed timed/cardio modalities are also safe to complete at target.
        if (
          finishedPhase?.phase === 'active' &&
          finishedPhase.modality !== undefined &&
          finishedPhase.modality !== 'timed' &&
          finishedPhase.modality !== 'cardio'
        ) {
          setIsRunning(false);
          return 0;
        }
        if (
          finishedPhase?.phase === 'active' &&
          (finishedPhase.modality === 'timed' || finishedPhase.modality === 'cardio')
        ) {
          setEnteredSets((values) => ({
            ...values,
            [finishedIndex]: {
              ...(values[finishedIndex] ?? { weight: '', reps: '' }),
              duration: String(Math.max(0, Math.round(finishedPhase.durationSeconds))),
            },
          }));
        }
        setDispositions((d) => ({ ...d, [finishedIndex]: 'completed' }));
        const nextIdx = finishedIndex + 1;
        if (nextIdx >= sequence.length) {
          setIsRunning(false);
          setIsComplete(true);
          return 0;
        }
        setCurrentIndex(nextIdx);
        currentIndexRef.current = nextIdx;
        return sequence[nextIdx].durationSeconds;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, isComplete, sequence]);

  const handleStart = () => {
    if (startedAtMsRef.current === null) startedAtMsRef.current = Date.now();
    persistDraft(currentIndexRef.current);
    setIsRunning(true);
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
    // A zero-second rest is an intentional back-to-back transition, not a
    // phase that should force a second Start tap or an empty timer screen.
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

  const handleFinish = async () => {
    if (isSaving) return;
    setIsRunning(false);
    setIsSaving(true);
    try {
      const endedAtMs = Date.now();
      const startedAtMs = startedAtMsRef.current;
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

      await logWorkoutSession({
        routineId: routine.id,
        notes: notes.trim() ? notes.trim() : undefined,
        exercises: summary.map((s) => {
          const exercise = routine.exercises.find((item) => item.name === s.exerciseName);
          const isLegacyFreeText = !exercise?.catalog_exercise_id;
          return {
            exerciseName: s.exerciseName,
            setsCompleted: s.setsCompleted,
            ...(isLegacyFreeText
              ? {}
              : {
                  catalogExerciseId: exercise?.catalog_exercise_id ?? null,
                  modality: exercise?.modality ?? 'timed',
                  unilateral: exercise?.unilateral === 1,
                  supportsExternalLoad:
                    exercise?.supports_external_load === undefined
                      ? exercise?.modality === 'weighted_strength'
                      : exercise.supports_external_load === 1,
                }),
            sets: records
              .filter((r) => r.exerciseName === s.exerciseName)
              .map((r) => ({
                setNumber: r.setNumber,
                weight: r.weight,
                reps: r.reps,
                completed: r.completed,
                weightUnit: r.weight !== null ? ('kg' as const) : null,
                durationSeconds: r.durationSeconds,
                distance: r.distance,
                pace: r.pace,
                effortValue: r.effortValue,
                effortScale: r.effortScale,
              })),
          };
        }),
        startedAt: startedAtMs !== null ? new Date(startedAtMs).toISOString() : null,
        endedAt: new Date(endedAtMs).toISOString(),
        // Resumed sessions log active time, not wall-clock: the gap between the
        // original start and the restart must not count as workout minutes.
        ...(resume ? { activeDurationSeconds: Math.max(0, elapsedSecondsRef.current) } : {}),
      });
      clearDraft();
      setSavedOutcome({ newRecords });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdjustRemaining = (delta: number) => {
    setRemaining((prev) => Math.max(1, prev + delta));
  };

  const handleCancel = () => {
    Alert.alert('End workout?', 'Progress will not be saved.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: () => {
          setIsRunning(false);
          clearDraft();
          onCancel();
        },
      },
    ]);
  };

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
                  label={isSaving ? 'Saving…' : 'Save and finish'}
                  onPress={handleFinish}
                  color={WORKOUT_COLOR}
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
  const isLegacyFreeText = currentPhase.modality === undefined;
  const isLoadBased =
    isLegacyFreeText ||
    currentPhase.modality === 'weighted_strength' ||
    currentPhase.modality === 'bodyweight';
  const isBodyweight = currentPhase.modality === 'bodyweight';
  const isCardio = currentPhase.modality === 'cardio';
  const allowsExternalLoad = currentPhase.supportsExternalLoad !== false;
  const denom = currentPhase.durationSeconds > 0 ? currentPhase.durationSeconds : 1;
  const progress = 1 - remaining / denom;
  // Visible previous performance at the point of entry; the same values
  // silently pre-seed the inputs below.
  const previousForCurrentSet = isActive
    ? lookupPreviousSet(
        previousLookup,
        currentPhase.exerciseName,
        currentPhase.setNumber,
        currentPhase.catalogExerciseId,
      )
    : null;
  const previousText = previousForCurrentSet
    ? allowsExternalLoad
      ? `Previous: ${previousForCurrentSet.weight}×${previousForCurrentSet.reps}`
      : `Previous: ${previousForCurrentSet.reps} reps`
    : 'Previous: —';
  const targetText = isLoadBased
    ? [
        currentPhase.targetLoad != null ? `target ${currentPhase.targetLoad} kg` : null,
        currentPhase.targetRepsMin != null || currentPhase.targetRepsMax != null
          ? `${currentPhase.targetRepsMin ?? currentPhase.targetRepsMax}–${currentPhase.targetRepsMax ?? currentPhase.targetRepsMin} reps`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : isCardio
      ? [
          `target ${formatWorkoutTime(currentPhase.durationSeconds)}`,
          currentPhase.targetDistance != null ? `${currentPhase.targetDistance} distance` : null,
          currentPhase.targetPace != null ? `${currentPhase.targetPace} pace` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : `target ${formatWorkoutTime(currentPhase.durationSeconds)}`;
  const progressionGuidance = progressionRecommendation ? (
    <View
      className="mt-2 rounded-xl border px-3 py-2"
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

  return (
    <Screen>
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="End workout"
        >
          <Text className="text-sm" style={{ color: tokens.textMuted }}>
            End
          </Text>
        </Pressable>
        <Text className="text-sm" style={{ color: tokens.textMuted }}>
          {routine.name}
        </Text>
        <Text className="text-xs" style={{ color: tokens.iconMuted }}>
          {currentIndex + 1}/{sequence.length}
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
        <View
          className={`self-center rounded-full px-3 py-1 ${isActive ? 'bg-workout' : ''}`}
          style={isActive ? undefined : { backgroundColor: tokens.warningText }}
        >
          <Text className="text-xs font-medium" style={{ color: tokens.textOnAccent }}>
            {isActive ? 'ACTIVE' : 'REST'}
          </Text>
        </View>

        <Text className="mt-4 text-center text-2xl font-semibold" style={{ color: tokens.text }}>
          {currentPhase.exerciseName}
        </Text>
        <Text className="mt-1 text-center text-sm" style={{ color: tokens.textMuted }}>
          Set {currentPhase.setNumber} of {currentPhase.totalSets}
        </Text>
        <Text className="mt-2 text-center text-xs" style={{ color: WORKOUT_COLOR }}>
          {isLegacyFreeText ? 'Legacy strength entry' : currentPhase.modality?.replace('_', ' ')} ·{' '}
          {targetText}
        </Text>

        <Text className="my-8 text-center text-7xl font-semibold" style={{ color: tokens.text }}>
          {formatWorkoutTime(remaining)}
        </Text>

        <View
          className="mb-8 h-2 overflow-hidden rounded-full"
          style={{ backgroundColor: tokens.border }}
        >
          <View
            className={`h-full rounded-full ${isActive ? 'bg-workout' : ''}`}
            style={[
              {
                width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`,
              },
              !isActive ? { backgroundColor: tokens.warningText } : undefined,
            ]}
          />
        </View>

        {isActive ? (
          <View className="mb-5">
            {progressionGuidance}
            {isLoadBased ? (
              <>
                <Text className="text-xs font-medium" style={{ color: tokens.textMuted }}>
                  Log this set (optional)
                </Text>
                <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
                  {previousText}
                  {isBodyweight ? ' · bodyweight is the movement basis' : ''}
                  {currentPhase.unilateral ? ' · reps are recorded per side' : ''}
                </Text>
                <View className="mt-2 flex-row items-end gap-3">
                  {allowsExternalLoad ? (
                    <View className="min-w-0 flex-1">
                      <Text
                        className="mb-1.5 text-sm font-medium"
                        style={{ color: tokens.textMuted }}
                      >
                        {isBodyweight ? 'Additional load' : 'Weight'}
                      </Text>
                      <TextInput
                        accessibilityLabel={isBodyweight ? 'Additional load' : 'Weight'}
                        className="rounded-xl border px-3 py-2 text-center text-base"
                        style={{
                          height: 48,
                          borderColor: tokens.border,
                          backgroundColor: tokens.surfaceElevated,
                          color: tokens.text,
                        }}
                        value={enteredSets[currentIndex]?.weight ?? ''}
                        onChangeText={(t) =>
                          updateEnteredValues(currentIndex, { weight: t.replace(/[^0-9.]/g, '') })
                        }
                        placeholder={isBodyweight ? 'optional' : 'e.g. 60'}
                        placeholderTextColor={tokens.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  ) : null}
                  <View className={allowsExternalLoad ? 'min-w-0 flex-1' : 'min-w-0 w-full'}>
                    <NumberStepperField
                      label={currentPhase.unilateral ? 'Reps / side' : 'Reps'}
                      value={enteredSets[currentIndex]?.reps ?? ''}
                      onChange={(v) => updateEnteredValues(currentIndex, { reps: v })}
                      min={1}
                      max={200}
                      placeholder="—"
                    />
                  </View>
                </View>
              </>
            ) : isCardio ? (
              <>
                <Text className="text-xs font-medium" style={{ color: tokens.textMuted }}>
                  Cardio result (optional)
                </Text>
                <NumberStepperField
                  label="Duration (seconds)"
                  value={enteredSets[currentIndex]?.duration ?? ''}
                  onChange={(value) => updateEnteredValues(currentIndex, { duration: value })}
                  min={1}
                  max={86400}
                  placeholder={String(Math.round(currentPhase.durationSeconds))}
                />
                <TextInput
                  accessibilityLabel="Distance"
                  className="mt-2 rounded-xl border px-3 py-2 text-base"
                  style={{
                    height: 48,
                    borderColor: tokens.border,
                    backgroundColor: tokens.surfaceElevated,
                    color: tokens.text,
                  }}
                  value={enteredSets[currentIndex]?.distance ?? ''}
                  onChangeText={(value) =>
                    updateEnteredValues(currentIndex, { distance: value.replace(/[^0-9.]/g, '') })
                  }
                  placeholder="Distance"
                  placeholderTextColor={tokens.textMuted}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  accessibilityLabel="Pace"
                  className="mt-2 rounded-xl border px-3 py-2 text-base"
                  style={{
                    height: 48,
                    borderColor: tokens.border,
                    backgroundColor: tokens.surfaceElevated,
                    color: tokens.text,
                  }}
                  value={enteredSets[currentIndex]?.pace ?? ''}
                  onChangeText={(value) =>
                    updateEnteredValues(currentIndex, { pace: value.replace(/[^0-9.]/g, '') })
                  }
                  placeholder="Pace / speed"
                  placeholderTextColor={tokens.textMuted}
                  keyboardType="decimal-pad"
                />
              </>
            ) : (
              <>
                <Text className="text-xs" style={{ color: tokens.textMuted }}>
                  The work timer records the completed duration for this set.
                </Text>
                <NumberStepperField
                  label="Duration (seconds)"
                  value={enteredSets[currentIndex]?.duration ?? ''}
                  onChange={(value) => updateEnteredValues(currentIndex, { duration: value })}
                  min={1}
                  max={86400}
                  placeholder={String(Math.round(currentPhase.durationSeconds))}
                />
              </>
            )}
            {effortScale !== 'off' ? (
              <View className="mt-3">
                <NumberStepperField
                  label={effortScale === 'rir' ? 'RIR (reps in reserve)' : 'RPE (1–10)'}
                  value={enteredSets[currentIndex]?.effort ?? ''}
                  onChange={(value) => updateEnteredValues(currentIndex, { effort: value })}
                  min={effortScale === 'rir' ? 0 : 1}
                  max={10}
                  placeholder="—"
                />
              </View>
            ) : null}
          </View>
        ) : null}

        <View className="gap-3">
          {!isRunning ? (
            <Button label="Start" onPress={handleStart} color={WORKOUT_COLOR} />
          ) : (
            <Button
              label={isActive ? 'Complete set' : 'Skip'}
              variant={isActive ? 'primary' : 'ghost'}
              onPress={isActive ? handleCompleteSet : handleSkip}
              color={isActive ? WORKOUT_COLOR : undefined}
            />
          )}
          {isActive ? (
            <>
              {!isRunning ? (
                <Button label="Complete set now" variant="ghost" onPress={handleCompleteSet} />
              ) : null}
              <Button label="Skip" variant="ghost" onPress={handleSkip} />
            </>
          ) : null}
          {!isActive ? (
            <View className="flex-row items-center justify-center gap-6">
              <Pressable
                onPress={() => handleAdjustRemaining(-REST_SECONDS_STEP)}
                accessibilityRole="button"
                accessibilityLabel={`Reduce rest by ${REST_SECONDS_STEP} seconds`}
                className="rounded-full px-4 py-2"
                style={{ backgroundColor: tokens.surfaceElevated }}
              >
                <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                  −{REST_SECONDS_STEP}s
                </Text>
              </Pressable>
              <Text className="text-xs" style={{ color: tokens.textMuted }}>
                Rest adjust
              </Text>
              <Pressable
                onPress={() => handleAdjustRemaining(REST_SECONDS_STEP)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${REST_SECONDS_STEP} seconds of rest`}
                className="rounded-full px-4 py-2"
                style={{ backgroundColor: tokens.surfaceElevated }}
              >
                <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                  +{REST_SECONDS_STEP}s
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View className="mt-5 flex-row items-center justify-center gap-3">
          <Text className="text-xs" style={{ color: tokens.textMuted }}>
            Default rest (this session): {restDefault === null ? '…' : `${restDefault}s`}
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

        {currentIndex + 1 < sequence.length ? (
          <Text className="mt-6 text-center text-xs" style={{ color: tokens.textMuted }}>
            Next:{' '}
            {sequence[currentIndex + 1].phase === 'rest'
              ? `Rest ${formatWorkoutTime(sequence[currentIndex + 1].durationSeconds)}`
              : `${sequence[currentIndex + 1].exerciseName} — Set ${sequence[currentIndex + 1].setNumber}`}
          </Text>
        ) : null}
      </Card>
    </Screen>
  );
}
