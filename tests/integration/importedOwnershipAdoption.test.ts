/**
 * AUD-SH01-A / AUD-SH01-B / AUD-SH01-C — imported data must never be adopted by
 * the wrong account.
 *
 * Audited defect (SH-01, High): after an owner-A portable import onto a pristine
 * device holding a temporary provisional B binding, the dataset keeps A's source
 * fingerprint and B's session may remain. A local edit then creates one unowned
 * outbox row, which moved `decideAccountState` into the pending-work branch. That
 * branch returned `anonymous_ready` and `bindCurrentUserId = temporary_B`
 * WITHOUT checking the fingerprint, and the coordinator persisted B and adopted
 * the imported work under it.
 *
 * These cases run against REAL SQLite through the portable import and data APIs,
 * then through the coordinator and the adapter gate, so the fix is proven at the
 * production boundary rather than in the domain helper alone.
 */

import { describe, expect, it, vi } from 'vitest';
import type { AccountAuthEvidence } from '@/core/auth/account.types';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

const asyncStorageMock = vi.hoisted(() => {
  const state = new Map<string, string>();
  return {
    state,
    impl: {
      getItem: async (key: string) => state.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        state.set(key, value);
      },
      removeItem: async (key: string) => {
        state.delete(key);
      },
    },
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: asyncStorageMock.impl.getItem,
    setItem: asyncStorageMock.impl.setItem,
    removeItem: asyncStorageMock.impl.removeItem,
  },
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));

const OWNER_A = 'owner-a-0000-0000-0000-0000000000aa';
const TEMP_B = 'temp-b-0000-0000-0000-0000000000bb';
const PROTECTED_B = 'prot-b-0000-0000-0000-0000000000cc';

function auth(overrides: Partial<AccountAuthEvidence> = {}): AccountAuthEvidence {
  return {
    sessionUserId: null,
    sessionIsAnonymous: null,
    verifiedUserId: null,
    verifiedIsAnonymous: null,
    verifiedEmail: null,
    ...overrides,
  };
}

/** Temporary-but-verified B session. */
function authAsTempB(): AccountAuthEvidence {
  return auth({
    sessionUserId: TEMP_B,
    sessionIsAnonymous: true,
    verifiedUserId: TEMP_B,
    verifiedIsAnonymous: true,
  });
}

async function buildSourceFile(ownerUserId: string) {
  const sourceDb = await freshDatabase();
  const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
  const todos = await import('@/features/todos/todos.data');
  await setLocalDatasetOwner(sourceDb as never, ownerUserId);
  await todos.addTodo({ title: 'Imported todo from source device', priority: 'normal' });
  const { exportPortableBackup } = await import('@/core/portable/portableExport');
  const result = await exportPortableBackup();
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  const parsed = JSON.parse(result.json) as { source: { ownerFingerprint: string | null } };
  expect(parsed.source.ownerFingerprint).toMatch(/^[0-9a-f]{64}$/);
  await sourceDb.closeAsync();
  return {
    fileName: result.fileName,
    text: result.json,
    fingerprint: parsed.source.ownerFingerprint!,
  };
}

/** Pristine device with a temporary provisional B binding + owner-A import. */
async function importOwnerBackedFileOntoPristineB() {
  const file = await buildSourceFile(OWNER_A);
  const targetDb = await freshDatabase();
  const { bindProvisionalLocalDatasetOwner } = await import('@/core/auth/account.data');
  await bindProvisionalLocalDatasetOwner(targetDb as never, TEMP_B);

  const { preparePortableImport, confirmPortableImport } =
    await import('@/core/portable/portableImport');
  const outcome = await preparePortableImport({ fileName: file.fileName, text: file.text });
  expect(outcome.status).toBe('ready');
  if (outcome.status !== 'ready') throw new Error('prepare failed');
  const imported = await confirmPortableImport({ file: outcome.file });
  expect(imported.status).toBe('restored');
  if (imported.status !== 'restored') throw new Error('import failed');
  return { targetDb, file };
}

type CoordinatorDeps = ConstructorParameters<
  typeof import('@/core/auth/accountCoordinator').AccountCoordinator
>[0];

