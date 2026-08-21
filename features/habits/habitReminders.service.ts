import {
  cancelHabitReminderNotification,
  ensureHabitReminderChannel,
  getNotificationPermissionState,
  listScheduledNotifications,
  scheduleHabitReminderNotification,
  type NotificationRequest,
  type NotificationPermissionState,
} from '@/lib/notifications';
import {
  buildHabitReminderPlan,
  getHabitReminderIdentifier,
  getHabitReminderSnoozeIdentifier,
  isHabitReminderIdentifier,
  isHabitReminderSnoozeIdentifier,
  type HabitReminderHabit,
  type HabitReminderCompletion,
  type HabitReminderPlanItem,
} from '@/features/habits/habitReminders.domain';
import {
  getHabitTargetForDate,
  isHabitScheduledOn,
  parseHabitRuleHistory,
} from '@/features/habits/habits.domain';
import { getAllHabitCompletionsForRange, listHabits } from '@/features/habits/habits.data';
import { toDateKey } from '@/lib/time';
import {
  requestHabitReminderReconciliation,
  setHabitReminderReconciliationHandler,
} from '@/core/notifications/habitReminderSignals';

export type HabitReminderNativeAdapter = {
  getPermissionState: () => Promise<NotificationPermissionState>;
  ensureChannel: () => Promise<void>;
  listScheduled: () => Promise<NotificationRequest[]>;
  schedule: (item: HabitReminderPlanItem) => Promise<string | null>;
  cancel: (identifier: string) => Promise<void>;
};

export type HabitReminderReconciliationResult = {
  status: 'reconciled' | 'permission_denied' | 'unsupported' | 'failed';
  desired: number;
  preserved: number;
  scheduled: number;
  cancelled: number;
  error?: unknown;
};

export type ReconcileHabitRemindersInput = {
  now?: Date;
  habits?: readonly HabitReminderHabit[];
  completions?: readonly HabitReminderCompletion[];
  windowDays?: number;
  adapter?: HabitReminderNativeAdapter;
};

const defaultAdapter: HabitReminderNativeAdapter = {
  getPermissionState: getNotificationPermissionState,
  ensureChannel: ensureHabitReminderChannel,
  listScheduled: listScheduledNotifications,
  schedule: (item) =>
    scheduleHabitReminderNotification({
      identifier: item.identifier,
      title: item.title,
      body: item.body,
      data: item.data,
      fireAt: item.fireAt,
    }),
  cancel: cancelHabitReminderNotification,
};

function getNotificationData(request: NotificationRequest): Record<string, unknown> | null {
  const data = request.content.data;
  return data && typeof data === 'object' ? data : null;
}

function getLogicalKey(request: NotificationRequest): string | null {
  const data = getNotificationData(request);
  if (
    data?.kind === 'habit-reminder' &&
    typeof data.habitId === 'string' &&
    typeof data.dateKey === 'string'
  ) {
    return `${data.habitId}:${data.dateKey}`;
  }
  const parts = request.identifier.split(':');
  if (
    parts.length === 3 &&
    (parts[0] === 'habit-reminder' || parts[0] === 'habit-reminder-snooze')
  ) {
    return `${parts[1]}:${parts[2]}`;
  }
  return null;
}

