import type { SyncRecord } from '@/core/sync/sync.engine';

/**
 * Durable terminal-failure classification for outbox records
 * (`harden-silent-failure-certification`, wave 2).
 *
 * THE DEFECT: a record whose push can never succeed (a remote table that does
 * not exist, a column the remote lacks, a row the remote permanently rejects, a
 * local row that no longer exists) is requeued on the same backoff schedule
 * forever. It never drains, so the backup completeness checkpoint — which
 * requires a fully empty durable outbox — is frozen permanently, and the
 * user's backup state is indistinguishable from "still uploading".
 *
 * THE FIX: a bounded, DURABLE attempt counter plus one terminal state. The
 * counter counts attempts, never elapsed time, so a slow-but-working backend is
 * never classified as broken; and only the distinguishable persistent classes
 * can reach the terminal state, so a transient outage keeps retrying exactly as
 * it does today.
 *
 * Storage is the `app_meta` JSON ledger rather than a new table or column: the
 * ledger is local operational state that is never backed up, and this change
 * deliberately earns no schema migration (local schema stays 25).
 */

/** Why a push can never succeed for this record, as opposed to "not right now". */
export type OutboxPersistentFailureClass =
  /** The remote table for this entity does not exist (pre-migration server). */
  | 'missing_remote_table'
  /** The remote table exists but lacks a column the projection writes. */
  | 'missing_remote_column'
  /** The remote permanently refused the row (RLS/policy/constraint rejection). */
  | 'permanently_rejected'
  /** The local row this record describes no longer exists. */
  | 'missing_local_row';

/** Every failure class the classifier recognizes, transient included. */
export type OutboxFailureClass = OutboxPersistentFailureClass | 'transient';

export type OutboxBlockedState = {
  class: OutboxPersistentFailureClass;
  reason: string;
  at: string;
};

export type OutboxAttemptEntry = {
  attempts: number;
  firstFailureAt: string;
  lastFailureAt: string;
  lastClass: OutboxFailureClass;
  /** Set once the record reaches the terminal state; never cleared by retries. */
  blocked: OutboxBlockedState | null;
};

export type OutboxAttemptLedger = Record<string, OutboxAttemptEntry>;

/**
 * Attempts before a persistent-failure streak becomes terminal.
 *
 * An implementation constant, not a spec decision (design Open Questions): high
 * enough that a flapping network or a deploy rolling out cannot reach it with
 * only transient noise, low enough that a genuinely broken entity is diagnosed
 * in minutes rather than days.
 */
export const OUTBOX_BLOCK_ATTEMPT_BOUND = 5;

/** Stable key for a record, matching the engine's own dedupe key. */
export function outboxAttemptKey(record: Pick<SyncRecord, 'entity' | 'id'>): string {
  return `${record.entity}:${record.id}`;
}

const MISSING_TABLE_PATTERNS = [
  /PGRST205/i,
  /relation .* does not exist/i,
  /table .* does not exist/i,
  /42P01/,
];

const MISSING_COLUMN_PATTERNS = [/PGRST204/i, /column .* does not exist/i, /42703/];

/** 4xx classes that mean "this row will never be accepted", not "retry later". */
const PERMANENT_REJECTION_PATTERNS = [
  /row-level security/i,
  /violates row-level security policy/i,
  /new row violates row-level security/i,
  /duplicate key value violates unique constraint/i,
  /23505/,
  /23503/,
  /check constraint/i,
  /23514/,
  /not-null constraint/i,
  /23502/,
];

const LOCAL_ROW_PATTERNS = [
  /no such table/i,
  /no such column/i,
  /SQLITE_ERROR: no such/i,
  /local row .* does not exist/i,
];

/**
 * Classify a push failure.
 *
 * ONLY the four classes above may ever become terminal. Everything else —
 * timeouts, DNS, offline, 429, 5xx, an empty message — is `transient` and keeps
 * the existing backoff forever, because a future attempt may still succeed.
 * An EMPTY or unrecognized message is transient by construction: it is
 * indistinguishable from a swallowed proxy response, and the same rule that
 * stopped an empty manifest error from becoming a legacy classification applies
 * to a poisoned-record claim.
 *
 * @param error the thrown value
 */
export function classifyOutboxFailure(error: unknown): OutboxFailureClass {
  // A thrown object that is neither an Error nor a string is stringified
  // defensively rather than via `String(error)`, which would yield
  // "[object Object]" and read as an unrecognized message.
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const text = raw.trim();
  if (text.length === 0) return 'transient';
  if (LOCAL_ROW_PATTERNS.some((pattern) => pattern.test(text))) return 'missing_local_row';
  if (MISSING_COLUMN_PATTERNS.some((pattern) => pattern.test(text))) return 'missing_remote_column';
  if (MISSING_TABLE_PATTERNS.some((pattern) => pattern.test(text))) return 'missing_remote_table';
  if (PERMANENT_REJECTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'permanently_rejected';
  }
  return 'transient';
}

