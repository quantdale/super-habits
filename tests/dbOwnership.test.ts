import { describe, expect, it } from 'vitest';
import {
  DB_OWNERSHIP_LOCK_NAME,
  getDbOwnedByOtherTabMessage,
  tryAcquireDbOwnership,
  type LockManagerLike,
} from '@/core/storage/dbOwnership';

/**
 * CORR-A-03 multi-tab ownership contract. A fake LockManager reproduces the
 * real Web Locks semantics this module depends on: `ifAvailable` calls back
 * with `null` when another holder exists, the request promise stays pending
 * while the callback's promise is pending, and it settles when the hold is
 * released.
 */
function fakeLocks(): LockManagerLike & {
  holders: number;
  requestCalls: string[];
} {
  const state = {
    holders: 0,
    requestCalls: [] as string[],
    request(
      name: string,
      options: { ifAvailable?: boolean },
      callback: (lock: { name: string; mode: string } | null) => Promise<void> | void,
    ): Promise<unknown> {
      state.requestCalls.push(name);
      // Real Web Locks semantics: with ifAvailable a held lock calls back with
      // null immediately; an acquired lock is held until the callback's
      // returned promise settles.
      if (options.ifAvailable && state.holders > 0) {
        return Promise.resolve(callback(null));
      }
      state.holders += 1;
      return Promise.resolve(callback({ name, mode: 'exclusive' })).then((value) => {
        state.holders -= 1;
        return value;
      });
    },
  };
  return state;
}

/** Flush the microtasks through which the fake releases a settled hold. */
async function flushRelease(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('tryAcquireDbOwnership', () => {
  it('acquires and holds when the origin lock is free (single-writer model)', async () => {
    const locks = fakeLocks();
    const ownership = await tryAcquireDbOwnership(locks);

    expect(ownership.status).toBe('acquired');
    expect(locks.holders).toBe(1);
    expect(locks.requestCalls).toEqual([DB_OWNERSHIP_LOCK_NAME]);
  });

  it('reports contention immediately when another tab holds the lock', async () => {
    const locks = fakeLocks();
    const first = await tryAcquireDbOwnership(locks);
    expect(first.status).toBe('acquired');

    // Second tab probes with ifAvailable — it must NOT wait for the first tab.
    const second = await tryAcquireDbOwnership(locks);
    expect(second.status).toBe('contended');
    expect(locks.holders).toBe(1);

    first.release();
    await flushRelease();
    expect(locks.holders).toBe(0);
  });

  it('lets a retry acquire ownership after the holding tab releases (close/recovery)', async () => {
    const locks = fakeLocks();
    const first = await tryAcquireDbOwnership(locks);
    const contended = await tryAcquireDbOwnership(locks);
    expect(contended.status).toBe('contended');

    // The owning tab closes (its hold releases exactly like an OPFS handle).
    first.release();
    await flushRelease();

    const retry = await tryAcquireDbOwnership(locks);
    expect(retry.status).toBe('acquired');
    expect(locks.holders).toBe(1);
  });

  it('degrades to unavailable when the Web Locks API is missing', async () => {
    expect((await tryAcquireDbOwnership(null)).status).toBe('unavailable');
    expect((await tryAcquireDbOwnership({} as LockManagerLike)).status).toBe('unavailable');
  });

  it('degrades to unavailable without throwing when the request rejects', async () => {
    const locks: LockManagerLike = {
      request: () => Promise.reject(new Error('locks blocked')),
    };
    const ownership = await tryAcquireDbOwnership(locks);
    expect(ownership.status).toBe('unavailable');
    // release is always callable and idempotent.
    expect(() => {
      ownership.release();
      ownership.release();
    }).not.toThrow();
  });

  it('holds exactly one writer across N tabs: one acquired, the rest contended', async () => {
    const locks = fakeLocks();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => tryAcquireDbOwnership(locks)),
    );
    expect(results.filter((r) => r.status === 'acquired')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'contended')).toHaveLength(4);
    expect(locks.holders).toBe(1);
    for (const r of results) r.release();
    await flushRelease();
    expect(locks.holders).toBe(0);
  });
});

describe('getDbOwnedByOtherTabMessage', () => {
  it('is actionable, non-destructive, and never advises clearing site data', () => {
    const message = getDbOwnedByOtherTabMessage();
    expect(message).toMatch(/another tab/i);
    expect(message).toMatch(/try again/i);
    expect(message).not.toMatch(/clear(ing)? (site|browser) data/i);
    expect(message).toMatch(/still safe/i);
  });
});
