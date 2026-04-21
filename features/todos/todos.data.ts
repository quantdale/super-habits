import { getDatabase } from "@/core/db/client";
import type { Todo, TodoPriority, TodoRecurrence } from "@/core/db/types";
import type {
  LinkedActionEffectAdapterResult,
  LinkedActionProcessResult,
  LinkedActionRuleDefinition,
  SaveLinkedActionRuleForSourceInput,
} from "@/core/linked-actions/linkedActions.types";
import {
  deleteLinkedActionRulesForTargetEntity,
  listLinkedActionRulesForSourceEntity,
  replaceLinkedActionRulesForSourceEntity,
} from "@/core/linked-actions/linkedActions.data";
import { createId } from "@/lib/id";
import { nowIso, toDateKey } from "@/lib/time";
import { syncEngine } from "@/core/sync/sync.engine";
import { linkedActionsEngine } from "@/core/linked-actions/linkedActions.engine";
import { getTomorrowDateKey } from "./todos.domain";

export type TodoLinkedActionsDispatchResult = Pick<
  LinkedActionProcessResult,
  "matchedRuleCount" | "notices"
>;

export type ToggleTodoResult = {
  completed: 0 | 1;
  linkedActions: TodoLinkedActionsDispatchResult;
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

export async function addTodo(input: {
  title: string;
  notes?: string;
  dueDate?: string | null;
  priority?: TodoPriority;
  recurrence?: TodoRecurrence;
}): Promise<string> {
  const db = await getDatabase();
  const id = createId("todo");
  const now = nowIso();

  const recurrenceId = input.recurrence === "daily" ? createId("rec") : null;

  const dueDate =
    input.dueDate !== undefined
      ? input.dueDate
      : input.recurrence === "daily"
        ? toDateKey()
        : null;

  const maxRow = await db.getFirstAsync<{ maxOrder: number }>(
    `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
     FROM todos WHERE deleted_at IS NULL AND completed = 0`,
  );
  const sortOrder = (maxRow?.maxOrder ?? 0) + 1;

  await db.runAsync(
    `INSERT INTO todos
       (id, title, notes, completed, due_date, priority,
        sort_order, recurrence, recurrence_id,
        created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      id,
      input.title,
      input.notes ?? null,
      dueDate,
      input.priority ?? "normal",
      sortOrder,
      input.recurrence ?? null,
      recurrenceId,
      now,
      now,
    ],
  );
  syncEngine.enqueue({
    entity: "todos",
    id,
    updatedAt: now,
    operation: "create",
  });

  return id;
}

export async function createRecurringInstance(input: {
  title: string;
  notes: string | null;
  priority: TodoPriority;
  recurrenceId: string;
  dueDate: string;
}): Promise<void> {
  const db = await getDatabase();
  const id = createId("todo");
  const now = nowIso();

  const maxRow = await db.getFirstAsync<{ maxOrder: number }>(
    `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
     FROM todos WHERE deleted_at IS NULL AND completed = 0`,
  );
  const sortOrder = (maxRow?.maxOrder ?? 0) + 1;

  await db.runAsync(
    `INSERT INTO todos
       (id, title, notes, completed, due_date, priority,
        sort_order, recurrence, recurrence_id,
        created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, 0, ?, ?, ?, 'daily', ?, ?, ?, NULL)`,
    [
      id,
      input.title,
      input.notes,
      input.dueDate,
      input.priority,
      sortOrder,
      input.recurrenceId,
      now,
      now,
    ],
  );

  syncEngine.enqueue({
    entity: "todos",
    id,
    updatedAt: now,
    operation: "create",
  });
}

export async function getRecurringTodosByIds(recurrenceIds: string[]): Promise<Todo[]> {
  if (recurrenceIds.length === 0) return [];
  const db = await getDatabase();

  const results: Todo[] = [];
  for (const recId of recurrenceIds) {
    const row = await db.getFirstAsync<Todo>(
      `SELECT * FROM todos
       WHERE recurrence_id = ?
         AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [recId],
    );
    if (row) results.push(row);
  }
  return results;
}

