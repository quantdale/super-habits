import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addLocalDays, toDateKey } from '@/lib/time';
import { freshDatabase, type TestDatabase } from './helpers/db';

vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

const INSTANT = '2026-11-15T01:30:00.000Z';

describe('recurring undo follows durable spawn provenance, not the device timezone', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    vi.stubEnv('TZ', 'Asia/Manila');
    vi.setSystemTime(new Date(INSTANT));
    db = await freshDatabase();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    await db.closeAsync();
  });

  async function seed() {
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodo({
      title: 'Travel-safe recurring task',
      recurrence: 'daily',
      dueDate: '2026-11-01',
    });
    return { todos, id };
  }

  for (const mode of ['single', 'bulk'] as const) {
    it.each([
      ['Asia/Manila', 'Pacific/Honolulu'],
      ['Pacific/Honolulu', 'Asia/Manila'],
    ])(`${mode} undo retracts its own copy after moving from %s to %s`, async (from, to) => {
      vi.stubEnv('TZ', from);
      const { todos, id } = await seed();
      const due = addLocalDays(toDateKey(), 1);
      if (mode === 'single') await todos.completeTodo(id);
      else await todos.bulkSetTodoCompletion([id], 1);
      const copy = await db.getFirstAsync<{ id: string; due_date: string }>(
        'SELECT id,due_date FROM todos WHERE id<>? AND deleted_at IS NULL',
        [id],
      );
      expect(copy).toMatchObject({ due_date: due });
      if (!copy) throw new Error('Completion did not create a copy');
      vi.stubEnv('TZ', to);
      if (mode === 'single') await todos.setTodoCompletionState(id, 0);
      else await todos.bulkSetTodoCompletion([id], 0);
      expect(await db.getFirstAsync('SELECT completed FROM todos WHERE id=?', [id])).toEqual({
        completed: 0,
      });
      expect(
        await db.getAllAsync('SELECT id FROM todos WHERE id<>? AND deleted_at IS NULL', [id]),
      ).toEqual([]);
      expect(
        await db.getFirstAsync('SELECT operation FROM sync_outbox WHERE entity=? AND id=?', [
          'todos',
          copy.id,
        ]),
      ).toEqual({ operation: 'delete' });
    });
  }

  it('does not retract an unrelated rollover copy created in the same clock tick', async () => {
    const { todos, id } = await seed();
    const source = await db.getFirstAsync<{ recurrence_id: string }>(
      'SELECT recurrence_id FROM todos WHERE id=?',
      [id],
    );
    if (!source) throw new Error('Missing recurring source');
    await todos.createRecurringInstance({
      title: 'Travel-safe recurring task',
      notes: null,
      priority: 'normal',
      recurrenceId: source.recurrence_id,
      dueDate: addLocalDays(toDateKey(), 1),
    });
    const before = await db.getAllAsync('SELECT id FROM todos WHERE id<>? AND deleted_at IS NULL', [
      id,
    ]);
    expect(before).toHaveLength(1);
    await todos.completeTodo(id);
    await todos.setTodoCompletionState(id, 0);
    expect(
      await db.getAllAsync('SELECT id FROM todos WHERE id<>? AND deleted_at IS NULL', [id]),
    ).toEqual(before);
  });

  it.each(['single', 'bulk'] as const)(
    'rolls back %s completion and its intent if the spawn cannot commit',
    async (mode) => {
      const { todos, id } = await seed();
      const before = await db.getFirstAsync('SELECT * FROM todos WHERE id=?', [id]);
      const intents = await db.getAllAsync('SELECT * FROM sync_outbox ORDER BY entity,id');
      const original = db.runAsync.bind(db);
      vi.spyOn(db, 'runAsync').mockImplementation(async (sql, params) => {
        if (sql.includes('INSERT INTO todos')) throw new Error('Injected spawn write failure');
        return original(sql, params);
      });
      const completing =
        mode === 'single' ? todos.completeTodo(id) : todos.bulkSetTodoCompletion([id], 1);
      await expect(completing).rejects.toThrow('Injected spawn write failure');
      expect(await db.getFirstAsync('SELECT * FROM todos WHERE id=?', [id])).toEqual(before);
      expect(await db.getAllAsync('SELECT * FROM sync_outbox ORDER BY entity,id')).toEqual(intents);
      expect(await db.getAllAsync('SELECT id FROM todos WHERE id<>?', [id])).toEqual([]);
    },
  );

  it('preserves the exact spawn link through portable recovery in another timezone', async () => {
    const { todos, id } = await seed();
    await todos.completeTodo(id);
    const { exportPortableBackup } = await import('@/core/portable/portableExport');
    const exported = await exportPortableBackup();
    if (!exported.ok) throw new Error(exported.error);
    await db.closeAsync();
    vi.stubEnv('TZ', 'Pacific/Honolulu');
    db = await freshDatabase();
    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const preview = await preparePortableImport({
      fileName: exported.fileName,
      text: exported.json,
    });
    if (preview.status !== 'ready') throw new Error('Current backup did not preview');
    expect((await confirmPortableImport({ file: preview.file })).status).toBe('restored');
    const restored = await import('@/features/todos/todos.data');
    await restored.setTodoCompletionState(id, 0);
    expect(
      await db.getAllAsync('SELECT id FROM todos WHERE id<>? AND deleted_at IS NULL', [id]),
    ).toEqual([]);
  });
});
