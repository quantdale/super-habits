export type BaseEntity = {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TodoPriority = 'urgent' | 'normal' | 'low';

export type TodoRecurrence = 'daily' | null;

export type Todo = BaseEntity & {
  title: string;
  notes: string | null;
  completed: 0 | 1;
  completed_at?: string | null;
  due_date: string | null;
  priority: TodoPriority;
  sort_order: number;
  recurrence: TodoRecurrence;
  recurrence_id: string | null;
  project_id: string | null;
  goal_id: string | null;
};

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export type Project = BaseEntity & {
  name: string;
  description: string | null;
  color: string;
  status: ProjectStatus;
  target_date: string | null;
  completed_at?: string | null;
  sort_order: number;
};

export type GoalHorizon = 'week' | 'month' | 'quarter' | 'year' | 'custom';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';

export type Goal = BaseEntity & {
  project_id: string | null;
  title: string;
  description: string | null;
  horizon: GoalHorizon;
  target_date: string | null;
  status: GoalStatus;
  completed_at?: string | null;
  progress_percent: number;
};

export type HabitCategory = 'anytime' | 'morning' | 'afternoon' | 'evening';

/** Durable lifecycle state for a habit (migration 20). Archived is not deleted:
 * historical completions remain; only `active` habits are currently actionable. */
export type HabitLifecycleStatus = 'active' | 'paused' | 'archived';

/** One recorded lifecycle interval inside habits.lifecycle_history JSON.
 * to_date_key is null while the interval is ongoing (matches current status). */
export type HabitLifecycleInterval = {
  status: Exclude<HabitLifecycleStatus, 'active'>;
  from_date_key: string;
  to_date_key: string | null;
};

export type HabitIcon =
  | 'check-circle'
  | 'favorite'
  | 'local-drink'
  | 'menu-book'
  | 'fitness-center'
  | 'wb-sunny'
  | 'bedtime'
  | 'self-improvement'
  | 'water-drop'
  | 'coffee'
  | 'psychology'
  | 'spa';

export type Habit = BaseEntity & {
  name: string;
  target_per_day: number;
  reminder_time: string | null;
  category: HabitCategory;
  icon: HabitIcon;
  color: string;
  /** JSON-serialized effective-dated schedule/target rules. */
  /** Optional in the TypeScript boundary so older remote/test rows normalize safely. */
  rule_history?: string;
  project_id: string | null;
  goal_id: string | null;
  /** Durable lifecycle state (migration 20); absent in legacy rows = 'active'. */
  status?: HabitLifecycleStatus;
  /** JSON-serialized HabitLifecycleInterval[] (migration 20); optional for legacy rows. */
  lifecycle_history?: string | null;
};

export type HabitCompletion = {
  id: string;
  habit_id: string;
  date_key: string;
  count: number;
  created_at: string;
  updated_at: string;
};

/** Pomodoro is the feature/module; session_type remains the timer mode shown to users. */
export type PomodoroSession = {
  id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  /** Legacy rows may use "break"; new logs use focus / short_break / long_break as needed */
  session_type: 'focus' | 'break' | 'short_break' | 'long_break';
  created_at: string;
  /** Durable session metadata (migration 20); optional for legacy rows.
   * linked_todo_title is a display snapshot that survives todo rename/delete. */
  linked_todo_id?: string | null;
  linked_todo_title?: string | null;
  note?: string | null;
};

export type WorkoutRoutine = BaseEntity & {
  name: string;
  description: string | null;
  /** Optional user-facing training goal/tag (Gym V2). */
  goal_tag?: string | null;
};

export type WorkoutModality = 'weighted_strength' | 'bodyweight' | 'timed' | 'cardio';
export type WorkoutEffortScale = 'off' | 'rir' | 'rpe';
export type WorkoutProgressionMode = 'none' | 'linear' | 'double';
export type WorkoutWeightUnit = 'kg' | 'lb';

export type WorkoutLog = {
  id: string;
  routine_id: string;
  notes: string | null;
  completed_at: string;
  created_at: string;
  /** Real wall-clock session timing (migration 20). NULL = untimed quick-complete
   * or legacy row — unknown, never a fabricated zero-length session. */
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
  /** Snapshot added by Gym V2; legacy logs fall back to the live routine name. */
  routine_name?: string | null;
};

export type RoutineExercise = BaseEntity & {
  routine_id: string;
  name: string;
  sort_order: number;
  /** Built-in or custom catalog id; NULL preserves legacy free-text rows. */
  catalog_exercise_id?: string | null;
  modality?: WorkoutModality;
  /** Snapshot of per-side intent; legacy rows default to 0 in the domain. */
  unilateral?: 0 | 1;
  /** Snapshot of whether an external load is meaningful for this exercise. */
  supports_external_load?: 0 | 1;
  notes?: string | null;
  superset_group?: string | null;
  progression_mode?: WorkoutProgressionMode;
  progression_increment?: number | null;
  progression_min_reps?: number | null;
  progression_max_reps?: number | null;
};

export type RoutineExerciseSet = BaseEntity & {
  exercise_id: string;
  set_number: number;
  active_seconds: number;
  rest_seconds: number;
  target_reps_min?: number | null;
  target_reps_max?: number | null;
  target_load?: number | null;
  target_duration_seconds?: number | null;
  target_distance?: number | null;
  target_pace?: number | null;
};

export type WorkoutSessionExercise = {
  id: string;
  log_id: string;
  exercise_name: string;
  sets_completed: number;
  created_at: string;
  catalog_exercise_id?: string | null;
  modality?: WorkoutModality;
  /** Immutable snapshot of per-side semantics for historical display. */
  unilateral?: 0 | 1;
  /** Immutable snapshot of external-load semantics for historical display. */
  supports_external_load?: 0 | 1;
};

/** Per-set load/reps actually performed in a session (migration 20).
 * weight/reps NULL = not recorded (unknown) — never a measured zero.
 * completed = 0 marks a skipped set. Insert-only immutable history rows. */
export type WorkoutSessionSet = {
  id: string;
  session_exercise_id: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  weight_unit: 'kg' | 'lb' | null;
  completed: 0 | 1;
  created_at: string;
  duration_seconds?: number | null;
  distance?: number | null;
  pace?: number | null;
  effort_value?: number | null;
  effort_scale?: Exclude<WorkoutEffortScale, 'off'> | null;
};

export type CustomExercise = BaseEntity & {
  name: string;
  description: string | null;
  /** JSON-serialized normalized aliases used by offline search. */
  aliases?: string;
  /** Optional user-authored instructions; not sourced from openGym. */
  instructions?: string | null;
  primary_area: string;
  secondary_areas: string;
  equipment: string | null;
  modality: WorkoutModality;
  unilateral: 0 | 1;
  supports_external_load?: 0 | 1;
};

export type WorkoutPlanKind = 'workout' | 'rest';

export type WorkoutWeeklyPlanEntry = BaseEntity & {
  weekday: number;
  routine_id: string | null;
  plan_kind: WorkoutPlanKind;
  note: string | null;
};

export type WorkoutScheduleOverride = BaseEntity & {
  date_key: string;
  override_kind: WorkoutPlanKind;
  routine_id: string | null;
  moved_from_date_key: string | null;
  note: string | null;
};

export type BodyWeightEntry = BaseEntity & {
  measured_on: string;
  measured_at: string;
  weight: number;
  unit: WorkoutWeightUnit;
  note: string | null;
};

export type CalorieEntry = BaseEntity & {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  consumed_on: string;
};

export type SavedMeal = {
  id: string;
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  meal_type: string;
  use_count: number;
  last_used_at: string;
  created_at: string;
};

export type WeeklyReview = {
  id: string;
  week_key: string;
  week_start_date: string;
  week_end_date: string;
  next_week_start_date: string;
  completed_at: string | null;
  status: 'draft' | 'completed';
  summary_payload: string;
  plan_payload: string;
  reflection: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type DailyPlanStatus = 'draft' | 'committed' | 'completed';

export type DailyPlan = BaseEntity & {
  date_key: string;
  intention: string;
  /** JSON-serialized array of up to three Todo IDs (string[]). */
  top_todo_ids: string;
  /**
   * JSON-serialized title snapshots (string[]) aligned index-wise with
   * top_todo_ids at save time (migration 21). Nullable: NULL on pre-v21 rows
   * until their next save re-snapshots.
   */
  top_todo_titles?: string | null;
  focus_target_minutes: number;
  notes: string;
  reflection: string;
  /** Energy score 1–5, or null when not yet recorded. */
  energy_score: number | null;
  status: DailyPlanStatus;
  completed_at?: string | null;
};
