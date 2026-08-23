import { describe, expect, it } from 'vitest';
import { BACKUP_ENTITIES, type BackupEntity } from '@/core/backup/backup.types';
import {
  buildPortableBackupFile,
  canonicalPortablePayloadText,
  computePortablePayloadChecksum,
  portableExportFileName,
  validatePortableBackupFile,
} from '@/core/portable/portableFormat';
import {
  PORTABLE_BACKUP_FORMAT_VERSION,
  type PortableBackupFile,
} from '@/core/portable/portable.types';
import { sha256Hex } from '@/lib/checksum';
import { portableOwnerFingerprint } from '@/lib/portableOwnerFingerprint';

const ISO = '2026-08-16T05:30:00.000Z';
const DATE_KEY = '2026-08-15';

/** Minimal valid row per entity (all required fields, bounded values). */
function makeRow(
  entity: BackupEntity,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    todos: {
      id: 'todo_1',
      title: 'Write report',
      notes: null,
      completed: 0,
      due_date: null,
      priority: 'normal',
      sort_order: 0,
      recurrence: null,
      recurrence_id: null,
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
    },
    habits: {
      id: 'habit_1',
      name: 'Run',
      target_per_day: 1,
      reminder_time: null,
      category: 'anytime',
      icon: 'check-circle',
      color: '#64748b',
      rule_history: '[]',
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
    },
    habit_completions: {
      id: 'hcmp_1',
      habit_id: 'habit_1',
      date_key: DATE_KEY,
      count: 1,
      created_at: ISO,
      updated_at: ISO,
    },
    calorie_entries: {
      id: 'cal_1',
      food_name: 'Oatmeal',
      calories: 250,
      protein: 8,
      carbs: 40,
      fats: 4,
      fiber: 5,
      meal_type: 'breakfast',
      consumed_on: DATE_KEY,
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
    },
    saved_meals: {
      id: 'smeal_1',
      food_name: 'Oatmeal',
      calories: 250,
      protein: 8,
      carbs: 40,
      fats: 4,
      fiber: 5,
      meal_type: 'breakfast',
      use_count: 3,
      last_used_at: ISO,
      created_at: ISO,
    },
    workout_routines: {
      id: 'wrk_1',
      name: 'Push day',
      description: null,
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
    },
    routine_exercises: {
      id: 'ex_1',
      routine_id: 'wrk_1',
      name: 'Bench press',
      sort_order: 0,
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
    },
    routine_exercise_sets: {
      id: 'eset_1',
      exercise_id: 'ex_1',
      set_number: 1,
      active_seconds: 40,
      rest_seconds: 20,
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
    },
    workout_logs: {
      id: 'wrk_2',
      routine_id: 'wrk_1',
      notes: null,
      completed_at: ISO,
      created_at: ISO,
    },
    workout_session_exercises: {
      id: 'wsex_1',
      log_id: 'wrk_2',
      exercise_name: 'Bench press',
      sets_completed: 3,
      created_at: ISO,
    },
    pomodoro_sessions: {
      id: 'pom_1',
      started_at: ISO,
      ended_at: ISO,
      duration_seconds: 1500,
      session_type: 'focus',
      created_at: ISO,
    },
    linked_action_rules: {
      id: 'la_1',
      status: 'active',
      direction_policy: 'one_way',
      bidirectional_group_id: null,
      source_feature: 'todos',
      source_entity_type: 'todo',
      source_entity_id: 'todo_1',
      trigger_type: 'todo.completed',
      target_feature: 'habits',
      target_entity_type: 'habit',
      target_entity_id: 'habit_1',
      effect_type: 'habit.increment',
      effect_payload: '{}',
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
    },
    weekly_reviews: {
      id: 'wrev_1',
      week_key: '2026-08-11',
      week_start_date: '2026-08-11',
      week_end_date: '2026-08-17',
      next_week_start_date: '2026-08-18',
      completed_at: ISO,
      status: 'completed',
      summary_payload: '{"version":1}',
      plan_payload: '{"priorities":[]}',
      reflection: 'Good week',
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
    },
    projects: {
      id: 'proj_1',
      name: 'Ship SuperHabits',
      description: null,
      color: '#0f766e',
      status: 'active',
      target_date: null,
      sort_order: 0,
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
      completed_at: null,
    },
    goals: {
      id: 'goal_1',
      project_id: null,
      title: 'Learn Spanish',
      description: null,
      horizon: 'month',
      target_date: null,
      status: 'active',
      progress_percent: 0,
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
      completed_at: null,
    },
    daily_plans: {
      id: 'dplan_1',
      date_key: DATE_KEY,
      intention: '',
      top_todo_ids: '[]',
      focus_target_minutes: 0,
      notes: '',
      reflection: '',
      energy_score: null,
      status: 'draft',
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
      completed_at: null,
    },
    workout_session_sets: {
      id: 'sset_1',
      session_exercise_id: 'wsex_1',
      set_number: 1,
      weight: null,
      reps: null,
      weight_unit: null,
      completed: 1,
      created_at: ISO,
    },
    custom_exercises: {
      id: 'cex_1',
      name: 'Cable press',
      description: null,
      primary_area: 'chest',
      secondary_areas: '[]',
      equipment: 'cable',
      modality: 'weighted_strength',
      unilateral: 0,
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
    },
    workout_weekly_plan: {
      id: 'wplan_1',
      weekday: 1,
      routine_id: 'wrk_1',
      plan_kind: 'workout',
      note: null,
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
    },
    workout_schedule_overrides: {
      id: 'wover_1',
      date_key: DATE_KEY,
      override_kind: 'rest',
      routine_id: null,
      moved_from_date_key: null,
      note: 'Recovery day',
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
    },
    body_weight_entries: {
      id: 'bweight_1',
      measured_on: DATE_KEY,
      measured_at: ISO,
      weight: 80,
      unit: 'kg',
      note: null,
      created_at: ISO,
      updated_at: ISO,
      deleted_at: null,
    },
  } as const;
  return { ...(base[entity] as Record<string, unknown>), ...overrides };
}

