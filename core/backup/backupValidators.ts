import { BACKUP_ENTITY_COLUMNS, type BackupEntity } from '@/core/backup/backup.types';
import {
  LINKED_ACTION_DIRECTION_POLICIES,
  LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY,
  LINKED_ACTION_FEATURES,
  LINKED_ACTION_RULE_STATUSES,
  LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE,
  LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE,
  LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY,
} from '@/core/linked-actions/linkedActions.enums';

/**
 * Runtime validation for remote backup rows. Every restored row is untrusted
 * external input: a valid Auth owner does not make every payload semantically
 * valid. Validators are pure and unit-tested; a malformed row must never
 * reach SQLite.
 */

export type ValidationResult =
  { ok: true; row: Record<string, unknown> } | { ok: false; errors: string[] };

// App ids are `{prefix}_{timestamp_ms}_{8_random_chars}`; the trailing random
// segment is optional so historical/legacy rows (e.g. `hcmp_1`) validate too.
const ID_PATTERN = /^[a-z0-9]+_[0-9]+(_[a-z0-9]+)?$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const STRING_LIMITS: Record<string, number> = {
  title: 500,
  name: 300,
  notes: 10_000,
  food_name: 300,
  description: 5_000,
  exercise_name: 300,
  source_label: 500,
  color: 50,
  icon: 50,
  linked_todo_title: 200,
  note: 500,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed);
}

function isDateKey(value: unknown): boolean {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function isPositiveInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 1;
}

function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isNullableIso(value: unknown): boolean {
  return value === null || isIsoTimestamp(value);
}

function isEnum(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === 'string' && allowed.includes(value);
}

function isBoundedString(value: unknown, key: string): boolean {
  if (typeof value !== 'string') return false;
  const limit = STRING_LIMITS[key] ?? 1_000;
  return value.length <= limit;
}

/** Normalize rule_history JSON: array of effective-dated rules. */
export function parseHabitRuleHistoryJson(
  value: unknown,
): { ok: true; history: unknown[] } | { ok: false; error: string } {
  if (typeof value !== 'string' || value.length > 50_000) {
    return { ok: false, error: 'rule_history must be a bounded JSON string' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { ok: false, error: 'rule_history is not valid JSON' };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'rule_history must be an array' };
  }
  for (const rule of parsed) {
    if (!isRecord(rule)) return { ok: false, error: 'rule_history entries must be objects' };
    if (!isDateKey(rule.effective_from_date)) {
      return { ok: false, error: 'rule_history effective_from_date must be a date key' };
    }
    if (
      !Array.isArray(rule.weekdays) ||
      rule.weekdays.some((d) => !isPositiveInteger(d) || d > 7)
    ) {
      return { ok: false, error: 'rule_history weekdays must be 1..7 integers' };
    }
    if (!isPositiveInteger(rule.target_per_day)) {
      return { ok: false, error: 'rule_history target_per_day must be a positive integer' };
    }
  }
  return { ok: true, history: parsed };
}

/** Normalize linked-action effect_payload JSON: bounded, parseable object. */
export function parseEffectPayloadJson(
  value: unknown,
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  if (typeof value !== 'string' || value.length > 50_000) {
    return { ok: false, error: 'effect_payload must be a bounded JSON string' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { ok: false, error: 'effect_payload is not valid JSON' };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: 'effect_payload must be a JSON object' };
  }
  return { ok: true, payload: parsed };
}

/**
 * Normalize habits.lifecycle_history JSON (migration 20): nullable bounded
 * array of closed/ongoing lifecycle intervals. NULL means "no recorded
 * intervals" and is valid for legacy rows.
 */
export function parseHabitLifecycleHistoryJson(
  value: unknown,
): { ok: true; history: unknown[] } | { ok: false; error: string } {
  if (value === null) return { ok: true, history: [] };
  if (typeof value !== 'string' || value.length > 50_000) {
    return { ok: false, error: 'lifecycle_history must be a bounded JSON string or null' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { ok: false, error: 'lifecycle_history is not valid JSON' };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'lifecycle_history must be an array' };
  }
  for (const interval of parsed) {
    if (!isRecord(interval)) {
      return { ok: false, error: 'lifecycle_history entries must be objects' };
    }
    if (!isEnum(interval.status, ['paused', 'archived'])) {
      return { ok: false, error: 'lifecycle_history status must be paused or archived' };
    }
    if (!isDateKey(interval.from_date_key)) {
      return { ok: false, error: 'lifecycle_history from_date_key must be a date key' };
    }
    if (interval.to_date_key !== null && !isDateKey(interval.to_date_key)) {
      return {
        ok: false,
        error: 'lifecycle_history to_date_key must be a date key or null',
      };
    }
  }
  return { ok: true, history: parsed };
}

