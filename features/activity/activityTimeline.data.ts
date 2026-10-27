import { getDatabase } from '@/core/db/client';
import { dateKeyToLocalDate, timestampToLocalDateKey, toDateKey } from '@/lib/time';
import type {
  ActivityTimelineItem,
  ActivityTimelineSource,
} from '@/features/activity/activityTimeline.types';
import {
  categoryOf,
  formatHabitTimelineTitle,
  SOURCE_ICON,
} from '@/features/activity/activityTimeline.domain';

const DEFAULT_WINDOW_DAYS = 30;
/**
 * Merged items per page. The slice is applied after the cross-source merge, so
 * one page holds the newest page of the whole feed; `hasMore` drives the
 * "Load more" affordance.
 */
export const ACTIVITY_TIMELINE_PAGE_SIZE = 100;

export type TimelineWindowDays = number | 'all';

export type BuildTimelineOptions = {
  /**
   * Look-back window in local days. Defaults to 30; `'all'` means unbounded
   * history (audit C §7: the old `min(90, days)` cap plus six per-source
   * `LIMIT`s made the "All time" chip a label on a 90-day truncated window).
   */
  days?: TimelineWindowDays;
  /** Injectable clock for deterministic tests; defaults to now. */
  now?: Date;
  /** Merged items to return, newest first. Defaults to `Infinity` (whole window). */
  limit?: number;
  /**
   * Keyset cursor: return only items strictly older than this row. Pass the last
   * item of the page you already have (see `ActivityTimelinePage.nextCursor`).
   * A keyset cursor cannot skip or repeat rows when new activity arrives between
   * pages, which a numeric offset can.
   */
  after?: { occurredAt: string; id: string };
};

export type ActivityTimelinePage = {
  items: ActivityTimelineItem[];
  /** True when older merged items remain; that page's cursor is `nextCursor`. */
  hasMore: boolean;
  /** Last row of this page — pass as `after` to fetch the next one. */
  nextCursor: { occurredAt: string; id: string } | null;
};

/**
 * Resolve a requested window into the SQL lower bounds, or `null` for the
 * unbounded "all history" request.
 */
function resolveWindow(
  days: TimelineWindowDays,
  now: Date,
): { sinceDateKey: string; sinceIso: string } | null {
  if (days === 'all') return null;
  const boundedDays = Math.max(1, Math.floor(days));
  // F6: anchor the fetch window to local midnight of today − (days − 1) via
  // DST-safe setDate arithmetic, not to the current time-of-day. This keeps
  // the SQL window aligned with the domain range filter's local-midnight
  // cutoff (an event at 00:10 local `days−1` ago is fetched AND kept).
  const windowStart = dateKeyToLocalDate(toDateKey(now));
  windowStart.setDate(windowStart.getDate() - (boundedDays - 1));
  return { sinceDateKey: toDateKey(windowStart), sinceIso: windowStart.toISOString() };
}

function makeItem(
  source: ActivityTimelineSource,
  id: string,
  occurredAt: string,
  title: string,
  subtitle?: string,
  dateKeyOverride?: string,
): ActivityTimelineItem {
  return {
    id: `${source}:${id}`,
    occurredAt,
    // F5: an explicit local fact (e.g. habit_completions.date_key) wins over
    // the event timestamp so backdated edits land on the right day bucket.
    dateKey: dateKeyOverride ?? (occurredAt ? timestampToLocalDateKey(occurredAt) : toDateKey()),
    category: categoryOf(source),
    source,
    title,
    subtitle,
    icon: SOURCE_ICON[source],
  };
}

/**
 * Derive a windowed, cross-domain activity timeline from authoritative local
 * state. This is a read model only — it never writes and introduces no new
 * event table. Completion events use stable `completed_at` facts (hardened).
 *
 * Every source is read for the whole requested window (no per-source `LIMIT`,
 * which used to truncate a heavy source asymmetrically), the merged feed is
 * sorted newest-first, then sliced to the requested page. "All time" is
 * therefore genuinely complete: a caller asks for the next page until
 * `hasMore` is false.
 */
