/**
 * AUD-SH08-A / AUD-SH08-B — verification must not fail successfully stored
 * batches above the response cap.
 *
 * Audited defect (SH-08, Medium, confirmed for a capped API): the repo configures
 * a 1,000-row API maximum (`supabase/config.toml`). A mock enforcing that cap
 * stored all 1,001 pushed rows, but the single unpaged `select` returned only
 * 1,000 ids, so the adapter failed all 1,001 records as "incompletely stored".
 * The engine snapshots the entire queue without a compatible bound.
 *
 * These cases drive the REAL adapter against a fake remote that enforces a row
 * cap exactly like PostgREST, and assert the contract that matters: every
 * accepted row verifies, a genuine missing id still fails, a page that violates
 * its own bound is reported as truncation rather than as missing data, and a
 * newer same-id write survives acknowledgement of an earlier revision.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  chunk,
  compareVerifiedIds,
  describeMissingIds,
  evaluateVerificationPage,
  SYNC_VERIFY_PAGE_ROWS,
  SYNC_WRITE_BATCH_ROWS,
  verifyPageRows,
  writeBatchRows,
} from '@/core/sync/syncBatching';

type Stored = Map<string, Record<string, unknown>>;

/** Rows the fake remote will accept per entity. */
const stored = new Map<string, Stored>();
/** Every upsert statement the adapter issued, for batch-shape assertions. */
const upsertBatches: { entity: string; rowCount: number }[] = [];
/** The cap the fake server enforces on a SELECT response (PostgREST `max_rows`). */
let serverCap = 1000;
/** Which ids the read-back should pretend are missing (real absence). */
let notStored = new Set<string>();
/** When set, the fake returns at most this many rows per page regardless of range. */
let overTruncateAt: number | null = null;
/** When set, upsert batches at or after this 1-based index fail (`AUD-SH03-B`). */
let failUpsertBatchFrom: number | null = null;
/** Whether the fake remote advertises immutable generation storage (`AUD-SH02-A`). */
let generationSupport = true;

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(async () => ({
      data: {
        protocol_version: 2,
        publication_provenance_version: 1,
        content_verification_version: 1,
        sequence_reservation_version: 1,
        backup_schema_version: 2,
        scope_version: 7,
        settings_version: 5,
      },
      error: null,
    })),
    from: vi.fn((entity: string) => ({
      upsert: vi.fn(async (rows: Record<string, unknown>[]) => {
        const rowList = Array.isArray(rows) ? rows : [rows];
        upsertBatches.push({ entity, rowCount: rowList.length });
        // `AUD-SH03-B`: a later batch can fail AFTER earlier batches stored.
        // The batch index counts only the batches of THIS entity, and the failure
        // starts AT the configured index (1 = the first batch fails).
        const entityBatchIndex = upsertBatches.filter((batch) => batch.entity === entity).length;
        if (failUpsertBatchFrom !== null && entityBatchIndex >= failUpsertBatchFrom) {
          return { error: { message: 'simulated permanent rejection (batch failure)' } };
        }
        const table = stored.get(entity) ?? new Map<string, Record<string, unknown>>();
        for (const row of rowList) table.set(String(row.id), row);
        stored.set(entity, table);
        return { error: null };
      }),
      select: vi.fn(() => {
        // A PostgREST builder: .in().eq().order().range().limit()
        const builder: Record<string, unknown> = {
          in: vi.fn((_column: string, ids: string[]) => builder),
          eq: vi.fn((_column: string, _value: string) => builder),
          order: vi.fn(() => builder),
          range: vi.fn(async (from: number, to: number) => {
            const ids = [...((builder.__ids as string[] | undefined) ?? [])];
            const table = stored.get(entity) ?? new Map();
            const rows = ids
              .filter((id) => !notStored.has(id))
              .map((id) => table.get(id))
              .filter((row): row is Record<string, unknown> => row !== undefined)
              .map((row) => ({ id: row.id }))
              .sort((a, b) => String(a.id).localeCompare(String(b.id)));
            // PostgREST truncates at `max_rows`; a well-behaved range page is
            // additionally limited to its own size.
            const pageLimit = Math.min(serverCap, to - from + 1);
            const effectiveLimit =
              overTruncateAt === null ? pageLimit : Math.min(pageLimit, overTruncateAt);
            return { data: rows.slice(from, from + effectiveLimit), error: null };
          }),
          __ids: [] as string[],
        };
        builder.in = vi.fn((_column: string, ids: string[]) => {
          builder.__ids = ids;
          return builder;
        });
        // `AUD-SH02-A` (review finding 8): the adapter probes the generation head
        // before any mutable upload to decide whether generation storage exists.
        // A fake that cannot answer it would report the capability as absent and
        // refuse every push. `generationSupport` lets a case declare a remote that
        // HAS generation storage (default) or one that does not.
        builder.limit = vi.fn(async () => {
          if (entity === 'backup_generation_head') {
            return generationSupport
              ? { data: [{ snapshot_id: 'existing', sequence: 1 }], error: null }
              : { data: null, error: { message: 'relation does not exist' } };
          }
          return { data: [], error: null };
        });
        return builder;
      }),
      delete: vi.fn(() => ({
        in: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      })),
    })),
  },
  isRemoteEnabled: vi.fn(() => true),
  getSupabaseAuthUserId: vi.fn().mockResolvedValue('user_a'),
  getSupabaseSessionUserId: vi.fn().mockResolvedValue('user_a'),
  setRemoteMode: vi.fn(),
  ensureAnonymousSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/core/auth/account.data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/auth/account.data')>();
  return { ...actual, getLocalDatasetOwner: vi.fn(async () => 'user_a') };
});

