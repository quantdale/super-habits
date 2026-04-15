import type {
  LinkedActionDirectionPolicy,
  LinkedActionEffectType,
  LinkedActionFeature,
  LinkedActionTargetEntityType,
  LinkedActionTriggerType,
} from "@/core/linked-actions/linkedActions.types";

export const LINKED_ACTION_POLICY_ENGINE_SUPPORT = ["implemented", "deferred"] as const;
export type LinkedActionPolicyEngineSupport =
  (typeof LINKED_ACTION_POLICY_ENGINE_SUPPORT)[number];

export const LINKED_ACTION_POLICY_AUTHORING_SUPPORT = ["visible", "hidden"] as const;
export type LinkedActionPolicyAuthoringSupport =
  (typeof LINKED_ACTION_POLICY_AUTHORING_SUPPORT)[number];

export const LINKED_ACTION_POLICY_PROGRESS_SEMANTICS = [
  "completion_only",
  "progress_capable",
] as const;
export type LinkedActionPolicyProgressSemantics =
  (typeof LINKED_ACTION_POLICY_PROGRESS_SEMANTICS)[number];

export const LINKED_ACTION_POLICY_RETRIGGER = [
  "suppress_linked_action_origin",
  "allow",
] as const;
export type LinkedActionPolicyRetrigger = (typeof LINKED_ACTION_POLICY_RETRIGGER)[number];

type LinkedActionDirectionCapability = {
  oneWay: boolean;
  bidirectionalPeer: boolean;
};

type LinkedActionTriggerPolicy = {
  engineSupport: LinkedActionPolicyEngineSupport;
  authoringSupport: LinkedActionPolicyAuthoringSupport;
  progressSemantics: LinkedActionPolicyProgressSemantics;
  retriggerPolicy: LinkedActionPolicyRetrigger;
  directionSupport: LinkedActionDirectionCapability;
};

type LinkedActionTargetFeaturePolicy = {
  engineSupport: LinkedActionPolicyEngineSupport;
  authoringSupport: LinkedActionPolicyAuthoringSupport;
};

type LinkedActionTargetEntityPolicy = {
  engineSupport: LinkedActionPolicyEngineSupport;
  authoringSupport: LinkedActionPolicyAuthoringSupport;
};

type LinkedActionEffectPolicy = {
  engineSupport: LinkedActionPolicyEngineSupport;
  authoringSupport: LinkedActionPolicyAuthoringSupport;
  progressSemantics: LinkedActionPolicyProgressSemantics;
  retriggerPolicy: LinkedActionPolicyRetrigger;
  directionSupport: LinkedActionDirectionCapability;
};

const LINKED_ACTION_TRIGGER_POLICIES: Record<LinkedActionTriggerType, LinkedActionTriggerPolicy> = {
  "todo.completed": {
    engineSupport: "deferred",
    authoringSupport: "hidden",
    progressSemantics: "completion_only",
    retriggerPolicy: "suppress_linked_action_origin",
    directionSupport: { oneWay: true, bidirectionalPeer: false },
  },
  "habit.progress_incremented": {
    engineSupport: "deferred",
    authoringSupport: "hidden",
    progressSemantics: "progress_capable",
    retriggerPolicy: "suppress_linked_action_origin",
    directionSupport: { oneWay: true, bidirectionalPeer: false },
  },
  "habit.completed_for_day": {
    engineSupport: "implemented",
    authoringSupport: "visible",
    progressSemantics: "completion_only",
    retriggerPolicy: "suppress_linked_action_origin",
    directionSupport: { oneWay: true, bidirectionalPeer: true },
  },
  "calorie.entry_logged": {
    engineSupport: "deferred",
    authoringSupport: "hidden",
    progressSemantics: "completion_only",
    retriggerPolicy: "suppress_linked_action_origin",
    directionSupport: { oneWay: true, bidirectionalPeer: false },
  },
  "workout.completed": {
    engineSupport: "implemented",
    authoringSupport: "hidden",
    progressSemantics: "completion_only",
    retriggerPolicy: "suppress_linked_action_origin",
    directionSupport: { oneWay: true, bidirectionalPeer: true },
  },
  "pomodoro.focus_completed": {
    engineSupport: "implemented",
    authoringSupport: "hidden",
    progressSemantics: "completion_only",
    retriggerPolicy: "suppress_linked_action_origin",
    directionSupport: { oneWay: true, bidirectionalPeer: true },
  },
};

