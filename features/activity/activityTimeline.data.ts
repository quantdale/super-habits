import { getDatabase } from '@/core/db/client';
import { toDateKey, timestampToLocalDateKey } from '@/lib/time';
import type {
  ActivityTimelineItem,
  ActivityTimelineSource,
} from '@/features/activity/activityTimeline.types';
import { categoryOf, SOURCE_ICON } from '@/features/activity/activityTimeline.domain';

const DEFAULT_WINDOW_DAYS = 30;

export type BuildTimelineOptions = {
  /** Look-back window in local days. Defaults to 30 (bounded to keep the feed responsive). */
  days?: number;
};

function makeItem(
  source: ActivityTimelineSource,
  id: string,
  occurredAt: string,
  title: string,
  subtitle?: string,
): ActivityTimelineItem {
  return {
    id: `${source}:${id}`,
    occurredAt,
    dateKey: occurredAt ? timestampToLocalDateKey(occurredAt) : toDateKey(),
    category: categoryOf(source),
    source,
    title,
    subtitle,
    icon: SOURCE_ICON[source],
  };
}

/**
 * Derive a bounded, cross-domain activity timeline from authoritative local
 * state. This is a read model only — it never writes and introduces no new
 * event table (see design.md §11). Timestamps use defensible available facts;
 * Todo completion uses `updated_at` as an approximation when no dedicated
 * completion timestamp exists (documented in the hardening handoff).
 */
