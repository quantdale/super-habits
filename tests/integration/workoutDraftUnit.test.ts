/**
 * Workout draft reload leads — weight-unit reinterpretation (lead 1).
 *
 * The guided session's draft (`app_meta.workout.active_session_draft`) stores
 * the entered measurements as RAW strings plus the unit they were entered in.
 * A weight-unit preference (kg ↔ lb) may change while the session sits as a
 * draft (the body-weight / goal-weight dialog owns exactly that preference).
 * Resuming must therefore replay the numbers in the unit they were TYPED in,
 * never reinterpret "100 kg" as "100 lb" (a silent 2.2x corruption of every
 * saved set that is indistinguishable from a made-up heavier session).
 *
 * These cases drive the screens' real closures (`persistDraft`,
 * `handleResumeDraft`) against the real data layer and a real SQLite database,
 * so they fail on a screen that ignores the stored unit.
 */

import { describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';
import { screenCallback } from './helpers/screenCallback';

vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));

const START = '2026-10-20T09:00:00.000Z';

async function fixture() {
  const db = await freshDatabase();
  await db.runAsync(
    `INSERT INTO workout_routines (id,name,description,created_at,updated_at,deleted_at)
     VALUES ('wrk_units','Unit routine',NULL,?,?,NULL)`,
    [START, START],
  );
  await db.runAsync(
    `INSERT INTO routine_exercises
      (id,routine_id,name,sort_order,catalog_exercise_id,modality,created_at,updated_at,deleted_at)
     VALUES ('ex_units','wrk_units','Barbell Bench Press',0,'builtin_barbell_bench_press','weighted_strength',?,?,NULL)`,
    [START, START],
  );
  await db.runAsync(
    `INSERT INTO routine_exercise_sets
      (id,exercise_id,set_number,active_seconds,rest_seconds,target_reps_min,target_reps_max,created_at,updated_at,deleted_at)
     VALUES ('eset_units_1','ex_units',1,30,60,8,10,?,?,NULL)`,
    [START, START],
  );

  const workout = await import('@/features/workout/workout.data');
  const domain = await import('@/features/workout/workout.domain');
  const routine = (await workout.getRoutineWithExercises('wrk_units'))!;
  return { db, workout, domain, routine };
}

describe('a draft remembers the weight unit its values were entered in', () => {
  it('persists the session weight unit alongside the entered measurements', async () => {
    const { db, workout, routine } = await fixture();
    try {
      const saved: unknown[] = [];
      const save = vi.fn(async (draft: unknown) => {
        saved.push(draft);
        await workout.saveWorkoutSessionDraft(
          draft as Parameters<typeof workout.saveWorkoutSessionDraft>[0],
        );
      });
      const persist = screenCallback(
        'persistDraft',
        {
          routine,
          notes: '',
          effortScale: 'off',
          weightUnit: 'lb',
          startedAtMsRef: { current: Date.parse(START) },
          draftClearGenerationRef: { current: 0 },
          dispositionsRef: { current: { 0: 'completed' } },
          enteredSetsRef: { current: { 0: { weight: '100', reps: '10' } } },
          elapsedSecondsRef: { current: 40 },
          remainingRef: { current: 60 },
          addedSets: {},
          saveWorkoutSessionDraft: save,
          clearWorkoutSessionDraft: workout.clearWorkoutSessionDraft,
        },
        'WorkoutSessionScreen',
      );
      await persist(0);
      await save.mock.results[0]?.value;

      const draft = await workout.getWorkoutSessionDraft();
      expect(draft?.enteredSets?.['0']?.weight).toBe('100');
      // The unit the numbers were TYPED in must ride the draft. Without it a
      // resumed session labels the same raw digits with whatever the
      // preference happens to be at resume time.
      expect(draft?.weightUnit).toBe('lb');
    } finally {
      await db.closeAsync();
    }
  });

  it('resumes a draft in its recorded unit and never relabels the raw values', async () => {
    const { db, workout, domain, routine } = await fixture();
    try {
      await workout.saveWorkoutSessionDraft({
        routineId: routine.id,
        routineSnapshot: routine,
        startedAtIso: START,
        phaseIndex: 0,
        weightUnit: 'kg',
        enteredSets: { '0': { weight: '100', reps: '8' } },
        dispositions: { '0': 'completed' },
      });
      const restored = await workout.getWorkoutSessionDraft();
      const setCurrentView = vi.fn();
      await screenCallback(
        'handleResumeDraft',
        {
          draft: restored,
          getDraftWorkoutRoutine: domain.getDraftWorkoutRoutine,
          setCurrentView,
          Alert: { alert: vi.fn() },
        },
        'WorkoutScreen',
      )();

      expect(setCurrentView).toHaveBeenCalledOnce();
      const recovered = setCurrentView.mock.calls[0][0];
      // 100 typed as kg must come back as 100 kg even though the preference is
      // now lb — the resume carries the draft's unit, not the live preference.
      expect(recovered.resume.weightUnit).toBe('kg');
      expect(recovered.resume.enteredSets['0']).toEqual({ weight: '100', reps: '8' });
    } finally {
      await db.closeAsync();
    }
  });
});

