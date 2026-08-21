import { pctDelta, trendOf } from '@/features/progress/progress.domain';
import type { ProgressSummary } from '@/features/progress/progress.types';

/**
 * Deterministic narrative observations for Progress Insights (blueprint §9:
 * 2–4 factual lines rendered above the stat cards, before any chart).
 *
 * Rules:
 * - Pure derivation from a single ProgressSummary — no DB, no React.
 * - Every line states facts only; no praise, no composite score.
 * - A metric with no data in either window is skipped entirely. Percentages
 *   are never invented for windows without a prior baseline (pctDelta null),
 *   and no "scheduled habits" denominator exists in the summary shape, so the
 *   habit line reports completion counts with their percent change instead of
 *   a fabricated completion rate.
 */
export function buildProgressNarrative(summary: ProgressSummary): string[] {
  const observations: string[] = [];

  const habits = summary.habitCompletions;
  if (habits.current > 0 || habits.previous > 0) {
    observations.push(
      describeCountVsPrior(
        'habit check-ins',
        habits.current,
        habits.previous,
        pctDelta(habits.current, habits.previous),
      ),
    );
  }

  const focus = summary.focusMinutes;
  if (focus.current > 0 || focus.previous > 0) {
    const sessions = summary.focusSessions.current;
    const direction = trendOf(focus.current, focus.previous);
    const directionPhrase =
      direction === 'up'
        ? `up from ${focus.previous} minutes prior`
        : direction === 'down'
          ? `down from ${focus.previous} minutes prior`
          : `level with ${focus.previous} minutes prior`;
    observations.push(
      `You focused for ${focus.current} minutes across ${sessions} ${
        sessions === 1 ? 'session' : 'sessions'
      } this window (${directionPhrase}).`,
    );
  }

  const workouts = summary.workoutSessions;
  if (workouts.current > 0 || workouts.previous > 0) {
    observations.push(
      describeCountVsPrior(
        'workouts',
        workouts.current,
        workouts.previous,
        pctDelta(workouts.current, workouts.previous),
      ),
    );
  }

  const todos = summary.todosCompleted;
  if (todos.current > 0 || todos.previous > 0) {
    observations.push(
      describeCountVsPrior(
        'tasks',
        todos.current,
        todos.previous,
        pctDelta(todos.current, todos.previous),
      ),
    );
  }

  return observations.slice(0, 4);
}

function describeCountVsPrior(
  noun: string,
  current: number,
  previous: number,
  deltaPercent: number | null,
): string {
  if (previous === 0) {
    return `You completed ${current} ${noun} this window; the prior window had none.`;
  }
  if (current === 0) {
    return `No ${noun} completed this window, versus ${previous} in the prior window.`;
  }
  return `You completed ${current} ${noun} this window vs ${previous} prior (${formatSignedPercent(
    deltaPercent ?? 0,
  )}).`;
}

function formatSignedPercent(delta: number): string {
  return `${delta >= 0 ? '+' : ''}${delta}%`;
}
