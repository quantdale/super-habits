/**
 * AUD-SH03-A / AUD-SH03-B / AUD-SH03-C — retryable outbox records must not
 * become terminally blocked.
 *
 * Audited defect (SH-03, High): the persistent-failure bound counted EVERY
 * failure, so four transient outages followed by one missing-table error reached
 * the bound of five and produced a misleading "missing_remote_table on 5
 * consecutive attempts" verdict. Separately, when one push carried a
 * missing-Todos table AND a transient Habits 503, the adapter's single JOINED
 * message was classified for both records, so the Habits record was blocked too
 * and never retried after the backend healed. The adapter's real
 * `Missing local rows for ...` wording was also not recognized, so a genuinely
 * terminal condition was retried forever.
 *
 * These cases exercise the real classifier, the real ledger policy, the real
 * adapter error envelope and the real engine — not a string table alone.
 */

import { describe, expect, it } from 'vitest';
import {
  applyOutboxFailure,
  classifyOutboxFailure,
  nextAttemptEntry,
  OUTBOX_BLOCK_ATTEMPT_BOUND,
  OUTBOX_BLOCKED_REPROBE_BUDGET,
  outboxAttemptKey,
  repairLegacyBlockedEntries,
  type OutboxAttemptLedger,
} from '@/core/sync/outboxAttempts';
import { SyncPushPartialFailureError, type SyncRecordFailure } from '@/core/sync/syncErrors';
import { SyncEngine, type SyncAdapter, type SyncRecord } from '@/core/sync/sync.engine';

const TODOS: Pick<SyncRecord, 'entity' | 'id'> = { entity: 'todos', id: 'todo_1' };
const HABITS: Pick<SyncRecord, 'entity' | 'id'> = { entity: 'habits', id: 'habit_1' };

function record(entity: SyncRecord['entity'], id: string): SyncRecord {
  return { entity, id, updatedAt: '2026-10-18T00:00:00.000Z', operation: 'create' };
}

describe('AUD-SH03-A: the persistent bound is earned per record', () => {
  it('four transient failures then one persistent failure does NOT block', () => {
    let ledger: OutboxAttemptLedger = {};
    for (let index = 0; index < 4; index += 1) {
      ledger = applyOutboxFailure(
        ledger,
        TODOS,
        'transient',
        `2026-10-18T00:00:0${index}.000Z`,
      ).ledger;
    }
    const result = applyOutboxFailure(
      ledger,
      TODOS,
      'missing_remote_table',
      '2026-10-18T00:00:05.000Z',
    );
    expect(result.blockedNow).toBe(false);
    expect(result.ledger[outboxAttemptKey(TODOS)].blocked).toBeNull();
    expect(result.ledger[outboxAttemptKey(TODOS)].persistentStreak).toBe(1);
  });

  it('twenty transient failures then one persistent failure still does NOT block', () => {
    let ledger: OutboxAttemptLedger = {};
    for (let index = 0; index < 20; index += 1) {
      ledger = applyOutboxFailure(ledger, TODOS, 'transient', `t${index}`).ledger;
    }
    const result = applyOutboxFailure(ledger, TODOS, 'permanently_rejected', 'final');
    expect(result.blockedNow).toBe(false);
    expect(result.ledger[outboxAttemptKey(TODOS)].persistentStreak).toBe(1);
  });

  it('the same persistent class bound times in a row does block', () => {
    let ledger: OutboxAttemptLedger = {};
    let blockedAt = -1;
    for (let index = 0; index < OUTBOX_BLOCK_ATTEMPT_BOUND; index += 1) {
      const result = applyOutboxFailure(ledger, TODOS, 'missing_remote_table', `t${index}`);
      ledger = result.ledger;
      if (result.blockedNow) blockedAt = index;
    }
    expect(blockedAt).toBe(OUTBOX_BLOCK_ATTEMPT_BOUND - 1);
    expect(ledger[outboxAttemptKey(TODOS)].blocked?.class).toBe('missing_remote_table');
    // The reason must state the persistent streak, not the total attempt count.
    expect(ledger[outboxAttemptKey(TODOS)].blocked?.reason).toMatch(
      new RegExp(`${OUTBOX_BLOCK_ATTEMPT_BOUND} consecutive persistent`),
    );
  });

  it('persistent -> transient -> persistent restarts the streak', () => {
    let ledger: OutboxAttemptLedger = {};
    for (let index = 0; index < 4; index += 1) {
      ledger = applyOutboxFailure(ledger, TODOS, 'missing_remote_table', `p${index}`).ledger;
    }
    ledger = applyOutboxFailure(ledger, TODOS, 'transient', 'x').ledger;
    const after = applyOutboxFailure(ledger, TODOS, 'missing_remote_table', 'y');
    expect(after.blockedNow).toBe(false);
    expect(after.ledger[outboxAttemptKey(TODOS)].persistentStreak).toBe(1);
  });

  it('switching between two persistent classes restarts the streak', () => {
    let ledger: OutboxAttemptLedger = {};
    for (let index = 0; index < 4; index += 1) {
      ledger = applyOutboxFailure(ledger, TODOS, 'missing_remote_table', `a${index}`).ledger;
    }
    const after = applyOutboxFailure(ledger, TODOS, 'permanently_rejected', 'b');
    expect(after.blockedNow).toBe(false);
    expect(after.ledger[outboxAttemptKey(TODOS)].persistentStreak).toBe(1);
  });

  it('the adapter’s real missing-local wording classifies as terminal', () => {
    // `upsertEntityRows` throws exactly this shape. It used to match no pattern,
    // so a hard-deleted entity was retried forever.
    expect(
      classifyOutboxFailure(new Error('Missing local rows for saved_meals: smeal_1, smeal_2')),
    ).toBe('missing_local_row');
  });
});

