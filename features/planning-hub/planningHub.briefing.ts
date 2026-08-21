/**
 * Cross-surface "Today" briefing composition for the Planning Hub.
 * Read-only aggregation from existing feature data layers with bounded
 * queries; no writes and no direct DB access.
 */
import { toDateKey } from '@/lib/time';
import { listTodos } from '@/features/todos/todos.data';
import { listPomodoroSessionsForDateRange } from '@/features/pomodoro/pomodoro.data';
import { countActiveProjects } from '@/features/projects/projects.data';
import { countActiveGoals } from '@/features/goals/goals.data';
import { getDailyPlan } from '@/features/daily-plan/dailyPlan.data';
import { parseTopTodoIds } from '@/features/daily-plan/dailyPlan.domain';

export type PlanProgress = {
  /** Priorities already completed. */
  done: number;
  /** Total priorities on today's plan. */
  total: number;
};

export type TodayBriefing = {
  dateKey: string;
  overdueTodoCount: number;
  dueTodayTodoCount: number;
  /** null when no plan exists yet for today. */
  planProgress: PlanProgress | null;
  activeProjectCount: number;
  activeGoalCount: number;
  /** Focus minutes logged yesterday across all session types. */
  yesterdayFocusMinutes: number;
};

function shiftDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export async function buildTodayBriefing(todayKey: string = toDateKey()): Promise<TodayBriefing> {
  const yesterdayKey = shiftDateKey(todayKey, -1);

  const [todos, sessions, projectCount, goalCount, plan] = await Promise.all([
    listTodos(),
    listPomodoroSessionsForDateRange(yesterdayKey, yesterdayKey),
    countActiveProjects(),
    countActiveGoals(),
    getDailyPlan(todayKey),
  ]);

  const openTodos = todos.filter((t) => t.completed === 0);
  const overdueTodoCount = openTodos.filter(
    (t) => t.due_date !== null && t.due_date < todayKey,
  ).length;
  const dueTodayTodoCount = openTodos.filter((t) => t.due_date === todayKey).length;

  let planProgress: PlanProgress | null = null;
  if (plan) {
    const topIds = parseTopTodoIds(plan.top_todo_ids);
    const completedSet = new Set(todos.filter((t) => t.completed === 1).map((t) => t.id));
    planProgress = {
      done: topIds.filter((id) => completedSet.has(id)).length,
      total: topIds.length,
    };
  }

  const yesterdayFocusMinutes = Math.round(
    sessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 60,
  );

  return {
    dateKey: todayKey,
    overdueTodoCount,
    dueTodayTodoCount,
    planProgress,
    activeProjectCount: projectCount,
    activeGoalCount: goalCount,
    yesterdayFocusMinutes,
  };
}