function getScheduledDateMs(request: NotificationRequest): number | null {
  const trigger = request.trigger;
  if (!trigger || typeof trigger !== 'object' || !('type' in trigger)) {
    return null;
  }
  const triggerType: unknown = trigger.type;
  if (triggerType !== 'date' || !('date' in trigger)) return null;
  const value: unknown = trigger.date;
  if (value instanceof Date) return value.getTime();
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isCorrectScheduledRequest(
  request: NotificationRequest,
  item: HabitReminderPlanItem,
): boolean {
  const data = getNotificationData(request);
  return (
    request.identifier === item.identifier &&
    data?.kind === item.data.kind &&
    data?.version === item.data.version &&
    data?.habitId === item.data.habitId &&
    data?.dateKey === item.data.dateKey &&
    data?.occurrenceId === item.data.occurrenceId &&
    data?.time === item.data.time &&
    getScheduledDateMs(request) === item.fireAt.getTime()
  );
}

function isHabitReminderRequest(request: NotificationRequest): boolean {
  return isHabitReminderIdentifier(request.identifier) || getLogicalKey(request) !== null;
}

function isValidSnoozeRequest(
  request: NotificationRequest,
  habits: readonly HabitReminderHabit[],
  completions: readonly HabitReminderCompletion[],
  now: Date,
): boolean {
  const data = getNotificationData(request);
  if (
    data?.kind !== 'habit-reminder' ||
    data.snoozed !== true ||
    typeof data.habitId !== 'string' ||
    typeof data.dateKey !== 'string'
  ) {
    return false;
  }
  const habit = habits.find((candidate) => candidate.id === data.habitId);
  if (!habit || habit.deleted_at !== null || toDateKey(now) !== data.dateKey) return false;
  // Snoozing a paused/archived habit would reschedule a reminder the planner
  // no longer wants; treat it as invalid so reconciliation cancels it.
  if ((habit.status ?? 'active') !== 'active') return false;
  const fireAtMs = getScheduledDateMs(request);
  if (
    fireAtMs === null ||
    fireAtMs <= now.getTime() ||
    toDateKey(new Date(fireAtMs)) !== data.dateKey
  ) {
    return false;
  }
  const creationDateKey = new Date(habit.created_at);
  const fallbackCreationDate = Number.isNaN(creationDateKey.getTime())
    ? undefined
    : toDateKey(creationDateKey);
  if (
    !isHabitScheduledOn(
      habit.rule_history,
      data.dateKey,
      habit.target_per_day,
      fallbackCreationDate,
    )
  ) {
    return false;
  }
  const target = getHabitTargetForDate(
    parseHabitRuleHistory(habit.rule_history),
    data.dateKey,
    habit.target_per_day,
    fallbackCreationDate,
  );
  const count =
    completions.find(
      (completion) => completion.habit_id === data.habitId && completion.date_key === data.dateKey,
    )?.count ?? 0;
  return count < target;
}

function buildCompletionRange(now: Date, windowDays: number): { start: string; end: string } {
  const startDate = new Date(now.getTime());
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate.getTime());
  endDate.setDate(endDate.getDate() + Math.max(0, Math.floor(windowDays)) - 1);
  return { start: toDateKey(startDate), end: toDateKey(endDate) };
}

async function loadPlannerInputs(input: ReconcileHabitRemindersInput): Promise<{
  habits: readonly HabitReminderHabit[];
  completions: readonly HabitReminderCompletion[];
}> {
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? 14;
  const habits = input.habits ?? (await listHabits());
  if (input.completions) return { habits, completions: input.completions };
  const range = buildCompletionRange(now, windowDays);
  return {
    habits,
    completions: await getAllHabitCompletionsForRange(range.start, range.end),
  };
}

/**
 * Reconcile only the deterministic habit-reminder namespace. Pomodoro and any
 * other app notifications remain untouched because they are never considered
 * by this diff.
 */
