import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkedActionsEngine } from "@/core/linked-actions/linkedActions.engine";
import type {
  LinkedActionExecutionRecord,
  LinkedActionRuleDefinition,
  LinkedActionSupportedRuleDefinition,
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
  overrides: Partial<LinkedActionSupportedRuleDefinition> = {},
): LinkedActionSupportedRuleDefinition {
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
    isUnsupported: false,
    unsupportedReason: null,
    rawTargetFeature: "habits",
    rawTargetEntityType: "habit",
    rawEffectType: "habit.increment",
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

  it("returns planned effect metadata for supported rules without persisting events or executions", async () => {
    dataMocks.listMatchingLinkedActionRules.mockResolvedValue([
      buildRule({
        id: "link_workout",
        source: {
          feature: "workout",
          entityType: "workout_routine",
          entityId: "wrk_1",
          triggerType: "workout.completed",
        },
        target: {
          feature: "workout",
          entityType: "workout_routine",
          entityId: "wrk_target",
          effect: {
            kind: "log",
            type: "workout.log",
            notes: null,
          },
        },
        rawTargetFeature: "workout",
        rawTargetEntityType: "workout_routine",
        rawEffectType: "workout.log",
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
      effectType: "workout.log",
      producedEntityType: "workout_log",
    });
    expect(result.effects[0].producedEntityId).toMatch(/^wrk_/);
    expect(result.effects[0].noticePreview).toMatchObject({
      kind: "linked-actions",
      target: {
        feature: "workout",
      },
    });
  });

  it("skips unsupported legacy target rules without executing effects", async () => {
    dataMocks.listMatchingLinkedActionRules.mockResolvedValue([
      {
        id: "link_legacy",
        status: "active",
        directionPolicy: "one_way",
        bidirectionalGroupId: null,
        source: {
          feature: "habits",
          entityType: "habit",
          entityId: "habit_1",
          triggerType: "habit.completed_for_day",
        },
        target: {
          feature: "pomodoro",
          entityType: "pomodoro_session",
          entityId: null,
          effect: {
            kind: "unsupported",
            type: "pomodoro.log",
            rawPayload: "{\"sessionType\":\"focus\",\"durationSeconds\":1500}",
          },
        },
        isUnsupported: true,
        unsupportedReason:
          "This linked action uses an unsupported target and must be removed or replaced.",
        rawTargetFeature: "pomodoro",
        rawTargetEntityType: "pomodoro_session",
        rawEffectType: "pomodoro.log",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        deletedAt: null,
      },
    ]);

    const executor = vi.fn();
    const engine = new LinkedActionsEngine({ effectRegistry: { "pomodoro.log": executor } });

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
      status: "skipped",
      ruleId: "link_legacy",
      effectType: "pomodoro.log",
      targetFeature: "pomodoro",
      reason: "unsupported_rule",
      errorMessage:
        "This linked action uses an unsupported target and must be removed or replaced.",
    });
    expect(result.notices).toEqual([]);
  });

  it("reports unsupported rules during plan mode too", async () => {
    dataMocks.listMatchingLinkedActionRules.mockResolvedValue([
      {
        id: "link_legacy",
        status: "active",
        directionPolicy: "one_way",
        bidirectionalGroupId: null,
        source: {
          feature: "habits",
          entityType: "habit",
          entityId: "habit_1",
          triggerType: "habit.completed_for_day",
        },
        target: {
          feature: "pomodoro",
          entityType: "pomodoro_session",
          entityId: null,
          effect: {
            kind: "unsupported",
            type: "pomodoro.log",
            rawPayload: "{}",
          },
        },
        isUnsupported: true,
        unsupportedReason:
          "This linked action uses an unsupported target and must be removed or replaced.",
        rawTargetFeature: "pomodoro",
        rawTargetEntityType: "pomodoro_session",
        rawEffectType: "pomodoro.log",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        deletedAt: null,
      },
    ]);

    const engine = new LinkedActionsEngine();
    const result = await engine.processSourceAction(
      {
        feature: "habits",
        entityType: "habit",
        entityId: "habit_1",
        triggerType: "habit.completed_for_day",
      },
      "plan",
    );

    expect(result.effects[0]).toMatchObject({
      status: "skipped",
      reason: "unsupported_rule",
      targetFeature: "pomodoro",
    });
    expect(dataMocks.createLinkedActionEvent).not.toHaveBeenCalled();
  });
});
