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
  /**
   * Consecutive PERSISTENT failures of the SAME class. This — not `attempts` — is
   * what earns the terminal state (`AUD-SH03-A`).
   *
   * The audited defect: `attempts` counted every failure, so four transient
   * outages followed by one missing-table error reached the bound of five and
   * reported "missing_remote_table on 5 consecutive attempts". A persistent
   * verdict must be earned by evidence about that persistent condition; a
   * flapping network must never contribute to it.
   *
   * Reset rules: any transient failure resets it to 0, and a switch between two
   * persistent classes restarts it at 1 (a different persistent condition has not
   * yet been observed repeatedly).
   */
  persistentStreak: number;
  /**
   * Present when this entry was a pre-fix terminal verdict that the accounting
   * repair converted back into a bounded re-probe (`AUD-SH03-C`). Retains the
   * ORIGINAL diagnosis so a still-broken record re-blocks with its real reason.
   */
  reprobedFrom?: OutboxBlockedState & { reprobedAt: string; budget: number };
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

/**
 * Consecutive PERSISTENT-failure retries a record gets after it was blocked by
 * the pre-fix accounting (`AUD-SH03-C`).
 *
 * Rows falsely blocked by the old streak bug still carry `blocked` in the
 * durable ledger. Left alone they would never push again even though their
 * condition may have healed. The repair is bounded and visible: the block is
 * converted into one final re-probe budget, and only for classes the accounting
 * fix could have misjudged. A record that fails the re-probe returns to the
 * terminal state with its ORIGINAL diagnosis preserved, so a genuinely poisoned
 * record cannot loop.
 */
export const OUTBOX_BLOCKED_REPROBE_BUDGET = 2;

/**
 * Persistent classes whose pre-fix verdict could have been caused by the
 * accounting bug (transient noise counted toward the bound). `missing_local_row`
 * is excluded deliberately: it is a positive statement about local data, not a
 * streak, so the streak bug could not have manufactured it.
 */
export const OUTBOX_REPROBABLE_CLASSES: readonly OutboxPersistentFailureClass[] = [
  'missing_remote_table',
  'missing_remote_column',
  'permanently_rejected',
];

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
  // AUD-SH03: the production adapter's ACTUAL wording. `upsertEntityRows`
  // throws `Missing local rows for <entity>: <ids>` when a queued record no
  // longer has a row (a hard-deleted entity between enqueue and push). That
  // message matched none of the patterns above, so it was classified
  // transient and retried forever — the opposite of the intended terminal
  // classification. A contract this specific must be tested against the real
  // producer string, not a paraphrase.
  /missing local rows? for/i,
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
  const base = {
    attempts,
    firstFailureAt: previous?.firstFailureAt ?? nowIso,
    lastFailureAt: nowIso,
    lastClass: failureClass,
    // A transient failure never blocks and never inherits a blocked verdict
    // from a previous streak: the streak is reset so a later persistent
    // failure must earn its own bound.
    blocked: previous?.blocked ?? null,
    // The bounded re-probe budget must survive every retry of the re-probe, or
    // the record would fall back to the full bound after one attempt.
    reprobedFrom: previous?.reprobedFrom,
  };

  if (!isPersistentOutboxFailure(failureClass)) {
    // `AUD-SH03-A`: a transient outage breaks the persistent streak. The legacy
    // `attempts` counter keeps its old meaning (consecutive non-transient
    // failures since the last transient) for diagnostics only.
    return {
      entry: {
        ...base,
        attempts: previous?.lastClass === 'transient' ? attempts : 1,
        persistentStreak: 0,
      },
      blockedNow: false,
    };
  }

  if (previous?.blocked) {
    // Already terminal: stay terminal, and do not keep counting.
    return { entry: previous, blockedNow: false };
  }

  // `AUD-SH03-A`: only the same persistent class observed `bound` times in a row
  // is terminal evidence. Switching class restarts the streak at 1.
  const persistentStreak =
    previous && previous.lastClass === failureClass && (previous.persistentStreak ?? 0) > 0
      ? (previous.persistentStreak ?? 0) + 1
      : 1;

  // `AUD-SH03-C`: a repaired pre-fix verdict gets the small re-probe budget
  // instead of the full bound, so a still-poisoned record re-blocks quickly
  // and the repair cannot become an unbounded retry loop. The original
  // diagnosis from `reprobedFrom` is reused as the reason.
  const effectiveBound = previous?.reprobedFrom
    ? Math.min(bound, Math.max(1, previous.reprobedFrom.budget))
    : bound;

  if (persistentStreak >= effectiveBound) {
    return {
      entry: {
        ...base,
        persistentStreak,
        blocked: {
          class: failureClass,
          // Keep the original pre-fix diagnosis visible when this verdict came
          // from a repaired entry, so a reviewer can tell "it really is still
          // broken" from a fresh classification.
          reason: previous?.reprobedFrom
            ? `${failureClass} on ${persistentStreak} consecutive persistent attempt(s) after a bounded re-probe of the pre-fix block (${previous.reprobedFrom.reason})`
            : `${failureClass} on ${persistentStreak} consecutive persistent attempts`,
          at: nowIso,
        },
      },
      blockedNow: true,
    };
  }
  return { entry: { ...base, persistentStreak }, blockedNow: false };
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

/**
 * Repair a durable ledger written by the pre-fix accounting (`AUD-SH03-C`).
 *
 * Old ledgers can contain records that were blocked only because transient
 * failures were counted toward a persistent-failure bound. This converts those
 * verdicts into a bounded re-probe budget instead of silently dropping them or
 * retrying a poison record forever:
 *
 *   - only classes the streak bug could have produced are reconsidered,
 *   - the record gets `OUTBOX_BLOCKED_REPROBE_BUDGET` more attempts,
 *   - its original diagnosis is retained in `blocked`,
 *   - `reprobedFrom` records that this entry was repaired, so the repair runs
 *     once per entry rather than on every hydrate.
 *
 * Pure: the caller supplies the clock, so the policy is testable without timers.
 *
 * @param ledger the hydrated ledger
 * @param nowIso timestamp for the repair
 * @returns the repaired ledger plus the keys that are now re-probeable
 */
export function repairLegacyBlockedEntries(
  ledger: OutboxAttemptLedger,
  nowIso: string,
): { ledger: OutboxAttemptLedger; reprobedKeys: string[] } {
  const reprobedKeys: string[] = [];
  const next: OutboxAttemptLedger = { ...ledger };
  for (const [key, entry] of Object.entries(ledger)) {
    const blocked = entry.blocked;
    if (!blocked) continue;
    if (entry.reprobedFrom) continue;
    if (!OUTBOX_REPROBABLE_CLASSES.includes(blocked.class)) continue;
    reprobedKeys.push(key);
    next[key] = {
      ...entry,
      // Keep the diagnosis visible, but let the record try again a bounded
      // number of times. `persistentStreak` restarts from zero so a healed
      // backend clears it, and a still-broken one re-earns the terminal state.
      blocked: null,
      persistentStreak: 0,
      lastFailureAt: nowIso,
      reprobedFrom: { ...blocked, reprobedAt: nowIso, budget: OUTBOX_BLOCKED_REPROBE_BUDGET },
    };
  }
  return { ledger: next, reprobedKeys: reprobedKeys.sort() };
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
