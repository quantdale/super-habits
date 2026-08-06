import {
  LINKED_ACTION_DIRECTION_POLICIES,
  LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY,
  LINKED_ACTION_EXECUTION_STATUSES,
  LINKED_ACTION_FEATURES,
  LINKED_ACTION_RULE_STATUSES,
  LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE,
  LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE,
  LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY,
} from '@/core/linked-actions/linkedActions.enums';
import type {
  LinkedActionDirectionPolicy,
  LinkedActionEffectType,
  LinkedActionExecutionStatus,
  LinkedActionFeature,
  LinkedActionRuleStatus,
  LinkedActionSourceEntityType,
  LinkedActionTargetEntityType,
  LinkedActionTriggerType,
} from '@/core/linked-actions/linkedActions.enums';
import {
  LINKED_ACTION_SUPPORTED_EFFECT_TYPES_BY_TARGET_ENTITY,
  LINKED_ACTION_SUPPORTED_TARGET_ENTITY_TYPES_BY_FEATURE,
  LINKED_ACTION_SUPPORTED_TARGET_FEATURES,
  LINKED_ACTION_SUPPORTED_TRIGGER_TYPES,
} from '@/core/linked-actions/linkedActions.supportedPaths';
import type {
  LinkedActionRuleDefinition,
  LinkedActionSupportedRuleDefinition,
} from '@/core/linked-actions/linkedActions.rules.types';

function objectValues<T extends Record<string, readonly string[]>>(record: T) {
  return Object.values(record) as T[keyof T][];
}

function isStringArrayMember<T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value);
}

function flattenConstArrays<T extends Record<string, readonly string[]>>(
  record: T,
): T[keyof T][number][] {
  return objectValues(record).flatMap((value) => [...value]);
}

const ALL_LINKED_ACTION_SOURCE_ENTITY_TYPES = flattenConstArrays(
  LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE,
);
const ALL_LINKED_ACTION_TARGET_ENTITY_TYPES = flattenConstArrays(
  LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE,
);
const ALL_LINKED_ACTION_TRIGGER_TYPES = flattenConstArrays(
  LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY,
);
const ALL_LINKED_ACTION_EFFECT_TYPES = flattenConstArrays(
  LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY,
);
const ALL_LINKED_ACTION_SUPPORTED_EFFECT_TYPES = Object.values(
  LINKED_ACTION_SUPPORTED_EFFECT_TYPES_BY_TARGET_ENTITY,
).flatMap((value) => (value ? [...value] : []));

export function isLinkedActionRuleStatus(value: string): value is LinkedActionRuleStatus {
  return isStringArrayMember(LINKED_ACTION_RULE_STATUSES, value);
}

export function isLinkedActionDirectionPolicy(value: string): value is LinkedActionDirectionPolicy {
  return isStringArrayMember(LINKED_ACTION_DIRECTION_POLICIES, value);
}

export function isLinkedActionFeature(value: string): value is LinkedActionFeature {
  return isStringArrayMember(LINKED_ACTION_FEATURES, value);
}

export function isLinkedActionSourceEntityType(
  value: string,
): value is LinkedActionSourceEntityType {
  return ALL_LINKED_ACTION_SOURCE_ENTITY_TYPES.includes(value as LinkedActionSourceEntityType);
}

export function isLinkedActionTargetEntityType(
  value: string,
): value is LinkedActionTargetEntityType {
  return ALL_LINKED_ACTION_TARGET_ENTITY_TYPES.includes(value as LinkedActionTargetEntityType);
}

export function isLinkedActionTriggerType(value: string): value is LinkedActionTriggerType {
  return ALL_LINKED_ACTION_TRIGGER_TYPES.includes(value as LinkedActionTriggerType);
}

export function isLinkedActionEffectType(value: string): value is LinkedActionEffectType {
  return ALL_LINKED_ACTION_EFFECT_TYPES.includes(value as LinkedActionEffectType);
}

export function isSupportedLinkedActionTriggerType(
  value: string,
): value is LinkedActionTriggerType {
  return (LINKED_ACTION_SUPPORTED_TRIGGER_TYPES as readonly string[]).includes(value);
}

export function isSupportedLinkedActionTargetFeature(value: string): value is LinkedActionFeature {
  return (LINKED_ACTION_SUPPORTED_TARGET_FEATURES as readonly string[]).includes(value);
}

export function isAllowedLinkedActionSourceEntity(
  feature: LinkedActionFeature,
  entityType: LinkedActionSourceEntityType,
): boolean {
  return LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE[feature].includes(entityType as never);
}

export function isAllowedLinkedActionTargetEntity(
  feature: LinkedActionFeature,
  entityType: LinkedActionTargetEntityType,
): boolean {
  return LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE[feature].includes(entityType as never);
}

export function isAllowedLinkedActionTrigger(
  entityType: LinkedActionSourceEntityType,
  triggerType: LinkedActionTriggerType,
): boolean {
  return LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY[entityType].includes(triggerType as never);
}

export function isAllowedLinkedActionEffect(
  entityType: LinkedActionTargetEntityType,
  effectType: LinkedActionEffectType,
): boolean {
  return LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY[entityType].includes(effectType as never);
}

export function isSupportedLinkedActionTargetEntity(
  feature: LinkedActionFeature,
  entityType: LinkedActionTargetEntityType,
): boolean {
  if (!isSupportedLinkedActionTargetFeature(feature)) {
    return false;
  }

  const supportedEntityTypes = LINKED_ACTION_SUPPORTED_TARGET_ENTITY_TYPES_BY_FEATURE[feature];

  return supportedEntityTypes?.includes(entityType) ?? false;
}

export function isSupportedLinkedActionEffect(
  entityType: LinkedActionTargetEntityType,
  effectType: LinkedActionEffectType,
): boolean {
  if (!(ALL_LINKED_ACTION_SUPPORTED_EFFECT_TYPES as readonly string[]).includes(effectType)) {
    return false;
  }

  const supportedEffectTypes = LINKED_ACTION_SUPPORTED_EFFECT_TYPES_BY_TARGET_ENTITY[entityType];

  return supportedEffectTypes?.includes(effectType) ?? false;
}

export function isSupportedLinkedActionRule(
  rule: LinkedActionRuleDefinition,
): rule is LinkedActionSupportedRuleDefinition {
  return !rule.isUnsupported;
}

export function isLinkedActionExecutionStatus(value: string): value is LinkedActionExecutionStatus {
  return isStringArrayMember(LINKED_ACTION_EXECUTION_STATUSES, value);
}
