import { getDatabase } from '@/core/db/client';
import type { Habit } from '@/core/db/types';
import { getUtcIsoRangeForLocalDateKeys, toDateKey } from '@/lib/time';
import { buildMomentumGarden, buildMomentumWindow } from './momentum.domain';
import {
  MOMENTUM_LIMITS,
  type MomentumDailyPlanFact,
  type MomentumDomainInput,
  type MomentumFocusFact,
  type MomentumGardenModel,
  type MomentumMilestoneFact,
  type MomentumNutritionFact,
  type MomentumReviewFact,
  type MomentumTaskFact,
  type MomentumWorkoutFact,
} from './momentum.types';

export type MomentumReadOptions = {
  /** Injectable for deterministic tests; production defaults to local today. */
  todayKey?: string;
  /** Recent local-calendar days; clamped by the pure domain builder. */
  days?: number;
};

type HabitCompletionRead = {
  habit_id: string;
  date_key: string;
  count: number;
};

type NutritionRead = Pick<MomentumNutritionFact, 'consumed_on'>;

type GoalMilestoneRead = {
  id: string;
  title: string;
  status: string;
  completed_at: string | null;
  deleted_at: string | null;
};

type ProjectMilestoneRead = {
  id: string;
  name: string;
  status: string;
  completed_at: string | null;
  deleted_at: string | null;
};

/**
 * Read the complete bounded source slice used by Momentum Garden.
 *
 * This function is intentionally SELECT-only. Garden state is derived at
 * render/load time from the authoritative feature tables; it has no table,
 * sync record, backup row, or last-viewed preference of its own.
 */
