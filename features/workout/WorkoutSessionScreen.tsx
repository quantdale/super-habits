import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, Alert, TextInput } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Screen } from '@/core/ui/Screen';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { TextField } from '@/core/ui/TextField';
import { NumberStepperField } from '@/core/ui/NumberStepperField';
import {
  applyRestDefault,
  buildPreviousSetLookup,
  buildTimerSequence,
  collectSessionSetRecords,
  computeSessionTotalSets,
  findNewPersonalRecords,
  formatWorkoutTime,
  lookupPreviousSet,
  summarizeCompletedSets,
  type EnteredSetValues,
  type LoggedSet,
  type PhaseDisposition,
  type PreviousSetLookup,
  type TimerPhase,
} from './workout.domain';
import {
  listLoggedSetsForExerciseNames,
  listRecentLoggedSets,
  logWorkoutSession,
  loadRestSecondsDefault,
  saveRestSecondsDefault,
} from './workout.data';
import {
  DEFAULT_REST_SECONDS,
  REST_SECONDS_MAX,
  REST_SECONDS_MIN,
  REST_SECONDS_STEP,
  clampRestSeconds,
} from './restTimerPreferences';
import type { RoutineWithExercises } from './types';
import { SECTION_COLORS } from '@/constants/sectionColors';

const WORKOUT_COLOR = SECTION_COLORS.workout;

type Props = {
  routine: RoutineWithExercises;
  onFinish: () => void;
  onCancel: () => void;
};

