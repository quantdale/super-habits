import { describe, expect, it } from 'vitest';
import {
  validateBackupRow,
  validateBackupGraph,
  parseHabitRuleHistoryJson,
  parseEffectPayloadJson,
} from '@/core/backup/backupValidators';

const validTodo = {
  id: 'todo_1786782139450_31237563',
  title: 'Test',
  notes: null,
  completed: 0,
  due_date: null,
  priority: 'normal',
  sort_order: 1,
  recurrence: null,
  recurrence_id: null,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
  deleted_at: null,
};

const validHabit = {
  id: 'habit_1786782139450_31237563',
  name: 'Drink water',
  target_per_day: 2,
  reminder_time: null,
  category: 'anytime',
  icon: 'water-drop',
  color: '#0ea5e9',
  rule_history: JSON.stringify([
    { effective_from_date: '2026-08-01', weekdays: [1, 2, 3, 4, 5, 6, 7], target_per_day: 2 },
  ]),
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
  deleted_at: null,
};

const validCompletion = {
  id: 'hcmp_1',
  habit_id: 'habit_1786782139450_31237563',
  date_key: '2026-08-01',
  count: 2,
  created_at: '2026-08-01T08:00:00.000Z',
  updated_at: '2026-08-01T08:00:00.000Z',
};

const validDailyPlan = {
  id: 'plan_1786782139450_31237563',
  date_key: '2026-08-01',
  intention: 'Deep work day',
  top_todo_ids: JSON.stringify(['todo_1786782139450_31237563']),
  top_todo_titles: JSON.stringify(['Test']),
  focus_target_minutes: 90,
  notes: null,
  reflection: null,
  energy_score: null,
  status: 'draft',
  created_at: '2026-08-01T06:00:00.000Z',
  updated_at: '2026-08-01T06:00:00.000Z',
  deleted_at: null,
  completed_at: null,
};

