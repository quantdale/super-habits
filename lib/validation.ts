import { parseNumericInput } from './numericInput';
import { isValidDateKey, toDateKey } from './time';

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
    // `isValidDateKey` is the single round-trip integer check for a local date
    // key (format + real calendar day + no normalization drift).
    if (!isValidDateKey(dueDate)) return 'Due date must be a valid YYYY-MM-DD date.';
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
    // Whole-gram contract: the entry form submits macros through
    // `parseNumericInput` (integer-only) and falls back to 0 for anything it
    // cannot parse — so decimal text that passed the value check above would
    // be SILENTLY stored as 0 and vanish from every total. Reject it here,
    // while the user still sees the field. Empty stays valid (= 0, the form's
    // historic contract); the check matches the submit parser exactly.
    if (raw.trim() !== '' && parseNumericInput(raw) === null) {
      return `${label} must be a whole number.`;
    }
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
  if (!Number.isInteger(kcal)) return 'Calories must be a whole number.';
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
  if (!Number.isInteger(activeSeconds) || !Number.isInteger(restSeconds)) {
    return 'Set timing must use finite whole seconds.';
  }
  if (activeSeconds < 5) return 'Active time must be at least 5 seconds.';
  if (activeSeconds > 3600) return 'Active time cannot exceed 60 minutes.';
  if (restSeconds < 0) return 'Rest time cannot be negative.';
  if (restSeconds > 1800) return 'Rest time cannot exceed 30 minutes.';
  return null;
}

/** Validate resolved optional targets before SQLite can coerce NaN to NULL. */
export function assertSetPrescriptionWrite(
  input: {
    setNumber?: number;
    targetRepsMin?: number | null;
    targetRepsMax?: number | null;
    targetLoad?: number | null;
    targetDurationSeconds?: number | null;
    targetDistance?: number | null;
    targetPace?: number | null;
  },
  /**
   * `storedRepRange` is the persisted row's rep bounds (update path only) and
   * `repRangeEdited` says whether this write supplies either endpoint.
   * A rep range that is ALREADY reversed — a row recovered from a backup
   * written before the range rule existed — stays editable for unrelated
   * fields (timing, load, distance, pace); any endpoint edit must repair it.
   * Without that carve-out, restoring a legacy plan silently froze every set
   * in it: even a rest-duration change threw "minimum cannot exceed maximum".
   */
  context?: {
    storedRepRange?: { min: number | null; max: number | null };
    repRangeEdited?: boolean;
  },
): void {
  if (
    input.setNumber !== undefined &&
    (!Number.isSafeInteger(input.setNumber) || input.setNumber < 1)
  ) {
    throw new Error('Set number must be a positive whole number.');
  }
  for (const [value, label, minimum] of [
    [input.targetRepsMin, 'Target reps minimum', 1],
    [input.targetRepsMax, 'Target reps maximum', 1],
    [input.targetDurationSeconds, 'Target duration', 0],
  ] as const) {
    if (value != null && (!Number.isSafeInteger(value) || value < minimum)) {
      throw new Error(`${label} must be a whole number ${minimum} or greater.`);
    }
  }
  for (const [value, label] of [
    [input.targetLoad, 'Target load'],
    [input.targetDistance, 'Target distance'],
    [input.targetPace, 'Target pace'],
  ] as const) {
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${label} must be a finite number 0 or greater.`);
    }
  }
  if (
    input.targetRepsMin != null &&
    input.targetRepsMax != null &&
    input.targetRepsMin > input.targetRepsMax
  ) {
    const stored = context?.storedRepRange;
    const preExistingReversal =
      stored != null && stored.min != null && stored.max != null && stored.min > stored.max;
    if (context?.repRangeEdited === true || !preExistingReversal) {
      throw new Error('Target reps minimum cannot exceed maximum reps.');
    }
  }
}

const PROGRESSION_MODES: readonly string[] = ['none', 'linear', 'double'];

/**
 * Data-layer hard reject for exercise-level progression prescriptions
 * (`routine_exercises.progression_*`). The recovery/import contract in
 * `core/backup/backupValidators.ts` (ROUTINE_EXERCISE_RULES) already requires
 * mode ∈ {none, linear, double}, increment null|finite ≥ 0 and min/max reps
 * null|whole ≥ 1 — without this assert the writers stored rows their own
 * backup/restore path then rejects, which makes the whole dataset
 * un-importable. Mirrors `assertSetPrescriptionWrite` for the per-set fields.
 *
 * `storedRepRange` carries the persisted sibling bounds for a partial update:
 * endpoints the caller did NOT supply are validated against the stored row so
 * a partial edit cannot land a reversed range, while a row whose range was
 * already reversed (imported from a pre-contract backup) stays editable and
 * repairable. Throws.
 */
export function assertExerciseProgressionWrite(
  input: {
    progressionMode?: string;
    progressionIncrement?: number | null;
    progressionMinReps?: number | null;
    progressionMaxReps?: number | null;
  },
  storedRepRange?: { min: number | null; max: number | null },
): void {
  if (input.progressionMode !== undefined && !PROGRESSION_MODES.includes(input.progressionMode)) {
    throw new Error('Progression mode must be Manual, Linear, or Double.');
  }
  if (
    input.progressionIncrement != null &&
    (!Number.isFinite(input.progressionIncrement) || input.progressionIncrement < 0)
  ) {
    throw new Error('Progression increment must be a finite number 0 or greater.');
  }
  for (const [value, label] of [
    [input.progressionMinReps, 'Progression minimum reps'],
    [input.progressionMaxReps, 'Progression maximum reps'],
  ] as const) {
    if (value != null && (!Number.isSafeInteger(value) || value < 1)) {
      throw new Error(`${label} must be a whole number 1 or greater.`);
    }
  }
  const stored = storedRepRange ?? { min: null, max: null };
  const nextMin = input.progressionMinReps === undefined ? stored.min : input.progressionMinReps;
  const nextMax = input.progressionMaxReps === undefined ? stored.max : input.progressionMaxReps;
  if (nextMin != null && nextMax != null && nextMin > nextMax) {
    // An endpoint this write supplies may never leave the range reversed. A
    // reversal that is ALREADY stored (a row imported from a backup written
    // before this contract) is tolerated only for writes that touch neither
    // endpoint, so unrelated edits keep working while any rep-range edit must
    // repair the row.
    const touchesEndpoints =
      input.progressionMinReps !== undefined || input.progressionMaxReps !== undefined;
    const preExistingReversal = stored.min != null && stored.max != null && stored.min > stored.max;
    if (touchesEndpoints || !preExistingReversal) {
      throw new Error('Progression minimum reps cannot exceed maximum reps.');
    }
  }
}

/**
 * Data-layer hard reject for `routine_exercises.sort_order`: the recovery
 * contract requires a whole number ≥ 0.
 */
export function assertExerciseSortOrderWrite(sortOrder: number): void {
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) {
    throw new Error('Exercise order must be a whole number 0 or greater.');
  }
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
