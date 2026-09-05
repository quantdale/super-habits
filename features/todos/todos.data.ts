import type * as SQLite from 'expo-sqlite';
import { getDatabase } from '@/core/db/client';
import type { Todo, TodoPriority, TodoRecurrence } from '@/core/db/types';
import type {
  LinkedActionEffectAdapterResult,
  LinkedActionProcessResult,
  LinkedActionRuleDefinition,
  SaveLinkedActionRuleForSourceInput,
} from '@/core/linked-actions/linkedActions.types';
import {
  deleteLinkedActionRulesForTargetEntity,
  listLinkedActionRulesForSourceEntity,
  replaceLinkedActionRulesForSourceEntity,
} from '@/core/linked-actions/linkedActions.data';
import { createId } from '@/lib/id';
import { nowIso, toDateKey } from '@/lib/time';
import { runBackupMutation, runSyncedMutation } from '@/core/sync/syncedMutation';
import type { SyncRecord } from '@/core/sync/sync.engine';
import { linkedActionsEngine } from '@/core/linked-actions/linkedActions.engine';
import { parseTopTodoIds, serializeTopTodoIds } from '@/features/daily-plan/dailyPlan.domain';
import {
  cancelTodoDueReminder,
  syncTodoDueReminder,
  type TodoReminderSnapshot,
} from '@/core/notifications/todoReminderScheduler';
import { getTomorrowDateKey } from './todos.domain';

export type TodoLinkedActionsDispatchResult = Pick<
  LinkedActionProcessResult,
  'matchedRuleCount' | 'notices'
>;

export type ToggleTodoResult = {
  completed: 0 | 1;
  linkedActions: TodoLinkedActionsDispatchResult;
};

export type PendingTodoFilters = {
  due?: 'all' | 'today' | 'overdue';
  priority?: TodoPriority | 'all';
  todayDateKey?: string;
};

export type PendingTodoListOptions = PendingTodoFilters & {
  limit?: number;
};

const EMPTY_LINKED_ACTIONS_RESULT: TodoLinkedActionsDispatchResult = {
  matchedRuleCount: 0,
  notices: [],
};

/**
 * Device-local due-date reminder sync. Reminder failures must never break a
 * data write, so every call is best-effort; the scheduler itself is a no-op on
 * web and respects the notifications preference.
 */
async function syncReminderSafely(todo: TodoReminderSnapshot): Promise<void> {
  try {
    await syncTodoDueReminder(todo);
  } catch {
    // Ignore reminder scheduling failures.
  }
}

async function cancelReminderSafely(todoId: string): Promise<void> {
  try {
    await cancelTodoDueReminder(todoId);
  } catch {
    // Ignore reminder cancellation failures.
  }
}

export async function listTodos(): Promise<Todo[]> {
  const db = await getDatabase();
  return db.getAllAsync<Todo>(
    `SELECT * FROM todos
     WHERE deleted_at IS NULL
     ORDER BY completed ASC, sort_order ASC, created_at DESC`,
  );
}

export async function listPendingTodos(input?: number | PendingTodoListOptions): Promise<Todo[]> {
  const db = await getDatabase();
  const options = typeof input === 'number' ? { limit: input } : (input ?? {});
  const hasFilters =
    options.due !== undefined ||
    options.priority !== undefined ||
    options.todayDateKey !== undefined;
  const query = `SELECT * FROM todos
     WHERE deleted_at IS NULL
       AND completed = 0
     ORDER BY sort_order ASC, created_at DESC`;
  if (!hasFilters && options.limit === undefined) {
    return db.getAllAsync<Todo>(query);
  }

  const clauses: string[] = ['deleted_at IS NULL', 'completed = 0'];
  const args: (string | number)[] = [];
  if (options.priority && options.priority !== 'all') {
    clauses.push('priority = ?');
    args.push(options.priority);
  }
  if (options.due === 'today') {
    clauses.push('due_date = ?');
    args.push(options.todayDateKey ?? toDateKey());
  } else if (options.due === 'overdue') {
    clauses.push('due_date IS NOT NULL', 'due_date < ?');
    args.push(options.todayDateKey ?? toDateKey());
  }
  const filteredQuery = `SELECT * FROM todos
     WHERE ${clauses.join('\n       AND ')}
     ORDER BY sort_order ASC, created_at DESC`;
  if (options.limit === undefined) {
    return db.getAllAsync<Todo>(filteredQuery, args);
  }
  return db.getAllAsync<Todo>(`${filteredQuery} LIMIT ?`, [...args, options.limit]);
}

export async function countPendingTodos(filters?: PendingTodoFilters): Promise<number> {
  const db = await getDatabase();
  if (!filters) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM todos
       WHERE deleted_at IS NULL
         AND completed = 0`,
    );
    return row?.count ?? 0;
  }

  const clauses: string[] = ['deleted_at IS NULL', 'completed = 0'];
  const args: string[] = [];
  if (filters.priority && filters.priority !== 'all') {
    clauses.push('priority = ?');
    args.push(filters.priority);
  }
  if (filters.due === 'today') {
    clauses.push('due_date = ?');
    args.push(filters.todayDateKey ?? toDateKey());
  } else if (filters.due === 'overdue') {
    clauses.push('due_date IS NOT NULL', 'due_date < ?');
    args.push(filters.todayDateKey ?? toDateKey());
  }
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM todos
     WHERE ${clauses.join('\n       AND ')}`,
    args,
  );
  return row?.count ?? 0;
}