const LINKED_ACTION_TARGET_FEATURE_POLICIES: Record<
  LinkedActionFeature,
  LinkedActionTargetFeaturePolicy
> = {
  todos: { engineSupport: "implemented", authoringSupport: "visible" },
  habits: { engineSupport: "implemented", authoringSupport: "visible" },
  calories: { engineSupport: "deferred", authoringSupport: "hidden" },
  workout: { engineSupport: "implemented", authoringSupport: "visible" },
  pomodoro: { engineSupport: "deferred", authoringSupport: "hidden" },
};

const LINKED_ACTION_TARGET_ENTITY_POLICIES: Record<
  LinkedActionTargetEntityType,
  LinkedActionTargetEntityPolicy
> = {
  todo: { engineSupport: "implemented", authoringSupport: "visible" },
  habit: { engineSupport: "implemented", authoringSupport: "visible" },
  calorie_log: { engineSupport: "deferred", authoringSupport: "hidden" },
  workout_routine: { engineSupport: "implemented", authoringSupport: "visible" },
  pomodoro_session: { engineSupport: "deferred", authoringSupport: "hidden" },
};

const LINKED_ACTION_EFFECT_POLICIES: Record<LinkedActionEffectType, LinkedActionEffectPolicy> = {
  "todo.complete": {
    engineSupport: "implemented",
    authoringSupport: "visible",
    progressSemantics: "completion_only",
    retriggerPolicy: "suppress_linked_action_origin",
    directionSupport: { oneWay: true, bidirectionalPeer: true },
  },
  "habit.increment": {
    engineSupport: "implemented",
    authoringSupport: "visible",
    progressSemantics: "progress_capable",
    retriggerPolicy: "suppress_linked_action_origin",
    directionSupport: { oneWay: true, bidirectionalPeer: true },
  },
  "habit.ensure_daily_target": {
    engineSupport: "implemented",
    authoringSupport: "visible",
    progressSemantics: "progress_capable",
    retriggerPolicy: "suppress_linked_action_origin",
    directionSupport: { oneWay: true, bidirectionalPeer: true },
  },
  "calorie.log": {
    engineSupport: "deferred",
    authoringSupport: "hidden",
    progressSemantics: "completion_only",
    retriggerPolicy: "suppress_linked_action_origin",
    directionSupport: { oneWay: true, bidirectionalPeer: false },
  },
  "workout.log": {
    engineSupport: "implemented",
    authoringSupport: "visible",
    progressSemantics: "completion_only",
    retriggerPolicy: "suppress_linked_action_origin",
    directionSupport: { oneWay: true, bidirectionalPeer: true },
  },
  "pomodoro.log": {
    engineSupport: "deferred",
    authoringSupport: "hidden",
    progressSemantics: "completion_only",
    retriggerPolicy: "suppress_linked_action_origin",
    directionSupport: { oneWay: true, bidirectionalPeer: false },
  },
};

function isSupportedLevel(value: LinkedActionPolicyEngineSupport) {
  return value === "implemented";
}

export function getLinkedActionTriggerPolicy(triggerType: LinkedActionTriggerType) {
  return LINKED_ACTION_TRIGGER_POLICIES[triggerType];
}

export function getLinkedActionTargetFeaturePolicy(feature: LinkedActionFeature) {
  return LINKED_ACTION_TARGET_FEATURE_POLICIES[feature];
}

export function getLinkedActionTargetEntityPolicy(entityType: LinkedActionTargetEntityType) {
  return LINKED_ACTION_TARGET_ENTITY_POLICIES[entityType];
}

