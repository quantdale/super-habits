import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AskRetrievalError,
  retrieveCalorieSummary,
  retrieveDailyOverview,
  retrieveFocusSummary,
  retrieveHabitProgress,
  retrieveHabitStreak,
  retrievePendingTodos,
  retrieveWorkoutSummary,
} from '@/features/command/ask.retrieval';

const { getCalorieSummaryByRange, countCalorieEntriesByRange } = vi.hoisted(() => ({
  getCalorieSummaryByRange: vi.fn(),
  countCalorieEntriesByRange: vi.fn(),
}));
const { listHabits, getCompletionHistory, getAllHabitCompletionsForRange } = vi.hoisted(() => ({
  listHabits: vi.fn(),
  getCompletionHistory: vi.fn(),
  getAllHabitCompletionsForRange: vi.fn(),
}));
const { countCompletedTodos, countPendingTodos, listPendingTodos } = vi.hoisted(() => ({
  countCompletedTodos: vi.fn(),
  countPendingTodos: vi.fn(),
  listPendingTodos: vi.fn(),
}));
const { listRoutines, listWorkoutLogsForRange } = vi.hoisted(() => ({
  listRoutines: vi.fn(),
  listWorkoutLogsForRange: vi.fn(),
}));
const { listPomodoroSessionsForDateRange } = vi.hoisted(() => ({
  listPomodoroSessionsForDateRange: vi.fn(),
}));

vi.mock('@/features/calories/calories.data', () => ({
  getCalorieSummaryByRange,
  countCalorieEntriesByRange,
}));
vi.mock('@/features/habits/habits.data', () => ({
  listHabits,
  getCompletionHistory,
  getAllHabitCompletionsForRange,
}));
vi.mock('@/features/todos/todos.data', () => ({
  countCompletedTodos,
  countPendingTodos,
  listPendingTodos,
}));
vi.mock('@/features/workout/workout.data', () => ({ listRoutines, listWorkoutLogsForRange }));
vi.mock('@/features/pomodoro/pomodoro.data', () => ({ listPomodoroSessionsForDateRange }));

