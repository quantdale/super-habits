import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateBackupRow } from '@/core/backup/backupValidators';
import { freshDatabase, type TestDatabase } from './helpers/db';

const INVALID_IDS = [
  { label: 'empty', id: '' },
  { label: 'over-limit', id: 'x'.repeat(1001) },
];
const ISO = '2026-11-15T00:00:00.000Z';
const series = {
  title: 'Recurring task',
  notes: null,
  priority: 'normal' as const,
  created_at: ISO,
  updated_at: ISO,
  deleted_at: null,
};

describe('recurring series identities match the publication boundary', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    db = await freshDatabase();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await db.closeAsync();
  });

  it.each(INVALID_IDS)('rejects a $label recovery identity', ({ id }) => {
    expect(validateBackupRow('todo_recurrence_series', { ...series, id }).ok).toBe(false);
  });

  it.each(INVALID_IDS)(
    'rejects a $label spawn identity before writing rows or intents',
    async ({ id: recurrenceId }) => {
      const { createRecurringInstance } = await import('@/features/todos/todos.data');
      await expect(
        createRecurringInstance({
          title: series.title,
          notes: null,
          priority: 'normal',
          recurrenceId,
          dueDate: '2026-11-15',
        }),
      ).rejects.toThrow(/series identity/i);
      expect(await db.getAllAsync('SELECT * FROM todos')).toEqual([]);
      expect(await db.getAllAsync('SELECT * FROM todo_recurrence_series')).toEqual([]);
      expect(await db.getAllAsync('SELECT * FROM sync_outbox')).toEqual([]);
    },
  );

  it('keeps non-canonical historical text identities recoverable', async () => {
    const recurrenceId = 'historical-series/name';
    expect(validateBackupRow('todo_recurrence_series', { ...series, id: recurrenceId }).ok).toBe(
      true,
    );
    const { createRecurringInstance } = await import('@/features/todos/todos.data');
    await createRecurringInstance({
      title: series.title,
      notes: null,
      priority: 'normal',
      recurrenceId,
      dueDate: '2026-11-15',
    });
    expect(await db.getFirstAsync('SELECT id FROM todo_recurrence_series')).toEqual({
      id: recurrenceId,
    });
    expect(await db.getFirstAsync('SELECT recurrence_id FROM todos')).toEqual({
      recurrence_id: recurrenceId,
    });
    expect(await db.getAllAsync('SELECT entity FROM sync_outbox ORDER BY entity')).toEqual([
      { entity: 'todo_recurrence_series' },
      { entity: 'todos' },
    ]);
  });
});