function buildFixture(
  options: {
    rows?: Partial<Record<BackupEntity, Record<string, unknown>[]>>;
    ownerFingerprint?: string | null;
    settings?: unknown;
    exportedAt?: string;
  } = {},
): PortableBackupFile {
  const rowsByEntity: Partial<Record<BackupEntity, Record<string, unknown>[]>> = {};
  for (const entity of BACKUP_ENTITIES) {
    rowsByEntity[entity] = options.rows?.[entity] ?? [makeRow(entity)];
  }
  return buildPortableBackupFile({
    exportedAt: options.exportedAt ?? ISO,
    appVersion: '1.0.0',
    platform: 'web',
    ownerFingerprint: options.ownerFingerprint ?? null,
    rowsByEntity,
    settings:
      options.settings ??
      ({
        calorieGoal: { calories: 2200, protein: 140, carbs: 240, fats: 70 },
        pomodoroSettings: {
          focusMinutes: 25,
          shortBreakMinutes: 5,
          longBreakMinutes: 15,
          sessionsBeforeLongBreak: 4,
        },
        theme: { mode: 'dark', slots: { primary: '#0f766e' } },
      } satisfies PortableBackupFile['settings']),
  });
}

function expectValid(file: PortableBackupFile): void {
  const result = validatePortableBackupFile(JSON.parse(JSON.stringify(file)));
  expect(result.ok).toBe(true);
}

function expectInvalid(file: unknown, matcher: RegExp | string): void {
  const result = validatePortableBackupFile(JSON.parse(JSON.stringify(file)));
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.errors.join('\n')).toMatch(matcher);
}

describe('portableOwnerFingerprint', () => {
  it('is a one-way, domain-separated SHA-256 of the owner id', () => {
    const fp = portableOwnerFingerprint('11111111-2222-3333-4444-555555555555');
    expect(fp).toBe(
      sha256Hex('superhabits-portable-owner-v1:11111111-2222-3333-4444-555555555555'),
    );
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
    expect(fp).not.toContain('11111111-2222-3333-4444-555555555555');
  });

  it('differs across owners and is deterministic per owner', () => {
    const a = '11111111-2222-3333-4444-555555555555';
    const b = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(portableOwnerFingerprint(a)).not.toBe(portableOwnerFingerprint(b));
    expect(portableOwnerFingerprint(a)).toBe(portableOwnerFingerprint(a));
  });
});

