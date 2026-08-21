import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addTodo,
  bulkAssignTodosProject,
  bulkRemoveTodos,
  bulkSetTodoCompletion,
  bulkUpdateTodoPriority,
  completeTodoFromLinkedAction,
  countPendingTodos,
  createRecurringInstance,
  createRecurringInstances,
  listPendingTodos,
  removeTodo,
  saveTodoLinkedActionRules,
  toggleTodo,
  updateTodoOrder,
} from '@/features/todos/todos.data';

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

const { linkedActionsEngine } = vi.hoisted(() => ({
  linkedActionsEngine: {
    processSourceAction: vi.fn(),
  },
}));

const linkedActionDataMocks = vi.hoisted(() => ({
  deleteLinkedActionRulesForTargetEntity: vi.fn(),
  listLinkedActionRulesForSourceEntity: vi.fn(),
  replaceLinkedActionRulesForSourceEntity: vi.fn(),
}));

const { syncEngine } = vi.hoisted(() => ({
  syncEngine: {
    enqueue: vi.fn(),
    prepare: vi.fn((record: Record<string, unknown>) => ({ ...record, revision: 1 })),
    enqueuePrepared: vi.fn(),
  },
}));

vi.mock('@/core/db/client', () => ({
  getDatabase,
}));

vi.mock('@/core/linked-actions/linkedActions.engine', () => ({
  linkedActionsEngine,
}));

vi.mock('@/core/linked-actions/linkedActions.data', () => linkedActionDataMocks);

vi.mock('@/core/sync/sync.engine', () => ({
  syncEngine,
}));

vi.mock('@/lib/time', async () => {
  const actual = await vi.importActual<typeof import('@/lib/time')>('@/lib/time');
  return {
    ...actual,
    nowIso: vi.fn(() => '2026-04-16T10:00:00.000Z'),
    toDateKey: vi.fn(() => '2026-04-16'),
  };
});

