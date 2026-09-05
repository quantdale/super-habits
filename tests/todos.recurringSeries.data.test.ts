import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  stopRecurringSeries,
  updateRecurringSeriesTemplate,
  updateTodo,
} from '@/features/todos/todos.data';

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

const { linkedActionsEngine } = vi.hoisted(() => ({
  linkedActionsEngine: { processSourceAction: vi.fn() },
}));

const { syncEngine } = vi.hoisted(() => ({
  syncEngine: {
    enqueue: vi.fn(),
    prepare: vi.fn((record: Record<string, unknown>) => ({ ...record, revision: 1 })),
    enqueuePrepared: vi.fn(),
  },
}));

vi.mock('@/core/db/client', () => ({ getDatabase }));
vi.mock('@/core/linked-actions/linkedActions.engine', () => ({ linkedActionsEngine }));
vi.mock('@/core/linked-actions/linkedActions.data', () => ({
  deleteLinkedActionRulesForTargetEntity: vi.fn(),
  listLinkedActionRulesForSourceEntity: vi.fn(),
  replaceLinkedActionRulesForSourceEntity: vi.fn(),
}));
vi.mock('@/core/sync/sync.engine', () => ({ syncEngine }));

vi.mock('@/lib/time', async () => {
  const actual = await vi.importActual<typeof import('@/lib/time')>('@/lib/time');
  return {
    ...actual,
    nowIso: vi.fn(() => '2026-04-16T10:00:00.000Z'),
    toDateKey: vi.fn(() => '2026-04-16'),
  };
});

type Member = {
  id: string;
  completed: 0 | 1;
  deleted_at: string | null;
  due_date: string | null;
  recurrence: string | null;
  recurrence_id: string | null;
  title: string;
  notes: string | null;
  priority: string;
  project_id: string | null;
  goal_id: string | null;
};

function member(overrides: Partial<Member>): Member {
  return {
    id: 'todo_x',
    completed: 0,
    deleted_at: null,
    due_date: '2026-04-16',
    recurrence: 'daily',
    recurrence_id: 'rec_series',
    title: 'Standup',
    notes: null,
    priority: 'normal',
    project_id: null,
    goal_id: null,
    ...overrides,
  };
}

