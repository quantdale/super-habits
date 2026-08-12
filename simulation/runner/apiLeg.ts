/**
 * API legs (`add-user-simulation-platform` task 3.2).
 *
 * An `apiLeg` step is a headless leg that performs real data-layer work instead
 * of driving the UI. Design D9 / task 3.2: legs call the real `*.data.ts`
 * functions, or the Supabase client (disposable lane only) — NEVER hand-written
 * SQL from a scenario author.
 *
 * ## The guard (task 3.2, mandatory)
 *
 * Scenario authors express `apiLeg { functionName: 'createHabit', args: {...} }`.
 * Passing a raw SQL string — as `functionName` or inside `args` — is an ERROR:
 * `assertApiLegSafe()` throws. This is enforced at the model boundary, so a
 * scenario file cannot smuggle SQL into a run.
 *
 * ## Execution seam (documented, not hidden)
 *
 * The web export exposes NO bridge to the app's data layer: `*.data.ts` is
 * module-private inside expo-sqlite's worker, and `page.evaluate` on the app
 * page cannot reach it (see `e2e/helpers/dbHarness.ts` / `seed.ts`). The
 * parent's seeding approach therefore runs the real SQLite schema through the
 * DB harness (`runSql`), which reads/writes the SAME database the app uses.
 * API legs follow that exact approach: `functionName` resolves to a registry
 * entry whose handler replays the data-layer write through the DB harness with
 * the app's own row format (createId-style ids, ISO timestamps, `toDateKey`
 * date keys). `page.evaluate → import('features/...')` remains the intended
 * long-term resolution when the export grows a data-layer bridge; the
 * Supabase-client resolution is a disposable-lane (task 8) stub.
 *
 * The registry and guard are pure TypeScript so the guard is unit-testable
 * (`tests/simulation.apileg.test.ts`); the handlers drive the browser.
 */

import type { Page } from '@playwright/test';
import { queryRows, runSql, returnToApp } from '../../e2e/helpers/dbHarness';

/** A local date key `YYYY-MM-DD` resolved from the PAGE'S clock. */
function pageDateKey(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
}