/** True when a class is one that can reach the terminal state. */
export function isPersistentOutboxFailure(
  value: OutboxFailureClass,
): value is OutboxPersistentFailureClass {
  return value !== 'transient';
}

/**
 * The next ledger entry for one record after a failure, and whether this
 * failure is the one that blocks it.
 *
 * Pure: the caller supplies the clock, so the bound is testable without timers.
 *
 * @param previous existing entry, if any
 * @param failureClass result of `classifyOutboxFailure`
 * @param nowIso timestamp for this attempt
 * @param bound attempts before the terminal state (defaults to the constant)
 */
export function nextAttemptEntry(
  previous: OutboxAttemptEntry | undefined,
  failureClass: OutboxFailureClass,
  nowIso: string,
  bound: number = OUTBOX_BLOCK_ATTEMPT_BOUND,
): { entry: OutboxAttemptEntry; blockedNow: boolean } {
  const attempts = (previous?.attempts ?? 0) + 1;
  const entry: OutboxAttemptEntry = {
    attempts,
    firstFailureAt: previous?.firstFailureAt ?? nowIso,
    lastFailureAt: nowIso,
    lastClass: failureClass,
    // A transient failure never blocks and never inherits a blocked verdict
    // from a previous streak: the streak is reset so a later persistent
    // failure must earn its own bound.
    blocked: previous?.blocked ?? null,
  };
  if (!isPersistentOutboxFailure(failureClass)) {
    return {
      entry: { ...entry, attempts: previous?.lastClass === 'transient' ? attempts : 1 },
      blockedNow: false,
    };
  }
  if (previous?.blocked) {
    // Already terminal: stay terminal, and do not keep counting.
    return { entry: previous, blockedNow: false };
  }
  if (attempts >= bound) {
    return {
      entry: {
        ...entry,
        blocked: {
          class: failureClass,
          reason: `${failureClass} on ${attempts} consecutive attempts`,
          at: nowIso,
        },
      },
      blockedNow: true,
    };
  }
  return { entry, blockedNow: false };
}

/**
 * Apply a failure to a ledger, returning the new ledger plus the keys that
 * became blocked in this call.
 *
 * @param ledger current ledger
 * @param record the record that failed
 * @param failureClass classification
 * @param nowIso timestamp
 * @param bound attempts before the terminal state
 */
export function applyOutboxFailure(
  ledger: OutboxAttemptLedger,
  record: Pick<SyncRecord, 'entity' | 'id'>,
  failureClass: OutboxFailureClass,
  nowIso: string,
  bound: number = OUTBOX_BLOCK_ATTEMPT_BOUND,
): { ledger: OutboxAttemptLedger; blockedKeys: string[]; blockedNow: boolean } {
  const key = outboxAttemptKey(record);
  const { entry, blockedNow } = nextAttemptEntry(ledger[key], failureClass, nowIso, bound);
  return {
    ledger: { ...ledger, [key]: entry },
    blockedKeys: entry.blocked ? [key] : [],
    blockedNow,
  };
}

/**
 * Clear a record's entry after a successful push, so a later failure streak
 * starts from zero rather than inheriting old attempts.
 *
 * @param ledger current ledger
 * @param record the record that succeeded
 */
export function clearOutboxAttempt(
  ledger: OutboxAttemptLedger,
  record: Pick<SyncRecord, 'entity' | 'id'>,
): OutboxAttemptLedger {
  const key = outboxAttemptKey(record);
  if (!(key in ledger)) return ledger;
  const next = { ...ledger };
  delete next[key];
  return next;
}

/** Keys currently in the terminal state. */
export function blockedOutboxKeys(ledger: OutboxAttemptLedger): string[] {
  return Object.entries(ledger)
    .filter(([, entry]) => entry.blocked !== null)
    .map(([key]) => key)
    .sort();
}

/** The blocked diagnosis for one record, or null. */
export function outboxBlockedState(
  ledger: OutboxAttemptLedger,
  record: Pick<SyncRecord, 'entity' | 'id'>,
): OutboxBlockedState | null {
  return ledger[outboxAttemptKey(record)]?.blocked ?? null;
}

/**
 * Human-readable diagnosis for the blocked outbox, for the backup state copy.
 * Names the entity and the reason so a user-facing "your backup is blocked"
 * is actionable rather than mysterious.
 *
 * @param ledger current ledger
 */
export function describeBlockedOutbox(ledger: OutboxAttemptLedger): {
  entity: string;
  id: string;
  class: OutboxPersistentFailureClass;
  reason: string;
  at: string;
}[] {
  return Object.entries(ledger)
    .filter(([, entry]) => entry.blocked !== null)
    .map(([key, entry]) => {
      const [entity, ...idParts] = key.split(':');
      return {
        entity: entity ?? key,
        id: idParts.join(':'),
        class: entry.blocked?.class ?? 'permanently_rejected',
        reason: entry.blocked?.reason ?? 'unknown',
        at: entry.blocked?.at ?? entry.lastFailureAt,
      };
    })
    .sort((a, b) => a.entity.localeCompare(b.entity) || a.id.localeCompare(b.id));
}
