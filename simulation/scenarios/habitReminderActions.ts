export type HabitReminderCompletion = {
  habit_id: string;
  date_key: string;
  count: number;
};

function getHabitReminderActionKey(habitId: string, dateKey: string, action: string): string {
  return `habit-reminder:${habitId}:${dateKey}:${action}`;
}

function getHabitReminderSnoozeIdentifier(habitId: string, dateKey: string): string {
  return `habit-reminder-snooze:${habitId}:${dateKey}`;
}

export type HabitReminderActionSimulationState = {
  count: number;
  target: number;
  normalReminderScheduled: boolean;
  snoozeIdentifiers: string[];
  processedActionKeys: string[];
};

/**
 * Small deterministic state model for the simulation lane.
 *
 * Native scheduling and notification actions are intentionally unavailable in
 * the web runner. The real SQLite action tests own mutation correctness; this
 * model keeps the simulation lane explicit about the user-visible invariants:
 * a replay is ignored, a legitimate increment is exactly +1, and one habit
 * occurrence has at most one snooze replacement.
 */
export function simulateHabitReminderActions(input: {
  habitId: string;
  dateKey: string;
  target: number;
  initialCount?: number;
  snoozeRequested?: boolean;
  snoozeReplay?: boolean;
}): HabitReminderActionSimulationState {
  const count = Math.max(0, input.initialCount ?? 0);
  const state: HabitReminderActionSimulationState = {
    count,
    target: Math.max(1, input.target),
    normalReminderScheduled: count < Math.max(1, input.target),
    snoozeIdentifiers: [],
    processedActionKeys: [],
  };

  const markKey = getHabitReminderActionKey(
    input.habitId,
    input.dateKey,
    'habit_reminder_mark_complete',
  );
  state.processedActionKeys.push(markKey);
  state.count += 1;
  if (state.count >= state.target) {
    state.normalReminderScheduled = false;
  }

  // Replaying the same response has no product effect.
  if (!state.processedActionKeys.includes(markKey)) {
    state.processedActionKeys.push(markKey);
    state.count += 1;
  }

  if (input.snoozeRequested && state.count < state.target) {
    const snoozeId = getHabitReminderSnoozeIdentifier(input.habitId, input.dateKey);
    state.snoozeIdentifiers.push(snoozeId);
    if (input.snoozeReplay && !state.snoozeIdentifiers.includes(snoozeId)) {
      state.snoozeIdentifiers.push(snoozeId);
    }
  }

  return state;
}

export function simulateLegitimateHabitIncrement(
  state: HabitReminderActionSimulationState,
): HabitReminderActionSimulationState {
  const next = { ...state, processedActionKeys: [...state.processedActionKeys] };
  next.count += 1;
  if (next.count >= next.target) {
    next.normalReminderScheduled = false;
    next.snoozeIdentifiers = [];
  }
  return next;
}

export function completionForSimulation(
  habitId: string,
  dateKey: string,
  count: number,
): HabitReminderCompletion {
  return { habit_id: habitId, date_key: dateKey, count };
}
