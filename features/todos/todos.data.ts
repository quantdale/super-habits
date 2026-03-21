import { getDatabase } from "@/core/db/client";
import type { Todo, TodoPriority } from "@/core/db/types";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import { syncEngine } from "@/core/sync/sync.engine";

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
        sort_order, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, NULL)`,
    [
      id,
      input.title,
      input.notes ?? null,
      input.dueDate ?? null,
      input.priority ?? "normal",
      sortOrder,
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
}

export async function removeTodo(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await db.runAsync("UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
  syncEngine.enqueue({ entity: "todos", id, updatedAt: now, operation: "delete" });
}