async function coordinatorFor(
  targetDb: TestDatabase,
  currentAuth: { value: AccountAuthEvidence },
  overrides: Partial<CoordinatorDeps> = {},
) {
  const { AccountCoordinator } = await import('@/core/auth/accountCoordinator');
  return new AccountCoordinator({
    isConfigured: () => true,
    isRemoteEnabled: () => true,
    getDatabase: async () => targetDb as never,
    getAuthEvidence: async () => currentAuth.value,
    ensureAnonymousSession: async () => undefined,
    requestEmailProtection: async () => undefined,
    verifyEmailChangeOtp: async () => undefined,
    resendEmailChange: async () => undefined,
    requestExistingAccountRecovery: async () => undefined,
    resendExistingAccountRecovery: async () => undefined,
    verifyExistingAccountOtp: async () => undefined,
    signOut: async () => {
      currentAuth.value = auth();
    },
    getRemoteFingerprint: async () => ({ counts: {}, ownerIds: [] }),
    now: () => new Date('2026-08-14T12:00:00.000Z'),
    ...overrides,
  });
}

async function countUnownedOutbox(db: TestDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sync_outbox WHERE owner_user_id IS NULL',
  );
  return Number(row?.n ?? 0);
}

describe('AUD-SH01-A: local edit plus coordinator refresh must not adopt the import', () => {
  it('keeps the dataset unbound, preserves the fingerprint and saves local content', async () => {
    const { targetDb, file } = await importOwnerBackedFileOntoPristineB();

    const { inspectLocalAccountDataState } = await import('@/core/auth/account.data');
    const imported = await inspectLocalAccountDataState(targetDb as never);
    expect(imported.ownerBinding).toBeNull();
    expect(imported.hasUserData).toBe(true);

    const todos = await import('@/features/todos/todos.data');
    const [first] = await todos.listTodos();
    expect(first).toBeTruthy();
    // A real local edit through the production data API.
    await todos.updateTodo(first.id, { title: 'Edited locally while unclaimed' });
    const edited = (await todos.listTodos()).find((todo) => todo.id === first.id);
    expect(edited?.title).toBe('Edited locally while unclaimed');
    // The edit produced an unowned pending intent: the exact condition that
    // used to flip the ownership decision.
    expect(await countUnownedOutbox(targetDb)).toBeGreaterThan(0);

    const currentAuth = { value: authAsTempB() };
    const coordinator = await coordinatorFor(targetDb, currentAuth);
    const state = await coordinator.refresh();

    // The contract: local use works, but nothing adopts the dataset for B.
    expect(state.status).toBe('owner_mismatch');
    expect(state.hasOwnerBinding).toBe(false);
    const after = await inspectLocalAccountDataState(targetDb as never);
    expect(after.ownerBinding).toBeNull();
    expect(after.ownerBindingProvisional).toBe(false);
    // Imported content is intact and still owned by nobody.
    const stillEdited = (await todos.listTodos()).find((todo) => todo.id === first.id);
    expect(stillEdited?.title).toBe('Edited locally while unclaimed');
    expect(await countUnownedOutbox(targetDb)).toBeGreaterThan(0);

    const origin = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'portable.last_import_owner_fingerprint'",
    );
    expect(origin?.value).toBe(file.fingerprint);
    await targetDb.closeAsync();
  }, 60000);

  it('survives a restart: a second coordinator refresh still refuses B', async () => {
    const { targetDb } = await importOwnerBackedFileOntoPristineB();
    const todos = await import('@/features/todos/todos.data');
    const [first] = await todos.listTodos();
    await todos.updateTodo(first.id, { title: 'Restart persistence check' });

    const currentAuth = { value: authAsTempB() };
    await (await coordinatorFor(targetDb, currentAuth)).refresh();
    // Fresh coordinator instance == process restart as far as durable state goes.
    const restarted = await coordinatorFor(targetDb, currentAuth);
    const state = await restarted.refresh();
    expect(state.status).toBe('owner_mismatch');
    expect(state.hasOwnerBinding).toBe(false);
    await targetDb.closeAsync();
  }, 60000);
});