describe('AUD-SH03-B: each record is classified from its own error', () => {
  /** Adapter that fails entities with distinct reasons, like the real one. */
  function mixedAdapter(): SyncAdapter {
    return {
      pull: async () => [],
      async push(records) {
        const todosFailure = new Error(
          'Supabase upsert failed for todos: relation "public.todos" does not exist (PGRST205)',
        );
        const habitsFailure = new Error(
          'Supabase upsert failed for habits: HTTP 503 Service Unavailable',
        );
        const failed = records.filter((entry) => entry.entity !== 'calorie_entries');
        const failures: SyncRecordFailure[] = failed.map((entry) => ({
          record: entry,
          error: entry.entity === 'todos' ? todosFailure : habitsFailure,
        }));
        throw new SyncPushPartialFailureError(
          `[sync] Push failed for one or more entities: ${todosFailure.message}; ${habitsFailure.message}`,
          failed,
          failures,
        );
      },
    };
  }

  it('a missing Todos table cannot poison an independently transient Habits record', async () => {
    const engine = new SyncEngine(mixedAdapter());
    engine.enqueue(record('todos', 'todo_1'));
    engine.enqueue(record('habits', 'habit_1'));
    engine.enqueue(record('calorie_entries', 'cal_1'));

    for (let attempt = 0; attempt < OUTBOX_BLOCK_ATTEMPT_BOUND; attempt += 1) {
      await expect(engine.flush()).rejects.toBeTruthy();
    }

    // Only the Todos record can have earned a terminal verdict.
    expect(engine.isBlocked(TODOS)).toBe(true);
    expect(engine.isBlocked(HABITS)).toBe(false);
    const blocked = engine.getStatus().blockedEntities;
    expect(blocked.map((entry) => entry.entity)).toEqual(['todos']);
  });

  it('a healed backend lets the transient record push on the next flush', async () => {
    // First the mixed failure, then a working adapter: the Habits record is
    // still queued and must actually be delivered (the audited defect left it
    // blocked forever, so no sixth push ever happened).
    const pushed: string[] = [];
    let healAfter = OUTBOX_BLOCK_ATTEMPT_BOUND;
    const adapter: SyncAdapter = {
      pull: async () => [],
      async push(records) {
        if (healAfter > 0) {
          healAfter -= 1;
          const todosFailure = new Error('relation "public.todos" does not exist (PGRST205)');
          const habitsFailure = new Error('HTTP 503 Service Unavailable');
          const failed = records.filter((entry) => entry.entity !== 'calorie_entries');
          throw new SyncPushPartialFailureError(
            'push failed',
            failed,
            failed.map((entry) => ({
              record: entry,
              error: entry.entity === 'todos' ? todosFailure : habitsFailure,
            })),
          );
        }
        for (const entry of records) pushed.push(`${entry.entity}:${entry.id}`);
      },
    };
    const engine = new SyncEngine(adapter);
    engine.enqueue(record('todos', 'todo_1'));
    engine.enqueue(record('habits', 'habit_1'));
    for (let attempt = 0; attempt < OUTBOX_BLOCK_ATTEMPT_BOUND; attempt += 1) {
      await expect(engine.flush()).rejects.toBeTruthy();
    }
    expect(pushed).toEqual([]);

    // Healed: the Habits record is delivered; the permanently broken Todos
    // record stays terminal (its verdict was earned by its own evidence).
    await engine.flush();
    // The healed Habits record (and the already-succeeded Calories record on a
    // healthy push) are delivered; the broken Todos record stays terminal.
    expect(pushed).toContain('habits:habit_1');
    expect(engine.isBlocked(HABITS)).toBe(false);
    expect(engine.isBlocked(TODOS)).toBe(true);
  });

  it('the aggregate message alone never decides a record’s class', () => {
    const todosFailure = new Error('relation "public.todos" does not exist (PGRST205)');
    const habitsFailure = new Error('HTTP 503 Service Unavailable');
    const error = new SyncPushPartialFailureError(
      `aggregate: ${todosFailure.message}; ${habitsFailure.message}`,
      [record('todos', 'todo_1'), record('habits', 'habit_1')],
      [
        { record: record('todos', 'todo_1'), error: todosFailure, code: 'PGRST205' },
        { record: record('habits', 'habit_1'), error: habitsFailure },
      ],
    );
    expect(classifyOutboxFailure(error.failureFor(record('todos', 'todo_1')))).toBe(
      'missing_remote_table',
    );
    expect(classifyOutboxFailure(error.failureFor(record('habits', 'habit_1')))).toBe('transient');
    expect(error.codeFor(record('todos', 'todo_1'))).toBe('PGRST205');
  });
});

