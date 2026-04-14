import {
  LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY,
  LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE,
  LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE,
  LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY,
  type LinkedActionEffectType,
  type LinkedActionFeature,
  type LinkedActionRuleTarget,
  type SaveLinkedActionRuleForSourceInput,
  type LinkedActionSourceEntityType,
  type LinkedActionTargetEntityType,
  type LinkedActionTriggerType,
} from "@/core/linked-actions/linkedActions.types";
import type {
  LinkedActionEditorRowDraft,
  LinkedActionEditorRowValidation,
  LinkedActionEditorSourceOption,
  LinkedActionExistingRuleAdapterInput,
} from "@/core/linked-actions/linkedActionsEditor.types";

let rowCounter = 0;

type LinkedActionOption<TValue extends string> = {
  value: TValue;
  label: string;
  description: string;
};

function nextEditorRowId() {
  rowCounter += 1;
  return `linked_action_editor_row_${rowCounter}`;
}

export function getLinkedActionFeatureLabel(feature: LinkedActionFeature) {
  switch (feature) {
    case "todos":
      return "Todos";
    case "habits":
      return "Habits";
    case "calories":
      return "Calories";
    case "workout":
      return "Workout";
    case "pomodoro":
      return "Pomodoro";
  }
}

export function getLinkedActionSourceEntityTypeForFeature(
  feature: LinkedActionFeature,
): LinkedActionSourceEntityType {
  return LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE[feature][0];
}

export function getLinkedActionTargetEntityTypeForFeature(
  feature: LinkedActionFeature,
): LinkedActionTargetEntityType {
  return LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE[feature][0];
}

export function getLinkedActionTriggerLabel(triggerType: LinkedActionTriggerType) {
  switch (triggerType) {
    case "todo.completed":
      return "Task completed";
    case "habit.progress_incremented":
      return "Habit incremented";
    case "habit.completed_for_day":
      return "Habit completed for the day";
    case "calorie.entry_logged":
      return "Calorie entry logged";
    case "workout.completed":
      return "Workout completed";
    case "pomodoro.focus_completed":
      return "Focus session completed";
  }
}

export function getLinkedActionEffectLabel(effectType: LinkedActionEffectType) {
  switch (effectType) {
    case "todo.complete":
      return "Complete target task";
    case "habit.increment":
      return "Increment target habit";
    case "habit.ensure_daily_target":
      return "Ensure daily habit target";
    case "calorie.log":
      return "Log calorie entry";
    case "workout.log":
      return "Log workout completion";
    case "pomodoro.log":
      return "Log pomodoro session";
  }
}

export function getLinkedActionEffectDescription(effectType: LinkedActionEffectType) {
  switch (effectType) {
    case "todo.complete":
      return "Marks the selected task complete if it is still pending.";
    case "habit.increment":
      return "Adds one completion to the selected habit using the source event date.";
    case "habit.ensure_daily_target":
      return "Brings the selected habit up to its daily target for the source date.";
    case "calorie.log":
      return "Creates a new calorie log entry. Detailed field editing stays deferred from this scaffold.";
    case "workout.log":
      return "Creates a workout completion log for the selected routine.";
    case "pomodoro.log":
      return "Creates a pomodoro session log. Session template editing stays deferred from this scaffold.";
  }
}

export function getLinkedActionTriggerOptions(
  feature: LinkedActionFeature,
): Array<LinkedActionOption<LinkedActionTriggerType>> {
  const entityType = getLinkedActionSourceEntityTypeForFeature(feature);
  return LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY[entityType].map((triggerType) => ({
    value: triggerType,
    label: getLinkedActionTriggerLabel(triggerType),
    description:
      triggerType === "habit.completed_for_day"
        ? "Fires when the selected habit reaches its target for the day."
        : triggerType === "habit.progress_incremented"
          ? "Fires on every successful increment."
          : `Fires when ${getLinkedActionTriggerLabel(triggerType).toLowerCase()}.`,
  }));
}

export function getLinkedActionEffectOptions(
  feature: LinkedActionFeature,
): Array<LinkedActionOption<LinkedActionEffectType>> {
  const entityType = getLinkedActionTargetEntityTypeForFeature(feature);
  return LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY[entityType].map((effectType) => ({
    value: effectType,
    label: getLinkedActionEffectLabel(effectType),
    description: getLinkedActionEffectDescription(effectType),
  }));
}

