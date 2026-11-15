import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTestDatabase, freshDatabase, type TestDatabase } from './helpers/db';

async function withFile(task: (filename: string) => Promise<void>) {
  const directory = mkdtempSync(path.join(tmpdir(), 'superhabits-schema-integrity-'));
  try {
    await task(path.join(directory, 'fixture.db'));
  } finally {
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

async function seed(filename: string, version: string, populated: 'todo' | 'plan' | false) {
  const db = await freshDatabase(filename);
  if (populated === 'todo') {
    await db.runAsync(`INSERT INTO todos (id, title, created_at, updated_at, sort_order)
      VALUES ('todo_keep', 'Preserve my ordering', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 987)`);
  } else if (populated === 'plan') {
    await db.runAsync(`INSERT INTO daily_plans (id, date_key, intention, created_at, updated_at)
      VALUES ('dplan_keep', '2026-11-14', 'Only planning data', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`);
  }
  await db.runAsync("UPDATE app_meta SET value = ? WHERE key = 'db_schema_version'", [version]);
  await db.closeAsync();
}

async function expectRefusal(filename: string) {
  let unexpected: TestDatabase | undefined;
  try {
    await expect(
      freshDatabase(filename).then((db) => {
        unexpected = db;
        return db;
      }),
    ).rejects.toThrow(/Refusing to migrate.*db_schema_version/);
  } finally {
    await unexpected?.closeAsync();
  }
}

describe('stored schema version integrity', () => {
  it.each(['25suffix', '5junk', '-1', '5.9', '2e1', '0x19', '9007199254740993', '', 'NaN'])(
    'refuses malformed populated version %j without rewriting metadata or rows',
    async (version) =>
      withFile(async (filename) => {
        await seed(filename, version, 'todo');
        await expectRefusal(filename);
        const inspector = createTestDatabase(filename);
        try {
          expect(
            await inspector.getFirstAsync(
              "SELECT value FROM app_meta WHERE key = 'db_schema_version'",
            ),
          ).toEqual({ value: version });
          expect(await inspector.getFirstAsync('SELECT title, sort_order FROM todos')).toEqual({
            title: 'Preserve my ordering',
            sort_order: 987,
          });
        } finally {
          await inspector.closeAsync();
        }
      }),
  );

  it('does not mistake planning-only user data for an empty device', async () =>
    withFile(async (filename) => {
      await seed(filename, 'NaN', 'plan');
      await expectRefusal(filename);
      const inspector = createTestDatabase(filename);
      try {
        expect(
          await inspector.getFirstAsync(
            "SELECT value FROM app_meta WHERE key = 'db_schema_version'",
          ),
        ).toEqual({ value: 'NaN' });
        expect(await inspector.getFirstAsync('SELECT intention FROM daily_plans')).toEqual({
          intention: 'Only planning data',
        });
      } finally {
        await inspector.closeAsync();
      }
    }));

  it.each(['NaN', '-1', '5junk'])(
    'retains empty-device recovery for invalid version %j',
    async (version) =>
      withFile(async (filename) => {
        await seed(filename, version, false);
        const db = await freshDatabase(filename);
        try {
          expect(
            await db.getFirstAsync("SELECT value FROM app_meta WHERE key = 'db_schema_version'"),
          ).toEqual({ value: '27' });
          expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM todos')).toEqual({
            count: 0,
          });
        } finally {
          await db.closeAsync();
        }
      }),
  );

  it('continues to upgrade a canonical version with preserved user data', async () =>
    withFile(async (filename) => {
      await seed(filename, '24', 'todo');
      const db = await freshDatabase(filename);
      try {
        expect(
          await db.getFirstAsync("SELECT value FROM app_meta WHERE key = 'db_schema_version'"),
        ).toEqual({ value: '27' });
        expect(await db.getFirstAsync('SELECT sort_order FROM todos')).toEqual({ sort_order: 987 });
      } finally {
        await db.closeAsync();
      }
    }));
});
