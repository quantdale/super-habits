import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Todo } from "@/core/db/types";
import { toggleTodo } from "@/features/todos/todos.data";

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

const { linkedActionsEngine } = vi.hoisted(() => ({
  linkedActionsEngine: {
    processSourceAction: vi.fn(),
  },
}));

const { syncEngine } = vi.hoisted(() => ({
  syncEngine: {
    enqueue: vi.fn(),
  },
}));

vi.mock("@/core/db/client", () => ({
  getDatabase,
}));

vi.mock("@/core/linked-actions/linkedActions.engine", () => ({
  linkedActionsEngine,
}));

vi.mock("@/core/sync/sync.engine", () => ({
  syncEngine,
}));

function buildTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: "todo_1",
    title: "Morning checklist",
    notes: null,
    completed: 0,
    due_date: "2026-04-16",
    priority: "normal",
    sort_order: 1,
    recurrence: null,
    recurrence_id: null,
    created_at: "2026-04-16T00:00:00.000Z",
    updated_at: "2026-04-16T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("features/todos/todos.data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linkedActionsEngine.processSourceAction.mockResolvedValue({
      matchedRuleCount: 0,
      notices: [],
    });
  });

  it("emits a linked-actions source event when a todo is completed", async () => {
    const db = {
      runAsync: vi.fn().mockResolvedValue(undefined),
      getFirstAsync: vi.fn(),
    };
    getDatabase.mockResolvedValue(db);

    const notice = {
      id: "notice_1",
      createdAt: "2026-04-16T00:00:00.000Z",
      payload: {
        kind: "linked-actions",
        message: "Linked Actions updated Evening task.",
        reason: "Morning checklist applied todo.complete.",
        source: { feature: "todos", entityType: "todo", entityId: "todo_1" },
        target: { feature: "todos", entityType: "todo", entityId: "todo_2" },
      },
    };
    linkedActionsEngine.processSourceAction.mockResolvedValue({
      matchedRuleCount: 1,
      notices: [notice],
    });

    const result = await toggleTodo(buildTodo());

    expect(db.runAsync).toHaveBeenCalledWith(
      "UPDATE todos SET completed = ?, updated_at = ? WHERE id = ?",
      [1, expect.any(String), "todo_1"],
    );
    expect(syncEngine.enqueue).toHaveBeenCalledWith({
      entity: "todos",
      id: "todo_1",
      updatedAt: expect.any(String),
      operation: "update",
    });
    expect(linkedActionsEngine.processSourceAction).toHaveBeenCalledWith({
      occurredAt: expect.any(String),
      feature: "todos",
      entityType: "todo",
      entityId: "todo_1",
      triggerType: "todo.completed",
      label: "Morning checklist",
      sourceDateKey: expect.any(String),
      sourceRecordId: "todo_1",
      origin: {
        originKind: "user",
        originRuleId: null,
        originEventId: null,
      },
      payload: {
        previousCompleted: 0,
        currentCompleted: 1,
        recurrence: null,
        dueDate: "2026-04-16",
      },
    });
    expect(result).toEqual({
      matchedRuleCount: 1,
      notices: [notice],
    });
  });

  it("does not emit linked-actions events when a completed todo is reopened", async () => {
    const db = {
      runAsync: vi.fn().mockResolvedValue(undefined),
      getFirstAsync: vi.fn(),
    };
    getDatabase.mockResolvedValue(db);

    const result = await toggleTodo(
      buildTodo({
        completed: 1,
      }),
    );

    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
    expect(result).toEqual({
      matchedRuleCount: 0,
      notices: [],
    });
  });

  it("still creates the next recurring instance after a recurring todo is completed", async () => {
    const db = {
      runAsync: vi.fn().mockResolvedValue(undefined),
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ maxOrder: 3 }),
    };
    getDatabase.mockResolvedValue(db);

    await toggleTodo(
      buildTodo({
        recurrence: "daily",
        recurrence_id: "rec_1",
      }),
    );

    expect(linkedActionsEngine.processSourceAction).toHaveBeenCalledTimes(1);
    expect(db.getFirstAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("WHERE recurrence_id = ?"),
      ["rec_1", expect.any(String)],
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO todos"),
      expect.arrayContaining([
        expect.stringMatching(/^todo_/),
        "Morning checklist",
        null,
        expect.any(String),
        "normal",
        4,
        "rec_1",
      ]),
    );
    expect(syncEngine.enqueue).toHaveBeenCalledTimes(2);
  });
});