describe('portableExportFileName', () => {
  it('produces a deterministic, Windows-safe filename', () => {
    expect(portableExportFileName('2026-08-16T05:30:00.000Z')).toBe(
      'superhabits-backup-2026-08-16T05-30-00Z.json',
    );
    expect(portableExportFileName('2026-08-16T05:30:00.000Z')).toMatch(
      /^superhabits-backup-.*\.json$/,
    );
    expect(portableExportFileName('2026-08-16T05:30:00.000Z')).not.toMatch(/:/);
  });
});

describe('portable envelope build + validate round trip', () => {
  it('accepts a freshly built file', () => {
    expectValid(buildFixture());
  });

  it('stores rows sorted by id', () => {
    const file = buildFixture({
      rows: { todos: [makeRow('todos', { id: 'todo_b' }), makeRow('todos', { id: 'todo_a' })] },
    });
    expect(file.entities.todos?.map((row) => row.id)).toEqual(['todo_a', 'todo_b']);
  });

  it('writes an empty entity list for an entity with no rows', () => {
    const file = buildFixture({ rows: { todos: [] } });
    expect(file.entities.todos).toEqual([]);
    expectValid(file);
  });
});

describe('deterministic canonicalization', () => {
  it('payload checksum is independent of row order and JSON key order', () => {
    const fileA = buildFixture({
      rows: {
        todos: [
          makeRow('todos', { id: 'todo_3' }),
          makeRow('todos', { id: 'todo_1' }),
          makeRow('todos', { id: 'todo_2' }),
        ],
      },
    });
    const shuffled = JSON.parse(JSON.stringify(fileA)) as PortableBackupFile;
    // Reverse row order inside the entity array.
    shuffled.entities.todos = [
      shuffled.entities.todos![2],
      shuffled.entities.todos![0],
      shuffled.entities.todos![1],
    ];
    const result = validatePortableBackupFile(shuffled);
    expect(result.ok).toBe(true);

    // Re-serialized with different JSON key order must canonicalize identically.
    const weirdOrder = JSON.stringify(fileA, (key, value) => {
      void key;
      if (Array.isArray(value) || value === null || typeof value !== 'object') return value;
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).reverse());
    });
    const reparsed = validatePortableBackupFile(JSON.parse(weirdOrder));
    expect(reparsed.ok).toBe(true);
  });

  it('canonical text covers the fingerprint and exportedAt', () => {
    const file = buildFixture({ ownerFingerprint: portableOwnerFingerprint('owner-a') });
    const text = canonicalPortablePayloadText(file);
    expect(text).toContain('ownerFingerprint:');
    expect(text).toContain('exportedAt:2026-08-16T05:30:00.000Z');
    expect(text).toContain('settings:');
  });

  it('payload checksum changes when any canonical field changes', () => {
    const file = buildFixture();
    const baseline = computePortablePayloadChecksum(file);
    for (const mutate of [
      (f: PortableBackupFile) => (f.exportedAt = '2026-08-17T00:00:00.000Z'),
      (f: PortableBackupFile) => (f.source.ownerFingerprint = portableOwnerFingerprint('other')),
      (f: PortableBackupFile) => (f.source.appVersion = '2.0.0'),
      (f: PortableBackupFile) => (f.entities.todos![0].title = 'Edited'),
      (f: PortableBackupFile) => (f.entities.pomodoro_sessions![0].duration_seconds = 9999),
    ]) {
      const copy = JSON.parse(JSON.stringify(file)) as PortableBackupFile;
      mutate(copy);
      expect(computePortablePayloadChecksum(copy)).not.toBe(baseline);
    }
  });
});