describe('backup row validators', () => {
  it('accepts well-formed rows for every entity', () => {
    expect(validateBackupRow('todos', validTodo).ok).toBe(true);
    expect(validateBackupRow('habits', validHabit).ok).toBe(true);
    expect(validateBackupRow('habit_completions', validCompletion).ok).toBe(true);
    expect(validateBackupRow('daily_plans', validDailyPlan).ok).toBe(true);
    expect(
      validateBackupRow('pomodoro_sessions', {
        id: 'pom_1',
        started_at: '2026-08-01T09:00:00.000Z',
        ended_at: '2026-08-01T09:25:00.000Z',
        duration_seconds: 1500,
        session_type: 'focus',
        created_at: '2026-08-01T09:25:00.000Z',
      }).ok,
    ).toBe(true);
    expect(
      validateBackupRow('saved_meals', {
        id: 'smeal_1',
        food_name: 'Oats',
        calories: 300,
        protein: 10,
        carbs: 50,
        fats: 5,
        fiber: 4,
        meal_type: 'breakfast',
        use_count: 3,
        last_used_at: '2026-08-01T09:00:00.000Z',
        created_at: '2026-08-01T09:00:00.000Z',
      }).ok,
    ).toBe(true);
    expect(
      validateBackupRow('linked_action_rules', {
        id: 'link_1',
        status: 'active',
        direction_policy: 'one_way',
        bidirectional_group_id: null,
        source_feature: 'todos',
        source_entity_type: 'todo',
        source_entity_id: 'todo_1',
        trigger_type: 'todo.completed',
        target_feature: 'habits',
        target_entity_type: 'habit',
        target_entity_id: null,
        effect_type: 'habit.increment',
        effect_payload: '{"amount":1}',
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
        deleted_at: null,
      }).ok,
    ).toBe(true);
  });

  it('rejects invalid ids, enums, ranges, date keys, and timestamps', () => {
    expect(validateBackupRow('todos', { ...validTodo, id: 'NOT AN ID' }).ok).toBe(false);
    expect(validateBackupRow('todos', { ...validTodo, priority: 'super-urgent' }).ok).toBe(false);
    expect(validateBackupRow('todos', { ...validTodo, completed: 2 }).ok).toBe(false);
    expect(validateBackupRow('habits', { ...validHabit, target_per_day: 0 }).ok).toBe(false);
    expect(
      validateBackupRow('habit_completions', { ...validCompletion, date_key: '2026-13-99' }).ok,
    ).toBe(false);
    expect(validateBackupRow('habit_completions', { ...validCompletion, count: -1 }).ok).toBe(
      false,
    );
    expect(
      validateBackupRow('pomodoro_sessions', {
        id: 'pom_1',
        started_at: 'garbage',
        ended_at: '2026-08-01T09:25:00.000Z',
        duration_seconds: 1500,
        session_type: 'focus',
        created_at: '2026-08-01T09:25:00.000Z',
      }).ok,
    ).toBe(false);
    expect(
      validateBackupRow('pomodoro_sessions', {
        id: 'pom_1',
        started_at: '2026-08-01T09:00:00.000Z',
        ended_at: '2026-08-01T09:25:00.000Z',
        duration_seconds: 1500,
        session_type: 'ultra-focus',
        created_at: '2026-08-01T09:25:00.000Z',
      }).ok,
    ).toBe(false);
    expect(
      validateBackupRow('habit_completions', { ...validCompletion, deleted_at: null }).ok,
    ).toBe(false);
  });

  it('rejects unknown columns (schema drift) and missing fields', () => {
    expect(validateBackupRow('todos', { ...validTodo, evil_column: 1 }).ok).toBe(false);
    expect(validateBackupRow('todos', { ...validTodo, title: undefined }).ok).toBe(false);
  });

  it('rejects malformed rule_history and effect_payload JSON', () => {
    expect(parseHabitRuleHistoryJson('not json').ok).toBe(false);
    expect(parseHabitRuleHistoryJson('{"a":1}').ok).toBe(false);
    expect(
      parseHabitRuleHistoryJson(
        JSON.stringify([{ effective_from_date: 'bad', weekdays: [1], target_per_day: 1 }]),
      ).ok,
    ).toBe(false);
    expect(
      parseHabitRuleHistoryJson(
        JSON.stringify([
          { effective_from_date: '2026-08-01', weekdays: [1, 8], target_per_day: 1 },
        ]),
      ).ok,
    ).toBe(false);
    expect(
      parseHabitRuleHistoryJson(
        JSON.stringify([{ effective_from_date: '2026-08-01', weekdays: [1], target_per_day: 0 }]),
      ).ok,
    ).toBe(false);
    expect(parseEffectPayloadJson('[]').ok).toBe(false);
    expect(parseEffectPayloadJson('{"amount":1}').ok).toBe(true);
    expect(validateBackupRow('habits', { ...validHabit, rule_history: '{}' }).ok).toBe(false);
    expect(
      validateBackupRow('linked_action_rules', {
        ...validHabit,
        status: 'active',
        direction_policy: 'one_way',
        source_feature: 'todos',
        source_entity_type: 'todo',
        trigger_type: 'todo.completed',
        target_feature: 'habits',
        target_entity_type: 'habit',
        effect_type: 'habit.increment',
        effect_payload: '{"amount":',
      }).ok,
    ).toBe(false);
  });

  it('ignores the remote user_id column', () => {
    expect(validateBackupRow('todos', { ...validTodo, user_id: 'user_a' }).ok).toBe(true);
  });
});

