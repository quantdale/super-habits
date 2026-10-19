/**
 * AUD-SH04-A / AUD-SH04-B / AUD-SH04-C — a workout draft must survive to a
 * committed save.
 *
 * Audited defect (SH-04, High): the screen's `isComplete` effect CLEARED the
 * durable draft the moment the user reached the unsaved summary. Save/finish
 * commits LATER, and the product claims failed saves retain progress. So an
 * executed effect cleared the draft with no successful save, and a failed finish
 * followed by a restart lost the entered workout entirely. The passing
 * data-layer tests never executed that screen effect, which is exactly why they
 * could not catch it.
 *
 * The resolution replaces "clear the draft on the summary" with a durable
 * PENDING-SAVE recovery state that only a committed log or an explicit discard
 * removes. These cases exercise the real data layer and the real resume/reconcile
 * decision, and pin the screen wiring that makes the effect durable.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));

const ROOT = path.resolve(__dirname, '..', '..');

const ENTERED = {
  '0': { weight: '80', reps: '8', effort: '2' },
  '1': { weight: '60', reps: '10' },
  '2': { weight: '', reps: '', duration: '95', distance: '2.4', pace: '4:20' },
};

const DISPOSITIONS = { '0': 'completed' as const, '2': 'skipped' as const };

async function seedRoutine(db: Awaited<ReturnType<typeof freshDatabase>>): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_routines (id, name, description, created_at, updated_at, deleted_at)
     VALUES ('wrk_a', 'Push day', NULL, ?, ?, NULL)`,
    [now, now],
  );
  await db.runAsync(
    `INSERT INTO routine_exercises (id, routine_id, name, sort_order, catalog_exercise_id, modality, created_at, updated_at, deleted_at)
     VALUES ('ex_a', 'wrk_a', 'Bench press', 1, 'builtin_barbell_bench_press', 'weighted_strength', ?, ?, NULL)`,
    [now, now],
  );
  await db.runAsync(
    `INSERT INTO routine_exercise_sets (id, exercise_id, set_number, active_seconds, rest_seconds, target_reps_min, target_reps_max, target_load, created_at, updated_at, deleted_at)
     VALUES ('eset_a', 'ex_a', 1, 40, 60, 8, 10, 60, ?, ?, NULL)`,
    [now, now],
  );
}

async function pendingCount(
  db: Awaited<ReturnType<typeof freshDatabase>>,
  key: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM app_meta WHERE key = ?',
    [key],
  );
  return Number(row?.n ?? 0);
}

function readSource(relative: string): string {
  return readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('AUD-SH04-A: reaching the summary retains the entered data durably', () => {
  it('writes a pending-save state that round-trips every entered value', async () => {
    const db = await freshDatabase();
    await seedRoutine(db);
    const workout = await import('@/features/workout/workout.data');

    const startedAtIso = '2026-10-18T09:00:00.000Z';
    await workout.saveWorkoutPendingSave({
      routineId: 'wrk_a',
      startedAtIso,
      phaseIndex: 2,
      elapsedSeconds: 412,
      enteredSets: ENTERED,
      dispositions: DISPOSITIONS,
      addedSets: { '0': 2 },
    });

    // A restart is a fresh read of durable state.
    const restored = await workout.getWorkoutPendingSave();
    expect(restored).not.toBeNull();
    expect(restored).toMatchObject({
      routineId: 'wrk_a',
      startedAtIso,
      elapsedSeconds: 412,
      addedSets: { '0': 2 },
    });
    // Every entered field survives verbatim, including timed/cardio values.
    expect(restored?.enteredSets['0']).toEqual({ weight: '80', reps: '8', effort: '2' });
    expect(restored?.enteredSets['2']).toEqual({
      weight: '',
      reps: '',
      duration: '95',
      distance: '2.4',
      pace: '4:20',
    });
    expect(restored?.dispositions).toEqual(DISPOSITIONS);
    // No history was written by merely reaching the summary.
    const logs = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workout_logs');
    expect(Number(logs?.n ?? -1)).toBe(0);
    await db.closeAsync();
  }, 60000);

  it('the screen never clears the draft unconditionally on completion', async () => {
    // The audited line was `if (isComplete) clearDraft();`. Guard the exact shape
    // so a future edit cannot silently reintroduce it.
    const source = readSource('features/workout/WorkoutSessionScreen.tsx');
    expect(source).not.toContain('if (isComplete) clearDraft();');
    // And the completion path DOES write the recovery payload first.
    const pendingWriteIndex = source.indexOf('saveWorkoutPendingSave({');
    const clearIndex = source.indexOf('clearDraft();', pendingWriteIndex);
    expect(pendingWriteIndex).toBeGreaterThan(-1);
    expect(clearIndex).toBeGreaterThan(pendingWriteIndex);
  });

  it('rejects an invalid pending-save payload instead of storing garbage', async () => {
    const db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    await workout.saveWorkoutPendingSave({
      routineId: '',
      startedAtIso: 'not-a-date',
      phaseIndex: 0,
      elapsedSeconds: -5,
      enteredSets: {},
      dispositions: {},
    });
    expect(await workout.getWorkoutPendingSave()).toBeNull();
    expect(await pendingCount(db, 'workout.pending_save')).toBe(0);
    await db.closeAsync();
  }, 60000);
});

describe('AUD-SH04-B: a failed save retains the durable recovery state', () => {
  it('survives a restart with the failure reason recorded', async () => {
    const db = await freshDatabase();
    await seedRoutine(db);
    const workout = await import('@/features/workout/workout.data');

    await workout.saveWorkoutPendingSave({
      routineId: 'wrk_a',
      startedAtIso: '2026-10-18T09:00:00.000Z',
      phaseIndex: 2,
      elapsedSeconds: 300,
      enteredSets: ENTERED,
      dispositions: DISPOSITIONS,
      lastError: 'This workout could not be saved. Your progress is still here — try again.',
    });

    const restored = await workout.getWorkoutPendingSave();
    expect(restored?.lastError).toMatch(/could not be saved/);
    expect(restored?.enteredSets['1']).toEqual({ weight: '60', reps: '10' });
    // Still zero logs, still zero rewards: a failed save changed no history.
    const logs = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workout_logs');
    expect(Number(logs?.n ?? -1)).toBe(0);
    await db.closeAsync();
  }, 60000);

  it('the landing surfaces the pending save ahead of the draft and the schedule', async () => {
    const { buildTrainingState } = await import('@/features/workout/workoutLanding');
    const state = buildTrainingState({
      schedule: { planKind: 'workout', routineId: 'wrk_a' },
      scheduledRoutine: { id: 'wrk_a', name: 'Push day', exerciseCount: 3, setCount: 9 },
      completedToday: false,
      draftRoutineName: 'Push day',
      hasDraft: true,
      routineCount: 1,
      pendingSave: { routineName: 'Push day', lastError: 'Save failed.' },
    });
    expect(state.kind).toBe('pending-save');
    expect(state.primaryAction).toBe('retry-save');
    expect(state.primaryLabel).toMatch(/save/i);
    // The recorded failure is stated, not hidden behind a generic success tone.
    expect(state.detail).toContain('Save failed.');

    // Control: with no pending save the draft still owns the hero.
    const draftState = buildTrainingState({
      schedule: null,
      scheduledRoutine: null,
      completedToday: false,
      draftRoutineName: 'Push day',
      hasDraft: true,
      routineCount: 1,
      pendingSave: null,
    });
    expect(draftState.kind).toBe('resume');
  });
});

describe('AUD-SH04-C: kill after commit never duplicates the log', () => {
  it('reconcile detects the committed log and retires the pending state', async () => {
    const db = await freshDatabase();
    await seedRoutine(db);
    const workout = await import('@/features/workout/workout.data');
    const startedAtIso = '2026-10-18T09:00:00.000Z';

    await workout.saveWorkoutPendingSave({
      routineId: 'wrk_a',
      startedAtIso,
      phaseIndex: 2,
      elapsedSeconds: 400,
      enteredSets: ENTERED,
      dispositions: DISPOSITIONS,
    });
    const pending = await workout.getWorkoutPendingSave();
    expect(pending).not.toBeNull();

    // Model the committed log with the session's own start identity.
    await db.runAsync(
      `INSERT INTO workout_logs (id, routine_id, notes, completed_at, created_at, started_at, ended_at, duration_seconds)
       VALUES ('wrk_committed', 'wrk_a', NULL, ?, ?, ?, ?, 400)`,
      [startedAtIso, startedAtIso, startedAtIso, startedAtIso],
    );

    const reconciled = await workout.reconcileWorkoutPendingSave(pending!);
    expect(reconciled).toMatchObject({ status: 'saved', logId: 'wrk_committed' });
    // Reconciliation retires the recovery state, so a retry cannot re-insert.
    expect(await workout.getWorkoutPendingSave()).toBeNull();
    const logs = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workout_logs');
    expect(Number(logs?.n)).toBe(1);
    await db.closeAsync();
  }, 60000);

  it('a different routine or start time does not match (no false "already saved")', async () => {
    const db = await freshDatabase();
    await seedRoutine(db);
    const workout = await import('@/features/workout/workout.data');
    await db.runAsync(
      `INSERT INTO workout_logs (id, routine_id, notes, completed_at, created_at, started_at, ended_at, duration_seconds)
       VALUES ('wrk_other', 'wrk_a', NULL, ?, ?, ?, ?, 300)`,
      [
        '2026-10-17T09:00:00.000Z',
        '2026-10-17T09:00:00.000Z',
        '2026-10-17T09:00:00.000Z',
        '2026-10-17T09:05:00.000Z',
      ],
    );
    await workout.saveWorkoutPendingSave({
      routineId: 'wrk_a',
      startedAtIso: '2026-10-18T09:00:00.000Z',
      phaseIndex: 2,
      elapsedSeconds: 400,
      enteredSets: ENTERED,
      dispositions: DISPOSITIONS,
    });
    const pending = await workout.getWorkoutPendingSave();
    const reconciled = await workout.reconcileWorkoutPendingSave(pending!);
    expect(reconciled.status).toBe('pending');
    // The recovery state is untouched: the session still needs a save.
    expect(await workout.getWorkoutPendingSave()).not.toBeNull();
    await db.closeAsync();
  }, 60000);

  it('an explicit discard clears the state (the only non-commit path)', async () => {
    const db = await freshDatabase();
    await seedRoutine(db);
    const workout = await import('@/features/workout/workout.data');
    await workout.saveWorkoutPendingSave({
      routineId: 'wrk_a',
      startedAtIso: '2026-10-18T09:00:00.000Z',
      phaseIndex: 2,
      elapsedSeconds: 100,
      enteredSets: ENTERED,
      dispositions: DISPOSITIONS,
    });
    expect(await workout.getWorkoutPendingSave()).not.toBeNull();
    await workout.clearWorkoutPendingSave();
    expect(await workout.getWorkoutPendingSave()).toBeNull();
    await db.closeAsync();
  }, 60000);

  it('the screen clears the pending state only after a committed log id', async () => {
    const source = readSource('features/workout/WorkoutSessionScreen.tsx');
    // The clear must sit inside the committed branch (`save.saved && save.logId`).
    const committedBranch = source.indexOf('if (save.saved && save.logId) {');
    expect(committedBranch).toBeGreaterThan(-1);
    const clearIndex = source.indexOf('await clearWorkoutPendingSave();', committedBranch);
    expect(clearIndex).toBeGreaterThan(committedBranch);
    // And the failure branches re-persist rather than clear.
    const failureBranch = source.indexOf('await persistPendingSave(', clearIndex);
    expect(failureBranch).toBeGreaterThan(clearIndex);
  });
});

describe('AUD-SH04-A: a reopened summary re-collects EVERY completed exercise', () => {
  it('the durable cursor, not zero, drives the second save', async () => {
    // The audited defect: WorkoutScreen reopened a finished session with
    // `phaseIndex: 0`, and the collectors only walk phases up to that cursor — so
    // a three-exercise completed workout re-saved ONE record and silently dropped
    // the rest. This executes the real collectors at both cursors to prove the
    // difference, then asserts the screen restores the durable cursor.
    const { buildTimerSequence, collectSessionSetRecords, summarizeCompletedSets } =
      await import('@/features/workout/workout.domain');
    const routine = [
      { name: 'Bench', sets: [{ set_number: 1, active_seconds: 30, rest_seconds: 10 }] },
      { name: 'Row', sets: [{ set_number: 1, active_seconds: 30, rest_seconds: 10 }] },
      { name: 'Squat', sets: [{ set_number: 1, active_seconds: 30, rest_seconds: 10 }] },
    ];
    const sequence = buildTimerSequence(routine);
    const finishedCursor = sequence.length - 1;
    const dispositions = Object.fromEntries(
      sequence
        .map((phase, index) => (phase.phase === 'active' ? [index, 'completed' as const] : null))
        .filter((entry): entry is [number, 'completed'] => entry !== null),
    );

    const atZero = collectSessionSetRecords(sequence, 0, dispositions, {}, 'off');
    const atFinished = collectSessionSetRecords(sequence, finishedCursor, dispositions, {}, 'off');
    expect(atZero).toHaveLength(1);
    expect(atFinished).toHaveLength(3);
    expect(summarizeCompletedSets(sequence, finishedCursor, dispositions)).toHaveLength(3);

    // And the screen restores the durable cursor rather than 0.
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const screen = readFileSync(
      path.resolve(__dirname, '..', '..', 'features/workout/WorkoutScreen.tsx'),
      'utf8',
    );
    expect(screen).toContain('phaseIndex: pendingSave.phaseIndex');
    // The audited shape (`phaseIndex: 0` immediately before the pending-save
    // identity) must not reappear.
    expect(screen).not.toMatch(/phaseIndex: 0,\s*startedAtMs: Date\.parse\(pendingSave/);
  });
});

describe('AUD-SH04-B: a rejected pending-save write keeps the draft', () => {
  it('the completion effect awaits the write and only then clears the draft', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const source = readFileSync(
      path.resolve(__dirname, '..', '..', 'features/workout/WorkoutSessionScreen.tsx'),
      'utf8',
    );
    const effectStart = source.indexOf('const preserveRecovery = async () => {');
    expect(effectStart).toBeGreaterThan(-1);
    const effect = source.slice(effectStart, source.indexOf('}, [isComplete, clearDraft'));
    // The write is AWAITED inside a try, its failure RETURNS (leaving the draft),
    // and the clear comes after the try block.
    expect(effect).toContain('await saveWorkoutPendingSave({');
    expect(effect).toContain('catch {');
    const catchIndex = effect.indexOf('} catch {');
    const returnIndex = effect.indexOf('return;', catchIndex);
    const clearIndex = effect.indexOf('clearDraft();');
    expect(returnIndex).toBeGreaterThan(catchIndex);
    expect(clearIndex).toBeGreaterThan(returnIndex);
    // No fire-and-forget write remains on that path.
    expect(effect).not.toContain('void saveWorkoutPendingSave(');
  });
});
