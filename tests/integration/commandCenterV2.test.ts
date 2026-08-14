import { describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import type { DraftLogCalorieEntry } from '@/features/command/types';

describe('Command Center V2 canonical SQLite execution', () => {
  it('keeps supplied-nutrition rules while allowing a missing calorie correction', async () => {
    const db = await freshDatabase();

    try {
      const commandDomain = await import('@/features/command/command.domain');
      const commandReview = await import('@/features/command/command.review');
      const parsed = commandDomain.parseCommandDraft({
        rawText: 'I ate chicken breast',
        now: new Date(),
        locale: 'en-US',
        timeZone: 'Asia/Manila',
        todayDateKey: '2026-08-14',
        tomorrowDateKey: '2026-08-15',
      });
      expect(parsed.outcome).toBe('draft');
      if (parsed.outcome !== 'draft' || parsed.draft.kind !== 'log_calorie_entry') return;

      const missing = await commandReview.prepareCommandReview(parsed.draft);
      expect(missing.status).toBe('needs_input');
      expect(missing.preview.rows).toContainEqual({ label: 'Calories', value: 'Needs calories' });
      const calorieDraft = missing.draft as DraftLogCalorieEntry;
      const corrected = await commandReview.prepareCommandReview({
        ...calorieDraft,
        fields: { ...calorieDraft.fields, calories: 300 },
      });
      expect(corrected.status).toBe('ready');
      expect(
        await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM calorie_entries'),
      ).toEqual({ count: 0 });
    } finally {
      await closeDatabase(db);
    }
  });

  it('turns an ambiguous Todo choice into a ready review without writing', async () => {
    const db = await freshDatabase();

    try {
      const commandDomain = await import('@/features/command/command.domain');
      const commandReview = await import('@/features/command/command.review');
      const todos = await import('@/features/todos/todos.data');

      const firstId = await todos.addTodo({ title: 'Buy groceries' });
      const secondId = await todos.addTodo({ title: 'Buy groceries' });
      const parsed = commandDomain.parseCommandDraft({
        rawText: 'complete Buy groceries',
        now: new Date(),
        locale: 'en-US',
        timeZone: 'Asia/Manila',
        todayDateKey: '2026-08-14',
        tomorrowDateKey: '2026-08-15',
      });
      expect(parsed.outcome).toBe('draft');
      if (parsed.outcome !== 'draft') return;

      const ambiguous = await commandReview.prepareCommandReview(parsed.draft);
      expect(ambiguous.status).toBe('needs_input');
      expect(ambiguous.resolution?.status).toBe('ambiguous');

      const selected = await commandReview.prepareCommandReview(ambiguous.draft, {
        selectedEntityId: firstId,
      });
      expect(selected.status).toBe('ready');
      expect(selected.resolvedEntityId).toBe(firstId);
      expect(selected.resolution?.status).toBe('exact');
      expect(
        await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM todos'),
      ).toEqual({ count: 2 });
      expect(secondId).not.toBe(firstId);
    } finally {
      await closeDatabase(db);
    }
  });

  it('blocks Habit logging on an effective off-day without writing progress', async () => {
    const db = await freshDatabase();

    try {
      const commandDomain = await import('@/features/command/command.domain');
      const commandReview = await import('@/features/command/command.review');
      const habits = await import('@/features/habits/habits.data');

      const habitId = await habits.addHabit(
        'Weekend run',
        1,
        'anytime',
        'fitness-center',
        '#22c55e',
        [6, 7],
      );
      const now = new Date('2026-08-14T09:00:00.000+08:00');
      const parsed = commandDomain.parseCommandDraft({
        rawText: 'add one to Weekend run',
        now,
        locale: 'en-US',
        timeZone: 'Asia/Manila',
        todayDateKey: '2026-08-14',
        tomorrowDateKey: '2026-08-15',
      });
      expect(parsed.outcome).toBe('draft');
      if (parsed.outcome !== 'draft' || parsed.draft.kind !== 'log_habit') return;

      const review = await commandReview.prepareCommandReview(parsed.draft, { now });
      expect(review.status).toBe('needs_input');
      expect(review.missingFields).toContainEqual(expect.objectContaining({ field: 'schedule' }));
      expect(review.preview.warnings).toContainEqual(expect.objectContaining({ code: 'off_day' }));
      expect(
        await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM habit_completions WHERE habit_id = ?',
          [habitId],
        ),
      ).toEqual({ count: 0 });
    } finally {
      await closeDatabase(db);
    }
  });

  it('keeps parse/review read-only and makes confirmed mutations idempotent', async () => {
    const db = await freshDatabase();

    try {
      const commandDomain = await import('@/features/command/command.domain');
      const commandReview = await import('@/features/command/command.review');
      const commandExecutor = await import('@/features/command/command.executor');
      const todos = await import('@/features/todos/todos.data');
      const habits = await import('@/features/habits/habits.data');
      const workout = await import('@/features/workout/workout.data');
      const linked = await import('@/core/linked-actions/linkedActions.data');

      const sourceTodoId = await todos.addTodo({ title: 'Buy groceries' });
      const targetHabitId = await habits.addHabit('Drink water', 1);
      await linked.createLinkedActionRule({
        source: {
          feature: 'todos',
          entityType: 'todo',
          entityId: sourceTodoId,
          triggerType: 'todo.completed',
        },
        target: {
          feature: 'habits',
          entityType: 'habit',
          entityId: targetHabitId,
          effect: {
            kind: 'progress',
            type: 'habit.increment',
            amount: 1,
            dateStrategy: 'source_date',
          },
        },
      });

      const input = {
        rawText: 'complete Buy groceries',
        now: new Date(),
        locale: 'en-US',
        timeZone: 'Asia/Manila',
        todayDateKey: '2026-08-14',
        tomorrowDateKey: '2026-08-15',
      };
      const parsed = commandDomain.parseCommandDraft(input);
      expect(parsed.outcome).toBe('draft');
      if (parsed.outcome !== 'draft') return;

      expect(
        await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM todos'),
      ).toEqual({
        count: 1,
      });
      const review = await commandReview.prepareCommandReview(parsed.draft, { now: input.now });
      expect(review.status).toBe('ready');
      const revalidatedReview = await commandReview.prepareCommandReview(review.draft, {
        now: input.now,
      });
      expect(revalidatedReview.executionToken).toBe(review.executionToken);
      expect(
        await db.getFirstAsync<{ completed: number }>('SELECT completed FROM todos WHERE id = ?', [
          sourceTodoId,
        ]),
      ).toEqual({
        completed: 0,
      });

      const first = await commandExecutor.executeDraftAction(revalidatedReview.draft, {
        executionToken: revalidatedReview.executionToken,
        resolvedEntityId: revalidatedReview.resolvedEntityId,
      });
      const duplicate = await commandExecutor.executeDraftAction(revalidatedReview.draft, {
        executionToken: revalidatedReview.executionToken,
        resolvedEntityId: revalidatedReview.resolvedEntityId,
      });
      expect(first).toMatchObject({ outcome: 'success', kind: 'complete_todo' });
      expect(duplicate).toMatchObject({ outcome: 'duplicate' });
      expect(
        await db.getFirstAsync<{ completed: number }>('SELECT completed FROM todos WHERE id = ?', [
          sourceTodoId,
        ]),
      ).toEqual({
        completed: 1,
      });
      expect(
        await db.getFirstAsync<{ count: number }>(
          'SELECT count FROM habit_completions WHERE habit_id = ?',
          [targetHabitId],
        ),
      ).toEqual({
        count: 1,
      });
      expect(
        await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM linked_action_executions',
        ),
      ).toEqual({
        count: 1,
      });

      const habitDraftResult = commandDomain.parseCommandDraft({
        ...input,
        rawText: 'add one to Drink water',
      });
      expect(habitDraftResult.outcome).toBe('draft');
      if (habitDraftResult.outcome !== 'draft') return;
      const habitReview = await commandReview.prepareCommandReview(habitDraftResult.draft, {
        now: input.now,
      });
      expect(habitReview.status).toBe('ready');
      const habitFirst = await commandExecutor.executeDraftAction(habitReview.draft, {
        executionToken: habitReview.executionToken,
        resolvedEntityId: habitReview.resolvedEntityId,
      });
      const habitDuplicate = await commandExecutor.executeDraftAction(habitReview.draft, {
        executionToken: habitReview.executionToken,
        resolvedEntityId: habitReview.resolvedEntityId,
      });
      expect(habitFirst).toMatchObject({ outcome: 'success', kind: 'log_habit' });
      expect(habitDuplicate).toMatchObject({ outcome: 'duplicate' });
      expect(
        await db.getFirstAsync<{ count: number }>(
          'SELECT count FROM habit_completions WHERE habit_id = ?',
          [targetHabitId],
        ),
      ).toEqual({
        count: 2,
      });

      const calorieDraftResult = commandDomain.parseCommandDraft({
        ...input,
        rawText: 'add lunch: tuna sandwich, 420 calories, 30g protein',
      });
      expect(calorieDraftResult.outcome).toBe('draft');
      if (calorieDraftResult.outcome !== 'draft') return;
      const calorieReview = await commandReview.prepareCommandReview(calorieDraftResult.draft, {
        now: input.now,
      });
      const calorieFirst = await commandExecutor.executeDraftAction(calorieReview.draft, {
        executionToken: calorieReview.executionToken,
      });
      const calorieDuplicate = await commandExecutor.executeDraftAction(calorieReview.draft, {
        executionToken: calorieReview.executionToken,
      });
      expect(calorieFirst).toMatchObject({ outcome: 'success', kind: 'log_calorie_entry' });
      expect(calorieDuplicate).toMatchObject({ outcome: 'duplicate' });
      expect(
        await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM calorie_entries'),
      ).toEqual({
        count: 1,
      });
      expect(
        await db.getFirstAsync<{ use_count: number }>(
          'SELECT use_count FROM saved_meals WHERE food_name = ?',
          ['tuna sandwich'],
        ),
      ).toEqual({
        use_count: 1,
      });

      await workout.addRoutine('Push Day', '');
      const routine = (await workout.listRoutines())[0];
      const workoutDraftResult = commandDomain.parseCommandDraft({
        ...input,
        rawText: 'log Push Day workout',
      });
      expect(workoutDraftResult.outcome).toBe('draft');
      if (workoutDraftResult.outcome !== 'draft') return;
      const workoutReview = await commandReview.prepareCommandReview(workoutDraftResult.draft, {
        now: input.now,
      });
      const workoutFirst = await commandExecutor.executeDraftAction(workoutReview.draft, {
        executionToken: workoutReview.executionToken,
        resolvedEntityId: workoutReview.resolvedEntityId,
      });
      const workoutDuplicate = await commandExecutor.executeDraftAction(workoutReview.draft, {
        executionToken: workoutReview.executionToken,
        resolvedEntityId: workoutReview.resolvedEntityId,
      });
      expect(workoutFirst).toMatchObject({ outcome: 'success', kind: 'log_workout_routine' });
      expect(workoutDuplicate).toMatchObject({ outcome: 'duplicate' });
      expect(
        await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM workout_logs WHERE routine_id = ?',
          [routine.id],
        ),
      ).toEqual({
        count: 1,
      });
    } finally {
      await closeDatabase(db);
    }
  });
});

async function closeDatabase(db: TestDatabase): Promise<void> {
  await db.closeAsync();
}
