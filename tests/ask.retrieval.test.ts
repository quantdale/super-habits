import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AskRetrievalError,
  retrieveCalorieSummary,
  retrieveHabitStreak,
  retrievePendingTodos,
} from '@/features/command/ask.retrieval';

const { getCalorieSummaryByRange } = vi.hoisted(() => ({
  getCalorieSummaryByRange: vi.fn(),
}));
const { listHabits, getCompletionHistory } = vi.hoisted(() => ({
  listHabits: vi.fn(),
  getCompletionHistory: vi.fn(),
}));
const { countPendingTodos, listPendingTodos } = vi.hoisted(() => ({
  countPendingTodos: vi.fn(),
  listPendingTodos: vi.fn(),
}));

vi.mock('@/features/calories/calories.data', () => ({ getCalorieSummaryByRange }));
vi.mock('@/features/habits/habits.data', () => ({ listHabits, getCompletionHistory }));
vi.mock('@/features/todos/todos.data', () => ({ countPendingTodos, listPendingTodos }));

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

      const facts = await retrieveCalorieSummary('2026-04-16', '2026-04-17');

      expect(facts).toEqual({
        totalCalories: 1800,
        entryCount: 2,
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

      expect(getCompletionHistory).toHaveBeenCalledWith('habit_1', 30);
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
});