describe('features/todos/todos.data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linkedActionDataMocks.replaceLinkedActionRulesForSourceEntity.mockResolvedValue(undefined);
    linkedActionDataMocks.deleteLinkedActionRulesForTargetEntity.mockResolvedValue(undefined);
    linkedActionsEngine.processSourceAction.mockResolvedValue({
      mode: 'apply',
      sourceEvent: {
        eventId: 'levt_1',
        feature: 'todos',
        entityType: 'todo',
        entityId: 'todo_1',
        triggerType: 'todo.completed',
        sourceRecordId: 'todo_1',
        sourceDateKey: '2026-04-16',
        occurredAt: '2026-04-16T10:00:00.000Z',
        label: 'Source todo',
        payload: {},
        origin: {
          originKind: 'user',
          originRuleId: null,
          originEventId: null,
        },
        chain: {
          chainId: 'lchain_1',
          rootEventId: 'levt_1',
          parentEventId: null,
          depth: 0,
        },
      },
      matchedRuleCount: 0,
      effects: [],
      notices: [],
    });
  });

  it('dispatches linked actions only on non-recurring 0->1 completion', async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue({
        id: 'todo_1',
        title: 'Source todo',
        notes: null,
        completed: 0,
        due_date: null,
        priority: 'normal',
        sort_order: 1,
        recurrence: null,
        recurrence_id: null,
        created_at: '2026-04-16T09:00:00.000Z',
        updated_at: '2026-04-16T09:00:00.000Z',
        deleted_at: null,
      }),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    };
    getDatabase.mockResolvedValue(db);

    const result = await toggleTodo({ id: 'todo_1' } as never);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE todos SET completed = ?, completed_at = ?, updated_at = ?'),
      [1, expect.any(String), '2026-04-16T10:00:00.000Z', 'todo_1', 0],
    );
    expect(linkedActionsEngine.processSourceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'todos',
        entityType: 'todo',
        entityId: 'todo_1',
        triggerType: 'todo.completed',
      }),
    );
    expect(result.completed).toBe(1);
  });

  it('does not dispatch on reopen (1->0)', async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue({
        id: 'todo_1',
        title: 'Source todo',
        notes: null,
        completed: 1,
        due_date: null,
        priority: 'normal',
        sort_order: 1,
        recurrence: null,
        recurrence_id: null,
        created_at: '2026-04-16T09:00:00.000Z',
        updated_at: '2026-04-16T09:00:00.000Z',
        deleted_at: null,
      }),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    };
    getDatabase.mockResolvedValue(db);

    const result = await toggleTodo({ id: 'todo_1' } as never);

    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
    expect(result).toEqual({
      completed: 0,
      linkedActions: {
        matchedRuleCount: 0,
        notices: [],
      },
    });
  });

  it('does not dispatch for recurring todos and still creates follow-up instance', async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'todo_1',
          title: 'Recurring todo',
          notes: null,
          completed: 0,
          due_date: '2026-04-16',
          priority: 'normal',
          sort_order: 1,
          recurrence: 'daily',
          recurrence_id: 'rec_1',
          created_at: '2026-04-16T09:00:00.000Z',
          updated_at: '2026-04-16T09:00:00.000Z',
          deleted_at: null,
        })
        .mockResolvedValueOnce(null),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    };
    getDatabase.mockResolvedValue(db);

    await toggleTodo({ id: 'todo_1' } as never);

    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO todos'),
      expect.arrayContaining(['rec_1']),
    );
  });

  it('skips a recurring instance when the same active series/day already exists', async () => {
    const db = {
      getFirstAsync: vi.fn(),
      runAsync: vi.fn().mockResolvedValue({ changes: 0 }),
    };
    getDatabase.mockResolvedValue(db);

    await createRecurringInstance({
      title: 'Daily review',
      notes: null,
      priority: 'normal',
      recurrenceId: 'rec_1',
      dueDate: '2026-04-17',
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE NOT EXISTS'),
      expect.arrayContaining(['rec_1', '2026-04-17']),
    );
    expect(syncEngine.enqueuePrepared).not.toHaveBeenCalled();
  });

  it('inserts and enqueues one recurring instance when the series/day is missing', async () => {
    const db = {
      getFirstAsync: vi.fn(),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    };
    getDatabase.mockResolvedValue(db);

    await createRecurringInstance({
      title: 'Daily review',
      notes: null,
      priority: 'normal',
      recurrenceId: 'rec_1',
      dueDate: '2026-04-17',
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO todos'),
      expect.arrayContaining(['rec_1', '2026-04-17']),
    );
    expect(syncEngine.enqueuePrepared).toHaveBeenCalledTimes(1);
    expect(syncEngine.enqueuePrepared).toHaveBeenCalledWith(
      {
        entity: 'todos',
        id: expect.stringMatching(/^todo_/),
        updatedAt: expect.any(String),
        operation: 'create',
        revision: 1,
      },
      { durablyPersisted: true },
    );
  });

  it('rejects saving non-empty source rules for recurring todos based on persisted row', async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue({
        id: 'todo_1',
        recurrence: 'daily',
        deleted_at: null,
      }),
      runAsync: vi.fn(),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      saveTodoLinkedActionRules('todo_1', [
        {
          triggerType: 'todo.completed',
          target: {
            feature: 'todos',
            entityType: 'todo',
            entityId: 'todo_target',
            effect: {
              kind: 'binary',
              type: 'todo.complete',
            },
          },
        },
      ]),
    ).rejects.toThrow('Recurring todos cannot be linked-action sources yet.');
    expect(linkedActionDataMocks.replaceLinkedActionRulesForSourceEntity).not.toHaveBeenCalled();
  });

  it('allows saving todo.completed -> habit.increment rules for non-recurring todos', async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue({
        id: 'todo_1',
        recurrence: null,
        deleted_at: null,
      }),
      runAsync: vi.fn(),
    };
    getDatabase.mockResolvedValue(db);

    await saveTodoLinkedActionRules('todo_1', [
      {
        triggerType: 'todo.completed',
        target: {
          feature: 'habits',
          entityType: 'habit',
          entityId: 'habit_1',
          effect: {
            kind: 'progress',
            type: 'habit.increment',
            amount: 1,
            dateStrategy: 'source_date',
          },
        },
      },
    ]);

    expect(linkedActionDataMocks.replaceLinkedActionRulesForSourceEntity).toHaveBeenCalledWith({
      feature: 'todos',
      entityType: 'todo',
      entityId: 'todo_1',
      rules: [
        {
          triggerType: 'todo.completed',
          target: {
            feature: 'habits',
            entityType: 'habit',
            entityId: 'habit_1',
            effect: {
              kind: 'progress',
              type: 'habit.increment',
              amount: 1,
              dateStrategy: 'source_date',
            },
          },
        },
      ],
    });
  });

  it('cleans source and target linked rules when removing a todo', async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue({
        id: 'todo_1',
        recurrence: null,
        deleted_at: null,
      }),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
      getAllAsync: vi.fn().mockResolvedValue([]),
    };
    getDatabase.mockResolvedValue(db);

    await removeTodo('todo_1');

    expect(db.runAsync).toHaveBeenCalledWith(
      'UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      ['2026-04-16T10:00:00.000Z', '2026-04-16T10:00:00.000Z', 'todo_1'],
    );

    expect(linkedActionDataMocks.replaceLinkedActionRulesForSourceEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'todos',
        entityType: 'todo',
        entityId: 'todo_1',
        rules: [],
      }),
    );
    expect(linkedActionDataMocks.deleteLinkedActionRulesForTargetEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'todos',
        entityType: 'todo',
        entityId: 'todo_1',
        deletedAt: '2026-04-16T10:00:00.000Z',
      }),
    );
  });

  it('returns safe no-op notice metadata when engine reports self-target skip', async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue({
        id: 'todo_1',
        title: 'Self target todo',
        notes: null,
        completed: 0,
        due_date: null,
        priority: 'normal',
        sort_order: 1,
        recurrence: null,
        recurrence_id: null,
        created_at: '2026-04-16T09:00:00.000Z',
        updated_at: '2026-04-16T09:00:00.000Z',
        deleted_at: null,
      }),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    };
    getDatabase.mockResolvedValue(db);
    linkedActionsEngine.processSourceAction.mockResolvedValue({
      mode: 'apply',
      sourceEvent: {
        eventId: 'levt_2',
        feature: 'todos',
        entityType: 'todo',
        entityId: 'todo_1',
        triggerType: 'todo.completed',
        sourceRecordId: 'todo_1',
        sourceDateKey: '2026-04-16',
        occurredAt: '2026-04-16T10:00:00.000Z',
        label: 'Self target todo',
        payload: {},
        origin: {
          originKind: 'user',
          originRuleId: null,
          originEventId: null,
        },
        chain: {
          chainId: 'lchain_2',
          rootEventId: 'levt_2',
          parentEventId: null,
          depth: 0,
        },
      },
      matchedRuleCount: 1,
      effects: [
        {
          executionId: null,
          ruleId: 'link_self',
          status: 'skipped',
          effectType: 'todo.complete',
          effectFingerprint: 'fp',
          targetFeature: 'todos',
          targetEntityType: 'todo',
          targetEntityId: 'todo_1',
          producedEntityType: null,
          producedEntityId: null,
          reason: 'self_target_noop',
          errorMessage: null,
          notice: null,
          noticePreview: null,
        },
      ],
      notices: [],
    });

    const result = await toggleTodo({ id: 'todo_1' } as never);

    expect(result.linkedActions).toEqual({
      matchedRuleCount: 1,
      notices: [],
    });
  });

  it('skips completeTodoFromLinkedAction when the target todo is missing or soft-deleted', async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'todo_deleted',
        title: 'Deleted target',
        completed: 0,
        deleted_at: '2026-04-16T09:00:00.000Z',
      }),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    };
    getDatabase.mockResolvedValue(db);

    await expect(completeTodoFromLinkedAction('todo_missing')).resolves.toEqual({
      status: 'skipped',
      reason: 'target_missing',
    });
    await expect(completeTodoFromLinkedAction('todo_deleted')).resolves.toEqual({
      status: 'skipped',
      reason: 'target_missing',
    });

    expect(db.runAsync).not.toHaveBeenCalled();
    expect(syncEngine.enqueuePrepared).not.toHaveBeenCalled();
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
  });

  it('marks the target todo complete without emitting a new todo.completed source event', async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue({
        id: 'todo_2',
        title: 'Target todo',
        completed: 0,
        deleted_at: null,
      }),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    };
    getDatabase.mockResolvedValue(db);

    await expect(completeTodoFromLinkedAction('todo_2')).resolves.toEqual({
      status: 'applied',
      targetLabel: 'Target todo',
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('completed = 1, completed_at = ?'),
      [expect.any(String), expect.any(String), 'todo_2'],
    );
    expect(syncEngine.enqueuePrepared).toHaveBeenCalledWith(
      {
        entity: 'todos',
        id: 'todo_2',
        updatedAt: expect.any(String),
        operation: 'update',
        revision: 1,
      },
      { durablyPersisted: true },
    );
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
  });

  describe('listPendingTodos', () => {
    it('queries only non-deleted, incomplete todos', async () => {
      const pendingRow = {
        id: 'todo_pending',
        title: 'Pending todo',
        notes: null,
        completed: 0,
        due_date: null,
        priority: 'normal',
        sort_order: 1,
        recurrence: null,
        recurrence_id: null,
        created_at: '2026-04-16T09:00:00.000Z',
        updated_at: '2026-04-16T09:00:00.000Z',
        deleted_at: null,
      };
      const db = {
        getAllAsync: vi.fn().mockResolvedValue([pendingRow]),
      };
      getDatabase.mockResolvedValue(db);

      const result = await listPendingTodos();

      expect(db.getAllAsync).toHaveBeenCalledWith(
        expect.stringMatching(/WHERE\s+deleted_at IS NULL\s+AND completed = 0/),
      );
      expect(result).toEqual([pendingRow]);
    });
  });

  describe('countPendingTodos', () => {
    it('returns the count of non-deleted, incomplete todos', async () => {
      const db = {
        getFirstAsync: vi.fn().mockResolvedValue({ count: 3 }),
      };
      getDatabase.mockResolvedValue(db);

      const result = await countPendingTodos();

      expect(db.getFirstAsync).toHaveBeenCalledWith(
        expect.stringMatching(/WHERE\s+deleted_at IS NULL\s+AND completed = 0/),
      );
      expect(result).toBe(3);
    });

    it('returns 0 when the query yields no row', async () => {
      const db = {
        getFirstAsync: vi.fn().mockResolvedValue(undefined),
      };
      getDatabase.mockResolvedValue(db);

      await expect(countPendingTodos()).resolves.toBe(0);
    });
  });
});