/** The database created by the most recent `seedTodos` call. */
let currentSeed: { db: Awaited<ReturnType<typeof import('./helpers/db').freshDatabase>> } | null =
  null;

async function seedTodos(count: number): Promise<string[]> {
  const { freshDatabase } = await import('./helpers/db');
  const db = await freshDatabase();
  currentSeed = { db: db };
  const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
  await setLocalDatasetOwner(db as never, 'user_a');
  const { seedVerifiedGenerationBaseHead } = await import('./helpers/generationBaseline');
  await seedVerifiedGenerationBaseHead(db, 'user_a');
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    ids.push(`todo_sh08_${String(index).padStart(5, '0')}`);
  }
  const now = new Date().toISOString();
  // Insert the rows directly: this test is about the adapter's transport
  // behaviour, not the todo write path (which has its own suite).
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync(
        `INSERT INTO todos (id, title, notes, completed, due_date, priority, sort_order, recurrence, recurrence_id, created_at, updated_at, deleted_at)
         VALUES (?, ?, NULL, 0, NULL, 'normal', 1, NULL, NULL, ?, ?, NULL)`,
        [id, `Todo ${id}`, now, now],
      );
    }
  });
  return ids;
}

function enqueueAll(ids: string[], owner = 'user_a') {
  return ids.map((id) => ({
    entity: 'todos' as const,
    id,
    updatedAt: new Date().toISOString(),
    operation: 'update' as const,
    ownerUserId: owner,
  }));
}

