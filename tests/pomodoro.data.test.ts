import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enqueuePendingPomodoroLog,
  logPomodoroSession,
  logPomodoroSessionFromLinkedAction,
  POMODORO_PENDING_LOG_MAX_ATTEMPTS,
  recordCompletedPomodoroSession,
  retryPendingPomodoroLogs,
  setPomodoroSessionMeta,
} from '@/features/pomodoro/pomodoro.data';
import { migrateLegacySessionMeta } from '@/features/pomodoro/pomodoro.sessionMeta';

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

const { linkedActionsEngine } = vi.hoisted(() => ({
  linkedActionsEngine: {
    processSourceAction: vi.fn(),
  },
}));

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

vi.mock('@/core/db/client', () => ({
  getDatabase,
}));

vi.mock('@/core/linked-actions/linkedActions.engine', () => ({
  linkedActionsEngine,
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorage,
}));

type Statement = { sql: string; params: unknown[] };

/**
 * Minimal app_meta/pomodoro_sessions-aware double. Tracks inserted session ids
 * so dedupe/existence SELECTs behave like the real table, records every
 * statement for assertions, and exposes a mutable `failSessionWrites` toggle
 * to simulate transient SQLite/OPFS failures on entity writes only.
 */
function createFakeDb(options: { existingSessionIds?: string[] } = {}) {
  const meta = new Map<string, string>();
  const insertedSessionIds = new Set<string>(options.existingSessionIds ?? []);
  const calls: Statement[] = [];
  const state = { failSessionWrites: false };
  const db = {
    meta,
    calls,
    insertedSessionIds,
    state,
    runAsync: vi.fn(async (sql: string, params?: unknown[]) => {
      if (state.failSessionWrites && sql.includes('pomodoro_sessions')) {
        throw new Error('db write failed');
      }
      const p = params ?? [];
      calls.push({ sql, params: p });
      if (sql.includes('INSERT INTO pomodoro_sessions')) {
        insertedSessionIds.add(String(p[0]));
      }
      if (sql.includes('app_meta') && sql.includes('INSERT OR REPLACE')) {
        meta.set(String(p[0]), String(p[1]));
      }
      return { changes: 1, lastInsertRowId: 1 };
    }),
    getFirstAsync: vi.fn(async (sql: string, params?: unknown[]) => {
      const p = params ?? [];
      if (sql.includes('FROM app_meta')) {
        const value = meta.get(String(p[0]));
        return value === undefined ? null : { value };
      }
      if (sql.includes('FROM pomodoro_sessions')) {
        if (sql.includes('WHERE id = ?')) {
          return insertedSessionIds.has(String(p[0]))
            ? { id: String(p[0]), session_type: 'focus' }
            : null;
        }
        // started_at existence probe used by crash reconciliation.
        return null;
      }
      if (sql.includes('FROM sync_outbox')) return null;
      return null;
    }),
    getAllAsync: vi.fn(async () => []),
  };
  return db;
}

function sessionInsertCalls(calls: Statement[]): Statement[] {
  return calls.filter(
    (c) =>
      c.sql.includes('INSERT INTO pomodoro_sessions') || c.sql.includes('UPDATE pomodoro_sessions'),
  );
}