describe('bulk todo operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TODO_DEFAULTS = {
    id: '',
    title: 'Bulk todo',
    notes: null as string | null,
    completed: 0 as 0 | 1,
    due_date: null as string | null,
    priority: 'normal' as string,
    sort_order: 1 as number,
    recurrence: null as string | null,
    recurrence_id: null as string | null,
    project_id: null as string | null,
    goal_id: null as string | null,
    created_at: '2026-04-16T09:00:00.000Z',
    updated_at: '2026-04-16T09:00:00.000Z',
    deleted_at: null as string | null,
  };

  function makeDb() {
    return {
      getFirstAsync: vi.fn().mockImplementation(async (sql: string) => {
        if (/COALESCE\(MAX\(sort_order\)/.test(sql)) return { maxOrder: 0 };
        if (/FROM todos/.test(sql)) return { ...TODO_DEFAULTS, id: 'todo_1' };
        if (/FROM projects/.test(sql)) return { id: 'proj_1' };
        return null;
      }),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
      getAllAsync: vi.fn().mockResolvedValue([]),
    };
  }

  type SeedRow = Partial<typeof TODO_DEFAULTS>;
  type PlanRow = { id: string; top_todo_ids: string };

  /**
   * A stateful in-memory double: UPDATE handlers mutate the seeded rows so
   * retry-idempotency and skip counting behave like real SQLite.
   */
  function makeStatefulDb(seed: Record<string, SeedRow> = {}, plans: PlanRow[] = []) {
    const rows = new Map<string, typeof TODO_DEFAULTS>();
    for (const [id, row] of Object.entries(seed)) {
      rows.set(id, { ...TODO_DEFAULTS, id, ...row });
    }
    let transactionCount = 0;
    const db = {
      getFirstAsync: vi.fn(async (sql: string, args: unknown[]) => {
        const queryArgs = args ?? [];
        if (/COALESCE\(MAX\(sort_order\)/.test(sql)) return { maxOrder: 0 };
        if (/FROM todos/.test(sql)) return rows.get(queryArgs[0] as string) ?? null;
        if (/FROM projects/.test(sql)) return { id: 'proj_1' };
        return null;
      }),
      getAllAsync: vi.fn(async () => plans.map((plan) => ({ ...plan }))),
      runAsync: vi.fn(async (sql: string, args: unknown[]) => {
        const queryArgs = args ?? [];
        if (/UPDATE todos SET completed/.test(sql)) {
          // [next, completedAt, updatedAt, id, previous]
          const [completed, , , id, previous] = queryArgs as [
            number,
            unknown,
            unknown,
            string,
            number,
          ];
          const row = rows.get(id);
          if (!row || row.deleted_at !== null || row.completed !== previous) return { changes: 0 };
          row.completed = completed as 0 | 1;
          return { changes: 1 };
        }
        if (/UPDATE todos SET deleted_at/.test(sql)) {
          const row = rows.get(queryArgs[2] as string);
          if (!row || row.deleted_at !== null) return { changes: 0 };
          row.deleted_at = '2026-04-16T10:00:00.000Z';
          return { changes: 1 };
        }
        if (/UPDATE todos SET priority/.test(sql)) {
          const [priority, , id] = queryArgs as [string, unknown, string];
          const row = rows.get(id);
          if (!row || row.deleted_at !== null || row.priority === priority) return { changes: 0 };
          row.priority = priority;
          return { changes: 1 };
        }
        if (/UPDATE todos SET sort_order/.test(sql)) {
          const [sortOrder, , id] = queryArgs as [number, unknown, string];
          const row = rows.get(id);
          if (!row || row.deleted_at !== null) return { changes: 0 };
          row.sort_order = sortOrder;
          return { changes: 1 };
        }
        return { changes: 1 };
      }),
      withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => {
        transactionCount += 1;
        await fn();
      }),
    };
    return { db, rows, getTransactionCount: () => transactionCount };
  }

  it('bulkSetTodoCompletion completes each id exactly once', async () => {
    const db = makeDb();
    getDatabase.mockResolvedValue(db);

    await bulkSetTodoCompletion(['todo_1', 'todo_2'], 1);

    const completionCalls = db.runAsync.mock.calls.filter((call) =>
      String(call[0]).includes('SET completed = ?'),
    );
    expect(completionCalls).toHaveLength(2);
  });

  it('bulkUpdateTodoPriority updates each id', async () => {
    const db = makeDb();
    getDatabase.mockResolvedValue(db);

    await bulkUpdateTodoPriority(['todo_1', 'todo_2'], 'urgent');

    const priorityCalls = db.runAsync.mock.calls.filter((call) =>
      String(call[0]).includes('priority = ?'),
    );
    expect(priorityCalls).toHaveLength(2);
    expect(priorityCalls[0][1]).toContain('urgent');
  });

  it('bulkAssignTodosProject assigns the project to each id', async () => {
    const db = makeDb();
    getDatabase.mockResolvedValue(db);

    await bulkAssignTodosProject(['todo_1', 'todo_2'], 'proj_1');

    const assignCalls = db.runAsync.mock.calls.filter((call) =>
      String(call[0]).includes('project_id = ?, goal_id = ?'),
    );
    expect(assignCalls).toHaveLength(2);
    expect(assignCalls[0][1]).toEqual(['proj_1', null, expect.any(String), 'todo_1']);
  });

  it('bulkRemoveTodos soft-deletes each id', async () => {
    const db = makeDb();
    getDatabase.mockResolvedValue(db);

    await bulkRemoveTodos(['todo_1', 'todo_2']);

    const deleteCalls = db.runAsync.mock.calls.filter(
      (call) => String(call[0]).includes('SET deleted_at = ?') && String(call[0]).includes('todos'),
    );
    expect(deleteCalls).toHaveLength(2);
  });

  it('reports structured counts and tolerates a missing id mid-batch', async () => {
    const { db } = makeStatefulDb({ todo_a: {}, todo_b: {} });
    getDatabase.mockResolvedValue(db);

    await expect(bulkSetTodoCompletion(['todo_a', 'todo_missing', 'todo_b'], 1)).resolves.toEqual({
      changed: 2,
      skipped: 1,
    });
  });

  it('is idempotent on retry after a successful bulk completion', async () => {
    const { db } = makeStatefulDb({ todo_a: {}, todo_b: {} });
    getDatabase.mockResolvedValue(db);

    await expect(bulkSetTodoCompletion(['todo_a', 'todo_b'], 1)).resolves.toEqual({
      changed: 2,
      skipped: 0,
    });
    await expect(bulkSetTodoCompletion(['todo_a', 'todo_b'], 1)).resolves.toEqual({
      changed: 0,
      skipped: 2,
    });
  });

  it('commits a bulk completion in exactly one transaction with per-row backup intents', async () => {
    const { db, getTransactionCount } = makeStatefulDb({ todo_a: {}, todo_b: {} });
    getDatabase.mockResolvedValue(db);

    await bulkSetTodoCompletion(['todo_a', 'todo_b'], 1);

    expect(getTransactionCount()).toBe(1);
    expect(syncEngine.enqueuePrepared).toHaveBeenCalledTimes(2);
  });

  it('propagates a mid-batch failure instead of silently swallowing it', async () => {
    const { db } = makeStatefulDb({ todo_a: {}, todo_b: {} });
    const baseRun = db.runAsync.getMockImplementation()!;
    db.runAsync.mockImplementation(async (sql: string, args: unknown[] = []) => {
      if (/UPDATE todos SET completed/.test(sql) && args[3] === 'todo_b') {
        throw new Error('disk I/O error');
      }
      return baseRun(sql, args);
    });
    getDatabase.mockResolvedValue(db);

    await expect(bulkSetTodoCompletion(['todo_a', 'todo_b'], 1)).rejects.toThrow('disk I/O error');
  });

  it('counts already-deleted and unknown ids as skipped for bulk removal', async () => {
    const { db } = makeStatefulDb({
      todo_a: {},
      todo_gone: { deleted_at: '2026-04-16T08:00:00.000Z' },
    });
    getDatabase.mockResolvedValue(db);

    await expect(bulkRemoveTodos(['todo_a', 'todo_gone', 'todo_never'])).resolves.toEqual({
      changed: 1,
      skipped: 2,
    });
  });

  it('skips rows already at the target priority without rewriting them', async () => {
    const { db } = makeStatefulDb({ todo_a: {}, todo_done: { priority: 'urgent' } });
    getDatabase.mockResolvedValue(db);

    await expect(bulkUpdateTodoPriority(['todo_a', 'todo_done'], 'urgent')).resolves.toEqual({
      changed: 1,
      skipped: 1,
    });
    const priorityCalls = db.runAsync.mock.calls.filter((call) =>
      String(call[0]).includes('priority = ?'),
    );
    expect(priorityCalls).toHaveLength(2); // attempted per id, no-op for the matching row
  });

  describe('updateTodoOrder (F10)', () => {
    it('persists absolute sort orders in ONE transaction with per-row intents', async () => {
      const { db, getTransactionCount } = makeStatefulDb({ t1: {}, t2: {}, t3: {} });
      getDatabase.mockResolvedValue(db);

      await updateTodoOrder(['t1', 't2', 't3']);

      expect(getTransactionCount()).toBe(1);
      const orderCalls = db.runAsync.mock.calls.filter((call) =>
        String(call[0]).includes('SET sort_order'),
      );
      expect(orderCalls).toHaveLength(3);
      expect(orderCalls.map((call) => call[1][0])).toEqual([1, 2, 3]);
      expect(syncEngine.enqueuePrepared).toHaveBeenCalledTimes(3);
    });

    it('re-persists the same ordering on retry', async () => {
      const { db, rows } = makeStatefulDb({ t1: {}, t2: {} });
      getDatabase.mockResolvedValue(db);

      await updateTodoOrder(['t2', 't1']);
      await updateTodoOrder(['t2', 't1']);

      expect(rows.get('t2')!.sort_order).toBe(1);
      expect(rows.get('t1')!.sort_order).toBe(2);
    });

    it('is a no-op for an empty list', async () => {
      const { db, getTransactionCount } = makeStatefulDb({});
      getDatabase.mockResolvedValue(db);

      await updateTodoOrder([]);

      expect(getTransactionCount()).toBe(0);
      expect(syncEngine.enqueuePrepared).not.toHaveBeenCalled();
    });
  });

  describe('sort_order allocation (F9)', () => {
    it('allocates addTodo sort_order inside the mutation transaction', async () => {
      const events: string[] = [];
      const db = {
        getFirstAsync: vi.fn(async (sql: string) => {
          if (/COALESCE\(MAX\(sort_order\)/.test(sql)) {
            events.push('max-read');
            return { maxOrder: 7 };
          }
          return null;
        }),
        runAsync: vi.fn(async (sql: string, args: unknown[]) => {
          void args;
          events.push('insert');
          return { changes: 1 };
        }),
        withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => {
          events.push('tx-start');
          await fn();
        }),
      };
      getDatabase.mockResolvedValue(db);

      await addTodo({ title: 'Racy add' });

      expect(events.indexOf('tx-start')).toBeLessThan(events.indexOf('max-read'));
      expect(events.indexOf('max-read')).toBeLessThan(events.indexOf('insert'));
      const insertCall = db.runAsync.mock.calls.find((call) =>
        String(call[0]).includes('INSERT INTO todos'),
      );
      // [id, title, notes, dueDate, priority, sortOrder, ...]
      expect(insertCall![1][5]).toBe(8);
    });

    it('assigns consecutive sort orders to a recurring batch inside one transaction', async () => {
      const db = {
        getFirstAsync: vi.fn(async (sql: string) =>
          /COALESCE\(MAX\(sort_order\)/.test(sql) ? { maxOrder: 5 } : null,
        ),
        runAsync: vi.fn(async (sql: string, args: unknown[]) => {
          void sql;
          void args;
          return { changes: 1 };
        }),
        withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => {
          await fn();
        }),
      };
      getDatabase.mockResolvedValue(db);

      await createRecurringInstances([
        {
          title: 'A',
          notes: null,
          priority: 'normal',
          recurrenceId: 'rec_1',
          dueDate: '2026-04-17',
        },
        {
          title: 'B',
          notes: null,
          priority: 'normal',
          recurrenceId: 'rec_2',
          dueDate: '2026-04-17',
        },
        {
          title: 'C',
          notes: null,
          priority: 'normal',
          recurrenceId: 'rec_3',
          dueDate: '2026-04-17',
        },
      ]);

      expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
      const inserts = db.runAsync.mock.calls.filter((call) =>
        String(call[0]).includes('INSERT INTO todos'),
      );
      expect(inserts).toHaveLength(3);
      expect(inserts.map((call) => call[1][5])).toEqual([6, 7, 8]);
      expect(syncEngine.enqueuePrepared).toHaveBeenCalledTimes(3);
    });
  });

  describe('daily plan pruning on remove (F11)', () => {
    it('prunes the removed id from plan top_todo_ids inside the same transaction', async () => {
      const { db, getTransactionCount } = makeStatefulDb({ todo_1: {} }, [
        { id: 'dplan_1', top_todo_ids: JSON.stringify(['todo_1', 'todo_9']) },
        { id: 'dplan_2', top_todo_ids: JSON.stringify(['todo_9']) },
      ]);
      getDatabase.mockResolvedValue(db);

      await removeTodo('todo_1');

      expect(getTransactionCount()).toBe(1);
      const planUpdates = db.runAsync.mock.calls.filter((call) =>
        String(call[0]).includes('UPDATE daily_plans'),
      );
      expect(planUpdates).toHaveLength(1);
      expect(planUpdates[0][1]).toEqual([
        JSON.stringify(['todo_9']),
        expect.any(String),
        'dplan_1',
      ]);
      expect(syncEngine.enqueuePrepared).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'daily_plans', id: 'dplan_1', operation: 'update' }),
        { durablyPersisted: true },
      );
    });
  });
});