describe('backup graph validation', () => {
  it('accepts a consistent graph', () => {
    const errors = validateBackupGraph({
      habits: [validHabit],
      habit_completions: [validCompletion],
      workout_routines: [
        {
          id: 'wrk_1',
          name: 'R',
          description: null,
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-01T00:00:00.000Z',
          deleted_at: null,
        },
      ],
      routine_exercises: [
        {
          id: 'ex_1',
          routine_id: 'wrk_1',
          name: 'Bench',
          sort_order: 1,
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-01T00:00:00.000Z',
          deleted_at: null,
        },
      ],
      routine_exercise_sets: [
        {
          id: 'eset_1',
          exercise_id: 'ex_1',
          set_number: 1,
          active_seconds: 40,
          rest_seconds: 20,
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-01T00:00:00.000Z',
          deleted_at: null,
        },
      ],
      workout_logs: [
        {
          id: 'wrk_log_1',
          routine_id: 'wrk_1',
          notes: null,
          completed_at: '2026-08-01T09:00:00.000Z',
          created_at: '2026-08-01T09:00:00.000Z',
        },
      ],
      workout_session_exercises: [
        {
          id: 'wsex_1',
          log_id: 'wrk_log_1',
          exercise_name: 'Bench',
          sets_completed: 3,
          created_at: '2026-08-01T09:00:00.000Z',
        },
      ],
      saved_meals: [
        {
          id: 'smeal_1',
          food_name: 'Oats',
          calories: 300,
          protein: 0,
          carbs: 0,
          fats: 0,
          fiber: 0,
          meal_type: 'breakfast',
          use_count: 1,
          last_used_at: '2026-08-01T09:00:00.000Z',
          created_at: '2026-08-01T09:00:00.000Z',
        },
      ],
    });
    expect(errors).toEqual([]);
  });

  it('rejects a missing habit parent for a completion', () => {
    const errors = validateBackupGraph({
      habits: [],
      habit_completions: [validCompletion],
    });
    expect(errors.some((e) => e.includes('references missing habit'))).toBe(true);
  });

  it('rejects duplicate (habit_id, date_key) completion keys', () => {
    const errors = validateBackupGraph({
      habits: [validHabit],
      habit_completions: [validCompletion, { ...validCompletion, id: 'hcmp_2' }],
    });
    expect(errors.some((e) => e.includes('duplicate (habit_id, date_key)'))).toBe(true);
  });

  it('rejects duplicate saved-meal food names case-insensitively', () => {
    const base = {
      id: 'smeal_1',
      calories: 300,
      protein: 0,
      carbs: 0,
      fats: 0,
      fiber: 0,
      meal_type: 'breakfast',
      use_count: 1,
      last_used_at: '2026-08-01T09:00:00.000Z',
      created_at: '2026-08-01T09:00:00.000Z',
    };
    const errors = validateBackupGraph({
      saved_meals: [
        { ...base, food_name: 'Oats' },
        { ...base, id: 'smeal_2', food_name: 'oats' },
      ],
    });
    expect(errors.some((e) => e.includes('duplicate food_name'))).toBe(true);
  });

  it('rejects missing workout parents at every level', () => {
    const errors = validateBackupGraph({
      routine_exercises: [
        {
          id: 'ex_1',
          routine_id: 'wrk_missing',
          name: 'Bench',
          sort_order: 1,
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-01T00:00:00.000Z',
          deleted_at: null,
        },
      ],
      workout_logs: [
        {
          id: 'wrk_log_1',
          routine_id: 'wrk_missing',
          notes: null,
          completed_at: '2026-08-01T09:00:00.000Z',
          created_at: '2026-08-01T09:00:00.000Z',
        },
      ],
      workout_session_exercises: [
        {
          id: 'wsex_1',
          log_id: 'wrk_log_missing',
          exercise_name: 'Bench',
          sets_completed: 3,
          created_at: '2026-08-01T09:00:00.000Z',
        },
      ],
    });
    expect(errors.some((e) => e.includes('routine_exercises references missing routine'))).toBe(
      true,
    );
    expect(errors.some((e) => e.includes('workout_logs references missing routine'))).toBe(true);
    expect(errors.some((e) => e.includes('workout_session_exercises references missing log'))).toBe(
      true,
    );
  });

  it('rejects duplicate ids within an entity', () => {
    const errors = validateBackupGraph({
      habits: [validHabit, { ...validHabit }],
    });
    expect(errors.some((e) => e.includes('habits duplicate id'))).toBe(true);
  });
});

describe('daily_plans top_todo_titles snapshots', () => {
  it('accepts a legacy pre-v21 row without the column', () => {
    const { top_todo_titles: _omitted, ...legacy } = validDailyPlan;
    expect(validateBackupRow('daily_plans', legacy).ok).toBe(true);
  });

  it('accepts a null snapshot', () => {
    expect(validateBackupRow('daily_plans', { ...validDailyPlan, top_todo_titles: null }).ok).toBe(
      true,
    );
  });

  it('rejects a non-string snapshot', () => {
    const result = validateBackupRow('daily_plans', {
      ...validDailyPlan,
      top_todo_titles: 42,
    });
    expect(result.ok).toBe(false);
  });
});
