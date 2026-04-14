import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLinkedActionRule,
  deleteLinkedActionRule,
  getLinkedActionRule,
  listActiveLinkedActionRulesForSource,
  listLinkedActionRules,
  updateLinkedActionRuleStatus,
} from "@/core/linked-actions/linkedActions.data";
import type { LinkedActionRuleRow } from "@/core/linked-actions/linkedActions.types";

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

vi.mock("@/core/db/client", () => ({
  getDatabase,
}));

describe("core/linked-actions/linkedActions.data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a linked action rule with serialized effect payload", async () => {
    const db = {
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const created = await createLinkedActionRule({
      source: {
        feature: "todos",
        entityType: "todo",
        entityId: "todo_1",
        triggerType: "todo.completed",
      },
      target: {
        feature: "habits",
        entityType: "habit",
        entityId: "habit_1",
        effect: {
          kind: "progress",
          type: "habit.increment",
          amount: 1,
          dateStrategy: "today",
        },
      },
      directionPolicy: "bidirectional_peer",
      bidirectionalGroupId: "group_1",
    });

    expect(created.status).toBe("active");
    expect(created.directionPolicy).toBe("bidirectional_peer");
    expect(db.runAsync).toHaveBeenCalledTimes(1);
    const [, args] = db.runAsync.mock.calls[0];
    expect(args[0]).toMatch(/^link_/);
    expect(args[1]).toBe("active");
    expect(args[2]).toBe("bidirectional_peer");
    expect(args[3]).toBe("group_1");
    expect(args[12]).toBe(JSON.stringify({ amount: 1, dateStrategy: "today" }));
  });

  it("normalizes stored rows when listing or fetching rules", async () => {
    const row: LinkedActionRuleRow = {
      id: "link_1",
      status: "active",
      direction_policy: "one_way",
      bidirectional_group_id: null,
      source_feature: "workout",
      source_entity_type: "workout_routine",
      source_entity_id: "wrk_1",
      trigger_type: "workout.completed",
      target_feature: "pomodoro",
      target_entity_type: "pomodoro_session",
      target_entity_id: null,
      effect_type: "pomodoro.log",
      effect_payload: JSON.stringify({
        sessionType: "focus",
        durationSeconds: 900,
      }),
      created_at: "2026-04-13T00:00:00.000Z",
      updated_at: "2026-04-13T00:00:00.000Z",
      deleted_at: null,
    };

    const db = {
      getAllAsync: vi.fn().mockResolvedValue([row]),
      getFirstAsync: vi.fn().mockResolvedValue(row),
    };
    getDatabase.mockResolvedValue(db);

    await expect(listLinkedActionRules()).resolves.toEqual([
      {
        id: "link_1",
        status: "active",
        directionPolicy: "one_way",
        bidirectionalGroupId: null,
        source: {
          feature: "workout",
          entityType: "workout_routine",
          entityId: "wrk_1",
          triggerType: "workout.completed",
        },
        target: {
          feature: "pomodoro",
          entityType: "pomodoro_session",
          entityId: null,
          effect: {
            kind: "log",
            type: "pomodoro.log",
            sessionType: "focus",
            durationSeconds: 900,
          },
        },
        createdAt: "2026-04-13T00:00:00.000Z",
        updatedAt: "2026-04-13T00:00:00.000Z",
        deletedAt: null,
      },
    ]);

    await expect(getLinkedActionRule("link_1")).resolves.toMatchObject({
      id: "link_1",
      target: {
        effect: {
          type: "pomodoro.log",
          durationSeconds: 900,
        },
      },
    });
  });

  it("updates status and soft deletes without changing other runtime behavior", async () => {
    const db = {
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await updateLinkedActionRuleStatus("link_1", "paused");
    await deleteLinkedActionRule("link_1");

    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SET status = ?, updated_at = ?"),
      ["paused", expect.any(String), "link_1"],
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SET deleted_at = ?, updated_at = ?"),
      [expect.any(String), expect.any(String), "link_1"],
    );
  });

  it("filters active rules by exact source entity and trigger", async () => {
    const row: LinkedActionRuleRow = {
      id: "link_2",
      status: "active",
      direction_policy: "one_way",
      bidirectional_group_id: null,
      source_feature: "habits",
      source_entity_type: "habit",
      source_entity_id: "habit_1",
      trigger_type: "habit.completed_for_day",
      target_feature: "habits",
      target_entity_type: "habit",
      target_entity_id: "habit_2",
      effect_type: "habit.increment",
      effect_payload: JSON.stringify({
        amount: 1,
        dateStrategy: "today",
      }),
      created_at: "2026-04-13T00:00:00.000Z",
      updated_at: "2026-04-13T00:00:00.000Z",
      deleted_at: null,
    };
    const db = {
      getAllAsync: vi.fn().mockResolvedValue([row]),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      listActiveLinkedActionRulesForSource({
        feature: "habits",
        entityType: "habit",
        entityId: "habit_1",
        triggerType: "habit.completed_for_day",
      }),
    ).resolves.toHaveLength(1);

    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'active'"),
      ["habits", "habit", "habit_1", "habit.completed_for_day"],
    );
  });
});
