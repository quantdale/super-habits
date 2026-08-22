import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveHabit,
  incrementHabit,
  incrementHabitFromLinkedAction,
  pauseHabit,
  resumeHabit,
  completeHabitFromNotification,
  ensureHabitDailyTargetFromLinkedAction,
} from '@/features/habits/habits.data';

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

const { linkedActionsEngine } = vi.hoisted(() => ({
  linkedActionsEngine: {
    processSourceAction: vi.fn(),
  },
}));

const { notificationActions } = vi.hoisted(() => ({
  notificationActions: {
    claimNotificationActionInTransaction: vi.fn(),
    setNotificationActionLinkedRequiredInTransaction: vi.fn(),
  },
}));

vi.mock('@/core/db/client', () => ({
  getDatabase,
}));

vi.mock('@/core/linked-actions/linkedActions.engine', () => ({
  linkedActionsEngine,
}));

vi.mock('@/features/habits/notificationActions.data', () => ({
  claimNotificationActionInTransaction: notificationActions.claimNotificationActionInTransaction,
  setNotificationActionLinkedRequiredInTransaction:
    notificationActions.setNotificationActionLinkedRequiredInTransaction,
}));

describe('features/habits/habits.data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linkedActionsEngine.processSourceAction.mockResolvedValue({
      matchedRuleCount: 0,
      notices: [],
    });
  });

  // Complete habit row for an active, every-day habit effective well before
  // the test date keys used below.
  const ACTIVE_HABIT_ROW = {
    name: 'Hydrate',
    target_per_day: 2,
    created_at: '2026-04-01T00:00:00.000Z',
    rule_history: JSON.stringify([
      { effective_from_date: '2026-04-01', weekdays: [1, 2, 3, 4, 5, 6, 7], target_per_day: 2 },
    ]),
    status: 'active',
    lifecycle_history: null,
  };

  it('emits a linked-actions source event when an increment reaches the daily target', async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({ ...ACTIVE_HABIT_ROW })
        // Post-upsert re-read: the increment just landed count 2.
        .mockResolvedValueOnce({
          id: 'hcmp_1',
          count: 2,
        }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const result = await incrementHabit('habit_1', '2026-04-14');

    // COR-001: the mutation returns its post-write count from the same SQL
    // statement instead of performing a race-prone follow-up SELECT. The third
    // getFirstAsync call is the backup transaction's sync_outbox owner read.
    expect(db.getFirstAsync).toHaveBeenCalledTimes(3);
    const [upsertSql, upsertArgs] = db.getFirstAsync.mock.calls[1];
    expect(upsertSql).toContain('INSERT INTO habit_completions');
    expect(upsertSql).toContain('ON CONFLICT(habit_id, date_key) DO UPDATE SET');
    expect(upsertSql).toContain('count = count + 1');
    expect(upsertArgs).toEqual([
      expect.any(String),
      'habit_1',
      '2026-04-14',
      expect.any(String),
      expect.any(String),
    ]);
    expect(linkedActionsEngine.processSourceAction).toHaveBeenCalledWith({
      occurredAt: expect.any(String),
      feature: 'habits',
      entityType: 'habit',
      entityId: 'habit_1',
      triggerType: 'habit.completed_for_day',
      label: 'Hydrate',
      sourceDateKey: '2026-04-14',
      sourceRecordId: 'hcmp_1',
      origin: {
        originKind: 'user',
        originRuleId: null,
        originEventId: null,
      },
      payload: {
        previousCount: 1,
        currentCount: 2,
        targetPerDay: 2,
      },
    });
    expect(result.count).toBe(2);
  });

  it('does not emit linked-actions events before the target is reached', async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({
          ...ACTIVE_HABIT_ROW,
          target_per_day: 3,
          rule_history: JSON.stringify([
            {
              effective_from_date: '2026-04-01',
              weekdays: [1, 2, 3, 4, 5, 6, 7],
              target_per_day: 3,
            },
          ]),
        })
        .mockResolvedValueOnce({
          id: 'hcmp_1',
          count: 2,
        }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const result = await incrementHabit('habit_1', '2026-04-14');

    expect(db.getFirstAsync).toHaveBeenCalledTimes(3);
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
    expect(result).toEqual({
      count: 2,
      linkedActions: {
        matchedRuleCount: 0,
        notices: [],
      },
    });
  });

  it('does not re-emit once the habit was already complete for the day', async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({ ...ACTIVE_HABIT_ROW })
        .mockResolvedValueOnce({
          id: 'hcmp_1',
          count: 3,
        }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const result = await incrementHabit('habit_1', '2026-04-14');

    expect(db.getFirstAsync).toHaveBeenCalledTimes(3);
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
    expect(result.count).toBe(3);
  });

  it('does not write completion rows when the habit is missing or soft-deleted', async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValueOnce(null),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const result = await incrementHabit('habit_gone', '2026-04-14');

    // COR-001: the old flow wrote an orphan completion row before checking
    // the habit existed.
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
    expect(result).toEqual({
      count: 0,
      linkedActions: {
        matchedRuleCount: 0,
        notices: [],
      },
    });
  });

  it.each(['paused', 'archived'] as const)(
    'refuses increments for a %s habit without writing a completion row',
    async (status) => {
      const db = {
        getFirstAsync: vi.fn().mockResolvedValueOnce({ ...ACTIVE_HABIT_ROW, status }),
        runAsync: vi.fn().mockResolvedValue(undefined),
      };
      getDatabase.mockResolvedValue(db);

      await expect(incrementHabit('habit_1', '2026-04-14')).resolves.toEqual({
        count: 0,
        linkedActions: { matchedRuleCount: 0, notices: [] },
      });
      expect(
        db.getFirstAsync.mock.calls.some(([sql]) =>
          (sql as string).includes('INSERT INTO habit_completions'),
        ),
      ).toBe(false);
      expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
    },
  );

  it('refuses increments on a date masked by an open pause interval even while active again', async () => {
    // Resumed on 2026-04-20: the pause interval [2026-04-10, 2026-04-20]
    // keeps 2026-04-14 masked for writes and streak math alike.
    const db = {
      getFirstAsync: vi.fn().mockResolvedValueOnce({
        ...ACTIVE_HABIT_ROW,
        lifecycle_history: JSON.stringify([
          { status: 'paused', from_date_key: '2026-04-10', to_date_key: '2026-04-20' },
        ]),
      }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await expect(incrementHabit('habit_1', '2026-04-14')).resolves.toEqual({
      count: 0,
      linkedActions: { matchedRuleCount: 0, notices: [] },
    });
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('refuses increments before the habit creation/effective date', async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValueOnce({ ...ACTIVE_HABIT_ROW }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await expect(incrementHabit('habit_1', '2026-03-30')).resolves.toEqual({
      count: 0,
      linkedActions: { matchedRuleCount: 0, notices: [] },
    });
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('refuses increments on unscheduled weekdays', async () => {
    // Weekdays-only schedule; 2026-04-11 is a Saturday.
    const db = {
      getFirstAsync: vi.fn().mockResolvedValueOnce({
        ...ACTIVE_HABIT_ROW,
        rule_history: JSON.stringify([
          { effective_from_date: '2026-04-01', weekdays: [1, 2, 3, 4, 5], target_per_day: 2 },
        ]),
      }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await expect(incrementHabit('habit_1', '2026-04-11')).resolves.toEqual({
      count: 0,
      linkedActions: { matchedRuleCount: 0, notices: [] },
    });
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('uses the same atomic upsert on repeated increments (double-tap safety)', async () => {
    // Each tap performs a habit read, the atomic upsert (RETURNING), and a
    // sync_outbox owner read inside the backup transaction. Resolve by SQL
    // shape so the two upserts report counts 1 then 2.
    let upsertCount = 0;
    const db = {
      getFirstAsync: vi.fn(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('INSERT INTO habit_completions')) {
          upsertCount += 1;
          return { id: 'hcmp_1', count: upsertCount };
        }
        if (typeof sql === 'string' && sql.includes('FROM habits')) {
          return { ...ACTIVE_HABIT_ROW, target_per_day: 5 };
        }
        return null;
      }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const first = await incrementHabit('habit_1', '2026-04-14');
    const second = await incrementHabit('habit_1', '2026-04-14');

    // Both calls issue the single ON CONFLICT statement — there is no
    // SELECT-then-INSERT branch left to interleave. (Mock-level proof of the
    // statement shape; the SQL itself was validated against real SQLite.)
    // Filter on the upsert statements so the backup transaction's extra
    // sync_outbox owner reads (one per tap) don't disturb the assertion.
    const completionUpserts = db.getFirstAsync.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO habit_completions'),
    );
    expect(completionUpserts).toHaveLength(2);
    for (const [sql] of completionUpserts) {
      expect(sql).toContain('ON CONFLICT(habit_id, date_key) DO UPDATE SET');
    }
    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
  });

  it('skips linked-action increments when the habit target is missing or soft-deleted', async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'habit_1',
        name: 'Hydrate',
        target_per_day: 2,
        deleted_at: '2026-04-14T00:00:00.000Z',
      }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      incrementHabitFromLinkedAction({
        habitId: 'habit_missing',
        amount: 1,
        dateKey: '2026-04-14',
      }),
    ).resolves.toEqual({
      status: 'skipped',
      reason: 'target_missing',
    });
    await expect(
      incrementHabitFromLinkedAction({
        habitId: 'habit_1',
        amount: 1,
        dateKey: '2026-04-14',
      }),
    ).resolves.toEqual({
      status: 'skipped',
      reason: 'target_missing',
    });

    expect(db.runAsync).not.toHaveBeenCalled();
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
  });

  it('updates an existing completion row for linked-action habit increments', async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'habit_1',
          name: 'Hydrate',
          target_per_day: 2,
          deleted_at: null,
        })
        .mockResolvedValueOnce({
          id: 'hcmp_1',
          count: 2,
        }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      incrementHabitFromLinkedAction({
        habitId: 'habit_1',
        amount: 1,
        dateKey: '2026-04-14',
      }),
    ).resolves.toEqual({
      status: 'applied',
      targetLabel: 'Hydrate',
    });

    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO habit_completions'),
      [
        expect.stringMatching(/^hcmp_/),
        'habit_1',
        '2026-04-14',
        1,
        expect.any(String),
        expect.any(String),
      ],
    );
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
  });

  it('inserts a completion row for linked-action habit increments when none exists', async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'habit_1',
          name: 'Hydrate',
          target_per_day: 2,
          deleted_at: null,
        })
        .mockResolvedValueOnce(null),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      incrementHabitFromLinkedAction({
        habitId: 'habit_1',
        amount: 1,
        dateKey: '2026-04-14',
      }),
    ).resolves.toEqual({
      status: 'applied',
      targetLabel: 'Hydrate',
    });

    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO habit_completions'),
      [
        expect.stringMatching(/^hcmp_/),
        'habit_1',
        '2026-04-14',
        1,
        expect.any(String),
        expect.any(String),
      ],
    );
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
  });

  it.each([
    [
      'incrementHabitFromLinkedAction',
      () =>
        incrementHabitFromLinkedAction({ habitId: 'habit_1', amount: 1, dateKey: '2026-04-14' }),
    ],
    [
      'ensureHabitDailyTargetFromLinkedAction',
      () =>
        ensureHabitDailyTargetFromLinkedAction({
          habitId: 'habit_1',
          minimumCount: 'target_per_day',
          dateKey: '2026-04-14',
        }),
    ],
  ] as const)('%s skips paused/archived habits as target_inactive', async (_name, run) => {
    for (const status of ['paused', 'archived'] as const) {
      const db = {
        getFirstAsync: vi.fn().mockResolvedValueOnce({
          id: 'habit_1',
          name: 'Hydrate',
          target_per_day: 2,
          deleted_at: null,
          status,
          lifecycle_history: null,
        }),
        runAsync: vi.fn().mockResolvedValue(undefined),
      };
      getDatabase.mockResolvedValue(db);

      await expect(run()).resolves.toEqual({
        status: 'skipped',
        reason: 'target_inactive',
        targetLabel: 'Hydrate',
      });
      expect(
        db.getFirstAsync.mock.calls.some(([sql]) =>
          (sql as string).includes('INSERT INTO habit_completions'),
        ),
      ).toBe(false);
    }
  });

  it('ensureHabitDailyTargetFromLinkedAction skips dates masked by a pause interval', async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValueOnce({
        id: 'habit_1',
        name: 'Hydrate',
        target_per_day: 2,
        deleted_at: null,
        status: 'active',
        lifecycle_history: JSON.stringify([
          { status: 'paused', from_date_key: '2026-04-10', to_date_key: null },
        ]),
      }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      ensureHabitDailyTargetFromLinkedAction({
        habitId: 'habit_1',
        minimumCount: 'target_per_day',
        dateKey: '2026-04-14',
      }),
    ).resolves.toEqual({
      status: 'skipped',
      reason: 'target_inactive',
      targetLabel: 'Hydrate',
    });
    expect(db.runAsync).not.toHaveBeenCalled();
  });
});