describe('AUD-SH01-B: matching source account still claims it coherently', () => {
  it('binds A, adopts the pending work once and does not duplicate promotion', async () => {
    const { targetDb, file } = await importOwnerBackedFileOntoPristineB();
    const todos = await import('@/features/todos/todos.data');
    const [first] = await todos.listTodos();
    await todos.updateTodo(first.id, { title: 'Edited before recovery' });

    const { portableOwnerFingerprint } = await import('@/lib/portableOwnerFingerprint');
    expect(portableOwnerFingerprint(OWNER_A)).toBe(file.fingerprint);

    const currentAuth = { value: authAsTempB() };
    const verifyExistingAccountOtp = vi.fn(async () => {
      currentAuth.value = auth({
        sessionUserId: OWNER_A,
        sessionIsAnonymous: false,
        verifiedUserId: OWNER_A,
        verifiedIsAnonymous: false,
        verifiedEmail: 'owner-a@example.com',
      });
    });
    const coordinator = await coordinatorFor(targetDb, currentAuth, {
      verifyExistingAccountOtp,
    });

    await expect(coordinator.requestRecovery('owner-a@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'sign_in_pending',
    });
    await expect(coordinator.verifyRecovery('123456')).resolves.toMatchObject({
      ok: true,
      status: 'protected',
    });

    const { inspectLocalAccountDataState } = await import('@/core/auth/account.data');
    const bound = await inspectLocalAccountDataState(targetDb as never);
    expect(bound.ownerBinding).toBe(OWNER_A);
    expect(bound.ownerBindingProvisional).toBe(false);
    // No unowned work is stranded, and nothing was adopted under the temporary B.
    expect(bound.unownedOutboxCount).toBe(0);
    expect(bound.outboxOwnerIds).toEqual([OWNER_A]);

    // A second refresh is idempotent: same owner, same intents, no duplicates.
    const intentsBefore = await targetDb.getAllAsync<{ entity: string; id: string }>(
      'SELECT entity, id FROM sync_outbox ORDER BY entity ASC, id ASC',
    );
    const again = await coordinator.refresh();
    expect(again.hasOwnerBinding).toBe(true);
    const intentsAfter = await targetDb.getAllAsync<{ entity: string; id: string }>(
      'SELECT entity, id FROM sync_outbox ORDER BY entity ASC, id ASC',
    );
    expect(intentsAfter).toEqual(intentsBefore);
    await targetDb.closeAsync();
  }, 60000);
});

describe('AUD-SH01-C: fail closed on every other origin shape', () => {
  it('a protected unrelated account cannot claim the import', async () => {
    const { targetDb } = await importOwnerBackedFileOntoPristineB();
    const todos = await import('@/features/todos/todos.data');
    const [first] = await todos.listTodos();
    await todos.updateTodo(first.id, { title: 'Edited while unclaimed' });

    const currentAuth = {
      value: auth({
        sessionUserId: PROTECTED_B,
        sessionIsAnonymous: false,
        verifiedUserId: PROTECTED_B,
        verifiedIsAnonymous: false,
        verifiedEmail: 'protected-b@example.com',
      }),
    };
    const state = await (await coordinatorFor(targetDb, currentAuth)).refresh();
    expect(state.status).toBe('owner_mismatch');
    expect(state.hasOwnerBinding).toBe(false);
    // A verified non-anonymous intruder gets no recovery form for someone else's data.
    expect(state.canRecoverImportedOwner).toBe(false);
    await targetDb.closeAsync();
  }, 60000);

  it('malformed origin metadata fails closed rather than being read as permission', async () => {
    const { targetDb } = await importOwnerBackedFileOntoPristineB();
    const todos = await import('@/features/todos/todos.data');
    const [first] = await todos.listTodos();
    await todos.updateTodo(first.id, { title: 'Edited while unclaimed' });
    // Corrupt the recorded origin into something that is not a fingerprint.
    await targetDb.runAsync(
      "UPDATE app_meta SET value = 'not-a-fingerprint' WHERE key = 'portable.last_import_owner_fingerprint'",
    );

    const currentAuth = { value: authAsTempB() };
    const state = await (await coordinatorFor(targetDb, currentAuth)).refresh();
    expect(state.status).toBe('owner_mismatch');
    expect(state.hasOwnerBinding).toBe(false);
    // The durable boundary refuses too, not just the decision.
    const { bindLocalDatasetOwner } = await import('@/core/auth/account.data');
    await expect(
      bindLocalDatasetOwner(targetDb as never, TEMP_B, { adoptUnownedOutbox: true }),
    ).rejects.toThrow(/IMPORT_ORIGIN_OWNER_CONFLICT/);
    await targetDb.closeAsync();
  }, 60000);

  it('already-owned outbox work is never reassigned by the guard', async () => {
    const { targetDb } = await importOwnerBackedFileOntoPristineB();
    const todos = await import('@/features/todos/todos.data');
    const [first] = await todos.listTodos();
    await todos.updateTodo(first.id, { title: 'Owned elsewhere' });
    // Simulate older work already owned by a previous account.
    await targetDb.runAsync('UPDATE sync_outbox SET owner_user_id = ?', [PROTECTED_B]);
    const ownedBefore = await targetDb.getAllAsync<{ id: string; owner_user_id: string }>(
      'SELECT id, owner_user_id FROM sync_outbox ORDER BY id ASC',
    );
    expect(ownedBefore.every((row) => row.owner_user_id === PROTECTED_B)).toBe(true);

    const currentAuth = { value: authAsTempB() };
    const state = await (await coordinatorFor(targetDb, currentAuth)).refresh();
    expect(state.hasOwnerBinding).toBe(false);
    const ownedAfter = await targetDb.getAllAsync<{ id: string; owner_user_id: string }>(
      'SELECT id, owner_user_id FROM sync_outbox ORDER BY id ASC',
    );
    expect(ownedAfter).toEqual(ownedBefore);
    await targetDb.closeAsync();
  }, 60000);

  it('a local-only import with no recorded origin keeps its disclosed adoption behavior', async () => {
    const { targetDb } = await importOwnerBackedFileOntoPristineB();
    // Remove the protected origin: this is the documented local-only case.
    await targetDb.runAsync(
      "DELETE FROM app_meta WHERE key = 'portable.last_import_owner_fingerprint'",
    );
    const todos = await import('@/features/todos/todos.data');
    const [first] = await todos.listTodos();
    await todos.updateTodo(first.id, { title: 'Local-only adoption case' });

    const currentAuth = { value: authAsTempB() };
    const state = await (await coordinatorFor(targetDb, currentAuth)).refresh();
    // No protected source exists, so the pre-existing adoption rule still applies.
    expect(state.status).not.toBe('owner_mismatch');
    expect(state.hasOwnerBinding).toBe(true);
    await targetDb.closeAsync();
  }, 60000);
});

