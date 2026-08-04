import { type Page } from '@playwright/test';
import { ensureAppContext, ensureDbContext, runSql } from './dbHarness';
import { resetAll } from './reset';

/**
 * Browser-side seeding of the app's real SQLite database.
 *
 * The app's data layer is module-private and unreachable from the app page
 * (it lives inside expo-sqlite's worker), so we seed with raw SQL through the
 * DB harness (`e2e/helpers/dbHarness.ts`) into the *same* database the app
 * reads. The schema is bootstrapped by the real app first (a quick app load
 * after reset), so the seeded columns are exactly what the app writes — no
 * hand-written DDL snapshot to keep in sync.
 *
 * Fixture CONTENT is defined here (SMALL/TYPICAL/HEAVY) because the canonical
 * `tests/integration/fixtures/` is being built in parallel by another agent and
 * does not exist yet. The volumes and realism requirements follow the design's
 * Test Data Strategy; divergence from the canonical set is noted inline.
 *
 * NOTE: rows are inserted directly, so they do NOT appear in the sync outbox
 * (they are "historical" — a 3-month-old todo is not pending a push). Journeys
 * that must exercise the outbox create data through the real UI write path.
 */

export type FixtureSize = 'SMALL' | 'TYPICAL' | 'HEAVY';

export interface FixtureDescriptor {
  /** Human description of the fixture for reports. */
  about: string;
  /** Approximate row counts per table, for documentation/reporting. */
  counts: Record<string, number>;
}

export const FIXTURES: Record<FixtureSize, FixtureDescriptor> = {
  SMALL: {
    about: 'Empty or 1–3 rows per feature: empty states, first-run, validation.',
    counts: { todos: 2, habits: 1, calorie_entries: 2, pomodoro_sessions: 1, workout_routines: 0 },
  },
  TYPICAL: {
    about:
      '~14 days of history: 12 todos, 5 habits, ~40 calorie entries, 8 pomodoro sessions, 2 routines, 3 workout logs.',
    counts: {
      todos: 12,
      habits: 5,
      habit_completions: 14,
      calorie_entries: 40,
      pomodoro_sessions: 8,
      workout_routines: 2,
      workout_logs: 3,
    },
  },
  HEAVY: {
    about:
      '~90 days: 200+ todos, 12 habits, 600+ calorie entries, 120+ pomodoro sessions, 40+ workout logs, 15+ saved meals.',
    counts: {
      todos: 200,
      habits: 12,
      habit_completions: 275,
      calorie_entries: 600,
      pomodoro_sessions: 120,
      workout_routines: 5,
      workout_logs: 40,
      saved_meals: 15,
    },
  },
};

// --- id / date helpers (Node side) ---

let idCounter = 0;
/**
 * Generate an id in the app's `createId` format: `{prefix}_{ts}_{8 random}`.
 * The counter guarantees uniqueness within a run.
 */
