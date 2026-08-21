import { beforeEach, describe, expect, it, vi } from 'vitest';
import { duplicateRoutine } from '@/features/workout/workout.data';

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

vi.mock('@/core/db/client', () => ({
  getDatabase,
}));

vi.mock('@/core/linked-actions/linkedActions.engine', () => ({
  linkedActionsEngine: { processSourceAction: vi.fn() },
}));

/**
 * SQL-dispatched db mock: routes getFirstAsync/getAllAsync/runAsync by the
 * table the query touches, mirroring how the real data layer reads.
 */
function makeDb() {
  const routines: Record<string, unknown> = { routine_1: routineRow };
  const insertedExercises = new Set<string>();
  let newRoutineId: string | null = null;
  const inserted: { sql: string; params: unknown[] }[] = [];

  const db = {
    getFirstAsync: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM routine_exercises')) {
        // Join lookup from addSet/addExercise for a freshly inserted exercise.
        if (insertedExercises.has(String(params[0]))) {
          return { routine_id: newRoutineId };
        }
        return routines['routine_1'] ?? null;
      }
      if (sql.includes('FROM workout_routines')) {
        return newRoutineId && routines[newRoutineId]
          ? routines[newRoutineId]
          : (routines['routine_1'] ?? null);
      }
      return null;
    }),
    getAllAsync: vi.fn(async (sql: string) => {
      if (sql.includes('FROM routine_exercise_sets')) return setsByExercise;
      if (sql.includes('FROM routine_exercises')) return exercises;
      if (sql.includes('FROM workout_logs')) return [];
      return [];
    }),
    runAsync: vi.fn(async (sql: string, params?: unknown[]) => {
      inserted.push({ sql, params: params ?? [] });
      if (sql.includes('INSERT INTO workout_routines')) {
        newRoutineId = String(params?.[0]);
        routines[newRoutineId] = { id: params?.[0], deleted_at: null };
      }
      if (sql.includes('INSERT INTO routine_exercises')) {
        insertedExercises.add(String(params?.[0]));
      }
      return { changes: 1 };
    }),
  };
  return { db, inserted };
}

const routineRow = {
  id: 'routine_1',
  name: 'Push day',
  description: 'Bench + accessories',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
};

const exercises = [
  {
    id: 'ex_1',
    routine_id: 'routine_1',
    name: 'Bench Press',
    sort_order: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
  },
];

const setsByExercise = [
  {
    id: 'eset_1',
    exercise_id: 'ex_1',
    set_number: 1,
    active_seconds: 40,
    rest_seconds: 20,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
  },
];

describe('duplicateRoutine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the source routine is missing', async () => {
    const { db } = makeDb();
    db.getFirstAsync.mockResolvedValue(null);
    getDatabase.mockResolvedValue(db);
    await expect(duplicateRoutine('routine_1')).resolves.toBeNull();
  });

  it('creates a copied routine plus nested exercise/set rows with fresh ids', async () => {
    const { db, inserted } = makeDb();
    getDatabase.mockResolvedValue(db);

    const newId = await duplicateRoutine('routine_1');
    expect(newId).toMatch(/^wrk_/);
    expect(newId).not.toBe('routine_1');

    // New routine row with "(copy)" suffix.
    const routineInsert = inserted.find((i) => i.sql.includes('INSERT INTO workout_routines'));
    expect(routineInsert).toBeDefined();
    expect(routineInsert!.params[0]).toBe(newId);
    expect(routineInsert!.params[1]).toBe('Push day (copy)');
    expect(routineInsert!.params[2]).toBe('Bench + accessories');

    // Copied exercise row pointing at the new routine with an `ex_` id.
    const exerciseInsert = inserted.find((i) => i.sql.includes('INSERT INTO routine_exercises'));
    expect(exerciseInsert).toBeDefined();
    expect(String(exerciseInsert!.params[0])).toMatch(/^ex_/);
    expect(exerciseInsert!.params[1]).toBe(newId);
    expect(exerciseInsert!.params[2]).toBe('Bench Press');
    expect(exerciseInsert!.params[3]).toBe(1); // sort_order preserved

    // Copied set row with an `eset_` id and preserved timing.
    const setInsert = inserted.find((i) => i.sql.includes('INSERT INTO routine_exercise_sets'));
    expect(setInsert).toBeDefined();
    expect(String(setInsert!.params[0])).toMatch(/^eset_/);
    expect(setInsert!.params[1]).toBe(exerciseInsert!.params[0]);
    expect(setInsert!.params[2]).toBe(1); // set_number
    expect(setInsert!.params[3]).toBe(40); // active_seconds
    expect(setInsert!.params[4]).toBe(20); // rest_seconds
  });
});
