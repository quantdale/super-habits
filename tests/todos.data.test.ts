import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  bulkAssignTodosProject,
  bulkRemoveTodos,
  bulkSetTodoCompletion,
  bulkUpdateTodoPriority,
  completeTodoFromLinkedAction,
  countPendingTodos,
  createRecurringInstance,
  listPendingTodos,
  removeTodo,
  saveTodoLinkedActionRules,
  toggleTodo,
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
  const todoRow = {
    id: 'todo_1',
    title: 'Bulk todo',
    notes: null,
    completed: 0,
    due_date: null,
    priority: 'normal',
    sort_order: 1,
    recurrence: null,
    recurrence_id: null,
    project_id: null,
    goal_id: null,
    created_at: '2026-04-16T09:00:00.000Z',
    updated_at: '2026-04-16T09:00:00.000Z',
    deleted_at: null,
  };

  function makeDb() {
    return {
      getFirstAsync: vi.fn().mockImplementation(async (sql: string) => {
        if (/FROM todos/.test(sql)) return { ...todoRow };
        if (/FROM projects/.test(sql)) return { id: 'proj_1' };
        return null;
      }),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    };
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
      (call) =>
        String(call[0]).includes('SET deleted_at = ?') && String(call[0]).includes('todos'),
    );
    expect(deleteCalls).toHaveLength(2);
  });
});
