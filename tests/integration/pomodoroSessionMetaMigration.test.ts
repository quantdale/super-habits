import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Real-SQLite proof for the legacy Pomodoro session-metadata promotion that
 * bootstrap now runs (see `core/providers/AppProviders.tsx` and
 * `features/pomodoro/pomodoro.sessionMeta.ts`). The unit suite proves the
 * normalization/join logic against a fake DB; this suite proves the guarded
 * COALESCE backfill, durable outbox intents, key retirement, and idempotency
 * against the real schema.
 */

const asyncStorage = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorage,
}));

const ASSOCIATIONS_KEY = 'superhabits.pomodoro.sessionAssociations';
const NOTES_KEY = 'superhabits.pomodoro.sessionNotes';

describe('legacy pomodoro session metadata promotion (real SQLite)', () => {
  let db: TestDatabase;

  beforeEach(() => {
    asyncStorage.store.clear();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('promotes matching rows once, retires the keys, and coalesces the update intent', async () => {
    db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const { migrateLegacySessionMeta } = await import('@/features/pomodoro/pomodoro.sessionMeta');

    await pomodoro.recordCompletedPomodoroSession({
      id: 'pom_legacy_1',
      startedAtIso: '2026-09-01T01:00:00.000Z',
      endedAtIso: '2026-09-01T01:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus',
    });

    asyncStorage.store.set(
      ASSOCIATIONS_KEY,
      JSON.stringify({
        pom_legacy_1: { todoId: 'todo_legacy_1', todoTitle: '  Legacy task  ' },
      }),
    );
    asyncStorage.store.set(NOTES_KEY, JSON.stringify({ pom_legacy_1: '  legacy note  ' }));

    const result = await migrateLegacySessionMeta();
    expect(result).toEqual({ associationsApplied: 1, notesApplied: 1, droppedEntries: 0 });

    const row = await db.getFirstAsync<{
      linked_todo_id: string | null;
      linked_todo_title: string | null;
      note: string | null;
    }>('SELECT linked_todo_id, linked_todo_title, note FROM pomodoro_sessions WHERE id = ?', [
      'pom_legacy_1',
    ]);
    expect(row).toEqual({
      linked_todo_id: 'todo_legacy_1',
      linked_todo_title: 'Legacy task',
      note: 'legacy note',
    });

    expect(asyncStorage.store.has(ASSOCIATIONS_KEY)).toBe(false);
    expect(asyncStorage.store.has(NOTES_KEY)).toBe(false);

    const intents = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'pomodoro_sessions' AND id = 'pom_legacy_1'`,
    );
    expect(intents.map((intent) => intent.operation)).toEqual(['update']);

    // A second pass is a no-op: keys are gone and no further intents appear.
    const second = await migrateLegacySessionMeta();
    expect(second).toEqual({ associationsApplied: 0, notesApplied: 0, droppedEntries: 0 });
    const intentsAfter = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'pomodoro_sessions' AND id = 'pom_legacy_1'`,
    );
    expect(intentsAfter.map((intent) => intent.operation)).toEqual(['update']);
  });

  it('never clobbers durable metadata and still fills NULL cells', async () => {
    db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const { migrateLegacySessionMeta } = await import('@/features/pomodoro/pomodoro.sessionMeta');

    await pomodoro.recordCompletedPomodoroSession({
      id: 'pom_legacy_2',
      startedAtIso: '2026-09-02T01:00:00.000Z',
      endedAtIso: '2026-09-02T01:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus',
    });
    expect(
      await pomodoro.setPomodoroSessionMeta({
        sessionId: 'pom_legacy_2',
        note: 'Durable note',
      }),
    ).toBe(true);

    asyncStorage.store.set(
      ASSOCIATIONS_KEY,
      JSON.stringify({
        pom_legacy_2: { todoId: 'todo_legacy_2', todoTitle: 'Linked task' },
      }),
    );
    asyncStorage.store.set(NOTES_KEY, JSON.stringify({ pom_legacy_2: 'Stale legacy note' }));

    const result = await migrateLegacySessionMeta();
    expect(result).toEqual({ associationsApplied: 1, notesApplied: 1, droppedEntries: 0 });

    const row = await db.getFirstAsync<{
      linked_todo_id: string | null;
      note: string | null;
    }>('SELECT linked_todo_id, note FROM pomodoro_sessions WHERE id = ?', ['pom_legacy_2']);
    expect(row).toEqual({ linked_todo_id: 'todo_legacy_2', note: 'Durable note' });
  });

  it('drops orphan and invalid entries without creating rows', async () => {
    db = await freshDatabase();
    const { migrateLegacySessionMeta } = await import('@/features/pomodoro/pomodoro.sessionMeta');

    asyncStorage.store.set(
      ASSOCIATIONS_KEY,
      JSON.stringify({
        pom_orphan: { todoId: 'todo_orphan', todoTitle: 'Orphan task' },
        pom_invalid: { todoId: 5 },
      }),
    );
    asyncStorage.store.set(
      NOTES_KEY,
      JSON.stringify({ pom_orphan: 'lost note', pom_blank: '   ' }),
    );

    const result = await migrateLegacySessionMeta();
    expect(result).toEqual({ associationsApplied: 0, notesApplied: 0, droppedEntries: 4 });

    const count = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM pomodoro_sessions',
    );
    expect(count?.n).toBe(0);
    expect(asyncStorage.store.has(ASSOCIATIONS_KEY)).toBe(false);
    expect(asyncStorage.store.has(NOTES_KEY)).toBe(false);
  });
});
