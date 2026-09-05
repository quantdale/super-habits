// Honest capability labels for the Linked Actions surfaces. Execution gating
// itself is the rule-path whitelist in linkedActions.supportedPaths.ts; this
// table describes each component for editors and diagnostics and MUST stay
// consistent with it (enforced by tests/linkedActionsPolicy.test.ts).
import type {
  LinkedActionDirectionPolicy,
  LinkedActionEffectType,
  LinkedActionFeature,
  LinkedActionTargetEntityType,
  LinkedActionTriggerType,
} from '@/core/linked-actions/linkedActions.types';

export const LINKED_ACTION_POLICY_ENGINE_SUPPORT = ['implemented', 'deferred'] as const;
export type LinkedActionPolicyEngineSupport = (typeof LINKED_ACTION_POLICY_ENGINE_SUPPORT)[number];

export const LINKED_ACTION_POLICY_AUTHORING_SUPPORT = ['visible', 'hidden'] as const;
export type LinkedActionPolicyAuthoringSupport =
  (typeof LINKED_ACTION_POLICY_AUTHORING_SUPPORT)[number];

export const LINKED_ACTION_POLICY_PROGRESS_SEMANTICS = [
  'completion_only',
  'progress_capable',
] as const;
export type LinkedActionPolicyProgressSemantics =
  (typeof LINKED_ACTION_POLICY_PROGRESS_SEMANTICS)[number];

export const LINKED_ACTION_POLICY_RETRIGGER = ['suppress_linked_action_origin', 'allow'] as const;
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
  'todo.completed': {
    engineSupport: 'implemented',
    authoringSupport: 'visible',
    progressSemantics: 'completion_only',
    retriggerPolicy: 'suppress_linked_action_origin',
    directionSupport: { oneWay: true, bidirectionalPeer: false },
  },
  'habit.progress_incremented': {
    engineSupport: 'deferred',
    authoringSupport: 'hidden',
    progressSemantics: 'progress_capable',
    retriggerPolicy: 'suppress_linked_action_origin',
    directionSupport: { oneWay: true, bidirectionalPeer: false },
  },
  'habit.completed_for_day': {
    engineSupport: 'implemented',
    authoringSupport: 'visible',
    progressSemantics: 'completion_only',
    retriggerPolicy: 'suppress_linked_action_origin',
    directionSupport: { oneWay: true, bidirectionalPeer: true },
  },
  // Wave 6 audit (Functional Completion V1, design D6): these triggers have NO
  // emission site in any data layer (only `todo.completed` and
  // `habit.completed_for_day` dispatch `processSourceAction`). The engine
  // cannot observe an event nobody emits, so they stay hidden until the data
  // layer ships emission — the label describes the full shipped path.
  'calorie.entry_logged': {
    engineSupport: 'deferred',
    authoringSupport: 'hidden',
    progressSemantics: 'completion_only',
    retriggerPolicy: 'suppress_linked_action_origin',
    directionSupport: { oneWay: true, bidirectionalPeer: false },
  },
  'workout.completed': {
    engineSupport: 'deferred',
    authoringSupport: 'hidden',
    progressSemantics: 'completion_only',
    retriggerPolicy: 'suppress_linked_action_origin',
    directionSupport: { oneWay: true, bidirectionalPeer: true },
  },
  'pomodoro.focus_completed': {
    engineSupport: 'deferred',
    authoringSupport: 'hidden',
    progressSemantics: 'completion_only',
    retriggerPolicy: 'suppress_linked_action_origin',
    directionSupport: { oneWay: true, bidirectionalPeer: true },
  },
};

const LINKED_ACTION_TARGET_FEATURE_POLICIES: Record<
  LinkedActionFeature,
  LinkedActionTargetFeaturePolicy
> = {
  todos: { engineSupport: 'implemented', authoringSupport: 'visible' },
  habits: { engineSupport: 'implemented', authoringSupport: 'visible' },
  // Wave 6 (D6): calorie.log/pomodoro.log effects are executed by the engine,
  // exactly-once proven, and now on supported rule paths with emitted triggers.
  calories: { engineSupport: 'implemented', authoringSupport: 'visible' },
  workout: { engineSupport: 'implemented', authoringSupport: 'visible' },
  pomodoro: { engineSupport: 'implemented', authoringSupport: 'visible' },
};

const LINKED_ACTION_TARGET_ENTITY_POLICIES: Record<
  LinkedActionTargetEntityType,
  LinkedActionTargetEntityPolicy
> = {
  todo: { engineSupport: 'implemented', authoringSupport: 'visible' },
  habit: { engineSupport: 'implemented', authoringSupport: 'visible' },
  calorie_log: { engineSupport: 'implemented', authoringSupport: 'visible' },
  workout_routine: { engineSupport: 'implemented', authoringSupport: 'visible' },
  pomodoro_session: { engineSupport: 'implemented', authoringSupport: 'visible' },
};