export function getLinkedActionEffectPolicy(effectType: LinkedActionEffectType) {
  return LINKED_ACTION_EFFECT_POLICIES[effectType];
}

export function isLinkedActionTriggerEngineSupported(triggerType: LinkedActionTriggerType) {
  return isSupportedLevel(getLinkedActionTriggerPolicy(triggerType).engineSupport);
}

export function isLinkedActionTriggerAuthoringSupported(triggerType: LinkedActionTriggerType) {
  return getLinkedActionTriggerPolicy(triggerType).authoringSupport === "visible";
}

export function isLinkedActionTargetFeatureEngineSupported(feature: LinkedActionFeature) {
  return isSupportedLevel(getLinkedActionTargetFeaturePolicy(feature).engineSupport);
}

export function isLinkedActionTargetFeatureAuthoringSupported(feature: LinkedActionFeature) {
  return getLinkedActionTargetFeaturePolicy(feature).authoringSupport === "visible";
}

export function isLinkedActionTargetEntityEngineSupported(entityType: LinkedActionTargetEntityType) {
  return isSupportedLevel(getLinkedActionTargetEntityPolicy(entityType).engineSupport);
}

export function isLinkedActionTargetEntityAuthoringSupported(
  entityType: LinkedActionTargetEntityType,
) {
  return getLinkedActionTargetEntityPolicy(entityType).authoringSupport === "visible";
}

export function isLinkedActionEffectEngineSupported(effectType: LinkedActionEffectType) {
  return isSupportedLevel(getLinkedActionEffectPolicy(effectType).engineSupport);
}

export function isLinkedActionEffectAuthoringSupported(effectType: LinkedActionEffectType) {
  return getLinkedActionEffectPolicy(effectType).authoringSupport === "visible";
}

export function supportsLinkedActionDirectionPolicy(input: {
  directionPolicy: LinkedActionDirectionPolicy;
  triggerType: LinkedActionTriggerType;
  effectType: LinkedActionEffectType;
}) {
  const triggerPolicy = getLinkedActionTriggerPolicy(input.triggerType);
  const effectPolicy = getLinkedActionEffectPolicy(input.effectType);

  if (input.directionPolicy === "one_way") {
    return triggerPolicy.directionSupport.oneWay && effectPolicy.directionSupport.oneWay;
  }

  return (
    triggerPolicy.directionSupport.bidirectionalPeer &&
    effectPolicy.directionSupport.bidirectionalPeer &&
    triggerPolicy.retriggerPolicy === "suppress_linked_action_origin" &&
    effectPolicy.retriggerPolicy === "suppress_linked_action_origin"
  );
}

export const LINKED_ACTION_SUPPORTED_TRIGGER_TYPES = Object.entries(
  LINKED_ACTION_TRIGGER_POLICIES,
)
  .filter(([, policy]) => policy.authoringSupport === "visible")
  .map(([triggerType]) => triggerType as LinkedActionTriggerType);

export const LINKED_ACTION_SUPPORTED_TARGET_FEATURES = Object.entries(
  LINKED_ACTION_TARGET_FEATURE_POLICIES,
)
  .filter(([, policy]) => policy.authoringSupport === "visible")
  .map(([feature]) => feature as LinkedActionFeature);

export const LINKED_ACTION_SUPPORTED_TARGET_ENTITY_TYPES_BY_FEATURE: Partial<
  Record<LinkedActionFeature, readonly LinkedActionTargetEntityType[]>
> = {
  todos: ["todo"],
  habits: ["habit"],
  workout: ["workout_routine"],
};

export const LINKED_ACTION_SUPPORTED_EFFECT_TYPES_BY_TARGET_ENTITY: Partial<
  Record<LinkedActionTargetEntityType, readonly LinkedActionEffectType[]>
> = {
  todo: ["todo.complete"],
  habit: ["habit.increment", "habit.ensure_daily_target"],
  workout_routine: ["workout.log"],
};
