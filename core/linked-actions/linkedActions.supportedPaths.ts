import type {
  LinkedActionEffectType,
  LinkedActionFeature,
  LinkedActionSourceEntityType,
  LinkedActionTargetEntityType,
  LinkedActionTriggerType,
} from '@/core/linked-actions/linkedActions.enums';
import type {
  LinkedActionRuleSource,
  LinkedActionRuleTarget,
} from '@/core/linked-actions/linkedActions.rules.types';

export const LINKED_ACTION_SUPPORTED_RULE_PATHS = [
  {
    sourceFeature: 'todos',
    sourceEntityType: 'todo',
    triggerType: 'todo.completed',
    targetFeature: 'todos',
    targetEntityType: 'todo',
    effectType: 'todo.complete',
  },
  {
    sourceFeature: 'todos',
    sourceEntityType: 'todo',
    triggerType: 'todo.completed',
    targetFeature: 'habits',
    targetEntityType: 'habit',
    effectType: 'habit.increment',
  },
  {
    sourceFeature: 'habits',
    sourceEntityType: 'habit',
    triggerType: 'habit.completed_for_day',
    targetFeature: 'todos',
    targetEntityType: 'todo',
    effectType: 'todo.complete',
  },
  {
    sourceFeature: 'habits',
    sourceEntityType: 'habit',
    triggerType: 'habit.completed_for_day',
    targetFeature: 'habits',
    targetEntityType: 'habit',
    effectType: 'habit.increment',
  },
  {
    sourceFeature: 'habits',
    sourceEntityType: 'habit',
    triggerType: 'habit.completed_for_day',
    targetFeature: 'habits',
    targetEntityType: 'habit',
    effectType: 'habit.ensure_daily_target',
  },
  {
    sourceFeature: 'habits',
    sourceEntityType: 'habit',
    triggerType: 'habit.completed_for_day',
    targetFeature: 'workout',
    targetEntityType: 'workout_routine',
    effectType: 'workout.log',
  },
  {
    sourceFeature: 'todos',
    sourceEntityType: 'todo',
    triggerType: 'todo.completed',
    targetFeature: 'calories',
    targetEntityType: 'calorie_log',
    effectType: 'calorie.log',
  },
  {
    sourceFeature: 'todos',
    sourceEntityType: 'todo',
    triggerType: 'todo.completed',
    targetFeature: 'pomodoro',
    targetEntityType: 'pomodoro_session',
    effectType: 'pomodoro.log',
  },
  {
    sourceFeature: 'habits',
    sourceEntityType: 'habit',
    triggerType: 'habit.completed_for_day',
    targetFeature: 'calories',
    targetEntityType: 'calorie_log',
    effectType: 'calorie.log',
  },
  {
    sourceFeature: 'habits',
    sourceEntityType: 'habit',
    triggerType: 'habit.completed_for_day',
    targetFeature: 'pomodoro',
    targetEntityType: 'pomodoro_session',
    effectType: 'pomodoro.log',
  },
] as const satisfies readonly {
  sourceFeature: LinkedActionFeature;
  sourceEntityType: LinkedActionSourceEntityType;
  triggerType: LinkedActionTriggerType;
  targetFeature: LinkedActionFeature;
  targetEntityType: LinkedActionTargetEntityType;
  effectType: LinkedActionEffectType;
}[];

function uniqueValues<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export const LINKED_ACTION_SUPPORTED_TRIGGER_TYPES = uniqueValues(
  LINKED_ACTION_SUPPORTED_RULE_PATHS.map((path) => path.triggerType),
);

export const LINKED_ACTION_SUPPORTED_TARGET_FEATURES = uniqueValues(
  LINKED_ACTION_SUPPORTED_RULE_PATHS.map((path) => path.targetFeature),
);

export const LINKED_ACTION_SUPPORTED_TARGET_ENTITY_TYPES_BY_FEATURE =
  LINKED_ACTION_SUPPORTED_RULE_PATHS.reduce<
    Partial<Record<LinkedActionFeature, LinkedActionTargetEntityType[]>>
  >((acc, path) => {
    const existing = acc[path.targetFeature] ?? [];
    if (!existing.includes(path.targetEntityType)) {
      existing.push(path.targetEntityType);
    }
    acc[path.targetFeature] = existing;
    return acc;
  }, {});

export const LINKED_ACTION_SUPPORTED_EFFECT_TYPES_BY_TARGET_ENTITY =
  LINKED_ACTION_SUPPORTED_RULE_PATHS.reduce<
    Partial<Record<LinkedActionTargetEntityType, LinkedActionEffectType[]>>
  >((acc, path) => {
    const existing = acc[path.targetEntityType] ?? [];
    if (!existing.includes(path.effectType)) {
      existing.push(path.effectType);
    }
    acc[path.targetEntityType] = existing;
    return acc;
  }, {});

export const LINKED_ACTION_UNSUPPORTED_RULE_MESSAGE =
  'This linked action uses an unsupported target and must be removed or replaced.';

export function isSupportedLinkedActionRulePath(
  source: LinkedActionRuleSource,
  target: LinkedActionRuleTarget,
): boolean {
  return LINKED_ACTION_SUPPORTED_RULE_PATHS.some(
    (path) =>
      path.sourceFeature === source.feature &&
      path.sourceEntityType === source.entityType &&
      path.triggerType === source.triggerType &&
      path.targetFeature === target.feature &&
      path.targetEntityType === target.entityType &&
      path.effectType === target.effect.type,
  );
}

export function getSupportedLinkedActionEffectTypesForPath(input: {
  sourceFeature: LinkedActionFeature;
  sourceEntityType: LinkedActionSourceEntityType;
  triggerType?: LinkedActionTriggerType | null;
  targetFeature: LinkedActionFeature;
  targetEntityType: LinkedActionTargetEntityType;
}): LinkedActionEffectType[] {
  return uniqueValues(
    LINKED_ACTION_SUPPORTED_RULE_PATHS.filter(
      (path) =>
        path.sourceFeature === input.sourceFeature &&
        path.sourceEntityType === input.sourceEntityType &&
        (input.triggerType ? path.triggerType === input.triggerType : true) &&
        path.targetFeature === input.targetFeature &&
        path.targetEntityType === input.targetEntityType,
    ).map((path) => path.effectType),
  );
}
