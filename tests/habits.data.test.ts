import { beforeEach, describe, expect, it, vi } from "vitest";
import { incrementHabit } from "@/features/habits/habits.data";

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

const { linkedActionsEngine } = vi.hoisted(() => ({
  linkedActionsEngine: {
    processSourceAction: vi.fn(),
  },
}));

vi.mock("@/core/db/client", () => ({
  getDatabase,
}));

vi.mock("@/core/linked-actions/linkedActions.engine", () => ({
  linkedActionsEngine,
}));

describe("features/habits/habits.data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linkedActionsEngine.processSourceAction.mockResolvedValue({
      matchedRuleCount: 0,
      notices: [],
    });
  });

  it("emits a linked-actions source event when an increment reaches the daily target", async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({
          name: "Hydrate",
          target_per_day: 2,
        })
        .mockResolvedValueOnce({
          id: "hcmp_1",
          count: 1,
        }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const result = await incrementHabit("habit_1", "2026-04-14");

    expect(db.runAsync).toHaveBeenCalledWith(
      "UPDATE habit_completions SET count = ?, updated_at = ? WHERE id = ?",
      [2, expect.any(String), "hcmp_1"],
    );
    expect(linkedActionsEngine.processSourceAction).toHaveBeenCalledWith({
      occurredAt: expect.any(String),
      feature: "habits",
      entityType: "habit",
      entityId: "habit_1",
      triggerType: "habit.completed_for_day",
      label: "Hydrate",
      sourceDateKey: "2026-04-14",
      sourceRecordId: "hcmp_1",
      origin: {
        originKind: "user",
        originRuleId: null,
        originEventId: null,
      },
      payload: {
        previousCount: 1,
        currentCount: 2,
        targetPerDay: 2,
      },
    });
    expect(result.count).toBe(2);
  });

  it("does not emit linked-actions events before the target is reached", async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({
          name: "Hydrate",
          target_per_day: 3,
        })
        .mockResolvedValueOnce({
          id: "hcmp_1",
          count: 1,
        }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const result = await incrementHabit("habit_1", "2026-04-14");

    expect(db.runAsync).toHaveBeenCalledTimes(1);
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
    expect(result).toEqual({
      count: 2,
      linkedActions: {
        matchedRuleCount: 0,
        notices: [],
      },
    });
  });

  it("does not re-emit once the habit was already complete for the day", async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({
          name: "Hydrate",
          target_per_day: 2,
        })
        .mockResolvedValueOnce({
          id: "hcmp_1",
          count: 2,
        }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const result = await incrementHabit("habit_1", "2026-04-14");

    expect(db.runAsync).toHaveBeenCalledWith(
      "UPDATE habit_completions SET count = ?, updated_at = ? WHERE id = ?",
      [3, expect.any(String), "hcmp_1"],
    );
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
    expect(result.count).toBe(3);
  });
});