describe('tamper detection', () => {
  it('rejects a changed row value', () => {
    const file = buildFixture();
    file.entities.todos![0].title = 'Tampered title';
    expectInvalid(file, /payload failed integrity verification/);
  });

  it('rejects a changed entity checksum', () => {
    const file = buildFixture();
    file.integrity.entities.todos = { count: 1, checksum: 'f'.repeat(64) };
    expectInvalid(file, /integrity mismatch/);
  });

  it('rejects a changed row count', () => {
    const file = buildFixture();
    file.integrity.entities.todos = { count: 2, checksum: file.integrity.entities.todos!.checksum };
    expectInvalid(file, /integrity mismatch/);
  });

  it('rejects a changed settings value', () => {
    const file = buildFixture();
    (file.settings.theme as Record<string, unknown>).mode = 'light';
    expectInvalid(file, /settings failed integrity verification/);
  });

  it('rejects a changed settings checksum', () => {
    const file = buildFixture();
    file.integrity.settings.checksum = 'e'.repeat(64);
    expectInvalid(file, /settings failed integrity verification/);
  });

  it('rejects a tampered owner fingerprint', () => {
    const file = buildFixture({ ownerFingerprint: portableOwnerFingerprint('owner-a') });
    file.source.ownerFingerprint = portableOwnerFingerprint('owner-b');
    expectInvalid(file, /payload failed integrity verification/);
  });

  it('rejects a changed exportedAt', () => {
    const file = buildFixture();
    file.exportedAt = '2026-01-01T00:00:00.000Z';
    expectInvalid(file, /payload failed integrity verification/);
  });

  it('rejects an edited payloadChecksum', () => {
    const file = buildFixture();
    file.integrity.payloadChecksum = 'd'.repeat(64);
    expectInvalid(file, /payload failed integrity verification/);
  });

  it('rejects an added entity row', () => {
    const file = buildFixture();
    file.entities.todos!.push(makeRow('todos', { id: 'todo_2' }));
    expectInvalid(file, /integrity mismatch/);
  });
});

describe('version and envelope rejection', () => {
  it('rejects a wrong format string', () => {
    const file = buildFixture();
    (file as unknown as Record<string, unknown>).format = 'something-else';
    expectInvalid(file, /not a Super Habits portable backup/);
  });

  it('rejects a missing formatVersion', () => {
    const file = buildFixture() as unknown as Record<string, unknown>;
    delete file.formatVersion;
    expectInvalid(file, /missing a valid portable format version/);
  });

  it('rejects a future formatVersion', () => {
    const file = buildFixture();
    (file as unknown as Record<string, unknown>).formatVersion = PORTABLE_BACKUP_FORMAT_VERSION + 1;
    expectInvalid(file, /requires a newer app/);
  });

  it('rejects a legacy formatVersion', () => {
    const file = buildFixture();
    (file as unknown as Record<string, unknown>).formatVersion = 0;
    expectInvalid(file, /not supported/);
  });

  it('rejects a future backup schema version', () => {
    const file = buildFixture();
    (file as unknown as Record<string, unknown>).backupSchemaVersion = 3;
    expectInvalid(file, /requires a newer app/);
  });

  it('rejects a legacy backup schema version', () => {
    const file = buildFixture();
    (file as unknown as Record<string, unknown>).backupSchemaVersion = 1;
    expectInvalid(file, /not supported/);
  });

  it('rejects a missing entity group', () => {
    const file = buildFixture() as unknown as Record<string, unknown>;
    delete (file.entities as Record<string, unknown>).pomodoro_sessions;
    expectInvalid(file, /missing the complete backup scope/);
  });

  it('rejects an unknown entity group', () => {
    const file = buildFixture() as unknown as Record<string, unknown>;
    (file.entities as Record<string, unknown>).app_meta = [];
    expectInvalid(file, /unsupported data groups/);
  });

  it('rejects a non-array entity group', () => {
    const file = buildFixture() as unknown as Record<string, unknown>;
    (file.entities as Record<string, unknown>).todos = 'not-an-array';
    expectInvalid(file, /not a list/);
  });

  it('rejects a malformed exportedAt', () => {
    const file = buildFixture();
    (file as unknown as Record<string, unknown>).exportedAt = 'yesterday';
    expectInvalid(file, /invalid export timestamp/);
  });

  it('rejects a malformed source fingerprint', () => {
    const file = buildFixture({ ownerFingerprint: 'not-a-fingerprint' });
    expectInvalid(file, /owner fingerprint is invalid/);
  });
});

