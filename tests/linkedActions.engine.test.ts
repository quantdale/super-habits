import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkedActionsEngine } from "@/core/linked-actions/linkedActions.engine";
import type {
  LinkedActionExecutionRecord,
  LinkedActionRuleDefinition,
} from "@/core/linked-actions/linkedActions.types";

const dataMocks = vi.hoisted(() => ({
  createLinkedActionEvent: vi.fn(),
  createLinkedActionExecution: vi.fn(),
  getAppliedHabitDayCalorieExecution: vi.fn(),
  getLinkedActionEvent: vi.fn(),
  getLinkedActionExecutionByChainFingerprint: vi.fn(),
  getLinkedActionExecutionByRuleAndSourceEvent: vi.fn(),
  listMatchingLinkedActionRules: vi.fn(),
  updateLinkedActionExecution: vi.fn(),
}));

vi.mock("@/core/linked-actions/linkedActions.data", () => dataMocks);

function buildRule(
  overrides: Partial<LinkedActionRuleDefinition> = {},
): LinkedActionRuleDefinition {
  return {
    id: "link_1",
    status: "active",
    directionPolicy: "one_way",
    bidirectionalGroupId: null,
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
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("core/linked-actions/linkedActions.engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataMocks.getAppliedHabitDayCalorieExecution.mockResolvedValue(null);
    dataMocks.getLinkedActionEvent.mockResolvedValue(null);
    dataMocks.getLinkedActionExecutionByRuleAndSourceEvent.mockResolvedValue(null);
    dataMocks.getLinkedActionExecutionByChainFingerprint.mockResolvedValue(null);
    dataMocks.updateLinkedActionExecution.mockResolvedValue(undefined);
    dataMocks.listMatchingLinkedActionRules.mockResolvedValue([]);
    dataMocks.createLinkedActionEvent.mockImplementation(async (event) => event);
    dataMocks.createLinkedActionExecution.mockImplementation(async (execution) => ({
      id: execution.id ?? "lexec_1",
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:00.000Z",
      ...execution,
    }));
  });

  it("creates a new root chain and applies a matching effect", async () => {
    dataMocks.listMatchingLinkedActionRules.mockResolvedValue([buildRule()]);

    const executor = vi.fn().mockResolvedValue({
      status: "applied",
      targetLabel: "Hydrate",
    });
    const engine = new LinkedActionsEngine({
      effectRegistry: { "habit.increment": executor },
    });

    const result = await engine.processSourceAction({
      feature: "todos",
      entityType: "todo",
      entityId: "todo_1",
      triggerType: "todo.completed",
      label: "Morning todo",
      sourceDateKey: "2026-04-14",
    });

    expect(dataMocks.createLinkedActionEvent).toHaveBeenCalledTimes(1);
    const persistedEvent = dataMocks.createLinkedActionEvent.mock.calls[0][0];
    expect(persistedEvent.chain.chainId).toMatch(/^lchain_/);
    expect(persistedEvent.chain.rootEventId).toBe(persistedEvent.eventId);
    expect(persistedEvent.chain.depth).toBe(0);

    expect(dataMocks.createLinkedActionExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: "link_1",
        sourceEventId: persistedEvent.eventId,
        chainId: persistedEvent.chain.chainId,
        status: "planned",
      }),
    );
    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.matchedRuleCount).toBe(1);
    expect(result.effects[0]).toMatchObject({
      status: "applied",
      ruleId: "link_1",
      effectType: "habit.increment",
    });
    expect(result.notices[0]?.payload.message).toContain("Linked Actions updated");
  });

  it("returns duplicate results when the same source event already executed a rule", async () => {
    dataMocks.listMatchingLinkedActionRules.mockResolvedValue([buildRule()]);
    const priorExecution: LinkedActionExecutionRecord = {
      id: "lexec_existing",
      ruleId: "link_1",
      sourceEventId: "levt_existing",
      chainId: "lchain_existing",
      rootEventId: "levt_existing",
      originRuleId: null,
      effectType: "habit.increment",
      effectFingerprint: "fingerprint",
      status: "applied",
      targetFeature: "habits",
      targetEntityType: "habit",
      targetEntityId: "habit_1",
      producedEntityType: null,
      producedEntityId: null,
      noticePayload: null,
      errorMessage: null,
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:00.000Z",
    };
    dataMocks.getLinkedActionExecutionByRuleAndSourceEvent.mockResolvedValue(priorExecution);

    const executor = vi.fn();
    const engine = new LinkedActionsEngine({
      effectRegistry: { "habit.increment": executor },
    });

    const result = await engine.processSourceAction({
      eventId: "levt_existing",
      feature: "todos",
      entityType: "todo",
      entityId: "todo_1",
      triggerType: "todo.completed",
    });

    expect(dataMocks.createLinkedActionExecution).not.toHaveBeenCalled();
    expect(executor).not.toHaveBeenCalled();
    expect(result.effects[0]).toMatchObject({
      status: "duplicate",
      reason: "source_event_already_executed",
      executionId: "lexec_existing",
    });
  });

  it("returns planned effect metadata without persisting events or executions", async () => {
    dataMocks.listMatchingLinkedActionRules.mockResolvedValue([
      buildRule({
        id: "link_cal",
        source: {
          feature: "workout",
          entityType: "workout_routine",
          entityId: "wrk_1",
          triggerType: "workout.completed",
        },
        target: {
          feature: "calories",
          entityType: "calorie_log",
          entityId: null,
          effect: {
            kind: "log",
            type: "calorie.log",
            dateStrategy: "source_date",
            templateSource: "inline",
            savedMealId: null,
            foodName: "Protein shake",
            calories: 240,
            protein: 30,
            carbs: 12,
            fats: 6,
            fiber: 2,
            mealType: "snack",
          },
        },
      }),
    ]);

    const engine = new LinkedActionsEngine();
    const result = await engine.processSourceAction(
      {
        feature: "workout",
        entityType: "workout_routine",
        entityId: "wrk_1",
        triggerType: "workout.completed",
        label: "Full body",
        sourceDateKey: "2026-04-14",
      },
      "plan",
    );

    expect(dataMocks.createLinkedActionEvent).not.toHaveBeenCalled();
    expect(dataMocks.createLinkedActionExecution).not.toHaveBeenCalled();
    expect(result.mode).toBe("plan");
    expect(result.effects[0]).toMatchObject({
      status: "planned",
      effectType: "calorie.log",
      producedEntityType: "calorie_log",
    });
    expect(result.effects[0].producedEntityId).toMatch(/^cal_/);
    expect(result.effects[0].noticePreview).toMatchObject({
      kind: "linked-actions",
      target: {
        feature: "calories",
      },
    });
  });

  it("logs a calorie notice with path-specific copy for habit completions", async () => {
    dataMocks.listMatchingLinkedActionRules.mockResolvedValue([
      buildRule({
        id: "link_calorie",
        source: {
          feature: "habits",
          entityType: "habit",
          entityId: "habit_1",
          triggerType: "habit.completed_for_day",
        },
        target: {
          feature: "calories",
          entityType: "calorie_log",
          entityId: null,
          effect: {
            kind: "log",
            type: "calorie.log",
            dateStrategy: "source_date",
            templateSource: "inline",
            savedMealId: null,
            foodName: "Protein shake",
            calories: 240,
            protein: 30,
            carbs: 12,
            fats: 6,
            fiber: 2,
            mealType: "snack",
          },
        },
      }),
    ]);

    const executor = vi.fn().mockResolvedValue({
      status: "applied",
      targetLabel: "Protein shake",
      producedEntityType: "calorie_log",
      producedEntityId: "cal_123",
    });
    const engine = new LinkedActionsEngine({
      effectRegistry: { "calorie.log": executor },
    });

    const result = await engine.processSourceAction({
      feature: "habits",
      entityType: "habit",
      entityId: "habit_1",
      triggerType: "habit.completed_for_day",
      label: "Hydrate",
      sourceDateKey: "2026-04-14",
    });

    expect(dataMocks.getAppliedHabitDayCalorieExecution).toHaveBeenCalledWith(
      "link_calorie",
      "habit_1",
      "2026-04-14",
    );
    expect(result.effects[0]).toMatchObject({
      status: "applied",
      effectType: "calorie.log",
      producedEntityId: "cal_123",
    });
    expect(result.notices[0]?.payload).toMatchObject({
      message: "Linked Actions logged Protein shake.",
      reason: "Hydrate completed for the day and added a calorie entry.",
      target: {
        feature: "calories",
      },
    });
  });

  it("dedupes repeated habit-day calorie executions before creating another execution", async () => {
    dataMocks.listMatchingLinkedActionRules.mockResolvedValue([
      buildRule({
        id: "link_calorie",
        source: {
          feature: "habits",
          entityType: "habit",
          entityId: "habit_1",
          triggerType: "habit.completed_for_day",
        },
        target: {
          feature: "calories",
          entityType: "calorie_log",
          entityId: null,
          effect: {
            kind: "log",
            type: "calorie.log",
            dateStrategy: "source_date",
            templateSource: "inline",
            savedMealId: null,
            foodName: "Protein shake",
            calories: 240,
            protein: 30,
            carbs: 12,
            fats: 6,
            fiber: 2,
            mealType: "snack",
          },
        },
      }),
    ]);
    dataMocks.getAppliedHabitDayCalorieExecution.mockResolvedValue({
      id: "lexec_existing",
      ruleId: "link_calorie",
      sourceEventId: "levt_existing",
      chainId: "lchain_existing",
      rootEventId: "levt_existing",
      originRuleId: null,
      effectType: "calorie.log",
      effectFingerprint: "fingerprint",
      status: "applied",
      targetFeature: "calories",
      targetEntityType: "calorie_log",
      targetEntityId: null,
      producedEntityType: "calorie_log",
      producedEntityId: "cal_existing",
      noticePayload: {
        kind: "linked-actions",
        message: "Linked Actions logged Protein shake.",
        reason: "Hydrate completed for the day and added a calorie entry.",
        source: {
          feature: "habits",
          entityType: "habit",
          entityId: "habit_1",
          label: "Hydrate",
        },
        target: {
          feature: "calories",
          entityType: "calorie_log",
          entityId: "cal_existing",
          label: "Protein shake",
        },
        destination: {
          kind: "linked-actions-target",
          href: "/(tabs)/calories",
          feature: "calories",
          entityType: "calorie_log",
          entityId: "cal_existing",
          label: "Protein shake",
        },
      },
      errorMessage: null,
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:00.000Z",
    });

    const executor = vi.fn();
    const engine = new LinkedActionsEngine({
      effectRegistry: { "calorie.log": executor },
    });

    const result = await engine.processSourceAction({
      feature: "habits",
      entityType: "habit",
      entityId: "habit_1",
      triggerType: "habit.completed_for_day",
      label: "Hydrate",
      sourceDateKey: "2026-04-14",
    });

    expect(dataMocks.createLinkedActionExecution).not.toHaveBeenCalled();
    expect(executor).not.toHaveBeenCalled();
    expect(result.effects[0]).toMatchObject({
      status: "duplicate",
      reason: "habit_day_already_logged",
      executionId: "lexec_existing",
      producedEntityId: "cal_existing",
    });
  });
});
