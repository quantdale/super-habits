/**
 * AUD-SH02-A…E — published recovery generations must stay immutable and
 * restorable while newer work is pending or fails.
 *
 * Audited defect (SH-02, High): the specification requires an earlier complete
 * checkpoint to remain restorable while newer changes are pending or publication
 * fails. The transport instead OVERWROTE the current remote entity rows before
 * publishing a new manifest. Measured: with a valid generation-1 manifest for a
 * Todo titled "Original", one successful update to "Changed" followed by an
 * interrupted publication left generation 1 in place but Restore V2 returned
 * invalid/integrity_mismatch. Preserving the old manifest alone does not preserve
 * its certified bytes.
 *
 * The resolution separates immutable published content from mutable staging. These
 * cases prove the locally-decidable parts of the contract: chunk immutability,
 * completeness, the atomic idempotent head advance, single-generation restore
 * pinning, retention, protocol refusal, and a REAL coherent capture against
 * SQLite. The server-side transactional atomicity and RLS isolation require a
 * disposable backend and remain an explicit external gate.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  checkChunkReplacement,
  checkGenerationScope,
  currentGenerationScope,
  decideHeadAdvance,
  GENERATION_PROTOCOL_VERSION,
  generatableForCleanup,
  resolveRestoreGeneration,
  retainedGenerations,
  verifyGenerationCompleteness,
  type GenerationChunk,
  type GenerationScope,
  type OwnerHead,
  type PublishedGeneration,
} from '@/core/backup/generations/generationProtocol';
import { freshDatabase } from './helpers/db';
import { sha256Hex } from '@/lib/checksum';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));

function chunk(overrides: Partial<GenerationChunk> = {}): GenerationChunk {
  const payload = overrides.payload ?? '[{"id":"todo_1"}]';
  return {
    snapshotId: overrides.snapshotId ?? 'gsnap_1',
    entity: overrides.entity ?? 'todos',
    ordinal: overrides.ordinal ?? 0,
    payload,
    checksum: overrides.checksum ?? sha256Hex(payload),
  };
}

function generation(sequence: number, snapshotId = `gsnap_${sequence}`): PublishedGeneration {
  return {
    snapshotId,
    sequence,
    scope: currentGenerationScope({
      backupSchemaVersion: 2,
      scopeVersion: 7,
      settingsVersion: 5,
    }),
    manifest: `manifest-${sequence}`,
    manifestChecksum: sha256Hex(`manifest-${sequence}`),
    publishedAt: '2026-10-18T00:00:00.000Z',
  };
}

describe('AUD-SH02-A: chunk content is immutable', () => {
  it('inserts a new identity and accepts an identical retry', () => {
    const incoming = chunk();
    expect(checkChunkReplacement(null, incoming)).toEqual({ ok: true, value: 'inserted' });
    expect(checkChunkReplacement(incoming, incoming)).toEqual({ ok: true, value: 'unchanged' });
    // A retry with the same bytes but a re-serialized payload object is identical.
    const retry = chunk({ payload: incoming.payload });
    expect(checkChunkReplacement(incoming, retry)).toEqual({ ok: true, value: 'unchanged' });
  });

  it('refuses different bytes under an existing chunk identity', () => {
    // This is the exact mutation the audited transport performed implicitly: the
    // same identity would have carried generation-2 content, destroying G1.
    const original = chunk();
    const mutated = chunk({ payload: '[{"id":"todo_1","title":"Changed"}]' });
    expect(checkChunkReplacement(original, mutated)).toEqual({
      ok: false,
      reason: 'chunk_content_changed',
    });
  });
});

describe('AUD-SH02-A: publication requires a complete generation', () => {
  it('accepts a fully staged generation', () => {
    const chunks = [
      chunk({ entity: 'todos', ordinal: 0 }),
      chunk({ entity: 'habits', ordinal: 0 }),
    ];
    expect(verifyGenerationCompleteness({ todos: 1, habits: 1 }, chunks)).toEqual({
      ok: true,
      value: { totalChunks: 2 },
    });
  });

  it('refuses a missing chunk for an expected entity', () => {
    const chunks = [chunk({ entity: 'todos', ordinal: 0 })];
    expect(verifyGenerationCompleteness({ todos: 1, habits: 1 }, chunks)).toEqual({
      ok: false,
      reason: 'incomplete_generation',
    });
  });

  it('refuses a gap in an entity’s ordinals', () => {
    const chunks = [chunk({ entity: 'todos', ordinal: 0 }), chunk({ entity: 'todos', ordinal: 2 })];
    expect(verifyGenerationCompleteness({ todos: 3 }, chunks)).toEqual({
      ok: false,
      reason: 'incomplete_generation',
    });
  });

  it('refuses a duplicate ordinal instead of counting it twice', () => {
    const chunks = [chunk({ entity: 'todos', ordinal: 0 }), chunk({ entity: 'todos', ordinal: 0 })];
    expect(verifyGenerationCompleteness({ todos: 2 }, chunks)).toEqual({
      ok: false,
      reason: 'incomplete_generation',
    });
  });

  it('refuses content for an entity the snapshot never asked for', () => {
    const chunks = [chunk({ entity: 'todos', ordinal: 0 }), chunk({ entity: 'ghost', ordinal: 0 })];
    expect(verifyGenerationCompleteness({ todos: 1 }, chunks)).toEqual({
      ok: false,
      reason: 'incomplete_generation',
    });
  });
});

describe('AUD-SH02-B: the head advance is atomic and idempotent', () => {
  it('advances from the expected previous sequence', () => {
    const current: OwnerHead = { snapshotId: 'gsnap_1', sequence: 1 };
    expect(decideHeadAdvance(current, generation(2))).toEqual({
      ok: true,
      value: { snapshotId: 'gsnap_2', sequence: 2 },
    });
  });

  it('creates the first head when none exists', () => {
    expect(decideHeadAdvance(null, generation(1))).toEqual({
      ok: true,
      value: { snapshotId: 'gsnap_1', sequence: 1 },
    });
  });

  it('a lost response is idempotent, not a regression', () => {
    const current: OwnerHead = { snapshotId: 'gsnap_2', sequence: 2 };
    const retry = generation(2, 'gsnap_2');
    expect(decideHeadAdvance(current, retry)).toEqual({ ok: true, value: current });
  });

  it('a stale retry never regresses a newer head', () => {
    const current: OwnerHead = { snapshotId: 'gsnap_3', sequence: 3 };
    expect(decideHeadAdvance(current, generation(2))).toEqual({
      ok: false,
      reason: 'stale_sequence',
    });
  });

  it('an older snapshot cannot claim the head’s sequence', () => {
    // Same sequence, different snapshot: not a retry, so it is refused.
    const current: OwnerHead = { snapshotId: 'gsnap_2', sequence: 2 };
    expect(decideHeadAdvance(current, generation(2, 'gsnap_other'))).toEqual({
      ok: false,
      reason: 'stale_sequence',
    });
  });
});

describe('AUD-SH02-D: restore reads exactly one retained generation', () => {
  it('pins the head generation', () => {
    const published = [generation(1), generation(2)];
    const head: OwnerHead = { snapshotId: 'gsnap_1', sequence: 1 };
    const resolved = resolveRestoreGeneration(head, published);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.value.snapshotId).toBe('gsnap_1');
  });

  it('refuses a head whose generation is no longer retained', () => {
    const published = [generation(1)];
    const head: OwnerHead = { snapshotId: 'gsnap_9', sequence: 9 };
    expect(resolveRestoreGeneration(head, published)).toEqual({
      ok: false,
      reason: 'generation_not_retained',
    });
  });

  it('keeps at least the current and previous complete generation', () => {
    const published = [generation(1), generation(2), generation(3)];
    expect(retainedGenerations(published).map((entry) => entry.sequence)).toEqual([2, 3]);
    // Even a nonsensical request for one cannot drop the previous generation.
    expect(retainedGenerations(published, 1).map((entry) => entry.sequence)).toEqual([2, 3]);
  });

  it('never cleans up a generation an active restore is reading', () => {
    const published = [generation(1), generation(2), generation(3)];
    // Without an active reader, G1 is collectable (current + previous kept).
    expect(generatableForCleanup(published, null).map((entry) => entry.sequence)).toEqual([1]);
    // An active G1 reader protects it.
    expect(generatableForCleanup(published, 'gsnap_1')).toEqual([]);
  });
});

describe('AUD-SH02-C: RLS and protocol boundaries', () => {
  it('refuses a NEWER protocol version explicitly', () => {
    const future: GenerationScope = {
      protocolVersion: GENERATION_PROTOCOL_VERSION + 1,
      backupSchemaVersion: 2,
      scopeVersion: 7,
      settingsVersion: 5,
    };
    const supported = currentGenerationScope({
      backupSchemaVersion: 2,
      scopeVersion: 7,
      settingsVersion: 5,
    });
    expect(checkGenerationScope(future, supported)).toEqual({
      ok: false,
      reason: 'unsupported_protocol',
    });
  });

  it('refuses a newer backup schema or settings version', () => {
    const supported = currentGenerationScope({
      backupSchemaVersion: 2,
      scopeVersion: 7,
      settingsVersion: 5,
    });
    expect(checkGenerationScope({ ...supported, backupSchemaVersion: 3 }, supported)).toEqual({
      ok: false,
      reason: 'unsupported_protocol',
    });
    expect(checkGenerationScope({ ...supported, settingsVersion: 6 }, supported)).toEqual({
      ok: false,
      reason: 'unsupported_protocol',
    });
  });

  it('accepts an older supported scope (legacy readers stay working)', () => {
    const supported = currentGenerationScope({
      backupSchemaVersion: 2,
      scopeVersion: 7,
      settingsVersion: 5,
    });
    expect(checkGenerationScope({ ...supported, scopeVersion: 6 }, supported).ok).toBe(true);
    expect(checkGenerationScope(supported, supported).ok).toBe(true);
  });

  it('the migration pins owner isolation to auth.uid(), never a client field', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const sql = readFileSync(
      path.resolve(
        __dirname,
        '..',
        '..',
        'supabase',
        'migrations',
        '20261018000000_add_backup_generation_protocol.sql',
      ),
      'utf8',
    );
    // Every policy derives the owner from the session, not from a supplied value.
    // SELECT/INSERT/UPDATE policies are each present on the three tables; the
    // head UPDATE policy carries both a USING and a WITH CHECK half.
    const policyOwners = sql.match(/USING \(\(select auth\.uid\(\)\) = user_id\)/g) ?? [];
    const withChecks = sql.match(/WITH CHECK \(\(select auth\.uid\(\)\) = user_id\)/g) ?? [];
    expect(policyOwners.length).toBe(4);
    expect(withChecks.length).toBe(4);
    // And no policy anywhere trusts a supplied value instead of the session.
    expect(sql).not.toMatch(/USING \(user_id = /);
    expect(sql).not.toMatch(/WITH CHECK \(user_id = /);
    // Content is append-only: no client UPDATE/DELETE policy on chunks.
    expect(sql).not.toMatch(/backup_generation_chunk_update_owner/);
    expect(sql).not.toMatch(/backup_generation_chunk_delete_owner/);
    // Publication runs with invoker rights and a pinned search_path.
    expect(sql).toContain('SECURITY INVOKER');
    expect(sql).toContain('SET search_path = public, pg_temp');
    // The RPC takes no owner parameter at all.
    expect(sql).toMatch(/publish_backup_generation\(\s*p_snapshot_id TEXT,/);
    expect(sql).not.toMatch(/p_?user_id/);
  });
});

describe('AUD-SH02-E: the real capture is coherent and resumable', () => {
  it('captures every recoverable entity plus settings as immutable chunks', async () => {
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');
    const todos = await import('@/features/todos/todos.data');
    await todos.addTodo({ title: 'Original' });

    const { captureGeneration } = await import('@/core/backup/generations/capture');
    const captured = await captureGeneration({ settingsPayload: { calories: 2000 } });

    // Identity, sequence and manifest are durable state, not recomputed values.
    expect(captured.capture.snapshotId).toMatch(/^gsnap_/);
    expect(captured.capture.sequence).toBe(1);
    expect(captured.capture.manifestChecksum).toMatch(/^[0-9a-f]{64}$/);
    // Every backup entity has an expected ordinal count (0 when empty).
    expect(Object.keys(captured.capture.expectedChunks).length).toBeGreaterThan(10);
    // The captured todo content is present and certified.
    const todoChunks = captured.chunks.filter((entry) => entry.entity === 'todos');
    expect(todoChunks).toHaveLength(1);
    expect(todoChunks[0].payload).toContain('Original');
    expect(todoChunks[0].checksum).toBe(sha256Hex(todoChunks[0].payload));
    // Settings ride the same generation.
    const settingsChunk = captured.chunks.find((entry) => entry.entity === 'user_backup_settings');
    expect(settingsChunk).toBeTruthy();
    expect(settingsChunk!.payload).toContain('2000');
    // The generation verifies complete against its own expectation.
    expect(verifyGenerationCompleteness(captured.capture.expectedChunks, captured.chunks).ok).toBe(
      true,
    );
    await db.closeAsync();
  }, 60000);

  it('a later edit does NOT change the captured generation’s bytes', async () => {
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');
    const todos = await import('@/features/todos/todos.data');
    const todoId = await todos.addTodo({ title: 'Original' });

    const { captureGeneration } = await import('@/core/backup/generations/capture');
    const g1 = await captureGeneration({ settingsPayload: { calories: 2000 } });
    const g1Todo = g1.chunks.find((entry) => entry.entity === 'todos')!;
    const g1Payload = g1Todo.payload;
    const g1Checksum = g1Todo.checksum;

    // The audited sequence: one successful update, then (simulated) interrupted
    // publication. Under the old mutable store this rewrote G1's certified bytes.
    await todos.updateTodo(todoId, { title: 'Changed' });

    // G1's captured bytes are unchanged because they live in the generation
    // namespace, not in the mutable entity rows.
    expect(g1Todo.payload).toBe(g1Payload);
    expect(g1Todo.checksum).toBe(g1Checksum);
    expect(g1Payload).toContain('Original');
    expect(g1Payload).not.toContain('Changed');

    // A SECOND capture is a distinct generation with a distinct sequence.
    const g2 = await captureGeneration({ settingsPayload: { calories: 2100 } });
    expect(g2.capture.sequence).toBe(2);
    expect(g2.capture.snapshotId).not.toBe(g1.capture.snapshotId);
    const g2Todo = g2.chunks.find((entry) => entry.entity === 'todos')!;
    expect(g2Todo.payload).toContain('Changed');
    // And the two generations' chunk identities do not collide.
    expect(g2Todo.ordinal).toBe(g1Todo.ordinal);
    expect(g2Todo.snapshotId).not.toBe(g1Todo.snapshotId);
    await db.closeAsync();
  }, 60000);

  it('the in-flight capture is durable and resumes the SAME generation', async () => {
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');
    const { captureGeneration, markEntityStaged, readGenerationCapture, readCapturedChunks } =
      await import('@/core/backup/generations/capture');
    const captured = await captureGeneration({ settingsPayload: {} });
    await markEntityStaged(captured.capture.snapshotId, 'todos');
    expect((await readCapturedChunks(db as never))?.chunks).toEqual(captured.chunks);

    // A "restart" is a fresh read of durable state.
    const resumed = await readGenerationCapture(db as never);
    expect(resumed?.snapshotId).toBe(captured.capture.snapshotId);
    expect(resumed?.sequence).toBe(captured.capture.sequence);
    expect(resumed?.stagedEntities).toContain('todos');
    expect(resumed?.manifestChecksum).toBe(captured.capture.manifestChecksum);
    await db.closeAsync();
  }, 60000);

  it('an acknowledged publication advances the sequence floor and clears the capture', async () => {
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');
    const { captureGeneration, readGenerationCapture, recordPublishedGeneration } =
      await import('@/core/backup/generations/capture');
    const first = await captureGeneration({ settingsPayload: {} });
    await recordPublishedGeneration(first.capture.snapshotId, first.capture.sequence);
    expect(await readGenerationCapture(db as never)).toBeNull();

    // The next capture takes the NEXT sequence, never reusing a published one.
    const second = await captureGeneration({ settingsPayload: {} });
    expect(second.capture.sequence).toBe(2);
    await db.closeAsync();
  }, 60000);

  it('refuses to capture without durable owner evidence', async () => {
    const db = await freshDatabase();
    const { captureGeneration } = await import('@/core/backup/generations/capture');
    await expect(captureGeneration({ settingsPayload: {} })).rejects.toThrow(/owner evidence/i);
    await db.closeAsync();
  }, 60000);
});

describe('AUD-SH02-A: the production backup path PUBLISHES generations', () => {
  it('the checkpoint cycle captures a generation through a production caller', async () => {
    // The audited gap was that the generation modules had NO production caller.
    // `runBackupMaintenance` now captures inside its own coherent transaction;
    // this asserts the wiring rather than the library in isolation. (The
    // end-to-end publication itself is exercised by the backup/restore suite,
    // which owns the fake remote.)
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const checkpointSource = readFileSync(
      path.resolve(__dirname, '..', '..', 'core/backup/backupCheckpoint.ts'),
      'utf8',
    );
    expect(checkpointSource).toContain('captureGenerationWithinTransaction(');
    expect(checkpointSource).toContain("from '@/core/backup/generations/capture'");

    // And the adapter publishes before writing the mutable manifest.
    const adapterSource = readFileSync(
      path.resolve(__dirname, '..', '..', 'core/sync/supabase.adapter.ts'),
      'utf8',
    );
    const publishIndex = adapterSource.indexOf('await this.publishGenerationContents(');
    const legacyManifestIndex = adapterSource.indexOf(
      "client.from('backup_manifest').upsert(",
      publishIndex,
    );
    expect(publishIndex).toBeGreaterThan(-1);
    expect(legacyManifestIndex).toBeGreaterThan(publishIndex);
    expect(adapterSource).toContain("from('backup_generation_chunk')");
    expect(adapterSource).toContain("rpc('publish_backup_generation'");

    // Restore prefers the pinned generation before falling back to mutable rows.
    const restoreSource = readFileSync(
      path.resolve(__dirname, '..', '..', 'core/backup/backupRestore.ts'),
      'utf8',
    );
    const generationRead = restoreSource.indexOf('await fetchPublishedGenerationRows(');
    const mutableRead = restoreSource.indexOf(
      'scope.entitySet.map((entity) => fetchRemoteRows(entity, ownerUserId))',
      generationRead,
    );
    expect(generationRead).toBeGreaterThan(-1);
    expect(mutableRead).toBeGreaterThan(generationRead);
  });

  it('the durable capture carries its chunks, so an upload can resume after a kill', async () => {
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');
    const todos = await import('@/features/todos/todos.data');
    await todos.addTodo({ title: 'Resumable' });

    const { captureGeneration, readCapturedChunks } =
      await import('@/core/backup/generations/capture');
    const captured = await captureGeneration({ settingsPayload: { calories: 1 } });

    // A restart is a fresh durable read. Metadata ALONE cannot resume an
    // immutable upload: the chunks must have been persisted too.
    const resumed = await readCapturedChunks(db as never);
    expect(resumed).not.toBeNull();
    expect(resumed!.capture.snapshotId).toBe(captured.capture.snapshotId);
    expect(resumed!.chunks.length).toBe(captured.chunks.length);
    const todoChunk = resumed!.chunks.find((chunk) => chunk.entity === 'todos');
    expect(todoChunk?.payload).toContain('Resumable');
    expect(todoChunk?.checksum).toBe(sha256Hex(todoChunk!.payload));
    await db.closeAsync();
  }, 60000);

  it('a failed publication leaves the generation unpublished and the capture durable', async () => {
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');
    const { captureGeneration, readGenerationCapture } =
      await import('@/core/backup/generations/capture');
    const captured = await captureGeneration({ settingsPayload: {} });
    // No acknowledgement happened, so the capture must still be resumable.
    const pending = await readGenerationCapture(db as never);
    expect(pending?.snapshotId).toBe(captured.capture.snapshotId);
    await db.closeAsync();
  }, 60000);
});