const LINKED_ACTION_EFFECT_POLICIES: Record<LinkedActionEffectType, LinkedActionEffectPolicy> = {
  'todo.complete': {
    engineSupport: 'implemented',
    authoringSupport: 'visible',
    progressSemantics: 'completion_only',
    retriggerPolicy: 'suppress_linked_action_origin',
    directionSupport: { oneWay: true, bidirectionalPeer: true },
  },
  'habit.increment': {
    engineSupport: 'implemented',
    authoringSupport: 'visible',
    progressSemantics: 'progress_capable',
    retriggerPolicy: 'suppress_linked_action_origin',
    directionSupport: { oneWay: true, bidirectionalPeer: true },
  },
  'habit.ensure_daily_target': {
    engineSupport: 'implemented',
    authoringSupport: 'visible',
    progressSemantics: 'progress_capable',
    retriggerPolicy: 'suppress_linked_action_origin',
    directionSupport: { oneWay: true, bidirectionalPeer: true },
  },
  'calorie.log': {
    engineSupport: 'implemented',
    authoringSupport: 'visible',
    progressSemantics: 'completion_only',
    retriggerPolicy: 'suppress_linked_action_origin',
    directionSupport: { oneWay: true, bidirectionalPeer: false },
  },
  'workout.log': {
    engineSupport: 'implemented',
    authoringSupport: 'visible',
    progressSemantics: 'completion_only',
    retriggerPolicy: 'suppress_linked_action_origin',
    directionSupport: { oneWay: true, bidirectionalPeer: true },
  },
  'pomodoro.log': {
    engineSupport: 'implemented',
    authoringSupport: 'visible',
    progressSemantics: 'completion_only',
    retriggerPolicy: 'suppress_linked_action_origin',
    directionSupport: { oneWay: true, bidirectionalPeer: false },
  },
};

function isSupportedLevel(value: LinkedActionPolicyEngineSupport) {
  return value === 'implemented';
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
  return getLinkedActionTriggerPolicy(triggerType).authoringSupport === 'visible';
}

export function isLinkedActionTargetFeatureEngineSupported(feature: LinkedActionFeature) {
  return isSupportedLevel(getLinkedActionTargetFeaturePolicy(feature).engineSupport);
}

export function isLinkedActionTargetFeatureAuthoringSupported(feature: LinkedActionFeature) {
  return getLinkedActionTargetFeaturePolicy(feature).authoringSupport === 'visible';
}

export function isLinkedActionTargetEntityEngineSupported(
  entityType: LinkedActionTargetEntityType,
) {
  return isSupportedLevel(getLinkedActionTargetEntityPolicy(entityType).engineSupport);
}

export function isLinkedActionTargetEntityAuthoringSupported(
  entityType: LinkedActionTargetEntityType,
) {
  return getLinkedActionTargetEntityPolicy(entityType).authoringSupport === 'visible';
}

export function isLinkedActionEffectEngineSupported(effectType: LinkedActionEffectType) {
  return isSupportedLevel(getLinkedActionEffectPolicy(effectType).engineSupport);
}

export function isLinkedActionEffectAuthoringSupported(effectType: LinkedActionEffectType) {
  return getLinkedActionEffectPolicy(effectType).authoringSupport === 'visible';
}

export function supportsLinkedActionDirectionPolicy(input: {
  directionPolicy: LinkedActionDirectionPolicy;
  triggerType: LinkedActionTriggerType;
  effectType: LinkedActionEffectType;
}) {
  const triggerPolicy = getLinkedActionTriggerPolicy(input.triggerType);
  const effectPolicy = getLinkedActionEffectPolicy(input.effectType);

  if (input.directionPolicy === 'one_way') {
    return triggerPolicy.directionSupport.oneWay && effectPolicy.directionSupport.oneWay;
  }

  return (
    triggerPolicy.directionSupport.bidirectionalPeer &&
    effectPolicy.directionSupport.bidirectionalPeer &&
    triggerPolicy.retriggerPolicy === 'suppress_linked_action_origin' &&
    effectPolicy.retriggerPolicy === 'suppress_linked_action_origin'
  );
}

export const LINKED_ACTION_SUPPORTED_TRIGGER_TYPES = Object.entries(LINKED_ACTION_TRIGGER_POLICIES)
  .filter(([, policy]) => policy.authoringSupport === 'visible')
  .map(([triggerType]) => triggerType as LinkedActionTriggerType);

export const LINKED_ACTION_SUPPORTED_TARGET_FEATURES = Object.entries(
  LINKED_ACTION_TARGET_FEATURE_POLICIES,
)
  .filter(([, policy]) => policy.authoringSupport === 'visible')
  .map(([feature]) => feature as LinkedActionFeature);

export const LINKED_ACTION_SUPPORTED_TARGET_ENTITY_TYPES_BY_FEATURE: Partial<
  Record<LinkedActionFeature, readonly LinkedActionTargetEntityType[]>
> = {
  todos: ['todo'],
  habits: ['habit'],
  calories: ['calorie_log'],
  workout: ['workout_routine'],
  pomodoro: ['pomodoro_session'],
};

export const LINKED_ACTION_SUPPORTED_EFFECT_TYPES_BY_TARGET_ENTITY: Partial<
  Record<LinkedActionTargetEntityType, readonly LinkedActionEffectType[]>
> = {
  todo: ['todo.complete'],
  habit: ['habit.increment', 'habit.ensure_daily_target'],
  calorie_log: ['calorie.log'],
  workout_routine: ['workout.log'],
  pomodoro_session: ['pomodoro.log'],
};