function id(prefix: string): string {
  idCounter += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${ts}_${rand}${idCounter.toString(36)}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Parse a local `YYYY-MM-DD` key into a local Date at midnight. */
function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** ISO UTC string for a local date key at `hour:minute`. */
function isoAt(key: string, hour: number, minute = 0): string {
  const d = keyToDate(key);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Local date key `days` after (or before) `anchorKey`. */
function offsetKey(anchorKey: string, days: number): string {
  const d = keyToDate(anchorKey);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const PRIORITIES = ['urgent', 'normal', 'low'] as const;
const CATEGORIES = ['anytime', 'morning', 'afternoon', 'evening'] as const;
const ICONS = [
  'check-circle',
  'favorite',
  'local-drink',
  'menu-book',
  'fitness-center',
  'wb-sunny',
  'bedtime',
  'self-improvement',
  'water-drop',
  'coffee',
  'psychology',
  'spa',
] as const;
const COLORS = [
  '#64748b',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#ec4899',
  '#6366f1',
];

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

// --- SQL builders ---

function buildTodos(todayKey: string, count: number, opts: { heavy: boolean }): string {
  const rows: string[] = [];
  const n = count;
  for (let i = 0; i < n; i++) {
    const daysAgo = opts.heavy ? i % 90 : i % 28;
    const key = offsetKey(todayKey, -daysAgo);
    const created = isoAt(key, 8 + (i % 12), i % 60);
    const updated = isoAt(key, 12 + (i % 8), i % 60);
    const completed = i % 5 === 0 || i % 7 === 0 ? 1 : 0;
    const priority = PRIORITIES[i % 3];
    const sortOrder = i;
    const recurrence = i % 6 === 0 ? "'daily'" : 'null';
    const recurrenceId = recurrence === "'daily'" ? `'${id('rec')}'` : 'null';
    const notes = i % 4 === 0 ? `'${esc(`notes for task ${i} — with emoji ☕`)}'` : 'null';
    const dueDate = i % 3 === 0 ? `'${offsetKey(todayKey, (i % 5) - 2)}'` : 'null';
    const deleted = i % 13 === 0 ? `'${isoAt(key, 20, 0)}'` : 'null';
    // Realism: include a 200-char title and one just over it.
    let title = `Task ${i + 1}`;
    if (i === 0) title = 'A'.repeat(200);
    if (i === 1) title = 'B'.repeat(201);
    if (i === 2) title = 'Ünïcode ☕ タスク 🚀';
    rows.push(
      `('${id('todo')}','${esc(title)}',${notes},${completed},'${created}','${updated}',${deleted},${dueDate},'${priority}',${sortOrder},${recurrence},${recurrenceId})`,
    );
  }
  return rows.join(',\n');
}

function buildHabits(
  todayKey: string,
  count: number,
  opts: { heavy: boolean },
): { sql: string; ids: string[] } {
  const rows: string[] = [];
  const ids: string[] = [];
  const targets = [1, 3, 8, 1, 99, 3, 1, 5, 8, 3, 1, 99];
  for (let i = 0; i < count; i++) {
    const key = offsetKey(todayKey, -(opts.heavy ? i % 90 : i % 28));
    const created = isoAt(key, 9, 0);
    const name = i % 3 === 0 ? `Habit ${i + 1} — ☕` : `Habit ${i + 1}`;
    const target = targets[i % targets.length];
    const category = CATEGORIES[i % 4];
    const icon = ICONS[i % ICONS.length];
    const color = COLORS[i % COLORS.length];
    const deleted = i === 0 && count > 1 ? `'${isoAt(key, 20, 0)}'` : 'null';
    const habitId = id('habit');
    ids.push(habitId);
    rows.push(
      `('${habitId}','${esc(name)}',${target},null,'${category}','${icon}','${color}','${created}','${created}',${deleted})`,
    );
  }
  return { sql: rows.join(',\n'), ids };
}

function buildCompletions(
  todayKey: string,
  habitIds: string[],
  count: number,
  opts: { heavy: boolean },
): string {
  const rows: string[] = [];
  if (habitIds.length === 0) return '';
  const days = opts.heavy ? 90 : 28;
  // Collision-free (habit_id, date_key) pairs, matching the real
  // UNIQUE(habit_id, date_key) index: the day is derived from a per-habit offset
  // plus the index within the habit, so no habit/day pair repeats. The 11-day
  // step is coprime with both window sizes (28 and 90), so each habit's own days
  // are distinct; different habits share days freely (the pair is still unique).
  // The target row count is generated exactly — no rows are skipped.
  for (let i = 0; i < count; i++) {
    const habit = habitIds[i % habitIds.length];
    const withinHabit = Math.floor(i / habitIds.length);
    const daysAgo = ((i % habitIds.length) * 13 + withinHabit * 11) % days;
    const key = offsetKey(todayKey, -daysAgo);
    const countVal = (i % 3) + 1;
    const created = isoAt(key, 10 + (i % 8), i % 60);
    rows.push(`('${id('hcmp')}','${habit}','${key}',${countVal},'${created}','${created}')`);
  }
  return rows.join(',\n');
}

function buildCalories(todayKey: string, count: number, opts: { heavy: boolean }): string {
  const names = [
    'Oatmeal 🥣',
    'oatmeal',
    'Café ☕',
    'Sushi 🍣',
    'Protein shake',
    'salad',
    'Salad',
    'Chicken breast',
    'Rice bowl',
    'Greek yogurt',
    'Banana',
    'Almonds',
    'Coffee',
    'Dark chocolate',
    'Scrambled eggs',
  ];
  const rows: string[] = [];
  const days = opts.heavy ? 90 : 28;
  for (let i = 0; i < count; i++) {
    const name = names[i % names.length];
    const daysAgo = i % days;
    const key = offsetKey(todayKey, -daysAgo);
    const meal = MEAL_TYPES[i % 4];
    const created = isoAt(key, 7 + (i % 3) * 5, i % 60);
    // Zero and max realism:
    let calories = 300 + (i % 5) * 100;
    let protein = 10 + (i % 8);
    let carbs = 30 + (i % 6) * 5;
    let fats = 5 + (i % 4);
    let fiber = 1 + (i % 3);
    if (i === 0) {
      calories = 0;
      protein = 0;
      carbs = 0;
      fats = 0;
      fiber = 0;
    }
    if (i === 1) {
      calories = 9999;
      protein = 999;
      carbs = 999;
      fats = 999;
      fiber = 999;
    }
    rows.push(
      `('${id('cal')}','${esc(name)}',${calories},${protein},${carbs},${fats},${fiber},'${meal}','${key}','${created}','${created}',null)`,
    );
  }
  return rows.join(',\n');
}

function buildSavedMeals(todayKey: string, count: number): string {
  const rows: string[] = [];
  const names = [
    'Oatmeal 🥣',
    'oatmeal',
    'Café ☕',
    'Sushi 🍣',
    'Protein shake',
    'Salad platter',
    'Salad',
    'Chicken breast',
    'Banana',
    'Greek yogurt',
    'Almonds',
    'Rice bowl',
    'Dark chocolate',
    'Scrambled eggs',
    'Coffee',
  ];
  for (let i = 0; i < count; i++) {
    const key = offsetKey(todayKey, -(i % 28));
    const created = isoAt(key, 12, 0);
    const lastUsed = isoAt(key, 12, 30);
    rows.push(
      `('${id('smeal')}','${esc(names[i % names.length])}',${300 + (i % 5) * 100},${10 + (i % 8)},${30 + (i % 6) * 5},${5 + (i % 4)},${1 + (i % 3)},'${MEAL_TYPES[i % 4]}',${1 + (i % 3)},'${lastUsed}','${created}')`,
    );
  }
  return rows.join(',\n');
}

function buildPomodoro(todayKey: string, count: number, opts: { heavy: boolean }): string {
  const rows: string[] = [];
  const days = opts.heavy ? 90 : 28;
  for (let i = 0; i < count; i++) {
    const daysAgo = i % days;
    const key = offsetKey(todayKey, -daysAgo);
    const started = isoAt(key, 9 + (i % 8), i % 60);
    const ended = isoAt(key, 9 + (i % 8), ((i % 60) + 25) % 60);
    const duration = 1500 + (i % 5) * 60;
    const type = i % 3 === 0 ? 'focus' : i % 3 === 1 ? 'short_break' : 'long_break';
    rows.push(`('${id('pom')}','${started}','${ended}',${duration},'${type}','${started}')`);
  }
  return rows.join(',\n');
}

function buildWorkout(
  todayKey: string,
  routineCount: number,
  logCount: number,
  opts: { heavy: boolean },
): string {
  const routineRows: string[] = [];
  const exerciseRows: string[] = [];
  const setRows: string[] = [];
  const logRows: string[] = [];
  const days = opts.heavy ? 90 : 28;
  const routineIds: string[] = [];
  for (let r = 0; r < routineCount; r++) {
    const key = offsetKey(todayKey, -(r % days));
    const created = isoAt(key, 8, 0);
    const rId = id('wrk');
    routineIds.push(rId);
    const deleted = r === 0 && routineCount > 1 ? `'${isoAt(key, 20, 0)}'` : 'null';
    routineRows.push(
      `('${rId}','${esc(`Routine ${r + 1} — ${r % 2 === 0 ? 'Upper' : 'Lower'} body`)}','${esc(r % 2 === 0 ? 'Push-focused' : 'Pull-focused')}','${created}','${created}',${deleted})`,
    );
    // "A routine with no exercises" realism: skip exercises for the last routine.
    if (r === routineCount - 1) continue;
    const exCount = opts.heavy ? 6 : 4;
    for (let e = 0; e < exCount; e++) {
      const eId = id('ex');
      const eCreated = isoAt(key, 8 + e, 0);
      exerciseRows.push(
        `('${eId}','${rId}','${esc(`Exercise ${e + 1}`)}',${e},'${eCreated}','${eCreated}',null)`,
      );
      for (let s = 0; s < 3; s++) {
        const sId = id('eset');
        setRows.push(
          `('${sId}','${eId}',${s + 1},${40 + s * 5},${20 + s * 5},'${eCreated}','${eCreated}',null)`,
        );
      }
    }
  }
  for (let l = 0; l < logCount; l++) {
    const key = offsetKey(todayKey, -(l % days));
    const completed = isoAt(key, 18 - (l % 6), 30);
    const created = completed;
    const routineId = routineIds.length ? routineIds[l % routineIds.length] : id('wrk');
    const notes = l % 3 === 0 ? `'${esc('Session notes')}'` : 'null';
    logRows.push(`('${id('wrk')}','${routineId}',${notes},'${completed}','${created}')`);
  }
  return [
    routineRows.length
      ? `INSERT INTO workout_routines (id,name,description,created_at,updated_at,deleted_at) VALUES\n${routineRows.join(',\n')};`
      : '',
    exerciseRows.length
      ? `INSERT INTO routine_exercises (id,routine_id,name,sort_order,created_at,updated_at,deleted_at) VALUES\n${exerciseRows.join(',\n')};`
      : '',
    setRows.length
      ? `INSERT INTO routine_exercise_sets (id,exercise_id,set_number,active_seconds,rest_seconds,created_at,updated_at,deleted_at) VALUES\n${setRows.join(',\n')};`
      : '',
    logRows.length
      ? `INSERT INTO workout_logs (id,routine_id,notes,completed_at,created_at) VALUES\n${logRows.join(',\n')};`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Build the full SQL (multi-statement) that inserts a fixture. `anchorKey` is
 * the browser-local `YYYY-MM-DD` "today" (clock-aware). Returns SQL safe to
 * pass to `sqlite3.exec`.
 */
export function buildFixtureSql(anchorKey: string, size: FixtureSize): string {
  const heavy = size === 'HEAVY';
  const counts = FIXTURES[size].counts;

  const todoCount = counts.todos ?? 0;
  const habitCount = counts.habits ?? 0;
  const completionCount = counts.habit_completions ?? 0;
  const calCount = counts.calorie_entries ?? 0;
  const pomCount = counts.pomodoro_sessions ?? 0;
  const routineCount = counts.workout_routines ?? 0;
  const logCount = counts.workout_logs ?? 0;
  const savedMealCount = counts.saved_meals ?? 0;

  const statements: string[] = [];

  // Habits must be inserted before completions (link by habit_id). Generate
  // the ids once and reuse them for completions.
  let habitIds: string[] = [];
  if (habitCount > 0) {
    const built = buildHabits(anchorKey, habitCount, { heavy });
    statements.push(
      `INSERT INTO habits (id,name,target_per_day,reminder_time,category,icon,color,created_at,updated_at,deleted_at) VALUES\n${built.sql};`,
    );
    habitIds = built.ids;
  }

  if (todoCount > 0) {
    statements.push(
      `INSERT INTO todos (id,title,notes,completed,created_at,updated_at,deleted_at,due_date,priority,sort_order,recurrence,recurrence_id) VALUES\n${buildTodos(anchorKey, todoCount, { heavy })};`,
    );
  }

  if (completionCount > 0 && habitIds.length > 0) {
    statements.push(
      `INSERT INTO habit_completions (id,habit_id,date_key,count,created_at,updated_at) VALUES\n${buildCompletions(anchorKey, habitIds, completionCount, { heavy })};`,
    );
  }

  if (calCount > 0) {
    statements.push(
      `INSERT INTO calorie_entries (id,food_name,calories,protein,carbs,fats,fiber,meal_type,consumed_on,created_at,updated_at,deleted_at) VALUES\n${buildCalories(anchorKey, calCount, { heavy })};`,
    );
  }

  if (pomCount > 0) {
    statements.push(
      `INSERT INTO pomodoro_sessions (id,started_at,ended_at,duration_seconds,session_type,created_at) VALUES\n${buildPomodoro(anchorKey, pomCount, { heavy })};`,
    );
  }

  if (routineCount > 0 || logCount > 0) {
    statements.push(buildWorkout(anchorKey, routineCount, logCount, { heavy }));
  }

  if (savedMealCount > 0) {
    statements.push(
      `INSERT INTO saved_meals (id,food_name,calories,protein,carbs,fats,fiber,meal_type,use_count,last_used_at,created_at) VALUES\n${buildSavedMeals(anchorKey, savedMealCount)};`,
    );
  }

  return statements.join('\n');
}

/**
 * Seed the given raw SQL into the app's database. Leaves the page in DB
 * context. Requires the schema to exist (an app load has happened).
 */
export async function seedSql(page: Page, sql: string): Promise<void> {
  await ensureDbContext(page);
  await runSql(page, sql);
}

/**
 * Reset and seed a fixture, then return to the app with the data visible.
 * Always resets first (a fixture is a "device with N days of history"). If you
 * need incremental seeding, call `seedSql` directly after an app load.
 */
export async function seedFixture(
  page: Page,
  size: FixtureSize,
  opts: { clean?: boolean } = {},
): Promise<void> {
  if (opts.clean !== false) {
    await resetAll(page);
  }
  // Bootstrap the real schema by loading the app once.
  await ensureAppContext(page);
  const anchorKey: string = await page.evaluate(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
  const sql = buildFixtureSql(anchorKey, size);
  await seedSql(page, sql);
  await ensureAppContext(page);
}

/**
 * Seed by driving the real UI (the design's fallback for "the user built this
 * up by hand"). `actions` runs in app context and may use the existing
 * navigation/forms helpers. Does not reset.
 */
export async function seedViaUi(page: Page, actions: (page: Page) => Promise<void>): Promise<void> {
  await ensureAppContext(page);
  await actions(page);
}