export async function buildActivityTimeline(
  options: BuildTimelineOptions = {},
): Promise<ActivityTimelineItem[]> {
  const days = Math.max(1, Math.min(90, options.days ?? DEFAULT_WINDOW_DAYS));
  const db = await getDatabase();
  const windowStart = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
  const sinceDateKey = toDateKey(windowStart);
  const sinceIso = windowStart.toISOString();
  const items: ActivityTimelineItem[] = [];

  // Todos: completion approximated by updated_at. Subtitle flags the approximation.
  const todos = await db.getAllAsync<{ id: string; title: string; updated_at: string }>(
    `SELECT id, title, updated_at FROM todos
     WHERE deleted_at IS NULL AND completed = 1 AND updated_at >= ?
     ORDER BY updated_at DESC LIMIT 200`,
    [sinceIso],
  );
  for (const t of todos) {
    items.push(
      makeItem('todo', t.id, t.updated_at, `Completed "${truncate(t.title)}"`, 'Task done'),
    );
  }

  // Habits: completions with authoritative date/time facts.
  const habitCompletions = await db.getAllAsync<{
    id: string;
    habit_id: string;
    date_key: string;
    updated_at: string;
    name: string;
  }>(
    `SELECT hc.id, hc.habit_id, hc.date_key, hc.updated_at, h.name
     FROM habit_completions hc
     JOIN habits h ON h.id = hc.habit_id
     WHERE hc.updated_at >= ? AND h.deleted_at IS NULL
     ORDER BY hc.updated_at DESC LIMIT 300`,
    [sinceIso],
  );
  for (const hc of habitCompletions) {
    items.push(
      makeItem(
        'habit',
        hc.id,
        hc.updated_at,
        `Completed "${truncate(hc.name)}"`,
        `Habit · ${hc.date_key}`,
      ),
    );
  }

  // Focus: pomodoro sessions.
  const sessions = await db.getAllAsync<{
    id: string;
    started_at: string;
    duration_seconds: number;
    session_type: string;
  }>(
    `SELECT id, started_at, duration_seconds, session_type FROM pomodoro_sessions
     WHERE started_at >= ? ORDER BY started_at DESC LIMIT 200`,
    [sinceIso],
  );
  for (const s of sessions) {
    const minutes = Math.round(s.duration_seconds / 60);
    const label = s.session_type === 'focus' ? 'Focus session' : 'Break';
    items.push(makeItem('focus', s.id, s.started_at, `${label} · ${minutes} min`, 'Focus'));
  }

  // Workout: logs.
  const workouts = await db.getAllAsync<{
    id: string;
    routine_id: string;
    completed_at: string;
    name: string;
  }>(
    `SELECT wl.id, wl.routine_id, wl.completed_at, wr.name
     FROM workout_logs wl
     JOIN workout_routines wr ON wr.id = wl.routine_id
     WHERE wl.completed_at >= ? AND wr.deleted_at IS NULL
     ORDER BY wl.completed_at DESC LIMIT 200`,
    [sinceIso],
  );
  for (const w of workouts) {
    items.push(
      makeItem('workout', w.id, w.completed_at, `Workout · ${truncate(w.name)}`, 'Workout'),
    );
  }

  // Calories: aggregated per day to avoid flooding the feed.
  const calorieDays = await db.getAllAsync<{ consumed_on: string; count: number; total: number }>(
    `SELECT consumed_on, COUNT(*) AS count, COALESCE(SUM(calories), 0) AS total
     FROM calorie_entries
     WHERE deleted_at IS NULL AND consumed_on >= ?
     GROUP BY consumed_on ORDER BY consumed_on DESC LIMIT 120`,
    [sinceDateKey],
  );
  for (const c of calorieDays) {
    const occurredAt = `${c.consumed_on}T12:00:00.000Z`;
    items.push(
      makeItem(
        'calories',
        `day:${c.consumed_on}`,
        occurredAt,
        `Logged ${c.count} ${c.count === 1 ? 'meal' : 'meals'} · ${c.total} kcal`,
        'Calories',
      ),
    );
  }

  // Weekly Reviews: completion.
  const reviews = await db.getAllAsync<{ id: string; week_key: string; completed_at: string }>(
    `SELECT id, week_key, completed_at FROM weekly_reviews
     WHERE deleted_at IS NULL AND completed_at IS NOT NULL AND completed_at >= ?
     ORDER BY completed_at DESC LIMIT 60`,
    [sinceIso],
  );
  for (const r of reviews) {
    items.push(
      makeItem('weekly_review', r.id, r.completed_at, 'Weekly review completed', r.week_key),
    );
  }

  // Daily Plans: completed (reflection recorded).
  const plans = await db.getAllAsync<{
    id: string;
    date_key: string;
    updated_at: string;
    energy_score: number | null;
  }>(
    `SELECT id, date_key, updated_at, energy_score FROM daily_plans
     WHERE deleted_at IS NULL AND status = 'completed' AND updated_at >= ?
     ORDER BY updated_at DESC LIMIT 60`,
    [sinceIso],
  );
  for (const p of plans) {
    const energy = p.energy_score != null ? ` · energy ${p.energy_score}/5` : '';
    items.push(
      makeItem(
        'daily_plan',
        p.id,
        p.updated_at,
        'Daily plan completed',
        `Plan ${p.date_key}${energy}`,
      ),
    );
  }

  // Projects: creation + completion.
  const projects = await db.getAllAsync<{
    id: string;
    name: string;
    created_at: string;
    status: string;
    updated_at: string;
  }>(
    `SELECT id, name, created_at, status, updated_at FROM projects
     WHERE deleted_at IS NULL AND ((created_at >= ?) OR (status = 'completed' AND updated_at >= ?))
     ORDER BY created_at DESC LIMIT 120`,
    [sinceIso, sinceIso],
  );
  for (const p of projects) {
    if (p.status === 'completed' && p.updated_at >= sinceIso) {
      items.push(
        makeItem(
          'project',
          `done:${p.id}`,
          p.updated_at,
          `Completed project "${truncate(p.name)}"`,
          'Project',
        ),
      );
    } else {
      items.push(
        makeItem('project', p.id, p.created_at, `Created project "${truncate(p.name)}"`, 'Project'),
      );
    }
  }

  // Goals: creation + completion.
  const goals = await db.getAllAsync<{
    id: string;
    title: string;
    created_at: string;
    status: string;
    updated_at: string;
  }>(
    `SELECT id, title, created_at, status, updated_at FROM goals
     WHERE deleted_at IS NULL AND ((created_at >= ?) OR (status = 'completed' AND updated_at >= ?))
     ORDER BY created_at DESC LIMIT 120`,
    [sinceIso, sinceIso],
  );
  for (const g of goals) {
    if (g.status === 'completed' && g.updated_at >= sinceIso) {
      items.push(
        makeItem(
          'goal',
          `done:${g.id}`,
          g.updated_at,
          `Completed goal "${truncate(g.title)}"`,
          'Goal',
        ),
      );
    } else {
      items.push(
        makeItem('goal', g.id, g.created_at, `Created goal "${truncate(g.title)}"`, 'Goal'),
      );
    }
  }

  return items;
}

function truncate(value: string, max = 60): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