describe('row validation', () => {
  it('rejects an invalid todo', () => {
    const file = buildFixture({ rows: { todos: [makeRow('todos', { completed: 7 })] } });
    expectInvalid(file, /todos/);
  });

  it('rejects an invalid habit rule_history', () => {
    const file = buildFixture({ rows: { habits: [makeRow('habits', { rule_history: '[1,2]' })] } });
    expectInvalid(file, /habits/);
  });

  it('rejects a malformed saved meal', () => {
    const file = buildFixture({
      rows: { saved_meals: [makeRow('saved_meals', { use_count: -1 })] },
    });
    expectInvalid(file, /saved_meals/);
  });

  it('rejects a bad pomodoro session type', () => {
    const file = buildFixture({
      rows: { pomodoro_sessions: [makeRow('pomodoro_sessions', { session_type: 'nap' })] },
    });
    expectInvalid(file, /pomodoro_sessions/);
  });

  it('rejects a malformed linked action rule', () => {
    const file = buildFixture({
      rows: { linked_action_rules: [makeRow('linked_action_rules', { effect_payload: '{' })] },
    });
    expectInvalid(file, /linked_action_rules/);
  });

  it('rejects duplicate entity ids', () => {
    const file = buildFixture({
      rows: { todos: [makeRow('todos'), makeRow('todos', { id: 'todo_1', title: 'Second' })] },
    });
    expectInvalid(file, /duplicate id/);
  });

  it('rejects duplicate habit completions for the same day', () => {
    const file = buildFixture({
      rows: {
        habit_completions: [
          makeRow('habit_completions'),
          makeRow('habit_completions', { id: 'hcmp_2' }),
        ],
      },
    });
    expectInvalid(file, /duplicate \(habit_id, date_key\)/);
  });

  it('rejects a completion for a missing habit', () => {
    const file = buildFixture({
      rows: { habits: [], habit_completions: [makeRow('habit_completions')] },
    });
    expectInvalid(file, /references missing habit/);
  });

  it('rejects a broken workout routine parent', () => {
    const file = buildFixture({
      rows: { workout_routines: [], routine_exercises: [makeRow('routine_exercises')] },
    });
    expectInvalid(file, /references missing routine/);
  });

  it('rejects a broken workout set parent', () => {
    const file = buildFixture({
      rows: { routine_exercises: [], routine_exercise_sets: [makeRow('routine_exercise_sets')] },
    });
    expectInvalid(file, /references missing exercise/);
  });

  it('rejects a broken workout log parent', () => {
    const file = buildFixture({
      rows: { workout_routines: [], workout_logs: [makeRow('workout_logs')] },
    });
    expectInvalid(file, /references missing routine/);
  });

  it('rejects a broken session-exercise parent', () => {
    const file = buildFixture({
      rows: { workout_logs: [], workout_session_exercises: [makeRow('workout_session_exercises')] },
    });
    expectInvalid(file, /references missing log/);
  });

  it('rejects duplicate saved meal names case-insensitively', () => {
    const file = buildFixture({
      rows: {
        saved_meals: [
          makeRow('saved_meals'),
          makeRow('saved_meals', { id: 'smeal_2', food_name: 'oatmeal' }),
        ],
      },
    });
    expectInvalid(file, /duplicate food_name/);
  });
});

describe('hostile content is data', () => {
  it('accepts bounded script/HTML/SQL-looking strings as plain data', () => {
    const file = buildFixture({
      rows: {
        todos: [
          makeRow('todos', {
            title: '<script>alert("xss")</script>; DROP TABLE todos; --',
            notes: 'line1\nline2\u0000control',
          }),
        ],
      },
    });
    expectValid(file);
  });

  it('rejects over-long strings', () => {
    const file = buildFixture({
      rows: { todos: [makeRow('todos', { title: 'x'.repeat(501) })] },
    });
    expectInvalid(file, /todos/);
  });
});

describe('settings payload handling', () => {
  it('normalizes malformed-but-recoverable settings before hashing', () => {
    // Unknown keys are dropped and defaults are applied by the normalizer; the
    // canonical checksum is computed over the normalized shape, so a file
    // carrying extra settings keys still validates when checksums agree.
    const file = buildFixture();
    const withExtraKeys = JSON.parse(JSON.stringify(file)) as PortableBackupFile;
    (withExtraKeys.settings as unknown as Record<string, unknown>).secretKey = 'should-drop';
    const result = validatePortableBackupFile(withExtraKeys);
    expect(result.ok).toBe(true);
  });

  it('rejects a settings payload that normalizes away to defaults when checksums disagree', () => {
    const file = buildFixture({
      settings: {
        calorieGoal: null,
        pomodoroSettings: null,
        theme: { mode: 'light', slots: null },
      },
    });
    expectValid(file);
    const changed = JSON.parse(JSON.stringify(file)) as PortableBackupFile;
    (changed.settings as unknown as Record<string, unknown>).theme = { mode: 'dark', slots: null };
    expectInvalid(changed, /settings failed integrity verification/);
  });
});