type FieldRule = {
  required: (row: Record<string, unknown>) => string | null;
  optional?: (row: Record<string, unknown>) => string | null;
};

function checkField(
  row: Record<string, unknown>,
  field: string,
  validate: (value: unknown) => boolean,
  label: string,
): string | null {
  if (!(field in row)) return `${label} is missing`;
  return validate(row[field]) ? null : `${label} is invalid`;
}

function idRule(field: string): FieldRule {
  return {
    required: (row) =>
      checkField(
        row,
        field,
        (v) => typeof v === 'string' && ID_PATTERN.test(v) && v.length <= 100,
        field,
      ),
  };
}

function textRule(field: string, required: boolean, label?: string): FieldRule {
  const check = (row: Record<string, unknown>) =>
    checkField(row, field, (v) => isBoundedString(v, field), label ?? field);
  return required ? { required: check } : { required: () => null, optional: check };
}

function intRule(field: string, required: boolean, min: number): FieldRule {
  const validate = (v: unknown) => Number.isInteger(v) && Number(v) >= min;
  const check = (row: Record<string, unknown>) => checkField(row, field, validate, field);
  return required ? { required: check } : { required: () => null, optional: check };
}

function enumRule(field: string, allowed: readonly string[]): FieldRule {
  return {
    required: (row) => checkField(row, field, (v) => isEnum(v, allowed), field),
  };
}

function nullableEnumRule(field: string, allowed: readonly string[]): FieldRule {
  return {
    required: () => null,
    optional: (row) => checkField(row, field, (v) => v === null || isEnum(v, allowed), field),
  };
}

function isoRule(field: string, required: boolean): FieldRule {
  const check = (row: Record<string, unknown>) => checkField(row, field, isIsoTimestamp, field);
  return required ? { required: check } : { required: () => null, optional: check };
}

function nullableIsoRule(field: string): FieldRule {
  return {
    required: () => null,
    optional: (row) => checkField(row, field, isNullableIso, field),
  };
}

function nullableTextRule(field: string): FieldRule {
  return {
    required: () => null,
    optional: (row) =>
      checkField(
        row,
        field,
        (v) => isNullableString(v) && (v === null || isBoundedString(v, field)),
        field,
      ),
  };
}

function isNullableIdText(value: unknown): boolean {
  return (
    value === null || (typeof value === 'string' && ID_PATTERN.test(value) && value.length <= 100)
  );
}

function nullableIdRule(field: string): FieldRule {
  return {
    required: (row) => checkField(row, field, isNullableIdText, field),
  };
}

function isStringArrayJson(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 5_000) return false;
  try {
    const parsed: unknown = JSON.parse(value);
    return (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string' && item.length <= 100)
    );
  } catch {
    return false;
  }
}

/**
 * Truly optional column rule: validates `value` when the column is present and
 * ignores it when absent. Used for the nullable `project_id`/`goal_id`/
 * `completed_at` columns added to existing entities — historical Portable V1
 * rows legitimately omit them, while current rows carry them (often NULL).
 */
function optionalColumnRule(field: string, validate: (v: unknown) => boolean): FieldRule {
  return {
    required: () => null,
    optional: (row) => (field in row ? checkField(row, field, validate, field) : null),
  };
}

function nullableDateKeyRule(field: string): FieldRule {
  return {
    required: () => null,
    optional: (row) => checkField(row, field, (v) => v === null || isDateKey(v), field),
  };
}

function nullableIntRule(field: string, min: number): FieldRule {
  return {
    required: () => null,
    optional: (row) =>
      checkField(row, field, (v) => v === null || (Number.isInteger(v) && Number(v) >= min), field),
  };
}