describe('features/habits/habits.data — durable lifecycle transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function lifecycleDb(
    current: { status: string | null; lifecycle_history: string | null } | null,
  ) {
    return {
      getFirstAsync: vi.fn(async (sql: string) => {
        if (sql.includes('FROM habits')) return current;
        // sync_outbox owner reads and app_meta reads resolve to "absent".
        return null;
      }),
      runAsync: vi.fn(async (_sql: string, _params?: unknown[]) => ({
        changes: 1,
        lastInsertRowId: 1,
      })),
    };
  }

  function statusUpdateCall(db: ReturnType<typeof lifecycleDb>) {
    const call = db.runAsync.mock.calls.find(([sql]) => sql.includes('UPDATE habits SET status'));
    return call as unknown as [string, unknown[]] | undefined;
  }

  it('pauseHabit writes the durable status, opens an ongoing interval, and enqueues a backup update', async () => {
    const db = lifecycleDb({ status: 'active', lifecycle_history: null });
    getDatabase.mockResolvedValue(db);

    await expect(pauseHabit('habit_1', '2026-08-10')).resolves.toBe(true);

    const update = statusUpdateCall(db);
    expect(update).toBeDefined();
    const [status, historyJson] = update![1];
    expect(status).toBe('paused');
    expect(JSON.parse(historyJson as string)).toEqual([
      { status: 'paused', from_date_key: '2026-08-10', to_date_key: null },
    ]);

    // The outbox intent rides the same transaction (entity + operation).
    const outboxWrite = db.runAsync.mock.calls.find(([sql]) => sql.includes('sync_outbox'));
    expect(outboxWrite).toBeDefined();
    expect(JSON.stringify(outboxWrite![1])).toContain('"habits"');
    expect(JSON.stringify(outboxWrite![1])).toContain('"update"');
  });

  it('resumeHabit closes the open pause interval', async () => {
    const db = lifecycleDb({
      status: 'paused',
      lifecycle_history: JSON.stringify([
        { status: 'paused', from_date_key: '2026-08-01', to_date_key: null },
      ]),
    });
    getDatabase.mockResolvedValue(db);

    await expect(resumeHabit('habit_1', '2026-08-10')).resolves.toBe(true);

    const update = statusUpdateCall(db);
    expect(update).toBeDefined();
    const [status, historyJson] = update![1];
    expect(status).toBe('active');
    expect(JSON.parse(historyJson as string)).toEqual([
      { status: 'paused', from_date_key: '2026-08-01', to_date_key: '2026-08-10' },
    ]);
  });

  it('archiveHabit closes an open pause and opens the archive interval', async () => {
    const db = lifecycleDb({
      status: 'paused',
      lifecycle_history: JSON.stringify([
        { status: 'paused', from_date_key: '2026-08-01', to_date_key: null },
      ]),
    });
    getDatabase.mockResolvedValue(db);

    await expect(archiveHabit('habit_1', '2026-08-10')).resolves.toBe(true);

    const update = statusUpdateCall(db);
    expect(update).toBeDefined();
    const [status, historyJson] = update![1];
    expect(status).toBe('archived');
    expect(JSON.parse(historyJson as string)).toEqual([
      { status: 'paused', from_date_key: '2026-08-01', to_date_key: '2026-08-10' },
      { status: 'archived', from_date_key: '2026-08-10', to_date_key: null },
    ]);
  });

  it('re-entering the current state is an idempotent no-op', async () => {
    const db = lifecycleDb({
      status: 'paused',
      lifecycle_history: JSON.stringify([
        { status: 'paused', from_date_key: '2026-08-01', to_date_key: null },
      ]),
    });
    getDatabase.mockResolvedValue(db);

    await expect(pauseHabit('habit_1')).resolves.toBe(false);

    expect(statusUpdateCall(db)).toBeUndefined();
    expect(db.runAsync.mock.calls.some(([sql]) => sql.includes('sync_outbox'))).toBe(false);
  });

  it('does not write when the habit is missing or soft-deleted', async () => {
    const db = lifecycleDb(null);
    getDatabase.mockResolvedValue(db);

    await expect(archiveHabit('habit_gone')).resolves.toBe(false);
    expect(db.runAsync).not.toHaveBeenCalled();
  });
});

