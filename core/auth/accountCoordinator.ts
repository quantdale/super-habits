import { getDatabase } from '@/core/db/client';
import { appMetaKeys, getAppMetaJson, getAppMetaText, setAppMetaJson } from '@/core/db/appMeta';
import {
  adoptUnownedOutboxRows,
  bindLocalDatasetOwner,
  bindProvisionalLocalDatasetOwner,
  inspectLocalAccountDataState,
  isEmptyForAccountReplacement,
  promoteLocalDatasetOwnerIfProvisional,
  replaceProvisionalLocalDatasetOwner,
} from '@/core/auth/account.data';
import {
  decideAccountState,
  isValidAccountEmail,
  isValidAccountOtp,
} from '@/core/auth/account.domain';
import { BACKUP_ENTITIES, BACKUP_SYNTHETIC_ENTITIES } from '@/core/backup/backup.types';
import { ensureBackupBackfill } from '@/core/backup/backupBackfill';
import {
  isPortableOwnerFingerprint,
  portableOwnerFingerprint,
} from '@/lib/portableOwnerFingerprint';
import type {
  AccountActionResult,
  AccountAuthEvidence,
  AccountCoordinatorDependencies,
  AccountRemoteFingerprint,
  AccountState,
  LocalAccountDataState,
  PendingProtection,
  PendingRecovery,
} from '@/core/auth/account.types';
import {
  classifySupabaseAuthError,
  ensureAnonymousSession,
  getSupabaseAuthEvidence,
  isRemoteEnabled,
  requestEmailProtection,
  requestExistingAccountRecovery,
  requestExistingAccountRecovery as resendExistingAccountRecovery,
  resendEmailChange,
  signOutSupabase,
  supabase,
  verifyEmailChangeOtp,
  verifyExistingAccountOtp,
  isSupabaseConfigured,
} from '@/lib/supabase';

/**
 * Complete owner-scoped remote backup scope derived from Backup V2. Temporary
 * account safety gate must check every entity that can carry meaningful user
 * backup state — not just the original four V1 sync tables.
 *
 * Covers all `BACKUP_ENTITIES` (17 table-backed entities) plus
 * `BACKUP_SYNTHETIC_ENTITIES` (`user_backup_settings`, `backup_manifest`).
 * AI quota counters and implementation-only infrastructure tables are excluded
 * because they are not user recovery data.
 */
const ACCOUNT_REMOTE_BACKUP_ENTITIES = [...BACKUP_ENTITIES, ...BACKUP_SYNTHETIC_ENTITIES] as const;
const RESEND_COOLDOWN_MS = 60_000;

function defaultNow(): Date {
  return new Date();
}

/**
 * True when a per-entity count query failed because the remote does not have
 * that table yet (pre-migration server: PostgREST schema-cache miss PGRST205,
 * an HTTP-404-style relation-not-found, or the raw "relation ... does not
 * exist" form). Such a remote carries zero rows for that entity, so the
 * fingerprint may treat it as empty; every OTHER error must propagate
 * fail-closed.
 */
function isMissingRemoteTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return (
    code === 'PGRST205' ||
    code === '404' ||
    /PGRST205/i.test(message) ||
    /could not find the table .* in the schema cache/i.test(message) ||
    /relation .* does not exist/i.test(message)
  );
}

