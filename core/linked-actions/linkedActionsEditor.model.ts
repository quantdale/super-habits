import {
  LINKED_ACTION_UNSUPPORTED_RULE_MESSAGE,
  LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY,
  LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE,
  LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE,
  LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY,
  getSupportedLinkedActionEffectTypesForPath,
  isSupportedLinkedActionEffect,
  isSupportedLinkedActionTargetFeature,
  isSupportedLinkedActionTriggerType,
  type LinkedActionEffectType,
  type LinkedActionFeature,
  type LinkedActionRuleTarget,
  type SaveLinkedActionRuleForSourceInput,
  type LinkedActionSourceEntityType,
  type LinkedActionTargetEntityType,
  type LinkedActionTriggerType,
} from '@/core/linked-actions/linkedActions.types';
import type {
  LinkedActionEditorRowDraft,
  LinkedActionEditorRowValidation,
  LinkedActionEditorSourceOption,
  LinkedActionExistingRuleAdapterInput,
} from '@/core/linked-actions/linkedActionsEditor.types';

let rowCounter = 0;

const LINKED_ACTION_ORPHANED_RULE_MESSAGE =
  'This linked action points to a deleted or unavailable target. Choose a replacement or remove the rule.';

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
    case 'todos':
      return 'Todos';
    case 'habits':
      return 'Habits';
    case 'calories':
      return 'Calories';
    case 'workout':
      return 'Workout';
    case 'pomodoro':
      return 'Pomodoro';
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
    case 'todo.completed':
      return 'Task completed';
    case 'habit.progress_incremented':
      return 'Habit incremented';
    case 'habit.completed_for_day':
      return 'Habit completed for the day';
    case 'calorie.entry_logged':
      return 'Calorie entry logged';
    case 'workout.completed':
      return 'Workout completed';
    case 'pomodoro.focus_completed':
      return 'Focus session completed';
  }
}

export function getLinkedActionEffectLabel(effectType: LinkedActionEffectType) {
  switch (effectType) {
    case 'todo.complete':
      return 'Complete target task';
    case 'habit.increment':
      return 'Increment target habit';
    case 'habit.ensure_daily_target':
      return 'Ensure daily habit target';
    case 'calorie.log':
      return 'Log calorie entry';
    case 'workout.log':
      return 'Log workout completion';
    case 'pomodoro.log':
      return 'Log pomodoro session';
  }
}

export function getLinkedActionEffectDescription(effectType: LinkedActionEffectType) {
  switch (effectType) {
    case 'todo.complete':
      return 'Marks the selected task complete if it is still pending.';
    case 'habit.increment':
      return 'Adds one completion to the selected habit using the source event date.';
    case 'habit.ensure_daily_target':
      return 'Brings the selected habit up to its daily target for the source date.';
    case 'calorie.log':
      return "Creates a new calorie entry from this rule's inline template each time it fires.";
    case 'workout.log':
      return 'Creates a workout completion log for the selected routine.';
    case 'pomodoro.log':
      return "Creates a focus session log with the rule's duration each time it fires.";
  }
}

export function getLinkedActionTriggerOptions(
  feature: LinkedActionFeature,
): LinkedActionOption<LinkedActionTriggerType>[] {
  const entityType = getLinkedActionSourceEntityTypeForFeature(feature);
  return LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY[entityType]
    .filter((triggerType) => isSupportedLinkedActionTriggerType(triggerType))
    .map((triggerType) => ({
      value: triggerType,
      label: getLinkedActionTriggerLabel(triggerType),
      description:
        triggerType === 'habit.completed_for_day'
          ? 'Fires when the selected habit reaches its target for the day.'
          : `Fires when ${getLinkedActionTriggerLabel(triggerType).toLowerCase()}.`,
    }));
}

export function getLinkedActionEffectOptions(
  feature: LinkedActionFeature,
): LinkedActionOption<LinkedActionEffectType>[] {
  if (!isSupportedLinkedActionTargetFeature(feature)) {
    return [];
  }

  const entityType = getLinkedActionTargetEntityTypeForFeature(feature);
  return LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY[entityType]
    .filter((effectType) => isSupportedLinkedActionEffect(entityType, effectType))
    .map((effectType) => ({
      value: effectType,
      label: getLinkedActionEffectLabel(effectType),
      description: getLinkedActionEffectDescription(effectType),
    }));
}

