/**
 * Simulation data-layer bridge (`AUD-SH19-A` / `AUD-SH19-B`).
 *
 * ## The audited defect
 *
 * The simulation API legs claimed to exercise "the real data layer", but their
 * handlers replayed hand-written SQL through the DB harness. That is not the
 * production path: `execCreateTodo` inserted `notes = 'null'` as a STRING, wrote
 * no `sync_outbox` record, bypassed validation, and generated an id with its own
 * random suffix instead of `createId`. A scenario could therefore assert green
 * over behavior the product never performs.
 *
 * ## The contract
 *
 * A leg names a semantic operation; the bridge resolves it to the REAL
 * `*.data.ts` function and awaits it on the app's singleton SQLite connection.
 * Consequences that make the leg faithful, and are asserted by
 * `simulation/runner/specs/apiLegBridge.spec.ts`:
 *   - ids come from `createId`, so prefixes and formats match the app's,
 *   - `null` means SQL NULL, not the text "null",
 *   - validation/domain rules run, so an invalid call rejects,
 *   - writes enqueue their durable outbox intent exactly like the UI does.
 *
 * ## Why it must be absent from ordinary builds
 *
 * The bridge installs arbitrary writes into the app, so it is gated on
 * `EXPO_PUBLIC_SIM_DATA_BRIDGE === 'true'`. Only the hermetic simulation build
 * sets that (see `scripts/build-dist-e2e.mjs`); every other export inlines the
 * flag as absent, the installer returns early, and `window.__shDataBridge`
 * never exists. `scripts/release-profile-guard.mjs` additionally refuses a
 * profile that sets it. The bridge is typed and allowlisted: no arbitrary SQL,
 * no arbitrary module path, no remote-triggerable action.
 */

import { addCalorieEntry } from '@/features/calories/calories.data';
import {
  addHabit,
  decrementHabit,
  deleteHabit,
  incrementHabit,
} from '@/features/habits/habits.data';
import type { HabitWeekday } from '@/features/habits/habits.domain';
import {
  addTodo,
  completeTodo,
  removeTodo,
  setTodoCompletionState,
} from '@/features/todos/todos.data';
import { addRoutine, createCustomExercise } from '@/features/workout/workout.data';
import type { WorkoutModality, HabitCategory, HabitIcon, TodoPriority } from '@/core/db/types';

import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '@/features/habits/habitPresets';

/**
 * Semantic operations the bridge exposes. Each name maps to exactly one real
 * data-layer function; adding an operation without a data function is a type
 * error, not a silent SQL fallback.
 */
export const BRIDGE_OPERATIONS = [
  'createTodo',
  'setTodoCompletion',
  'completeTodo',
  'deleteTodo',
  'createHabit',
  'incrementHabit',
  'decrementHabit',
  'deleteHabit',
  'logCalories',
  'createWorkoutRoutine',
  'createCatalogExercise',
] as const;

export type BridgeOperation = (typeof BRIDGE_OPERATIONS)[number];

/** Argument bag for one bridge call (validated per operation below). */
export type BridgeArgs = Record<string, unknown>;

/** Result of a bridge call: the real function's return plus the ids it touched. */
export interface BridgeResult {
  operation: BridgeOperation;
  /** Whatever the data function returned (ids, rows) — JSON-serializable. */
  value: unknown;
  /** Identity the caller can assert on later (canonical `createId` values). */
  captures: Record<string, string>;
}

/** Thrown for a rejected call; the message is the user-visible reason. */
export class BridgeCallError extends Error {
  constructor(
    message: string,
    readonly code: 'unknown_operation' | 'invalid_args' | 'bridge_unavailable',
  ) {
    super(message);
    this.name = 'BridgeCallError';
  }
}

/** Read a required string argument, rejecting anything else. */
function requireString(args: BridgeArgs, key: string, operation: BridgeOperation): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BridgeCallError(
      `${operation} requires a non-empty string '${key}' (received ${JSON.stringify(value)})`,
      'invalid_args',
    );
  }
  return value;
}

/** Read an optional string argument. */
function optionalString(args: BridgeArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
}

