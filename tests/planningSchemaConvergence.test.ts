import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  BACKUP_ENTITIES,
  BACKUP_ENTITY_COLUMNS,
  type BackupEntity,
} from '@/core/backup/backup.types';
import { validateBackupRow, validateBackupGraph } from '@/core/backup/backupValidators';
import {
  buildPortableBackupFile,
  validatePortableBackupFile,
} from '@/core/portable/portableFormat';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const ISO = '2026-08-20T08:00:00.000Z';

function makeHabit(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function makeTodo(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

describe('Habit completed_at backup-contract discrepancy resolution', () => {
  it('excludes completed_at from the Habit canonical columns', () => {
    const habitColumns = BACKUP_ENTITY_COLUMNS.habits;
    expect(habitColumns).not.toContain('completed_at');
    // Habits remain planning-associated.
    expect(habitColumns).toContain('project_id');
    expect(habitColumns).toContain('goal_id');
  });

  it('keeps completed_at on the entities that legitimately have a terminal completion', () => {
    expect(BACKUP_ENTITY_COLUMNS.todos).toContain('completed_at');
    expect(BACKUP_ENTITY_COLUMNS.projects).toContain('completed_at');
    expect(BACKUP_ENTITY_COLUMNS.goals).toContain('completed_at');
    expect(BACKUP_ENTITY_COLUMNS.daily_plans).toContain('completed_at');
  });

  it('requires the current Todo planning/completion columns', () => {
    const todoColumns = BACKUP_ENTITY_COLUMNS.todos;
    expect(todoColumns).toContain('project_id');
    expect(todoColumns).toContain('goal_id');
    expect(todoColumns).toContain('completed_at');
  });

  it('accepts a well-formed habit without completed_at', () => {
    expect(validateBackupRow('habits', makeHabit()).ok).toBe(true);
  });

  it('rejects a habit row that carries a completed_at field (contract removed it)', () => {
    const result = validateBackupRow('habits', makeHabit({ completed_at: ISO }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toMatch(/unknown column/i);
  });
});

describe('Planning association backup contract', () => {
  it('todos and habits carry project_id/goal_id for owner-safe relationships', () => {
    expect(BACKUP_ENTITY_COLUMNS.todos).toContain('project_id');
    expect(BACKUP_ENTITY_COLUMNS.todos).toContain('goal_id');
    expect(BACKUP_ENTITY_COLUMNS.habits).toContain('project_id');
    expect(BACKUP_ENTITY_COLUMNS.habits).toContain('goal_id');
  });

  it('planning entities are part of the recoverable backup scope', () => {
    const entities = BACKUP_ENTITIES as readonly BackupEntity[];
    expect(entities).toContain('projects');
    expect(entities).toContain('goals');
    expect(entities).toContain('daily_plans');
  });

  it('a planning-associated todo/habit graph validates', () => {
    const rowsByEntity = {
      todos: [{ ...makeTodo({ project_id: 'proj_1', goal_id: 'goal_1', completed_at: ISO }) }],
      habits: [{ ...makeHabit({ project_id: 'proj_1', goal_id: 'goal_1' }) }],
      projects: [
        {
          id: 'proj_1',
          name: 'Ship',
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
      ],
      goals: [
        {
          id: 'goal_1',
          project_id: 'proj_1',
          title: 'Learn',
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
      ],
    } as Record<string, Record<string, unknown>[]>;
    const errors = validateBackupGraph(rowsByEntity);
    expect(errors).toEqual([]);
  });
});

describe('Portable V2 round-trip after Habit contract correction', () => {
  it('exports and re-imports a habit without completed_at', () => {
    const file = buildPortableBackupFile({
      exportedAt: ISO,
      appVersion: '1.0.0',
      platform: 'web',
      ownerFingerprint: null,
      rowsByEntity: { habits: [makeHabit()] },
      settings: {
        calorieGoal: { calories: 2200, protein: 140, carbs: 240, fats: 70 },
        pomodoroSettings: {
          focusMinutes: 25,
          shortBreakMinutes: 5,
          longBreakMinutes: 15,
          sessionsBeforeLongBreak: 4,
        },
        theme: { mode: 'dark', slots: { primary: '#0f766e' } },
      },
    });
    const result = validatePortableBackupFile(JSON.parse(JSON.stringify(file)));
    expect(result.ok).toBe(true);
  });
});

describe('Supabase production schema convergence contract', () => {
  it('validate-supabase-schema.mjs passes on the repository migration set', () => {
    const output = execSync('node scripts/validate-supabase-schema.mjs', {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    expect(output).toMatch(/Supabase schema contract PASS/);
  });
});
