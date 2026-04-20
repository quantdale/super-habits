import type {
  LinkedActionFeature,
  LinkedActionTriggerType,
} from "@/core/linked-actions/linkedActions.types";
import { LINKED_ACTION_SUPPORTED_RULE_PATHS } from "@/core/linked-actions/linkedActions.types";

export type LinkedActionsEditorConfig = {
  allowedTargetFeatures: LinkedActionFeature[];
  allowedTriggerTypes: LinkedActionTriggerType[];
  allowCreateNewTarget: boolean;
};

function uniqueValues<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function buildEditorConfigForSourceFeature(feature: LinkedActionFeature): LinkedActionsEditorConfig {
  const supportedPathsForSource = LINKED_ACTION_SUPPORTED_RULE_PATHS.filter(
    (path) => path.sourceFeature === feature,
  );

  return {
    allowedTargetFeatures: uniqueValues(
      supportedPathsForSource.map((path) => path.targetFeature),
    ),
    allowedTriggerTypes: uniqueValues(
      supportedPathsForSource.map((path) => path.triggerType),
    ),
    allowCreateNewTarget: false,
  };
}

export const HABIT_LINKED_ACTIONS_EDITOR_CONFIG = buildEditorConfigForSourceFeature("habits");

export const TODO_LINKED_ACTIONS_EDITOR_CONFIG = buildEditorConfigForSourceFeature("todos");
