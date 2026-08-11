import {
  countCalorieEntriesByRange,
  getCalorieSummaryByRange,
} from '@/features/calories/calories.data';
import { caloriesTotal } from '@/features/calories/calories.domain';
import { getCompletionHistory, listHabits } from '@/features/habits/habits.data';
import {
  buildDayCompletions,
  calculateCurrentStreak,
  calculateLongestStreak,
} from '@/features/habits/habits.domain';
import { countPendingTodos, listPendingTodos } from '@/features/todos/todos.data';
import type {
  AskUnsupportedReasonCode,
  CalorieSummaryFacts,
  HabitStreakFacts,
  PendingTodosFacts,
} from './ask.types';

export class AskRetrievalError extends Error {
  reasonCode: AskUnsupportedReasonCode;

  constructor(reasonCode: AskUnsupportedReasonCode, message: string) {
    super(message);
    this.reasonCode = reasonCode;
  }
}

export async function retrievePendingTodos(): Promise<PendingTodosFacts> {
  const [count, todos] = await Promise.all([countPendingTodos(), listPendingTodos()]);
  return {
    count,
    titles: todos.map((todo) => todo.title),
  };
}

export async function retrieveCalorieSummary(
  startDateKey: string,
  endDateKey: string,
): Promise<CalorieSummaryFacts> {
  const [summaries, entryCount] = await Promise.all([
    getCalorieSummaryByRange(startDateKey, endDateKey),
    countCalorieEntriesByRange(startDateKey, endDateKey),
  ]);
  const totalCalories = caloriesTotal(
    summaries.map((summary) => ({ calories: summary.totalCalories })),
  );
  return {
    totalCalories,
    entryCount,
    startDateKey,
    endDateKey,
  };
}

async function computeHabitStreaks(habitId: string, targetPerDay: number, ruleHistory?: string) {
  const completions = await getCompletionHistory(habitId);
  const dayCompletions = buildDayCompletions(completions, targetPerDay, undefined, ruleHistory);
  return {
    currentStreak: calculateCurrentStreak(dayCompletions),
    longestStreak: calculateLongestStreak(dayCompletions),
  };
}

export async function retrieveHabitStreak(habitName: string | null): Promise<HabitStreakFacts> {
  const habits = await listHabits();

  if (!habitName) {
    const habitSummaries = await Promise.all(
      habits.map(async (habit) => {
        const streaks = await computeHabitStreaks(
          habit.id,
          habit.target_per_day,
          habit.rule_history,
        );
        return {
          habitName: habit.name,
          currentStreak: streaks.currentStreak,
          longestStreak: streaks.longestStreak,
        };
      }),
    );
    return { scope: 'overall', habits: habitSummaries };
  }

  const normalizedName = habitName.trim().toLowerCase();
  const habit = habits.find((candidate) => candidate.name.trim().toLowerCase() === normalizedName);

  if (!habit) {
    throw new AskRetrievalError('habit_not_found', `No habit named "${habitName}" was found.`);
  }

  const streaks = await computeHabitStreaks(habit.id, habit.target_per_day, habit.rule_history);
  return {
    scope: 'single',
    habitName: habit.name,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
  };
}
