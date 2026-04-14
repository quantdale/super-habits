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
import type { LinkedActionRuleDefinition } from "@/core/linked-actions/linkedActions.types";

describe("linkedActionsEditor.model", () => {
  it("returns the expected trigger options for habits", () => {
    const options = getLinkedActionTriggerOptions("habits");

    expect(options.map((option) => option.value)).toEqual([
      "habit.progress_incremented",
      "habit.completed_for_day",
    ]);
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
    const rule: LinkedActionRuleDefinition = {
      id: "rule_demo",
      status: "active",
      directionPolicy: "one_way",
      bidirectionalGroupId: null,
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
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:00.000Z",
      deletedAt: null,
    };

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
      rule: {
        id: "rule_demo",
        status: "active",
        directionPolicy: "one_way",
        bidirectionalGroupId: null,
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
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        deletedAt: null,
      },
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
      rule: {
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
            type: "habit.ensure_daily_target",
            minimumCount: "target_per_day",
            dateStrategy: "source_date",
          },
        },
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        deletedAt: null,
      },
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
      rule: {
        id: "rule_demo",
        status: "active",
        directionPolicy: "one_way",
        bidirectionalGroupId: null,
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
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        deletedAt: null,
      },
      targetSelection: null,
    });

    expect(row.targetSelection).toBeNull();
    expect(validateLinkedActionEditorRow(row).targetSelection).toBeDefined();
  });
});
