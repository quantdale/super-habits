/**
 * API legs (`add-user-simulation-platform` task 3.2 / `AUD-SH19-A`/`B`).
 *
 * An `apiLeg` step performs real data-layer work without driving the UI.
 *
 * ## The audited defect (SH-19)
 *
 * The handlers used to replay hand-written SQL through the DB harness while
 * claiming to call `*.data.ts`. That produced observably wrong results: a
 * created todo stored `notes = 'null'` (the STRING), no `sync_outbox` row was
 * enqueued, validation never ran, and ids used a private random suffix instead
 * of `createId`. A scenario could pass over behavior the product never performs.
 *
 * ## The resolution
 *
 * `execApiLeg` invokes the hermetic data-layer bridge
 * (`core/simulation/dataBridge.ts`) on the app page: the bridge resolves a
 * semantic operation to the REAL feature data function and awaits it on the
 * app's singleton SQLite connection. Consequences the specs assert:
 * ids come from `createId` (canonical prefixes), `null` is SQL NULL, a write
 * enqueues its durable outbox intent, and an invalid call rejects.
 *
 * The bridge exists only in the hermetic simulation export. Raw SQL is still
 * legitimate for FIXTURE SETUP, read oracles and deliberate fault injection —
 * those live in `e2e/helpers/*` and `simulation/model`, never in a mutation
 * handler here, and they never claim production-API fidelity.
 *
 * ## The guard (task 3.2, mandatory)
 *
 * Scenario authors express `apiLeg { functionName: 'createTodo', args: {...} }`.
 * Passing a raw SQL string — as `functionName` or inside `args` — is an ERROR:
 * `assertApiLegSafe()` throws. This is enforced at the model boundary, so a
 * scenario file cannot smuggle SQL into a run.
 */

import type { Page } from '@playwright/test';
import { ensureAppContext, waitForAppReady } from '../../e2e/helpers/dbHarness';

/**
 * Values a leg makes available to later steps (AUD-SH18-B). A leg executed
 * through the real data path knows the identity it just created; publishing it
 * here is what lets a later oracle assert on `{{capture.<name>.<key>}}` instead
 * of inventing a second read that cannot fail.
 */
export type ApiLegCaptures = Record<string, string>;

