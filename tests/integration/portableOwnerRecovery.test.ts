import { describe, expect, it, vi } from 'vitest';
import type { AccountAuthEvidence } from '@/core/auth/account.types';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

/** Controllable AsyncStorage double (theme capture during export). */
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

// `expo-constants` pulls expo-modules-core, which has no node/vitest runtime;
// the app version is informational metadata in the portable envelope.
vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));

/**
 * Portable owner-backed import → account recovery (closure V1).
 *
 * Finding 1 (HIGH): after a fresh device imports an owner-backed portable
 * file, the dataset is populated but locally UNBOUND, the source owner
 * fingerprint is recorded, and the temporary anonymous session may still be
 * active. The account state machine correctly says only the matching account
 * may bind the dataset, but `AccountCoordinator.requestRecovery()` must also
 * provide a legal transition to authenticate that account. The first test in
 * this file reproduces the historical dead end (RED before the fix); the
 * remaining tests prove the imported-owner recovery transition end-to-end on
 * real SQLite.
 */

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

/** Fixed test identities. */
const OWNER_A = 'owner-a-0000-0000-0000-0000000000aa';
const WRONG_B = 'wrong-b-0000-0000-0000-0000000000bb';
const TEMP_T = 'temp-t-0000-0000-0000-0000000000a1';

async function buildSourceFile(db: TestDatabase, ownerUserId: string) {
  const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
  const todos = await import('@/features/todos/todos.data');
  await setLocalDatasetOwner(db as never, ownerUserId);
  await todos.addTodo({ title: 'Imported todo from source device', priority: 'normal' });
  const { exportPortableBackup } = await import('@/core/portable/portableExport');
  const result = await exportPortableBackup();
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  const parsed = JSON.parse(result.json) as { source: { ownerFingerprint: string | null } };
  expect(parsed.source.ownerFingerprint).toMatch(/^[0-9a-f]{64}$/);
  return {
    fileName: result.fileName,
    text: result.json,
    fingerprint: parsed.source.ownerFingerprint!,
  };
}

/** Fresh destination + owner-backed import, returning the import context. */
async function importOwnerBackedFile() {
  const sourceDb = await freshDatabase();
  const file = await buildSourceFile(sourceDb, OWNER_A);
  await sourceDb.closeAsync();

  const targetDb = await freshDatabase();
  const { bindProvisionalLocalDatasetOwner } = await import('@/core/auth/account.data');
  // Fresh installation with a temporary anonymous session T: provisional
  // owner binding for the throwaway session on a pristine device.
  await bindProvisionalLocalDatasetOwner(targetDb as never, TEMP_T);

  const { preparePortableImport, confirmPortableImport } =
    await import('@/core/portable/portableImport');
  const outcome = await preparePortableImport({ fileName: file.fileName, text: file.text });
  expect(outcome.status).toBe('ready');
  if (outcome.status !== 'ready') throw new Error('prepare failed');
  expect(outcome.preview.ownerVerdict).toBe('unclaimed');
  const imported = await confirmPortableImport({ file: outcome.file });
  expect(imported.status).toBe('restored');
  if (imported.status !== 'restored') throw new Error('import failed');

  return { targetDb, file };
}

describe('imported-owner recovery — Finding 1 dead end', () => {
  it('REPRO (red before the fix): imported owner-backed dataset exposes matching-account recovery', async () => {
    const { targetDb, file } = await importOwnerBackedFile();

    const { inspectLocalAccountDataState } = await import('@/core/auth/account.data');
    const local = await inspectLocalAccountDataState(targetDb as never);
    expect(local.hasUserData).toBe(true);
    expect(local.ownerBinding).toBeNull();
    expect(local.pendingOutboxCount).toBe(0);
    expect(local.outboxOwnerIds).toEqual([]);
    const origin = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'portable.last_import_owner_fingerprint'",
    );
    expect(origin?.value).toBe(file.fingerprint);

    // Temporary anonymous session T is still active after the import.
    const currentAuth = {
      value: auth({
        sessionUserId: 'temp-t-0000-0000-0000-0000000000a1',
        sessionIsAnonymous: true,
        verifiedUserId: 'temp-t-0000-0000-0000-0000000000a1',
        verifiedIsAnonymous: true,
      }),
    };
    const { AccountCoordinator } = await import('@/core/auth/accountCoordinator');
    const coordinator = new AccountCoordinator({
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
    });

    // DESIRED post-fix contract (fails on current code — this is the
    // reproduced dead end): the state machine surfaces the imported-owner
    // recovery capability and requestRecovery() accepts the source account.
    const state = await coordinator.refresh();
    expect(state.canRecoverImportedOwner).toBe(true);
    expect(state.canRecoverExisting).toBe(false);
    expect(state.canRecoverOwner).toBe(false);

    const recovery = await coordinator.requestRecovery('owner-a@example.com');
    expect(recovery.ok).toBe(true);
    expect(recovery.status).toBe('sign_in_pending');

    // Nothing was mutated by the request: still unbound, fingerprint kept.
    const after = await inspectLocalAccountDataState(targetDb as never);
    expect(after.ownerBinding).toBeNull();
    expect(after.hasUserData).toBe(true);
    await targetDb.closeAsync();
  }, 60000);
});

