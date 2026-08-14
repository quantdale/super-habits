import type {
  AccountAuthEvidence,
  AccountStatus,
  LocalAccountDataState,
} from '@/core/auth/account.types';

export type AccountDecisionInput = {
  configured: boolean;
  remoteEnabled: boolean;
  local: LocalAccountDataState;
  auth: AccountAuthEvidence;
};

export type AccountDecision = {
  status: AccountStatus;
  bindCurrentUserId: string | null;
  seedOwnerUserId: string | null;
  shouldCreateAnonymous: boolean;
  canRecoverExisting: boolean;
  canRecoverOwner: boolean;
  canProtect: boolean;
  message: string;
};

const hasLocalContent = (local: LocalAccountDataState): boolean =>
  local.hasUserData || local.pendingOutboxCount > 0 || local.ownerBinding !== null;

export function decideAccountState(input: AccountDecisionInput): AccountDecision {
  const { configured, remoteEnabled, local, auth } = input;
  const canRecoverExisting =
    !local.hasUserData &&
    local.pendingOutboxCount === 0 &&
    local.ownerBinding === null &&
    local.outboxOwnerIds.length === 0;
  const canRecoverOwner =
    local.ownerBinding !== null &&
    local.outboxOwnerIds.every((ownerUserId) => ownerUserId === local.ownerBinding) &&
    auth.verifiedUserId !== local.ownerBinding;

  if (!configured) {
    return {
      status: 'not_configured',
      bindCurrentUserId: null,
      seedOwnerUserId: null,
      shouldCreateAnonymous: false,
      canRecoverExisting: false,
      canRecoverOwner: false,
      canProtect: false,
      message: 'Remote backup is not configured. Super Habits remains local-only.',
    };
  }

  if (!remoteEnabled) {
    return {
      status: 'remote_disabled',
      bindCurrentUserId: null,
      seedOwnerUserId: null,
      shouldCreateAnonymous: false,
      canRecoverExisting: false,
      canRecoverOwner: false,
      canProtect: false,
      message: 'Remote backup is disabled. Local Super Habits data remains available.',
    };
  }

  if (local.outboxOwnerIds.length > 1) {
    return {
      status: 'account_conflict',
      bindCurrentUserId: null,
      seedOwnerUserId: null,
      shouldCreateAnonymous: false,
      canRecoverExisting: false,
      canRecoverOwner: false,
      canProtect: false,
      message: 'Backup ownership is conflicting, so remote work is paused until it is recovered.',
    };
  }

  if (
    local.ownerBinding &&
    local.outboxOwnerIds.some((ownerUserId) => ownerUserId !== local.ownerBinding)
  ) {
    return {
      status: 'owner_mismatch',
      bindCurrentUserId: null,
      seedOwnerUserId: null,
      shouldCreateAnonymous: false,
      canRecoverExisting: false,
      canRecoverOwner: false,
      canProtect: false,
      message:
        'This device has pending backup work for another account. Sign back into the account that owns it.',
    };
  }

  if (local.ownerBinding) {
    if (!auth.verifiedUserId) {
      return {
        status: 'recovery_required',
        bindCurrentUserId: null,
        seedOwnerUserId: null,
        shouldCreateAnonymous: false,
        canRecoverExisting: false,
        canRecoverOwner: canRecoverOwner,
        canProtect: false,
        message:
          'This device has local data for a previous backup account. Sign in to that account to resume backup.',
      };
    }

    if (auth.verifiedUserId !== local.ownerBinding) {
      return {
        status: 'owner_mismatch',
        bindCurrentUserId: null,
        seedOwnerUserId: null,
        shouldCreateAnonymous: false,
        canRecoverExisting: false,
        canRecoverOwner: canRecoverOwner,
        canProtect: false,
        message:
          'This device belongs to another backup account. Sign back into the account that owns its backup.',
      };
    }

    const anonymous = auth.verifiedIsAnonymous === true;
    return {
      status: anonymous ? 'anonymous_ready' : 'protected',
      bindCurrentUserId: null,
      seedOwnerUserId: null,
      shouldCreateAnonymous: false,
      canRecoverExisting: false,
      canRecoverOwner: false,
      canProtect: anonymous,
      message: anonymous
        ? 'Your backup is anonymous. Protect it with a verified email to recover it elsewhere.'
        : 'Your backup is protected and ready to recover on another device.',
    };
  }

  if (local.outboxOwnerIds.length === 1 && !auth.verifiedUserId) {
    return {
      status: 'recovery_required',
      bindCurrentUserId: null,
      seedOwnerUserId: local.outboxOwnerIds[0],
      shouldCreateAnonymous: false,
      canRecoverExisting: false,
      canRecoverOwner: canRecoverOwner,
      canProtect: false,
      message:
        'Pending backup work identifies a previous account. Sign in to recover remote backup.',
    };
  }

  if (local.outboxOwnerIds.length === 1 && auth.verifiedUserId !== local.outboxOwnerIds[0]) {
    return {
      status: 'owner_mismatch',
      bindCurrentUserId: null,
      seedOwnerUserId: null,
      shouldCreateAnonymous: false,
      canRecoverExisting: false,
      canRecoverOwner: false,
      canProtect: false,
      message:
        'This device has pending backup work for another account. Sign back into that account.',
    };
  }

  if (!local.ownerBinding && local.unownedOutboxCount > 0) {
    if (
      auth.verifiedUserId &&
      local.outboxOwnerIds.every((ownerUserId) => ownerUserId === auth.verifiedUserId)
    ) {
      return {
        status: auth.verifiedIsAnonymous === true ? 'anonymous_ready' : 'protected',
        bindCurrentUserId: auth.verifiedUserId,
        seedOwnerUserId: null,
        shouldCreateAnonymous: false,
        canRecoverExisting: false,
        canRecoverOwner: false,
        canProtect: auth.verifiedIsAnonymous === true,
        message:
          auth.verifiedIsAnonymous === true
            ? 'Your backup is anonymous. Protect it with a verified email to recover it elsewhere.'
            : 'Your backup is protected and ready to recover on another device.',
      };
    }
    return {
      status: 'legacy_owner_unknown',
      bindCurrentUserId: null,
      seedOwnerUserId: null,
      shouldCreateAnonymous: false,
      canRecoverExisting: false,
      canRecoverOwner: false,
      canProtect: false,
      message:
        'Pending local backup work has no owner evidence. Remote backup is paused until the original account is identified.',
    };
  }

  if (auth.verifiedUserId) {
    const shouldBindLegacy = hasLocalContent(local);
    return {
      status: auth.verifiedIsAnonymous === true ? 'anonymous_ready' : 'protected',
      bindCurrentUserId: shouldBindLegacy ? auth.verifiedUserId : null,
      seedOwnerUserId: null,
      shouldCreateAnonymous: false,
      canRecoverExisting: canRecoverExisting && auth.sessionIsAnonymous === true,
      canRecoverOwner: false,
      canProtect: auth.verifiedIsAnonymous === true,
      message:
        auth.verifiedIsAnonymous === true
          ? 'Your backup is anonymous. Protect it with a verified email to recover it elsewhere.'
          : 'Your backup is protected and ready to recover on another device.',
    };
  }

  if (hasLocalContent(local)) {
    return {
      status: local.hasUserData ? 'legacy_owner_unknown' : 'recovery_required',
      bindCurrentUserId: null,
      seedOwnerUserId: null,
      shouldCreateAnonymous: false,
      canRecoverExisting: false,
      canRecoverOwner: false,
      canProtect: false,
      message: local.hasUserData
        ? 'This local dataset has no recoverable owner evidence. Remote backup is paused.'
        : 'Pending backup work needs the account that created it before remote backup can resume.',
    };
  }

  return {
    status: 'remote_unavailable',
    bindCurrentUserId: null,
    seedOwnerUserId: null,
    shouldCreateAnonymous: auth.sessionUserId === null,
    canRecoverExisting: canRecoverExisting,
    canRecoverOwner: false,
    canProtect: false,
    message: 'Remote backup is ready when you choose anonymous use or recover an existing account.',
  };
}

export function isValidAccountEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidAccountOtp(token: string): boolean {
  return /^\d{6}$/.test(token.trim());
}

export function sameOwnerIds(left: string[], right: string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function sameRemoteFingerprint(
  left: { counts: Record<string, number>; ownerIds: string[] },
  right: { counts: Record<string, number>; ownerIds: string[] },
): boolean {
  const leftKeys = Object.keys(left.counts).sort();
  const rightKeys = Object.keys(right.counts).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index]) &&
    leftKeys.every((key) => left.counts[key] === right.counts[key]) &&
    sameOwnerIds(left.ownerIds, right.ownerIds)
  );
}