const TODO_RULES: FieldRule[] = [
  idRule('id'),
  textRule('title', true),
  nullableTextRule('notes'),
  intRule('completed', true, 0),
  {
    required: () => null,
    optional: (row) => checkField(row, 'completed', (v) => v === 0 || v === 1, 'completed'),
  },
  nullableTextRule('due_date'),
  enumRule('priority', ['urgent', 'normal', 'low']),
  intRule('sort_order', true, 0),
  nullableEnumRule('recurrence', ['daily']),
  nullableTextRule('recurrence_id'),
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
  optionalColumnRule('project_id', isNullableIdText),
  optionalColumnRule('goal_id', isNullableIdText),
  optionalColumnRule('completed_at', isNullableIso),
];

const HABIT_RULES: FieldRule[] = [
  idRule('id'),
  textRule('name', true),
  intRule('target_per_day', true, 1),
  nullableTextRule('reminder_time'),
  enumRule('category', ['anytime', 'morning', 'afternoon', 'evening']),
  enumRule('icon', [
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
  ]),
  textRule('color', true),
  {
    required: (row) =>
      checkField(row, 'rule_history', (v) => parseHabitRuleHistoryJson(v).ok, 'rule_history'),
  },
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
  optionalColumnRule('project_id', isNullableIdText),
  optionalColumnRule('goal_id', isNullableIdText),
  optionalColumnRule('status', (v) => isEnum(v, ['active', 'paused', 'archived'])),
  {
    required: () => null,
    optional: (row) =>
      'lifecycle_history' in row
        ? checkField(
            row,
            'lifecycle_history',
            (v) => parseHabitLifecycleHistoryJson(v).ok,
            'lifecycle_history',
          )
        : null,
  },
];

const HABIT_COMPLETION_RULES: FieldRule[] = [
  idRule('id'),
  idRule('habit_id'),
  { required: (row) => checkField(row, 'date_key', isDateKey, 'date_key') },
  intRule('count', true, 0),
  isoRule('created_at', true),
  isoRule('updated_at', true),
];

const CALORIE_ENTRY_RULES: FieldRule[] = [
  idRule('id'),
  textRule('food_name', true),
  intRule('calories', true, 0),
  {
    required: () => null,
    optional: (row) => checkField(row, 'protein', isNonNegativeNumber, 'protein'),
  },
  {
    required: () => null,
    optional: (row) => checkField(row, 'carbs', isNonNegativeNumber, 'carbs'),
  },
  { required: () => null, optional: (row) => checkField(row, 'fats', isNonNegativeNumber, 'fats') },
  {
    required: () => null,
    optional: (row) => checkField(row, 'fiber', isNonNegativeNumber, 'fiber'),
  },
  enumRule('meal_type', ['breakfast', 'lunch', 'dinner', 'snack']),
  { required: (row) => checkField(row, 'consumed_on', isDateKey, 'consumed_on') },
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
];

const SAVED_MEAL_RULES: FieldRule[] = [
  idRule('id'),
  textRule('food_name', true),
  intRule('calories', true, 0),
  {
    required: () => null,
    optional: (row) => checkField(row, 'protein', isNonNegativeNumber, 'protein'),
  },
  {
    required: () => null,
    optional: (row) => checkField(row, 'carbs', isNonNegativeNumber, 'carbs'),
  },
  { required: () => null, optional: (row) => checkField(row, 'fats', isNonNegativeNumber, 'fats') },
  {
    required: () => null,
    optional: (row) => checkField(row, 'fiber', isNonNegativeNumber, 'fiber'),
  },
  textRule('meal_type', true),
  intRule('use_count', true, 0),
  isoRule('last_used_at', true),
  isoRule('created_at', true),
];

const WORKOUT_ROUTINE_RULES: FieldRule[] = [
  idRule('id'),
  textRule('name', true),
  nullableTextRule('description'),
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
  optionalColumnRule('goal_tag', (v) => v === null || isBoundedString(v, 'name')),
];