describe('recurring series correction (features/todos/todos.data)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateRecurringSeriesTemplate', () => {
    it('applies the template to every live instance and enqueues one intent per row', async () => {
      const db = {
        getFirstAsync: vi.fn(),
        getAllAsync: vi.fn().mockImplementation(async (sql: string) =>
          /completed = 0/.test(sql)
            ? [
                { id: 'todo_today', title: 'Standup', due_date: '2026-04-16' },
                { id: 'todo_tomorrow', title: 'Standup', due_date: '2026-04-17' },
              ]
            : [],
        ),
        runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
      };
      getDatabase.mockResolvedValue(db);

      await updateRecurringSeriesTemplate('rec_series', {
        title: 'Morning standup',
        notes: null,
        priority: 'urgent',
      });

      const updates = db.runAsync.mock.calls.filter((call: unknown[]) =>
        String(call[0]).includes('UPDATE todos SET'),
      );
      expect(updates).toHaveLength(2);
      expect(String(updates[0][0])).toContain('title = ?');
      expect(String(updates[0][0])).toContain('priority = ?');
      expect(updates[0][1]).toContain('Morning standup');
      expect(updates[0][1]).toContain('urgent');
      expect(updates[1][1]).toContain('todo_tomorrow');

      const enqueued = syncEngine.prepare.mock.calls.map(
        (call: unknown[]) => call[0] as Record<string, unknown>,
      );
      expect(enqueued).toHaveLength(2);
      expect(enqueued[0]).toMatchObject({ entity: 'todos', id: 'todo_today', operation: 'update' });
      expect(enqueued[1]).toMatchObject({
        entity: 'todos',
        id: 'todo_tomorrow',
        operation: 'update',
      });
    });

    it('never touches completed history and no-ops on an ended series', async () => {
      const db = {
        getFirstAsync: vi.fn(),
        getAllAsync: vi.fn().mockResolvedValue([]),
        runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
      };
      getDatabase.mockResolvedValue(db);

      await updateRecurringSeriesTemplate('rec_gone', { title: 'x' });

      expect(db.runAsync).not.toHaveBeenCalled();
      expect(syncEngine.prepare).not.toHaveBeenCalled();
    });
  });

  describe('stopRecurringSeries', () => {
    it('clears the marker everywhere, soft-deletes only future pending copies, keeps history', async () => {
      const members = [
        member({ id: 'todo_done', completed: 1, due_date: '2026-04-15' }),
        member({ id: 'todo_today', completed: 0, due_date: '2026-04-16' }),
        member({ id: 'todo_future', completed: 0, due_date: '2026-04-17' }),
        member({ id: 'todo_deleted', deleted_at: '2026-04-14T10:00:00.000Z' }),
      ];
      const db = {
        getFirstAsync: vi.fn(),
        getAllAsync: vi.fn(async (sql: string) =>
          /completed, deleted_at/.test(sql) ? members : [],
        ),
        runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
      };
      getDatabase.mockResolvedValue(db);

      await stopRecurringSeries('rec_series');

      const cleared = db.runAsync.mock.calls.filter((call: unknown[]) =>
        String(call[0]).includes('SET recurrence = NULL'),
      );
      // Every member of the series (active, completed, already deleted) loses
      // the marker — a surviving 'daily' row would resurrect via rollover.
      expect(cleared).toHaveLength(4);
      const deletedFuture = cleared.filter((call: unknown[]) =>
        String(call[0]).includes('deleted_at = ?'),
      );
      expect(deletedFuture).toHaveLength(1);
      expect(deletedFuture[0][1]).toContain('todo_future');

      const enqueued = syncEngine.prepare.mock.calls.map(
        (call: unknown[]) => call[0] as Record<string, unknown>,
      );
      expect(enqueued).toContainEqual(
        expect.objectContaining({ entity: 'todos', id: 'todo_future', operation: 'delete' }),
      );
      expect(enqueued).toContainEqual(
        expect.objectContaining({ entity: 'todos', id: 'todo_today', operation: 'update' }),
      );
      expect(enqueued).toContainEqual(
        expect.objectContaining({ entity: 'todos', id: 'todo_done', operation: 'update' }),
      );
      // Already-deleted members keep their existing remote delete intent.
      expect(enqueued.some((r: Record<string, unknown>) => r.id === 'todo_deleted')).toBe(false);
    });

    it('is a no-op for an unknown series', async () => {
      const db = {
        getFirstAsync: vi.fn(),
        getAllAsync: vi.fn().mockResolvedValue([]),
        runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
      };
      getDatabase.mockResolvedValue(db);

      await stopRecurringSeries('rec_missing');

      expect(db.runAsync).not.toHaveBeenCalled();
      expect(syncEngine.prepare).not.toHaveBeenCalled();
    });
  });

  describe('updateTodo restart semantics', () => {
    it('starts a fresh series with a new recurrence id and a default due date', async () => {
      const current = member({ recurrence: null, recurrence_id: null, due_date: null });
      const db = {
        getFirstAsync: vi.fn().mockResolvedValue({ ...current }),
        getAllAsync: vi.fn().mockResolvedValue([]),
        runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
      };
      getDatabase.mockResolvedValue(db);

      await updateTodo('todo_x', { title: 'Standup', recurrence: 'daily' });

      const update = db.runAsync.mock.calls.find((call: unknown[]) =>
        String(call[0]).includes('UPDATE todos SET'),
      );
      expect(update).toBeDefined();
      expect(String(update![0])).toContain('recurrence = ?');
      expect(String(update![0])).toContain('recurrence_id = ?');
      expect(String(update![0])).toContain('due_date = ?');
      expect(update![1]).toContain('daily');
      expect(update![1]).toContain('2026-04-16');
      const newRecId = (update![1] as unknown[]).find((v) => /^rec_/.test(String(v)));
      expect(newRecId).toBeTruthy();
    });

    it('never clears recurrence through updateTodo (stop is series-scoped)', async () => {
      const current = member({});
      const db = {
        getFirstAsync: vi.fn().mockResolvedValue({ ...current }),
        getAllAsync: vi.fn().mockResolvedValue([]),
        runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
      };
      getDatabase.mockResolvedValue(db);

      await updateTodo('todo_x', { title: 'Standup', recurrence: null });

      const update = db.runAsync.mock.calls.find((call: unknown[]) =>
        String(call[0]).includes('UPDATE todos SET'),
      );
      expect(String(update![0])).not.toContain('recurrence = ?');
    });
  });
});
