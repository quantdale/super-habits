import { describe, expect, it } from 'vitest';
import {
  applyOutboxFailure,
  blockedOutboxKeys,
  classifyOutboxFailure,
  clearOutboxAttempt,
  describeBlockedOutbox,
  isPersistentOutboxFailure,
  nextAttemptEntry,
  OUTBOX_BLOCK_ATTEMPT_BOUND,
  outboxAttemptKey,
  type OutboxAttemptLedger,
  type OutboxFailureClass,
} from '@/core/sync/outboxAttempts';
import type { SyncRecord } from '@/core/sync/sync.engine';

/**
 * Terminal outbox classification (`harden-silent-failure-certification` 2.1-2.5).
 *
 * The rule under test: a record whose push can NEVER succeed reaches a visible
 * terminal state, and a record that merely cannot push RIGHT NOW never does.
 * Every test therefore pairs a persistent class with the transient control that
 * must not block, because a bound that also fires on a flaky network would
 * convert a coverage decision into a data-loss decision.
 */
const record: Pick<SyncRecord, 'entity' | 'id'> = { entity: 'todos', id: 'todo_1' };
const other: Pick<SyncRecord, 'entity' | 'id'> = { entity: 'habits', id: 'habit_1' };

const PERSISTENT_MESSAGES: Record<string, string> = {
  missing_remote_table: 'HTTP 404: relation "public.todos" does not exist (PGRST205)',
  missing_remote_column: 'column todos.some_column does not exist (PGRST204)',
  permanently_rejected: 'new row violates row-level security policy for table "todos"',
  missing_local_row: 'SQLITE_ERROR: no such table: todos',
};

const TRANSIENT_MESSAGES = [
  'Failed to fetch',
  'Network request failed',
  'Request timed out after 30000ms',
  'HTTP 503 Service Unavailable',
  'HTTP 429 Too Many Requests',
  'rate limit exceeded',
  '',
  '   ',
  '[object Object]',
];

describe('outbox failure classification', () => {
  it('recognizes each distinguishable persistent class', () => {
    for (const [expected, message] of Object.entries(PERSISTENT_MESSAGES)) {
      expect(classifyOutboxFailure(new Error(message)), message).toBe(expected);
    }
  });

  it('treats every transient message as transient, including an empty one', () => {
    for (const message of TRANSIENT_MESSAGES) {
      expect(classifyOutboxFailure(new Error(message)), JSON.stringify(message)).toBe('transient');
    }
    // A thrown non-Error, non-string must not stringify to something that
    // accidentally matches a persistent pattern.
    expect(classifyOutboxFailure({ relation: 'public.todos does not exist' })).toBe('transient');
    expect(classifyOutboxFailure(null)).toBe('transient');
    expect(classifyOutboxFailure(undefined)).toBe('transient');
  });

  it('keeps the persistent set distinguishable from transient', () => {
    expect(isPersistentOutboxFailure('transient')).toBe(false);
    for (const key of Object.keys(PERSISTENT_MESSAGES) as OutboxFailureClass[]) {
      expect(isPersistentOutboxFailure(key), key).toBe(true);
    }
  });
});

