import { describe, expect, it } from 'vitest';
import type { Habit, Todo, WorkoutRoutine } from '@/core/db/types';
import { parseCommandDraft } from '@/features/command/command.domain';
import {
  resolveHabitReference,
  resolveTodoReference,
  resolveWorkoutRoutineReference,
} from '@/features/command/command.resolver';
import {
  COMMAND_MAX_CALORIES,
  validateCommandDraftFields,
} from '@/features/command/command.validation';
import type { ParseCommandInput } from '@/features/command/types';

const INPUT: ParseCommandInput = {
  rawText: '',
  now: new Date(2026, 3, 21, 9, 0, 0),
  locale: 'en-US',
  timeZone: 'Asia/Manila',
  todayDateKey: '2026-04-21',
  tomorrowDateKey: '2026-04-22',
};

function baseTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'todo_1',
    title: 'Buy groceries',
    notes: null,
    completed: 0,
    due_date: null,
    priority: 'normal',
    sort_order: 1,
    recurrence: null,
    recurrence_id: null,
    created_at: '2026-04-20T00:00:00.000Z',
    updated_at: '2026-04-20T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function baseHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit_1',
    name: 'Gym',
    target_per_day: 1,
    reminder_time: null,
    category: 'anytime',
    icon: 'fitness-center',
    color: '#000000',
    created_at: '2026-04-20T00:00:00.000Z',
    updated_at: '2026-04-20T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function baseRoutine(overrides: Partial<WorkoutRoutine> = {}): WorkoutRoutine {
  return {
    id: 'routine_1',
    name: 'Push Day',
    description: null,
    created_at: '2026-04-20T00:00:00.000Z',
    updated_at: '2026-04-20T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('Command Center V2 deterministic contracts', () => {
  it.each([
    ['complete Buy groceries', 'complete_todo'],
    ['add one to Pushups', 'log_habit'],
    ['add lunch: tuna sandwich, 420 calories', 'log_calorie_entry'],
    ['log Push Day workout', 'log_workout_routine'],
    ['I finished Push Day', 'log_workout_routine'],
    ['start a 45 minute focus session', 'start_focus_session'],
    ['focus for 45 minutes', 'start_focus_session'],
  ])('parses %s as %s', (rawText, kind) => {
    const result = parseCommandDraft({ ...INPUT, rawText });
    expect(result.outcome).toBe('draft');
    if (result.outcome !== 'draft') return;
    expect(result.draft.kind).toBe(kind);
    expect(result.draft.status).toBe('ready');
  });

  it('requires supplied calories and never estimates nutrition', () => {
    const result = parseCommandDraft({ ...INPUT, rawText: 'I ate chicken breast' });
    expect(result.outcome).toBe('draft');
    if (result.outcome !== 'draft') return;
    expect(result.draft.kind).toBe('log_calorie_entry');
    if (result.draft.kind !== 'log_calorie_entry') return;
    expect(result.draft.status).toBe('needs_input');
    expect(result.draft.fields.calories).toBeNull();
    expect(result.draft.fields.protein).toBeNull();
    expect(result.draft.missingFields).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'calories' })]),
    );

    const incomplete = parseCommandDraft({ ...INPUT, rawText: 'log chicken breast calories' });
    expect(incomplete.outcome).toBe('draft');
    if (incomplete.outcome !== 'draft') return;
    expect(incomplete.draft.kind).toBe('log_calorie_entry');
    expect(incomplete.draft.status).toBe('needs_input');
    expect(incomplete.draft.missingFields).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'calories' })]),
    );
  });

  it('rejects calorie values beyond local product bounds', () => {
    const result = parseCommandDraft({
      ...INPUT,
      rawText: `log rice ${COMMAND_MAX_CALORIES + 1} calories`,
    });
    expect(result.outcome).toBe('draft');
    if (result.outcome !== 'draft') return;
    expect(validateCommandDraftFields(result.draft)).toContain('Calories must be');
  });

  it('resolves exact, ambiguous, deleted, and already-complete Todo states', () => {
    const active = [baseTodo(), baseTodo({ id: 'todo_2', title: 'Pay rent' })];
    expect(resolveTodoReference(' buy   groceries ', active)).toMatchObject({ status: 'exact' });
    expect(
      resolveTodoReference('Buy groceries', [baseTodo(), baseTodo({ id: 'todo_2' })]),
    ).toMatchObject({ status: 'ambiguous' });
    expect(
      resolveTodoReference('Buy groceries', [], [baseTodo({ deleted_at: '2026-04-21T00:00:00Z' })]),
    ).toMatchObject({ status: 'deleted' });
    expect(resolveTodoReference('Buy groceries', [baseTodo({ completed: 1 })])).toMatchObject({
      status: 'already_satisfied',
    });
  });

  it('resolves Habit and Workout references only by exact normalized names', () => {
    expect(resolveHabitReference('gym', [baseHabit()])).toMatchObject({ status: 'exact' });
    expect(resolveHabitReference('gym', [baseHabit(), baseHabit({ id: 'habit_2' })])).toMatchObject(
      { status: 'ambiguous' },
    );
    expect(resolveWorkoutRoutineReference('push day', [baseRoutine()])).toMatchObject({
      status: 'exact',
    });
    expect(resolveWorkoutRoutineReference('push', [baseRoutine()])).toMatchObject({
      status: 'not_found',
    });
  });
});