const ROUTINE_EXERCISE_RULES: FieldRule[] = [
  idRule('id'),
  idRule('routine_id'),
  textRule('name', true),
  intRule('sort_order', true, 0),
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
  optionalColumnRule('catalog_exercise_id', isNullableString),
  optionalColumnRule('modality', (v) =>
    isEnum(v, ['weighted_strength', 'bodyweight', 'timed', 'cardio']),
  ),
  optionalColumnRule('unilateral', (v) => v === 0 || v === 1),
  optionalColumnRule('supports_external_load', (v) => v === 0 || v === 1),
  optionalColumnRule('notes', (v) => v === null || isBoundedString(v, 'notes')),
  optionalColumnRule('superset_group', (v) => v === null || isBoundedString(v, 'name')),
  optionalColumnRule('progression_mode', (v) => isEnum(v, ['none', 'linear', 'double'])),
  optionalColumnRule('progression_increment', (v) => v === null || isNonNegativeNumber(v)),
  optionalColumnRule(
    'progression_min_reps',
    (v) => v === null || (Number.isInteger(v) && Number(v) >= 1),
  ),
  optionalColumnRule(
    'progression_max_reps',
    (v) => v === null || (Number.isInteger(v) && Number(v) >= 1),
  ),
];

const ROUTINE_EXERCISE_SET_RULES: FieldRule[] = [
  idRule('id'),
  idRule('exercise_id'),
  intRule('set_number', true, 1),
  intRule('active_seconds', true, 0),
  intRule('rest_seconds', true, 0),
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
  optionalColumnRule(
    'target_reps_min',
    (v) => v === null || (Number.isInteger(v) && Number(v) >= 1),
  ),
  optionalColumnRule(
    'target_reps_max',
    (v) => v === null || (Number.isInteger(v) && Number(v) >= 1),
  ),
  optionalColumnRule('target_load', (v) => v === null || isNonNegativeNumber(v)),
  optionalColumnRule(
    'target_duration_seconds',
    (v) => v === null || (Number.isInteger(v) && Number(v) >= 0),
  ),
  optionalColumnRule('target_distance', (v) => v === null || isNonNegativeNumber(v)),
  optionalColumnRule('target_pace', (v) => v === null || isNonNegativeNumber(v)),
];

const WORKOUT_LOG_RULES: FieldRule[] = [
  idRule('id'),
  idRule('routine_id'),
  nullableTextRule('notes'),
  isoRule('completed_at', true),
  isoRule('created_at', true),
  // V5 timing columns: optional so historical manifests without them validate.
  optionalColumnRule('started_at', isNullableIso),
  optionalColumnRule('ended_at', isNullableIso),
  optionalColumnRule(
    'duration_seconds',
    (v) => v === null || (Number.isInteger(v) && Number(v) >= 0),
  ),
  optionalColumnRule('routine_name', (v) => v === null || isBoundedString(v, 'name')),
];

const WORKOUT_SESSION_EXERCISE_RULES: FieldRule[] = [
  idRule('id'),
  idRule('log_id'),
  textRule('exercise_name', true),
  intRule('sets_completed', true, 0),
  isoRule('created_at', true),
  optionalColumnRule('catalog_exercise_id', isNullableString),
  optionalColumnRule('modality', (v) =>
    isEnum(v, ['weighted_strength', 'bodyweight', 'timed', 'cardio']),
  ),
  optionalColumnRule('unilateral', (v) => v === 0 || v === 1),
  optionalColumnRule('supports_external_load', (v) => v === 0 || v === 1),
];

const WORKOUT_SESSION_SET_RULES: FieldRule[] = [
  idRule('id'),
  idRule('session_exercise_id'),
  intRule('set_number', true, 1),
  // NULL weight/reps mean "not recorded" (unknown) — never a measured zero.
  {
    required: () => null,
    optional: (row) =>
      checkField(
        row,
        'weight',
        (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && Number(v) >= 0),
        'weight',
      ),
  },
  {
    required: () => null,
    optional: (row) =>
      checkField(row, 'reps', (v) => v === null || (Number.isInteger(v) && Number(v) >= 0), 'reps'),
  },
  nullableEnumRule('weight_unit', ['kg', 'lb']),
  {
    required: (row) => checkField(row, 'completed', (v) => v === 0 || v === 1, 'completed'),
  },
  isoRule('created_at', true),
  optionalColumnRule(
    'duration_seconds',
    (v) => v === null || (Number.isInteger(v) && Number(v) >= 0),
  ),
  optionalColumnRule('distance', (v) => v === null || isNonNegativeNumber(v)),
  optionalColumnRule('pace', (v) => v === null || isNonNegativeNumber(v)),
  optionalColumnRule('effort_value', (v) => v === null || isNonNegativeNumber(v)),
  optionalColumnRule('effort_scale', (v) => v === null || isEnum(v, ['rir', 'rpe'])),
];