describe('features/pomodoro/pomodoro.data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asyncStorage.store.clear();
  });

  it('writes pomodoro sessions for manual logs', async () => {
    const db = createFakeDb();
    getDatabase.mockResolvedValue(db);

    await logPomodoroSession('2026-04-16T10:00:00.000Z', '2026-04-16T10:25:00.000Z', 1500, 'focus');

    expect(sessionInsertCalls(db.calls)).toHaveLength(1);
    const insert = db.calls.find((c) => c.sql.includes('INSERT INTO pomodoro_sessions'));
    expect(insert?.params).toEqual([
      expect.stringMatching(/^pom_/),
      '2026-04-16T10:00:00.000Z',
      '2026-04-16T10:25:00.000Z',
      1500,
      'focus',
      expect.any(String),
      null,
      null,
      null,
    ]);
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
  });

  it('writes pomodoro break sessions with the provided session type', async () => {
    const db = createFakeDb();
    getDatabase.mockResolvedValue(db);

    await logPomodoroSession(
      '2026-04-16T11:00:00.000Z',
      '2026-04-16T11:05:00.000Z',
      300,
      'short_break',
    );

    const insert = db.calls.find((c) => c.sql.includes('INSERT INTO pomodoro_sessions'));
    expect(insert?.params).toContain('short_break');
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
  });

  it('writes association and note metadata atomically on the inserted row', async () => {
    const db = createFakeDb();
    getDatabase.mockResolvedValue(db);

    await recordCompletedPomodoroSession({
      startedAtIso: '2026-04-16T10:00:00.000Z',
      endedAtIso: '2026-04-16T10:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus',
      meta: { linkedTodoId: 'todo_1', linkedTodoTitle: 'Ship it', note: 'deep work' },
    });

    const insert = db.calls.find((c) => c.sql.includes('INSERT INTO pomodoro_sessions'));
    expect(insert?.params).toEqual([
      expect.stringMatching(/^pom_/),
      '2026-04-16T10:00:00.000Z',
      '2026-04-16T10:25:00.000Z',
      1500,
      'focus',
      expect.any(String),
      'todo_1',
      'Ship it',
      'deep work',
    ]);
  });

  it('inserts exactly one row when the same completion id is recorded twice', async () => {
    // Regression for the duplicate-row vector: a replayed completion handler
    // (or pending-log retry) reuses one id, and dedupe-by-id absorbs it.
    const db = createFakeDb();
    getDatabase.mockResolvedValue(db);

    const first = await recordCompletedPomodoroSession({
      id: 'pom_fixed',
      startedAtIso: '2026-04-16T10:00:00.000Z',
      endedAtIso: '2026-04-16T10:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus',
    });
    const second = await recordCompletedPomodoroSession({
      id: first.id,
      startedAtIso: '2026-04-16T10:00:00.000Z',
      endedAtIso: '2026-04-16T10:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus',
    });

    expect(first).toEqual({ id: 'pom_fixed', inserted: true });
    expect(second).toEqual({ id: 'pom_fixed', inserted: false });
    expect(sessionInsertCalls(db.calls)).toHaveLength(1);
  });

  it('mints distinct ids per completion when none is supplied', async () => {
    vi.useFakeTimers();
    try {
      const db = createFakeDb();
      getDatabase.mockResolvedValue(db);

      vi.setSystemTime(new Date('2026-04-16T12:00:00.000Z'));
      const first = await recordCompletedPomodoroSession({
        startedAtIso: '2026-04-16T10:00:00.000Z',
        endedAtIso: '2026-04-16T10:25:00.000Z',
        durationSeconds: 1500,
        type: 'focus',
      });
      // Advance the clock so the second mint gets a fresh timestamp (the
      // deterministic expo-crypto test mock would otherwise collide ids
      // within one millisecond; production randomness does not).
      vi.setSystemTime(new Date('2026-04-16T12:00:01.000Z'));
      const second = await recordCompletedPomodoroSession({
        startedAtIso: '2026-04-16T11:00:00.000Z',
        endedAtIso: '2026-04-16T11:25:00.000Z',
        durationSeconds: 1500,
        type: 'focus',
      });

      expect(first.id).not.toBe(second.id);
      expect(first.inserted).toBe(true);
      expect(second.inserted).toBe(true);
      expect(sessionInsertCalls(db.calls)).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('updates session metadata through an update-scoped outbox record', async () => {
    const db = createFakeDb({ existingSessionIds: ['pom_1'] });
    getDatabase.mockResolvedValue(db);

    const changed = await setPomodoroSessionMeta({
      sessionId: 'pom_1',
      note: 'quarterly report draft',
    });
    expect(changed).toBe(true);

    const update = db.calls.find((c) => c.sql.includes('UPDATE pomodoro_sessions'));
    expect(update?.params).toEqual(['quarterly report draft', 'pom_1']);

    const outbox = db.calls.find(
      (c) =>
        c.sql.includes('sync_outbox') &&
        c.params[0] === 'pomodoro_sessions' &&
        c.params[1] === 'pom_1',
    );
    expect(outbox?.params[3]).toBe('update');
  });

  it('normalizes and clears metadata values on update', async () => {
    const db = createFakeDb({ existingSessionIds: ['pom_1'] });
    getDatabase.mockResolvedValue(db);

    await setPomodoroSessionMeta({
      sessionId: 'pom_1',
      linkedTodoTitle: `  ${'x'.repeat(300)}  `,
      note: '   ',
    });

    const update = db.calls.find((c) => c.sql.includes('UPDATE pomodoro_sessions'));
    // Title trimmed + capped at 200; whitespace-only note cleared to NULL.
    expect(update?.params[0]).toBe('x'.repeat(200));
    expect(update?.params[1]).toBeNull();
  });

  it('reports no change when the session row does not exist', async () => {
    const db = createFakeDb();
    getDatabase.mockResolvedValue(db);

    await expect(
      setPomodoroSessionMeta({ sessionId: 'pom_missing', note: 'orphan' }),
    ).resolves.toBe(false);
    expect(db.calls.some((c) => c.sql.includes('UPDATE pomodoro_sessions'))).toBe(false);
  });

  it('applies linked-action pomodoro writes without source re-dispatch', async () => {
    const db = createFakeDb();
    getDatabase.mockResolvedValue(db);

    await expect(
      logPomodoroSessionFromLinkedAction({
        id: 'pom_123',
        durationSeconds: 1500,
        type: 'focus',
      }),
    ).resolves.toMatchObject({
      status: 'applied',
      producedEntityId: 'pom_123',
    });
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
  });
});

describe('pomodoro pending-log retry queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asyncStorage.store.clear();
  });

  it('retries a queued focus log to success and empties the queue', async () => {
    const db = createFakeDb();
    getDatabase.mockResolvedValue(db);

    await enqueuePendingPomodoroLog({
      startedAtIso: '2026-04-16T10:00:00.000Z',
      endedAtIso: '2026-04-16T10:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus',
      meta: { linkedTodoId: 'todo_1', linkedTodoTitle: 'Ship it' },
    });

    const result = await retryPendingPomodoroLogs();
    expect(result).toMatchObject({ retried: 1, succeeded: 1, finalFailures: [] });

    const insert = db.calls.find((c) => c.sql.includes('INSERT INTO pomodoro_sessions'));
    expect(insert?.params[6]).toBe('todo_1');
    expect(insert?.params[7]).toBe('Ship it');

    // Queue drained.
    const after = await retryPendingPomodoroLogs();
    expect(after).toMatchObject({ retried: 0, succeeded: 0 });
  });

  it('retains the entry below the attempt cap while session writes fail', async () => {
    const db = createFakeDb();
    getDatabase.mockResolvedValue(db);
    await enqueuePendingPomodoroLog({
      startedAtIso: '2026-04-16T10:00:00.000Z',
      endedAtIso: '2026-04-16T10:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus',
    });

    // Session-table writes fail (transient SQLite/OPFS error) while the
    // app_meta queue itself stays writable.
    db.state.failSessionWrites = true;
    const failed = await retryPendingPomodoroLogs();
    expect(failed).toMatchObject({ retried: 1, succeeded: 0, finalFailures: [] });

    // The entry stays durable and succeeds once the db heals.
    db.state.failSessionWrites = false;
    const healed = await retryPendingPomodoroLogs();
    expect(healed).toMatchObject({ retried: 1, succeeded: 1, finalFailures: [] });
    expect(db.insertedSessionIds.size).toBe(1);
  });

  it('drops entries as final failures after the attempt cap', async () => {
    const db = createFakeDb();
    getDatabase.mockResolvedValue(db);
    await enqueuePendingPomodoroLog({
      startedAtIso: '2026-04-16T10:00:00.000Z',
      endedAtIso: '2026-04-16T10:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus',
    });

    db.state.failSessionWrites = true;
    let lastResult = await retryPendingPomodoroLogs();
    for (let i = 2; i <= POMODORO_PENDING_LOG_MAX_ATTEMPTS; i++) {
      lastResult = await retryPendingPomodoroLogs();
    }

    expect(lastResult.finalFailures).toHaveLength(1);
    expect(lastResult.finalFailures[0].attempts).toBe(POMODORO_PENDING_LOG_MAX_ATTEMPTS);

    // Dropped from the queue — no further retries.
    db.state.failSessionWrites = false;
    const after = await retryPendingPomodoroLogs();
    expect(after.retried).toBe(0);
  });

  it('ignores corrupt queue payloads instead of crashing', async () => {
    const db = createFakeDb();
    db.meta.set('pomodoro.pending_logs', JSON.stringify([{ nonsense: true }, 'junk', null]));
    getDatabase.mockResolvedValue(db);

    const result = await retryPendingPomodoroLogs();
    expect(result).toMatchObject({ retried: 0, succeeded: 0, finalFailures: [] });
  });
});