describe('a rest adjustment is checkpointed immediately (lead 2)', () => {
  it('writes the extended remaining time to the draft without a phase transition', async () => {
    const { db, workout, domain, routine } = await fixture();
    try {
      // The session sits in the REST phase after set 1, at the prescribed 60s.
      await workout.saveWorkoutSessionDraft({
        routineId: routine.id,
        routineSnapshot: routine,
        startedAtIso: START,
        phaseIndex: 1, // sequence: [active 0, rest 1]
        remainingSeconds: 60,
        dispositions: { '0': 'completed' },
        enteredSets: { '0': { weight: '80', reps: '8' } },
        weightUnit: 'kg',
      });
      const save = vi.fn(async (draft: unknown) =>
        workout.saveWorkoutSessionDraft(
          draft as Parameters<typeof workout.saveWorkoutSessionDraft>[0],
        ),
      );
      // ONE shared ref, exactly like the screen: the adjust closure writes it
      // and `persistDraft` reads it.
      const remainingRef = { current: 60 };
      const currentIndexRef = { current: 1 };
      const persistDraft = screenCallback(
        'persistDraft',
        {
          routine,
          notes: '',
          effortScale: 'off',
          weightUnit: 'kg',
          startedAtMsRef: { current: Date.parse(START) },
          draftClearGenerationRef: { current: 0 },
          dispositionsRef: { current: { 0: 'completed' } },
          enteredSetsRef: { current: { 0: { weight: '80', reps: '8' } } },
          elapsedSecondsRef: { current: 30 },
          remainingRef,
          addedSets: {},
          saveWorkoutSessionDraft: save,
          clearWorkoutSessionDraft: workout.clearWorkoutSessionDraft,
        },
        'WorkoutSessionScreen',
      );
      const setRemaining = vi.fn();
      const adjust = screenCallback(
        'handleAdjustRemaining',
        { remainingRef, setRemaining, persistDraft, currentIndexRef },
        'WorkoutSessionScreen',
      );
      await adjust(15);
      await save.mock.results[0]?.value;

      // The tap's own value is already durable: a reload right now restores the
      // extension instead of the prescribed 60s.
      const draft = await workout.getWorkoutSessionDraft();
      expect(draft?.remainingSeconds).toBe(75);
      expect(remainingRef.current).toBe(75);
      expect(setRemaining).toHaveBeenCalled();
      // Nothing else about the session was lost by the checkpoint.
      expect(draft?.dispositions).toEqual({ '0': 'completed' });
      expect(draft?.enteredSets).toEqual({ '0': { weight: '80', reps: '8' } });
      expect(draft?.weightUnit).toBe('kg');
      void domain;
    } finally {
      await db.closeAsync();
    }
  });
});
