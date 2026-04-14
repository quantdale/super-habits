import { getDatabase } from "@/core/db/client";
import type { Todo, TodoPriority, TodoRecurrence } from "@/core/db/types";
import type { LinkedActionEffectAdapterResult } from "@/core/linked-actions/linkedActions.types";
import { createId } from "@/lib/id";
import { nowIso, toDateKey } from "@/lib/time";
import { syncEngine } from "@/core/sync/sync.engine";
import { getTomorrowDateKey } from "./todos.domain";

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
}): Promise<void> {
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

export async function toggleTodo(todo: Todo): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  const next = todo.completed === 1 ? 0 : 1;
  await db.runAsync("UPDATE todos SET completed = ?, updated_at = ? WHERE id = ?", [next, now, todo.id]);
  syncEngine.enqueue({ entity: "todos", id: todo.id, updatedAt: now, operation: "update" });

  if (next === 1 && todo.recurrence === "daily" && todo.recurrence_id) {
    const tomorrow = getTomorrowDateKey();
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM todos
       WHERE recurrence_id = ?
         AND due_date = ?
         AND deleted_at IS NULL`,
      [todo.recurrence_id, tomorrow],
    );
    if (!existing) {
      await createRecurringInstance({
        title: todo.title,
        notes: todo.notes,
        priority: todo.priority,
        recurrenceId: todo.recurrence_id,
        dueDate: tomorrow,
      });
    }
  }
}

export async function removeTodo(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await db.runAsync("UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
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
