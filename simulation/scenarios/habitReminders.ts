/**
 * Deterministic persisted-state coverage for Habit Reminders V1.
 *
 * The simulation runner executes against the web export, where native
 * notification scheduling is intentionally unsupported. These API-leg cases
 * therefore prove the reminder configuration, schedule metadata, and
 * completion state that the native planner consumes. The native planner's
 * eligibility/suppression behavior is covered by the pure domain suite.
 */

import { defineScenario } from '../model/builders';

export const habitRemindersV1 = defineScenario({
  id: 'habit-reminders-v1',
  personaId: 'daily-driver',
  goal: 'Persist representative reminder configurations without changing Habit V2 history',
  description:
    'Web simulation coverage for reminder persistence: daily, M/W/F, disabled, and completed-before-reminder cases. Native delivery and schedule reconciliation are exercised by the domain/service and Android lanes because web notifications are unsupported.',
  tags: ['habit-reminders', 'notifications', 'deterministic'],
  steps: [
    {
      kind: 'apiLeg',
      functionName: 'createHabit',
      args: { name: 'Reminder simulation daily', targetPerDay: 1, reminderTime: '07:30' },
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT reminder_time FROM habits WHERE name = 'Reminder simulation daily' AND deleted_at IS NULL",
          expected: [{ reminder_time: '07:30' }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'createHabit',
      args: {
        name: 'Reminder simulation MWF',
        targetPerDay: 1,
        weekdays: [1, 3, 5],
        reminderTime: '18:00',
      },
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT CASE WHEN reminder_time = '18:00' AND rule_history LIKE '%\"weekdays\":[1,3,5]%' THEN 1 ELSE 0 END AS configured FROM habits WHERE name = 'Reminder simulation MWF' AND deleted_at IS NULL",
          expected: [{ configured: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'createHabit',
      args: { name: 'Reminder simulation disabled', targetPerDay: 1, reminderTime: null },
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT reminder_time FROM habits WHERE name = 'Reminder simulation disabled' AND deleted_at IS NULL",
          expected: [{ reminder_time: null }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'createHabit',
      args: {
        name: 'Reminder simulation completed',
        targetPerDay: 1,
        reminderTime: '21:00',
      },
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT reminder_time FROM habits WHERE name = 'Reminder simulation completed' AND deleted_at IS NULL",
          expected: [{ reminder_time: '21:00' }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'tickHabit',
      args: { name: 'Reminder simulation completed' },
      description:
        'Complete the target before the configured reminder; the native planner suppresses today.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT count FROM habit_completions WHERE habit_id = (SELECT id FROM habits WHERE name = 'Reminder simulation completed' AND deleted_at IS NULL) ORDER BY date_key DESC LIMIT 1",
          expected: [{ count: 1 }],
        },
      ],
    },
    {
      kind: 'expectOracle',
      note: 'All four representative reminder configurations persisted as independent habits.',
      oracle: {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM habits WHERE name LIKE 'Reminder simulation %' AND deleted_at IS NULL",
        expected: [{ n: 4 }],
      },
    },
  ],
});
