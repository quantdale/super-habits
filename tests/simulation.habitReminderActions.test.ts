import { describe, expect, it } from 'vitest';
import {
  completionForSimulation,
  simulateHabitReminderActions,
  simulateLegitimateHabitIncrement,
} from '../simulation/scenarios/habitReminderActions';

describe('deterministic actionable reminder simulation', () => {
  it('replays Mark complete once, then cancels the occurrence at target', () => {
    const partial = simulateHabitReminderActions({
      habitId: 'gym',
      dateKey: '2026-08-10',
      target: 2,
      initialCount: 0,
    });

    expect(partial.count).toBe(1);
    expect(partial.normalReminderScheduled).toBe(true);
    expect(partial.processedActionKeys).toHaveLength(1);

    const complete = simulateLegitimateHabitIncrement(partial);
    expect(complete.count).toBe(2);
    expect(complete.normalReminderScheduled).toBe(false);
  });

  it('keeps one deterministic snooze replacement after a replay', () => {
    const state = simulateHabitReminderActions({
      habitId: 'gym',
      dateKey: '2026-08-10',
      target: 3,
      initialCount: 0,
      snoozeRequested: true,
      snoozeReplay: true,
    });

    expect(state.count).toBe(1);
    expect(state.snoozeIdentifiers).toEqual(['habit-reminder-snooze:gym:2026-08-10']);
  });

  it('keeps date-keyed completion state independent from notification labels', () => {
    expect(completionForSimulation('gym', '2026-08-10', 1)).toEqual({
      habit_id: 'gym',
      date_key: '2026-08-10',
      count: 1,
    });
  });
});
