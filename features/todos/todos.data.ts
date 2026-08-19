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
import { runSyncedMutation } from '@/core/sync/syncedMutation';
import { linkedActionsEngine } from '@/core/linked-actions/linkedActions.engine';
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

  const maxRow = await db.getFirstAsync<{ maxOrder: number }>(
    `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
     FROM todos WHERE deleted_at IS NULL AND completed = 0`,
  );
  const sortOrder = (maxRow?.maxOrder ?? 0) + 1;

  await runSyncedMutation({
    db,
    record: { entity: 'todos', id, updatedAt: now, operation: 'create' },
    mutate: async (transactionDb) => {
      await transactionDb.runAsync(
        `INSERT INTO todos
           (id, title, notes, completed, due_date, priority,
            sort_order, recurrence, recurrence_id,
            project_id, goal_id,
            created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
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
  const maxRow = await db.getFirstAsync<{ maxOrder: number }>(
    `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
     FROM todos WHERE deleted_at IS NULL AND completed = 0`,
  );
  const firstSortOrder = (maxRow?.maxOrder ?? 0) + 1;

  await Promise.all(
    inputs.map(async (input, index) => {
      const id = createId('todo');
      const now = nowIso();
      await runSyncedMutation({
        db,
        record: { entity: 'todos', id, updatedAt: now, operation: 'create' },
        mutate: async (transactionDb) => {
          const result = await transactionDb.runAsync(
            `INSERT INTO todos
               (id, title, notes, completed, due_date, priority,
                sort_order, recurrence, recurrence_id,
                created_at, updated_at, deleted_at)
             SELECT ?, ?, ?, 0, ?, ?, ?, 'daily', ?, ?, ?, NULL
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
          return { changed: result.changes === 1, value: undefined };
        },
      });
    }),
  );
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
  const db = await getDatabase();
  const now = nowIso();
  for (let i = 0; i < orderedIds.length; i++) {
    await runSyncedMutation({
      db,
      record: { entity: 'todos', id: orderedIds[i], updatedAt: now, operation: 'update' },
      mutate: async (transactionDb) => {
        const result = await transactionDb.runAsync(
          `UPDATE todos SET sort_order = ?, updated_at = ?
           WHERE id = ?
             AND deleted_at IS NULL`,
          [i + 1, now, orderedIds[i]],
        );
        return { changed: result.changes === 1, value: undefined };
      },
    });
  }
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
  if (updates.projectId !== undefined) {
    fields.push('project_id = ?');
    values.push(updates.projectId);
  }
  if (updates.goalId !== undefined) {
    fields.push('goal_id = ?');
    values.push(updates.goalId);
  }

  values.push(id);
  await runSyncedMutation({
    db,
    record: { entity: 'todos', id, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb) => {
      const result = await transactionDb.runAsync(
        `UPDATE todos SET ${fields.join(', ')}
         WHERE id = ?
           AND deleted_at IS NULL`,
        values,
      );
      return { changed: result.changes === 1, value: undefined };
    },
  });
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

/** Associate (or clear, with null) a Todo with a Project and/or Goal. */
export async function setTodoProjectGoal(
  todoId: string,
  association: { projectId?: string | null; goalId?: string | null },
): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  const fields: string[] = ['updated_at = ?'];
  const values: (string | null)[] = [now];
  if (association.projectId !== undefined) {
    fields.push('project_id = ?');
    values.push(association.projectId);
  }
  if (association.goalId !== undefined) {
    fields.push('goal_id = ?');
    values.push(association.goalId);
  }
  if (fields.length === 1) return;
  values.push(todoId);
  await runSyncedMutation({
    db,
    record: { entity: 'todos', id: todoId, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb) => {
      const result = await transactionDb.runAsync(
        `UPDATE todos SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
        values,
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
      const result = await transactionDb.runAsync(
        `UPDATE todos SET completed = ?, updated_at = ?
         WHERE id = ? AND completed = ? AND deleted_at IS NULL`,
        [next, now, current.id, previous],
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

export async function removeTodo(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  const result = await runSyncedMutation({
    db,
    record: { entity: 'todos', id, updatedAt: now, operation: 'delete' },
    mutate: async (transactionDb, enqueue) => {
      const tombstone = await transactionDb.runAsync(
        'UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
        [now, now, id],
      );
      if (tombstone.changes === 0) return { changed: false, value: undefined };

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
      return { changed: true, value: undefined };
    },
  });
  if (!result.changed) return;
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
         SET completed = 1, updated_at = ?
         WHERE id = ?
           AND completed = 0
           AND deleted_at IS NULL`,
        [now, todoId],
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
         due_date,
         priority,
         sort_order,
         recurrence,
         recurrence_id,
         created_at,
         updated_at,
         deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.title,
        row.notes,
        row.completed,
        row.due_date,
        row.priority,
        row.sort_order,
        row.recurrence,
        row.recurrence_id,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
  }
}