describe('outbox attempt ledger is bounded and durable in shape', () => {
  it('never blocks before the bound and blocks exactly at it', () => {
    const now = '2026-09-30T00:00:00.000Z';
    let ledger: OutboxAttemptLedger = {};
    const classes = Object.keys(PERSISTENT_MESSAGES) as OutboxFailureClass[];

    for (let attempt = 1; attempt < OUTBOX_BLOCK_ATTEMPT_BOUND; attempt += 1) {
      const applied = applyOutboxFailure(ledger, record, classes[0], now);
      ledger = applied.ledger;
      expect(applied.blockedNow, `attempt ${attempt}`).toBe(false);
      expect(ledger[outboxAttemptKey(record)]?.attempts).toBe(attempt);
      expect(ledger[outboxAttemptKey(record)]?.blocked).toBeNull();
    }

    const final = applyOutboxFailure(ledger, record, classes[0], now);
    expect(final.blockedNow).toBe(true);
    const entry = final.ledger[outboxAttemptKey(record)];
    expect(entry?.attempts).toBe(OUTBOX_BLOCK_ATTEMPT_BOUND);
    expect(entry?.blocked?.class).toBe('missing_remote_table');
    // The diagnosis names the class and the streak, so the user-facing copy is
    // actionable rather than "something went wrong".
    expect(entry?.blocked?.reason).toContain('missing_remote_table');
    expect(entry?.blocked?.reason).toContain(String(OUTBOX_BLOCK_ATTEMPT_BOUND));
    expect(entry?.blocked?.at).toBe(now);
  });

  it('reaches the terminal state for EVERY persistent class (not just one)', () => {
    const now = '2026-09-30T00:00:00.000Z';
    for (const cls of Object.keys(PERSISTENT_MESSAGES) as OutboxFailureClass[]) {
      let ledger: OutboxAttemptLedger = {};
      for (let attempt = 0; attempt < OUTBOX_BLOCK_ATTEMPT_BOUND; attempt += 1) {
        ledger = applyOutboxFailure(ledger, record, cls, now).ledger;
      }
      expect(ledger[outboxAttemptKey(record)]?.blocked?.class, cls).toBe(cls);
      expect(blockedOutboxKeys(ledger)).toEqual([outboxAttemptKey(record)]);
    }
  });

  it('never reaches the terminal state for a transient failure, however many attempts', () => {
    const now = '2026-09-30T00:00:00.000Z';
    let ledger: OutboxAttemptLedger = {};
    for (let attempt = 0; attempt < OUTBOX_BLOCK_ATTEMPT_BOUND * 4; attempt += 1) {
      const applied = applyOutboxFailure(ledger, record, 'transient', now);
      ledger = applied.ledger;
      expect(applied.blockedNow, `transient attempt ${attempt + 1}`).toBe(false);
    }
    expect(blockedOutboxKeys(ledger)).toEqual([]);
    // Transient failures are still recorded, so the streak is observable.
    expect(ledger[outboxAttemptKey(record)]?.lastClass).toBe('transient');
  });

  it('a transient failure after a persistent streak must earn its own bound', () => {
    const now = '2026-09-30T00:00:00.000Z';
    // Three persistent attempts, then the remote comes back but the record
    // fails transiently: the streak resets instead of inheriting prior
    // attempts and blocking on the next single hiccup.
    let entry = nextAttemptEntry(undefined, 'missing_remote_table', now).entry;
    entry = nextAttemptEntry(entry, 'missing_remote_table', now).entry;
    entry = nextAttemptEntry(entry, 'missing_remote_table', now).entry;
    expect(entry.attempts).toBe(3);
    const afterTransient = nextAttemptEntry(entry, 'transient', now);
    expect(afterTransient.entry.attempts).toBe(1);
    expect(afterTransient.blockedNow).toBe(false);
  });

  it('stays terminal once blocked, and never un-blocks on its own', () => {
    const now = '2026-09-30T00:00:00.000Z';
    let ledger: OutboxAttemptLedger = {};
    for (let i = 0; i < OUTBOX_BLOCK_ATTEMPT_BOUND; i += 1) {
      ledger = applyOutboxFailure(ledger, record, 'permanently_rejected', now).ledger;
    }
    const blockedAt = ledger[outboxAttemptKey(record)]?.blocked;
    // Further failures keep the original verdict (the count stops climbing, so
    // the diagnosis still names the streak that caused it).
    const later = applyOutboxFailure(
      ledger,
      record,
      'permanently_rejected',
      '2026-10-01T00:00:00.000Z',
    );
    expect(later.blockedNow).toBe(false);
    expect(later.ledger[outboxAttemptKey(record)]?.blocked).toEqual(blockedAt);
    // Only a real success clears it.
    const cleared = clearOutboxAttempt(later.ledger, record);
    expect(blockedOutboxKeys(cleared)).toEqual([]);
    expect(cleared[outboxAttemptKey(record)]).toBeUndefined();
  });

  it('clears one record without touching another', () => {
    const now = '2026-09-30T00:00:00.000Z';
    let ledger: OutboxAttemptLedger = {};
    for (let i = 0; i < OUTBOX_BLOCK_ATTEMPT_BOUND; i += 1) {
      ledger = applyOutboxFailure(ledger, record, 'permanently_rejected', now).ledger;
    }
    ledger = applyOutboxFailure(ledger, other, 'transient', now).ledger;
    const cleared = clearOutboxAttempt(ledger, record);
    expect(blockedOutboxKeys(cleared)).toEqual([]);
    expect(cleared[outboxAttemptKey(other)]?.attempts).toBe(1);
  });

  it('describes the blocked outbox with entity, id, class, and reason', () => {
    const now = '2026-09-30T00:00:00.000Z';
    let ledger: OutboxAttemptLedger = {};
    for (let i = 0; i < OUTBOX_BLOCK_ATTEMPT_BOUND; i += 1) {
      ledger = applyOutboxFailure(ledger, record, 'missing_remote_table', now).ledger;
    }
    const described = describeBlockedOutbox(ledger);
    expect(described).toHaveLength(1);
    expect(described[0]).toMatchObject({
      entity: 'todos',
      id: 'todo_1',
      class: 'missing_remote_table',
    });
    expect(described[0]?.reason).toContain('missing_remote_table');
    // Non-vacuity: an empty ledger describes nothing at all.
    expect(describeBlockedOutbox({})).toEqual([]);
  });

  it('handles an id containing a colon without losing the entity', () => {
    const now = '2026-09-30T00:00:00.000Z';
    const colonId = { entity: 'custom_exercises', id: 'cex:1:2' };
    let ledger: OutboxAttemptLedger = {};
    for (let i = 0; i < OUTBOX_BLOCK_ATTEMPT_BOUND; i += 1) {
      ledger = applyOutboxFailure(ledger, colonId, 'permanently_rejected', now).ledger;
    }
    const described = describeBlockedOutbox(ledger);
    expect(described[0]?.entity).toBe('custom_exercises');
    expect(described[0]?.id).toBe('cex:1:2');
  });
});