const CUSTOM_EXERCISE_RULES: FieldRule[] = [
  idRule('id'),
  textRule('name', true),
  nullableTextRule('description'),
  optionalColumnRule('aliases', (v) => v === null || isStringArrayJson(v)),
  optionalColumnRule('instructions', (v) => v === null || isBoundedString(v, 'instructions')),
  textRule('primary_area', true),
  { required: (row) => checkField(row, 'secondary_areas', isStringArrayJson, 'secondary_areas') },
  nullableTextRule('equipment'),
  enumRule('modality', ['weighted_strength', 'bodyweight', 'timed', 'cardio']),
  { required: (row) => checkField(row, 'unilateral', (v) => v === 0 || v === 1, 'unilateral') },
  optionalColumnRule('supports_external_load', (v) => v === 0 || v === 1),
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
];

const WORKOUT_WEEKLY_PLAN_RULES: FieldRule[] = [
  idRule('id'),
  {
    required: (row) =>
      checkField(
        row,
        'weekday',
        (v) => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 7,
        'weekday',
      ),
  },
  nullableIdRule('routine_id'),
  enumRule('plan_kind', ['workout', 'rest']),
  nullableTextRule('note'),
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
];

const WORKOUT_SCHEDULE_OVERRIDE_RULES: FieldRule[] = [
  idRule('id'),
  { required: (row) => checkField(row, 'date_key', isDateKey, 'date_key') },
  enumRule('override_kind', ['workout', 'rest']),
  nullableIdRule('routine_id'),
  nullableDateKeyRule('moved_from_date_key'),
  nullableTextRule('note'),
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
];

const BODY_WEIGHT_ENTRY_RULES: FieldRule[] = [
  idRule('id'),
  { required: (row) => checkField(row, 'measured_on', isDateKey, 'measured_on') },
  isoRule('measured_at', true),
  { required: (row) => checkField(row, 'weight', isPositiveNumber, 'weight') },
  enumRule('unit', ['kg', 'lb']),
  nullableTextRule('note'),
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
];

const POMODORO_SESSION_RULES: FieldRule[] = [
  idRule('id'),
  isoRule('started_at', true),
  isoRule('ended_at', true),
  intRule('duration_seconds', true, 0),
  enumRule('session_type', ['focus', 'break', 'short_break', 'long_break']),
  isoRule('created_at', true),
  // V5 session metadata columns: optional for historical rows.
  optionalColumnRule('linked_todo_id', isNullableIdText),
  optionalColumnRule('linked_todo_title', isNullableString),
  optionalColumnRule('note', isNullableString),
];

const LINKED_ACTION_RULE_RULES: FieldRule[] = [
  idRule('id'),
  enumRule('status', LINKED_ACTION_RULE_STATUSES),
  enumRule('direction_policy', LINKED_ACTION_DIRECTION_POLICIES),
  nullableTextRule('bidirectional_group_id'),
  enumRule('source_feature', LINKED_ACTION_FEATURES),
  {
    required: (row) =>
      checkField(
        row,
        'source_entity_type',
        (v) =>
          typeof v === 'string' &&
          LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE[
            row.source_feature as keyof typeof LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE
          ]?.includes(v as never) === true,
        'source_entity_type',
      ),
  },
  nullableTextRule('source_entity_id'),
  {
    required: (row) =>
      checkField(
        row,
        'trigger_type',
        (v) =>
          typeof v === 'string' &&
          Object.values(LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY).some((triggers) =>
            triggers.includes(v as never),
          ),
        'trigger_type',
      ),
  },
  enumRule('target_feature', LINKED_ACTION_FEATURES),
  {
    required: (row) =>
      checkField(
        row,
        'target_entity_type',
        (v) =>
          typeof v === 'string' &&
          LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE[
            row.target_feature as keyof typeof LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE
          ]?.includes(v as never) === true,
        'target_entity_type',
      ),
  },
  nullableTextRule('target_entity_id'),
  {
    required: (row) =>
      checkField(
        row,
        'effect_type',
        (v) =>
          typeof v === 'string' &&
          Object.values(LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY).some((effects) =>
            effects.includes(v as never),
          ),
        'effect_type',
      ),
  },
  {
    required: (row) =>
      checkField(row, 'effect_payload', (v) => parseEffectPayloadJson(v).ok, 'effect_payload'),
  },
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
];