export async function listAllActiveTodosForRecurrence(): Promise<
  Pick<Todo, "recurrence_id" | "recurrence" | "due_date" | "deleted_at">[]
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
    await db.runAsync(
      `UPDATE todos SET sort_order = ?, updated_at = ?
       WHERE id = ?`,
      [i + 1, now, orderedIds[i]],
    );
    syncEngine.enqueue({
      entity: "todos",
      id: orderedIds[i],
      updatedAt: now,
      operation: "update",
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
  },
): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();

  const fields: string[] = ["updated_at = ?"];
  const values: (string | null)[] = [now];

  if (updates.title !== undefined) {
    fields.push("title = ?");
    values.push(updates.title);
  }
  if (updates.notes !== undefined) {
    fields.push("notes = ?");
    values.push(updates.notes);
  }
  if (updates.dueDate !== undefined) {
    fields.push("due_date = ?");
    values.push(updates.dueDate);
  }
  if (updates.priority !== undefined) {
    fields.push("priority = ?");
    values.push(updates.priority);
  }

  values.push(id);
  await db.runAsync(`UPDATE todos SET ${fields.join(", ")} WHERE id = ?`, values);
  syncEngine.enqueue({
    entity: "todos",
    id,
    updatedAt: now,
    operation: "update",
  });
}

export async function listTodoLinkedActionRules(
  todoId: string,
): Promise<LinkedActionRuleDefinition[]> {
  return listLinkedActionRulesForSourceEntity({
    feature: "todos",
    entityType: "todo",
    entityId: todoId,
  });
}

export async function saveTodoLinkedActionRules(
  todoId: string,
  rules: SaveLinkedActionRuleForSourceInput[],
): Promise<void> {
  const db = await getDatabase();
  const todo = await db.getFirstAsync<Pick<Todo, "id" | "recurrence" | "deleted_at">>(
    `SELECT id, recurrence, deleted_at
     FROM todos
     WHERE id = ?`,
    [todoId],
  );

  if (!todo) {
    throw new Error("Todo not found.");
  }

  if (todo.recurrence === "daily" && rules.length > 0) {
    throw new Error("Recurring todos cannot be linked-action sources yet.");
  }

  await replaceLinkedActionRulesForSourceEntity({
    feature: "todos",
    entityType: "todo",
    entityId: todoId,
    rules,
  });
}

export async function toggleTodo(todo: Todo): Promise<ToggleTodoResult> {
  const db = await getDatabase();
  const current = await db.getFirstAsync<Todo>(
    `SELECT *
     FROM todos
     WHERE id = ?
       AND deleted_at IS NULL`,
    [todo.id],
  );

  if (!current) {
    return {
      completed: 0,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  const now = nowIso();
  const previous = current.completed;
  const next: 0 | 1 = previous === 1 ? 0 : 1;

  await db.runAsync("UPDATE todos SET completed = ?, updated_at = ? WHERE id = ?", [next, now, current.id]);
  syncEngine.enqueue({ entity: "todos", id: current.id, updatedAt: now, operation: "update" });

  if (next === 1 && current.recurrence === "daily" && current.recurrence_id) {
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

  if (previous !== 0 || next !== 1 || current.recurrence === "daily") {
    return {
      completed: next,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  const processResult = await linkedActionsEngine.processSourceAction({
    occurredAt: now,
    feature: "todos",
    entityType: "todo",
    entityId: current.id,
    triggerType: "todo.completed",
    label: current.title,
    sourceDateKey: toDateKey(),
    sourceRecordId: current.id,
    origin: {
      originKind: "user",
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

export async function removeTodo(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await db.runAsync("UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
  await saveTodoLinkedActionRules(id, []);
  await deleteLinkedActionRulesForTargetEntity({
    feature: "todos",
    entityType: "todo",
    entityId: id,
    deletedAt: now,
  });
  syncEngine.enqueue({ entity: "todos", id, updatedAt: now, operation: "delete" });
}

export async function completeTodoFromLinkedAction(
  todoId: string,
): Promise<LinkedActionEffectAdapterResult> {
  const db = await getDatabase();
  const todo = await db.getFirstAsync<Pick<Todo, "id" | "title" | "completed" | "deleted_at">>(
    `SELECT id, title, completed, deleted_at
     FROM todos
     WHERE id = ?`,
    [todoId],
  );

  if (!todo || todo.deleted_at !== null) {
    return { status: "skipped", reason: "target_missing" };
  }

  if (todo.completed === 1) {
    return {
      status: "skipped",
      reason: "already_completed",
      targetLabel: todo.title,
    };
  }

  const now = nowIso();
  await db.runAsync(
    `UPDATE todos
     SET completed = 1, updated_at = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    [now, todoId],
  );
  syncEngine.enqueue({
    entity: "todos",
    id: todoId,
    updatedAt: now,
    operation: "update",
  });

  return {
    status: "applied",
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
