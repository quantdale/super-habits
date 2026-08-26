import { beforeEach, describe, expect, it, vi } from 'vitest';

type RemoteRowsByEntity = Partial<Record<string, Record<string, unknown>[]>>;
type RemoteErrorByEntity = Partial<
  Record<string, { countError?: string; latestError?: string; rowsError?: string }>
>;

function buildSupabaseMock(
  remoteRowsByEntity: RemoteRowsByEntity,
  remoteErrorsByEntity: RemoteErrorByEntity = {},
) {
  const ownerFilters: { entity: string; value: unknown }[] = [];
  return {
    ownerFilters,
    from: vi.fn((entity: string) => {
      const rows = remoteRowsByEntity[entity] ?? [];
      const entityErrors = remoteErrorsByEntity[entity] ?? {};

      return {
        select: vi.fn((columns: string, options?: { head?: boolean; count?: string }) => {
          const state = {
            onlyActiveRows: false,
          };
          const getRowsForQuery = () =>
            state.onlyActiveRows ? rows.filter((row) => row.deleted_at == null) : rows;

          // Production preview reads are ONE request per entity: count=exact
          // plus an ordered limit(1) payload carries both the row count and
          // the latest updated_at.
          const query = {
            eq: vi.fn((column: string, value: unknown) => {
              if (column === 'user_id') ownerFilters.push({ entity, value });
              return query;
            }),
            is: vi.fn(() => {
              state.onlyActiveRows = true;
              return query;
            }),
            order: vi.fn(() => query),
            limit: vi.fn(() => {
              if (entityErrors.countError || entityErrors.latestError) {
                return Promise.resolve({
                  data: null,
                  count: null,
                  error: {
                    message: entityErrors.countError ?? entityErrors.latestError,
                  },
                });
              }

              const activeRows = getRowsForQuery();
              const latest =
                [...activeRows].sort((a, b) =>
                  String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')),
                )[0] ?? null;

              return Promise.resolve({
                data: latest ? [{ updated_at: latest.updated_at ?? null }] : [],
                ...(options?.count === 'exact' ? { count: activeRows.length } : {}),
                error: null,
              });
            }),
            range: vi.fn((from: number, to: number) => {
              if (entityErrors.rowsError) {
                return Promise.resolve({
                  data: null,
                  error: { message: entityErrors.rowsError },
                });
              }

              return Promise.resolve({
                data: getRowsForQuery().slice(from, to + 1),
                error: null,
              });
            }),
          };

          return query;
        }),
      };
    }),
  };
}