describe('AUD-SH03-C: a bounded, visible repair of pre-fix verdicts', () => {
  const legacyLedger: OutboxAttemptLedger = {
    [outboxAttemptKey(TODOS)]: {
      attempts: 5,
      firstFailureAt: '2026-10-17T00:00:00.000Z',
      lastFailureAt: '2026-10-17T01:00:00.000Z',
      lastClass: 'missing_remote_table',
      persistentStreak: 0,
      blocked: {
        class: 'missing_remote_table',
        reason: 'missing_remote_table on 5 consecutive attempts',
        at: '2026-10-17T01:00:00.000Z',
      },
    },
    [outboxAttemptKey(HABITS)]: {
      attempts: 3,
      firstFailureAt: '2026-10-17T00:00:00.000Z',
      lastFailureAt: '2026-10-17T01:00:00.000Z',
      lastClass: 'missing_local_row',
      persistentStreak: 0,
      blocked: {
        class: 'missing_local_row',
        reason: 'missing_local_row on 3 consecutive attempts',
        at: '2026-10-17T01:00:00.000Z',
      },
    },
  };

  it('re-probes only the classes the streak bug could have produced', () => {
    const { ledger, reprobedKeys } = repairLegacyBlockedEntries(
      legacyLedger,
      '2026-10-18T00:00:00.000Z',
    );
    expect(reprobedKeys).toEqual([outboxAttemptKey(TODOS)]);
    expect(ledger[outboxAttemptKey(TODOS)].blocked).toBeNull();
    expect(ledger[outboxAttemptKey(TODOS)].reprobedFrom?.reason).toMatch(/5 consecutive attempts/);
    // A positive local-data verdict is NOT reconsidered.
    expect(ledger[outboxAttemptKey(HABITS)].blocked?.class).toBe('missing_local_row');
  });

  it('the repair is idempotent: a second hydrate does not re-open it', () => {
    const first = repairLegacyBlockedEntries(legacyLedger, '2026-10-18T00:00:00.000Z');
    const second = repairLegacyBlockedEntries(first.ledger, '2026-10-18T01:00:00.000Z');
    expect(second.reprobedKeys).toEqual([]);
    expect(second.ledger).toEqual(first.ledger);
  });

  it('a healed backend lets a repaired record push and clears its entry', () => {
    const { ledger } = repairLegacyBlockedEntries(legacyLedger, '2026-10-18T00:00:00.000Z');
    // Success clears the entry entirely (fresh failures must re-earn the bound).
    const entry = ledger[outboxAttemptKey(TODOS)];
    expect(entry.persistentStreak).toBe(0);
    const afterSuccess = nextAttemptEntry(
      { ...entry, attempts: 0, lastClass: 'transient' },
      'transient',
      '2026-10-18T02:00:00.000Z',
    );
    expect(afterSuccess.blockedNow).toBe(false);
  });

  it('a still-broken record re-blocks within the small re-probe budget', () => {
    const { ledger } = repairLegacyBlockedEntries(legacyLedger, '2026-10-18T00:00:00.000Z');
    let current = ledger;
    let blockedAt = -1;
    for (let index = 0; index < OUTBOX_BLOCKED_REPROBE_BUDGET; index += 1) {
      const result = applyOutboxFailure(current, TODOS, 'missing_remote_table', `r${index}`);
      current = result.ledger;
      if (result.blockedNow) blockedAt = index;
    }
    expect(blockedAt).toBe(OUTBOX_BLOCKED_REPROBE_BUDGET - 1);
    // The original diagnosis survives for the reviewer.
    expect(current[outboxAttemptKey(TODOS)].blocked?.reason).toMatch(/bounded re-probe/);
    expect(current[outboxAttemptKey(TODOS)].blocked?.reason).toMatch(/5 consecutive attempts/);
  });
});
