const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

export function validateTodo(
  title: string,
  notes: string,
  dueDate?: string | null,
): string | null {
  if (!title.trim()) return "Task title is required.";
  if (title.trim().length > 200) return "Title must be 200 characters or less.";
  if (notes.length > 500) return "Notes must be 500 characters or less.";
  if (dueDate != null && dueDate !== "") {
    if (!YYYY_MM_DD.test(dueDate)) return "Due date must be a valid YYYY-MM-DD date.";
    const d = new Date(`${dueDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return "Due date must be a valid YYYY-MM-DD date.";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    if (`${y}-${m}-${day}` !== dueDate) return "Due date must be a valid YYYY-MM-DD date.";
  }
  return null;
}

export function validateHabit(name: string, targetPerDay: number): string | null {
  if (!name.trim()) return "Habit name is required.";
  if (name.trim().length > 100) return "Name must be 100 characters or less.";
  if (!Number.isInteger(targetPerDay) || targetPerDay < 1)
    return "Daily target must be at least 1.";
  if (targetPerDay > 99) return "Daily target cannot exceed 99.";
  return null;
}

export function validateCalorieEntry(
  foodName: string,
  protein: string,
  carbs: string,
  fats: string,
  fiber: string,
): string | null {
  if (!foodName.trim()) return "Food name is required.";
  if (foodName.trim().length > 100) return "Food name must be 100 characters or less.";

  const p = Number(protein.trim());
  const c = Number(carbs.trim());
  const f = Number(fats.trim());
  const fi = Number(fiber.trim());

  if (isNaN(p) || p < 0) return "Protein must be 0 or greater.";
  if (isNaN(c) || c < 0) return "Carbs must be 0 or greater.";
  if (isNaN(f) || f < 0) return "Fats must be 0 or greater.";
  if (isNaN(fi) || fi < 0) return "Fiber must be 0 or greater.";
  if (p > 999) return "Protein value seems too high (max 999g).";
  if (c > 999) return "Carbs value seems too high (max 999g).";
  if (f > 999) return "Fats value seems too high (max 999g).";
  if (fi > 999) return "Fiber value seems too high (max 999g).";

  return null;
}

/** Computed kcal from macros (saved entry must be within range and positive). */
export function validateCalorieComputedKcal(kcal: number): string | null {
  if (!Number.isFinite(kcal)) return "Calories could not be calculated from macros.";
  if (kcal < 0) return "Calories cannot be negative.";
  if (kcal > 9999) return "Calories cannot exceed 9999 kcal.";
  if (kcal === 0) return "Enter macro amounts so calories are greater than zero.";
  return null;
}

export function validateCalorieGoal(
  calories: string,
  protein: string,
  carbs: string,
  fats: string,
): string | null {
  const cal = Number(calories.trim());
  if (isNaN(cal) || cal < 500) return "Daily calorie goal must be at least 500.";
  if (cal > 6000) return "Daily calorie goal cannot exceed 6000.";
  const p = Number(protein.trim());
  const c = Number(carbs.trim());
  const f = Number(fats.trim());
  if (isNaN(p) || p < 0 || p > 999) return "Protein goal must be between 0 and 999g.";
  if (isNaN(c) || c < 0 || c > 999) return "Carbs goal must be between 0 and 999g.";
  if (isNaN(f) || f < 0 || f > 999) return "Fats goal must be between 0 and 999g.";
  return null;
}

export function validateRoutineName(name: string): string | null {
  if (!name.trim()) return "Routine name is required.";
  if (name.trim().length > 100) return "Routine name must be 100 characters or less.";
  return null;
}

export function validateExerciseName(name: string): string | null {
  if (!name.trim()) return "Exercise name is required.";
  if (name.trim().length > 100) return "Exercise name must be 100 characters or less.";
  return null;
}

export function validateSetTiming(activeSeconds: number, restSeconds: number): string | null {
  if (activeSeconds < 5) return "Active time must be at least 5 seconds.";
  if (activeSeconds > 3600) return "Active time cannot exceed 60 minutes.";
  if (restSeconds < 0) return "Rest time cannot be negative.";
  if (restSeconds > 1800) return "Rest time cannot exceed 30 minutes.";
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

  if (isNaN(f) || f < 1) return "Focus duration must be at least 1 minute.";
  if (f > 120) return "Focus duration cannot exceed 120 minutes.";
  if (isNaN(s) || s < 1) return "Short break must be at least 1 minute.";
  if (s > 60) return "Short break cannot exceed 60 minutes.";
  if (isNaN(l) || l < 1) return "Long break must be at least 1 minute.";
  if (l > 120) return "Long break cannot exceed 120 minutes.";
  if (isNaN(n) || n < 2) return "Sessions before long break must be at least 2.";
  if (n > 10) return "Sessions before long break cannot exceed 10.";
  if (!Number.isInteger(f) || !Number.isInteger(s) || !Number.isInteger(l) || !Number.isInteger(n)) {
    return "Use whole numbers for timer settings.";
  }
  return null;
}
