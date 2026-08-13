export const LINKED_ACTION_RULE_STATUSES = ['active', 'paused'] as const;
export type LinkedActionRuleStatus = (typeof LINKED_ACTION_RULE_STATUSES)[number];

export const LINKED_ACTION_DIRECTION_POLICIES = ['one_way', 'bidirectional_peer'] as const;
export type LinkedActionDirectionPolicy = (typeof LINKED_ACTION_DIRECTION_POLICIES)[number];

export const LINKED_ACTION_FEATURES = [
  'todos',
  'habits',
  'calories',
  'workout',
  'pomodoro',
] as const;
export type LinkedActionFeature = (typeof LINKED_ACTION_FEATURES)[number];

export const LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE = {
  todos: ['todo'],
  habits: ['habit'],
  calories: ['calorie_log'],
  workout: ['workout_routine'],
  pomodoro: ['pomodoro_timer'],
} as const;

export const LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE = {
  todos: ['todo'],
  habits: ['habit'],
  calories: ['calorie_log'],
  workout: ['workout_routine'],
  pomodoro: ['pomodoro_session'],
} as const;

type ValueOfConstArrays<T extends Record<string, readonly string[]>> = T[keyof T][number];

export type LinkedActionSourceEntityType = ValueOfConstArrays<
  typeof LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE
>;

export type LinkedActionTargetEntityType = ValueOfConstArrays<
  typeof LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE
>;

export const LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY = {
  todo: ['todo.completed'],
  habit: ['habit.progress_incremented', 'habit.completed_for_day'],
  calorie_log: ['calorie.entry_logged'],
  workout_routine: ['workout.completed'],
  pomodoro_timer: ['pomodoro.focus_completed'],
} as const;

export type LinkedActionTriggerType = ValueOfConstArrays<
  typeof LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY
>;

export const LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY = {
  todo: ['todo.complete'],
  habit: ['habit.increment', 'habit.ensure_daily_target'],
  calorie_log: ['calorie.log'],
  workout_routine: ['workout.log'],
  pomodoro_session: ['pomodoro.log'],
} as const;

export type LinkedActionEffectType = ValueOfConstArrays<
  typeof LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY
>;

export const LINKED_ACTION_EXECUTION_STATUSES = [
  'planned',
  'running',
  'applied',
  'skipped',
  'duplicate',
  'failed',
] as const;
export type LinkedActionExecutionStatus = (typeof LINKED_ACTION_EXECUTION_STATUSES)[number];