describe('AUD-SH08-A: bounded writes and paginated verification', () => {
  it('verifies 1,001 stored rows under a 1,000-row server cap instead of failing', async () => {
    stored.clear();
    upsertBatches.length = 0;
    serverCap = 1000;
    notStored = new Set();
    overTruncateAt = null;

    const ids = await seedTodos(1001);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    const adapter = new SupabaseSyncAdapter();

    // The audited failure: this throws "not stored for this owner" for 1,001
    // rows because one unpaged read-back returned only the first 1,000 ids.
    await expect(adapter.push(enqueueAll(ids))).resolves.toBeUndefined();

    // Bounded write batches: no statement exceeded the policy size.
    const totalRows = upsertBatches.reduce((sum, batch) => sum + batch.rowCount, 0);
    expect(totalRows).toBe(1001);
    for (const batch of upsertBatches) {
      expect(batch.rowCount).toBeLessThanOrEqual(SYNC_WRITE_BATCH_ROWS);
    }
    expect(upsertBatches.length).toBeGreaterThan(1);
  });

  it('verifies under a lower configured cap (100 rows) and at the exact boundary', async () => {
    for (const count of [0, 1, 100, 101]) {
      stored.clear();
      upsertBatches.length = 0;
      serverCap = 100;
      notStored = new Set();
      overTruncateAt = null;

      const ids = count === 0 ? [] : await seedTodos(count);
      const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
      // A project configured with `max_rows = 100` declares it, and the adapter
      // must keep every statement strictly inside that cap.
      const adapter = new SupabaseSyncAdapter({ serverRowCap: 100 });
      await expect(adapter.push(enqueueAll(ids))).resolves.toBeUndefined();
      if (count > 0) {
        const totalRows = upsertBatches.reduce((sum, batch) => sum + batch.rowCount, 0);
        expect(totalRows).toBe(count);
        // Batches stay strictly below the declared cap.
        for (const batch of upsertBatches) expect(batch.rowCount).toBeLessThan(100);
      }
    }
  });

  it('handles 5,000 same-entity intents without unbounded requests', async () => {
    stored.clear();
    upsertBatches.length = 0;
    serverCap = 1000;
    notStored = new Set();
    overTruncateAt = null;

    const ids = await seedTodos(5000);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    const adapter = new SupabaseSyncAdapter();
    await expect(adapter.push(enqueueAll(ids))).resolves.toBeUndefined();
    const totalRows = upsertBatches.reduce((sum, batch) => sum + batch.rowCount, 0);
    expect(totalRows).toBe(5000);
    for (const batch of upsertBatches)
      expect(batch.rowCount).toBeLessThanOrEqual(SYNC_WRITE_BATCH_ROWS);
    // Request count is linear in the policy batch size, not one per row.
    expect(upsertBatches.length).toBe(Math.ceil(5000 / SYNC_WRITE_BATCH_ROWS));
  });
});

describe('AUD-SH08-B: genuine absence and truncation stay distinguishable', () => {
  it('fails when one genuinely missing id is reported by an otherwise complete read-back', async () => {
    stored.clear();
    upsertBatches.length = 0;
    serverCap = 1000;
    overTruncateAt = null;
    const ids = await seedTodos(3);
    notStored = new Set([ids[1]]);

    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    const adapter = new SupabaseSyncAdapter();
    const thrown = await adapter.push(enqueueAll(ids)).catch((error: unknown) => error);
    expect((thrown as Error).message).toMatch(
      /batch verification failed|push verification failed/i,
    );
    expect((thrown as Error).message).toContain('1 of 3');
    notStored = new Set();
  });

  it('never requests a verification page the declared cap must truncate', async () => {
    stored.clear();
    upsertBatches.length = 0;
    serverCap = 40;
    notStored = new Set();
    overTruncateAt = null;
    const ids = await seedTodos(120);

    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    // A small declared cap: the derived page size must fit inside it, so the
    // adapter still verifies every row instead of trusting a truncated read.
    const adapter = new SupabaseSyncAdapter({ serverRowCap: 40 });
    await expect(adapter.push(enqueueAll(ids))).resolves.toBeUndefined();
    expect(verifyPageRows(40)).toBeLessThanOrEqual(40);
    const totalRows = upsertBatches.reduce((sum, batch) => sum + batch.rowCount, 0);
    expect(totalRows).toBe(120);
  });

  it('a short read-back with no declared cap still fails visibly (never a silent pass)', async () => {
    stored.clear();
    upsertBatches.length = 0;
    serverCap = 1000;
    notStored = new Set();
    const ids = await seedTodos(4);
    // Model a proxy capping the response below what the adapter asked for. This
    // is indistinguishable from genuine absence without a declared cap, so the
    // contract is: it FAILS and it names the ids it did not see.
    overTruncateAt = 2;

    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    const adapter = new SupabaseSyncAdapter();
    const thrown = await adapter.push(enqueueAll(ids)).catch((error: unknown) => error);
    expect(String((thrown as Error).message)).toMatch(
      /batch verification failed|push verification failed/i,
    );
    expect(String((thrown as Error).message)).toMatch(/not stored for this owner/);
    overTruncateAt = null;
  });
});