export function getLinkedActionEffectOptionsForSource(input: {
  sourceFeature: LinkedActionFeature;
  sourceEntityType: LinkedActionSourceEntityType;
  triggerType: LinkedActionTriggerType | null;
  targetFeature: LinkedActionFeature;
}): LinkedActionOption<LinkedActionEffectType>[] {
  if (!isSupportedLinkedActionTargetFeature(input.targetFeature)) {
    return [];
  }

  const targetEntityType = getLinkedActionTargetEntityTypeForFeature(input.targetFeature);
  const supportedEffectTypes = getSupportedLinkedActionEffectTypesForPath({
    sourceFeature: input.sourceFeature,
    sourceEntityType: input.sourceEntityType,
    triggerType: input.triggerType,
    targetFeature: input.targetFeature,
    targetEntityType,
  });

  return LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY[targetEntityType]
    .filter((effectType) => isSupportedLinkedActionEffect(targetEntityType, effectType))
    .filter((effectType) => supportedEffectTypes.includes(effectType))
    .map((effectType) => ({
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
    mode: 'draft',
    existingRuleId: null,
    status: 'active',
    directionPolicy: 'one_way',
    sourceFeature: source.feature,
    sourceEntityType: source.entityType,
    sourceEntityId: source.entityId,
    triggerType: null,
    targetFeature: null,
    targetEntityType: null,
    targetSelection: null,
    effectType: null,
    calorieLogParams: null,
    pomodoroLogParams: null,
    isUnsupported: false,
    unsupportedTarget: null,
    isOrphaned: false,
    orphanedTarget: null,
  };
}

/** Effects that create a fresh row instead of targeting an existing item. */
const PRODUCE_NEW_EFFECT_TYPES: readonly LinkedActionEffectType[] = ['calorie.log', 'pomodoro.log'];

export function isProduceNewLinkedActionEffect(effectType: LinkedActionEffectType | null) {
  return effectType !== null && PRODUCE_NEW_EFFECT_TYPES.includes(effectType);
}

function parseIntegerInRange(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function createLinkedActionEditorRowFromRule(
  input: LinkedActionExistingRuleAdapterInput,
): LinkedActionEditorRowDraft {
  if (input.rule.isUnsupported) {
    return {
      id: nextEditorRowId(),
      mode: 'existing',
      existingRuleId: input.rule.id,
      status: input.rule.status,
      directionPolicy: input.rule.directionPolicy,
      sourceFeature: input.rule.source.feature,
      sourceEntityType: input.rule.source.entityType,
      sourceEntityId: input.rule.source.entityId ?? '',
      triggerType: input.rule.source.triggerType,
      targetFeature: null,
      targetEntityType: null,
      targetSelection: null,
      effectType: null,
      calorieLogParams: null,
      pomodoroLogParams: null,
      isUnsupported: true,
      unsupportedTarget: {
        feature: input.rule.rawTargetFeature,
        entityType: input.rule.rawTargetEntityType,
        effectType: input.rule.rawEffectType,
        message: LINKED_ACTION_UNSUPPORTED_RULE_MESSAGE,
      },
      isOrphaned: false,
      orphanedTarget: null,
    };
  }

  const isOrphaned =
    !isProduceNewLinkedActionEffect(input.rule.target.effect.type) &&
    input.targetSelection?.kind !== 'existing';

  const ruleEffect = input.rule.target.effect;
  const calorieLogParams =
    ruleEffect.type === 'calorie.log'
      ? {
          foodName: ruleEffect.foodName,
          calories: String(ruleEffect.calories),
          mealType: ruleEffect.mealType,
        }
      : null;
  const pomodoroLogParams =
    ruleEffect.type === 'pomodoro.log'
      ? { focusMinutes: String(Math.max(1, Math.round(ruleEffect.durationSeconds / 60))) }
      : null;

  return {
    id: nextEditorRowId(),
    mode: 'existing',
    existingRuleId: input.rule.id,
    status: input.rule.status,
    directionPolicy: input.rule.directionPolicy,
    sourceFeature: input.rule.source.feature,
    sourceEntityType: input.rule.source.entityType,
    sourceEntityId: input.rule.source.entityId ?? '',
    triggerType: input.rule.source.triggerType,
    targetFeature: input.rule.target.feature,
    targetEntityType: input.rule.target.entityType,
    targetSelection: input.targetSelection,
    effectType: input.rule.target.effect.type,
    calorieLogParams,
    pomodoroLogParams,
    isUnsupported: false,
    unsupportedTarget: null,
    isOrphaned,
    orphanedTarget: isOrphaned
      ? {
          feature: input.rule.rawTargetFeature,
          entityType: input.rule.rawTargetEntityType,
          entityId: input.rule.target.entityId,
          effectType: input.rule.rawEffectType,
          message: LINKED_ACTION_ORPHANED_RULE_MESSAGE,
        }
      : null,
  };
}

function buildLinkedActionRuleTargetFromEditorRow(
  row: LinkedActionEditorRowDraft,
): LinkedActionRuleTarget {
  if (row.isUnsupported) {
    throw new Error('Unsupported linked action rules must be removed or replaced before saving.');
  }
  if (row.isOrphaned && row.targetSelection?.kind !== 'existing') {
    throw new Error(LINKED_ACTION_ORPHANED_RULE_MESSAGE);
  }

  if (!row.targetFeature || !row.targetEntityType || !row.effectType) {
    throw new Error('Linked action row is missing a target feature, entity, or effect.');
  }

  if (row.effectType === 'calorie.log') {
    const params = row.calorieLogParams;
    if (!params) {
      throw new Error('Add the calorie entry template before saving this linked action.');
    }
    const foodName = params.foodName.trim();
    const calories = parseIntegerInRange(params.calories, 1, 10000);
    if (!foodName || foodName.length > 120) {
      throw new Error('Add a food name (max 120 characters) for the calorie entry.');
    }
    if (calories === null) {
      throw new Error('Enter calories as a whole number between 1 and 10000.');
    }
    return {
      feature: row.targetFeature,
      entityType: row.targetEntityType,
      entityId: null,
      effect: {
        kind: 'log',
        type: 'calorie.log',
        dateStrategy: 'today',
        templateSource: 'inline',
        savedMealId: null,
        foodName,
        calories,
        protein: 0,
        carbs: 0,
        fats: 0,
        fiber: 0,
        mealType: params.mealType,
      },
    };
  }

  if (row.effectType === 'pomodoro.log') {
    const focusMinutes = row.pomodoroLogParams
      ? parseIntegerInRange(row.pomodoroLogParams.focusMinutes, 1, 240)
      : null;
    if (focusMinutes === null) {
      throw new Error('Enter focus minutes as a whole number between 1 and 240.');
    }
    return {
      feature: row.targetFeature,
      entityType: row.targetEntityType,
      entityId: null,
      effect: {
        kind: 'log',
        type: 'pomodoro.log',
        sessionType: 'focus',
        durationSeconds: focusMinutes * 60,
      },
    };
  }

  if (row.targetSelection?.kind !== 'existing') {
    throw new Error('Choose an existing target item before saving this linked action.');
  }

  switch (row.effectType) {
    case 'todo.complete':
      return {
        feature: row.targetFeature,
        entityType: row.targetEntityType,
        entityId: row.targetSelection.candidate.id,
        effect: {
          kind: 'binary',
          type: 'todo.complete',
        },
      };
    case 'habit.increment':
      return {
        feature: row.targetFeature,
        entityType: row.targetEntityType,
        entityId: row.targetSelection.candidate.id,
        effect: {
          kind: 'progress',
          type: 'habit.increment',
          amount: 1,
          dateStrategy: 'source_date',
        },
      };
    case 'habit.ensure_daily_target':
      return {
        feature: row.targetFeature,
        entityType: row.targetEntityType,
        entityId: row.targetSelection.candidate.id,
        effect: {
          kind: 'progress',
          type: 'habit.ensure_daily_target',
          minimumCount: 'target_per_day',
          dateStrategy: 'source_date',
        },
      };
    case 'workout.log':
      return {
        feature: row.targetFeature,
        entityType: row.targetEntityType,
        entityId: row.targetSelection.candidate.id,
        effect: {
          kind: 'log',
          type: 'workout.log',
          notes: null,
        },
      };
    default:
      throw new Error('This effect is not supported in this editor yet.');
  }
}

export function createSaveLinkedActionRuleInputFromEditorRow(
  row: LinkedActionEditorRowDraft,
): SaveLinkedActionRuleForSourceInput {
  if (row.isUnsupported) {
    throw new Error('Unsupported linked action rules must be removed or replaced before saving.');
  }
  if (row.isOrphaned && row.targetSelection?.kind !== 'existing') {
    throw new Error(LINKED_ACTION_ORPHANED_RULE_MESSAGE);
  }

  if (!row.triggerType) {
    throw new Error('Select a trigger before saving this linked action.');
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
  const targetFeatureChanged = row.targetFeature !== targetFeature;
  return {
    ...row,
    targetFeature,
    targetEntityType: getLinkedActionTargetEntityTypeForFeature(targetFeature),
    targetSelection: targetFeatureChanged ? null : row.targetSelection,
    effectType: targetFeatureChanged ? null : row.effectType,
    calorieLogParams: targetFeatureChanged ? null : row.calorieLogParams,
    pomodoroLogParams: targetFeatureChanged ? null : row.pomodoroLogParams,
    isUnsupported: false,
    unsupportedTarget: null,
    isOrphaned: false,
    orphanedTarget: null,
  };
}

/** Selecting an effect initializes inline parameters for produce-new effects. */
export function applyLinkedActionEffectType(
  row: LinkedActionEditorRowDraft,
  effectType: LinkedActionEffectType,
): LinkedActionEditorRowDraft {
  return {
    ...row,
    effectType,
    calorieLogParams:
      effectType === 'calorie.log'
        ? (row.calorieLogParams ?? { foodName: '', calories: '', mealType: 'snack' })
        : null,
    pomodoroLogParams:
      effectType === 'pomodoro.log' ? (row.pomodoroLogParams ?? { focusMinutes: '25' }) : null,
  };
}

export function validateLinkedActionEditorRow(
  row: LinkedActionEditorRowDraft,
): LinkedActionEditorRowValidation {
  const errors: LinkedActionEditorRowValidation = {};

  if (row.isUnsupported) {
    errors.unsupported = LINKED_ACTION_UNSUPPORTED_RULE_MESSAGE;
    return errors;
  }

  if (!row.triggerType) {
    errors.triggerType = 'Select a trigger.';
  }
  if (!row.targetFeature) {
    errors.targetFeature = 'Select a target feature.';
  }
  const produceNewEffect = isProduceNewLinkedActionEffect(row.effectType);
  if (!produceNewEffect && !row.targetSelection) {
    errors.targetSelection = row.isOrphaned
      ? LINKED_ACTION_ORPHANED_RULE_MESSAGE
      : 'Choose an existing target item or an explicit create-new handoff.';
  }
  if (!row.effectType) {
    errors.effectType = 'Select an effect.';
  }
  if (row.effectType === 'calorie.log') {
    const params = row.calorieLogParams;
    const foodName = params?.foodName.trim() ?? '';
    if (!foodName || foodName.length > 120) {
      errors.calorieParams = 'Add a food name (max 120 characters).';
    } else if (
      !params ||
      !/^\d+$/.test(params.calories.trim()) ||
      Number(params.calories.trim()) < 1 ||
      Number(params.calories.trim()) > 10000
    ) {
      errors.calorieParams = 'Enter calories as a whole number between 1 and 10000.';
    }
  }
  if (row.effectType === 'pomodoro.log') {
    const raw = row.pomodoroLogParams?.focusMinutes.trim() ?? '';
    if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 240) {
      errors.pomodoroParams = 'Enter focus minutes as a whole number between 1 and 240.';
    }
  }

  return errors;
}

export function countLinkedActionEditorRowErrors(row: LinkedActionEditorRowDraft) {
  return Object.keys(validateLinkedActionEditorRow(row)).length;
}
