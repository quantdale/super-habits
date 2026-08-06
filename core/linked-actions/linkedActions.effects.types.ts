export type LinkedActionDateStrategy = 'today' | 'source_date';
export type LinkedActionMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type LinkedActionPomodoroSessionType = 'focus' | 'short_break' | 'long_break';

export type LinkedActionBinaryEffectDefinition = {
  kind: 'binary';
  type: 'todo.complete';
};

export type LinkedActionHabitIncrementEffectDefinition = {
  kind: 'progress';
  type: 'habit.increment';
  amount: number;
  dateStrategy: LinkedActionDateStrategy;
};

export type LinkedActionHabitEnsureTargetEffectDefinition = {
  kind: 'progress';
  type: 'habit.ensure_daily_target';
  minimumCount: number | 'target_per_day';
  dateStrategy: LinkedActionDateStrategy;
};

export type LinkedActionCalorieLogEffectDefinition = {
  kind: 'log';
  type: 'calorie.log';
  dateStrategy: LinkedActionDateStrategy;
  templateSource: 'inline' | 'saved_meal';
  savedMealId: string | null;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  mealType: LinkedActionMealType;
};

export type LinkedActionWorkoutLogEffectDefinition = {
  kind: 'log';
  type: 'workout.log';
  notes: string | null;
};

export type LinkedActionPomodoroLogEffectDefinition = {
  kind: 'log';
  type: 'pomodoro.log';
  sessionType: LinkedActionPomodoroSessionType;
  durationSeconds: number;
};

export type LinkedActionEffectDefinition =
  | LinkedActionBinaryEffectDefinition
  | LinkedActionHabitIncrementEffectDefinition
  | LinkedActionHabitEnsureTargetEffectDefinition
  | LinkedActionCalorieLogEffectDefinition
  | LinkedActionWorkoutLogEffectDefinition
  | LinkedActionPomodoroLogEffectDefinition;

export type LinkedActionUnsupportedEffectDefinition = {
  kind: 'unsupported';
  type: string;
  rawPayload: string;
};