describe('AUD-SH01-B: the domain guard itself', () => {
  it('refuses an unrelated temporary session even with pending unowned work', async () => {
    const { decideAccountState } = await import('@/core/auth/account.domain');
    const { portableOwnerFingerprint } = await import('@/lib/portableOwnerFingerprint');
    const decision = decideAccountState({
      configured: true,
      remoteEnabled: true,
      local: {
        counts: {} as never,
        activeUserDataCount: 1,
        deletedUserDataCount: 0,
        hasUserData: true,
        ownerBinding: null,
        ownerBindingProvisional: false,
        pendingOutboxCount: 1,
        unownedOutboxCount: 1,
        outboxOwnerIds: [],
      },
      auth: authAsTempB(),
      importOriginOwnerFingerprint: portableOwnerFingerprint(OWNER_A),
    });
    expect(decision.status).toBe('owner_mismatch');
    expect(decision.bindCurrentUserId).toBeNull();
    expect(decision.bindProvisionalUserId).toBeNull();
    expect(decision.seedOwnerUserId).toBeNull();
  });
});

describe('AUD-SH01-C: an UNREADABLE origin fails closed', () => {
  it('the committing guard refuses when the fingerprint read fails', async () => {
    // The audited defect: `readImportOriginFingerprint` converted a failed read
    // into `null`, which means "no origin", which PERMITS adoption — so one
    // injected storage error let an unrelated account commit a binding over a
    // protected imported dataset.
    //
    // The guard is exercised through the REAL binding function against a
    // database whose `app_meta` read genuinely fails (a dropped table), so the
    // failure reaches the committing boundary rather than a mock.
    const db = await freshDatabase();
    await db.runAsync('DROP TABLE app_meta');

    const { bindLocalDatasetOwner } = await import('@/core/auth/account.data');
    const thrown = await bindLocalDatasetOwner(db as never, TEMP_B, {
      adoptUnownedOutbox: true,
    }).catch((error: unknown) => error);

    // With the fail-open defect this RESOLVES and binds TEMP_B. With the fix the
    // failure surfaces as a refusal and nothing is bound.
    expect(thrown).toBeInstanceOf(Error);
    await db.closeAsync();
  }, 60000);

  it('the decision layer refuses an explicitly unreadable origin', async () => {
    const { decideImportOriginClaim, UNREADABLE_IMPORT_ORIGIN } =
      await import('@/lib/importOrigin');
    // Even the SOURCE owner cannot be assumed when the origin cannot be read.
    expect(
      decideImportOriginClaim({
        importOrigin: UNREADABLE_IMPORT_ORIGIN,
        candidateUserId: OWNER_A,
        candidateIsAnonymous: false,
      }),
    ).toEqual({ allowed: false, reason: 'unreadable_origin' });
    // A genuinely ABSENT origin still permits the documented local-only case.
    expect(
      decideImportOriginClaim({
        importOrigin: null,
        candidateUserId: TEMP_B,
        candidateIsAnonymous: true,
      }),
    ).toEqual({ allowed: true, reason: 'no_recorded_origin' });
  });
});
