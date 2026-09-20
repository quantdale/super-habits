import { isValidDateKey, toDateKey } from './time';

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

export function validateTodoTitle(title: string): string | null {
  if (!title.trim()) return 'Task title is required.';
  if (title.trim().length > 200) return 'Title must be 200 characters or less.';
  return null;
}

export function validateTodoNotes(notes: string): string | null {
  if (notes.length > 500) return 'Notes must be 500 characters or less.';
  return null;
}

export function validateTodoDueDate(dueDate: string | null | undefined): string | null {
  if (dueDate != null && dueDate !== '') {
    if (!YYYY_MM_DD.test(dueDate)) return 'Due date must be a valid YYYY-MM-DD date.';
    const d = new Date(`${dueDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return 'Due date must be a valid YYYY-MM-DD date.';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    if (`${y}-${m}-${day}` !== dueDate) return 'Due date must be a valid YYYY-MM-DD date.';
  }
  return null;
}

export function validateTodo(title: string, notes: string, dueDate?: string | null): string | null {
  return validateTodoTitle(title) ?? validateTodoNotes(notes) ?? validateTodoDueDate(dueDate);
}

/**
 * Data-layer hard reject for todo writes. Same contract (and same messages) as
 * the UI `validateTodo` path, so non-UI writers (quick capture, weekly-review
 * executor, recurrence expansion) can never land an invalid row. Throws.
 */
export function assertTodoWrite(input: {
  title: string;
  notes?: string | null;
  dueDate?: string | null;
}): void {
  const err =
    validateTodoTitle(input.title) ??
    validateTodoNotes(input.notes ?? '') ??
    validateTodoDueDate(input.dueDate ?? null);
  if (err) throw new Error(err);
}

/** Partial-update variant: only defined fields are checked. */
export function assertTodoPartialUpdate(updates: {
  title?: string;
  notes?: string;
  dueDate?: string | null;
}): void {
  let err: string | null = null;
  if (err === null && updates.title !== undefined) err = validateTodoTitle(updates.title);
  if (err === null && updates.notes !== undefined) err = validateTodoNotes(updates.notes);
  if (err === null && updates.dueDate !== undefined) err = validateTodoDueDate(updates.dueDate);
  if (err) throw new Error(err);
}

export function validateHabitName(name: string): string | null {
  if (!name.trim()) return 'Habit name is required.';
  if (name.trim().length > 100) return 'Name must be 100 characters or less.';
  return null;
}

export function validateHabitTarget(targetPerDay: number): string | null {
  if (!Number.isInteger(targetPerDay) || targetPerDay < 1)
    return 'Daily target must be at least 1.';
  if (targetPerDay > 99) return 'Daily target cannot exceed 99.';
  return null;
}

export function validateHabit(name: string, targetPerDay: number): string | null {
  return validateHabitName(name) ?? validateHabitTarget(targetPerDay);
}

/**
 * Data-layer hard reject for habit writes. Same contract (and same messages) as
 * the UI `validateHabit` path, plus the non-empty-weekdays rule the habit
 * editor enforces. `weekdays` is `readonly unknown[]` so this pure lib module
 * never imports feature types. Throws.
 */
export function assertHabitWrite(input: {
  name: string;
  targetPerDay: number;
  weekdays?: readonly unknown[];
}): void {
  const err =
    validateHabitName(input.name) ??
    validateHabitTarget(input.targetPerDay) ??
    (input.weekdays !== undefined && input.weekdays.length === 0
      ? 'Choose at least one day for this habit.'
      : null);
  if (err) throw new Error(err);
}

export function validateCalorieFoodName(foodName: string): string | null {
  if (!foodName.trim()) return 'Food name is required.';
  if (foodName.trim().length > 100) return 'Food name must be 100 characters or less.';
  return null;
}

export type CalorieMacroLabel = 'Protein' | 'Carbs' | 'Fats' | 'Fiber';

/**
 * Numeric macro check with the exact UI messages. Non-finite, NaN, and
 * negative values all report `must be 0 or greater` (matching the string
 * form below, where `Number('') === 0` passes and unparseable text is NaN);
 * values above the per-macro cap report the `too high` message.
 */
export function validateCalorieMacroValue(value: number, label: CalorieMacroLabel): string | null {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0)
    return `${label} must be 0 or greater.`;
  if (value > 999) return `${label} value seems too high (max 999g).`;
  return null;
}

export function validateCalorieEntry(
  foodName: string,
  protein: string,
  carbs: string,
  fats: string,
  fiber: string,
): string | null {
  const foodError = validateCalorieFoodName(foodName);
  if (foodError) return foodError;

  const macros: [string, CalorieMacroLabel][] = [
    [protein, 'Protein'],
    [carbs, 'Carbs'],
    [fats, 'Fats'],
    [fiber, 'Fiber'],
  ];
  for (const [raw, label] of macros) {
    const macroError = validateCalorieMacroValue(Number(raw.trim()), label);
    if (macroError) return macroError;
  }

  return null;
}

const SUPPORTED_MEAL_TYPES: readonly string[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * Data-layer hard reject for calorie-ledger writes. Same contract (and same
 * messages) as the UI `validateCalorieEntry` +
 * `validateCalorieComputedKcal` path, so non-UI writers (quick capture,
 * command executor, linked-action effects) can never land an invalid row.
 * Callers pass *resolved* values (macros defaulted, kcal computed) — the
 * same precedent as the todo resolved-dueDate assert. Throws.
 */
export function assertCalorieEntryWrite(input: {
  foodName: string;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  calories: number;
  mealType: string;
}): void {
  const err =
    validateCalorieFoodName(input.foodName) ??
    validateCalorieMacroValue(input.protein, 'Protein') ??
    validateCalorieMacroValue(input.carbs, 'Carbs') ??
    validateCalorieMacroValue(input.fats, 'Fats') ??
    validateCalorieMacroValue(input.fiber, 'Fiber') ??
    validateCalorieComputedKcal(input.calories) ??
    (SUPPORTED_MEAL_TYPES.includes(input.mealType) ? null : 'Choose a supported meal type.');
  if (err) throw new Error(err);
}

/**
 * Past-only consumed-date contract for the calorie edit modal. Mirrors
 * `assertConsumableDateKey` in `features/calories/calories.data.ts` with the
 * exact same messages so pre-submit feedback matches the submit refusal:
 * entries reference today or a past local date. Returns null when saveable.
 */
export function validateConsumedDateKey(
  consumedOn: string,
  todayKey: string = toDateKey(),
): string | null {
  if (!isValidDateKey(consumedOn)) {
    return 'Consumed date must be a valid calendar date (YYYY-MM-DD).';
  }
  if (consumedOn > todayKey) {
    return 'Calorie logging is limited to today or a past local date.';
  }
  return null;
}

/** Computed kcal from macros (saved entry must be within range and positive). */
export function validateCalorieComputedKcal(kcal: number): string | null {
  if (!Number.isFinite(kcal)) return 'Calories could not be calculated from macros.';
  if (kcal < 0) return 'Calories cannot be negative.';
  if (kcal > 9999) return 'Calories cannot exceed 9999 kcal.';
  if (kcal === 0) return 'Enter macro amounts so calories are greater than zero.';
  return null;
}

export function validateCalorieGoal(
  calories: string,
  protein: string,
  carbs: string,
  fats: string,
): string | null {
  // Empty is invalid, not zero: `Number('') === 0` would otherwise pass the
  // range checks below and silently save a cleared field as 0 (same class
  // as the MacroTargetsModal hole). Explicit '0' macros remain valid;
  // calorie entry forms intentionally allow empty (treated as 0 + guarded
  // by validateCalorieComputedKcal) and are untouched — this guard lives
  // only on the goal path.
  if (
    calories.trim() === '' ||
    protein.trim() === '' ||
    carbs.trim() === '' ||
    fats.trim() === ''
  ) {
    return 'Enter a value for every goal field.';
  }
  const cal = Number(calories.trim());
  if (isNaN(cal) || cal < 500) return 'Daily calorie goal must be at least 500.';
  if (cal > 6000) return 'Daily calorie goal cannot exceed 6000.';
  const p = Number(protein.trim());
  const c = Number(carbs.trim());
  const f = Number(fats.trim());
  if (isNaN(p) || p < 0 || p > 999) return 'Protein goal must be between 0 and 999g.';
  if (isNaN(c) || c < 0 || c > 999) return 'Carbs goal must be between 0 and 999g.';
  if (isNaN(f) || f < 0 || f > 999) return 'Fats goal must be between 0 and 999g.';
  return null;
}

export function validateRoutineName(name: string): string | null {
  if (!name.trim()) return 'Routine name is required.';
  if (name.trim().length > 100) return 'Routine name must be 100 characters or less.';
  return null;
}

export function validateExerciseName(name: string): string | null {
  if (!name.trim()) return 'Exercise name is required.';
  if (name.trim().length > 100) return 'Exercise name must be 100 characters or less.';
  return null;
}

/**
 * Data-layer hard reject for workout routine writes. Same contract (and same
 * messages) as the UI `validateRoutineName` path, so non-UI writers and the
 * unvalidated rename path can never land an invalid row. Throws.
 */
export function assertRoutineWrite(input: { name: string }): void {
  const err = validateRoutineName(input.name);
  if (err) throw new Error(err);
}

/**
 * Data-layer hard reject for workout exercise-name writes (routine exercises
 * and custom exercises share the 100-char contract). Same contract (and same
 * messages) as the UI `validateExerciseName` path. Throws.
 */
export function assertExerciseWrite(input: { name: string }): void {
  const err = validateExerciseName(input.name);
  if (err) throw new Error(err);
}

export function validateSetTiming(activeSeconds: number, restSeconds: number): string | null {
  if (activeSeconds < 5) return 'Active time must be at least 5 seconds.';
  if (activeSeconds > 3600) return 'Active time cannot exceed 60 minutes.';
  if (restSeconds < 0) return 'Rest time cannot be negative.';
  if (restSeconds > 1800) return 'Rest time cannot exceed 30 minutes.';
  return null;
}

export function validatePomodoroSettings(
  focus: string,
  shortBrk: string,
  longBrk: string,
  sessions: string,
): string | null {
  const f = Number(focus.trim());
  const s = Number(shortBrk.trim());
  const l = Number(longBrk.trim());
  const n = Number(sessions.trim());

  if (isNaN(f) || f < 1) return 'Focus duration must be at least 1 minute.';
  if (f > 120) return 'Focus duration cannot exceed 120 minutes.';
  if (isNaN(s) || s < 1) return 'Short break must be at least 1 minute.';
  if (s > 60) return 'Short break cannot exceed 60 minutes.';
  if (isNaN(l) || l < 1) return 'Long break must be at least 1 minute.';
  if (l > 120) return 'Long break cannot exceed 120 minutes.';
  if (isNaN(n) || n < 2) return 'Sessions before long break must be at least 2.';
  if (n > 10) return 'Sessions before long break cannot exceed 10.';
  if (
    !Number.isInteger(f) ||
    !Number.isInteger(s) ||
    !Number.isInteger(l) ||
    !Number.isInteger(n)
  ) {
    return 'Use whole numbers for timer settings.';
  }
  return null;
}