describe('features/habits/habits.data — notification completion lifecycle guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linkedActionsEngine.processSourceAction.mockResolvedValue({
      matchedRuleCount: 0,
      notices: [],
    });
  });

  const ACTION_INPUT = {
    habitId: 'habit_1',
    dateKey: '2026-08-10',
    actionKey: 'action_key_1',
    occurrenceId: 'occurrence_1',
    now: new Date(2026, 7, 10, 9, 0, 0, 0),
  };

  function guardDb(habitRow: Record<string, unknown> | null) {
    return {
      getFirstAsync: vi.fn(async (sql: string) => {
        if (sql.includes('FROM habits')) return habitRow;
        if (sql.includes('FROM habit_completions')) return null;
        return null;
      }),
      runAsync: vi.fn(async () => ({ changes: 1, lastInsertRowId: 1 })),
      withTransactionAsync: vi.fn(async (task: () => Promise<void>) => {
        await task();
      }),
    };
  }

  it.each(['paused', 'archived'] as const)(
    'refuses a %s habit as a noop and clears the linked-action requirement',
    async (status) => {
      const db = guardDb({
        id: 'habit_1',
        name: 'Hydrate',
        target_per_day: 1,
        created_at: '2026-08-01T00:00:00.000Z',
        rule_history: JSON.stringify([
          { effective_from_date: '2026-08-01', weekdays: [1, 2, 3, 4, 5, 6, 7], target_per_day: 1 },
        ]),
        status,
      });
      getDatabase.mockResolvedValue(db);
      notificationActions.claimNotificationActionInTransaction.mockResolvedValue({
        claimed: true,
        linkedEventId: 'levt_1',
        linkedActionRequired: true,
      });

      await expect(completeHabitFromNotification(ACTION_INPUT)).resolves.toEqual({
        status: 'noop',
        count: 0,
        linkedActions: { matchedRuleCount: 0, notices: [] },
      });

      expect(
        notificationActions.setNotificationActionLinkedRequiredInTransaction,
      ).toHaveBeenCalledWith(db, 'action_key_1', false);
      expect(
        db.getFirstAsync.mock.calls.some(([sql]) => sql.includes('INSERT INTO habit_completions')),
      ).toBe(false);
      expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
    },
  );

  it('still applies completions for active scheduled habits', async () => {
    const db = guardDb({
      id: 'habit_1',
      name: 'Hydrate',
      target_per_day: 1,
      created_at: '2026-08-01T00:00:00.000Z',
      rule_history: JSON.stringify([
        { effective_from_date: '2026-08-01', weekdays: [1, 2, 3, 4, 5, 6, 7], target_per_day: 1 },
      ]),
      status: 'active',
    });
    getDatabase.mockResolvedValue(db);
    notificationActions.claimNotificationActionInTransaction.mockResolvedValue({
      claimed: true,
      linkedEventId: 'levt_active',
      linkedActionRequired: false,
    });
    db.getFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM habits')) {
        return {
          id: 'habit_1',
          name: 'Hydrate',
          target_per_day: 1,
          created_at: '2026-08-01T00:00:00.000Z',
          rule_history: JSON.stringify([
            {
              effective_from_date: '2026-08-01',
              weekdays: [1, 2, 3, 4, 5, 6, 7],
              target_per_day: 1,
            },
          ]),
          status: 'active',
        };
      }
      if (sql.includes('INSERT INTO habit_completions')) return { id: 'hcmp_1', count: 1 };
      return null;
    });

    await expect(completeHabitFromNotification(ACTION_INPUT)).resolves.toMatchObject({
      status: 'applied',
      count: 1,
    });

    expect(
      db.getFirstAsync.mock.calls.some(([sql]) => sql.includes('INSERT INTO habit_completions')),
    ).toBe(true);
    expect(linkedActionsEngine.processSourceAction).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'habit_1', eventId: 'levt_active' }),
    );
  });
});
