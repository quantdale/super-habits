import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toDateKey } from '@/lib/time';
import { ALL_HABIT_WEEKDAYS, createHabitRule } from '@/features/habits/habits.domain';
import { freshDatabase, type TestDatabase } from './helpers/db';

function localIso(daysAgo = 0, hour = 12): string {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function localDateKey(daysAgo = 0): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return toDateKey(date);
}

describe('Momentum Garden SQLite read model', () => {
  let db: TestDatabase | null = null;

  beforeEach(async () => {
    db = await freshDatabase();
  });

  afterEach(async () => {
    await db?.closeAsync();
    db = null;
  });

  it('reconstructs representative authoritative rows without changing the outbox', async () => {
    const database = db!;
    const todayKey = localDateKey();
    const todayIso = localIso();
    const habitRule = JSON.stringify([createHabitRule(localDateKey(7), ALL_HABIT_WEEKDAYS, 1)]);

    await database.runAsync(
      `INSERT INTO todos
       (id, title, notes, completed, completed_at, due_date, priority, sort_order,
        recurrence, recurrence_id, created_at, updated_at, deleted_at, project_id, goal_id)
       VALUES (?, ?, NULL, 1, ?, NULL, 'normal', 1, NULL, NULL, ?, ?, NULL, NULL, NULL)`,
      ['todo-live', 'Finish integration fixture', todayIso, todayIso, todayIso],
    );
    await database.runAsync(
      `INSERT INTO todos
       (id, title, notes, completed, completed_at, due_date, priority, sort_order,
        recurrence, recurrence_id, created_at, updated_at, deleted_at, project_id, goal_id)
       VALUES (?, ?, NULL, 1, ?, NULL, 'normal', 2, NULL, NULL, ?, ?, ?, NULL, NULL)`,
      ['todo-deleted', 'Deleted task', todayIso, todayIso, todayIso, todayIso],
    );
    await database.runAsync(
      `INSERT INTO habits
       (id, name, target_per_day, reminder_time, category, icon, color, rule_history,
        project_id, goal_id, created_at, updated_at, deleted_at, status, lifecycle_history)
       VALUES (?, ?, 1, NULL, 'anytime', 'menu-book', '#16a34a', ?, NULL, NULL, ?, ?, NULL, 'active', NULL)`,
      ['habit-live', 'Read', habitRule, localIso(7), localIso(7)],
    );
    await database.runAsync(
      `INSERT INTO habit_completions
       (id, habit_id, date_key, count, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
      ['hcmp-live', 'habit-live', todayKey, todayIso, todayIso],
    );
    await database.runAsync(
      `INSERT INTO pomodoro_sessions
       (id, started_at, ended_at, duration_seconds, session_type, created_at)
       VALUES (?, ?, ?, 1500, 'focus', ?)`,
      ['pom-live', localIso(0, 9), localIso(0, 9), todayIso],
    );
    await database.runAsync(
      `INSERT INTO pomodoro_sessions
       (id, started_at, ended_at, duration_seconds, session_type, created_at)
       VALUES (?, ?, ?, 0, 'focus', ?)`,
      ['pom-incomplete', localIso(0, 10), localIso(0, 10), todayIso],
    );
    await database.runAsync(
      `INSERT INTO workout_routines
       (id, name, description, created_at, updated_at, deleted_at)
       VALUES (?, 'Strength', NULL, ?, ?, NULL)`,
      ['routine-live', todayIso, todayIso],
    );
    await database.runAsync(
      `INSERT INTO workout_logs (id, routine_id, notes, completed_at, created_at)
       VALUES (?, ?, NULL, ?, ?)`,
      ['workout-live', 'routine-live', todayIso, todayIso],
    );
    await database.runAsync(
      `INSERT INTO calorie_entries
       (id, food_name, calories, protein, carbs, fats, fiber, meal_type,
        consumed_on, created_at, updated_at, deleted_at)
       VALUES (?, 'Lunch', 1, 0, 0, 0, 0, 'lunch', ?, ?, ?, NULL)`,
      ['cal-live', todayKey, todayIso, todayIso],
    );
    await database.runAsync(
      `INSERT INTO calorie_entries
       (id, food_name, calories, protein, carbs, fats, fiber, meal_type,
        consumed_on, created_at, updated_at, deleted_at)
       VALUES (?, 'Deleted meal', 1, 0, 0, 0, 0, 'lunch', ?, ?, ?, ?)`,
      ['cal-deleted', todayKey, todayIso, todayIso, todayIso],
    );
    await database.runAsync(
      `INSERT INTO daily_plans
       (id, date_key, intention, top_todo_ids, top_todo_titles, focus_target_minutes,
        notes, reflection, energy_score, status, completed_at, created_at, updated_at, deleted_at)
       VALUES (?, ?, 'Ship', '[]', '[]', 25, '', 'Done', 4, 'completed', ?, ?, ?, NULL)`,
      ['plan-live', todayKey, todayIso, todayIso, todayIso],
    );
    await database.runAsync(
      `INSERT INTO weekly_reviews
       (id, week_key, week_start_date, week_end_date, next_week_start_date,
        completed_at, status, summary_payload, plan_payload, reflection,
        created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, 'completed', '{}', '{}', 'Good', ?, ?, NULL)`,
      [
        'review-live',
        todayKey,
        localDateKey(6),
        todayKey,
        localDateKey(-1),
        todayIso,
        todayIso,
        todayIso,
      ],
    );
    await database.runAsync(
      `INSERT INTO projects
       (id, name, description, color, status, target_date, sort_order, created_at, updated_at, deleted_at, completed_at)
       VALUES (?, 'Launch', NULL, '#16a34a', 'completed', NULL, 1, ?, ?, NULL, ?)`,
      ['project-live', todayIso, todayIso, todayIso],
    );
    await database.runAsync(
      `INSERT INTO goals
       (id, project_id, title, description, horizon, target_date, status, completed_at,
        progress_percent, created_at, updated_at, deleted_at)
       VALUES (?, NULL, 'Ship Garden', NULL, 'month', NULL, 'completed', ?, 100, ?, ?, NULL)`,
      ['goal-live', todayIso, todayIso, todayIso],
    );

    const before = (
      await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox')
    )?.count;
    const { getMomentumGarden } = await import('@/features/momentum/momentum.data');
    const model = await getMomentumGarden({ todayKey, days: 7 });
    const after = (
      await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox')
    )?.count;

    expect(model.today.activeSources).toEqual([
      'tasks',
      'habits',
      'focus',
      'workout',
      'nutrition',
      'planning',
      'review',
    ]);
    expect(model.milestones.map((milestone) => milestone.label)).toEqual([
      'Goal completed: Ship Garden',
      'Project completed: Launch',
    ]);
    expect(before).toBe(after);
  });

  it('uses local date boundaries and excludes soft-deleted or out-of-window rows', async () => {
    const database = db!;
    const todayKey = localDateKey();
    const todayIso = localIso();
    const outsideIso = localIso(8);
    await database.runAsync(
      `INSERT INTO todos
       (id, title, notes, completed, completed_at, due_date, priority, sort_order,
        recurrence, recurrence_id, created_at, updated_at, deleted_at, project_id, goal_id)
       VALUES (?, 'Inside', NULL, 1, ?, NULL, 'normal', 1, NULL, NULL, ?, ?, NULL, NULL, NULL),
              (?, 'Outside', NULL, 1, ?, NULL, 'normal', 2, NULL, NULL, ?, ?, NULL, NULL, NULL),
              (?, 'Deleted', NULL, 1, ?, NULL, 'normal', 3, NULL, NULL, ?, ?, ?, NULL, NULL)`,
      [
        'todo-inside',
        todayIso,
        todayIso,
        todayIso,
        'todo-outside',
        outsideIso,
        outsideIso,
        outsideIso,
        'todo-deleted',
        todayIso,
        todayIso,
        todayIso,
        todayIso,
      ],
    );

    const { getMomentumGarden } = await import('@/features/momentum/momentum.data');
    const model = await getMomentumGarden({ todayKey, days: 7 });

    expect(model.today.contributions.tasks.level).toBe(1);
    expect(model.days.some((day) => day.hasGrowth && day.dateKey === localDateKey(8))).toBe(false);
    expect(model.days).toHaveLength(7);
  });
});