/** App-compatible id: `{prefix}_{ts36}_{8 rand}` (mirrors `lib/id.ts`). */
let apiLegIdCounter = 0;
function makeId(prefix: string): string {
  apiLegIdCounter += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${ts}_${rand}${apiLegIdCounter.toString(36)}`;
}

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

/* ------------------------------------------------------------------ */
/* The guard                                                           */
/* ------------------------------------------------------------------ */

const SQL_KEYWORD_RE =
  /^\s*(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|PRAGMA)\b/i;

/** True when a string is (or starts like) a raw SQL statement. */
export function isRawSqlString(input: string): boolean {
  if (typeof input !== 'string' || input.trim() === '') return false;
  return SQL_KEYWORD_RE.test(input) || input.trim().includes(';');
}

/**
 * Guard: reject an apiLeg whose `functionName` or `args` carry raw SQL.
 * Throws a descriptive error — a raw `SELECT`/`INSERT` string input is an
 * error by contract (task 3.2). Also rejects unknown function names.
 */
export function assertApiLegSafe(input: {
  functionName: string;
  args?: Record<string, unknown>;
}): void {
  const { functionName, args } = input;
  if (!functionName || typeof functionName !== 'string' || functionName.trim() === '') {
    throw new Error(
      `apiLeg requires a non-empty functionName (got ${JSON.stringify(functionName)}); ` +
        'express the leg as a data-layer function name, never raw SQL',
    );
  }
  if (isRawSqlString(functionName)) {
    throw new Error(
      `apiLeg.functionName rejects raw SQL: ${JSON.stringify(functionName)} — ` +
        'use a registered data-layer function name (see API_LEG_FUNCTIONS)',
    );
  }
  if (!API_LEG_FUNCTIONS[functionName]) {
    throw new Error(
      `apiLeg.functionName '${functionName}' is not a registered data-layer function; ` +
        `known: ${Object.keys(API_LEG_FUNCTIONS).join(', ')}`,
    );
  }
  if (args) {
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string' && isRawSqlString(value)) {
        throw new Error(
          `apiLeg args.${key} rejects raw SQL: ${JSON.stringify(value)} — pass plain values`,
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Function registry                                                   */
/* ------------------------------------------------------------------ */

export type ApiLegResolution = 'db-harness' | 'supabase-client';

export interface ApiLegFunctionSpec {
  /** Canonical data-layer function name (e.g. `createHabit`). */
  functionName: string;
  /** Which mechanism resolves this leg at runtime. */
  resolution: ApiLegResolution;
  /** Human description for reports. */
  description: string;
  /** Required arg names, validated at execution. */
  requiredArgs: string[];
}

/** Registered data-layer functions apiLegs may invoke. */
export const API_LEG_FUNCTIONS: Record<string, ApiLegFunctionSpec> = {
  createTodo: {
    functionName: 'createTodo',
    resolution: 'db-harness',
    description: 'features/todos/todos.data createTodo — insert a todo row.',
    requiredArgs: ['title'],
  },
  createHabit: {
    functionName: 'createHabit',
    resolution: 'db-harness',
    description: 'features/habits/habits.data createHabit — insert a habit row.',
    requiredArgs: ['name'],
  },
  tickHabit: {
    functionName: 'tickHabit',
    resolution: 'db-harness',
    description:
      'features/habits/habits.data tickHabit — increment today count via SELECT→INSERT/UPDATE.',
    requiredArgs: ['name'],
  },
  logCalories: {
    functionName: 'logCalories',
    resolution: 'db-harness',
    description: 'features/calories/calories.data logCalories — insert a calorie entry.',
    requiredArgs: ['food', 'calories'],
  },
  createWorkoutRoutine: {
    functionName: 'createWorkoutRoutine',
    resolution: 'db-harness',
    description: 'features/workout/workout.data createRoutine — insert a workout routine row.',
    requiredArgs: ['name'],
  },
  // Supabase-client resolution is reserved for the disposable-backend lane
  // (task 8); a stub entry documents the seam.
  supabaseUpsert: {
    functionName: 'supabaseUpsert',
    resolution: 'supabase-client',
    description:
      'Disposable-lane (task 8) leg: push rows via the Supabase JS client. Not executed in web lanes.',
    requiredArgs: ['entity', 'rows'],
  },
};

/* ------------------------------------------------------------------ */
/* Handlers (browser-side)                                             */
/* ------------------------------------------------------------------ */

function esc(v: unknown): string {
  return sqlStr(String(v));
}

/** Validate args against the registry's requiredArgs; returns the spec. */
function resolveSpec(functionName: string, args: Record<string, unknown>): ApiLegFunctionSpec {
  assertApiLegSafe({ functionName, args });
  const spec = API_LEG_FUNCTIONS[functionName];
  if (spec.resolution === 'supabase-client') {
    throw new Error(
      `apiLeg '${functionName}' resolves via the Supabase client (disposable-backend lane, task 8); ` +
        'it is not executable in a web/fake lane',
    );
  }
  for (const required of spec.requiredArgs) {
    if (args[required] === undefined) {
      throw new Error(`apiLeg '${functionName}' requires arg '${required}'`);
    }
  }
  return spec;
}

/** Build the INSERT SQL mirroring the app's row format (parent seeding style). */
function insertSql(table: string, columns: string[], values: string[]): string {
  return `INSERT INTO ${table} (${columns.join(',')}) VALUES (${values.join(',')});`;
}

/** Run a write through the DB harness and restore app context. */
async function withDb(page: Page, sql: string): Promise<void> {
  await runSql(page, sql);
  await returnToApp(page);
}

/** Handler for `createTodo`. */
export async function execCreateTodo(page: Page, args: Record<string, unknown>): Promise<string> {
  resolveSpec('createTodo', args);
  const now = new Date().toISOString();
  const title = String(args.title);
  const priority = args.priority ?? 'normal';
  const id = makeId('todo');
  await withDb(
    page,
    insertSql(
      'todos',
      [
        'id',
        'title',
        'notes',
        'completed',
        'created_at',
        'updated_at',
        'deleted_at',
        'due_date',
        'priority',
        'sort_order',
        'recurrence',
        'recurrence_id',
      ],
      [
        esc(id),
        esc(title),
        esc(args.notes ?? null),
        '0',
        esc(now),
        esc(now),
        'NULL',
        'NULL',
        esc(priority),
        '0',
        'NULL',
        'NULL',
      ],
    ),
  );
  return `createTodo(${JSON.stringify(title)})`;
}

/** Handler for `createHabit`. */
export async function execCreateHabit(page: Page, args: Record<string, unknown>): Promise<string> {
  resolveSpec('createHabit', args);
  const now = new Date().toISOString();
  const effectiveFromDate = await pageDateKey(page);
  const id = makeId('habit');
  const target = Number(args.targetPerDay ?? 1);
  const reminderTime = args.reminderTime === undefined ? null : args.reminderTime;
  if (
    reminderTime !== null &&
    (typeof reminderTime !== 'string' || !/^\d{2}:\d{2}$/.test(reminderTime))
  ) {
    throw new Error(
      `apiLeg createHabit reminderTime must be canonical HH:MM or null (got ${JSON.stringify(reminderTime)})`,
    );
  }
  if (
    typeof reminderTime === 'string' &&
    (Number(reminderTime.slice(0, 2)) > 23 || Number(reminderTime.slice(3, 5)) > 59)
  ) {
    throw new Error(
      `apiLeg createHabit reminderTime must be canonical HH:MM or null (got ${JSON.stringify(reminderTime)})`,
    );
  }
  const weekdays = [
    ...new Set(
      (Array.isArray(args.weekdays) ? args.weekdays : [1, 2, 3, 4, 5, 6, 7])
        .map(Number)
        .filter((weekday) => Number.isInteger(weekday) && weekday >= 1 && weekday <= 7),
    ),
  ].sort((a, b) => a - b);
  const ruleHistory = JSON.stringify([
    { effective_from_date: effectiveFromDate, weekdays, target_per_day: target },
  ]);
  await withDb(
    page,
    insertSql(
      'habits',
      [
        'id',
        'name',
        'target_per_day',
        'reminder_time',
        'category',
        'icon',
        'color',
        'rule_history',
        'created_at',
        'updated_at',
        'deleted_at',
      ],
      [
        esc(id),
        esc(String(args.name)),
        esc(target),
        reminderTime === null ? 'NULL' : esc(reminderTime),
        esc('anytime'),
        esc('check-circle'),
        esc('#6366f1'),
        esc(ruleHistory),
        esc(now),
        esc(now),
        'NULL',
      ],
    ),
  );
  return `createHabit(${JSON.stringify(args.name)}, target=${String(target)}, weekdays=${weekdays.join(',')}, reminder=${reminderTime ?? 'off'})`;
}

/** Handler for `tickHabit`: SELECT→INSERT/UPDATE on habit_completions (today). */
export async function execTickHabit(page: Page, args: Record<string, unknown>): Promise<string> {
  resolveSpec('tickHabit', args);
  const times = Number(args.times ?? 1);
  const key = await pageDateKey(page);
  const rows = await queryRows(
    page,
    `SELECT id FROM habits WHERE name = ${esc(String(args.name))} AND deleted_at IS NULL LIMIT 1`,
  );
  const habitId = rows[0]?.id as string | undefined;
  if (!habitId) {
    await returnToApp(page);
    throw new Error(`tickHabit: no habit named '${String(args.name)}'`);
  }
  const existing = await queryRows(
    page,
    `SELECT id, count FROM habit_completions WHERE habit_id = ${esc(habitId)} AND date_key = ${esc(key)}`,
  );
  const now = new Date().toISOString();
  if (existing.length > 0) {
    const next = Number(existing[0].count ?? 0) + times;
    await runSql(
      page,
      `UPDATE habit_completions SET count = ${next}, updated_at = ${esc(now)} WHERE id = ${esc(String(existing[0].id))};`,
    );
  } else {
    await runSql(
      page,
      insertSql(
        'habit_completions',
        ['id', 'habit_id', 'date_key', 'count', 'created_at', 'updated_at'],
        [esc(makeId('hcmp')), esc(habitId), esc(key), String(times), esc(now), esc(now)],
      ),
    );
  }
  await returnToApp(page);
  return `tickHabit(${JSON.stringify(args.name)}, +${times})`;
}

/** Handler for `logCalories`. */
export async function execLogCalories(page: Page, args: Record<string, unknown>): Promise<string> {
  resolveSpec('logCalories', args);
  const key = await pageDateKey(page);
  const now = new Date().toISOString();
  await withDb(
    page,
    insertSql(
      'calorie_entries',
      [
        'id',
        'food_name',
        'calories',
        'protein',
        'carbs',
        'fats',
        'fiber',
        'meal_type',
        'consumed_on',
        'created_at',
        'updated_at',
        'deleted_at',
      ],
      [
        esc(makeId('cal')),
        esc(String(args.food)),
        esc(args.calories),
        esc(args.protein ?? 0),
        esc(args.carbs ?? 0),
        esc(args.fats ?? 0),
        esc(args.fiber ?? 0),
        esc(args.mealType ?? 'snack'),
        esc(key),
        esc(now),
        esc(now),
        'NULL',
      ],
    ),
  );
  return `logCalories(${JSON.stringify(args.food)}, ${String(args.calories)})`;
}

/** Handler for `createWorkoutRoutine` (a routine with no exercises yet). */
export async function execCreateWorkoutRoutine(
  page: Page,
  args: Record<string, unknown>,
): Promise<string> {
  resolveSpec('createWorkoutRoutine', args);
  const now = new Date().toISOString();
  await withDb(
    page,
    insertSql(
      'workout_routines',
      ['id', 'name', 'description', 'created_at', 'updated_at', 'deleted_at'],
      [esc(makeId('wrk')), esc(String(args.name)), 'NULL', esc(now), esc(now), 'NULL'],
    ),
  );
  return `createWorkoutRoutine(${JSON.stringify(args.name)})`;
}

const HANDLERS: Record<string, (page: Page, args: Record<string, unknown>) => Promise<string>> = {
  createTodo: execCreateTodo,
  createHabit: execCreateHabit,
  tickHabit: execTickHabit,
  logCalories: execLogCalories,
  createWorkoutRoutine: execCreateWorkoutRoutine,
};

/**
 * Execute an apiLeg step. Guards first (raw SQL is an error), resolves the
 * registry, runs the data-layer write through the DB harness, and returns an
 * action-log label for the run report.
 */
export async function execApiLeg(
  page: Page,
  input: { functionName: string; args?: Record<string, unknown> },
): Promise<string> {
  assertApiLegSafe(input);
  const handler = HANDLERS[input.functionName];
  if (!handler) {
    throw new Error(
      `apiLeg '${input.functionName}' has no executable handler in this lane ` +
        `(resolution: ${API_LEG_FUNCTIONS[input.functionName]?.resolution ?? 'unknown'})`,
    );
  }
  return handler(page, input.args ?? {});
}
