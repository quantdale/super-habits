/**
 * Pure planning helpers shared by todo due-date reminders and the daily-plan
 * reminder. No DB, no React, no expo-notifications imports — fully unit
 * testable. Native scheduling wrappers live in `lib/notifications.ts`; the
 * bridge that ties them together is `core/notifications/todoReminderScheduler.ts`.
 */

export type TimeOfDay = { hour: number; minute: number };

export const TODO_REMINDER_DEFAULT_LEAD_MINUTES = 0;

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
