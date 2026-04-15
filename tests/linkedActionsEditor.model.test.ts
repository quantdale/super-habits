import { describe, expect, it } from "vitest";
import {
  applyLinkedActionTargetFeature,
  countLinkedActionEditorRowErrors,
  createEmptyLinkedActionEditorRow,
  createLinkedActionEditorRowFromRule,
  createSaveLinkedActionRuleInputFromEditorRow,
  getLinkedActionEffectOptions,
  getLinkedActionTriggerOptions,
  validateLinkedActionEditorRow,
} from "@/core/linked-actions/linkedActionsEditor.model";
import { createLinkedActionTargetExistingSelection } from "@/core/linked-actions/linkedActionsTargetPicker.types";
import type {
  LinkedActionRuleDefinition,
  LinkedActionSupportedRuleDefinition,
} from "@/core/linked-actions/linkedActions.types";

function buildSupportedRule(
  overrides: Partial<LinkedActionSupportedRuleDefinition>,
): LinkedActionSupportedRuleDefinition {
  return {
    id: "rule_demo",
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
        type: "habit.increment",
        amount: 1,
        dateStrategy: "source_date",
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

describe("linkedActionsEditor.model", () => {
  it("returns the expected trigger options for habits", () => {
    const options = getLinkedActionTriggerOptions("habits");

    expect(options.map((option) => option.value)).toEqual(["habit.completed_for_day"]);
  });

  it("keeps workout and pomodoro triggers hidden from current authoring options", () => {
    expect(getLinkedActionTriggerOptions("workout")).toEqual([]);
    expect(getLinkedActionTriggerOptions("pomodoro")).toEqual([]);
  });

  it("creates an empty editor row from a source option", () => {
    const row = createEmptyLinkedActionEditorRow({
      key: "habit-demo",
      feature: "habits",
      entityType: "habit",
      entityId: "habit_demo",
      label: "Evening stretch",
      description: "Demo source habit",
    });

    expect(row.sourceFeature).toBe("habits");
    expect(row.sourceEntityType).toBe("habit");
    expect(row.targetFeature).toBeNull();
    expect(row.effectType).toBeNull();
  });

  it("adapts an existing linked rule into editor state", () => {
    const rule: LinkedActionRuleDefinition = buildSupportedRule({
      source: {
        feature: "workout",
        entityType: "workout_routine",
        entityId: "routine_demo",
        triggerType: "workout.completed",
      },
      target: {
        feature: "habits",
        entityType: "habit",
        entityId: "habit_demo",
        effect: {
          kind: "progress",
          type: "habit.ensure_daily_target",
          minimumCount: "target_per_day",
          dateStrategy: "source_date",
        },
      },
      rawTargetFeature: "habits",
      rawTargetEntityType: "habit",
      rawEffectType: "habit.ensure_daily_target",
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:00.000Z",
      deletedAt: null,
    });

    const row = createLinkedActionEditorRowFromRule({
      rule,
      targetSelection: createLinkedActionTargetExistingSelection(
        { feature: "habits", entityType: "habit" },
        { id: "habit_demo", title: "Evening stretch" },
      ),
    });

    expect(row.mode).toBe("existing");
    expect(row.existingRuleId).toBe("rule_demo");
    expect(row.targetFeature).toBe("habits");
    expect(row.effectType).toBe("habit.ensure_daily_target");
  });

  it("resets target selection and effect when the target feature changes", () => {
    const baseRow = createLinkedActionEditorRowFromRule({
      rule: buildSupportedRule({
        source: {
          feature: "todos",
          entityType: "todo",
          entityId: "todo_demo",
          triggerType: "todo.completed",
        },
        target: {
          feature: "habits",
          entityType: "habit",
          entityId: "habit_demo",
          effect: {
            kind: "progress",
            type: "habit.increment",
            amount: 1,
            dateStrategy: "source_date",
          },
        },
        rawTargetFeature: "habits",
        rawTargetEntityType: "habit",
        rawEffectType: "habit.increment",
      }),
      targetSelection: createLinkedActionTargetExistingSelection(
        { feature: "habits", entityType: "habit" },
        { id: "habit_demo", title: "Drink water" },
      ),
    });

    const nextRow = applyLinkedActionTargetFeature(baseRow, "workout");

    expect(nextRow.targetFeature).toBe("workout");
    expect(nextRow.targetSelection).toBeNull();
    expect(nextRow.effectType).toBeNull();
    expect(getLinkedActionEffectOptions("workout").map((option) => option.value)).toEqual([
      "workout.log",
    ]);
  });

  it("validates missing required editor fields", () => {
    const row = createEmptyLinkedActionEditorRow({
      key: "todo-demo",
      feature: "todos",
      entityType: "todo",
      entityId: "todo_demo",
      label: "Morning checklist",
      description: "Demo source todo",
    });

    const errors = validateLinkedActionEditorRow(row);

    expect(errors.triggerType).toBeDefined();
    expect(errors.targetFeature).toBeDefined();
    expect(errors.targetSelection).toBeDefined();
    expect(errors.effectType).toBeDefined();
    expect(countLinkedActionEditorRowErrors(row)).toBe(4);
  });

  it("creates a save payload with the default effect details for supported rows", () => {
    const row = createLinkedActionEditorRowFromRule({
      rule: buildSupportedRule({
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
            dateStrategy: "source_date",
          },
        },
        rawTargetFeature: "habits",
        rawTargetEntityType: "habit",
        rawEffectType: "habit.ensure_daily_target",
      }),
      targetSelection: createLinkedActionTargetExistingSelection(
        { feature: "habits", entityType: "habit" },
        { id: "habit_target", title: "Evening stretch" },
      ),
    });

    expect(createSaveLinkedActionRuleInputFromEditorRow(row)).toEqual({
      existingRuleId: "rule_demo",
      status: "active",
      directionPolicy: "one_way",
      triggerType: "habit.completed_for_day",
      target: {
        feature: "habits",
        entityType: "habit",
        entityId: "habit_target",
        effect: {
          kind: "progress",
          type: "habit.ensure_daily_target",
          minimumCount: "target_per_day",
          dateStrategy: "source_date",
        },
      },
    });
  });

  it("keeps an existing rule invalid when its target can no longer be resolved", () => {
    const row = createLinkedActionEditorRowFromRule({
      rule: buildSupportedRule({
        source: {
          feature: "todos",
          entityType: "todo",
          entityId: "todo_demo",
          triggerType: "todo.completed",
        },
        target: {
          feature: "habits",
          entityType: "habit",
          entityId: "habit_missing",
          effect: {
            kind: "progress",
            type: "habit.increment",
            amount: 1,
            dateStrategy: "source_date",
          },
        },
        rawTargetFeature: "habits",
        rawTargetEntityType: "habit",
        rawEffectType: "habit.increment",
      }),
      targetSelection: null,
    });

    expect(row.targetSelection).toBeNull();
    expect(row.isOrphaned).toBe(true);
    expect(row.orphanedTarget).toMatchObject({
      feature: "habits",
      entityType: "habit",
      entityId: "habit_missing",
      effectType: "habit.increment",
    });
    expect(validateLinkedActionEditorRow(row).targetSelection).toBe(
      "This linked action points to a deleted or unavailable target. Choose a replacement or remove the rule.",
    );
  });

  it("marks unsupported persisted rows as disabled legacy entries", () => {
    const row = createLinkedActionEditorRowFromRule({
      rule: {
        id: "rule_legacy",
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
          feature: "pomodoro",
          entityType: "pomodoro_session",
          entityId: null,
          effect: {
            kind: "unsupported",
            type: "pomodoro.log",
            rawPayload: "{\"sessionType\":\"focus\"}",
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
      targetSelection: null,
    });

    expect(row.isUnsupported).toBe(true);
    expect(row.unsupportedTarget).toMatchObject({
      feature: "pomodoro",
      entityType: "pomodoro_session",
      effectType: "pomodoro.log",
    });
    expect(validateLinkedActionEditorRow(row).unsupported).toBe(
      "This linked action uses an unsupported target and must be removed or replaced.",
    );
  });

  it("refuses to save unsupported rows", () => {
    const row = createLinkedActionEditorRowFromRule({
      rule: {
        id: "rule_legacy",
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
      targetSelection: null,
    });

    expect(() => createSaveLinkedActionRuleInputFromEditorRow(row)).toThrow(
      "Unsupported linked action rules must be removed or replaced before saving.",
    );
  });

  it("preserves the effect when replacing an orphaned target inside the same feature", () => {
    const orphanedRow = createLinkedActionEditorRowFromRule({
      rule: buildSupportedRule({
        target: {
          feature: "habits",
          entityType: "habit",
          entityId: "habit_missing",
          effect: {
            kind: "progress",
            type: "habit.ensure_daily_target",
            minimumCount: "target_per_day",
            dateStrategy: "source_date",
          },
        },
        rawTargetFeature: "habits",
        rawTargetEntityType: "habit",
        rawEffectType: "habit.ensure_daily_target",
      }),
      targetSelection: null,
    });

    const repairedRow = applyLinkedActionTargetFeature(orphanedRow, "habits");

    expect(repairedRow.isOrphaned).toBe(false);
    expect(repairedRow.orphanedTarget).toBeNull();
    expect(repairedRow.effectType).toBe("habit.ensure_daily_target");
    expect(repairedRow.targetFeature).toBe("habits");
  });
});