export function createEmptyLinkedActionEditorRow(
  source: LinkedActionEditorSourceOption,
): LinkedActionEditorRowDraft {
  return {
    id: nextEditorRowId(),
    mode: "draft",
    existingRuleId: null,
    status: "active",
    directionPolicy: "one_way",
    sourceFeature: source.feature,
    sourceEntityType: source.entityType,
    sourceEntityId: source.entityId,
    triggerType: null,
    targetFeature: null,
    targetEntityType: null,
    targetSelection: null,
    effectType: null,
  };
}

export function createLinkedActionEditorRowFromRule(
  input: LinkedActionExistingRuleAdapterInput,
): LinkedActionEditorRowDraft {
  return {
    id: nextEditorRowId(),
    mode: "existing",
    existingRuleId: input.rule.id,
    status: input.rule.status,
    directionPolicy: input.rule.directionPolicy,
    sourceFeature: input.rule.source.feature,
    sourceEntityType: input.rule.source.entityType,
    sourceEntityId: input.rule.source.entityId ?? "",
    triggerType: input.rule.source.triggerType,
    targetFeature: input.rule.target.feature,
    targetEntityType: input.rule.target.entityType,
    targetSelection: input.targetSelection,
    effectType: input.rule.target.effect.type,
  };
}

function buildLinkedActionRuleTargetFromEditorRow(
  row: LinkedActionEditorRowDraft,
): LinkedActionRuleTarget {
  if (!row.targetFeature || !row.targetEntityType || !row.effectType) {
    throw new Error("Linked action row is missing a target feature, entity, or effect.");
  }

  if (row.targetSelection?.kind !== "existing") {
    throw new Error("Choose an existing target item before saving this linked action.");
  }

  switch (row.effectType) {
    case "todo.complete":
      return {
        feature: row.targetFeature,
        entityType: row.targetEntityType,
        entityId: row.targetSelection.candidate.id,
        effect: {
          kind: "binary",
          type: "todo.complete",
        },
      };
    case "habit.increment":
      return {
        feature: row.targetFeature,
        entityType: row.targetEntityType,
        entityId: row.targetSelection.candidate.id,
        effect: {
          kind: "progress",
          type: "habit.increment",
          amount: 1,
          dateStrategy: "source_date",
        },
      };
    case "habit.ensure_daily_target":
      return {
        feature: row.targetFeature,
        entityType: row.targetEntityType,
        entityId: row.targetSelection.candidate.id,
        effect: {
          kind: "progress",
          type: "habit.ensure_daily_target",
          minimumCount: "target_per_day",
          dateStrategy: "source_date",
        },
      };
    case "workout.log":
      return {
        feature: row.targetFeature,
        entityType: row.targetEntityType,
        entityId: row.targetSelection.candidate.id,
        effect: {
          kind: "log",
          type: "workout.log",
          notes: null,
        },
      };
    default:
      throw new Error(`The ${row.effectType} effect is not supported in this editor yet.`);
  }
}

export function createSaveLinkedActionRuleInputFromEditorRow(
  row: LinkedActionEditorRowDraft,
): SaveLinkedActionRuleForSourceInput {
  if (!row.triggerType) {
    throw new Error("Select a trigger before saving this linked action.");
  }

  return {
    existingRuleId: row.existingRuleId,
    status: row.status,
    directionPolicy: row.directionPolicy,
    triggerType: row.triggerType,
    target: buildLinkedActionRuleTargetFromEditorRow(row),
  };
}

export function applyLinkedActionTargetFeature(
  row: LinkedActionEditorRowDraft,
  targetFeature: LinkedActionFeature,
): LinkedActionEditorRowDraft {
  return {
    ...row,
    targetFeature,
    targetEntityType: getLinkedActionTargetEntityTypeForFeature(targetFeature),
    targetSelection: null,
    effectType: null,
  };
}

export function validateLinkedActionEditorRow(
  row: LinkedActionEditorRowDraft,
): LinkedActionEditorRowValidation {
  const errors: LinkedActionEditorRowValidation = {};

  if (!row.triggerType) {
    errors.triggerType = "Select a trigger.";
  }
  if (!row.targetFeature) {
    errors.targetFeature = "Select a target feature.";
  }
  if (!row.targetSelection) {
    errors.targetSelection = "Choose an existing target item or an explicit create-new handoff.";
  }
  if (!row.effectType) {
    errors.effectType = "Select an effect.";
  }

  return errors;
}

export function countLinkedActionEditorRowErrors(row: LinkedActionEditorRowDraft) {
  return Object.keys(validateLinkedActionEditorRow(row)).length;
}
