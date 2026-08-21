import type {
  ReviewWeek,
  WeeklyReviewSummaryV1,
  WeeklyTodoDecision,
  WeeklyReviewDraft,
  NewTodoCommitmentDraft,
  ReviewInsight,
} from './weeklyReview.types';
import { dateKeyToLocalDate, toDateKey, isValidDateKey } from '@/lib/time';

// ---------- constants ----------

export const MAX_PRIORITIES = 5;
export const MIN_PRIORITIES = 1;
export const MAX_NEW_COMMITMENTS = 10;
export const MAX_REFLECTION_LENGTH = 4000;
export const MAX_PRIORITY_TEXT_LENGTH = 200;
export const MAX_COMMITMENT_TITLE_LENGTH = 200;
export const MAX_COMMITMENT_NOTES_LENGTH = 500;

// ---------- week semantics ----------

/** Monday-start (ISO) canonical week for a given reference date. */
export function getReviewWeek(referenceDateKey?: string): ReviewWeek {
  const refKey = referenceDateKey ?? toDateKey();
  const refDate = dateKeyToLocalDate(refKey);

  // dayOfWeek: 0=Sun 1=Mon … 6=Sat  →  mondayOffset: Mon=0 … Sun=-6
  const dayOfWeek = refDate.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const nextMonday = new Date(sunday);
  nextMonday.setDate(sunday.getDate() + 1);

  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);

  return {
    weekKey: toDateKey(monday),
    startDateKey: toDateKey(monday),
    endDateKey: toDateKey(sunday),
    nextWeekStartDateKey: toDateKey(nextMonday),
    nextWeekEndDateKey: toDateKey(nextSunday),
  };
}

export function getReviewWeekForDate(dateKey: string): ReviewWeek {
  return getReviewWeek(dateKey);
}

export function isDateInWeek(dateKey: string, week: ReviewWeek): boolean {
  return dateKey >= week.startDateKey && dateKey <= week.endDateKey;
}

export function isDateInNextWeek(dateKey: string, week: ReviewWeek): boolean {
  return dateKey >= week.nextWeekStartDateKey && dateKey <= week.nextWeekEndDateKey;
}

// ---------- validation ----------

export function validatePriorities(priorities: { text: string }[]): string[] {
  const errors: string[] = [];
  if (priorities.length < MIN_PRIORITIES) {
    errors.push(`At least ${MIN_PRIORITIES} priority is required`);
  }
  if (priorities.length > MAX_PRIORITIES) {
    errors.push(`At most ${MAX_PRIORITIES} priorities are allowed`);
  }
  for (const p of priorities) {
    if (!p.text.trim()) errors.push('Priority text cannot be empty');
    if (p.text.length > MAX_PRIORITY_TEXT_LENGTH)
      errors.push(`Priority text must be at most ${MAX_PRIORITY_TEXT_LENGTH} characters`);
  }
  return errors;
}

export function validateNewCommitments(commitments: NewTodoCommitmentDraft[]): string[] {
  const errors: string[] = [];
  if (commitments.length > MAX_NEW_COMMITMENTS) {
    errors.push(`At most ${MAX_NEW_COMMITMENTS} new commitments are allowed`);
  }
  for (const c of commitments) {
    if (!c.title.trim()) errors.push('Commitment title cannot be empty');
    if (c.title.length > MAX_COMMITMENT_TITLE_LENGTH)
      errors.push(`Commitment title must be at most ${MAX_COMMITMENT_TITLE_LENGTH} characters`);
    if (c.notes && c.notes.length > MAX_COMMITMENT_NOTES_LENGTH)
      errors.push(`Commitment notes must be at most ${MAX_COMMITMENT_NOTES_LENGTH} characters`);
    if (c.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(c.dueDate))
      errors.push('Commitment due date must be YYYY-MM-DD');
  }
  return errors;
}

export function validateReflection(reflection: string): string[] {
  if (reflection.length > MAX_REFLECTION_LENGTH) {
    return [`Reflection must be at most ${MAX_REFLECTION_LENGTH} characters`];
  }
  return [];
}

export function validateTodoDecisions(decisions: WeeklyTodoDecision[]): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  for (const d of decisions) {
    if (seenIds.has(d.todoId)) {
      errors.push(`Duplicate decision for todo ${d.todoId}`);
    }
    seenIds.add(d.todoId);
    if (d.action === 'reschedule') {
      if (!d.dueDate) {
        errors.push(`Reschedule action for todo ${d.todoId} requires a due date`);
      }
    }
    if ('dueDate' in d && d.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate)) {
      errors.push(`Invalid due date format for todo ${d.todoId}`);
    }
  }
  return errors;
}

export function validateReviewDraft(draft: WeeklyReviewDraft): string[] {
  const errors: string[] = [];
  errors.push(...validatePriorities(draft.priorities));
  errors.push(...validateNewCommitments(draft.newCommitments));
  errors.push(...validateReflection(draft.reflection));
  errors.push(...validateTodoDecisions(draft.todoDecisions));
  return errors;
}

// ---------- deterministic insight generation ----------