/** A leg's action-log label plus any values it captured for later steps. */
export interface ApiLegOutcome {
  label: string;
  captures: ApiLegCaptures;
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

/* ------------------------------------------------------------------ */
/* Function registry                                                   */
/* ------------------------------------------------------------------ */

export type ApiLegResolution =
  /** Calls the real feature data function through the hermetic bridge. */
  | 'data-bridge'
  /** Disposable-lane Supabase client (task 8); not executable in web lanes. */
  | 'supabase-client'
  /**
   * Labelled FIXTURE SETUP: writes rows through the DB harness to build a state
   * shape no single data-layer entry point can produce. It is reported as
   * `fixture-sql` and NEVER counts as production write-path evidence.
   */
  | 'fixture-sql';

export interface ApiLegFunctionSpec {
  /** Semantic operation name, matching a `BRIDGE_OPERATIONS` entry. */
  functionName: string;
  /** Which mechanism resolves this leg at runtime. */
  resolution: ApiLegResolution;
  /** Human description for reports. */
  description: string;
  /** Required arg names, validated at execution. */
  requiredArgs: string[];
}

/** Operations an apiLeg may invoke. Each maps to one real data-layer call. */
export const API_LEG_FUNCTIONS: Record<string, ApiLegFunctionSpec> = {
  createTodo: {
    functionName: 'createTodo',
    resolution: 'data-bridge',
    description: 'features/todos/todos.data addTodo — the canonical create path.',
    requiredArgs: ['title'],
  },
  setTodoCompletion: {
    functionName: 'setTodoCompletion',
    resolution: 'data-bridge',
    description:
      'features/todos/todos.data setTodoCompletionState — complete or reopen, with linked actions.',
    requiredArgs: ['id', 'completed'],
  },
  completeTodo: {
    functionName: 'completeTodo',
    resolution: 'data-bridge',
    description: 'features/todos/todos.data completeTodo — complete without toggling back.',
    requiredArgs: ['id'],
  },
  deleteTodo: {
    functionName: 'deleteTodo',
    resolution: 'data-bridge',
    description: 'features/todos/todos.data removeTodo — soft delete plus a delete intent.',
    requiredArgs: ['id'],
  },
  createHabit: {
    functionName: 'createHabit',
    resolution: 'data-bridge',
    description: 'features/habits/habits.data addHabit — the canonical create path.',
    requiredArgs: ['name'],
  },
  incrementHabit: {
    functionName: 'incrementHabit',
    resolution: 'data-bridge',
    description:
      'features/habits/habits.data incrementHabit — today’s count +1 with linked actions.',
    requiredArgs: ['id'],
  },
  decrementHabit: {
    functionName: 'decrementHabit',
    resolution: 'data-bridge',
    description: 'features/habits/habits.data decrementHabit — today’s count −1.',
    requiredArgs: ['id'],
  },
  deleteHabit: {
    functionName: 'deleteHabit',
    resolution: 'data-bridge',
    description: 'features/habits/habits.data deleteHabit — soft delete plus a delete intent.',
    requiredArgs: ['id'],
  },
  logCalories: {
    functionName: 'logCalories',
    resolution: 'data-bridge',
    description: 'features/calories/calories.data addCalorieEntry — the canonical ledger write.',
    requiredArgs: ['foodName', 'calories'],
  },
  createWorkoutRoutine: {
    functionName: 'createWorkoutRoutine',
    resolution: 'data-bridge',
    description: 'features/workout/workout.data addRoutine — the canonical routine create.',
    requiredArgs: ['name'],
  },
  createCatalogExercise: {
    functionName: 'createCatalogExercise',
    resolution: 'data-bridge',
    description:
      'features/workout/workout.data createCustomExercise — the canonical Gym V2 catalog create.',
    requiredArgs: ['name', 'primaryArea'],
  },
  fixtureSeedGymTrainingState: {
    functionName: 'fixtureSeedGymTrainingState',
    resolution: 'fixture-sql',
    description:
      'FIXTURE SETUP (not API fidelity): seed a compact Gym V2 shape (prescription, catalog exercise, weekly plan, body weight) that no single data-layer entry point produces.',
    requiredArgs: ['routineName'],
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

/** Every operation name an apiLeg may name. */
export const API_LEG_OPERATIONS = Object.keys(API_LEG_FUNCTIONS);

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
        `known: ${API_LEG_OPERATIONS.join(', ')}`,
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
/* Execution (browser-side)                                            */
/* ------------------------------------------------------------------ */

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

/** The bridge shape the hermetic build installs on `window`. */
interface BridgeGlobalShape {
  invoke: (
    operation: string,
    args: Record<string, unknown>,
  ) => Promise<{ value: unknown; captures: Record<string, string> }>;
  operations: readonly string[];
}

/**
 * Invoke a semantic operation through the app's real data layer.
 *
 * Fails loudly when the bridge is missing: a lane that silently fell back to
 * SQL would reproduce the audited defect, so an absent bridge is an error, not
 * a degraded mode.
 */
async function invokeOnAppPage(
  page: Page,
  operation: string,
  args: Record<string, unknown>,
): Promise<{ value: unknown; captures: Record<string, string> }> {
  // The bridge only exists on the APP document; a harness page has no app.
  await ensureAppContext(page);
  await waitForAppReady(page);
  const present = await page.evaluate(
    () => typeof (window as unknown as { __shDataBridge?: unknown }).__shDataBridge === 'object',
  );
  if (!present) {
    throw new Error(
      `apiLeg '${operation}' cannot run: this build exposes no data-layer bridge. ` +
        'Simulation API legs require the hermetic export produced by `npm run build:e2e` ' +
        '(EXPO_PUBLIC_SIM_DATA_BRIDGE=true). Refusing to fall back to SQL replay.',
    );
  }
  return page.evaluate(
    async ([op, payload]) => {
      const bridge = (window as unknown as { __shDataBridge?: BridgeGlobalShape }).__shDataBridge;
      if (!bridge)
        throw new Error('data bridge disappeared between the readiness check and the call');
      return bridge.invoke(op, payload);
    },
    [operation, args] as const,
  );
}

/**
 * Execute an apiLeg step: guard, resolve the registry entry, invoke the real
 * data-layer function through the bridge, and return an action-log label plus
 * any ids the operation published for later assertions.
 *
 * A `fixture-sql` operation is dispatched to its labelled fixture handler and
 * its label always carries `[fixture]`, so a report reader can never mistake
 * fixture construction for production-path evidence (AUD-SH19-A).
 */
export async function execApiLeg(
  page: Page,
  input: { functionName: string; args?: Record<string, unknown> },
): Promise<ApiLegOutcome> {
  const args = input.args ?? {};
  const spec = resolveSpec(input.functionName, args);
  if (spec.resolution === 'fixture-sql') {
    const outcome = await runFixtureHandler(page, input.functionName, args);
    return { label: `[fixture] ${outcome.label}`, captures: outcome.captures };
  }
  const result = await invokeOnAppPage(page, input.functionName, args);
  return {
    label: `${input.functionName}(${describeArgs(input.functionName, args)})`,
    captures: result.captures,
  };
}

/* ------------------------------------------------------------------ */
/* Fixture-setup handlers (explicitly NOT API fidelity)                */
/* ------------------------------------------------------------------ */

/**
 * Handlers for `resolution: 'fixture-sql'` operations only.
 *
 * These exist because some seeded shapes have no single data-layer entry point
 * (Gym V2's nested prescription + plan + body-weight graph). They write through
 * the DB harness, so they are fixture setup — the same category as
 * `e2e/helpers/seed.ts` — and are labelled `[fixture]` in every report.
 */
async function runFixtureHandler(
  page: Page,
  functionName: string,
  args: Record<string, unknown>,
): Promise<ApiLegOutcome> {
  switch (functionName) {
    case 'fixtureSeedGymTrainingState':
      return fixtureSeedGymTrainingState(page, args);
    default:
      throw new Error(`apiLeg '${functionName}' declares a fixture-sql resolution with no handler`);
  }
}

/** Deterministic-format id mirroring `lib/id.ts` (fixture rows only). */
function fixtureId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${ts}_${rand}`;
}

/**
 * Seed a compact Gym V2 shape. FIXTURE SETUP: see `runFixtureHandler`.
 *
 * @param page app-free DB-harness page
 * @param args `{ routineName }`
 */
async function fixtureSeedGymTrainingState(
  page: Page,
  args: Record<string, unknown>,
): Promise<ApiLegOutcome> {
  const routineName = String(args.routineName);
  const { runSql, queryRows, returnToApp } = await import('../../e2e/helpers/dbHarness');
  const esc = (v: unknown): string => `'${String(v).replace(/'/g, "''")}'`;
  const routineRows = await queryRows(
    page,
    `SELECT id FROM workout_routines WHERE name = ${esc(routineName)} AND deleted_at IS NULL LIMIT 1`,
  );
  const routineId = routineRows[0]?.id;
  if (typeof routineId !== 'string' || routineId === '') {
    throw new Error(`Gym V2 fixture routine not found: ${routineName}`);
  }
  const now = new Date().toISOString();
  const exerciseId = fixtureId('ex');
  const setId = fixtureId('eset');
  const customId = fixtureId('cex');
  const planId = fixtureId('wplan');
  const bodyWeightId = fixtureId('bw');
  const measuredOn = await page.evaluate(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
  const statements = [
    `INSERT INTO routine_exercises (id, routine_id, name, sort_order, catalog_exercise_id, modality, unilateral, supports_external_load, notes, superset_group, progression_mode, progression_increment, progression_min_reps, progression_max_reps, created_at, updated_at, deleted_at) VALUES (${esc(exerciseId)}, ${esc(routineId)}, ${esc('Barbell bench press')}, 1, ${esc('builtin_barbell_bench_press')}, ${esc('weighted_strength')}, 1, 1, ${esc('Simulation starter prescription')}, NULL, ${esc('linear')}, 2.5, 8, 10, ${esc(now)}, ${esc(now)}, NULL);`,
    `INSERT INTO routine_exercise_sets (id, exercise_id, set_number, active_seconds, rest_seconds, target_reps_min, target_reps_max, target_load, created_at, updated_at, deleted_at) VALUES (${esc(setId)}, ${esc(exerciseId)}, 1, 30, 60, 8, 10, 60, ${esc(now)}, ${esc(now)}, NULL);`,
    `INSERT INTO custom_exercises (id, name, description, aliases, instructions, primary_area, secondary_areas, equipment, modality, unilateral, supports_external_load, created_at, updated_at, deleted_at) VALUES (${esc(customId)}, ${esc('Cable Y raise')}, NULL, '["cable y"]', ${esc('Pull toward the shoulders.')}, ${esc('shoulders')}, '[]', ${esc('cable')}, ${esc('weighted_strength')}, 0, 1, ${esc(now)}, ${esc(now)}, NULL);`,
    `INSERT INTO workout_weekly_plan (id, weekday, routine_id, plan_kind, note, created_at, updated_at, deleted_at) VALUES (${esc(planId)}, 1, ${esc(routineId)}, ${esc('workout')}, ${esc('Gym V2 simulation')}, ${esc(now)}, ${esc(now)}, NULL);`,
    `INSERT INTO body_weight_entries (id, measured_on, measured_at, weight, unit, note, created_at, updated_at, deleted_at) VALUES (${esc(bodyWeightId)}, ${esc(measuredOn)}, ${esc(now)}, 80, ${esc('kg')}, ${esc('Simulation morning')}, ${esc(now)}, ${esc(now)}, NULL);`,
  ];
  await runSql(page, statements.join('\n'));
  await returnToApp(page);
  return {
    label: `fixtureSeedGymTrainingState(${JSON.stringify(routineName)})`,
    captures: { routineId, exerciseId, setId, customExerciseId: customId, planId, bodyWeightId },
  };
}

/** Short human label for the action log (never includes generated ids). */
function describeArgs(functionName: string, args: Record<string, unknown>): string {
  const interesting = ['title', 'name', 'foodName', 'id', 'completed'];
  const parts = interesting
    .filter((key) => args[key] !== undefined)
    .map((key) => JSON.stringify(args[key]));
  return parts.length > 0 ? parts.join(', ') : functionName;
}
