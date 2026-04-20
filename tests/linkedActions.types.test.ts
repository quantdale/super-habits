import { describe, expect, it } from "vitest";
import {
  buildLinkedActionRuleRow,
  isSupportedLinkedActionTriggerType,
  normalizeLinkedActionRuleRow,
  parseLinkedActionEffectPayload,
  parseLinkedActionRuleRecord,
  serializeLinkedActionEffectPayload,
} from "@/core/linked-actions/linkedActions.types";

describe("core/linked-actions/linkedActions.types", () => {
  it("round-trips a normalized rule through row serialization", () => {
    const normalized = normalizeLinkedActionRuleRow({
      id: "link_1",
      status: "active",
      direction_policy: "bidirectional_peer",
      bidirectional_group_id: "group_1",
      source_feature: "habits",
      source_entity_type: "habit",
      source_entity_id: "habit_1",
      trigger_type: "habit.completed_for_day",
      target_feature: "todos",
      target_entity_type: "todo",
      target_entity_id: "todo_1",
      effect_type: "todo.complete",
      effect_payload: "{}",
      created_at: "2026-04-13T00:00:00.000Z",
      updated_at: "2026-04-13T00:00:00.000Z",
      deleted_at: null,
    });

    expect(normalized.isUnsupported).toBe(false);
    expect(buildLinkedActionRuleRow(normalized)).toEqual({
      id: "link_1",
      status: "active",
      direction_policy: "bidirectional_peer",
      bidirectional_group_id: "group_1",
      source_feature: "habits",
      source_entity_type: "habit",
      source_entity_id: "habit_1",
      trigger_type: "habit.completed_for_day",
      target_feature: "todos",
      target_entity_type: "todo",
      target_entity_id: "todo_1",
      effect_type: "todo.complete",
      effect_payload: "{}",
      created_at: "2026-04-13T00:00:00.000Z",
      updated_at: "2026-04-13T00:00:00.000Z",
      deleted_at: null,
    });
  });

  it("serializes and parses log effects with explicit payload contracts", () => {
    const payload = serializeLinkedActionEffectPayload({
      kind: "log",
      type: "calorie.log",
      dateStrategy: "source_date",
      templateSource: "saved_meal",
      savedMealId: "smeal_1",
      foodName: "Protein oats",
      calories: 420,
      protein: 30,
      carbs: 48,
      fats: 12,
      fiber: 8,
      mealType: "breakfast",
    });

    expect(parseLinkedActionEffectPayload("calorie.log", payload)).toEqual({
      kind: "log",
      type: "calorie.log",
      dateStrategy: "source_date",
      templateSource: "saved_meal",
      savedMealId: "smeal_1",
      foodName: "Protein oats",
      calories: 420,
      protein: 30,
      carbs: 48,
      fats: 12,
      fiber: 8,
      mealType: "breakfast",
    });
  });

  it("rejects invalid source and trigger combinations", () => {
    expect(() =>
      normalizeLinkedActionRuleRow({
        id: "link_2",
        status: "active",
        direction_policy: "one_way",
        bidirectional_group_id: null,
        source_feature: "todos",
        source_entity_type: "todo",
        source_entity_id: "todo_1",
        trigger_type: "habit.completed_for_day",
        target_feature: "habits",
        target_entity_type: "habit",
        target_entity_id: "habit_1",
        effect_type: "habit.increment",
        effect_payload: JSON.stringify({
          amount: 1,
          dateStrategy: "today",
        }),
        created_at: "2026-04-13T00:00:00.000Z",
        updated_at: "2026-04-13T00:00:00.000Z",
        deleted_at: null,
      }),
    ).toThrow("Trigger habit.completed_for_day is not allowed for source entity todo");
  });

  it("marks legacy pomodoro targets unsupported instead of throwing", () => {
    expect(
      parseLinkedActionRuleRecord({
        id: "link_3",
        status: "paused",
        directionPolicy: "one_way",
        bidirectionalGroupId: null,
        source: {
          feature: "pomodoro",
          entityType: "pomodoro_timer",
          entityId: null,
          triggerType: "pomodoro.focus_completed",
        },
        target: {
          feature: "pomodoro",
          entityType: "pomodoro_session",
          entityId: null,
          effect: {
            type: "pomodoro.log",
            sessionType: "focus",
            durationSeconds: 1500,
          },
        },
        createdAt: "2026-04-13T00:00:00.000Z",
        updatedAt: "2026-04-13T00:00:00.000Z",
        deletedAt: null,
      }),
    ).toMatchObject({
      id: "link_3",
      isUnsupported: true,
      rawTargetFeature: "pomodoro",
      rawTargetEntityType: "pomodoro_session",
      rawEffectType: "pomodoro.log",
      unsupportedReason:
        "This linked action uses an unsupported target and must be removed or replaced.",
    });
  });

  it("marks unsupported source-to-target paths as unsupported even when the trigger and effect exist individually", () => {
    expect(
      normalizeLinkedActionRuleRow({
        id: "link_combo",
        status: "active",
        direction_policy: "one_way",
        bidirectional_group_id: null,
        source_feature: "todos",
        source_entity_type: "todo",
        source_entity_id: "todo_1",
        trigger_type: "todo.completed",
        target_feature: "habits",
        target_entity_type: "habit",
        target_entity_id: "habit_1",
        effect_type: "habit.increment",
        effect_payload: JSON.stringify({
          amount: 1,
          dateStrategy: "source_date",
        }),
        created_at: "2026-04-13T00:00:00.000Z",
        updated_at: "2026-04-13T00:00:00.000Z",
        deleted_at: null,
      }),
    ).toMatchObject({
      id: "link_combo",
      isUnsupported: true,
      rawTargetFeature: "habits",
      rawTargetEntityType: "habit",
      rawEffectType: "habit.increment",
      unsupportedReason:
        "This linked action uses an unsupported target and must be removed or replaced.",
    });
  });

  it("keeps unknown target features parseable for persisted rows", () => {
    expect(
      normalizeLinkedActionRuleRow({
        id: "link_legacy",
        status: "active",
        direction_policy: "one_way",
        bidirectional_group_id: null,
        source_feature: "habits",
        source_entity_type: "habit",
        source_entity_id: "habit_1",
        trigger_type: "habit.completed_for_day",
        target_feature: "journals",
        target_entity_type: "journal_entry",
        target_entity_id: "journal_1",
        effect_type: "journal.append",
        effect_payload: "{\"template\":\"done\"}",
        created_at: "2026-04-13T00:00:00.000Z",
        updated_at: "2026-04-13T00:00:00.000Z",
        deleted_at: null,
      }),
    ).toMatchObject({
      id: "link_legacy",
      isUnsupported: true,
      rawTargetFeature: "journals",
      rawTargetEntityType: "journal_entry",
      rawEffectType: "journal.append",
    });
  });

  it("keeps only shipped trigger sources as supported", () => {
    expect(isSupportedLinkedActionTriggerType("todo.completed")).toBe(true);
    expect(isSupportedLinkedActionTriggerType("habit.completed_for_day")).toBe(true);
    expect(isSupportedLinkedActionTriggerType("workout.completed")).toBe(false);
    expect(isSupportedLinkedActionTriggerType("pomodoro.focus_completed")).toBe(false);
  });
});
