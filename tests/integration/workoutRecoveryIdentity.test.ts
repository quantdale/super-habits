import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';

vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));

const START = '2026-10-20T09:00:00.000Z';
const ENTERED = {
  '0': { weight: '50', reps: '8', effort: '2' },
  '1': { weight: '55', reps: '9', effort: '3' },
  '2': { weight: '60', reps: '10', effort: '1' },
  '3': { weight: '', reps: '', duration: '95' },
};

/** Execute the screen's actual callback with native/UI boundaries stubbed.
 * This catches caller catch/default behavior without a fabricated counterpart
 * implementation or a source-string assertion. SQLite/data functions are real. */
function screenCallback(
  name: string,
  dependencies: Record<string, unknown>,
  screen = 'WorkoutScreen',
) {
  const filename = path.resolve(__dirname, `../../features/workout/${screen}.tsx`);
  const source = ts.createSourceFile(
    filename,
    readFileSync(filename, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let callback = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer) {
      callback = ts.isCallExpression(node.initializer)
        ? node.initializer.arguments[0].getText(source)
        : node.initializer.getText(source);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!callback) throw new Error(`Missing screen callback ${name}`);
  const compiled = ts.transpileModule(
    `const callback = ${callback}; exports.callback = callback;`,
    {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    },
  ).outputText;
  const exports: { callback?: (...args: unknown[]) => Promise<void> } = {};
  runInNewContext(compiled, { exports, Error, ...dependencies });
  return exports.callback!;
}

async function fixture() {
  const db = await freshDatabase();
  await db.runAsync(
    `INSERT INTO workout_routines (id,name,description,created_at,updated_at,deleted_at)
     VALUES ('wrk_performed','Performed routine',NULL,?,?,NULL)`,
    [START, START],
  );
  for (const [id, order, catalog, modality, load] of [
    ['ex_weighted', 0, 'cex_weighted', 'weighted_strength', 1],
    ['ex_timed', 1, 'cex_timed', 'timed', 0],
  ] as const) {
    await db.runAsync(
      `INSERT INTO routine_exercises
        (id,routine_id,name,sort_order,catalog_exercise_id,modality,unilateral,supports_external_load,created_at,updated_at,deleted_at)
       VALUES (?,'wrk_performed','Same name',?,?,?,?,?,?,?,NULL)`,
      [id, order, catalog, modality, 0, load, START, START],
    );
    for (const number of order === 0 ? [1, 2] : [1]) {
      await db.runAsync(
        `INSERT INTO routine_exercise_sets
          (id,exercise_id,set_number,active_seconds,rest_seconds,target_duration_seconds,created_at,updated_at,deleted_at)
         VALUES (?,?,?,30,0,?,?,?,NULL)`,
        [`${id}_set_${number}`, id, number, order === 1 ? 90 : null, START, START],
      );
    }
  }
  const workout = await import('@/features/workout/workout.data');
  const domain = await import('@/features/workout/workout.domain');
  const view = await import('@/features/workout/workoutSessionView');
  const routine = (await workout.getRoutineWithExercises('wrk_performed'))!;
  const sequence = domain.buildTimerSequence(
    view.appendAddedSets(domain.buildSessionExerciseInputs(routine), { 0: 1 }),
  );
  const pending = {
    routineId: routine.id,
    routineName: routine.name,
    exerciseNames: sequence.map((phase) => phase.exerciseName),
    routineSnapshot: routine,
    startedAtIso: START,
    phaseIndex: sequence.length - 1,
    elapsedSeconds: 400,
    enteredSets: ENTERED,
    dispositions: {
      '0': 'completed',
      '1': 'completed',
      '2': 'completed',
      '3': 'completed',
    } as const,
    addedSets: { '0': 1 },
    notes: 'Keep these notes',
    effortScale: 'rir' as const,
  };
  return { db, workout, domain, view, routine, sequence, pending };
}

describe('R3-01: durable pending state is a fail-closed start boundary', () => {
  it('admits an empty slot and adopts a pending row despite stale React state', async () => {
    const { db, workout, pending } = await fixture();
    try {
      const setCurrentView = vi.fn();
      const setPendingSave = vi.fn();
      const viewPending = vi.fn();
      const alert = vi.fn();
      const start = screenCallback('startRoutineById', {
        prepareWorkoutSessionStart: workout.prepareWorkoutSessionStart,
        pendingSave: null,
        setCurrentView,
        setPendingSave,
        confirm: vi.fn(async () => true),
        startRoutineRef: { current: viewPending },
        Alert: { alert },
      });
      await start('wrk_performed');
      expect(setCurrentView).toHaveBeenCalledOnce();
      setCurrentView.mockClear();
      await workout.saveWorkoutPendingSave(pending);
      await start('wrk_performed');
      expect(setCurrentView).not.toHaveBeenCalled();
      expect(setPendingSave).toHaveBeenCalledWith(expect.objectContaining({ startedAtIso: START }));
      expect(viewPending).toHaveBeenCalledWith(
        expect.objectContaining({ routineId: 'wrk_performed' }),
      );
      expect(alert).not.toHaveBeenCalled();
    } finally {
      await db.closeAsync();
    }
  });

  it.each(['busy', 'malformed'])('refuses a new session when inspection is %s', async (failure) => {
    const { db, workout, pending } = await fixture();
    try {
      await workout.saveWorkoutPendingSave(pending);
      const originalBytes = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_meta WHERE key = 'workout.pending_save'",
      );
      if (failure === 'malformed') {
        await db.runAsync(
          "UPDATE app_meta SET value = '{broken' WHERE key = 'workout.pending_save'",
        );
      } else {
        const read = db.getFirstAsync.bind(db);
        // Subsequent reads use real SQLite, including the preservation assertion.
        vi.spyOn(db, 'getFirstAsync')
          .mockImplementation(read)
          .mockRejectedValueOnce(new Error('SQLITE_BUSY'));
      }
      const setCurrentView = vi.fn();
      const alert = vi.fn();
      const start = screenCallback('startRoutineById', {
        prepareWorkoutSessionStart: workout.prepareWorkoutSessionStart,
        pendingSave: null,
        setCurrentView,
        setPendingSave: vi.fn(),
        confirm: vi.fn(),
        startRoutineRef: { current: vi.fn() },
        Alert: { alert },
      });
      await start('wrk_performed');
      expect(setCurrentView).not.toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith(
        'Could not check finished workouts',
        expect.stringContaining('kept'),
      );
      const preserved = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_meta WHERE key = 'workout.pending_save'",
      );
      expect(preserved?.value).toBe(failure === 'malformed' ? '{broken' : originalBytes?.value);
    } finally {
      vi.restoreAllMocks();
      await db.closeAsync();
    }
  });

  it('refuses a different session at the durable write boundary too', async () => {
    const { db, workout, pending } = await fixture();
    try {
      await workout.saveWorkoutPendingSave(pending);
      await expect(
        workout.saveWorkoutPendingSave({ ...pending, startedAtIso: '2026-10-20T10:00:00.000Z' }),
      ).rejects.toThrow('existing finished workout');
      expect((await workout.getWorkoutPendingSave())?.startedAtIso).toBe(START);
    } finally {
      await db.closeAsync();
    }
  });

  it('a delayed cleanup for a discarded session cannot clear its replacement', async () => {
    const { db, workout, pending } = await fixture();
    try {
      await workout.saveWorkoutPendingSave(pending);
      await workout.clearWorkoutPendingSave(pending);
      const replacement = { ...pending, startedAtIso: '2026-10-20T10:00:00.000Z' };
      await workout.saveWorkoutPendingSave(replacement);
      await workout.clearWorkoutPendingSave(pending);
      expect((await workout.getWorkoutPendingSave())?.startedAtIso).toBe(replacement.startedAtIso);
    } finally {
      await db.closeAsync();
    }
  });

  it('retains an all-skipped summary even when no measurements were entered', async () => {
    const { db, workout, pending } = await fixture();
    try {
      await workout.saveWorkoutPendingSave({
        ...pending,
        enteredSets: {},
        dispositions: { '0': 'skipped' },
      });
      expect((await workout.getWorkoutPendingSave())?.enteredSets).toEqual({});
      expect((await workout.prepareWorkoutSessionStart('wrk_performed')).status).toBe('pending');
    } finally {
      await db.closeAsync();
    }
  });
});

