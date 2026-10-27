/**
 * Pure planning helpers shared by todo due-date reminders and the daily-plan
 * reminder. No DB, no React, no expo-notifications imports — fully unit
 * testable. Native scheduling wrappers live in `lib/notifications.ts`; the
 * bridge that ties them together is `core/notifications/todoReminderScheduler.ts`.
 */

import { isValidDateKey, parseLocalDateKey } from '@/lib/time';

export type TimeOfDay = { hour: number; minute: number };

export const TODO_REMINDER_DEFAULT_LEAD_MINUTES = 0;

/** Fixed (non-cumulative) snooze delay for todo due-date reminders. */
export const TODO_REMINDER_SNOOZE_MINUTES = 15;

/** Parses a strict local `HH:mm` (24h) string. Returns null when malformed. */
export function parseTimeOfDay(value: string | null | undefined): TimeOfDay | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Formats a time-of-day as a zero-padded `HH:mm` string. */
export function formatTimeOfDay(time: TimeOfDay): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(time.hour)}:${pad(time.minute)}`;
}

/** Normalizes loose user input ("9:5", "09:05 ") into canonical `HH:mm`, or null. */
export function normalizeTimeOfDayInput(value: string): string | null {
  const trimmed = value.trim();
  const lenient = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed);
  if (!lenient) return null;
  const hour = Number(lenient[1]);
  const minute = Number(lenient[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return formatTimeOfDay({ hour, minute });
}

/** Stable scheduled-notification identifier for one todo's due reminder. */
export function todoReminderIdentifier(todoId: string): string {
  return `todo-reminder:${todoId}`;
}

/**
 * Stable identifier for a todo's snooze replacement. Unlike the base
 * identifier it is not occurrence-scoped: at most one live snooze per todo.
 */
export function getTodoReminderSnoozeIdentifier(todoId: string): string {
  return `todo-reminder-snooze:${todoId}`;
}

/**
 * Dedupe key for one delivered todo reminder action. `occurrenceId` embeds the
 * fire time (`todo-reminder:{todoId}:{fireAtMs}`), so every reschedule opens a
 * fresh claim namespace and a completed-then-reopened todo can be marked done
 * again from its next reminder.
 */
export function getTodoReminderActionKey(
  occurrenceId: string,
  action: 'todo_reminder_mark_done' | 'todo_reminder_snooze',
): string {
  return `${occurrenceId}:${action}`;
}

/** Stable identifier for the single repeating daily-plan reminder. */
export const DAILY_PLAN_REMINDER_IDENTIFIER = 'daily-plan-reminder:daily';

/**
 * Computes when a todo due-date reminder should fire. `leadMinutes` fires the
 * reminder before the due moment (0 = at due time). Returns null when the
 * resulting fire date is not strictly in the future — past-due todos never
 * schedule retroactive notifications.
 */
export function computeTodoReminderFireAt(
  dueAt: Date,
  leadMinutes: number = TODO_REMINDER_DEFAULT_LEAD_MINUTES,
  now: Date = new Date(),
): Date | null {
  const fireAt = new Date(dueAt.getTime() - leadMinutes * 60_000);
  if (fireAt.getTime() <= now.getTime()) return null;
  return fireAt;
}

/**
 * Default wall-clock reminder time for a DATE-ONLY due date.
 *
 * A todo stored with `due_date = 'YYYY-MM-DD'` carries no due moment — only a
 * local calendar day. Anchoring that day at an explicit, documented local time
 * is what makes the reminder meaningful: at local midnight it would fire while
 * the user sleeps, and at UTC midnight (the pre-fix behaviour of `new
 * Date('YYYY-MM-DD')`) it fires at 08:00 in UTC+8 — inside the morning, i.e.
 * already "past" for anyone planning their day at 07:00, who then gets *no*
 * reminder at all — or at 19:00 the *evening before* in UTC-5.
 *
 * 09:00 local is the default so a due-date task pings once the day has
 * visibly started, while staying a fixed, documented wall-clock rule (no
 * per-user due-time column exists, and inventing one is out of scope here).
 */
export const TODO_REMINDER_DEFAULT_DUE_TIME: TimeOfDay = { hour: 9, minute: 0 };

/**
 * The instant a DATE-ONLY due date names, on the local calendar.
 *
 * - `timeOfDay` omitted → {@link TODO_REMINDER_DEFAULT_DUE_TIME} local.
 * - `timeOfDay` given → that local wall clock on the due day. A time the wall
 *   clock skipped (spring-forward gap) resolves forward to the first existing
 *   instant of that local day instead of silently wrapping an hour earlier.
 *
 * The due day itself is parsed locally via `parseLocalDateKey`; never via
 * `new Date('YYYY-MM-DD')`, which is UTC by spec and shifts the day in every
 * timezone with a non-zero offset.
 */
export function resolveTodoDueAt(
  dateKey: string,
  timeOfDay: TimeOfDay = TODO_REMINDER_DEFAULT_DUE_TIME,
): Date | null {
  if (!isValidDateKey(dateKey)) return null;
  const midnight = parseLocalDateKey(dateKey);
  const dueAt = new Date(midnight);
  dueAt.setHours(timeOfDay.hour, timeOfDay.minute, 0, 0);
  // A spring-forward gap (02:30 does not exist on that date) makes
  // `setHours` normalize forward by an hour. Landing on a different wall clock
  // means the requested time is not real that day, so use the day's own first
  // instant instead of guessing an hour.
  return dueAt.getHours() === timeOfDay.hour && dueAt.getMinutes() === timeOfDay.minute
    ? dueAt
    : midnight;
}
