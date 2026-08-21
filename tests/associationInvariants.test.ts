import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  bulkAssignTodosProject,
  setTodoProjectGoal,
  updateTodo,
} from '@/features/todos/todos.data';
import { setHabitProjectGoal } from '@/features/habits/habits.data';
import { softDeleteProject } from '@/features/projects/projects.data';
import { softDeleteGoal, updateGoal } from '@/features/goals/goals.data';

const { getDatabase } = vi.hoisted(() => ({ getDatabase: vi.fn() }));

const { syncEngine } = vi.hoisted(() => ({
  syncEngine: {
    enqueue: vi.fn(),
    prepare: vi.fn((record: Record<string, unknown>) => ({ ...record, revision: 1 })),
    enqueuePrepared: vi.fn(),
  },
}));

const linkedActionEngine = vi.hoisted(() => ({
  linkedActionsEngine: { processSourceAction: vi.fn() },
}));

const linkedActionDataMocks = vi.hoisted(() => ({
  deleteLinkedActionRulesForTargetEntity: vi.fn(),
  listLinkedActionRulesForSourceEntity: vi.fn(),
  replaceLinkedActionRulesForSourceEntity: vi.fn(),
}));

// runBackupMutation / runLocalMutation reach into account.data; mock the whole
// surface so the in-transaction owner-claiming side effects are inert under test.
const accountDataMocks = vi.hoisted(() => ({
  getCachedLocalDatasetOwner: vi.fn(() => undefined),
  getCachedOwnerBindingProvisional: vi.fn(() => false),
  inspectLocalAccountDataState: vi.fn(async () => ({ hasUserData: false, pendingOutboxCount: 0 })),
  primeLocalDatasetOwner: vi.fn(),
  promoteLocalDatasetOwnerIfProvisional: vi.fn(),
  setLocalDatasetOwner: vi.fn(),
  claimOwnerBindingOnFirstContent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/core/db/client', () => ({ getDatabase }));
vi.mock('@/core/sync/sync.engine', () => ({ syncEngine }));
vi.mock('@/core/linked-actions/linkedActions.engine', () => linkedActionEngine);
vi.mock('@/core/linked-actions/linkedActions.data', () => linkedActionDataMocks);
vi.mock('@/core/auth/account.data', () => accountDataMocks);
vi.mock('@/lib/time', async () => {
  const actual = await vi.importActual<typeof import('@/lib/time')>('@/lib/time');
  return {
    ...actual,
    nowIso: vi.fn(() => '2026-04-16T10:00:00.000Z'),
    toDateKey: vi.fn(() => '2026-04-16'),
  };
});

function makeDb(getFirstAsync: ReturnType<typeof vi.fn>, runAsync: ReturnType<typeof vi.fn>) {
  return { getFirstAsync, runAsync, getAllAsync: vi.fn().mockResolvedValue([]) };
}

describe('H9: Project/Goal association invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setTodoProjectGoal', () => {
    it('auto-aligns project_id to the goal project when assigning a goal', async () => {
      const db = makeDb(
        vi
          .fn()
          .mockResolvedValueOnce({ project_id: null, goal_id: null })
          .mockResolvedValueOnce({ id: 'goal_1', project_id: 'proj_1' }),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await setTodoProjectGoal('todo_1', { goalId: 'goal_1' });

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE todos SET project_id = ?, goal_id = ?, updated_at = ?'),
        ['proj_1', 'goal_1', '2026-04-16T10:00:00.000Z', 'todo_1'],
      );
    });

    it('preserves the current project_id when assigning a goal without a project', async () => {
      const db = makeDb(
        vi
          .fn()
          .mockResolvedValueOnce({ project_id: 'proj_existing', goal_id: null })
          .mockResolvedValueOnce({ id: 'goal_1', project_id: null }),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await setTodoProjectGoal('todo_1', { goalId: 'goal_1' });

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE todos SET project_id = ?, goal_id = ?, updated_at = ?'),
        ['proj_existing', 'goal_1', '2026-04-16T10:00:00.000Z', 'todo_1'],
      );
    });

    it('rejects a dangling project_id', async () => {
      const db = makeDb(
        vi
          .fn()
          .mockResolvedValueOnce({ project_id: null, goal_id: null })
          .mockResolvedValueOnce(null),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await expect(setTodoProjectGoal('todo_1', { projectId: 'ghost' })).rejects.toThrow(
        'Project not found.',
      );
    });

    it('rejects a dangling goal_id', async () => {
      const db = makeDb(
        vi
          .fn()
          .mockResolvedValueOnce({ project_id: null, goal_id: null })
          .mockResolvedValueOnce(null),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await expect(setTodoProjectGoal('todo_1', { goalId: 'ghost' })).rejects.toThrow(
        'Goal not found.',
      );
    });

    it('is a no-op when neither projectId nor goalId is provided', async () => {
      const db = makeDb(vi.fn(), vi.fn().mockResolvedValue({ changes: 1 }));
      getDatabase.mockResolvedValue(db);

      await setTodoProjectGoal('todo_1', {});

      expect(db.runAsync).not.toHaveBeenCalled();
      expect(syncEngine.enqueuePrepared).not.toHaveBeenCalled();
    });
  });

  describe('updateTodo', () => {
    it('rejects a dangling project_id', async () => {
      const db = makeDb(
        vi
          .fn()
          .mockResolvedValueOnce({ project_id: null, goal_id: null })
          .mockResolvedValueOnce(null),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await expect(updateTodo('todo_1', { projectId: 'ghost' })).rejects.toThrow(
        'Project not found.',
      );
    });

    it('rejects a dangling goal_id', async () => {
      const db = makeDb(
        vi
          .fn()
          .mockResolvedValueOnce({ project_id: null, goal_id: null })
          .mockResolvedValueOnce(null),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await expect(updateTodo('todo_1', { goalId: 'ghost' })).rejects.toThrow('Goal not found.');
    });
  });

  describe('setHabitProjectGoal', () => {
    it('auto-aligns project_id to the goal project when assigning a goal', async () => {
      const db = makeDb(
        vi
          .fn()
          .mockResolvedValueOnce({ project_id: null, goal_id: null })
          .mockResolvedValueOnce({ id: 'goal_1', project_id: 'proj_1' }),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await setHabitProjectGoal('habit_1', { goalId: 'goal_1' });

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE habits SET project_id = ?, goal_id = ?, updated_at = ?'),
        ['proj_1', 'goal_1', '2026-04-16T10:00:00.000Z', 'habit_1'],
      );
    });

    it('rejects a dangling goal_id', async () => {
      const db = makeDb(
        vi
          .fn()
          .mockResolvedValueOnce({ project_id: null, goal_id: null })
          .mockResolvedValueOnce(null),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await expect(setHabitProjectGoal('habit_1', { goalId: 'ghost' })).rejects.toThrow(
        'Goal not found.',
      );
    });
  });

  describe('softDeleteProject', () => {
    it('clears project_id from goals, todos, and habits without deleting them', async () => {
      const db = makeDb(
        vi.fn().mockResolvedValue(undefined),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await softDeleteProject('proj_1');

      const sqls = db.runAsync.mock.calls.map((c) => c[0] as string);
      expect(sqls.some((s) => s.includes('UPDATE goals SET project_id = NULL'))).toBe(true);
      expect(sqls.some((s) => s.includes('UPDATE todos SET project_id = NULL'))).toBe(true);
      expect(sqls.some((s) => s.includes('UPDATE habits SET project_id = NULL'))).toBe(true);
      expect(sqls.some((s) => s.includes('UPDATE projects SET deleted_at'))).toBe(true);
    });
  });

  describe('softDeleteGoal', () => {
    it('clears goal_id from todos and habits without deleting them', async () => {
      const db = makeDb(
        vi.fn().mockResolvedValue(undefined),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await softDeleteGoal('goal_1');

      const sqls = db.runAsync.mock.calls.map((c) => c[0] as string);
      expect(sqls.some((s) => s.includes('UPDATE todos SET goal_id = NULL'))).toBe(true);
      expect(sqls.some((s) => s.includes('UPDATE habits SET goal_id = NULL'))).toBe(true);
      expect(sqls.some((s) => s.includes('UPDATE goals SET deleted_at'))).toBe(true);
    });
  });

  describe('updateGoal project move', () => {
    it('reconciles linked todos/habits project_id to the new project', async () => {
      const db = makeDb(
        vi.fn().mockResolvedValueOnce(undefined).mockResolvedValue({ id: 'proj_2' }),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await updateGoal('goal_1', { projectId: 'proj_2' });

      const sqls = db.runAsync.mock.calls.map((c) => c[0] as string);
      expect(
        sqls.some(
          (s) => s.includes('UPDATE todos SET project_id = ?') && s.includes('goal_id = ?'),
        ),
      ).toBe(true);
      expect(
        sqls.some(
          (s) => s.includes('UPDATE habits SET project_id = ?') && s.includes('goal_id = ?'),
        ),
      ).toBe(true);
      expect(sqls.some((s) => s.includes('UPDATE goals SET') && s.includes('project_id = ?'))).toBe(
        true,
      );
    });

    it('rejects a dangling project_id on move', async () => {
      const db = makeDb(
        vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(null),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await expect(updateGoal('goal_1', { projectId: 'ghost' })).rejects.toThrow(
        'Project not found.',
      );
    });
  });

  describe('F12: clearing the project resolves goal alignment', () => {
    it('setTodoProjectGoal clears a goal that belongs to a project when clearing the project', async () => {
      const db = makeDb(
        vi
          .fn()
          .mockResolvedValueOnce({ project_id: 'proj_1', goal_id: 'goal_1' })
          .mockResolvedValueOnce({ project_id: 'proj_1' }),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await setTodoProjectGoal('todo_1', { projectId: null });

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE todos SET project_id = ?, goal_id = ?, updated_at = ?'),
        [null, null, '2026-04-16T10:00:00.000Z', 'todo_1'],
      );
    });

    it('keeps a goal without a project when clearing the project', async () => {
      const db = makeDb(
        vi
          .fn()
          .mockResolvedValueOnce({ project_id: null, goal_id: 'goal_free' })
          .mockResolvedValueOnce({ project_id: null }),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await setTodoProjectGoal('todo_1', { projectId: null });

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE todos SET project_id = ?, goal_id = ?, updated_at = ?'),
        [null, 'goal_free', '2026-04-16T10:00:00.000Z', 'todo_1'],
      );
    });

    it('bulkAssignTodosProject inherits the clear-goal rule', async () => {
      const db = makeDb(
        vi
          .fn()
          .mockResolvedValueOnce({ project_id: 'proj_1', goal_id: 'goal_1' })
          .mockResolvedValueOnce({ project_id: 'proj_1' })
          .mockResolvedValueOnce({ project_id: 'proj_2', goal_id: 'goal_2' })
          .mockResolvedValueOnce({ project_id: 'proj_2' }),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await expect(bulkAssignTodosProject(['todo_1', 'todo_2'], null)).resolves.toEqual({
        changed: 2,
        skipped: 0,
      });
      const assignCalls = db.runAsync.mock.calls.filter((call) =>
        String(call[0]).includes('project_id = ?, goal_id = ?'),
      );
      expect(assignCalls).toHaveLength(2);
      expect(assignCalls[0][1]).toEqual([null, null, expect.any(String), 'todo_1']);
      expect(assignCalls[1][1]).toEqual([null, null, expect.any(String), 'todo_2']);
    });

    it('updateTodo clears a project-bound goal when only the project is cleared', async () => {
      const db = makeDb(
        vi
          .fn()
          .mockResolvedValueOnce({ project_id: 'proj_1', goal_id: 'goal_1' })
          .mockResolvedValueOnce({ project_id: 'proj_1' })
          .mockResolvedValueOnce(undefined), // post-mutation reminder re-read
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await updateTodo('todo_1', { projectId: null });

      const updateCall = db.runAsync.mock.calls.find((call) =>
        String(call[0]).startsWith('UPDATE todos'),
      );
      expect(updateCall![0]).toContain('project_id = ?');
      expect(updateCall![0]).toContain('goal_id = ?');
      expect(updateCall![1].filter((value: unknown) => value === null)).toHaveLength(2);
    });

    it('still re-aligns an explicitly assigned goal over a cleared project (modal combo)', async () => {
      const db = makeDb(
        vi
          .fn()
          .mockResolvedValueOnce({ project_id: 'proj_old', goal_id: null })
          .mockResolvedValueOnce({ id: 'goal_1', project_id: 'proj_1' }),
        vi.fn().mockResolvedValue({ changes: 1 }),
      );
      getDatabase.mockResolvedValue(db);

      await setTodoProjectGoal('todo_1', { projectId: null, goalId: 'goal_1' });

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE todos SET project_id = ?, goal_id = ?, updated_at = ?'),
        ['proj_1', 'goal_1', '2026-04-16T10:00:00.000Z', 'todo_1'],
      );
    });
  });
});
