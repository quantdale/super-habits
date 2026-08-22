import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearWorkoutSessionDraft,
  getWorkoutSessionDraft,
  saveWorkoutSessionDraft,
} from '@/features/workout/workout.data';

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

vi.mock('@/core/db/client', () => ({
  getDatabase,
}));

function makeDb(storedValue: string | null) {
  return {
    getFirstAsync: vi.fn().mockResolvedValue(storedValue === null ? null : { value: storedValue }),
    runAsync: vi.fn().mockResolvedValue(undefined),
  };
}

describe('workout session draft persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('round-trips dispositions, entered measurements, and remaining seconds', async () => {
    const db = makeDb(null);
    getDatabase.mockResolvedValue(db);

    await saveWorkoutSessionDraft({
      routineId: 'routine_1',
      startedAtIso: '2026-08-21T10:00:00.000Z',
      phaseIndex: 3,
      elapsedAdjustSeconds: 420,
      dispositions: { 0: 'completed', 1: 'skipped' },
      enteredSets: { 0: { weight: '60', reps: '8' } },
      remainingSeconds: 17,
    });

    const writeCall = db.runAsync.mock.calls[0];
    const saved = JSON.parse(writeCall[1][1]) as Record<string, unknown>;
    expect(saved.dispositions).toEqual({ '0': 'completed', '1': 'skipped' });
    expect(saved.enteredSets).toEqual({ '0': { weight: '60', reps: '8' } });
    expect(saved.remainingSeconds).toBe(17);
  });

  it('reads a full draft back with all resumed state intact', async () => {
    const stored = {
      routineId: 'routine_1',
      startedAtIso: '2026-08-21T10:00:00.000Z',
      phaseIndex: 2,
      elapsedAdjustSeconds: 90,
      dispositions: { 0: 'completed', 1: 'completed', 2: 'skipped' },
      enteredSets: { 0: { weight: '80', reps: '5' }, 1: { weight: '', reps: '' } },
      remainingSeconds: 30,
    };
    const db = makeDb(JSON.stringify(stored));
    getDatabase.mockResolvedValue(db);

    const draft = await getWorkoutSessionDraft();
    expect(draft).toEqual({
      routineId: 'routine_1',
      startedAtIso: '2026-08-21T10:00:00.000Z',
      phaseIndex: 2,
      elapsedAdjustSeconds: 90,
      dispositions: { 0: 'completed', 1: 'completed', 2: 'skipped' },
      enteredSets: { 0: { weight: '80', reps: '5' }, 1: { weight: '', reps: '' } },
      remainingSeconds: 30,
    });
  });

  it('accepts a legacy draft without the extended fields (back-compat)', async () => {
    const legacy = {
      routineId: 'routine_1',
      startedAtIso: '2026-08-20T09:00:00.000Z',
      phaseIndex: 1,
      elapsedAdjustSeconds: 45,
    };
    const db = makeDb(JSON.stringify(legacy));
    getDatabase.mockResolvedValue(db);

    const draft = await getWorkoutSessionDraft();
    expect(draft).toEqual({
      routineId: 'routine_1',
      startedAtIso: '2026-08-20T09:00:00.000Z',
      phaseIndex: 1,
      elapsedAdjustSeconds: 45,
    });
    // No fabricated defaults for the missing fields.
    expect(draft?.dispositions).toBeUndefined();
    expect(draft?.enteredSets).toBeUndefined();
    expect(draft?.remainingSeconds).toBeUndefined();
  });

  it('drops invalid extended-field values while keeping a valid draft core', async () => {
    const messy = {
      routineId: 'routine_1',
      startedAtIso: '2026-08-21T10:00:00.000Z',
      phaseIndex: 1,
      dispositions: { 0: 'exploded', 1: 'skipped' },
      enteredSets: { 0: { weight: 60, reps: '8' }, 2: { weight: '40', reps: '10' } },
      remainingSeconds: -5,
    };
    const db = makeDb(JSON.stringify(messy));
    getDatabase.mockResolvedValue(db);

    const draft = await getWorkoutSessionDraft();
    expect(draft).toEqual({
      routineId: 'routine_1',
      startedAtIso: '2026-08-21T10:00:00.000Z',
      phaseIndex: 1,
      dispositions: { 1: 'skipped' },
      enteredSets: { 2: { weight: '40', reps: '10' } },
    });
  });

  it('rejects a malformed draft entirely', async () => {
    const db = makeDb(JSON.stringify({ routineId: '', startedAtIso: 'nope', phaseIndex: -1 }));
    getDatabase.mockResolvedValue(db);

    expect(await getWorkoutSessionDraft()).toBeNull();

    const dbEmpty = makeDb(null);
    getDatabase.mockResolvedValue(dbEmpty);
    expect(await getWorkoutSessionDraft()).toBeNull();
  });

  it('refuses to save an invalid draft', async () => {
    const db = makeDb(null);
    getDatabase.mockResolvedValue(db);

    await saveWorkoutSessionDraft({
      routineId: '',
      startedAtIso: 'not-a-date',
      phaseIndex: -2,
    });
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('clears the draft via deleteAppMetaKey', async () => {
    const db = makeDb(null);
    getDatabase.mockResolvedValue(db);

    await clearWorkoutSessionDraft();
    expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM app_meta WHERE key = ?', [
      'workout.active_session_draft',
    ]);
  });
});
