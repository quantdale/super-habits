import type {
  LinkedActionDirectionPolicy,
  LinkedActionEffectType,
  LinkedActionFeature,
  LinkedActionRuleDefinition,
  LinkedActionRuleStatus,
  LinkedActionSourceEntityType,
  LinkedActionTargetEntityType,
  LinkedActionTriggerType,
} from "@/core/linked-actions/linkedActions.types";
import type { LinkedActionTargetPickerSelection } from "@/core/linked-actions/linkedActionsTargetPicker.types";

export type LinkedActionEditorSourceOption = {
  key: string;
  feature: LinkedActionFeature;
  entityType: LinkedActionSourceEntityType;
  entityId: string;
  label: string;
  description: string;
};

export type LinkedActionEditorRowDraft = {
  id: string;
  mode: "existing" | "draft";
  existingRuleId: string | null;
  status: LinkedActionRuleStatus;
  directionPolicy: LinkedActionDirectionPolicy;
  sourceFeature: LinkedActionFeature;
  sourceEntityType: LinkedActionSourceEntityType;
  sourceEntityId: string;
  triggerType: LinkedActionTriggerType | null;
  targetFeature: LinkedActionFeature | null;
  targetEntityType: LinkedActionTargetEntityType | null;
  targetSelection: LinkedActionTargetPickerSelection | null;
  effectType: LinkedActionEffectType | null;
};

export type LinkedActionEditorRowValidation = {
  triggerType?: string;
  targetFeature?: string;
  targetSelection?: string;
  effectType?: string;
};

export type LinkedActionExistingRuleAdapterInput = {
  rule: LinkedActionRuleDefinition;
  targetSelection: LinkedActionTargetPickerSelection;
};