const WEEKLY_REVIEW_RULES: FieldRule[] = [
  idRule('id'),
  textRule('week_key', true),
  textRule('week_start_date', true),
  textRule('week_end_date', true),
  textRule('next_week_start_date', true),
  nullableIsoRule('completed_at'),
  enumRule('status', ['draft', 'completed']),
  textRule('summary_payload', true),
  textRule('plan_payload', true),
  textRule('reflection', true),
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
];

const PROJECT_RULES: FieldRule[] = [
  idRule('id'),
  textRule('name', true),
  nullableTextRule('description'),
  textRule('color', true),
  enumRule('status', ['active', 'paused', 'completed', 'archived']),
  nullableDateKeyRule('target_date'),
  intRule('sort_order', true, 0),
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
  nullableIsoRule('completed_at'),
];

const GOAL_RULES: FieldRule[] = [
  idRule('id'),
  optionalColumnRule('project_id', isNullableIdText),
  textRule('title', true),
  nullableTextRule('description'),
  enumRule('horizon', ['week', 'month', 'quarter', 'year', 'custom']),
  nullableDateKeyRule('target_date'),
  enumRule('status', ['active', 'paused', 'completed', 'archived']),
  intRule('progress_percent', true, 0),
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
  nullableIsoRule('completed_at'),
];

const DAILY_PLAN_RULES: FieldRule[] = [
  idRule('id'),
  { required: (row) => checkField(row, 'date_key', isDateKey, 'date_key') },
  nullableTextRule('intention'),
  textRule('top_todo_ids', true),
  // v21 historical title snapshots: absent on pre-v21/legacy rows, nullable on
  // current rows. Append-only column, so absence must stay valid (no scope bump).
  optionalColumnRule('top_todo_titles', (v) => v === null || isBoundedString(v, 'top_todo_titles')),
  intRule('focus_target_minutes', true, 0),
  nullableTextRule('notes'),
  nullableTextRule('reflection'),
  nullableIntRule('energy_score', 0),
  enumRule('status', ['draft', 'committed', 'completed']),
  isoRule('created_at', true),
  isoRule('updated_at', true),
  nullableIsoRule('deleted_at'),
  nullableIsoRule('completed_at'),
];

const RULES_BY_ENTITY: Record<BackupEntity, FieldRule[]> = {
  todos: TODO_RULES,
  habits: HABIT_RULES,
  habit_completions: HABIT_COMPLETION_RULES,
  calorie_entries: CALORIE_ENTRY_RULES,
  saved_meals: SAVED_MEAL_RULES,
  workout_routines: WORKOUT_ROUTINE_RULES,
  routine_exercises: ROUTINE_EXERCISE_RULES,
  routine_exercise_sets: ROUTINE_EXERCISE_SET_RULES,
  workout_logs: WORKOUT_LOG_RULES,
  workout_session_exercises: WORKOUT_SESSION_EXERCISE_RULES,
  workout_session_sets: WORKOUT_SESSION_SET_RULES,
  pomodoro_sessions: POMODORO_SESSION_RULES,
  linked_action_rules: LINKED_ACTION_RULE_RULES,
  weekly_reviews: WEEKLY_REVIEW_RULES,
  projects: PROJECT_RULES,
  goals: GOAL_RULES,
  daily_plans: DAILY_PLAN_RULES,
  custom_exercises: CUSTOM_EXERCISE_RULES,
  workout_weekly_plan: WORKOUT_WEEKLY_PLAN_RULES,
  workout_schedule_overrides: WORKOUT_SCHEDULE_OVERRIDE_RULES,
  body_weight_entries: BODY_WEIGHT_ENTRY_RULES,
};

/**
 * Validate one remote row for `entity`. Rejects unknown columns (schema
 * drift), missing required fields, invalid enums/ranges/timestamps/date keys,
 * and malformed JSON fields.
 */