/** Count completed active Todos without loading the full Todo history. */
export async function countCompletedTodos(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM todos
     WHERE deleted_at IS NULL
       AND completed = 1`,
  );
  return row?.count ?? 0;
}

export async function addTodo(input: {
  title: string;
  notes?: string;
  dueDate?: string | null;
  priority?: TodoPriority;
  recurrence?: TodoRecurrence;
  projectId?: string | null;
  goalId?: string | null;
}): Promise<string> {
  const db = await getDatabase();
  const id = createId('todo');
  const now = nowIso();

  const recurrenceId = input.recurrence === 'daily' ? createId('rec') : null;

  const dueDate =
    input.dueDate !== undefined ? input.dueDate : input.recurrence === 'daily' ? toDateKey() : null;

  await runSyncedMutation({
    db,
    record: { entity: 'todos', id, updatedAt: now, operation: 'create' },
    mutate: async (transactionDb) => {
      // Allocate sort_order INSIDE the mutation transaction so two concurrent
      // adds can never read the same MAX(sort_order) and tie (F9).
      const maxRow = await transactionDb.getFirstAsync<{ maxOrder: number }>(
        `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
         FROM todos WHERE deleted_at IS NULL AND completed = 0`,
      );
      const sortOrder = (maxRow?.maxOrder ?? 0) + 1;
      await transactionDb.runAsync(
        `INSERT INTO todos
           (id, title, notes, completed, completed_at, due_date, priority,
            sort_order, recurrence, recurrence_id,
            project_id, goal_id,
            created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          id,
          input.title,
          input.notes ?? null,
          dueDate,
          input.priority ?? 'normal',
          sortOrder,
          input.recurrence ?? null,
          recurrenceId,
          input.projectId ?? null,
          input.goalId ?? null,
          now,
          now,
        ],
      );
      return { changed: true, value: undefined };
    },
  });

  if (dueDate) {
    await syncReminderSafely({ id, title: input.title, dueDate, completedAt: null });
  }

  return id;
}

type RecurringInstanceInput = {
  title: string;
  notes: string | null;
  priority: TodoPriority;
  recurrenceId: string;
  dueDate: string;
};

export async function createRecurringInstance(input: RecurringInstanceInput): Promise<void> {
  await createRecurringInstances([input]);
}

export async function createRecurringInstances(inputs: RecurringInstanceInput[]): Promise<void> {
  if (inputs.length === 0) return;

  const db = await getDatabase();

  // One transaction for the whole batch: the MAX(sort_order) baseline is read
  // inside it and each insert takes the next slot, so a concurrent manual add
  // or a parallel batch can never interleave between reads and inserts (F9).
  await runBackupMutation<number>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const maxRow = await transactionDb.getFirstAsync<{ maxOrder: number }>(
        `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
         FROM todos WHERE deleted_at IS NULL AND completed = 0`,
      );
      const firstSortOrder = (maxRow?.maxOrder ?? 0) + 1;
      let inserted = 0;
      for (const [index, input] of inputs.entries()) {
        const id = createId('todo');
        const now = nowIso();
        const result = await transactionDb.runAsync(
          `INSERT INTO todos
             (id, title, notes, completed, completed_at, due_date, priority,
              sort_order, recurrence, recurrence_id,
              created_at, updated_at, deleted_at)
           SELECT ?, ?, ?, 0, NULL, ?, ?, ?, 'daily', ?, ?, ?, NULL
           WHERE NOT EXISTS (
             SELECT 1
             FROM todos
             WHERE recurrence_id = ?
               AND due_date = ?
               AND deleted_at IS NULL
           )`,
          [
            id,
            input.title,
            input.notes,
            input.dueDate,
            input.priority,
            firstSortOrder + index,
            input.recurrenceId,
            now,
            now,
            input.recurrenceId,
            input.dueDate,
          ],
        );
        if (result.changes === 1) {
          inserted += 1;
          enqueue({ entity: 'todos', id, updatedAt: now, operation: 'create' });
        }
      }
      return { changed: inserted > 0, value: inserted };
    },
  });
}

export async function getRecurringTodosByIds(recurrenceIds: string[]): Promise<Todo[]> {
  if (recurrenceIds.length === 0) return [];
  const db = await getDatabase();

  // Single query instead of one SELECT per id; newest todo per series wins.
  const placeholders = recurrenceIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<Todo>(
    `SELECT *
     FROM todos
     WHERE recurrence_id IN (${placeholders})
       AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    recurrenceIds,
  );

  const newestBySeries = new Map<string, Todo>();
  for (const row of rows) {
    if (row.recurrence_id && !newestBySeries.has(row.recurrence_id)) {
      newestBySeries.set(row.recurrence_id, row);
    }
  }
  return [...newestBySeries.values()];
}

export async function listAllActiveTodosForRecurrence(): Promise<
  Pick<Todo, 'recurrence_id' | 'recurrence' | 'due_date' | 'deleted_at'>[]
> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT recurrence_id, recurrence, due_date, deleted_at
     FROM todos
     WHERE deleted_at IS NULL`,
  );
}