describe('imported-owner recovery — real SQLite end to end', () => {
  async function coordinatorForTarget(
    targetDb: TestDatabase,
    currentAuth: { value: AccountAuthEvidence },
    overrides: Partial<
      ConstructorParameters<typeof import('@/core/auth/accountCoordinator').AccountCoordinator>[0]
    > = {},
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

  it('A: matching account binds the imported dataset, rows survive, backfill enqueues under A', async () => {
    const { targetDb, file } = await importOwnerBackedFile();
    const { portableOwnerFingerprint } = await import('@/lib/portableOwnerFingerprint');
    expect(portableOwnerFingerprint(OWNER_A)).toBe(file.fingerprint);

    const currentAuth = {
      value: auth({
        sessionUserId: TEMP_T,
        sessionIsAnonymous: true,
        verifiedUserId: TEMP_T,
        verifiedIsAnonymous: true,
      }),
    };
    const verifyExistingAccountOtp = vi.fn(async () => {
      currentAuth.value = auth({
        sessionUserId: OWNER_A,
        sessionIsAnonymous: false,
        verifiedUserId: OWNER_A,
        verifiedIsAnonymous: false,
        verifiedEmail: 'owner-a@example.com',
      });
    });
    const coordinator = await coordinatorForTarget(targetDb, currentAuth, {
      verifyExistingAccountOtp,
    });

    const beforeRows = await targetDb.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM todos ORDER BY id ASC',
    );
    expect(beforeRows.length).toBeGreaterThan(0);

    // Imported-owner recovery accepted and verified for the matching account.
    await expect(coordinator.requestRecovery('owner-a@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'sign_in_pending',
    });
    await expect(coordinator.verifyRecovery('123456')).resolves.toMatchObject({
      ok: true,
      status: 'protected',
    });

    // 1) Permanent binding for the matched owner.
    const { inspectLocalAccountDataState } = await import('@/core/auth/account.data');
    const bound = await inspectLocalAccountDataState(targetDb as never);
    expect(bound.ownerBinding).toBe(OWNER_A);
    expect(bound.ownerBindingProvisional).toBe(false);

    // 2) Imported rows are byte-identical to the moment after import.
    const afterRows = await targetDb.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM todos ORDER BY id ASC',
    );
    expect(afterRows).toEqual(beforeRows);

    // 3) Backup V2: the imported dataset is enqueued under A — every imported
    // row + the settings record are in the outbox owned by A.
    const outbox = await targetDb.getAllAsync<{
      entity: string;
      id: string;
      owner_user_id: string | null;
    }>('SELECT entity, id, owner_user_id FROM sync_outbox ORDER BY entity, id');
    expect(outbox.length).toBeGreaterThan(0);
    expect(outbox.every((row) => row.owner_user_id === OWNER_A)).toBe(true);
    expect(outbox.some((row) => row.entity === 'user_backup_settings')).toBe(true);

    // 4) Dirty + reset markers: completeness is NOT claimed until real upload.
    const dirty = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.dirty'",
    );
    expect(dirty?.value).toBe('1');
    const scope = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.scope_version'",
    );
    expect(scope?.value).toBe('2');
    const backfillStatus = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.backfill_status'",
    );
    expect(backfillStatus?.value).toBe('complete');
    const lastComplete = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.last_complete_generation'",
    );
    expect(lastComplete).toBeNull();

    await targetDb.closeAsync();
  }, 90000);

  it('B: wrong account is signed out fail-closed and never binds the imported dataset', async () => {
    const { targetDb, file } = await importOwnerBackedFile();

    const currentAuth = {
      value: auth({
        sessionUserId: TEMP_T,
        sessionIsAnonymous: true,
        verifiedUserId: TEMP_T,
        verifiedIsAnonymous: true,
      }),
    };
    const signOut = vi.fn(async () => {
      currentAuth.value = auth();
    });
    const verifyExistingAccountOtp = vi.fn(async () => {
      currentAuth.value = auth({
        sessionUserId: WRONG_B,
        sessionIsAnonymous: false,
        verifiedUserId: WRONG_B,
        verifiedIsAnonymous: false,
        verifiedEmail: 'wrong-b@example.com',
      });
    });
    const coordinator = await coordinatorForTarget(targetDb, currentAuth, {
      signOut,
      verifyExistingAccountOtp,
    });

    const beforeRows = await targetDb.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM todos ORDER BY id ASC',
    );

    await expect(coordinator.requestRecovery('wrong-b@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'sign_in_pending',
    });
    await expect(coordinator.verifyRecovery('123456')).resolves.toMatchObject({
      ok: false,
      status: 'owner_mismatch',
    });

    expect(signOut).toHaveBeenCalled();
    expect(currentAuth.value.verifiedUserId).toBeNull();
    const { inspectLocalAccountDataState } = await import('@/core/auth/account.data');
    const local = await inspectLocalAccountDataState(targetDb as never);
    expect(local.ownerBinding).toBeNull();
    expect(local.hasUserData).toBe(true);
    const origin = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'portable.last_import_owner_fingerprint'",
    );
    expect(origin?.value).toBe(file.fingerprint);
    const afterRows = await targetDb.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM todos ORDER BY id ASC',
    );
    expect(afterRows).toEqual(beforeRows);

    await targetDb.closeAsync();
  }, 90000);

  it('C/D: temporary-session remote footprint gates the switch; empty footprint allows it', async () => {
    const { targetDb } = await importOwnerBackedFile();
    const currentAuth = {
      value: auth({
        sessionUserId: TEMP_T,
        sessionIsAnonymous: true,
        verifiedUserId: TEMP_T,
        verifiedIsAnonymous: true,
      }),
    };
    const requestExistingAccountRecovery = vi.fn();

    // C: T has remote backup rows → conflict, no switch, no OTP request.
    const blocked = await coordinatorForTarget(targetDb, currentAuth, {
      requestExistingAccountRecovery,
      getRemoteFingerprint: async () => ({
        counts: { todos: 3, habits: 0, calorie_entries: 0, workout_routines: 0 },
        ownerIds: [TEMP_T],
      }),
    });
    await expect(blocked.requestRecovery('owner-a@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'account_conflict',
    });
    expect(requestExistingAccountRecovery).not.toHaveBeenCalled();

    // D: T has no remote rows → the matching-account recovery is allowed.
    const allowed = await coordinatorForTarget(targetDb, currentAuth, {
      requestExistingAccountRecovery,
      getRemoteFingerprint: async () => ({ counts: {}, ownerIds: [] }),
    });
    await expect(allowed.requestRecovery('owner-a@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'sign_in_pending',
    });
    expect(requestExistingAccountRecovery).toHaveBeenCalledTimes(1);

    await targetDb.closeAsync();
  }, 90000);

  it('E: remote unavailable keeps the dataset local and the recovery retryable', async () => {
    const { targetDb, file } = await importOwnerBackedFile();
    const currentAuth = {
      value: auth({
        sessionUserId: TEMP_T,
        sessionIsAnonymous: true,
        verifiedUserId: TEMP_T,
        verifiedIsAnonymous: true,
      }),
    };
    const coordinator = await coordinatorForTarget(targetDb, currentAuth, {
      getRemoteFingerprint: async () => {
        throw new Error('network down');
      },
    });

    await expect(coordinator.requestRecovery('owner-a@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'remote_unavailable',
    });
    const { inspectLocalAccountDataState } = await import('@/core/auth/account.data');
    const local = await inspectLocalAccountDataState(targetDb as never);
    expect(local.ownerBinding).toBeNull();
    expect(local.hasUserData).toBe(true);
    const origin = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'portable.last_import_owner_fingerprint'",
    );
    expect(origin?.value).toBe(file.fingerprint);

    await targetDb.closeAsync();
  }, 90000);

  it('F: a local-only import never gets the imported-owner exception', async () => {
    // Local-only source: no owner binding on the source device → no fingerprint.
    const sourceDb = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    await todos.addTodo({ title: 'Local-only todo', priority: 'normal' });
    const { exportPortableBackup } = await import('@/core/portable/portableExport');
    const result = await exportPortableBackup();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    await sourceDb.closeAsync();

    const targetDb = await freshDatabase();
    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const outcome = await preparePortableImport({ fileName: result.fileName, text: result.json });
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') throw new Error('prepare failed');
    expect(outcome.preview.ownerVerdict).toBe('local_only_source');
    await expect(confirmPortableImport({ file: outcome.file })).resolves.toMatchObject({
      status: 'restored',
    });

    const origin = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'portable.last_import_owner_fingerprint'",
    );
    expect(origin?.value).toBe('null');

    // No session: the dataset stays unbound and local-only; recovery of any
    // account is blocked (no fingerprint, no exception).
    const currentAuth = { value: auth() };
    const coordinator = await coordinatorForTarget(targetDb, currentAuth);
    const state = await coordinator.refresh();
    expect(state.canRecoverImportedOwner).toBe(false);
    await expect(coordinator.requestRecovery('owner-a@example.com')).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining('switching'),
    });

    await targetDb.closeAsync();
  }, 90000);

  it('G: arbitrary populated unbound local data (no import) has no switch exception', async () => {
    const targetDb = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    await todos.addTodo({ title: 'Hand-typed local todo', priority: 'normal' });

    const currentAuth = { value: auth() };
    const coordinator = await coordinatorForTarget(targetDb, currentAuth);
    const state = await coordinator.refresh();
    expect(state.canRecoverImportedOwner).toBe(false);
    await expect(coordinator.requestRecovery('owner-a@example.com')).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining('switching'),
    });

    await targetDb.closeAsync();
  }, 90000);

  it('I: matching account already authenticated after import binds automatically without recovery', async () => {
    const { targetDb, file } = await importOwnerBackedFile();
    const { portableOwnerFingerprint } = await import('@/lib/portableOwnerFingerprint');
    expect(portableOwnerFingerprint(OWNER_A)).toBe(file.fingerprint);

    const currentAuth = {
      value: auth({
        sessionUserId: OWNER_A,
        sessionIsAnonymous: false,
        verifiedUserId: OWNER_A,
        verifiedIsAnonymous: false,
        verifiedEmail: 'owner-a@example.com',
      }),
    };
    const coordinator = await coordinatorForTarget(targetDb, currentAuth);
    await expect(coordinator.refresh()).resolves.toMatchObject({
      status: 'protected',
      canRecoverImportedOwner: false,
    });
    const { inspectLocalAccountDataState } = await import('@/core/auth/account.data');
    const local = await inspectLocalAccountDataState(targetDb as never);
    expect(local.ownerBinding).toBe(OWNER_A);

    await targetDb.closeAsync();
  }, 90000);

  it('H: an owner-bound device blocks the source-owner file before import', async () => {
    const sourceDb = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(sourceDb as never, OWNER_A);
    const todos = await import('@/features/todos/todos.data');
    await todos.addTodo({ title: 'Protected source todo', priority: 'normal' });
    const { exportPortableBackup } = await import('@/core/portable/portableExport');
    const result = await exportPortableBackup();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    await sourceDb.closeAsync();

    // Owner B device: populated and permanently bound to another account.
    const targetDb = await freshDatabase();
    const { bindLocalDatasetOwner } = await import('@/core/auth/account.data');
    await bindLocalDatasetOwner(targetDb as never, WRONG_B);
    const targetTodos = await import('@/features/todos/todos.data');
    await targetTodos.addTodo({ title: 'Owner B todo', priority: 'normal' });

    const { preparePortableImport } = await import('@/core/portable/portableImport');
    const outcome = await preparePortableImport({ fileName: result.fileName, text: result.json });
    if (outcome.status !== 'rejected') {
      throw new Error(`expected rejection, got ${outcome.status}`);
    }
    // Blocked before import — either the device is not empty or, on an empty
    // owner-bound device, the owner fingerprint mismatches.
    expect(outcome.message).toMatch(/empty device|different account/);

    await targetDb.closeAsync();
  }, 90000);
});