export async function buildActivityTimeline(
  options: BuildTimelineOptions = {},
): Promise<ActivityTimelinePage> {
  const now = options.now ?? new Date();
  const window = resolveWindow(options.days ?? DEFAULT_WINDOW_DAYS, now);
  const limit = Math.max(0, Math.floor(options.limit ?? Number.POSITIVE_INFINITY));
  const after = options.after;
  const db = await getDatabase();
  const items: ActivityTimelineItem[] = [];
  // Unbounded requests omit the lower-bound predicate entirely; bounded ones
  // keep it on every source so the scan stays proportionate to the window.
  const sinceIso = window?.sinceIso ?? '';
  const sinceDateKey = window?.sinceDateKey ?? '';
  const whereSince = (column: string) => (window ? `${column} >= ?` : '1 = 1');
  const sinceParam = (value: string) => (window ? [value] : []);

  // Todos: stable completed_at.
  const todos = await db.getAllAsync<{ id: string; title: string; completed_at: string | null }>(
    `SELECT id, title, completed_at FROM todos
     WHERE deleted_at IS NULL AND completed = 1 AND completed_at IS NOT NULL AND ${whereSince(
       'completed_at',
     )}
     ORDER BY completed_at DESC`,
    sinceParam(sinceIso),
  );
  for (const t of todos) {
    if (!t.completed_at) continue;
    items.push(
      makeItem('todo', t.id, t.completed_at, `Completed "${truncate(t.title)}"`, 'Task done'),
    );
  }

  // Habits: completions with authoritative date/time facts.
  // F3 (canonical history rule): preserve history — a LEFT JOIN keeps
  // completions of soft-deleted habits visible with a fallback label instead
  // of erasing past events via an INNER JOIN + `deleted_at IS NULL` filter.
  // Progress (progress.data.ts) counts these same rows unjoined; both surfaces
  // therefore agree that "a completion happened on date X" survives deletion.
  // F5: bucket by the row's authoritative `date_key` (not `updated_at`, which
  // also moves on decrements/backdated corrections) and label neutrally with
  // the log operation (`Logged`) — never `Completed`, which is reserved for
  // stable `completed_at` sources. habit_completions is state, not events.
  const habitCompletions = await db.getAllAsync<{
    id: string;
    habit_id: string;
    date_key: string;
    count: number;
    updated_at: string;
    name: string | null;
  }>(
    `SELECT hc.id, hc.habit_id, hc.date_key, hc.count, hc.updated_at, h.name
     FROM habit_completions hc
     LEFT JOIN habits h ON h.id = hc.habit_id
     WHERE ${whereSince('hc.updated_at')}
     ORDER BY hc.updated_at DESC`,
    sinceParam(sinceIso),
  );
  for (const hc of habitCompletions) {
    const label = hc.name ?? 'a deleted habit';
    items.push(
      makeItem(
        'habit',
        hc.id,
        hc.updated_at,
        formatHabitTimelineTitle(label),
        `Habit · ${hc.date_key}${hc.count > 1 ? ` · ${hc.count}×` : ''}`,
        // Authoritative local day wins over updated_at so backdated edits and
        // decrement touches stay in the completion's own day bucket.
        hc.date_key,
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
     WHERE ${whereSince('started_at')} ORDER BY started_at DESC`,
    sinceParam(sinceIso),
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
     WHERE ${whereSince('wl.completed_at')} AND wr.deleted_at IS NULL
     ORDER BY wl.completed_at DESC`,
    sinceParam(sinceIso),
  );
  for (const w of workouts) {
    items.push(
      makeItem('workout', w.id, w.completed_at, `Workout · ${truncate(w.name)}`, 'Workout'),
    );
  }

  // Calories: aggregated per day — preserve authoritative local date key directly (no UTC noon fabrication).
  const calorieDays = await db.getAllAsync<{ consumed_on: string; count: number; total: number }>(
    `SELECT consumed_on, COUNT(*) AS count, COALESCE(SUM(calories), 0) AS total
     FROM calorie_entries
     WHERE deleted_at IS NULL AND ${whereSince('consumed_on')}
     GROUP BY consumed_on ORDER BY consumed_on DESC`,
    sinceParam(sinceDateKey),
  );
  for (const c of calorieDays) {
    items.push({
      id: `calories:day:${c.consumed_on}`,
      // Deterministic date-only sort key; UI must not present as precise event time.
      occurredAt: c.consumed_on,
      dateKey: c.consumed_on,
      category: categoryOf('calories'),
      source: 'calories',
      title: `Logged ${c.count} ${c.count === 1 ? 'meal' : 'meals'} · ${c.total} kcal`,
      subtitle: 'Calories',
      icon: SOURCE_ICON['calories'],
    });
  }

  // Weekly Reviews: completion.
  const reviews = await db.getAllAsync<{ id: string; week_key: string; completed_at: string }>(
    `SELECT id, week_key, completed_at FROM weekly_reviews
     WHERE deleted_at IS NULL AND completed_at IS NOT NULL AND ${whereSince('completed_at')}
     ORDER BY completed_at DESC`,
    sinceParam(sinceIso),
  );
  for (const r of reviews) {
    items.push(
      makeItem('weekly_review', r.id, r.completed_at, 'Weekly review completed', r.week_key),
    );
  }

  // Daily Plans: completed (stable completed_at).
  const plans = await db.getAllAsync<{
    id: string;
    date_key: string;
    completed_at: string | null;
    energy_score: number | null;
  }>(
    `SELECT id, date_key, completed_at, energy_score FROM daily_plans
     WHERE deleted_at IS NULL AND status = 'completed' AND completed_at IS NOT NULL AND ${whereSince(
       'completed_at',
     )}
     ORDER BY completed_at DESC`,
    sinceParam(sinceIso),
  );
  for (const p of plans) {
    if (!p.completed_at) continue;
    const energy = p.energy_score != null ? ` · energy ${p.energy_score}/5` : '';
    items.push(
      makeItem(
        'daily_plan',
        p.id,
        p.completed_at,
        'Daily plan completed',
        `Plan ${p.date_key}${energy}`,
      ),
    );
  }

  // Projects: creation + completion (both can appear if both in range).
  const projects = await db.getAllAsync<{
    id: string;
    name: string;
    created_at: string;
    status: string;
    completed_at: string | null;
  }>(
    `SELECT id, name, created_at, status, completed_at FROM projects
     WHERE deleted_at IS NULL AND (${
       window
         ? `created_at >= ? OR (status = 'completed' AND completed_at IS NOT NULL AND completed_at >= ?)`
         : '1 = 1'
     })
     ORDER BY created_at DESC`,
    window ? [sinceIso, sinceIso] : [],
  );
  for (const p of projects) {
    // Creation event if in window.
    if (!window || p.created_at >= sinceIso) {
      items.push(
        makeItem('project', p.id, p.created_at, `Created project "${truncate(p.name)}"`, 'Project'),
      );
    }
    // Completion event independent of creation — both can appear.
    if (p.status === 'completed' && p.completed_at && (!window || p.completed_at >= sinceIso)) {
      items.push(
        makeItem(
          'project',
          `done:${p.id}`,
          p.completed_at,
          `Completed project "${truncate(p.name)}"`,
          'Project',
        ),
      );
    }
  }

  // Goals: creation + completion (both can appear).
  const goals = await db.getAllAsync<{
    id: string;
    title: string;
    created_at: string;
    status: string;
    completed_at: string | null;
  }>(
    `SELECT id, title, created_at, status, completed_at FROM goals
     WHERE deleted_at IS NULL AND (${
       window
         ? `created_at >= ? OR (status = 'completed' AND completed_at IS NOT NULL AND completed_at >= ?)`
         : '1 = 1'
     })
     ORDER BY created_at DESC`,
    window ? [sinceIso, sinceIso] : [],
  );
  for (const g of goals) {
    if (!window || g.created_at >= sinceIso) {
      items.push(
        makeItem('goal', g.id, g.created_at, `Created goal "${truncate(g.title)}"`, 'Goal'),
      );
    }
    if (g.status === 'completed' && g.completed_at && (!window || g.completed_at >= sinceIso)) {
      items.push(
        makeItem(
          'goal',
          `done:${g.id}`,
          g.completed_at,
          `Completed goal "${truncate(g.title)}"`,
          'Goal',
        ),
      );
    }
  }

  // Sort the merged feed once (newest-first, id-tiebroken to match the cursor
  // comparison below) and take the page after the cursor.
  items.sort((a, b) => {
    if (a.occurredAt === b.occurredAt) return a.id.localeCompare(b.id);
    return a.occurredAt < b.occurredAt ? 1 : -1;
  });
  const remaining = after ? items.filter((item) => isOlderThan(item, after)) : items;
  const page = remaining.slice(0, limit);
  return {
    items: page,
    hasMore: remaining.length > page.length,
    nextCursor:
      remaining.length > page.length && page.length > 0
        ? { occurredAt: page[page.length - 1].occurredAt, id: page[page.length - 1].id }
        : null,
  };
}

/** Total order matching the feed's newest-first sort. */
function isOlderThan(
  item: ActivityTimelineItem,
  cursor: { occurredAt: string; id: string },
): boolean {
  if (item.occurredAt !== cursor.occurredAt) return item.occurredAt < cursor.occurredAt;
  return item.id > cursor.id;
}

function truncate(value: string, max = 60): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