export function WorkoutSessionScreen({ routine, onFinish, onCancel }: Props) {
  const { tokens } = useAppTheme();
  // Loaded from app_meta; zero-rest sets inherit this default. Adjustments
  // during the session stay session-local until explicitly saved (the
  // persisted preference is only rewritten by "Save as default").
  const [restDefault, setRestDefault] = useState<number | null>(null);
  const [persistedRestDefault, setPersistedRestDefault] = useState<number | null>(null);
  const sequence = useMemo(
    () =>
      buildTimerSequence(
        applyRestDefault(
          routine.exercises.map((ex) => ({
            name: ex.name,
            sets: ex.sets.map((s) => ({
              set_number: s.set_number,
              active_seconds: s.active_seconds,
              rest_seconds: s.rest_seconds,
            })),
          })),
          restDefault ?? 0,
        ),
      ),
    [routine.exercises, restDefault],
  );

  useEffect(() => {
    let cancelled = false;
    void loadRestSecondsDefault().then((seconds) => {
      if (!cancelled) {
        setRestDefault(seconds);
        setPersistedRestDefault(seconds);
      }
    });
    // Seed per-set entry defaults from the most recent recorded values.
    void listRecentLoggedSets()
      .then((rows) => {
        if (!cancelled) setPreviousLookup(buildPreviousSetLookup(rows));
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

  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(() => sequence[0]?.durationSeconds ?? 0);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  // Display-only tick counter; the persisted duration is derived from real
  // wall-clock timestamps (startedAtMsRef → handleFinish), not from ticks.
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Per-phase outcome: natural timeout marks 'completed', Skip marks
  // 'skipped'. Skipped active phases are never counted as completed work.
  const [dispositions, setDispositions] = useState<Record<number, PhaseDisposition>>({});
  // Optional weight/reps entry keyed by sequence index of each active phase.
  const [enteredSets, setEnteredSets] = useState<Record<number, EnteredSetValues>>({});
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedOutcome, setSavedOutcome] = useState<{ newRecords: string[] } | null>(null);
  const [previousLookup, setPreviousLookup] = useState<PreviousSetLookup | null>(null);
  // Wall-clock start captured on the FIRST Start press (not mount — users
  // idle before starting); null when the timer never ran.
  const startedAtMsRef = useRef<number | null>(null);

  const currentPhase: TimerPhase | undefined = sequence[currentIndex];

  const currentIndexRef = useRef(currentIndex);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  });

  // Seed the entry fields for a newly-current active phase from the most
  // recent recorded values for that exercise (exact set number first).
  useEffect(() => {
    const phase = sequence[currentIndex];
    if (!phase || phase.phase !== 'active') return;
    setEnteredSets((prev) => {
      if (prev[currentIndex]) return prev;
      const prior = lookupPreviousSet(previousLookup, phase.exerciseName, phase.setNumber);
      if (!prior) return prev;
      return {
        ...prev,
        [currentIndex]: { weight: String(prior.weight), reps: String(prior.reps) },
      };
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [currentIndex, sequence, previousLookup]);

  const updateEnteredValues = (index: number, patch: Partial<EnteredSetValues>) => {
    setEnteredSets((prev) => {
      const current = prev[index] ?? { weight: '', reps: '' };
      return { ...prev, [index]: { ...current, ...patch } };
    });
  };

  useEffect(() => {
    if (!isRunning || isComplete) return;
    const id = setInterval(() => {
      setElapsedSeconds((e) => e + 1);
      setRemaining((prev) => {
        if (prev > 1) return prev - 1;

        // Phase just hit zero: advance immediately instead of waiting for
        // a second effect to notice `remaining === 0` on the next render.
        const finishedIndex = currentIndexRef.current;
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
    setIsRunning(true);
  };

  const handleSkip = () => {
    const finishedIndex = currentIndexRef.current;
    setDispositions((d) => ({ ...d, [finishedIndex]: 'skipped' }));
    const nextIndex = finishedIndex + 1;
    if (nextIndex >= sequence.length) {
      setIsRunning(false);
      setIsComplete(true);
      return;
    }
    setCurrentIndex(nextIndex);
    currentIndexRef.current = nextIndex;
    setRemaining(sequence[nextIndex].durationSeconds);
  };

  const handleFinish = async () => {
    if (isSaving) return;
    setIsRunning(false);
    setIsSaving(true);
    try {
      const endedAtMs = Date.now();
      const startedAtMs = startedAtMsRef.current;
      const records = collectSessionSetRecords(sequence, currentIndex, dispositions, enteredSets);
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
        const historySets = await listLoggedSetsForExerciseNames(names);
        const sessionSets: LoggedSet[] = weightedRecords.map((r) => ({
          exerciseName: r.exerciseName,
          weight: r.weight,
          reps: r.reps,
        }));
        newRecords = findNewPersonalRecords(sessionSets, historySets);
      }

      await logWorkoutSession({
        routineId: routine.id,
        notes: notes.trim() ? notes.trim() : undefined,
        exercises: summary.map((s) => ({
          exerciseName: s.exerciseName,
          setsCompleted: s.setsCompleted,
          sets: records
            .filter((r) => r.exerciseName === s.exerciseName)
            .map((r) => ({
              setNumber: r.setNumber,
              weight: r.weight,
              reps: r.reps,
              completed: r.completed,
            })),
        })),
        startedAt: startedAtMs !== null ? new Date(startedAtMs).toISOString() : null,
        endedAt: new Date(endedAtMs).toISOString(),
      });
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
          onCancel();
        },
      },
    ]);
  };

  if (isComplete && savedOutcome) {
    const summary = summarizeCompletedSets(sequence, currentIndex, dispositions);
    const totalSets = computeSessionTotalSets(summary);
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
  const denom = currentPhase.durationSeconds > 0 ? currentPhase.durationSeconds : 1;
  const progress = 1 - remaining / denom;

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
            <Text className="text-xs font-medium" style={{ color: tokens.textMuted }}>
              Log this set (optional)
            </Text>
            <View className="mt-2 flex-row items-end gap-3">
              <View className="min-w-0 flex-1">
                <Text className="mb-1.5 text-sm font-medium" style={{ color: tokens.textMuted }}>
                  Weight
                </Text>
                <TextInput
                  accessibilityLabel="Weight"
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
                  placeholder="e.g. 60"
                  placeholderTextColor={tokens.textMuted}
                  keyboardType="numeric"
                />
              </View>
              <View className="min-w-0 flex-1">
                <NumberStepperField
                  label="Reps"
                  value={enteredSets[currentIndex]?.reps ?? ''}
                  onChange={(v) => updateEnteredValues(currentIndex, { reps: v })}
                  min={1}
                  max={200}
                  placeholder="—"
                />
              </View>
            </View>
          </View>
        ) : null}

        <View className="gap-3">
          {!isRunning ? (
            <Button label="Start" onPress={handleStart} color={WORKOUT_COLOR} />
          ) : (
            <Button label="Skip" variant="ghost" onPress={handleSkip} />
          )}
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
