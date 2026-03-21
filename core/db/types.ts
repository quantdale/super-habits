export type BaseEntity = {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TodoPriority = "urgent" | "normal" | "low";

export type Todo = BaseEntity & {
  title: string;
  notes: string | null;
  completed: 0 | 1;
  due_date: string | null;
  priority: TodoPriority;
  sort_order: number;
};

export type HabitCategory = "anytime" | "morning" | "afternoon" | "evening";

export type HabitIcon =
  | "check-circle"
  | "favorite"
  | "local-drink"
  | "menu-book"
  | "fitness-center"
  | "wb-sunny"
  | "bedtime"
  | "self-improvement"
  | "water-drop"
  | "coffee"
  | "psychology"
  | "spa";

export type Habit = BaseEntity & {
  name: string;
  target_per_day: number;
  reminder_time: string | null;
  category: HabitCategory;
  icon: HabitIcon;
  color: string;
};

export type HabitCompletion = {
  id: string;
  habit_id: string;
  date_key: string;
  count: number;
  created_at: string;
  updated_at: string;
};

export type PomodoroSession = {
  id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  session_type: "focus" | "break";
  created_at: string;
};

export type WorkoutRoutine = BaseEntity & {
  name: string;
  description: string | null;
};

export type WorkoutLog = {
  id: string;
  routine_id: string;
  notes: string | null;
  completed_at: string;
  created_at: string;
};

export type CalorieEntry = BaseEntity & {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  consumed_on: string;
};