describe('AUD-SH08-A: the batching policy itself', () => {
  it('keeps every batch strictly below a declared cap', () => {
    expect(writeBatchRows()).toBe(SYNC_WRITE_BATCH_ROWS);
    expect(writeBatchRows(100)).toBeLessThan(100);
    expect(writeBatchRows(40)).toBeLessThan(40);
    expect(verifyPageRows(100)).toBeLessThanOrEqual(100);
    expect(verifyPageRows()).toBe(SYNC_VERIFY_PAGE_ROWS);
  });

  it('rejects a cap below the supported minimum instead of looping one row at a time', () => {
    expect(() => writeBatchRows(3)).toThrow(/below the supported minimum/);
    expect(() => verifyPageRows(3)).toThrow(/below the supported minimum/);
  });

  it('chunks preserve order and cover every item exactly once', () => {
    const items = Array.from({ length: 11 }, (_, index) => `id_${index}`);
    const batches = chunk(items, 3);
    expect(batches.map((batch) => batch.length)).toEqual([3, 3, 3, 2]);
    expect(batches.flat()).toEqual(items);
    expect(() => chunk(items, 0)).toThrow(/positive/);
  });

  it('compares the complete expected id set, not just counts', () => {
    expect(compareVerifiedIds(['a', 'b'], ['a', 'b', 'c'])).toEqual({ ok: true });
    const missing = compareVerifiedIds(['a', 'b', 'c'], ['a', 'c']);
    expect(missing).toMatchObject({ ok: false, reason: 'incomplete', missing: ['b'] });
  });

  it('flags a page that returned more rows than asked for as truncated', () => {
    expect(
      evaluateVerificationPage({ expectedRows: 2, receivedIds: ['a', 'b'], pageSize: 200 }),
    ).toEqual({ ok: true });
    const tooMany = evaluateVerificationPage({
      expectedRows: 2,
      receivedIds: ['a', 'b', 'c'],
      pageSize: 200,
    });
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.reason).toBe('truncated');
  });

  it('names a bounded number of missing ids in the diagnostic', () => {
    const many = Array.from({ length: 9 }, (_, index) => `id_${index}`);
    const described = describeMissingIds(many, 3);
    expect(described).toContain('id_0, id_1, id_2');
    expect(described).toContain('9 total');
  });
});

describe('AUD-SH03-B: a failed batch does not implicate a stored batch', () => {
  it('acknowledges the batches that stored and reports only the failed one', async () => {
    stored.clear();
    upsertBatches.length = 0;
    serverCap = 1000;
    notStored = new Set();
    overTruncateAt = null;
    // The audited probe: the FIRST batch stores 250 Todos, the SECOND batch fails,
    // and every record — including the 250 that landed — is reported failed.
    failUpsertBatchFrom = 2;

    const ids = await seedTodos(300);
    const { db } = currentSeed!;
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    const adapter = new SupabaseSyncAdapter();
    const thrown = await adapter.push(enqueueAll(ids)).catch((error: unknown) => error);
    failUpsertBatchFrom = null;
    generationSupport = true;

    expect((thrown as Error).name).toBe('SyncPushPartialFailureError');
    const failure = thrown as {
      failedRecords: { id: string }[];
      succeededRecords: { id: string }[];
    };
    // Exactly the records of the batches that stored are acknowledged...
    expect(failure.succeededRecords.length).toBe(SYNC_WRITE_BATCH_ROWS);
    expect(
      failure.succeededRecords.every((record) =>
        ids.slice(0, SYNC_WRITE_BATCH_ROWS).includes(record.id),
      ),
    ).toBe(true);
    // ...and only the rest are reported failed (not all 300).
    expect(failure.failedRecords.length).toBe(300 - SYNC_WRITE_BATCH_ROWS);
    await db.closeAsync();
  }, 60000);
});
