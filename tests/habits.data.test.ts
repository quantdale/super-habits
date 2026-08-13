import { beforeEach, describe, expect, it, vi } from 'vitest';
import { incrementHabit, incrementHabitFromLinkedAction } from '@/features/habits/habits.data';

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

const { linkedActionsEngine } = vi.hoisted(() => ({
  linkedActionsEngine: {
    processSourceAction: vi.fn(),
  },
}));

vi.mock('@/core/db/client', () => ({
  getDatabase,
}));

vi.mock('@/core/linked-actions/linkedActions.engine', () => ({
  linkedActionsEngine,
}));

describe('features/habits/habits.data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linkedActionsEngine.processSourceAction.mockResolvedValue({
      matchedRuleCount: 0,
      notices: [],
    });
  });

  it('emits a linked-actions source event when an increment reaches the daily target', async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({
          name: 'Hydrate',
          target_per_day: 2,
        })
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
    // statement instead of performing a race-prone follow-up SELECT.
    expect(db.getFirstAsync).toHaveBeenCalledTimes(2);
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
          name: 'Hydrate',
          target_per_day: 3,
        })
        .mockResolvedValueOnce({
          id: 'hcmp_1',
          count: 2,
        }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const result = await incrementHabit('habit_1', '2026-04-14');

    expect(db.getFirstAsync).toHaveBeenCalledTimes(2);
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
        .mockResolvedValueOnce({
          name: 'Hydrate',
          target_per_day: 2,
        })
        .mockResolvedValueOnce({
          id: 'hcmp_1',
          count: 3,
        }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const result = await incrementHabit('habit_1', '2026-04-14');

    expect(db.getFirstAsync).toHaveBeenCalledTimes(2);
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

  it('uses the same atomic upsert on repeated increments (double-tap safety)', async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({ name: 'Hydrate', target_per_day: 5 })
        .mockResolvedValueOnce({ id: 'hcmp_1', count: 1 })
        .mockResolvedValueOnce({ name: 'Hydrate', target_per_day: 5 })
        .mockResolvedValueOnce({ id: 'hcmp_1', count: 2 }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const first = await incrementHabit('habit_1', '2026-04-14');
    const second = await incrementHabit('habit_1', '2026-04-14');

    // Both calls issue the single ON CONFLICT statement — there is no
    // SELECT-then-INSERT branch left to interleave. (Mock-level proof of the
    // statement shape; the SQL itself was validated against real SQLite.)
    expect(db.getFirstAsync).toHaveBeenCalledTimes(4);
    for (const [sql] of [db.getFirstAsync.mock.calls[1], db.getFirstAsync.mock.calls[3]]) {
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
});