export async function updateTodoOrder(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const db = await getDatabase();
  const now = nowIso();
  // One transaction per drag: absolute sort_order values keep retries safe,
  // and batching avoids N separate transactions/outbox records per reorder,
  // which is measurably cheaper on web OPFS (F10).
  await runBackupMutation<number>({
    db,
    mutate: async (transactionDb, enqueue) => {
      let changed = 0;
      for (let i = 0; i < orderedIds.length; i++) {
        const result = await transactionDb.runAsync(
          `UPDATE todos SET sort_order = ?, updated_at = ?
           WHERE id = ?
             AND deleted_at IS NULL`,
          [i + 1, now, orderedIds[i]],
        );
        if (result.changes === 1) {
          changed += 1;
          enqueue({ entity: 'todos', id: orderedIds[i], updatedAt: now, operation: 'update' });
        }
      }
      return { changed: changed > 0, value: changed };
    },
  });
}

type TodoAssociationInput = { projectId?: string | null; goalId?: string | null };

type TodoAssociationResolution = {
  nextProjectId: string | null;
  nextGoalId: string | null;
};

/**
 * Resolve the next project_id/goal_id pair for a Todo against the H9
 * association invariants. Shared by single edits and bulk assignment so both
 * inherit identical rules:
 * - A non-null projectId/goalId MUST reference an existing, non-deleted
 *   parent; otherwise the resolver throws a clear error (no dangling refs).
 * - Assigning a Goal auto-aligns project_id to that Goal's project_id when
 *   the Goal belongs to a Project; an explicit projectId is overridden by the
 *   goal here.
 * - F12: explicitly clearing the project also clears a remaining Goal that
 *   itself belongs to a Project — such a Goal pins the Todo to its Project,
 *   so keeping it would leave `project_id = NULL` while violating the
 *   alignment invariant. A Goal without a Project imposes no alignment and is
 *   kept.
 */
async function resolveTodoProjectGoalAssociation(
  transactionDb: SQLite.SQLiteDatabase,
  current: Pick<Todo, 'project_id' | 'goal_id'>,
  association: TodoAssociationInput,
): Promise<TodoAssociationResolution> {
  let nextProjectId = current.project_id;
  let nextGoalId = current.goal_id;

  if (association.projectId !== undefined) {
    if (association.projectId !== null) {
      const project = await transactionDb.getFirstAsync<{ id: string }>(
        `SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL`,
        [association.projectId],
      );
      if (!project) throw new Error('Project not found.');
    }
    nextProjectId = association.projectId;
  }

  if (association.goalId !== undefined) {
    if (association.goalId !== null) {
      const goal = await transactionDb.getFirstAsync<{
        id: string;
        project_id: string | null;
      }>(`SELECT id, project_id FROM goals WHERE id = ? AND deleted_at IS NULL`, [
        association.goalId,
      ]);
      if (!goal) throw new Error('Goal not found.');
      nextGoalId = association.goalId;
      // Hierarchical consistency: a Todo assigned to a Goal inherits the
      // Goal's Project.
      if (goal.project_id !== null) {
        nextProjectId = goal.project_id;
      }
    } else {
      nextGoalId = null;
    }
  } else if (association.projectId === null && nextGoalId !== null) {
    // F12: clearing the project must not leave a goal that still binds this
    // todo to a project.
    const goal = await transactionDb.getFirstAsync<{ project_id: string | null }>(
      `SELECT project_id FROM goals WHERE id = ? AND deleted_at IS NULL`,
      [nextGoalId],
    );
    if (goal && goal.project_id !== null) {
      nextGoalId = null;
    }
  }

  return { nextProjectId, nextGoalId };
}

