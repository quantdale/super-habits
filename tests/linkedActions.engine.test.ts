import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkedActionsEngine } from "@/core/linked-actions/linkedActions.engine";

const { listActiveLinkedActionRulesForSource } = vi.hoisted(() => ({
  listActiveLinkedActionRulesForSource: vi.fn(),
}));

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

vi.mock("@/core/linked-actions/linkedActions.data", () => ({
  listActiveLinkedActionRulesForSource,
}));

vi.mock("@/core/db/client", () => ({
  getDatabase,
}));

describe("core/linked-actions/linkedActions.engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a habits dry-run notice for the supported Version 1 slice", async () => {
    listActiveLinkedActionRulesForSource.mockResolvedValue([
      {
        id: "link_1",
        status: "active",
        directionPolicy: "one_way",
        bidirectionalGroupId: null,
        source: {
          feature: "habits",
          entityType: "habit",
          entityId: "habit_source",
          triggerType: "habit.completed_for_day",
        },
        target: {
          feature: "habits",
          entityType: "habit",
          entityId: "habit_target",
          effect: {
            kind: "progress",
            type: "habit.ensure_daily_target",
            minimumCount: "target_per_day",
            dateStrategy: "today",
          },
        },
        createdAt: "2026-04-13T00:00:00.000Z",
        updatedAt: "2026-04-13T00:00:00.000Z",
        deletedAt: null,
      },
    ]);
    getDatabase.mockResolvedValue({
      getFirstAsync: vi.fn().mockResolvedValue({
        id: "habit_target",
        name: "Evening stretch",
      }),
    });

    const engine = new LinkedActionsEngine();
    const result = await engine.handleSourceEvent({
      occurredAt: "2026-04-14T10:00:00.000Z",
      origin: {
        originKind: "user",
        originRuleId: null,
        originEventId: null,
      },
      source: {
        feature: "habits",
        entityType: "habit",
        entityId: "habit_source",
        label: "Hydrate",
        triggerType: "habit.completed_for_day",
        dateKey: "2026-04-14",
        recordId: "hcmp_1",
      },
      payload: {
        previousCount: 0,
        currentCount: 1,
        targetPerDay: 1,
      },
    });

    expect(result.matchedRuleCount).toBe(1);
    expect(result.dryRunRuleIds).toEqual(["link_1"]);
    expect(result.notices).toHaveLength(1);
    expect(result.notices[0]?.payload.message).toContain("Hydrate");
    expect(result.notices[0]?.payload.reason).toContain("Version 1 previews");
    expect(result.notices[0]?.payload.target.label).toBe("Evening stretch");
  });

  it("skips unsupported targets and non-user origin events", async () => {
    listActiveLinkedActionRulesForSource
      .mockResolvedValueOnce([
        {
          id: "link_2",
          status: "active",
          directionPolicy: "one_way",
          bidirectionalGroupId: null,
          source: {
            feature: "habits",
            entityType: "habit",
            entityId: "habit_source",
            triggerType: "habit.completed_for_day",
          },
          target: {
            feature: "todos",
            entityType: "todo",
            entityId: "todo_1",
            effect: {
              kind: "binary",
              type: "todo.complete",
            },
          },
          createdAt: "2026-04-13T00:00:00.000Z",
          updatedAt: "2026-04-13T00:00:00.000Z",
          deletedAt: null,
        },
      ])
      .mockResolvedValueOnce([]);

    const engine = new LinkedActionsEngine();

    const unsupportedTarget = await engine.handleSourceEvent({
      occurredAt: "2026-04-14T10:00:00.000Z",
      origin: {
        originKind: "user",
        originRuleId: null,
        originEventId: null,
      },
      source: {
        feature: "habits",
        entityType: "habit",
        entityId: "habit_source",
        label: "Hydrate",
        triggerType: "habit.completed_for_day",
        dateKey: "2026-04-14",
        recordId: "hcmp_1",
      },
      payload: {
        previousCount: 0,
        currentCount: 1,
        targetPerDay: 1,
      },
    });

    const linkedOrigin = await engine.handleSourceEvent({
      occurredAt: "2026-04-14T10:00:00.000Z",
      origin: {
        originKind: "linked_action",
        originRuleId: "link_1",
        originEventId: "event_1",
      },
      source: {
        feature: "habits",
        entityType: "habit",
        entityId: "habit_source",
        label: "Hydrate",
        triggerType: "habit.completed_for_day",
        dateKey: "2026-04-14",
        recordId: "hcmp_1",
      },
      payload: {
        previousCount: 0,
        currentCount: 1,
        targetPerDay: 1,
      },
    });

    expect(unsupportedTarget.matchedRuleCount).toBe(1);
    expect(unsupportedTarget.notices).toHaveLength(0);
    expect(linkedOrigin).toEqual({
      matchedRuleCount: 0,
      dryRunRuleIds: [],
      notices: [],
    });
  });
});