describe('R3-02: performed identity survives mutable routine edits', () => {
  it.each(['unchanged', 'reordered', 'deleted'] as const)(
    'recovers every set when the routine is %s',
    async (change) => {
      const { db, workout, domain, view, sequence, pending } = await fixture();
      try {
        await workout.saveWorkoutPendingSave(pending);
        if (change === 'reordered') {
          await db.runAsync(
            "UPDATE routine_exercises SET sort_order = 1 - sort_order WHERE routine_id = 'wrk_performed'",
          );
          await db.runAsync(
            'UPDATE routine_exercise_sets SET active_seconds = 7, target_duration_seconds = 7',
          );
          await db.runAsync(
            "UPDATE workout_routines SET name = 'Renamed later' WHERE id = 'wrk_performed'",
          );
        } else if (change === 'deleted') {
          await workout.deleteRoutine('wrk_performed');
        }
        const restored = (await workout.getWorkoutPendingSave())!;
        const setCurrentView = vi.fn();
        const retry = screenCallback('handleRetryPendingSave', {
          pendingSave: restored,
          reconcileWorkoutPendingSave: workout.reconcileWorkoutPendingSave,
          getPendingWorkoutRoutine: domain.getPendingWorkoutRoutine,
          setCurrentView,
          setPendingSave: vi.fn(),
          refresh: vi.fn(),
          Alert: { alert: vi.fn() },
        });
        await retry();
        expect(setCurrentView).toHaveBeenCalledOnce();
        const recovered = setCurrentView.mock.calls[0][0];
        expect(recovered.routine.exercises.map((exercise: { id: string }) => exercise.id)).toEqual([
          'ex_weighted',
          'ex_timed',
        ]);
        expect(recovered.resume).toMatchObject({
          notes: pending.notes,
          effortScale: 'rir',
          alreadyFinished: true,
        });
        const replay = domain.buildTimerSequence(
          view.appendAddedSets(
            domain.buildSessionExerciseInputs(recovered.routine),
            recovered.resume.addedSets,
          ),
        );
        expect(replay).toEqual(sequence);
        const records = domain.collectSessionSetRecords(
          replay,
          recovered.resume.phaseIndex,
          recovered.resume.dispositions,
          recovered.resume.enteredSets,
          recovered.resume.effortScale,
        );
        expect(records).toHaveLength(4);
        expect(records.slice(0, 3).map((set) => [set.weight, set.reps])).toEqual([
          [50, 8],
          [55, 9],
          [60, 10],
        ]);
        expect(records[3]).toMatchObject({
          catalogExerciseId: 'cex_timed',
          modality: 'timed',
          durationSeconds: 95,
          weight: null,
          reps: null,
        });
        const exercises = domain.buildSessionLogExercises(
          recovered.routine,
          domain.summarizeCompletedSets(replay, restored.phaseIndex, restored.dispositions),
          records,
          'kg',
        );
        const result = await workout.logWorkoutSession({
          routineId: restored.routineId,
          startedAt: restored.startedAtIso,
          exercises,
          notes: restored.notes,
          activeDurationSeconds: restored.elapsedSeconds,
        });
        expect(result.status).toBe('applied');
        expect(
          (
            await db.getFirstAsync<{ routine_name: string }>(
              'SELECT routine_name FROM workout_logs WHERE id = ?',
              [result.logId],
            )
          )?.routine_name,
        ).toBe('Performed routine');
        const saved = await db.getAllAsync<{
          catalog_exercise_id: string;
          modality: string;
          set_number: number;
          weight: number | null;
          reps: number | null;
          duration_seconds: number | null;
        }>(
          `SELECT e.catalog_exercise_id,e.modality,s.set_number,s.weight,s.reps,s.duration_seconds
         FROM workout_session_exercises e JOIN workout_session_sets s ON s.session_exercise_id = e.id
         ORDER BY e.catalog_exercise_id DESC,s.set_number`,
        );
        expect(
          saved
            .filter((set) => set.catalog_exercise_id === 'cex_weighted')
            .map((set) => [set.set_number, set.weight, set.reps]),
        ).toEqual([
          [1, 50, 8],
          [2, 55, 9],
          [3, 60, 10],
        ]);
        expect(saved.find((set) => set.catalog_exercise_id === 'cex_timed')).toMatchObject({
          duration_seconds: 95,
          weight: null,
          reps: null,
        });
        // Retry before cleanup returns the same committed identity and no new rows.
        const retried = await workout.logWorkoutSession({
          routineId: restored.routineId,
          startedAt: restored.startedAtIso,
          exercises,
        });
        expect(retried.logId).toBe(result.logId);
        expect(
          (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workout_logs'))?.n,
        ).toBe(1);
        expect(await workout.reconcileWorkoutPendingSave(restored)).toEqual({
          status: 'saved',
          logId: result.logId,
        });
        expect(await workout.getWorkoutPendingSave()).toBeNull();
      } finally {
        await db.closeAsync();
      }
    },
  );

  it('preserves legacy values without guessing identities absent from the payload', async () => {
    const { db, workout, domain, pending } = await fixture();
    try {
      const { routineSnapshot: _snapshot, exerciseNames: _names, ...legacy } = pending;
      await db.runAsync("INSERT INTO app_meta (key,value) VALUES ('workout.pending_save',?)", [
        JSON.stringify(legacy),
      ]);
      const restored = (await workout.getWorkoutPendingSave())!;
      expect(restored.enteredSets).toEqual(ENTERED);
      expect(() => domain.getPendingWorkoutRoutine(restored)).toThrow('older finished workout');
      expect((await workout.prepareWorkoutSessionStart('wrk_performed')).status).toBe('pending');
      expect((await workout.getWorkoutPendingSave())?.enteredSets).toEqual(ENTERED);
    } finally {
      await db.closeAsync();
    }
  });
});

describe('active workout drafts preserve performed identity', () => {
  it('the live screen actually persists the full template and summary metadata', async () => {
    const { db, workout, pending, routine } = await fixture();
    try {
      const save = vi.fn(workout.saveWorkoutSessionDraft);
      const persist = screenCallback(
        'persistDraft',
        {
          routine,
          notes: pending.notes,
          effortScale: pending.effortScale,
          startedAtMsRef: { current: Date.parse(START) },
          draftClearGenerationRef: { current: 0 },
          dispositionsRef: { current: pending.dispositions },
          enteredSetsRef: { current: pending.enteredSets },
          elapsedSecondsRef: { current: 300 },
          remainingRef: { current: 12 },
          addedSets: pending.addedSets,
          saveWorkoutSessionDraft: save,
          clearWorkoutSessionDraft: workout.clearWorkoutSessionDraft,
        },
        'WorkoutSessionScreen',
      );
      await persist(pending.phaseIndex);
      await save.mock.results[0].value;
      expect(await workout.getWorkoutSessionDraft()).toMatchObject({
        routineSnapshot: routine,
        notes: pending.notes,
        effortScale: 'rir',
        phaseIndex: pending.phaseIndex,
        enteredSets: ENTERED,
      });
    } finally {
      await db.closeAsync();
    }
  });
  it.each(['unchanged', 'reordered', 'deleted'] as const)(
    'resumes the performed template when %s',
    async (change) => {
      const { db, workout, domain, view, pending, sequence } = await fixture();
      try {
        await workout.saveWorkoutSessionDraft({
          ...pending,
          elapsedAdjustSeconds: 300,
          remainingSeconds: 12,
        });
        if (change === 'reordered') {
          await db.runAsync(
            "UPDATE routine_exercises SET sort_order = 1 - sort_order WHERE routine_id = 'wrk_performed'",
          );
          await db.runAsync(
            'UPDATE routine_exercise_sets SET active_seconds = 7, target_duration_seconds = 7',
          );
        } else if (change === 'deleted') {
          await workout.deleteRoutine(pending.routineId);
        }
        const restored = (await workout.getWorkoutSessionDraft())!;
        const setCurrentView = vi.fn();
        await screenCallback('handleResumeDraft', {
          draft: restored,
          getDraftWorkoutRoutine: domain.getDraftWorkoutRoutine,
          setCurrentView,
          Alert: { alert: vi.fn() },
        })();
        expect(setCurrentView).toHaveBeenCalledOnce();
        const recovered = setCurrentView.mock.calls[0][0];
        expect(recovered.resume).toMatchObject({
          notes: pending.notes,
          effortScale: 'rir',
          phaseIndex: pending.phaseIndex,
          elapsedSeconds: 300,
          remainingSeconds: 12,
        });
        expect(recovered.resume.alreadyFinished).toBeUndefined();
        const replay = domain.buildTimerSequence(
          view.appendAddedSets(
            domain.buildSessionExerciseInputs(recovered.routine),
            recovered.resume.addedSets,
          ),
        );
        expect(replay).toEqual(sequence);
        expect(
          domain
            .collectSessionSetRecords(
              replay,
              recovered.resume.phaseIndex,
              recovered.resume.dispositions,
              recovered.resume.enteredSets,
              recovered.resume.effortScale,
            )
            .map((set) => [set.weight, set.reps, set.durationSeconds]),
        ).toEqual([
          [50, 8, undefined],
          [55, 9, undefined],
          [60, 10, undefined],
          [null, null, 95],
        ]);
      } finally {
        await db.closeAsync();
      }
    },
  );

  it('blocks a fresh start on a durable draft despite stale React state, and decline keeps it', async () => {
    const { db, workout, pending } = await fixture();
    try {
      await workout.saveWorkoutSessionDraft(pending);
      const setCurrentView = vi.fn();
      const resume = vi.fn();
      const confirm = vi.fn(async () => false);
      const setDraft = vi.fn();
      const start = screenCallback('startRoutineById', {
        prepareWorkoutSessionStart: workout.prepareWorkoutSessionStart,
        pendingSave: null,
        setCurrentView,
        setPendingSave: vi.fn(),
        setDraft,
        confirm,
        startRoutineRef: { current: vi.fn() },
        resumeDraftRef: { current: resume },
        Alert: { alert: vi.fn() },
      });
      await start(pending.routineId);
      expect(setCurrentView).not.toHaveBeenCalled();
      expect(setDraft).toHaveBeenCalledWith(expect.objectContaining({ startedAtIso: START }));
      expect(resume).not.toHaveBeenCalled();
      expect((await workout.getWorkoutSessionDraft())?.startedAtIso).toBe(START);
      confirm.mockResolvedValue(true);
      await start(pending.routineId);
      expect(resume).toHaveBeenCalledOnce();
      await workout.saveWorkoutPendingSave(pending);
      expect((await workout.prepareWorkoutSessionStart(pending.routineId)).status).toBe('pending');
    } finally {
      await db.closeAsync();
    }
  });

  it.each(['busy', 'malformed'])(
    'fails closed when active draft inspection is %s',
    async (failure) => {
      const { db, workout, pending } = await fixture();
      try {
        await workout.saveWorkoutSessionDraft(pending);
        if (failure === 'malformed')
          await db.runAsync(
            "UPDATE app_meta SET value = '{broken' WHERE key = 'workout.active_session_draft'",
          );
        else {
          const read = db.getFirstAsync.bind(db);
          vi.spyOn(db, 'getFirstAsync').mockImplementation(async (...args) => {
            if (args[1]?.[0] === 'workout.active_session_draft') throw new Error('SQLITE_BUSY');
            return read(...args);
          });
        }
        const setCurrentView = vi.fn();
        const alert = vi.fn();
        await screenCallback('startRoutineById', {
          prepareWorkoutSessionStart: workout.prepareWorkoutSessionStart,
          pendingSave: null,
          setCurrentView,
          setPendingSave: vi.fn(),
          setDraft: vi.fn(),
          confirm: vi.fn(),
          startRoutineRef: { current: vi.fn() },
          resumeDraftRef: { current: vi.fn() },
          Alert: { alert },
        })(pending.routineId);
        expect(setCurrentView).not.toHaveBeenCalled();
        expect(alert).toHaveBeenCalledOnce();
      } finally {
        vi.restoreAllMocks();
        await db.closeAsync();
      }
    },
  );

  it('keeps legacy ambiguous values without reconstructing from the edited routine', async () => {
    const { db, workout, domain, pending } = await fixture();
    try {
      const { routineSnapshot: _snapshot, ...legacy } = pending;
      await workout.saveWorkoutSessionDraft(legacy);
      const restored = (await workout.getWorkoutSessionDraft())!;
      expect(restored.enteredSets).toEqual(ENTERED);
      const setCurrentView = vi.fn();
      const alert = vi.fn();
      await screenCallback('handleResumeDraft', {
        draft: restored,
        getDraftWorkoutRoutine: domain.getDraftWorkoutRoutine,
        setCurrentView,
        Alert: { alert },
      })();
      expect(setCurrentView).not.toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith(
        'Workout recovery unavailable',
        expect.stringContaining('older workout draft'),
      );
      expect((await workout.getWorkoutSessionDraft())?.enteredSets).toEqual(ENTERED);
    } finally {
      await db.closeAsync();
    }
  });

  it('identity checks prevent stale writes and cleanup from damaging a replacement draft', async () => {
    const { db, workout, pending } = await fixture();
    try {
      await workout.saveWorkoutSessionDraft(pending);
      const replacement = { ...pending, startedAtIso: '2026-10-20T10:00:00.000Z' };
      await expect(workout.saveWorkoutSessionDraft(replacement)).rejects.toThrow(
        'existing workout',
      );
      await workout.clearWorkoutSessionDraft(pending);
      await workout.saveWorkoutSessionDraft(replacement);
      await workout.clearWorkoutSessionDraft(pending);
      await expect(workout.saveWorkoutSessionDraft(pending)).rejects.toThrow('existing workout');
      expect((await workout.getWorkoutSessionDraft())?.startedAtIso).toBe(replacement.startedAtIso);
    } finally {
      await db.closeAsync();
    }
  });

  it('discarding or reconciling a completed workout retires only its matching active draft', async () => {
    const { db, workout, pending } = await fixture();
    try {
      await workout.saveWorkoutSessionDraft(pending);
      await workout.saveWorkoutPendingSave(pending);
      await workout.clearWorkoutPendingSave(pending);
      expect(await workout.getWorkoutSessionDraft()).toBeNull();
      const replacement = { ...pending, startedAtIso: '2026-10-20T10:00:00.000Z' };
      await workout.saveWorkoutSessionDraft(replacement);
      await workout.saveWorkoutPendingSave(pending);
      await workout.clearWorkoutPendingSave(pending);
      expect((await workout.getWorkoutSessionDraft())?.startedAtIso).toBe(replacement.startedAtIso);
    } finally {
      await db.closeAsync();
    }
  });

  it.each([false, true])(
    'leaving a completed summary keeps pending recovery and does not resurrect a draft (failure=%s)',
    async (failure) => {
      const { db, workout, pending } = await fixture();
      try {
        const persistPendingSave = vi.fn(
          screenCallback(
            'persistPendingSave',
            {
              startedAtMsRef: { current: Date.parse(START) },
              routine: pending.routineSnapshot,
              notes: pending.notes,
              effortScale: pending.effortScale,
              sequence: [],
              addedSets: pending.addedSets,
              currentIndexRef: { current: pending.phaseIndex },
              elapsedSecondsRef: { current: pending.elapsedSeconds },
              enteredSetsRef: { current: pending.enteredSets },
              dispositionsRef: { current: pending.dispositions },
              saveWorkoutPendingSave: failure
                ? async () => {
                    throw new Error('SQLITE_BUSY');
                  }
                : workout.saveWorkoutPendingSave,
            },
            'WorkoutSessionScreen',
          ),
        );
        const persistDraft = vi.fn();
        const onCancel = vi.fn();
        const setSaveError = vi.fn();
        await screenCallback(
          'handleCancel',
          {
            confirm: vi.fn(async () => true),
            setIsRunning: vi.fn(),
            isComplete: true,
            persistPendingSave,
            persistDraft,
            currentIndexRef: { current: 3 },
            onCancel,
            setSaveError,
          },
          'WorkoutSessionScreen',
        )();
        expect(persistPendingSave).toHaveBeenCalledOnce();
        expect(persistDraft).not.toHaveBeenCalled();
        expect(await workout.getWorkoutSessionDraft()).toBeNull();
        if (failure) {
          expect(onCancel).not.toHaveBeenCalled();
          expect(setSaveError).toHaveBeenCalledOnce();
        } else {
          expect(onCancel).toHaveBeenCalledOnce();
          expect((await workout.getWorkoutPendingSave())?.enteredSets).toEqual(ENTERED);
        }
      } finally {
        await db.closeAsync();
      }
    },
  );
});