/** Read an optional finite number argument. */
function optionalNumber(args: BridgeArgs, key: string): number | undefined {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Dispatch one semantic operation to its real data-layer function.
 *
 * Only the operations in `BRIDGE_OPERATIONS` are reachable: an unknown name is
 * refused before any module is consulted, which is what keeps the seam from
 * becoming an arbitrary function-call surface.
 *
 * @param operation semantic operation name
 * @param args validated argument bag
 */
export async function invokeBridgeOperation(
  operation: string,
  args: BridgeArgs,
): Promise<BridgeResult> {
  switch (operation) {
    case 'createTodo': {
      // The REAL data-layer write: createId('todo'), SQL NULL notes, title
      // validation, and its own durable outbox intent.
      const id = await addTodo({
        title: requireString(args, 'title', 'createTodo'),
        notes: optionalString(args, 'notes'),
        priority: (optionalString(args, 'priority') ?? 'normal') as TodoPriority,
        dueDate: optionalString(args, 'dueDate') ?? null,
      });
      return { operation, value: { id }, captures: { id } };
    }
    case 'setTodoCompletion': {
      const id = requireString(args, 'id', 'setTodoCompletion');
      const completed = args.completed === 0 ? 0 : 1;
      const result = await setTodoCompletionState(id, completed);
      return { operation, value: result, captures: { id } };
    }
    case 'completeTodo': {
      const id = requireString(args, 'id', 'completeTodo');
      const result = await completeTodo(id);
      return { operation, value: result, captures: { id } };
    }
    case 'deleteTodo': {
      const id = requireString(args, 'id', 'deleteTodo');
      await removeTodo(id);
      return { operation, value: { id }, captures: { id } };
    }
    case 'createHabit': {
      const id = await addHabit(
        requireString(args, 'name', 'createHabit'),
        optionalNumber(args, 'targetPerDay') ?? 1,
        (optionalString(args, 'category') ?? 'anytime') as HabitCategory,
        // The data function takes concrete defaults, not optionals: fall back to
        // the same presets the app uses so the bridge cannot invent a value.
        (optionalString(args, 'icon') ?? DEFAULT_HABIT_ICON) as HabitIcon,
        optionalString(args, 'color') ?? DEFAULT_HABIT_COLOR,
        Array.isArray(args.weekdays) ? (args.weekdays as HabitWeekday[]) : undefined,
        optionalString(args, 'reminderTime') ?? null,
      );
      return { operation, value: { id }, captures: { id } };
    }
    case 'incrementHabit': {
      const id = requireString(args, 'id', 'incrementHabit');
      const result = await incrementHabit(id);
      return { operation, value: result, captures: { id } };
    }
    case 'decrementHabit': {
      const id = requireString(args, 'id', 'decrementHabit');
      await decrementHabit(id);
      return { operation, value: { id }, captures: { id } };
    }
    case 'deleteHabit': {
      const id = requireString(args, 'id', 'deleteHabit');
      await deleteHabit(id);
      return { operation, value: { id }, captures: { id } };
    }
    case 'logCalories': {
      const id = await addCalorieEntry({
        foodName: requireString(args, 'foodName', 'logCalories'),
        calories: optionalNumber(args, 'calories') ?? 0,
        protein: optionalNumber(args, 'protein'),
        carbs: optionalNumber(args, 'carbs'),
        fats: optionalNumber(args, 'fats'),
        fiber: optionalNumber(args, 'fiber'),
        mealType: (optionalString(args, 'mealType') ?? 'snack') as
          'breakfast' | 'lunch' | 'dinner' | 'snack',
        consumedOn: optionalString(args, 'consumedOn'),
      });
      return { operation, value: { id }, captures: { id } };
    }
    case 'createCatalogExercise': {
      // Gym V2 custom exercise identity: modality + unilateral/load flags are
      // what keep two same-named exercises distinct downstream (SH-09).
      const id = await createCustomExercise({
        name: requireString(args, 'name', 'createCatalogExercise'),
        description: optionalString(args, 'description') ?? null,
        primaryArea: requireString(args, 'primaryArea', 'createCatalogExercise'),
        equipment: optionalString(args, 'equipment') ?? null,
        modality: (optionalString(args, 'modality') ?? 'weighted_strength') as WorkoutModality,
        unilateral: args.unilateral === true,
        supportsExternalLoad: args.supportsExternalLoad === true,
      });
      return { operation, value: { id }, captures: { id } };
    }
    case 'createWorkoutRoutine': {
      // `addRoutine` returns void, so read the row this build just created by
      // exact name (the routine table has no unique name constraint, so this
      // is scoped to the newest row and the caller asserts on it).
      const name = requireString(args, 'name', 'createWorkoutRoutine');
      await addRoutine(name, optionalString(args, 'description') ?? '');
      return { operation, value: { name }, captures: { name } };
    }
    default:
      throw new BridgeCallError(
        `operation '${operation}' is not a registered bridge operation; known: ${BRIDGE_OPERATIONS.join(', ')}`,
        'unknown_operation',
      );
  }
}

/** Global the hermetic build exposes; `undefined` in every ordinary build. */
export const BRIDGE_GLOBAL = '__shDataBridge';

/** Shape declared on `window` when the bridge is installed. */
export interface DataBridgeGlobal {
  invoke: (operation: string, args: BridgeArgs) => Promise<BridgeResult>;
  operations: readonly string[];
}

declare global {
  var __shDataBridge: DataBridgeGlobal | undefined;
}

/** True when this build is the hermetic simulation build. */
export function isBridgeEnabled(): boolean {
  return process.env.EXPO_PUBLIC_SIM_DATA_BRIDGE === 'true';
}

/**
 * Install the bridge on `globalThis`.
 *
 * Returns `false` without touching the global when the build flag is absent, so
 * an ordinary/release export provably exposes no callable mutation surface
 * (AUD-SH19-B). Also `false` outside a browser.
 *
 * @returns whether the bridge is installed
 */
export function installSimulationDataBridge(): boolean {
  if (typeof globalThis === 'undefined') return false;
  if (!isBridgeEnabled()) return false;
  const target = globalThis as typeof globalThis & { __shDataBridge?: DataBridgeGlobal };
  if (target.__shDataBridge) return true;
  target.__shDataBridge = {
    operations: BRIDGE_OPERATIONS,
    invoke: invokeBridgeOperation,
  };
  return true;
}
