import { describe, expect, it, vi } from 'vitest';
import { buildFixtureSql, type FixtureSize } from '../../e2e/helpers/seed';
import { BACKUP_ENTITIES, type BackupEntity } from '@/core/backup/backup.types';
import { validateBackupGraph, validateBackupRow } from '@/core/backup/backupValidators';
import { freshDatabase } from './helpers/db';

vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

describe('browser fixture SQL matches the recoverable app contract', () => {
  it.each(['2026-11-15', '2026-11-16'])(
    'SMALL stays inert when the real rollover runs on %s',
    async (todayKey) => {
      const db = await freshDatabase();
      try {
        await db.execAsync(buildFixtureSql('2026-11-15', 'SMALL'));
        const before = await db.getAllAsync('SELECT * FROM todos ORDER BY id');
        expect(before).toHaveLength(2);
        expect(before.filter((row) => row.deleted_at === null)).toHaveLength(1);
        const todos = await import('@/features/todos/todos.data');
        const { findMissingRecurrenceIds } = await import('@/features/todos/todos.domain');
        const missing = findMissingRecurrenceIds(
          await todos.listAllActiveTodosForRecurrence(),
          todayKey,
        );
        const templates = await todos.getRecurringTodosByIds(missing);
        await todos.createRecurringInstances(
          templates.map((template) => ({
            title: template.title,
            notes: template.notes,
            priority: template.priority,
            recurrenceId: template.recurrence_id!,
            dueDate: todayKey,
          })),
        );
        expect(await db.getAllAsync('SELECT * FROM todos ORDER BY id')).toEqual(before);
        expect(await db.getAllAsync('SELECT * FROM sync_outbox')).toEqual([]);
      } finally {
        await db.closeAsync();
      }
    },
  );

  it.each<FixtureSize>(['TYPICAL', 'HEAVY'])(
    '%s retains active recurrence coverage',
    async (size) => {
      const db = await freshDatabase();
      try {
        await db.execAsync(buildFixtureSql('2026-11-15', size));
        const series = await db.getFirstAsync<{ n: number }>(
          'SELECT COUNT(*) AS n FROM todo_recurrence_series WHERE deleted_at IS NULL',
        );
        expect(series?.n).toBeGreaterThan(0);
        const active = await db.getAllAsync(
          "SELECT id FROM todos WHERE recurrence='daily' AND deleted_at IS NULL",
        );
        expect(active.length).toBeGreaterThan(0);
      } finally {
        await db.closeAsync();
      }
    },
  );

  it.each([
    { size: 'TYPICAL' as const, seriesCount: 2, tombstones: 1 },
    { size: 'HEAVY' as const, seriesCount: 34, tombstones: 16 },
  ])(
    '$size rollover covers every canonical series, including deleted-only seeds',
    async ({ size, seriesCount, tombstones }) => {
      const db = await freshDatabase();
      try {
        const today = '2026-11-15';
        await db.execAsync(buildFixtureSql(today, size));
        const deletedBefore = await db.getAllAsync(
          'SELECT * FROM todos WHERE deleted_at IS NOT NULL ORDER BY id',
        );
        expect(deletedBefore).toHaveLength(tombstones);
        const seeded = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM todos');
        const todos = await import('@/features/todos/todos.data');
        const { findMissingRecurrenceIds } = await import('@/features/todos/todos.domain');
        // Repeated activation must not add another copy or another intent.
        for (let activation = 0; activation < 3; activation += 1) {
          const templates = await todos.getRecurringTodosByIds(
            findMissingRecurrenceIds(await todos.listAllActiveTodosForRecurrence(), today),
          );
          await todos.createRecurringInstances(
            templates.map((template) => ({
              title: template.title,
              notes: template.notes,
              priority: template.priority,
              recurrenceId: template.recurrence_id!,
              dueDate: today,
            })),
          );
        }
        const coverage = await db.getAllAsync<{ copies: number }>(
          `SELECT COUNT(t.id) AS copies FROM todo_recurrence_series s
         LEFT JOIN todos t ON t.recurrence_id=s.id AND t.deleted_at IS NULL
           AND t.recurrence_date_key=?
         WHERE s.deleted_at IS NULL GROUP BY s.id`,
          [today],
        );
        expect(coverage).toHaveLength(seriesCount);
        expect(coverage.every((row) => row.copies === 1)).toBe(true);
        expect(
          await db.getAllAsync('SELECT * FROM todos WHERE deleted_at IS NOT NULL ORDER BY id'),
        ).toEqual(deletedBefore);
        const total = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM todos');
        const intents = await db.getAllAsync<{ entity: string; operation: string }>(
          'SELECT entity, operation FROM sync_outbox',
        );
        expect(intents).toHaveLength(total!.n - seeded!.n);
        expect(intents.every((row) => row.entity === 'todos' && row.operation === 'create')).toBe(
          true,
        );
      } finally {
        await db.closeAsync();
      }
    },
  );

  it.each<FixtureSize>(['SMALL', 'TYPICAL', 'HEAVY'])(
    '%s rows are accepted by real recovery validators',
    async (size) => {
      const db = await freshDatabase();
      try {
        await db.execAsync(buildFixtureSql('2026-11-15', size));
        const errors: string[] = [];
        for (const entity of BACKUP_ENTITIES)
          for (const row of await db.getAllAsync<Record<string, unknown>>(
            `SELECT * FROM ${entity}`,
          )) {
            const validation = validateBackupRow(entity, row);
            if (!validation.ok) errors.push(`${entity}: ${validation.errors.join('; ')}`);
          }
        expect(errors.slice(0, 10)).toEqual([]);
      } finally {
        await db.closeAsync();
      }
    },
  );

  it.each<FixtureSize>(['SMALL', 'TYPICAL', 'HEAVY'])(
    '%s supplies every required parent, including recurring-series content',
    async (size) => {
      const db = await freshDatabase();
      try {
        await db.execAsync(buildFixtureSql('2026-11-15', size));
        const rows: Partial<Record<BackupEntity, Record<string, unknown>[]>> = {};
        for (const entity of BACKUP_ENTITIES)
          rows[entity] = await db.getAllAsync(`SELECT * FROM ${entity}`);
        expect(validateBackupGraph(rows).slice(0, 10)).toEqual([]);
        expect(
          await db.getAllAsync(
            "SELECT id FROM todos WHERE recurrence='daily' AND recurrence_date_key IS NOT due_date",
          ),
        ).toEqual([]);
      } finally {
        await db.closeAsync();
      }
    },
  );
});