function buildDb(localCounts: Record<string, number>, initialMeta: Record<string, string> = {}) {
  const meta = { ...initialMeta };
  const committedWrites: { sql: string; params: unknown[] }[] = [];
  let activeBuffer: { sql: string; params: unknown[] }[] | null = null;
  let activeMetaBuffer: Record<string, string> | null = null;

  return {
    getFirstAsync: vi.fn(async (sql: string, params?: unknown[]) => {
      // Backup Completeness V2: inspectLocalAccountDataState issues per-table
      // counts. Tables with a deleted_at column use the active/deleted variant.
      const activeCountMatch = sql.match(
        /^SELECT COUNT\(\*\) AS total,([\s\S]*?)FROM ([a-z_]+)\s*$/i,
      );
      if (activeCountMatch) {
        const entity = activeCountMatch[2] ?? '';
        const count = localCounts[entity] ?? 0;
        return { total: count, active: count, deleted: 0 };
      }

      const countMatch = sql.match(/^SELECT COUNT\(\*\) AS total FROM ([a-z_]+)$/i);
      if (countMatch) {
        const entity = countMatch[1] ?? '';
        return { total: localCounts[entity] ?? 0 };
      }

      // sync_outbox count queries issued by inspectLocalAccountDataState and
      // getBackupStateSummary.
      if (/^SELECT COUNT\(\*\) AS count/i.test(sql)) {
        return { count: 0 };
      }

      if (sql === 'SELECT value FROM app_meta WHERE key = ?') {
        const key = String(params?.[0] ?? '');
        if (activeMetaBuffer && key in activeMetaBuffer) {
          return { value: activeMetaBuffer[key] };
        }
        return key in meta ? { value: meta[key] } : null;
      }

      return null;
    }),
    // inspectLocalAccountDataState reads distinct outbox owners via getAllAsync.
    getAllAsync: vi.fn(async () => []),
    runAsync: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (
        sql === 'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)' &&
        activeMetaBuffer
      ) {
        activeMetaBuffer[String(params[0])] = String(params[1]);
      } else if (sql === 'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)') {
        meta[String(params[0])] = String(params[1]);
      }

      if (activeBuffer) {
        activeBuffer.push({ sql, params });
      } else {
        committedWrites.push({ sql, params });
      }

      return undefined;
    }),
    withTransactionAsync: vi.fn(async (task: () => Promise<void>) => {
      activeBuffer = [];
      activeMetaBuffer = {};
      try {
        await task();
        committedWrites.push(...activeBuffer);
        Object.assign(meta, activeMetaBuffer);
      } finally {
        activeBuffer = null;
        activeMetaBuffer = null;
      }
    }),
    isInTransaction: () => activeBuffer !== null,
    getCommittedWrites: () => committedWrites,
    getMeta: () => ({ ...meta }),
  };
}

async function loadCoordinator(options: {
  localCounts: Record<string, number>;
  remoteRowsByEntity: RemoteRowsByEntity;
  remoteErrorsByEntity?: RemoteErrorByEntity;
  initialMeta?: Record<string, string>;
  applyFailure?: { entity: 'todos' | 'habits' | 'calorie_entries'; sql?: string };
  remoteEnabled?: boolean;
  authUserIds?: (string | null)[];
}) {
  vi.resetModules();

  const db = buildDb(options.localCounts, options.initialMeta);
  const supabaseMock = buildSupabaseMock(options.remoteRowsByEntity, options.remoteErrorsByEntity);
  const authUserIds = options.authUserIds ?? ['user_a'];
  const getSupabaseAuthUserId = vi.fn(async () => {
    if (authUserIds.length > 1) return authUserIds.shift() ?? null;
    return authUserIds[0] ?? null;
  });
  const applyRemoteTodos = vi.fn(async (database, rows) => {
    if (options.applyFailure?.entity === 'todos') {
      if (options.applyFailure.sql) {
        await database.runAsync(options.applyFailure.sql, ['todo_failure']);
      }
      throw new Error('todo restore failed');
    }
    return rows;
  });
  const applyRemoteHabits = vi.fn(async (database, rows) => {
    if (options.applyFailure?.entity === 'habits') {
      if (options.applyFailure.sql) {
        await database.runAsync(options.applyFailure.sql, ['habit_failure']);
      }
      throw new Error('habit restore failed');
    }
    return rows;
  });
  const applyRemoteCalorieEntries = vi.fn(async (database, rows) => {
    if (options.applyFailure?.entity === 'calorie_entries') {
      if (options.applyFailure.sql) {
        await database.runAsync(options.applyFailure.sql, ['cal_failure']);
      }
      throw new Error('calorie restore failed');
    }
    return rows;
  });

  vi.doMock('@/core/db/client', () => ({
    getDatabase: vi.fn().mockResolvedValue(db),
  }));
  vi.doMock('@/lib/time', () => ({
    nowIso: vi.fn(() => '2026-04-21T12:00:00.000Z'),
  }));
  vi.doMock('@/lib/supabase', () => ({
    supabase: supabaseMock,
    isRemoteEnabled: vi.fn(() => options.remoteEnabled ?? true),
    getSupabaseAuthUserId,
  }));
  vi.doMock('@/features/todos/todos.data', () => ({
    applyRemoteTodos,
  }));
  vi.doMock('@/features/habits/habits.data', () => ({
    applyRemoteHabits,
  }));
  vi.doMock('@/features/calories/calories.data', () => ({
    applyRemoteCalorieEntries,
  }));

  const coordinator = await import('@/core/sync/restore.coordinator');
  return {
    db,
    supabaseMock,
    getSupabaseAuthUserId,
    applyRemoteTodos,
    applyRemoteHabits,
    applyRemoteCalorieEntries,
    ...coordinator,
  };
}

