import type {
  LinkedActionFeature,
  LinkedActionTriggerType,
} from "@/core/linked-actions/linkedActions.types";

export type LinkedActionsEditorConfig = {
  allowedTargetFeatures: LinkedActionFeature[];
  allowedTriggerTypes: LinkedActionTriggerType[];
  allowCreateNewTarget: boolean;
};

export const HABIT_LINKED_ACTIONS_EDITOR_CONFIG: LinkedActionsEditorConfig = {
  allowedTargetFeatures: ["todos", "habits", "workout"],
  allowedTriggerTypes: ["habit.completed_for_day"],
  allowCreateNewTarget: false,
};

export const TODO_LINKED_ACTIONS_EDITOR_CONFIG: LinkedActionsEditorConfig = {
  allowedTargetFeatures: ["todos"],
  allowedTriggerTypes: ["todo.completed"],
  allowCreateNewTarget: false,
};