export async function updateTodo(
  id: string,
  updates: {
    title?: string;
    notes?: string;
    dueDate?: string | null;
    priority?: TodoPriority;
    projectId?: string | null;
    goalId?: string | null;
    /**
     * Only STARTS a daily series (fresh recurrence id — a restart never
     * reattaches to a stopped chain). Clearing recurrence is deliberately
     * NOT supported here: ending a series is `stopRecurringSeries` so the
     * whole series transitions atomically instead of leaving one stray
     * 'daily' row that rollover would respawn.
     */
    recurrence?: TodoRecurrence;
  },
): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();

  const fields: string[] = ['updated_at = ?'];
  const values: (string | null)[] = [now];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.dueDate !== undefined) {
    fields.push('due_date = ?');
    values.push(updates.dueDate);
  }
  if (updates.priority !== undefined) {
    fields.push('priority = ?');
    values.push(updates.priority);
  }
  await runSyncedMutation({
    db,
    record: { entity: 'todos', id, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb) => {
      const current = await transactionDb.getFirstAsync<
        Pick<Todo, 'project_id' | 'goal_id' | 'recurrence' | 'recurrence_id' | 'due_date'>
      >(
        `SELECT project_id, goal_id, recurrence, recurrence_id, due_date
         FROM todos WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      if (!current) {
        return { changed: false, value: undefined };
      }

      // Restart: starting recurrence on a non-recurring task begins a NEW
      // series chain (fresh recurrence id); stopped chains stay ended.
      if (updates.recurrence === 'daily' && current.recurrence !== 'daily') {
        fields.push('recurrence = ?', 'recurrence_id = ?');
        values.push('daily', createId('rec'));
        if (updates.dueDate === undefined && current.due_date === null) {
          fields.push('due_date = ?');
          values.push(toDateKey());
        }
      }

      // H9: validate and reconcile project/goal associations via the shared
      // resolver (includes the F12 clear-project/goal-alignment rule).
      const resolution = await resolveTodoProjectGoalAssociation(transactionDb, current, updates);

      if (updates.projectId !== undefined || resolution.nextProjectId !== current.project_id) {
        fields.push('project_id = ?');
        values.push(resolution.nextProjectId);
      }
      if (updates.goalId !== undefined || resolution.nextGoalId !== current.goal_id) {
        fields.push('goal_id = ?');
        values.push(resolution.nextGoalId);
      }

      const result = await transactionDb.runAsync(
        `UPDATE todos SET ${fields.join(', ')}
         WHERE id = ?
           AND deleted_at IS NULL`,
        [...values, id],
      );
      return { changed: result.changes === 1, value: undefined };
    },
  });

  // Re-read the row so the reminder reflects the final title/due/completed state.
  const updated = await db.getFirstAsync<{
    title: string;
    due_date: string | null;
    completed: 0 | 1;
  }>(`SELECT title, due_date, completed FROM todos WHERE id = ? AND deleted_at IS NULL`, [id]);
  if (updated) {
    if (updated.completed === 1) {
      await cancelReminderSafely(id);
    } else if (updated.due_date) {
      await syncReminderSafely({ id, title: updated.title, dueDate: updated.due_date });
    } else {
      await cancelReminderSafely(id);
    }
  }
}

/**
 * Applies a template edit to the remaining life of a daily series: every live
 * (non-deleted, non-completed) instance sharing the recurrence id receives the
 * field changes, so subsequently spawned copies (which are copied from the
 * active instance) inherit them too. Completed history rows are NEVER
 * rewritten. One durable update intent is enqueued per touched row.
 */
export async function updateRecurringSeriesTemplate(
  recurrenceId: string,
  updates: { title?: string; notes?: string | null; priority?: TodoPriority },
): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();

  const fields: string[] = ['updated_at = ?'];
  const values: (string | null)[] = [now];
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.priority !== undefined) {
    fields.push('priority = ?');
    values.push(updates.priority);
  }

  const outcome = await runBackupMutation<void>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const targets = await transactionDb.getAllAsync<{ id: string }>(
        `SELECT id FROM todos
         WHERE recurrence_id = ? AND completed = 0 AND deleted_at IS NULL`,
        [recurrenceId],
      );
      if (targets.length === 0) {
        return { changed: false, value: undefined };
      }
      for (const target of targets) {
        await transactionDb.runAsync(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`, [
          ...values,
          target.id,
        ]);
        enqueue({ entity: 'todos', id: target.id, updatedAt: now, operation: 'update' });
      }
      return { changed: true, value: undefined };
    },
  });

  if (outcome.changed) {
    const refreshed = await db.getAllAsync<{ id: string; title: string; due_date: string }>(
      `SELECT id, title, due_date FROM todos
       WHERE recurrence_id = ? AND completed = 0 AND deleted_at IS NULL AND due_date IS NOT NULL`,
      [recurrenceId],
    );
    for (const row of refreshed) {
      await syncReminderSafely({ id: row.id, title: row.title, dueDate: row.due_date });
    }
  }
}

/**
 * Ends a daily series permanently:
 * - clears the recurrence marker on EVERY row of the series (pending,
 *   completed, and already soft-deleted). The day-rollover scan keys on any
 *   'daily' row of a recurrence id regardless of completion or deletion, so
 *   a surviving marker anywhere would resurrect the series.
 * - soft-deletes pending copies due after today (completed history and
 *   today's copy stay visible).
 * Durable intents mirror `removeTodo` ('delete' for freshly soft-deleted
 * future copies, 'update' for other rows whose state changed locally).
 */