/** Exported for diagnostics/tests: owner-scoped remote row counts per entity. */
export async function getRemoteFingerprint(userId: string): Promise<AccountRemoteFingerprint> {
  const client = supabase;
  if (!client) return { counts: {}, ownerIds: [] };

  const results = await Promise.all(
    ACCOUNT_REMOTE_BACKUP_ENTITIES.map(async (entity) => {
      const { count, error } = await client
        .from(entity)
        .select('user_id', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (error) {
        // A pre-migration remote lacks tables that this app's backup scope
        // includes (e.g. weekly_reviews). That entity provably holds zero rows
        // there, so treat it as count 0 with a recorded diagnostic instead of
        // failing every protection/recovery flow. All other errors rethrow.
        if (!isMissingRemoteTableError(error)) throw error;
        return {
          entity,
          count: 0,
          diagnostic: `${entity}: remote table missing (treated as empty)`,
        };
      }
      return { entity, count: count ?? 0, diagnostic: null };
    }),
  );

  const diagnostics = results
    .map(({ diagnostic }) => diagnostic)
    .filter((diagnostic): diagnostic is string => diagnostic !== null);

  return {
    counts: Object.fromEntries(results.map(({ entity, count }) => [entity, count])),
    ownerIds: results.some((r) => r.count > 0) ? [userId] : [],
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
  };
}

const defaultDependencies: AccountCoordinatorDependencies = {
  isConfigured: isSupabaseConfigured,
  isRemoteEnabled,
  getAuthEvidence: async () => getSupabaseAuthEvidence(),
  ensureAnonymousSession,
  requestEmailProtection,
  verifyEmailChangeOtp,
  resendEmailChange,
  requestExistingAccountRecovery,
  resendExistingAccountRecovery,
  verifyExistingAccountOtp,
  signOut: signOutSupabase,
  getRemoteFingerprint,
  now: defaultNow,
  getDatabase: getDatabase,
};

function safeActionErrorMessage(kind: ReturnType<typeof classifySupabaseAuthError>): string {
  switch (kind) {
    case 'email_conflict':
      return 'That email belongs to another Super Habits account. Automatic account merging is not supported.';
    case 'invalid_otp':
      return 'That verification code is not valid. Check the code and try again.';
    case 'expired_otp':
      return 'That verification code has expired. Request a new code and try again.';
    case 'unknown_account':
      return 'We could not find an existing account for that email. Check the address and try again.';
    case 'network':
      return 'Remote backup is temporarily unavailable. Your local data is safe; try again later.';
    case 'not_configured':
      return 'Remote backup is not configured on this installation.';
    default:
      return 'We could not complete that account action. Your local data was not changed.';
  }
}

function actionResult(
  ok: boolean,
  status: AccountState['status'],
  message: string,
): AccountActionResult {
  return { ok, status, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRemoteFingerprint(value: unknown): value is AccountRemoteFingerprint {
  if (!isRecord(value) || !isRecord(value.counts) || !isStringArray(value.ownerIds)) {
    return false;
  }
  return Object.values(value.counts).every(
    (count) => typeof count === 'number' && Number.isInteger(count) && count >= 0,
  );
}

function isPendingProtection(value: unknown): value is PendingProtection {
  if (!isRecord(value)) return false;
  const hasLegacyCount =
    value.beforePendingOutboxCount === undefined ||
    (typeof value.beforePendingOutboxCount === 'number' &&
      Number.isInteger(value.beforePendingOutboxCount) &&
      value.beforePendingOutboxCount >= 0);
  const hasLegacyOwners =
    value.beforeOutboxOwnerIds === undefined || isStringArray(value.beforeOutboxOwnerIds);
  const hasLegacyFingerprint =
    value.beforeRemoteFingerprint === undefined ||
    value.beforeRemoteFingerprint === null ||
    isRemoteFingerprint(value.beforeRemoteFingerprint);
  return (
    typeof value.email === 'string' &&
    isValidAccountEmail(value.email) &&
    typeof value.originalUserId === 'string' &&
    value.originalUserId.length > 0 &&
    typeof value.requestedAt === 'string' &&
    Number.isFinite(Date.parse(value.requestedAt)) &&
    hasLegacyCount &&
    hasLegacyOwners &&
    hasLegacyFingerprint
  );
}

function isPendingRecovery(value: unknown): value is PendingRecovery {
  if (!isRecord(value)) return false;
  return (
    typeof value.email === 'string' &&
    isValidAccountEmail(value.email) &&
    typeof value.requestedAt === 'string' &&
    Number.isFinite(Date.parse(value.requestedAt)) &&
    (value.temporarySessionUserId === null || typeof value.temporarySessionUserId === 'string') &&
    (value.expectedOwnerUserId === null || typeof value.expectedOwnerUserId === 'string') &&
    (value.expectedOwnerFingerprint === null ||
      isPortableOwnerFingerprint(value.expectedOwnerFingerprint))
  );
}

export class AccountCoordinator {
  private readonly dependencies: AccountCoordinatorDependencies;
  private actionInFlight: 'protect' | 'recover' | 'verify' | null = null;

  constructor(dependencies: Partial<AccountCoordinatorDependencies> = {}) {
    this.dependencies = { ...defaultDependencies, ...dependencies };
  }

  async bootstrap(): Promise<AccountState> {
    const local = await this.inspect();
    if (!this.dependencies.isConfigured() || !this.dependencies.isRemoteEnabled()) {
      return this.reconcile(local);
    }

    const auth = await this.getAuthEvidence();
    const decision = decideAccountState({
      configured: true,
      remoteEnabled: true,
      local,
      auth,
      importOriginOwnerFingerprint: await this.readPortableImportOriginFingerprint(),
    });

    if (decision.shouldCreateAnonymous && !auth.sessionUserId) {
      try {
        await this.dependencies.ensureAnonymousSession();
      } catch {
        // Auth failure is a remote status. Local boot must continue.
      }
    }

    return this.reconcile(await this.inspect());
  }

  async refresh(): Promise<AccountState> {
    return this.reconcile(await this.inspect());
  }

  async protect(email: string): Promise<AccountActionResult> {
    if (this.actionInFlight) {
      return actionResult(false, 'error', 'An account action is already in progress.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidAccountEmail(normalizedEmail)) {
      return actionResult(false, 'anonymous_ready', 'Enter a valid email address.');
    }
    this.actionInFlight = 'protect';

    try {
      const auth = await this.getAuthEvidence();
      if (!auth.verifiedUserId || auth.verifiedIsAnonymous !== true) {
        const state = await this.refresh();
        return actionResult(
          state.status === 'protected',
          state.status,
          state.status === 'protected'
            ? 'This backup is already protected.'
            : 'Only the current anonymous backup can be protected here.',
        );
      }

      let beforeLocal = await this.inspect();
      if (beforeLocal.outboxOwnerIds.some((owner) => owner !== auth.verifiedUserId)) {
        return actionResult(
          false,
          'owner_mismatch',
          'Backup ownership is conflicting, so protection is paused.',
        );
      }

      if (beforeLocal.ownerBinding && beforeLocal.ownerBinding !== auth.verifiedUserId) {
        return actionResult(
          false,
          'owner_mismatch',
          'This device belongs to another backup account. Sign back into that account.',
        );
      }

      if (!beforeLocal.ownerBinding) {
        const db = await this.getDatabase();
        await bindLocalDatasetOwner(db, auth.verifiedUserId, { adoptUnownedOutbox: true });
        beforeLocal = await this.inspect();
      }

      try {
        await this.dependencies.requestEmailProtection(normalizedEmail);
      } catch (error) {
        return actionResult(
          false,
          'anonymous_ready',
          safeActionErrorMessage(classifySupabaseAuthError(error)),
        );
      }

      // Ownership-only snapshot: no outbox or remote row counts are frozen.
      // The user may keep writing and sync may keep flushing while the OTP is
      // pending; verification checks ownership facts, never dataset volume.
      const pending: PendingProtection = {
        email: normalizedEmail,
        originalUserId: auth.verifiedUserId,
        requestedAt: this.dependencies.now().toISOString(),
      };
      await this.savePendingProtection(pending);
      return actionResult(
        true,
        'protection_pending',
        'Check your email for the six-digit verification code to protect this backup.',
      );
    } finally {
      this.actionInFlight = null;
    }
  }

  async verifyProtection(token: string): Promise<AccountActionResult> {
    if (this.actionInFlight) {
      return actionResult(false, 'error', 'An account action is already in progress.');
    }
    if (!isValidAccountOtp(token)) {
      return actionResult(false, 'protection_pending', 'Enter the six-digit verification code.');
    }
    const pending = await this.getPendingProtection();
    if (!pending) {
      return actionResult(false, 'anonymous_ready', 'Request an email protection code first.');
    }
    this.actionInFlight = 'verify';

    try {
      const beforeAuth = await this.getAuthEvidence();
      if (beforeAuth.verifiedUserId !== pending.originalUserId) {
        return actionResult(
          false,
          beforeAuth.verifiedUserId ? 'owner_mismatch' : 'recovery_required',
          'The original anonymous session is no longer active. Sign back into the account that owns this backup.',
        );
      }

      // RETRYABLE_PRE_VERIFICATION_FAILURE: the OTP itself failed; the pending
      // record stays so the user can resend and retry.
      try {
        await this.dependencies.verifyEmailChangeOtp(pending.email, token.trim());
      } catch (error) {
        return actionResult(
          false,
          'protection_pending',
          safeActionErrorMessage(classifySupabaseAuthError(error)),
        );
      }

      const afterAuth = await this.getAuthEvidence();

      // TERMINAL: the identity changed. Supabase converted the session to a
      // different account, so the original protection intent is void; do not
      // leave a stale pending record masquerading as an unverified account.
      if (afterAuth.verifiedUserId !== pending.originalUserId) {
        await this.recordProtectionFailure(pending, 'uuid_changed');
        await this.clearPendingProtection();
        await this.signOutQuietly();
        return actionResult(
          false,
          'recovery_required',
          'The verified identity changed unexpectedly. Remote backup remains paused for safety.',
        );
      }

      // RETRYABLE: conversion has not taken effect yet (still anonymous).
      if (afterAuth.verifiedIsAnonymous !== false) {
        return actionResult(
          false,
          'protection_pending',
          'Email verification is not complete yet. Use the newest code and try again.',
        );
      }

      // Ownership invariants only — never row/outbox counts. The user may have
      // written more data and sync may have drained the outbox while the code
      // was in flight; that is legitimate activity, not corruption.
      const afterLocal = await this.inspect();
      if (
        afterLocal.ownerBinding !== pending.originalUserId ||
        afterLocal.outboxOwnerIds.some((ownerUserId) => ownerUserId !== pending.originalUserId)
      ) {
        await this.recordProtectionFailure(pending, 'local_foreign_owner');
        await this.clearPendingProtection();
        await this.signOutQuietly();
        return actionResult(
          false,
          'error',
          'Local backup ownership changed unexpectedly. Remote backup remains paused for safety.',
        );
      }

      // Remote evidence is ownership-only (defense-in-depth; RLS already scopes
      // rows to the caller). Counts may change freely.
      try {
        const afterRemoteFingerprint = await this.dependencies.getRemoteFingerprint(
          pending.originalUserId,
        );
        if (
          afterRemoteFingerprint.ownerIds.some(
            (ownerUserId) => ownerUserId !== pending.originalUserId,
          )
        ) {
          await this.recordProtectionFailure(pending, 'remote_foreign_owner');
          await this.clearPendingProtection();
          await this.signOutQuietly();
          return actionResult(
            false,
            'error',
            'Remote backup ownership changed unexpectedly. Remote backup remains paused for safety.',
          );
        }
      } catch {
        // Conversion has definitely succeeded; the ownership evidence could not
        // be certified. Fail closed and terminate the pending record so it can
        // never loop as stale after restart.
        await this.recordProtectionFailure(pending, 'remote_evidence_unavailable');
        await this.clearPendingProtection();
        await this.signOutQuietly();
        return actionResult(
          false,
          'recovery_required',
          'Backup was protected, but remote ownership could not be confirmed. Sign back in to resume remote backup.',
        );
      }

      // Protection makes the owner durable: a provisional anonymous binding
      // becomes permanent so the account can never be replaced later.
      try {
        const db = await this.getDatabase();
        await promoteLocalDatasetOwnerIfProvisional(db);
      } catch {
        // Promotion is best-effort; the permanent owner gate still holds via
        // the persisted binding and pristine checks.
      }
      await this.clearPendingProtection();
      return actionResult(
        true,
        'protected',
        'Backup protected. The same account can now be recovered elsewhere.',
      );
    } finally {
      this.actionInFlight = null;
    }
  }

  async resendProtection(): Promise<AccountActionResult> {
    const pending = await this.getPendingProtection();
    if (!pending)
      return actionResult(false, 'anonymous_ready', 'Request protection before resending a code.');
    const nextAllowedAt = Date.parse(pending.requestedAt) + RESEND_COOLDOWN_MS;
    if (this.dependencies.now().getTime() < nextAllowedAt) {
      return actionResult(
        false,
        'protection_pending',
        'Please wait before requesting another code.',
      );
    }
    try {
      await this.dependencies.resendEmailChange(pending.email);
    } catch (error) {
      return actionResult(
        false,
        'protection_pending',
        safeActionErrorMessage(classifySupabaseAuthError(error)),
      );
    }
    await this.savePendingProtection({
      ...pending,
      requestedAt: this.dependencies.now().toISOString(),
    });
    return actionResult(true, 'protection_pending', 'A new verification code was requested.');
  }

  async requestRecovery(email: string): Promise<AccountActionResult> {
    if (this.actionInFlight) {
      return actionResult(false, 'error', 'An account action is already in progress.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidAccountEmail(normalizedEmail)) {
      return actionResult(false, 'remote_unavailable', 'Enter a valid email address.');
    }
    this.actionInFlight = 'recover';

    try {
      const local = await this.inspect();
      // Only a PERMANENT binding supports owner sign-back-in. A provisional
      // binding is replaceable strictly while the device is pristine; once any
      // content exists the device is fail-closed against account switching
      // (promotion to permanent happens in the write paths / reconcile).
      const ownerRecovery = local.ownerBinding !== null && !local.ownerBindingProvisional;
      // Imported-owner recovery: the ONE populated-unbound exception. A
      // validated Portable Import V1 recorded the source-owner fingerprint on
      // this unclaimed dataset; the matching source account must have a legal
      // path to authenticate and bind it. This is NOT generic account
      // switching — eligibility is narrow and the fingerprint must match at
      // verification time.
      const importOriginFingerprint = await this.readPortableImportOriginFingerprint();
      const importedOwnerRecovery =
        isPortableOwnerFingerprint(importOriginFingerprint) &&
        this.isImportedOwnerRecoveryEligible(local);
      if (!ownerRecovery && !importedOwnerRecovery && !isEmptyForAccountReplacement(local)) {
        return actionResult(
          false,
          local.ownerBinding ? 'owner_mismatch' : 'account_conflict',
          'This device already contains local Super Habits data. Account switching and merging are not supported yet.',
        );
      }
      if (
        ownerRecovery &&
        local.outboxOwnerIds.some((ownerUserId) => ownerUserId !== local.ownerBinding)
      ) {
        return actionResult(
          false,
          'owner_mismatch',
          'This device has conflicting backup work. Sign back into its owning account after the conflict is resolved.',
        );
      }

      const auth = await this.getAuthEvidence();
      if (auth.sessionUserId && !auth.verifiedUserId) {
        return actionResult(
          false,
          'remote_unavailable',
          'The temporary session could not be verified. Try again when remote backup is available.',
        );
      }
      // Fresh recovery must not orphan remote rows of the current temporary
      // session; owner recovery skips this because the owner's own rows are
      // expected.
      if (auth.verifiedUserId && !ownerRecovery) {
        try {
          const fingerprint = await this.dependencies.getRemoteFingerprint(auth.verifiedUserId);
          if (Object.values(fingerprint.counts).some((count) => count > 0)) {
            return actionResult(
              false,
              'account_conflict',
              'This temporary device session already has remote backup data. Automatic account merging is not supported.',
            );
          }
        } catch (error) {
          return actionResult(
            false,
            'remote_unavailable',
            safeActionErrorMessage(classifySupabaseAuthError(error)),
          );
        }
      }

      try {
        await this.dependencies.requestExistingAccountRecovery(normalizedEmail);
      } catch (error) {
        return actionResult(
          false,
          'remote_unavailable',
          safeActionErrorMessage(classifySupabaseAuthError(error)),
        );
      }

      const pending: PendingRecovery = {
        email: normalizedEmail,
        requestedAt: this.dependencies.now().toISOString(),
        temporarySessionUserId: auth.sessionUserId,
        expectedOwnerUserId: ownerRecovery ? local.ownerBinding : null,
        expectedOwnerFingerprint: importedOwnerRecovery ? importOriginFingerprint : null,
      };
      await this.savePendingRecovery(pending);
      return actionResult(
        true,
        'sign_in_pending',
        'Check your email for the six-digit recovery code.',
      );
    } finally {
      this.actionInFlight = null;
    }
  }

  async verifyRecovery(token: string): Promise<AccountActionResult> {
    if (this.actionInFlight) {
      return actionResult(false, 'error', 'An account action is already in progress.');
    }
    if (!isValidAccountOtp(token)) {
      return actionResult(false, 'sign_in_pending', 'Enter the six-digit recovery code.');
    }
    const pending = await this.getPendingRecovery();
    if (!pending)
      return actionResult(false, 'remote_unavailable', 'Request recovery before entering a code.');
    this.actionInFlight = 'verify';

    try {
      const before = await this.inspect();
      const beforeIsUnsafe = pending.expectedOwnerUserId
        ? before.ownerBinding !== pending.expectedOwnerUserId
        : pending.expectedOwnerFingerprint
          ? !(
              this.isImportedOwnerRecoveryEligible(before) &&
              (await this.readPortableImportOriginFingerprint()) ===
                pending.expectedOwnerFingerprint
            )
          : !isEmptyForAccountReplacement(before);
      if (beforeIsUnsafe) {
        await this.signOutQuietly();
        return actionResult(
          false,
          pending.expectedOwnerUserId ? 'owner_mismatch' : 'account_conflict',
          pending.expectedOwnerUserId
            ? 'This device ownership changed while recovery was pending. Remote backup remains paused.'
            : 'This device now contains local data. Account switching and merging are not supported yet.',
        );
      }

      try {
        await this.dependencies.verifyExistingAccountOtp(pending.email, token.trim());
      } catch (error) {
        return actionResult(
          false,
          'sign_in_pending',
          safeActionErrorMessage(classifySupabaseAuthError(error)),
        );
      }

      const afterAuth = await this.getAuthEvidence();
      if (!afterAuth.verifiedUserId || afterAuth.verifiedIsAnonymous !== false) {
        await this.signOutQuietly();
        return actionResult(
          false,
          'sign_in_pending',
          'That code did not authenticate a recoverable account.',
        );
      }

      const after = await this.inspect();
      const afterIsUnsafe = pending.expectedOwnerUserId
        ? after.ownerBinding !== pending.expectedOwnerUserId ||
          after.outboxOwnerIds.some((ownerUserId) => ownerUserId !== pending.expectedOwnerUserId)
        : pending.expectedOwnerFingerprint
          ? !(
              this.isImportedOwnerRecoveryEligible(after) &&
              (await this.readPortableImportOriginFingerprint()) ===
                pending.expectedOwnerFingerprint
            )
          : !isEmptyForAccountReplacement(after);
      if (afterIsUnsafe) {
        await this.signOutQuietly();
        return actionResult(
          false,
          pending.expectedOwnerUserId ? 'owner_mismatch' : 'account_conflict',
          pending.expectedOwnerUserId
            ? 'This device ownership changed while recovery was pending. Remote backup remains paused.'
            : 'This device now contains local data. Account switching and merging are not supported yet.',
        );
      }

      if (pending.expectedOwnerUserId) {
        if (afterAuth.verifiedUserId !== pending.expectedOwnerUserId) {
          await this.signOutQuietly();
          return actionResult(
            false,
            'owner_mismatch',
            'That email belongs to a different account. Sign back into the account that owns this device.',
          );
        }
      } else if (pending.expectedOwnerFingerprint) {
        // Imported-owner recovery. The portable FILE is compatibility
        // metadata, never authentication: only a Supabase-VERIFIED account
        // whose UID hashes exactly to the recorded source fingerprint may
        // bind the populated imported dataset. Any other account is signed
        // out with local data, the binding, and the fingerprint untouched.
        if (
          portableOwnerFingerprint(afterAuth.verifiedUserId) !== pending.expectedOwnerFingerprint
        ) {
          await this.signOutQuietly();
          await this.clearPendingRecovery();
          return actionResult(
            false,
            'owner_mismatch',
            'That email belongs to a different account. This imported dataset can only be claimed by the account that created it.',
          );
        }
        const db = await this.getDatabase();
        try {
          await bindLocalDatasetOwner(db, afterAuth.verifiedUserId, {
            adoptUnownedOutbox: true,
          });
        } catch {
          await this.signOutQuietly();
          return actionResult(
            false,
            'account_conflict',
            'This device changed while recovery was completing. Remote backup remains paused for safety.',
          );
        }
      } else {
        const db = await this.getDatabase();
        try {
          // Fresh recovery on a pristine device: bind the recovered account
          // permanently, replacing a provisional temporary anonymous owner.
          if (after.ownerBinding === null) {
            await bindLocalDatasetOwner(db, afterAuth.verifiedUserId);
          } else {
            await replaceProvisionalLocalDatasetOwner(db, afterAuth.verifiedUserId);
          }
        } catch {
          await this.signOutQuietly();
          return actionResult(
            false,
            'account_conflict',
            'This device changed while recovery was completing. Remote backup remains paused for safety.',
          );
        }
      }
      try {
        await this.clearPendingRecovery();
      } catch {
        await this.signOutQuietly();
        return actionResult(
          false,
          'remote_unavailable',
          'Recovery completed remotely, but local account state could not be saved. Remote backup remains paused for safety.',
        );
      }
      if (pending.expectedOwnerFingerprint) {
        // The imported dataset is not cloud-complete yet: enqueue every
        // imported row for the matched owner so Backup V2 publishes a fresh
        // checkpoint only after a real remote upload. Best-effort — the next
        // maintenance cycle retries if this fails.
        try {
          await ensureBackupBackfill();
        } catch {
          // Backfill retries on the next maintenance cycle; local use is intact.
        }
      }
      return actionResult(
        true,
        'protected',
        'Account recovered. Your owner-scoped backup is ready to restore.',
      );
    } finally {
      this.actionInFlight = null;
    }
  }

  async resendRecovery(): Promise<AccountActionResult> {
    const pending = await this.getPendingRecovery();
    if (!pending)
      return actionResult(false, 'remote_unavailable', 'Request recovery before resending a code.');
    const nextAllowedAt = Date.parse(pending.requestedAt) + RESEND_COOLDOWN_MS;
    if (this.dependencies.now().getTime() < nextAllowedAt) {
      return actionResult(false, 'sign_in_pending', 'Please wait before requesting another code.');
    }
    try {
      await this.dependencies.resendExistingAccountRecovery(pending.email);
    } catch (error) {
      return actionResult(
        false,
        'sign_in_pending',
        safeActionErrorMessage(classifySupabaseAuthError(error)),
      );
    }
    await this.savePendingRecovery({
      ...pending,
      requestedAt: this.dependencies.now().toISOString(),
    });
    return actionResult(true, 'sign_in_pending', 'A new recovery code was requested.');
  }

  private async inspect(): Promise<LocalAccountDataState> {
    return inspectLocalAccountDataState(await this.getDatabase());
  }

  /**
   * Narrow imported-owner recovery eligibility. NOT generic populated-device
   * account switching: the dataset must be populated, locally UNBOUND, and
   * free of any other account's pending backup work. The validated Portable
   * Import V1 origin (the durable source fingerprint, checked by callers) is
   * what makes this a special recovery transition instead of an arbitrary
   * switch. Unowned outbox rows are allowed — they were created locally on
   * this unclaimed device and are adopted by the matched owner on bind.
   */
  private isImportedOwnerRecoveryEligible(local: LocalAccountDataState): boolean {
    return !local.ownerBinding && local.hasUserData && local.outboxOwnerIds.length === 0;
  }

  /**
   * Durable import-origin owner fingerprint written by Portable Import V1
   * (`portable.last_import_owner_fingerprint`; the literal string `null`
   * records a local-only source file). Compatibility metadata only — the
   * account coordinator uses it to fail closed against unrelated accounts.
   */
  private async readPortableImportOriginFingerprint(): Promise<string | null> {
    try {
      const value = await getAppMetaText(
        await this.getDatabase(),
        appMetaKeys.portableLastImportOwnerFingerprint,
      );
      return value && value !== 'null' ? value : null;
    } catch {
      return null;
    }
  }

  private async getDatabase() {
    return (this.dependencies.getDatabase ?? getDatabase)();
  }

  private async getAuthEvidence(): Promise<AccountAuthEvidence> {
    return this.dependencies.getAuthEvidence();
  }

  private async reconcile(local: LocalAccountDataState): Promise<AccountState> {
    const configured = this.dependencies.isConfigured();
    const remoteEnabled = this.dependencies.isRemoteEnabled();
    const auth = await this.getAuthEvidence();
    const decision = decideAccountState({
      configured,
      remoteEnabled,
      local,
      auth,
      importOriginOwnerFingerprint: await this.readPortableImportOriginFingerprint(),
    });

    if (decision.bindProvisionalUserId && !local.ownerBinding) {
      const db = await this.getDatabase();
      await bindProvisionalLocalDatasetOwner(db, decision.bindProvisionalUserId);
      local = await this.inspect();
    }

    if (decision.seedOwnerUserId && !local.ownerBinding) {
      const db = await this.getDatabase();
      await bindLocalDatasetOwner(db, decision.seedOwnerUserId);
      local = await this.inspect();
    }

    if (decision.bindCurrentUserId && !local.ownerBinding) {
      const db = await this.getDatabase();
      await bindLocalDatasetOwner(db, decision.bindCurrentUserId, { adoptUnownedOutbox: true });
      local = await this.inspect();
    }

    // Session loss on a pristine device: a fresh temporary anonymous session
    // safely replaces the old provisional owner (pristine implies no remote
    // rows under the old temporary UID). Permanent bindings are never touched.
    if (
      local.ownerBindingProvisional &&
      isEmptyForAccountReplacement(local) &&
      auth.verifiedUserId &&
      auth.verifiedUserId !== local.ownerBinding &&
      auth.verifiedIsAnonymous === true
    ) {
      const db = await this.getDatabase();
      await replaceProvisionalLocalDatasetOwner(db, auth.verifiedUserId, {
        keepProvisional: true,
      });
      local = await this.inspect();
    }

    let resolvedDecision = decideAccountState({
      configured,
      remoteEnabled,
      local,
      auth,
      importOriginOwnerFingerprint: await this.readPortableImportOriginFingerprint(),
    });

    // Safety net: any committed content promotes a provisional binding to
    // permanent (the write-path hooks normally do this synchronously).
    if (
      local.ownerBindingProvisional &&
      (local.hasUserData || local.pendingOutboxCount > 0 || local.outboxOwnerIds.length > 0)
    ) {
      const db = await this.getDatabase();
      await promoteLocalDatasetOwnerIfProvisional(db);
      local = await this.inspect();
      resolvedDecision = decideAccountState({
        configured,
        remoteEnabled,
        local,
        auth,
        importOriginOwnerFingerprint: await this.readPortableImportOriginFingerprint(),
      });
    }

    if (
      local.ownerBinding &&
      auth.verifiedUserId === local.ownerBinding &&
      local.unownedOutboxCount > 0
    ) {
      const db = await this.getDatabase();
      await adoptUnownedOutboxRows(db, local.ownerBinding);
      local = await this.inspect();
      resolvedDecision = decideAccountState({
        configured,
        remoteEnabled,
        local,
        auth,
        importOriginOwnerFingerprint: await this.readPortableImportOriginFingerprint(),
      });
    }
    const protection = await this.getPendingProtection();
    const recovery = await this.getPendingRecovery();

    // A pending protection belongs to one original user only. If a different
    // user is verified, the record is stale and must not linger indefinitely.
    if (protection && auth.verifiedUserId && protection.originalUserId !== auth.verifiedUserId) {
      await this.clearPendingProtection();
    }
    // A fresh-recovery record dies once the device is no longer replaceable.
    // An imported-owner record (fingerprint-based) dies when its narrow
    // eligibility drifts (bound, other owner's outbox work, or the recorded
    // source fingerprint changed). Owner records are governed by the binding.
    if (
      recovery &&
      !recovery.expectedOwnerUserId &&
      !recovery.expectedOwnerFingerprint &&
      !isEmptyForAccountReplacement(local)
    ) {
      await this.clearPendingRecovery();
    }
    if (
      recovery &&
      recovery.expectedOwnerFingerprint &&
      !(
        this.isImportedOwnerRecoveryEligible(local) &&
        (await this.readPortableImportOriginFingerprint()) === recovery.expectedOwnerFingerprint
      )
    ) {
      await this.clearPendingRecovery();
    }

    let status = resolvedDecision.status;
    let message = resolvedDecision.message;
    let email = auth.verifiedEmail;
    if (protection && auth.verifiedUserId === protection.originalUserId) {
      status = 'protection_pending';
      email = protection.email;
      message = 'Email verification is pending. Enter the code sent to protect this backup.';
    } else if (
      recovery &&
      ((recovery.expectedOwnerUserId && recovery.expectedOwnerUserId === local.ownerBinding) ||
        (recovery.expectedOwnerFingerprint &&
          this.isImportedOwnerRecoveryEligible(local) &&
          (await this.readPortableImportOriginFingerprint()) ===
            recovery.expectedOwnerFingerprint) ||
        (!recovery.expectedOwnerUserId &&
          !recovery.expectedOwnerFingerprint &&
          isEmptyForAccountReplacement(local)))
    ) {
      status = 'sign_in_pending';
      email = recovery.email;
      message = 'Recovery verification is pending. Enter the code sent to recover this backup.';
    }

    const pending = protection ?? recovery;
    const resendAvailableAt = pending ? Date.parse(pending.requestedAt) + RESEND_COOLDOWN_MS : null;
    return {
      status,
      email,
      isAnonymous: auth.verifiedIsAnonymous,
      hasOwnerBinding: local.ownerBinding !== null,
      hasUserData: local.hasUserData,
      pendingOutboxCount: local.pendingOutboxCount,
      canProtect: resolvedDecision.canProtect && status !== 'protection_pending',
      canRecoverExisting: resolvedDecision.canRecoverExisting && status !== 'sign_in_pending',
      canRecoverOwner: resolvedDecision.canRecoverOwner && status !== 'sign_in_pending',
      canRecoverImportedOwner:
        resolvedDecision.canRecoverImportedOwner && status !== 'sign_in_pending',
      message,
      resendAvailableAt,
    };
  }

  private async getPendingProtection(): Promise<PendingProtection | null> {
    try {
      const value = await getAppMetaJson<PendingProtection>(
        await this.getDatabase(),
        appMetaKeys.accountProtectionPending,
      );
      return isPendingProtection(value) ? value : null;
    } catch {
      return null;
    }
  }

  private async savePendingProtection(value: PendingProtection): Promise<void> {
    await setAppMetaJson(await this.getDatabase(), appMetaKeys.accountProtectionPending, value);
  }

  private async clearPendingProtection(): Promise<void> {
    await setAppMetaJson(await this.getDatabase(), appMetaKeys.accountProtectionPending, null);
  }

  /** Durable diagnostic for post-verification terminal failures; never used as
   * a state-machine input, so it cannot create a stale pending loop. */
  private async recordProtectionFailure(pending: PendingProtection, reason: string): Promise<void> {
    try {
      await setAppMetaJson(await this.getDatabase(), appMetaKeys.accountProtectionLastFailure, {
        originalUserId: pending.originalUserId,
        email: pending.email,
        reason,
        at: this.dependencies.now().toISOString(),
      });
    } catch {
      // Diagnostics are best-effort; the cleared pending record is the
      // authoritative state change.
    }
  }

  private async getPendingRecovery(): Promise<PendingRecovery | null> {
    try {
      const value = await getAppMetaJson<PendingRecovery>(
        await this.getDatabase(),
        appMetaKeys.accountRecoveryPending,
      );
      return isPendingRecovery(value) ? value : null;
    } catch {
      return null;
    }
  }

  private async savePendingRecovery(value: PendingRecovery): Promise<void> {
    await setAppMetaJson(await this.getDatabase(), appMetaKeys.accountRecoveryPending, value);
  }

  private async clearPendingRecovery(): Promise<void> {
    await setAppMetaJson(await this.getDatabase(), appMetaKeys.accountRecoveryPending, null);
  }

  private async signOutQuietly(): Promise<void> {
    try {
      await this.dependencies.signOut();
    } catch {
      // The state remains fail-closed even if clearing the remote session fails.
    }
  }
}

export const accountCoordinator = new AccountCoordinator();
