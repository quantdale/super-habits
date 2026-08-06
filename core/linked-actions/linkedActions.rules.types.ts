import type {
  LinkedActionEffectDefinition,
  LinkedActionUnsupportedEffectDefinition,
} from '@/core/linked-actions/linkedActions.effects.types';
import type {
  LinkedActionDirectionPolicy,
  LinkedActionEffectType,
  LinkedActionFeature,
  LinkedActionRuleStatus,
  LinkedActionSourceEntityType,
  LinkedActionTargetEntityType,
  LinkedActionTriggerType,
} from '@/core/linked-actions/linkedActions.enums';

export type LinkedActionRuleSource = {
  feature: LinkedActionFeature;
  entityType: LinkedActionSourceEntityType;
  entityId: string | null;
  triggerType: LinkedActionTriggerType;
};

export type LinkedActionRuleTarget = {
  feature: LinkedActionFeature;
  entityType: LinkedActionTargetEntityType;
  entityId: string | null;
  effect: LinkedActionEffectDefinition;
};

export type LinkedActionUnsupportedRuleTarget = {
  feature: string;
  entityType: string;
  entityId: string | null;
  effect: LinkedActionUnsupportedEffectDefinition;
};

type LinkedActionRuleDefinitionBase = {
  id: string;
  status: LinkedActionRuleStatus;
  directionPolicy: LinkedActionDirectionPolicy;
  bidirectionalGroupId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type LinkedActionSupportedRuleDefinition = LinkedActionRuleDefinitionBase & {
  source: LinkedActionRuleSource;
  target: LinkedActionRuleTarget;
  isUnsupported: false;
  unsupportedReason: null;
  rawTargetFeature: LinkedActionFeature;
  rawTargetEntityType: LinkedActionTargetEntityType;
  rawEffectType: LinkedActionEffectType;
};

export type LinkedActionUnsupportedRuleDefinition = LinkedActionRuleDefinitionBase & {
  source: LinkedActionRuleSource;
  target: LinkedActionUnsupportedRuleTarget;
  isUnsupported: true;
  unsupportedReason: string;
  rawTargetFeature: string;
  rawTargetEntityType: string;
  rawEffectType: string;
};

export type LinkedActionRuleDefinition =
  LinkedActionSupportedRuleDefinition | LinkedActionUnsupportedRuleDefinition;

export type CreateLinkedActionRuleInput = {
  status?: LinkedActionRuleStatus;
  directionPolicy?: LinkedActionDirectionPolicy;
  bidirectionalGroupId?: string | null;
  source: LinkedActionRuleSource;
  target: LinkedActionRuleTarget;
};

export type SaveLinkedActionRuleForSourceInput = {
  existingRuleId?: string | null;
  status?: LinkedActionRuleStatus;
  directionPolicy?: LinkedActionDirectionPolicy;
  bidirectionalGroupId?: string | null;
  triggerType: LinkedActionTriggerType;
  target: LinkedActionRuleTarget;
};

export type LinkedActionRuleRow = {
  id: string;
  status: string;
  direction_policy: string;
  bidirectional_group_id: string | null;
  source_feature: string;
  source_entity_type: string;
  source_entity_id: string | null;
  trigger_type: string;
  target_feature: string;
  target_entity_type: string;
  target_entity_id: string | null;
  effect_type: string;
  effect_payload: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