export async function getMomentumGarden(
  options: MomentumReadOptions = {},
): Promise<MomentumGardenModel> {
  const todayKey = options.todayKey ?? toDateKey();
  const window = buildMomentumWindow(todayKey, options.days);
  const { startUtcIso, endUtcExclusiveIso } = getUtcIsoRangeForLocalDateKeys(
    window.startKey,
    window.endKey,
  );
  const db = await getDatabase();

  const [
    tasks,
    habits,
    habitCompletions,
    focus,
    workouts,
    nutrition,
    dailyPlans,
    reviews,
    projects,
    goals,
  ] = await Promise.all([
    db.getAllAsync<MomentumTaskFact>(
      `SELECT completed, completed_at, deleted_at
         FROM todos
         WHERE completed = 1
           AND deleted_at IS NULL
           AND completed_at IS NOT NULL
           AND completed_at >= ?
           AND completed_at < ?
         ORDER BY completed_at ASC
         LIMIT ?`,
      [startUtcIso, endUtcExclusiveIso, MOMENTUM_LIMITS.queryRowsPerTimestampSource],
    ),
    // Only habits with a positive completion in the requested window can
    // contribute to this read model. This keeps the canonical scheduler's
    // bulk input bounded without issuing a query per habit.
    db.getAllAsync<Habit>(
      `SELECT h.*
         FROM habits h
         WHERE h.deleted_at IS NULL
           AND EXISTS (
             SELECT 1
             FROM habit_completions hc
             WHERE hc.habit_id = h.id
               AND hc.date_key >= ?
               AND hc.date_key <= ?
               AND hc.count > 0
           )
         ORDER BY h.created_at ASC
         LIMIT ?`,
      [window.startKey, window.endKey, MOMENTUM_LIMITS.queryRowsPerHabitSource],
    ),
    db.getAllAsync<HabitCompletionRead>(
      `SELECT habit_id, date_key, count
         FROM habit_completions
         WHERE date_key >= ?
           AND date_key <= ?
           AND count > 0
         ORDER BY date_key ASC, habit_id ASC
         LIMIT ?`,
      [window.startKey, window.endKey, MOMENTUM_LIMITS.queryRowsPerHabitCompletionSource],
    ),
    db.getAllAsync<MomentumFocusFact>(
      `SELECT started_at, ended_at, duration_seconds, session_type
         FROM pomodoro_sessions
         WHERE session_type = 'focus'
           AND ended_at IS NOT NULL
           AND duration_seconds > 0
           AND started_at >= ?
           AND started_at < ?
         ORDER BY started_at ASC
         LIMIT ?`,
      [startUtcIso, endUtcExclusiveIso, MOMENTUM_LIMITS.queryRowsPerTimestampSource],
    ),
    db.getAllAsync<MomentumWorkoutFact>(
      `SELECT completed_at
         FROM workout_logs
         WHERE completed_at >= ?
           AND completed_at < ?
         ORDER BY completed_at ASC
         LIMIT ?`,
      [startUtcIso, endUtcExclusiveIso, MOMENTUM_LIMITS.queryRowsPerTimestampSource],
    ),
    // Grouping makes nutrition a day-level tracking fact and prevents a
    // meal-entry flood from expanding the read or visual growth.
    db.getAllAsync<NutritionRead>(
      `SELECT consumed_on
         FROM calorie_entries
         WHERE deleted_at IS NULL
           AND consumed_on >= ?
           AND consumed_on <= ?
         GROUP BY consumed_on
         ORDER BY consumed_on ASC`,
      [window.startKey, window.endKey],
    ),
    db.getAllAsync<MomentumDailyPlanFact>(
      `SELECT date_key, status, completed_at, deleted_at
         FROM daily_plans
         WHERE status = 'completed'
           AND deleted_at IS NULL
           AND completed_at IS NOT NULL
           AND completed_at >= ?
           AND completed_at < ?
         ORDER BY completed_at ASC
         LIMIT ?`,
      [startUtcIso, endUtcExclusiveIso, MOMENTUM_LIMITS.queryRowsPerTimestampSource],
    ),
    db.getAllAsync<MomentumReviewFact>(
      `SELECT completed_at, status, deleted_at
         FROM weekly_reviews
         WHERE status = 'completed'
           AND deleted_at IS NULL
           AND completed_at IS NOT NULL
           AND completed_at >= ?
           AND completed_at < ?
         ORDER BY completed_at ASC
         LIMIT ?`,
      [startUtcIso, endUtcExclusiveIso, MOMENTUM_LIMITS.queryRowsPerTimestampSource],
    ),
    db.getAllAsync<ProjectMilestoneRead>(
      `SELECT id, name, status, completed_at, deleted_at
         FROM projects
         WHERE status = 'completed'
           AND deleted_at IS NULL
           AND completed_at IS NOT NULL
           AND completed_at >= ?
           AND completed_at < ?
         ORDER BY completed_at ASC
         LIMIT ?`,
      [startUtcIso, endUtcExclusiveIso, MOMENTUM_LIMITS.queryRowsPerTimestampSource],
    ),
    db.getAllAsync<GoalMilestoneRead>(
      `SELECT id, title, status, completed_at, deleted_at
         FROM goals
         WHERE status = 'completed'
           AND deleted_at IS NULL
           AND completed_at IS NOT NULL
           AND completed_at >= ?
           AND completed_at < ?
         ORDER BY completed_at ASC
         LIMIT ?`,
      [startUtcIso, endUtcExclusiveIso, MOMENTUM_LIMITS.queryRowsPerTimestampSource],
    ),
  ]);

  const milestones: MomentumMilestoneFact[] = [
    ...projects.map((project) => ({
      id: `project:${project.id}`,
      label: `Project completed: ${project.name}`,
      status: project.status,
      completed_at: project.completed_at,
      deleted_at: project.deleted_at,
    })),
    ...goals.map((goal) => ({
      id: `goal:${goal.id}`,
      label: `Goal completed: ${goal.title}`,
      status: goal.status,
      completed_at: goal.completed_at,
      deleted_at: goal.deleted_at,
    })),
  ];

  const input: MomentumDomainInput = {
    todayKey,
    days: options.days,
    tasks,
    habits,
    habitCompletions,
    focus,
    workouts,
    nutrition,
    dailyPlans,
    reviews,
    milestones,
  };
  return buildMomentumGarden(input);
}

/** Explicit alias for callers that want to name the cross-domain read model. */
export const buildMomentumReadModel = getMomentumGarden;