export async function stopRecurringSeries(recurrenceId: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  const todayKey = toDateKey();

  const outcome = await runBackupMutation<void>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const members = await transactionDb.getAllAsync<{
        id: string;
        completed: 0 | 1;
        deleted_at: string | null;
        due_date: string | null;
      }>(`SELECT id, completed, deleted_at, due_date FROM todos WHERE recurrence_id = ?`, [
        recurrenceId,
      ]);
      if (members.length === 0) {
        return { changed: false, value: undefined };
      }
      for (const member of members) {
        if (member.deleted_at !== null) {
          // Already deleted locally and remotely; clear the marker without
          // re-enqueueing the existing delete intent.
          await transactionDb.runAsync(`UPDATE todos SET recurrence = NULL WHERE id = ?`, [
            member.id,
          ]);
          continue;
        }
        const endsFuture =
          member.completed === 0 && member.due_date !== null && member.due_date > todayKey;
        if (endsFuture) {
          await transactionDb.runAsync(
            `UPDATE todos SET recurrence = NULL, deleted_at = ?, updated_at = ? WHERE id = ?`,
            [now, now, member.id],
          );
          enqueue({ entity: 'todos', id: member.id, updatedAt: now, operation: 'delete' });
        } else {
          await transactionDb.runAsync(
            `UPDATE todos SET recurrence = NULL, updated_at = ? WHERE id = ?`,
            [now, member.id],
          );
          enqueue({ entity: 'todos', id: member.id, updatedAt: now, operation: 'update' });
        }
      }
      return { changed: true, value: undefined };
    },
  });

  if (outcome.changed) {
    const cancelled = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM todos
       WHERE recurrence_id = ? AND deleted_at IS NOT NULL AND deleted_at = ?`,
      [recurrenceId, now],
    );
    for (const row of cancelled) {
      await cancelReminderSafely(row.id);
    }
  }
}

export async function listTodoLinkedActionRules(
  todoId: string,
): Promise<LinkedActionRuleDefinition[]> {
  return listLinkedActionRulesForSourceEntity({
    feature: 'todos',
    entityType: 'todo',
    entityId: todoId,
  });
}

/**
 * Associate (or clear, with null) a Todo with a Project and/or Goal.
 *
 * H9 association invariants (see `resolveTodoProjectGoalAssociation`):
 * - A non-null projectId/goalId MUST reference an existing, non-deleted parent;
 *   otherwise the setter throws a clear error (no dangling references).
 * - Assigning a Goal auto-aligns project_id to that Goal's project_id when the
 *   Goal belongs to a Project. If the Goal has no Project, an explicitly
 *   provided projectId is respected and otherwise the current project_id is
 *   preserved (the stricter "clear project on goal-without-project" rule is not
 *   applied for Todos).
 * - Clearing the project also clears a remaining Goal that belongs to a
 *   Project (F12), so bulk "No project" inherits the same rule.
 * - The whole change runs inside the synced-mutation transaction so it is atomic
 *   and the outbox intent stays coherent with the final row.
 */
export async function setTodoProjectGoal(
  todoId: string,
  association: TodoAssociationInput,
): Promise<void> {
  if (association.projectId === undefined && association.goalId === undefined) return;
  const db = await getDatabase();
  const now = nowIso();
  await runSyncedMutation({
    db,
    record: { entity: 'todos', id: todoId, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb) => {
      const current = await transactionDb.getFirstAsync<Pick<Todo, 'project_id' | 'goal_id'>>(
        `SELECT project_id, goal_id FROM todos WHERE id = ? AND deleted_at IS NULL`,
        [todoId],
      );
      if (!current) {
        return { changed: false, value: undefined };
      }

      const resolution = await resolveTodoProjectGoalAssociation(
        transactionDb,
        current,
        association,
      );

      const result = await transactionDb.runAsync(
        `UPDATE todos SET project_id = ?, goal_id = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [resolution.nextProjectId, resolution.nextGoalId, now, todoId],
      );
      return { changed: result.changes === 1, value: undefined };
    },
  });
}

export async function saveTodoLinkedActionRules(
  todoId: string,
  rules: SaveLinkedActionRuleForSourceInput[],
): Promise<void> {
  const db = await getDatabase();
  const todo = await db.getFirstAsync<Pick<Todo, 'id' | 'recurrence' | 'deleted_at'>>(
    `SELECT id, recurrence, deleted_at
     FROM todos
     WHERE id = ?`,
    [todoId],
  );

  if (!todo) {
    throw new Error('Todo not found.');
  }

  if (todo.recurrence === 'daily' && rules.length > 0) {
    throw new Error('Recurring todos cannot be linked-action sources yet.');
  }

  await replaceLinkedActionRulesForSourceEntity({
    feature: 'todos',
    entityType: 'todo',
    entityId: todoId,
    rules,
  });
}