describe('migrateLegacySessionMeta', () => {
  function seedLegacyMaps(input: {
    associations?: Record<string, unknown>;
    notes?: Record<string, string>;
  }) {
    if (input.associations) {
      asyncStorage.store.set(
        'superhabits.pomodoro.sessionAssociations',
        JSON.stringify(input.associations),
      );
    }
    if (input.notes) {
      asyncStorage.store.set('superhabits.pomodoro.sessionNotes', JSON.stringify(input.notes));
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    asyncStorage.store.clear();
  });

  it('backfills matching rows by exact id and drops invalid/orphan entries', async () => {
    const db = createFakeDb({ existingSessionIds: ['pom_ok'] });
    getDatabase.mockResolvedValue(db);
    seedLegacyMaps({
      associations: {
        pom_ok: { todoId: 'todo_1', todoTitle: '  Ship the release  ' },
        pom_bad: { todoId: 5 },
        pom_orphan: { todoId: 'todo_2', todoTitle: 'Orphan' },
      },
      notes: {
        pom_ok: '  deep work on the parser ',
        pom_orphan: 'lost note',
        pom_empty: '   ',
      },
    });

    const result = await migrateLegacySessionMeta();

    expect(result).toEqual({ associationsApplied: 1, notesApplied: 1, droppedEntries: 4 });

    const updates = db.calls.filter((c) => c.sql.includes('UPDATE pomodoro_sessions'));
    expect(updates).toHaveLength(2);
    expect(updates[0].params).toEqual(['todo_1', 'Ship the release', 'pom_ok']);
    expect(updates[1].params).toEqual(['deep work on the parser', 'pom_ok']);

    // Legacy keys retired only after all backfills succeeded.
    expect(asyncStorage.store.has('superhabits.pomodoro.sessionAssociations')).toBe(false);
    expect(asyncStorage.store.has('superhabits.pomodoro.sessionNotes')).toBe(false);
  });

  it('is idempotent: no legacy keys means no work', async () => {
    const db = createFakeDb();
    getDatabase.mockResolvedValue(db);

    await expect(migrateLegacySessionMeta()).resolves.toEqual({
      associationsApplied: 0,
      notesApplied: 0,
      droppedEntries: 0,
    });
    expect(db.calls.some((c) => c.sql.includes('UPDATE pomodoro_sessions'))).toBe(false);
  });
});
