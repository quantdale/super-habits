import { getDatabase } from "@/core/db/client";
import { Todo } from "@/core/db/types";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import { syncEngine } from "@/core/sync/sync.engine";

export async function listTodos(): Promise<Todo[]> {
  const db = await getDatabase();
  return db.getAllAsync<Todo>(
    "SELECT * FROM todos WHERE deleted_at IS NULL ORDER BY completed ASC, created_at DESC",
  );
}

export async function addTodo(input: { title: string; notes?: string }): Promise<void> {
  const db = await getDatabase();
  const id = createId("todo");
  const now = nowIso();
  await db.runAsync(
    "INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at) VALUES (?, ?, ?, 0, ?, ?, NULL)",
    [id, input.title, input.notes ?? null, now, now],
  );
  syncEngine.enqueue({ entity: "todos", id, updatedAt: now, operation: "create" });
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