describe('features/command/ask.retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('retrievePendingTodos', () => {
    it('returns a plain fact object, not raw todo rows', async () => {
      countPendingTodos.mockResolvedValue(2);
      listPendingTodos.mockResolvedValue([
        { id: 'todo_1', title: 'Call mom' },
        { id: 'todo_2', title: 'Pay rent' },
      ]);

      const facts = await retrievePendingTodos();

      expect(facts).toEqual({ count: 2, titles: ['Call mom', 'Pay rent'] });
      expect(facts).not.toHaveProperty('id');
    });

    it('applies bounded due and priority filters locally', async () => {
      countPendingTodos.mockResolvedValue(1);
      listPendingTodos.mockResolvedValue([
        {
          id: 'todo_1',
          title: 'Submit report',
          completed: 0,
          due_date: '2026-04-16',
          priority: 'urgent',
        },
      ]);

      await expect(
        retrievePendingTodos({ due: 'overdue', priority: 'urgent', todayDateKey: '2026-04-17' }),
      ).resolves.toEqual({ count: 1, titles: ['Submit report'] });
      expect(countPendingTodos).toHaveBeenCalledWith({
        due: 'overdue',
        priority: 'urgent',
        todayDateKey: '2026-04-17',
      });
      expect(listPendingTodos).toHaveBeenCalledWith({
        due: 'overdue',
        priority: 'urgent',
        todayDateKey: '2026-04-17',
        limit: 50,
      });
    });
  });

  describe('retrieveCalorieSummary', () => {
    it('sums calories across the range without exposing individual entries', async () => {
      getCalorieSummaryByRange.mockResolvedValue([
        {
          dateKey: '2026-04-16',
          totalCalories: 1200,
          totalProtein: 80,
          totalCarbs: 100,
          totalFats: 40,
          totalFiber: 10,
        },
        {
          dateKey: '2026-04-17',
          totalCalories: 600,
          totalProtein: 30,
          totalCarbs: 60,
          totalFats: 20,
          totalFiber: 5,
        },
      ]);
      // Three raw entries logged across the two summarized days: the fact
      // must report the true entry count (3), not the day-count (2).
      countCalorieEntriesByRange.mockResolvedValue(3);

      const facts = await retrieveCalorieSummary('2026-04-16', '2026-04-17');

      expect(countCalorieEntriesByRange).toHaveBeenCalledWith('2026-04-16', '2026-04-17');
      expect(facts).toEqual({
        totalCalories: 1800,
        totalProtein: 110,
        totalCarbs: 160,
        totalFats: 60,
        totalFiber: 15,
        entryCount: 3,
        startDateKey: '2026-04-16',
        endDateKey: '2026-04-17',
      });
    });
  });

  describe('retrieveHabitStreak', () => {
    it('resolves a named habit case-insensitively and computes its streak', async () => {
      listHabits.mockResolvedValue([{ id: 'habit_1', name: 'Drink Water', target_per_day: 1 }]);
      getCompletionHistory.mockResolvedValue([
        { habit_id: 'habit_1', date_key: '2026-04-16', count: 1 },
      ]);

      const facts = await retrieveHabitStreak('drink water');

      expect(getCompletionHistory).toHaveBeenCalledWith('habit_1');
      expect(facts).toEqual({
        scope: 'single',
        habitName: 'Drink Water',
        currentStreak: expect.any(Number),
        longestStreak: expect.any(Number),
      });
    });

    it('throws AskRetrievalError with habit_not_found when no habit matches', async () => {
      listHabits.mockResolvedValue([{ id: 'habit_1', name: 'Drink Water', target_per_day: 1 }]);

      await expect(retrieveHabitStreak('run 5k')).rejects.toMatchObject({
        reasonCode: 'habit_not_found',
      });
      await expect(retrieveHabitStreak('run 5k')).rejects.toBeInstanceOf(AskRetrievalError);
    });

    it('returns an overall summary across all habits when no name is given', async () => {
      listHabits.mockResolvedValue([
        { id: 'habit_1', name: 'Drink Water', target_per_day: 1 },
        { id: 'habit_2', name: 'Read', target_per_day: 1 },
      ]);
      getCompletionHistory.mockResolvedValue([]);

      const facts = await retrieveHabitStreak(null);

      expect(facts).toEqual({
        scope: 'overall',
        habits: [
          { habitName: 'Drink Water', currentStreak: 0, longestStreak: 0 },
          { habitName: 'Read', currentStreak: 0, longestStreak: 0 },
        ],
      });
    });
  });

  describe('retrieveHabitProgress', () => {
    it('uses the canonical insight domain with one bounded completion range', async () => {
      listHabits.mockResolvedValue([
        {
          id: 'habit_1',
          name: 'Gym',
          target_per_day: 1,
          rule_history: null,
          created_at: '2026-01-01T00:00:00.000Z',
          deleted_at: null,
        },
      ]);
      getAllHabitCompletionsForRange.mockResolvedValue([
        { habit_id: 'habit_1', date_key: '2026-04-17', count: 1 },
      ]);

      const facts = await retrieveHabitProgress('gym', '2026-04-16', '2026-04-17');

      expect(getAllHabitCompletionsForRange).toHaveBeenCalledWith('2025-04-17', '2026-04-17');
      expect(facts).toMatchObject({
        scope: 'single',
        startDateKey: '2026-04-16',
        endDateKey: '2026-04-17',
        habits: [
          expect.objectContaining({
            habitName: 'Gym',
            currentActual: 1,
          }),
        ],
      });
    });
  });

  describe('workout and focus summaries', () => {
    it('returns bounded routine frequency and last session facts', async () => {
      listRoutines.mockResolvedValue([{ id: 'routine_1', name: 'Push Day', deleted_at: null }]);
      listWorkoutLogsForRange.mockResolvedValue([
        { routine_id: 'routine_1', completed_at: '2026-04-17T08:00:00.000Z' },
        { routine_id: 'routine_1', completed_at: '2026-04-16T08:00:00.000Z' },
      ]);

      await expect(retrieveWorkoutSummary(null, '2026-04-16', '2026-04-17')).resolves.toEqual({
        startDateKey: '2026-04-16',
        endDateKey: '2026-04-17',
        sessionCount: 2,
        lastSession: { routineName: 'Push Day', completedAt: '2026-04-17T08:00:00.000Z' },
        routineFrequency: [{ routineName: 'Push Day', sessionCount: 2 }],
      });
    });

    it('returns completed focus session count and total bounded minutes', async () => {
      listPomodoroSessionsForDateRange.mockResolvedValue([
        { session_type: 'focus', duration_seconds: 1500 },
        { session_type: 'short_break', duration_seconds: 300 },
        { session_type: 'focus', duration_seconds: 2700 },
      ]);

      await expect(retrieveFocusSummary('2026-04-17', '2026-04-17')).resolves.toEqual({
        startDateKey: '2026-04-17',
        endDateKey: '2026-04-17',
        completedSessionCount: 2,
        totalFocusedMinutes: 70,
      });
    });
  });

  it('builds a bounded daily overview without exposing raw rows', async () => {
    countPendingTodos.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    countCompletedTodos.mockResolvedValue(1);
    listHabits.mockResolvedValue([]);
    getAllHabitCompletionsForRange.mockResolvedValue([]);
    getCalorieSummaryByRange.mockResolvedValue([
      {
        dateKey: '2026-04-17',
        totalCalories: 500,
        totalProtein: 20,
        totalCarbs: 40,
        totalFats: 10,
        totalFiber: 5,
      },
    ]);
    countCalorieEntriesByRange.mockResolvedValue(1);
    listPomodoroSessionsForDateRange.mockResolvedValue([]);
    listRoutines.mockResolvedValue([]);
    listWorkoutLogsForRange.mockResolvedValue([]);

    const facts = await retrieveDailyOverview('2026-04-17');

    expect(countPendingTodos).toHaveBeenCalledWith();
    expect(countPendingTodos).toHaveBeenCalledWith({
      due: 'overdue',
      todayDateKey: '2026-04-17',
    });
    expect(countCompletedTodos).toHaveBeenCalledWith();

    expect(facts).toEqual({
      dateKey: '2026-04-17',
      todos: { pendingCount: 1, completedCount: 1, overdueCount: 0 },
      habits: { scheduledCount: 0, completedCount: 0, remainingCount: 0 },
      calories: {
        totalCalories: 500,
        totalProtein: 20,
        totalCarbs: 40,
        totalFats: 10,
        totalFiber: 5,
        entryCount: 1,
      },
      focus: { completedSessionCount: 0, totalFocusedMinutes: 0 },
      workout: { sessionCount: 0 },
    });
  });
});