describe('core/sync/restore.coordinator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // The V1 restore path validates every fetched remote row with the shared
  // backup-row validator (same contract as Restore V2 / portable import), so
  // its fixtures must be schema-valid rows.
  const validTodoRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'todo_1',
    title: 'Ship restore',
    notes: null,
    completed: 0,
    due_date: null,
    priority: 'normal',
    sort_order: 0,
    recurrence: null,
    recurrence_id: null,
    created_at: '2026-04-19T12:00:00.000Z',
    updated_at: '2026-04-20T12:00:00.000Z',
    deleted_at: null,
    ...overrides,
  });
  const validHabitRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'habit_1',
    name: 'Hydrate',
    target_per_day: 1,
    reminder_time: null,
    category: 'anytime',
    icon: 'check-circle',
    color: '#0ea5e9',
    rule_history: '[]',
    created_at: '2026-04-17T12:00:00.000Z',
    updated_at: '2026-04-18T12:00:00.000Z',
    deleted_at: null,
    ...overrides,
  });
  const validCalorieRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'cal_1',
    food_name: 'Oats',
    calories: 300,
    protein: 10,
    carbs: 50,
    fats: 5,
    fiber: 4,
    meal_type: 'breakfast',
    consumed_on: '2026-04-15',
    created_at: '2026-04-15T12:00:00.000Z',
    updated_at: '2026-04-16T12:00:00.000Z',
    deleted_at: null,
    ...overrides,
  });

  it('marks the device as empty-device eligible only when all sync-backed tables are empty', async () => {
    const { getRestorePreview } = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: 'todo_1',
            updated_at: '2026-04-20T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
          },
        ],
      },
    });

    const preview = await getRestorePreview();

    expect(preview.eligibility.kind).toBe('empty_device');
    expect(preview.remoteAvailable).toBe(true);
    expect(preview.startupPromptEligible).toBe(true);
  });

  it('blocks restore when active rows exist in sync-backed local tables', async () => {
    const { getRestorePreview } = await loadCoordinator({
      localCounts: {
        todos: 1,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: 'todo_1',
            updated_at: '2026-04-20T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
          },
        ],
      },
    });

    const preview = await getRestorePreview();

    expect(preview.eligibility).toMatchObject({
      kind: 'blocked',
      reason: 'local_data_present',
    });
    expect(preview.startupPromptEligible).toBe(false);
  });

  it('blocks restore when local synced tables contain tombstones', async () => {
    const { getRestorePreview } = await loadCoordinator({
      localCounts: {
        todos: 1,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: 'todo_1',
            updated_at: '2026-04-20T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
            deleted_at: null,
          },
        ],
      },
    });

    const preview = await getRestorePreview();

    expect(preview.eligibility).toMatchObject({
      kind: 'blocked',
      reason: 'local_data_present',
    });
  });

  it('returns workout restore as excluded in phase one with a concrete reason', async () => {
    const { getRestorePreview } = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        workout_routines: [
          {
            id: 'wrk_1',
            updated_at: '2026-04-20T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
          },
        ],
      },
    });

    const preview = await getRestorePreview();

    expect(preview.entityStatuses.workout_routines).toMatchObject({
      phaseOneStatus: 'excluded_in_phase_one',
      reason:
        'Workout routines are excluded from phase-one restore. Full workout structure and history are included in Backup V2 restore.',
    });
    expect(preview.warnings).toContain(
      'Workout routines are excluded from phase-one restore. Full workout structure and history are included in Backup V2 restore.',
    );
  });

  it('returns an unavailable restore preview when remote mode is disabled', async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: 'todo_1',
            updated_at: '2026-04-20T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
            deleted_at: null,
          },
        ],
      },
      remoteEnabled: false,
    });

    const preview = await loaded.getRestorePreview();

    expect(preview.remoteAvailable).toBe(false);
    expect(preview.eligibility).toMatchObject({
      kind: 'blocked',
      reason: 'remote_disabled',
    });
    expect(preview.entityStatuses.todos.remoteState).toBe('unavailable');
    expect(loaded.supabaseMock.from).not.toHaveBeenCalled();
  });

  it('reports remote authentication as unavailable without querying backup rows', async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: { todos: [{ id: 'todo_1' }] },
      authUserIds: [null],
    });

    const preview = await loaded.getRestorePreview();

    expect(preview.remoteAvailable).toBe(false);
    expect(preview.eligibility).toMatchObject({
      kind: 'blocked',
      reason: 'remote_backup_unavailable',
    });
    expect(preview.warnings.join(' ')).toContain('authentication is unavailable');
    expect(loaded.supabaseMock.from).not.toHaveBeenCalled();
  });

  it('does not treat tombstone-only remote rows as restorable backup', async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: 'todo_1',
            updated_at: '2026-04-20T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
            deleted_at: '2026-04-20T13:00:00.000Z',
          },
        ],
      },
    });

    const preview = await loaded.getRestorePreview();

    expect(preview.remoteAvailable).toBe(false);
    expect(preview.entityStatuses.todos.remoteState).toBe('empty');
    expect(preview.eligibility).toMatchObject({
      kind: 'blocked',
      reason: 'remote_backup_unavailable',
    });
  });

  it('treats mixed active and deleted remote rows as restorable backup', async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: 'todo_1',
            updated_at: '2026-04-20T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
            deleted_at: '2026-04-20T13:00:00.000Z',
          },
          {
            id: 'todo_2',
            updated_at: '2026-04-21T12:00:00.000Z',
            created_at: '2026-04-21T10:00:00.000Z',
            deleted_at: null,
          },
        ],
      },
    });

    const preview = await loaded.getRestorePreview();

    expect(preview.remoteAvailable).toBe(true);
    expect(preview.entityStatuses.todos).toMatchObject({
      remoteState: 'available',
      remoteRowCount: 1,
    });
    expect(preview.eligibility.kind).toBe('empty_device');
  });

  it('changes the freshness signature when remote backup metadata changes', async () => {
    const first = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: 'todo_1',
            updated_at: '2026-04-20T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
          },
        ],
      },
    });
    const second = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: 'todo_1',
            updated_at: '2026-04-21T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
          },
          {
            id: 'todo_2',
            updated_at: '2026-04-21T12:30:00.000Z',
            created_at: '2026-04-20T12:00:00.000Z',
          },
        ],
      },
    });

    const firstPreview = await first.getRestorePreview();
    const secondPreview = await second.getRestorePreview();

    expect(firstPreview.freshnessSignature).not.toBe(secondPreview.freshnessSignature);
  });

  it('dismisses only the matching current backup freshness signature', async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: 'todo_1',
            updated_at: '2026-04-20T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
          },
        ],
      },
    });

    const firstPreview = await loaded.getRestorePreview();
    await loaded.dismissCurrentRestorePrompt(firstPreview.freshnessSignature);
    const dismissedPreview = await loaded.getRestorePreview();

    expect(dismissedPreview.dismissedForCurrentBackup).toBe(true);
    expect(dismissedPreview.startupPromptEligible).toBe(false);

    const changed = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: 'todo_1',
            updated_at: '2026-04-22T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
          },
        ],
      },
      initialMeta: loaded.db.getMeta(),
    });

    const changedPreview = await changed.getRestorePreview();
    expect(changedPreview.dismissedForCurrentBackup).toBe(false);
    expect(changedPreview.startupPromptEligible).toBe(true);
  });

  it('blocks restore execution on non-empty devices without importing rows', async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 2,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: 'todo_1',
            updated_at: '2026-04-20T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
          },
        ],
      },
    });

    const result = await loaded.restoreFromRemoteBackup();

    expect(result.status).toBe('blocked');
    expect(loaded.applyRemoteTodos).not.toHaveBeenCalled();
    expect(loaded.applyRemoteHabits).not.toHaveBeenCalled();
    expect(loaded.applyRemoteCalorieEntries).not.toHaveBeenCalled();
  });

  it('blocks restore execution when remote mode is disabled', async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: 'todo_1',
            updated_at: '2026-04-20T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
            deleted_at: null,
          },
        ],
      },
      remoteEnabled: false,
    });

    const result = await loaded.restoreFromRemoteBackup();

    expect(result).toMatchObject({
      status: 'blocked',
      preview: {
        eligibility: {
          kind: 'blocked',
          reason: 'remote_disabled',
        },
      },
    });
    expect(loaded.applyRemoteTodos).not.toHaveBeenCalled();
    expect(loaded.applyRemoteHabits).not.toHaveBeenCalled();
    expect(loaded.applyRemoteCalorieEntries).not.toHaveBeenCalled();
  });

  it('imports only todos, habits, and calorie entries during restore', async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          validTodoRow(),
          validTodoRow({
            id: 'todo_2',
            title: 'Deleted todo',
            updated_at: '2026-04-20T13:00:00.000Z',
            created_at: '2026-04-19T13:00:00.000Z',
            deleted_at: '2026-04-20T14:00:00.000Z',
          }),
        ],
        habits: [validHabitRow()],
        calorie_entries: [validCalorieRow()],
        workout_routines: [
          {
            id: 'wrk_1',
            name: 'Push day',
            updated_at: '2026-04-14T12:00:00.000Z',
            created_at: '2026-04-13T12:00:00.000Z',
          },
        ],
      },
    });

    const result = await loaded.restoreFromRemoteBackup();

    expect(result).toMatchObject({
      status: 'restored',
      importedCounts: {
        todos: 2,
        habits: 1,
        calorie_entries: 1,
      },
    });
    expect(loaded.applyRemoteTodos).toHaveBeenCalledTimes(1);
    expect(loaded.applyRemoteHabits).toHaveBeenCalledTimes(1);
    expect(loaded.applyRemoteCalorieEntries).toHaveBeenCalledTimes(1);
    expect(loaded.supabaseMock.ownerFilters.length).toBeGreaterThan(0);
    expect(loaded.supabaseMock.ownerFilters.every((filter) => filter.value === 'user_a')).toBe(
      true,
    );
    const metaWrites = loaded.db
      .getCommittedWrites()
      .filter(
        (entry) => entry.sql === 'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
      );
    // owner binding + binding state + restore signature + restore timestamp.
    expect(metaWrites).toHaveLength(4);
  });

  it('rejects malformed remote rows as invalid instead of importing them', async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        // Missing required fields (title/completed/priority/...) — the legacy
        // V1 path must apply the same untrusted-input validation as Restore V2.
        todos: [
          {
            id: 'todo_1',
            updated_at: '2026-04-20T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
          },
        ],
        habits: [validHabitRow()],
        calorie_entries: [validCalorieRow()],
      },
    });

    const result = await loaded.restoreFromRemoteBackup();

    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.diagnostics.join(' ')).toContain('todos:');
    }
    expect(loaded.applyRemoteTodos).not.toHaveBeenCalled();
    expect(loaded.applyRemoteHabits).not.toHaveBeenCalled();
    expect(loaded.applyRemoteCalorieEntries).not.toHaveBeenCalled();
    expect(loaded.db.getCommittedWrites()).toEqual([]);
  });

  it('reports an owner change inside the transaction as invalid, not local_data_present', async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [validTodoRow()],
        habits: [validHabitRow()],
        calorie_entries: [validCalorieRow()],
      },
    });

    // The owner is unbound before the restore; flip it to a foreign account
    // for reads issued INSIDE the transaction to simulate another account
    // claiming the dataset mid-restore. The in-transaction owner re-check must
    // surface as an owner-mismatch failure, never as `local_data_present`.
    const original = loaded.db.getFirstAsync.getMockImplementation()!;
    loaded.db.getFirstAsync.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (
        loaded.db.isInTransaction() &&
        sql === 'SELECT value FROM app_meta WHERE key = ?' &&
        String(params?.[0] ?? '') === 'account.owner_user_id'
      ) {
        return { value: 'user_b' };
      }
      return original(sql, params);
    });

    const result = await loaded.restoreFromRemoteBackup();

    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.message).toContain('owner changed');
    }
    expect(loaded.db.getCommittedWrites()).toEqual([]);
  });

  it('uses a transaction so failed restore writes do not commit partial local changes', async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [validTodoRow()],
      },
      applyFailure: {
        entity: 'todos',
        sql: 'INSERT INTO todos VALUES (?)',
      },
    });

    await expect(loaded.restoreFromRemoteBackup()).rejects.toThrow('todo restore failed');

    expect(loaded.db.getCommittedWrites()).toEqual([]);
    expect(loaded.db.getMeta()).not.toHaveProperty('last_restore_at');
    expect(loaded.db.getMeta()).not.toHaveProperty('last_restore_signature');
  });

  it('aborts restore when the authenticated owner changes after preview', async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: 'todo_1',
            updated_at: '2026-04-20T12:00:00.000Z',
            created_at: '2026-04-19T12:00:00.000Z',
          },
        ],
      },
      // restoreFromRemoteBackup now calls restoreFromRemoteBackupV2() first,
      // which consumes one getSupabaseAuthUserId() value before the V1 path
      // runs its preview (user_a) and its post-preview owner refresh (user_b).
      authUserIds: ['user_a', 'user_a', 'user_b'],
    });

    await expect(loaded.restoreFromRemoteBackup()).rejects.toThrow('Authenticated owner changed');
    expect(loaded.applyRemoteTodos).not.toHaveBeenCalled();
    expect(loaded.db.getCommittedWrites()).toEqual([]);
  });

  it('aborts inside the transaction when local rows appear after the eligibility preview', async () => {
    const localCounts = {
      todos: 0,
      habits: 0,
      calorie_entries: 0,
      workout_routines: 0,
    };
    const loaded = await loadCoordinator({
      localCounts,
      remoteRowsByEntity: {
        todos: [validTodoRow()],
      },
    });

    // The eligibility preview reads one COUNT per synced entity (4). Flip the
    // counts right after those reads so the in-transaction re-check (the next
    // 4 COUNT queries) sees a todo that "appeared" mid-restore (COR-005).
    const original = loaded.db.getFirstAsync.getMockImplementation()!;
    let countQueries = 0;
    loaded.db.getFirstAsync.mockImplementation(async (sql: string, params?: unknown[]) => {
      const result = await original(sql, params);
      if (/^SELECT COUNT\(\*\) AS total/i.test(sql)) {
        countQueries += 1;
        if (countQueries === 4) {
          localCounts.todos = 1;
        }
      }
      return result;
    });

    const result = await loaded.restoreFromRemoteBackup();

    expect(result.status).toBe('blocked');
    expect(loaded.applyRemoteTodos).not.toHaveBeenCalled();
    expect(loaded.applyRemoteHabits).not.toHaveBeenCalled();
    expect(loaded.applyRemoteCalorieEntries).not.toHaveBeenCalled();
    expect(loaded.db.getMeta()).not.toHaveProperty('last_restore_at');
    expect(loaded.db.getMeta()).not.toHaveProperty('last_restore_signature');
  });
});