export async function reconcileHabitReminders(
  input: ReconcileHabitRemindersInput = {},
): Promise<HabitReminderReconciliationResult> {
  const adapter = input.adapter ?? defaultAdapter;
  const now = input.now ?? new Date();
  try {
    const permission = await adapter.getPermissionState();
    const existing = await adapter.listScheduled();
    const existingHabitRequests = existing.filter(isHabitReminderRequest);

    if (permission !== 'granted') {
      let cancelled = 0;
      for (const request of existingHabitRequests) {
        await adapter.cancel(request.identifier);
        cancelled += 1;
      }
      return {
        status: permission === 'unsupported' ? 'unsupported' : 'permission_denied',
        desired: 0,
        preserved: 0,
        scheduled: 0,
        cancelled,
      };
    }

    await adapter.ensureChannel();
    const { habits, completions } = await loadPlannerInputs({ ...input, now });
    const desired = buildHabitReminderPlan({
      habits,
      completions,
      now,
      windowDays: input.windowDays,
    });
    const existingNormalRequests = existingHabitRequests.filter(
      (request) => !isHabitReminderSnoozeIdentifier(request.identifier),
    );
    const existingSnoozeRequests = existingHabitRequests.filter((request) =>
      isHabitReminderSnoozeIdentifier(request.identifier),
    );
    const existingByLogicalKey = new Map<string, NotificationRequest[]>();
    for (const request of existingNormalRequests) {
      const key = getLogicalKey(request);
      if (!key) continue;
      const rows = existingByLogicalKey.get(key) ?? [];
      rows.push(request);
      existingByLogicalKey.set(key, rows);
    }

    let preserved = 0;
    let scheduled = 0;
    let cancelled = 0;
    const cancelledIdentifiers = new Set<string>();
    for (const item of desired) {
      const candidates = existingByLogicalKey.get(`${item.habitId}:${item.dateKey}`) ?? [];
      const correct = candidates.find((candidate) => isCorrectScheduledRequest(candidate, item));
      if (correct) {
        preserved += 1;
        for (const duplicate of candidates) {
          if (duplicate.identifier === correct.identifier) continue;
          await adapter.cancel(duplicate.identifier);
          cancelledIdentifiers.add(duplicate.identifier);
          cancelled += 1;
        }
        continue;
      }
      for (const stale of candidates) {
        await adapter.cancel(stale.identifier);
        cancelledIdentifiers.add(stale.identifier);
        cancelled += 1;
      }
      await adapter.schedule(item);
      scheduled += 1;
    }

    // Cancel stale dates, deleted habits, disabled rows, and old-time entries
    // that are not represented by the desired bounded plan.
    for (const request of existingNormalRequests) {
      if (cancelledIdentifiers.has(request.identifier)) continue;
      if (!desired.some((item) => item.identifier === request.identifier)) {
        await adapter.cancel(request.identifier);
        cancelledIdentifiers.add(request.identifier);
        cancelled += 1;
      }
    }

    // Snoozes are not part of the normal configured-time plan. Preserve one
    // valid same-day replacement across lifecycle reconciliation, and repair
    // the rest of the native inventory by cancelling stale/duplicate entries.
    const snoozesByLogicalKey = new Map<string, NotificationRequest[]>();
    for (const request of existingSnoozeRequests) {
      const key = getLogicalKey(request);
      if (!key) continue;
      const rows = snoozesByLogicalKey.get(key) ?? [];
      rows.push(request);
      snoozesByLogicalKey.set(key, rows);
    }
    for (const [logicalKey, requests] of snoozesByLogicalKey) {
      const valid = requests.filter((request) =>
        isValidSnoozeRequest(request, habits, completions, now),
      );
      const canonicalIdentifier = `habit-reminder-snooze:${logicalKey}`;
      const keep = valid.find((request) => request.identifier === canonicalIdentifier);
      if (keep) {
        for (const request of requests) {
          if (request.identifier === keep.identifier) continue;
          await adapter.cancel(request.identifier);
          cancelledIdentifiers.add(request.identifier);
          cancelled += 1;
        }
        continue;
      }
      for (const request of requests) {
        await adapter.cancel(request.identifier);
        cancelledIdentifiers.add(request.identifier);
        cancelled += 1;
      }
    }

    return { status: 'reconciled', desired: desired.length, preserved, scheduled, cancelled };
  } catch (error) {
    return { status: 'failed', desired: 0, preserved: 0, scheduled: 0, cancelled: 0, error };
  }
}

export function getHabitReminderLogicalKey(habitId: string, dateKey: string): string {
  return `${habitId}:${dateKey}`;
}

export { getHabitReminderIdentifier };
export { getHabitReminderSnoozeIdentifier };
export { requestHabitReminderReconciliation, setHabitReminderReconciliationHandler };