export function validateBackupRow(entity: BackupEntity, input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: [`${entity} row must be an object`] };
  }
  const columns = BACKUP_ENTITY_COLUMNS[entity];
  for (const key of Object.keys(input)) {
    if (key === 'user_id') continue;
    if (!columns.includes(key)) {
      errors.push(`${entity} row has unknown column "${key}"`);
    }
  }
  for (const rule of RULES_BY_ENTITY[entity]) {
    const error = rule.required(input) ?? rule.optional?.(input) ?? null;
    if (error) errors.push(error);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, row: input };
}

/** Duplicate-key and dependency-graph validation across a full prefetched backup. */
export function validateBackupGraph(
  rowsByEntity: Partial<Record<BackupEntity, Record<string, unknown>[]>>,
): string[] {
  const errors: string[] = [];
  const ids = (entity: BackupEntity): Set<string> => {
    const set = new Set<string>();
    for (const row of rowsByEntity[entity] ?? []) {
      if (typeof row.id === 'string') set.add(row.id);
    }
    return set;
  };

  const habitIds = ids('habits');
  const routineIds = ids('workout_routines');
  const exerciseIds = ids('routine_exercises');
  const logIds = ids('workout_logs');
  const customExerciseIds = ids('custom_exercises');

  // Habit completions: parent must exist (including tombstoned habits) and
  // (habit_id, date_key) must be unique.
  const completionKeys = new Set<string>();
  for (const row of rowsByEntity.habit_completions ?? []) {
    const key = `${String(row.habit_id)}|${String(row.date_key)}`;
    if (completionKeys.has(key)) {
      errors.push(`habit_completions duplicate (habit_id, date_key): ${key}`);
    }
    completionKeys.add(key);
    if (typeof row.habit_id !== 'string' || !habitIds.has(row.habit_id)) {
      errors.push(`habit_completions references missing habit: ${String(row.habit_id)}`);
    }
  }

  // Saved meals: case-insensitive unique food_name.
  const mealNames = new Map<string, string>();
  for (const row of rowsByEntity.saved_meals ?? []) {
    if (typeof row.food_name === 'string') {
      const normalized = row.food_name.toLocaleLowerCase();
      const existing = mealNames.get(normalized);
      if (existing !== undefined) {
        errors.push(`saved_meals duplicate food_name: "${existing}" / "${row.food_name}"`);
      }
      mealNames.set(normalized, row.food_name);
    }
  }

  // Routine exercises -> routines (parent may be tombstoned but must exist).
  for (const row of rowsByEntity.routine_exercises ?? []) {
    if (typeof row.routine_id !== 'string' || !routineIds.has(row.routine_id)) {
      errors.push(`routine_exercises references missing routine: ${String(row.routine_id)}`);
    }
    if (typeof row.catalog_exercise_id === 'string') {
      const isBuiltIn = /^builtin_[a-z0-9_]+$/.test(row.catalog_exercise_id);
      if (!isBuiltIn && !customExerciseIds.has(row.catalog_exercise_id)) {
        errors.push(
          `routine_exercises references missing catalog exercise: ${row.catalog_exercise_id}`,
        );
      }
    }
  }

  // Sets -> exercises.
  for (const row of rowsByEntity.routine_exercise_sets ?? []) {
    if (typeof row.exercise_id !== 'string' || !exerciseIds.has(row.exercise_id)) {
      errors.push(`routine_exercise_sets references missing exercise: ${String(row.exercise_id)}`);
    }
  }

  // Logs -> routines.
  for (const row of rowsByEntity.workout_logs ?? []) {
    if (typeof row.routine_id !== 'string' || !routineIds.has(row.routine_id)) {
      errors.push(`workout_logs references missing routine: ${String(row.routine_id)}`);
    }
  }

  // Session exercises -> logs.
  for (const row of rowsByEntity.workout_session_exercises ?? []) {
    if (typeof row.log_id !== 'string' || !logIds.has(row.log_id)) {
      errors.push(`workout_session_exercises references missing log: ${String(row.log_id)}`);
    }
  }

  // Session sets -> session exercises.
  const sessionExerciseIds = ids('workout_session_exercises');
  for (const row of rowsByEntity.workout_session_sets ?? []) {
    if (
      typeof row.session_exercise_id !== 'string' ||
      !sessionExerciseIds.has(row.session_exercise_id)
    ) {
      errors.push(
        `workout_session_sets references missing session exercise: ${String(row.session_exercise_id)}`,
      );
    }
  }

  // Gym V2 schedule relationships. Tombstoned routines/custom exercises are
  // intentionally valid parents so historical plans and configuration remain
  // restorable after an archive/delete.
  for (const row of rowsByEntity.workout_weekly_plan ?? []) {
    if (typeof row.routine_id === 'string' && !routineIds.has(row.routine_id)) {
      errors.push(`workout_weekly_plan references missing routine: ${row.routine_id}`);
    }
  }
  for (const row of rowsByEntity.workout_schedule_overrides ?? []) {
    if (typeof row.routine_id === 'string' && !routineIds.has(row.routine_id)) {
      errors.push(`workout_schedule_overrides references missing routine: ${row.routine_id}`);
    }
  }

  const activeWeekdays = new Set<number>();
  for (const row of rowsByEntity.workout_weekly_plan ?? []) {
    if (row.deleted_at !== null && row.deleted_at !== undefined) continue;
    if (typeof row.weekday === 'number') {
      if (activeWeekdays.has(row.weekday)) {
        errors.push(`workout_weekly_plan duplicate active weekday: ${row.weekday}`);
      }
      activeWeekdays.add(row.weekday);
    }
  }
  const activeOverrideDates = new Set<string>();
  for (const row of rowsByEntity.workout_schedule_overrides ?? []) {
    if (row.deleted_at !== null && row.deleted_at !== undefined) continue;
    if (typeof row.date_key === 'string') {
      if (activeOverrideDates.has(row.date_key)) {
        errors.push(`workout_schedule_overrides duplicate active date: ${row.date_key}`);
      }
      activeOverrideDates.add(row.date_key);
    }
  }

  // Planning relationships (Scope V4+): parents must exist; tombstoned
  // parents are allowed because history must survive soft deletes.
  const todoIds = ids('todos');
  const projectIds = ids('projects');
  const goalIds = ids('goals');

  for (const row of rowsByEntity.todos ?? []) {
    if (
      typeof row.project_id === 'string' &&
      row.project_id.length > 0 &&
      !projectIds.has(row.project_id)
    ) {
      errors.push(`todos references missing project: ${row.project_id}`);
    }
    if (typeof row.goal_id === 'string' && row.goal_id.length > 0 && !goalIds.has(row.goal_id)) {
      errors.push(`todos references missing goal: ${row.goal_id}`);
    }
  }

  for (const row of rowsByEntity.goals ?? []) {
    if (
      typeof row.project_id === 'string' &&
      row.project_id.length > 0 &&
      !projectIds.has(row.project_id)
    ) {
      errors.push(`goals references missing project: ${row.project_id}`);
    }
  }

  for (const row of rowsByEntity.habits ?? []) {
    if (
      typeof row.project_id === 'string' &&
      row.project_id.length > 0 &&
      !projectIds.has(row.project_id)
    ) {
      errors.push(`habits references missing project: ${row.project_id}`);
    }
    if (typeof row.goal_id === 'string' && row.goal_id.length > 0 && !goalIds.has(row.goal_id)) {
      errors.push(`habits references missing goal: ${row.goal_id}`);
    }
  }

  for (const row of rowsByEntity.daily_plans ?? []) {
    let topTodoIds: unknown;
    try {
      topTodoIds = typeof row.top_todo_ids === 'string' ? JSON.parse(row.top_todo_ids) : null;
    } catch {
      topTodoIds = null;
    }
    if (!Array.isArray(topTodoIds)) continue;
    for (const todoId of topTodoIds) {
      if (typeof todoId === 'string' && !todoIds.has(todoId)) {
        errors.push(`daily_plans top_todo_ids references missing todo: ${todoId}`);
      }
    }
  }

  // Duplicate ids within each entity.
  for (const entity of Object.keys(rowsByEntity) as BackupEntity[]) {
    const seen = new Set<string>();
    for (const row of rowsByEntity[entity] ?? []) {
      if (typeof row.id === 'string') {
        if (seen.has(row.id)) errors.push(`${entity} duplicate id: ${row.id}`);
        seen.add(row.id);
      }
    }
  }

  return errors;
}
