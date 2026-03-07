import { getDatabase } from "@/core/db/client";
import { Todo } from "@/core/db/types";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import { syncEngine } from "@/core/sync/sync.engine";

export function listTodos(): Todo[] {
  const db = getDatabase();
  return db.getAllSync<Todo>(
    "SELECT * FROM todos WHERE deleted_at IS NULL ORDER BY completed ASC, created_at DESC",
  );
}

export function addTodo(input: { title: string; notes?: string }) {
  const db = getDatabase();
  const id = createId("todo");
  const now = nowIso();
  db.runSync(
    "INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at) VALUES (?, ?, ?, 0, ?, ?, NULL)",
    [id, input.title, input.notes ?? null, now, now],
  );
  syncEngine.enqueue({ entity: "todos", id, updatedAt: now, operation: "create" });
}

export function toggleTodo(todo: Todo) {
  const db = getDatabase();
  const now = nowIso();
  const next = todo.completed === 1 ? 0 : 1;
  db.runSync("UPDATE todos SET completed = ?, updated_at = ? WHERE id = ?", [next, now, todo.id]);
  syncEngine.enqueue({ entity: "todos", id: todo.id, updatedAt: now, operation: "update" });
}

export function removeTodo(id: string) {
  const db = getDatabase();
  const now = nowIso();
  db.runSync("UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
  syncEngine.enqueue({ entity: "todos", id, updatedAt: now, operation: "delete" });
}
