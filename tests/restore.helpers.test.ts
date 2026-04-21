import { beforeEach, describe, expect, it, vi } from "vitest";

const { syncEngine } = vi.hoisted(() => ({
  syncEngine: {
    enqueue: vi.fn(),
  },
}));

vi.mock("@/core/sync/sync.engine", () => ({
  syncEngine,
}));

vi.mock("@/core/db/client", () => ({
  getDatabase: vi.fn(),
}));

vi.mock("@/core/linked-actions/linkedActions.engine", () => ({
  linkedActionsEngine: {
    processSourceAction: vi.fn(),
  },
}));

vi.mock("@/core/linked-actions/linkedActions.data", () => ({
  deleteLinkedActionRulesForTargetEntity: vi.fn(),
  listLinkedActionRulesForSourceEntity: vi.fn(),
  replaceLinkedActionRulesForSourceEntity: vi.fn(),
}));

vi.mock("@/lib/time", async () => {
  const actual = await vi.importActual<typeof import("@/lib/time")>("@/lib/time");
  return {
    ...actual,
    nowIso: vi.fn(() => "2026-04-21T12:00:00.000Z"),
    toDateKey: vi.fn(() => "2026-04-21"),
  };
});

vi.mock("@/features/todos/todos.domain", () => ({
  getTomorrowDateKey: vi.fn(() => "2026-04-22"),
}));

vi.mock("@/features/habits/habitPresets", () => ({
  DEFAULT_HABIT_COLOR: "#64748b",
  DEFAULT_HABIT_ICON: "check-circle",
}));

vi.mock("@/core/db/appMeta", () => ({
  appMetaKeys: {
    calorieGoal: { key: "calorie_goal", owner: "calories", storage: "json" },
  },
  getAppMetaJsonOrDefault: vi.fn(),
  setAppMetaJson: vi.fn(),
}));

vi.mock("@/lib/id", () => ({
  createId: vi.fn(() => "mock_id"),
}));

vi.mock("@/features/calories/calories.domain", () => ({
  kcalFromMacros: vi.fn(() => 0),
}));

import { applyRemoteCalorieEntries } from "@/features/calories/calories.data";
import { applyRemoteHabits } from "@/features/habits/habits.data";
import { applyRemoteTodos } from "@/features/todos/todos.data";

function buildDb() {
  return {
    runAsync: vi.fn().mockResolvedValue(undefined),
  };
}

describe("restore helper writers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applyRemoteTodos preserves timestamps and deleted_at without enqueueing", async () => {
    const db = buildDb();

    await applyRemoteTodos(db as never, [
      {
        id: "todo_1",
        title: "Restore todos",
        notes: "From backup",
        completed: 1,
        due_date: "2026-04-21",
        priority: "urgent",
        sort_order: 4,
        recurrence: null,
        recurrence_id: null,
        created_at: "2026-04-10T10:00:00.000Z",
        updated_at: "2026-04-20T10:00:00.000Z",
        deleted_at: "2026-04-21T00:00:00.000Z",
      },
    ]);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO todos"),
      [
        "todo_1",
        "Restore todos",
        "From backup",
        1,
        "2026-04-21",
        "urgent",
        4,
        null,
        null,
        "2026-04-10T10:00:00.000Z",
        "2026-04-20T10:00:00.000Z",
        "2026-04-21T00:00:00.000Z",
      ],
    );
    expect(syncEngine.enqueue).not.toHaveBeenCalled();
  });

  it("applyRemoteHabits preserves deleted rows without enqueueing", async () => {
    const db = buildDb();

    await applyRemoteHabits(db as never, [
      {
        id: "habit_1",
        name: "Hydrate",
        target_per_day: 3,
        reminder_time: null,
        category: "morning",
        icon: "check-circle",
        color: "#22c55e",
        created_at: "2026-04-11T10:00:00.000Z",
        updated_at: "2026-04-20T10:00:00.000Z",
        deleted_at: "2026-04-21T00:00:00.000Z",
      },
    ]);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO habits"),
      [
        "habit_1",
        "Hydrate",
        3,
        null,
        "morning",
        "check-circle",
        "#22c55e",
        "2026-04-11T10:00:00.000Z",
        "2026-04-20T10:00:00.000Z",
        "2026-04-21T00:00:00.000Z",
      ],
    );
    expect(syncEngine.enqueue).not.toHaveBeenCalled();
  });

  it("applyRemoteCalorieEntries preserves timestamps and deleted rows without enqueueing", async () => {
    const db = buildDb();

    await applyRemoteCalorieEntries(db as never, [
      {
        id: "cal_1",
        food_name: "Oats",
        calories: 310,
        protein: 12,
        carbs: 48,
        fats: 7,
        fiber: 8,
        meal_type: "breakfast",
        consumed_on: "2026-04-21",
        created_at: "2026-04-11T10:00:00.000Z",
        updated_at: "2026-04-20T10:00:00.000Z",
        deleted_at: "2026-04-21T00:00:00.000Z",
      },
    ]);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO calorie_entries"),
      [
        "cal_1",
        "Oats",
        310,
        12,
        48,
        7,
        8,
        "breakfast",
        "2026-04-21",
        "2026-04-11T10:00:00.000Z",
        "2026-04-20T10:00:00.000Z",
        "2026-04-21T00:00:00.000Z",
      ],
    );
    expect(syncEngine.enqueue).not.toHaveBeenCalled();
  });
});