async function setTodoCompletion(
  todoId: string,
  desiredCompletion: 0 | 1 | 'toggle',
): Promise<ToggleTodoResult> {
  const db = await getDatabase();
  const now = nowIso();
  type ToggleMutation = {
    current: Todo | null;
    previous: 0 | 1;
    next: 0 | 1;
  };
  const outcome = await runSyncedMutation<ToggleMutation>({
    db,
    record: { entity: 'todos', id: todoId, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb) => {
      const current = await transactionDb.getFirstAsync<Todo>(
        `SELECT *
         FROM todos
         WHERE id = ?
           AND deleted_at IS NULL`,
        [todoId],
      );
      if (!current) {
        return {
          changed: false,
          value: { current: null, previous: 0, next: 0 },
        };
      }
      const previous = current.completed;
      const next: 0 | 1 =
        desiredCompletion === 'toggle' ? (previous === 1 ? 0 : 1) : desiredCompletion;
      if (next === previous) {
        return { changed: false, value: { current, previous, next } };
      }
      const completedAtValue = next === 1 ? now : null;
      const result = await transactionDb.runAsync(
        `UPDATE todos SET completed = ?, completed_at = ?, updated_at = ?
         WHERE id = ? AND completed = ? AND deleted_at IS NULL`,
        [next, completedAtValue, now, current.id, previous],
      );
      if (result.changes !== 1) {
        return {
          changed: false,
          value: { current: null, previous: 0, next: 0 },
        };
      }
      return { changed: true, value: { current, previous, next } };
    },
  });

  if (!outcome.value.current) {
    return {
      completed: 0,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  const { current, previous, next } = outcome.value;

  // Idempotent completion is intentionally a safe no-op. This branch is used
  // by Command Center; it must never toggle a completed Todo back to pending.
  if (!outcome.changed && desiredCompletion === 1 && previous === 1) {
    return {
      completed: 1,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  // Keep the device-local due-date reminder in sync with completion state.
  if (next === 1) {
    await cancelReminderSafely(current.id);
  } else if (previous === 1 && current.due_date) {
    await syncReminderSafely({ id: current.id, title: current.title, dueDate: current.due_date });
  }

  if (next === 1 && current.recurrence === 'daily' && current.recurrence_id) {
    const tomorrow = getTomorrowDateKey();
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM todos
       WHERE recurrence_id = ?
         AND due_date = ?
         AND deleted_at IS NULL`,
      [current.recurrence_id, tomorrow],
    );
    if (!existing) {
      await createRecurringInstance({
        title: current.title,
        notes: current.notes,
        priority: current.priority,
        recurrenceId: current.recurrence_id,
        dueDate: tomorrow,
      });
    }
  }

  if (previous !== 0 || next !== 1 || current.recurrence === 'daily') {
    return {
      completed: next,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  const processResult = await linkedActionsEngine.processSourceAction({
    occurredAt: now,
    feature: 'todos',
    entityType: 'todo',
    entityId: current.id,
    triggerType: 'todo.completed',
    label: current.title,
    sourceDateKey: toDateKey(),
    sourceRecordId: current.id,
    origin: {
      originKind: 'user',
      originRuleId: null,
      originEventId: null,
    },
    payload: {
      previousCompleted: previous,
      currentCompleted: next,
      recurrence: current.recurrence,
    },
  });

  return {
    completed: next,
    linkedActions: {
      matchedRuleCount: processResult.matchedRuleCount,
      notices: processResult.notices,
    },
  };
}

export async function toggleTodo(todo: Todo): Promise<ToggleTodoResult> {
  return setTodoCompletion(todo.id, 'toggle');
}

/** Complete a Todo without toggling an already-completed row back to pending. */
export async function completeTodo(todoId: string): Promise<ToggleTodoResult> {
  return setTodoCompletion(todoId, 1);
}

/** Explicitly complete or reopen a Todo (used by bulk operations). */
export async function setTodoCompletionState(
  todoId: string,
  completed: 0 | 1,
): Promise<ToggleTodoResult> {
  return setTodoCompletion(todoId, completed);
}

export type BulkTodoOutcome = {
  /** Ids whose row actually changed (and got a backup intent). */
  changed: number;
  /** Ids skipped: missing/tombstoned, or already in the desired state. */
  skipped: number;
};

type BulkCompletionRow = Pick<
  Todo,
  'id' | 'title' | 'notes' | 'priority' | 'completed' | 'due_date' | 'recurrence' | 'recurrence_id'
>;

/**
 * Bulk operations apply the same per-id invariants as their single-item
 * counterparts (soft delete, sync enqueue, linked-action dispatch), but commit
 * all row writes in ONE transaction so a mid-batch failure can never leave a
 * half-applied edit behind. Per-row backup intents are enqueued inside that
 * same transaction; post-commit side effects (reminders, recurring follow-ups,
 * linked-action dispatch) then run per changed item exactly like the
 * single-item path, preserving idempotent retry semantics.
 */
export async function bulkSetTodoCompletion(
  ids: string[],
  completed: 0 | 1,
): Promise<BulkTodoOutcome> {
  if (ids.length === 0) return { changed: 0, skipped: 0 };
  const db = await getDatabase();
  const now = nowIso();

  type AppliedCompletion = { row: BulkCompletionRow; previous: 0 | 1 };
  const outcome = await runBackupMutation<AppliedCompletion[]>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const applied: AppliedCompletion[] = [];
      for (const id of ids) {
        const current = await transactionDb.getFirstAsync<BulkCompletionRow>(
          `SELECT id, title, notes, priority, completed, due_date, recurrence, recurrence_id
           FROM todos
           WHERE id = ?
             AND deleted_at IS NULL`,
          [id],
        );
        if (!current) continue;
        const previous = current.completed;
        // Idempotent per-item semantics: applying the desired state twice is a
        // safe no-op for that row.
        if (previous === completed) continue;
        const result = await transactionDb.runAsync(
          `UPDATE todos SET completed = ?, completed_at = ?, updated_at = ?
           WHERE id = ? AND completed = ? AND deleted_at IS NULL`,
          [completed, completed === 1 ? now : null, now, current.id, previous],
        );
        if (result.changes !== 1) continue;
        enqueue({ entity: 'todos', id: current.id, updatedAt: now, operation: 'update' });
        applied.push({ row: current, previous });
      }
      return { changed: applied.length > 0, value: applied };
    },
  });

  // Post-commit side effects, identical to setTodoCompletion's per-item path.
  for (const { row, previous } of outcome.value) {
    const next = completed;
    if (next === 1) {
      await cancelReminderSafely(row.id);
    } else if (previous === 1 && row.due_date) {
      await syncReminderSafely({ id: row.id, title: row.title, dueDate: row.due_date });
    }

    if (next === 1 && row.recurrence === 'daily' && row.recurrence_id) {
      const tomorrow = getTomorrowDateKey();
      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM todos
         WHERE recurrence_id = ?
           AND due_date = ?
           AND deleted_at IS NULL`,
        [row.recurrence_id, tomorrow],
      );
      if (!existing) {
        await createRecurringInstance({
          title: row.title,
          notes: row.notes,
          priority: row.priority,
          recurrenceId: row.recurrence_id,
          dueDate: tomorrow,
        });
      }
    }

    // Linked actions fire only on a genuine non-recurring 0->1 completion,
    // exactly like setTodoCompletion.
    if (!(previous === 0 && next === 1 && row.recurrence !== 'daily')) continue;

    await linkedActionsEngine.processSourceAction({
      occurredAt: now,
      feature: 'todos',
      entityType: 'todo',
      entityId: row.id,
      triggerType: 'todo.completed',
      label: row.title,
      sourceDateKey: toDateKey(),
      sourceRecordId: row.id,
      origin: {
        originKind: 'user',
        originRuleId: null,
        originEventId: null,
      },
      payload: {
        previousCompleted: previous,
        currentCompleted: next,
        recurrence: row.recurrence,
      },
    });
  }

  return {
    changed: outcome.value.length,
    skipped: ids.length - outcome.value.length,
  };
}

export async function bulkUpdateTodoPriority(
  ids: string[],
  priority: TodoPriority,
): Promise<BulkTodoOutcome> {
  if (ids.length === 0) return { changed: 0, skipped: 0 };
  const db = await getDatabase();
  const now = nowIso();
  const outcome = await runBackupMutation<number>({
    db,
    mutate: async (transactionDb, enqueue) => {
      let changed = 0;
      for (const id of ids) {
        // Rows already at the target priority are skipped without rewriting
        // updated_at or re-enqueueing a redundant backup intent.
        const result = await transactionDb.runAsync(
          `UPDATE todos SET priority = ?, updated_at = ?
           WHERE id = ? AND priority != ? AND deleted_at IS NULL`,
          [priority, now, id, priority],
        );
        if (result.changes !== 1) continue;
        enqueue({ entity: 'todos', id, updatedAt: now, operation: 'update' });
        changed += 1;
      }
      return { changed: changed > 0, value: changed };
    },
  });
  return { changed: outcome.value, skipped: ids.length - outcome.value };
}

export async function bulkAssignTodosProject(
  ids: string[],
  projectId: string | null,
): Promise<BulkTodoOutcome> {
  if (ids.length === 0) return { changed: 0, skipped: 0 };
  const db = await getDatabase();
  const now = nowIso();
  const outcome = await runBackupMutation<number>({
    db,
    mutate: async (transactionDb, enqueue) => {
      let changed = 0;
      for (const id of ids) {
        const current = await transactionDb.getFirstAsync<Pick<Todo, 'project_id' | 'goal_id'>>(
          `SELECT project_id, goal_id FROM todos WHERE id = ? AND deleted_at IS NULL`,
          [id],
        );
        if (!current) continue;
        // Shared resolver so bulk inherits the exact single-edit rules,
        // including the F12 clear-project/goal-alignment behavior.
        const resolution = await resolveTodoProjectGoalAssociation(transactionDb, current, {
          projectId,
        });
        if (
          resolution.nextProjectId === current.project_id &&
          resolution.nextGoalId === current.goal_id
        ) {
          continue;
        }
        const result = await transactionDb.runAsync(
          `UPDATE todos SET project_id = ?, goal_id = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
          [resolution.nextProjectId, resolution.nextGoalId, now, id],
        );
        if (result.changes !== 1) continue;
        enqueue({ entity: 'todos', id, updatedAt: now, operation: 'update' });
        changed += 1;
      }
      return { changed: changed > 0, value: changed };
    },
  });
  return { changed: outcome.value, skipped: ids.length - outcome.value };
}

/**
 * Tombstone one todo plus its dependents inside an open transaction. Returns
 * whether the row existed and was tombstoned by this call.
 */
async function removeTodoWithinTransaction(
  transactionDb: SQLite.SQLiteDatabase,
  id: string,
  now: string,
  enqueue: (record: SyncRecord) => void,
): Promise<boolean> {
  const tombstone = await transactionDb.runAsync(
    'UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
    [now, now, id],
  );
  if (tombstone.changes === 0) return false;

  await replaceLinkedActionRulesForSourceEntity({
    feature: 'todos',
    entityType: 'todo',
    entityId: id,
    rules: [],
    db: transactionDb,
    enqueue,
  });
  await deleteLinkedActionRulesForTargetEntity({
    feature: 'todos',
    entityType: 'todo',
    entityId: id,
    deletedAt: now,
    db: transactionDb,
    enqueue,
  });

  // F11: prune the removed id from any daily plan's top_todo_ids inside the
  // same transaction. daily_plans is a synced entity, so each touched plan
  // gets its own update intent; plans without the id are left untouched.
  const plans = await transactionDb.getAllAsync<{ id: string; top_todo_ids: string }>(
    `SELECT id, top_todo_ids FROM daily_plans
     WHERE deleted_at IS NULL AND top_todo_ids LIKE ?`,
    [`%"${id}"%`],
  );
  for (const plan of plans) {
    const topTodoIds = parseTopTodoIds(plan.top_todo_ids);
    if (!topTodoIds.includes(id)) continue;
    await transactionDb.runAsync(
      `UPDATE daily_plans SET top_todo_ids = ?, updated_at = ? WHERE id = ?`,
      [serializeTopTodoIds(topTodoIds.filter((todoId) => todoId !== id)), now, plan.id],
    );
    enqueue({ entity: 'daily_plans', id: plan.id, updatedAt: now, operation: 'update' });
  }

  return true;
}

export async function bulkRemoveTodos(ids: string[]): Promise<BulkTodoOutcome> {
  if (ids.length === 0) return { changed: 0, skipped: 0 };
  const db = await getDatabase();
  const now = nowIso();
  const outcome = await runBackupMutation<string[]>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const removedIds: string[] = [];
      for (const id of ids) {
        const removed = await removeTodoWithinTransaction(transactionDb, id, now, enqueue);
        if (removed) removedIds.push(id);
      }
      return { changed: removedIds.length > 0, value: removedIds };
    },
  });
  for (const id of outcome.value) {
    await cancelReminderSafely(id);
  }
  return { changed: outcome.value.length, skipped: ids.length - outcome.value.length };
}

export async function removeTodo(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  const result = await runSyncedMutation({
    db,
    record: { entity: 'todos', id, updatedAt: now, operation: 'delete' },
    mutate: async (transactionDb, enqueue) => {
      const removed = await removeTodoWithinTransaction(transactionDb, id, now, enqueue);
      return { changed: removed, value: undefined };
    },
  });
  if (!result.changed) return;

  await cancelReminderSafely(id);
}

export async function completeTodoFromLinkedAction(
  todoId: string,
): Promise<LinkedActionEffectAdapterResult> {
  const db = await getDatabase();
  const todo = await db.getFirstAsync<Pick<Todo, 'id' | 'title' | 'completed' | 'deleted_at'>>(
    `SELECT id, title, completed, deleted_at
     FROM todos
     WHERE id = ?`,
    [todoId],
  );

  if (!todo || todo.deleted_at !== null) {
    return { status: 'skipped', reason: 'target_missing' };
  }

  if (todo.completed === 1) {
    return {
      status: 'skipped',
      reason: 'already_completed',
      targetLabel: todo.title,
    };
  }

  const now = nowIso();
  const outcome = await runSyncedMutation({
    db,
    record: { entity: 'todos', id: todoId, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb) => {
      const result = await transactionDb.runAsync(
        `UPDATE todos
         SET completed = 1, completed_at = ?, updated_at = ?
         WHERE id = ?
           AND completed = 0
           AND deleted_at IS NULL`,
        [now, now, todoId],
      );
      return { changed: result.changes === 1, value: undefined };
    },
  });

  if (!outcome.changed) {
    return {
      status: 'skipped',
      reason: 'already_completed',
      targetLabel: todo.title,
    };
  }

  return {
    status: 'applied',
    targetLabel: todo.title,
  };
}

export async function applyRemoteTodos(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: Todo[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO todos (
         id,
         title,
         notes,
         completed,
         completed_at,
         due_date,
         priority,
         sort_order,
         recurrence,
         recurrence_id,
         created_at,
         updated_at,
         deleted_at,
         project_id,
         goal_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.title,
        row.notes,
        row.completed,
        (row as unknown as { completed_at?: string | null }).completed_at ?? null,
        row.due_date,
        row.priority,
        row.sort_order,
        row.recurrence,
        row.recurrence_id,
        row.created_at,
        row.updated_at,
        row.deleted_at,
        // Planning links joined the recoverable scope in V4; legacy rows omit
        // them and restore as unassigned.
        (row as unknown as { project_id?: string | null }).project_id ?? null,
        (row as unknown as { goal_id?: string | null }).goal_id ?? null,
      ],
    );
  }
}
