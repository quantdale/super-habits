import { dateKeyToLocalDate, toDateKey } from '@/lib/time';
import { validateHabit, validateTodo } from '@/lib/validation';
import type { DraftAiAction } from './types';

export const COMMAND_MAX_CALORIES = 9_999;
export const COMMAND_MAX_MACRO_GRAMS = 999;
export const COMMAND_MIN_FOCUS_MINUTES = 1;
export const COMMAND_MAX_FOCUS_MINUTES = 120;

export function normalizeReference(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isValidCommandDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = dateKeyToLocalDate(value);
  return !Number.isNaN(date.getTime()) && toDateKey(date) === value;
}

export function isBoundedNonNegativeNumber(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
}

export function isBoundedPositiveInteger(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max;
}

export function validateCommandDraftFields(draft: DraftAiAction): string | null {
  switch (draft.kind) {
    case 'create_todo':
      return validateTodo(
        draft.fields.title?.trim() ?? '',
        draft.fields.notes?.trim() ?? '',
        draft.fields.dueDate,
      );
    case 'create_habit':
      return validateHabit(draft.fields.name?.trim() ?? '', draft.fields.targetPerDay);
    case 'complete_todo':
      return normalizeReference(draft.fields.todoTitle)
        ? null
        : 'Add the Todo title before continuing.';
    case 'log_habit':
      if (!normalizeReference(draft.fields.habitName))
        return 'Add the Habit name before continuing.';
      if (draft.fields.dateKey !== null && !isValidCommandDateKey(draft.fields.dateKey)) {
        return 'Habit logs must use a valid local date.';
      }
      return null;
    case 'log_calorie_entry':
      if (!normalizeReference(draft.fields.foodName)) return 'Add a food name before continuing.';
      if (!isBoundedPositiveInteger(draft.fields.calories, COMMAND_MAX_CALORIES)) {
        return `Calories must be a whole number from 1 to ${COMMAND_MAX_CALORIES}.`;
      }
      if (
        draft.fields.protein !== null &&
        !isBoundedNonNegativeNumber(draft.fields.protein, COMMAND_MAX_MACRO_GRAMS)
      ) {
        return `Protein must be between 0 and ${COMMAND_MAX_MACRO_GRAMS} grams.`;
      }
      if (
        draft.fields.carbs !== null &&
        !isBoundedNonNegativeNumber(draft.fields.carbs, COMMAND_MAX_MACRO_GRAMS)
      ) {
        return `Carbohydrates must be between 0 and ${COMMAND_MAX_MACRO_GRAMS} grams.`;
      }
      if (
        draft.fields.fats !== null &&
        !isBoundedNonNegativeNumber(draft.fields.fats, COMMAND_MAX_MACRO_GRAMS)
      ) {
        return `Fats must be between 0 and ${COMMAND_MAX_MACRO_GRAMS} grams.`;
      }
      if (
        draft.fields.fiber !== null &&
        !isBoundedNonNegativeNumber(draft.fields.fiber, COMMAND_MAX_MACRO_GRAMS)
      ) {
        return `Fiber must be between 0 and ${COMMAND_MAX_MACRO_GRAMS} grams.`;
      }
      if (
        draft.fields.mealType !== null &&
        !['breakfast', 'lunch', 'dinner', 'snack'].includes(draft.fields.mealType)
      ) {
        return 'Choose a supported meal type.';
      }
      if (draft.fields.consumedOn !== null && !isValidCommandDateKey(draft.fields.consumedOn)) {
        return 'Consumed date must be a valid local date.';
      }
      return null;
    case 'log_workout_routine':
      if (!normalizeReference(draft.fields.routineName)) {
        return 'Add the workout routine name before continuing.';
      }
      if (draft.fields.completedOn !== null && !isValidCommandDateKey(draft.fields.completedOn)) {
        return 'Workout date must be a valid local date.';
      }
      return null;
    case 'start_focus_session':
      return isBoundedPositiveInteger(draft.fields.durationMinutes, COMMAND_MAX_FOCUS_MINUTES) &&
        draft.fields.durationMinutes >= COMMAND_MIN_FOCUS_MINUTES
        ? null
        : `Focus duration must be a whole number from ${COMMAND_MIN_FOCUS_MINUTES} to ${COMMAND_MAX_FOCUS_MINUTES} minutes.`;
  }
}