export function generateInsights(summary: WeeklyReviewSummaryV1): {
  wins: ReviewInsight[];
  attention: ReviewInsight[];
} {
  const wins: ReviewInsight[] = [];
  const attention: ReviewInsight[] = [];

  // Todos
  if (summary.todos.completedCount > 0) {
    wins.push({
      kind: 'todos_completed',
      message: `Completed ${summary.todos.completedCount} todo${summary.todos.completedCount === 1 ? '' : 's'} this week`,
    });
  }
  if (summary.todos.overdueCount > 0) {
    attention.push({
      kind: 'todos_overdue',
      message: `${summary.todos.overdueCount} todo${summary.todos.overdueCount === 1 ? '' : 's'} overdue`,
    });
  }

  // Habits
  if (summary.habits.consistencyPercent !== null) {
    if (summary.habits.consistencyPercent >= 80) {
      wins.push({
        kind: 'habit_consistency_high',
        message: `${summary.habits.consistencyPercent}% habit consistency — strong week`,
      });
    } else if (summary.habits.consistencyPercent < 50) {
      attention.push({
        kind: 'habit_consistency_low',
        message: `${summary.habits.consistencyPercent}% habit consistency — room to improve`,
      });
    }
  }
  for (const item of summary.habits.attention) {
    attention.push({ kind: 'habit_attention', message: `${item.name}: ${item.message}` });
  }

  // Focus
  if (summary.focus.sessions > 0) {
    wins.push({
      kind: 'focus_sessions',
      message: `${summary.focus.sessions} focus session${summary.focus.sessions === 1 ? '' : 's'} (${summary.focus.minutes} min)`,
    });
  }
  if (
    summary.focus.priorWeekMinutes !== null &&
    summary.focus.minutes === 0 &&
    summary.focus.priorWeekMinutes > 0
  ) {
    attention.push({
      kind: 'focus_decline',
      message: 'No focus sessions this week after prior activity',
    });
  }

  // Workouts
  if (summary.workouts.sessions > 0) {
    wins.push({
      kind: 'workout_sessions',
      message: `${summary.workouts.sessions} workout session${summary.workouts.sessions === 1 ? '' : 's'}`,
    });
  }
  if (
    summary.workouts.priorWeekSessions !== null &&
    summary.workouts.sessions === 0 &&
    summary.workouts.priorWeekSessions > 0
  ) {
    attention.push({
      kind: 'workout_decline',
      message: 'No workouts this week after prior activity',
    });
  }

  // Calories
  if (summary.calories.loggedDays > 0 && summary.calories.averageCaloriesOnLoggedDays !== null) {
    if (summary.calories.configuredGoal !== null) {
      const diff = summary.calories.averageCaloriesOnLoggedDays - summary.calories.configuredGoal;
      if (diff > 200) {
        attention.push({
          kind: 'calories_above_goal',
          message: `Average ${Math.round(summary.calories.averageCaloriesOnLoggedDays)} kcal/day — above ${summary.calories.configuredGoal} kcal goal`,
        });
      } else if (diff < -200) {
        wins.push({
          kind: 'calories_below_goal',
          message: `Average ${Math.round(summary.calories.averageCaloriesOnLoggedDays)} kcal/day — within range of ${summary.calories.configuredGoal} kcal goal`,
        });
      }
    }
  }

  return { wins, attention };
}

// ---------- payload parsers ----------

export function parseSummaryPayload(json: string): WeeklyReviewSummaryV1 | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'version' in parsed &&
      (parsed as Record<string, unknown>).version === 1 &&
      'week' in parsed &&
      'todos' in parsed
    ) {
      return parsed as WeeklyReviewSummaryV1;
    }
    return null;
  } catch {
    return null;
  }
}

export function parsePlanPayload(
  json: string,
): import('./weeklyReview.types').WeeklyPlanPayload | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'priorities' in parsed &&
      Array.isArray((parsed as Record<string, unknown>).priorities)
    ) {
      return parsed as import('./weeklyReview.types').WeeklyPlanPayload;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------- local-calendar day-key arithmetic ----------

/** Shift a date key by whole local-calendar days (DST-safe via local midnight). */
export function shiftDateKeyByDays(dateKey: string, days: number): string {
  const date = dateKeyToLocalDate(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/**
 * Local-calendar date keys for `days` consecutive days starting at
 * `startDateKey` (index 0 = start). Extracted from the summary builder so the
 * per-habit day iteration is unit-testable without a DB and can never regress
 * to UTC `new Date(key)` parsing (F5).
 */
export function listWeekDateKeys(startDateKey: string, days = 7): string[] {
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    keys.push(shiftDateKeyByDays(startDateKey, i));
  }
  return keys;
}

// ---------- next-week plan suggestions ----------

export type NextWeekPlanSuggestion = {
  dateKey: string;
  todoIds: string[];
};

const MAX_SUGGESTIONS_PER_DAY = 3;
const MAX_SUGGESTION_DAYS = 7;

/**
 * Distribute carry-forward candidates across next week's days (Monday-start),
 * at most MAX_SUGGESTIONS_PER_DAY per day over at most MAX_SUGGESTION_DAYS
 * days. Pure and deterministic: candidates are assigned in input order and
 * deduplicated.
 */
export function buildNextWeekPlanSuggestions(input: {
  candidateTodoIds: readonly string[];
  nextWeekStartDateKey: string;
}): NextWeekPlanSuggestion[] {
  const { nextWeekStartDateKey } = input;
  const candidateTodoIds = Array.from(new Set(input.candidateTodoIds));
  if (candidateTodoIds.length === 0) return [];
  if (!isValidDateKey(nextWeekStartDateKey)) return [];

  const suggestions: NextWeekPlanSuggestion[] = [];
  let cursor = 0;
  for (let dayOffset = 0; dayOffset < MAX_SUGGESTION_DAYS; dayOffset++) {
    if (cursor >= candidateTodoIds.length) break;
    const todoIds = candidateTodoIds.slice(cursor, cursor + MAX_SUGGESTIONS_PER_DAY);
    cursor += todoIds.length;
    suggestions.push({ dateKey: shiftDateKeyByDays(nextWeekStartDateKey, dayOffset), todoIds });
  }
  return suggestions;
}
