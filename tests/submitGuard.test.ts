import { describe, expect, it } from 'vitest';

import { createSubmitGuard } from '@/lib/submitGuard';

describe('createSubmitGuard', () => {
  it('allows one submission and rejects re-entry until it finishes', () => {
    const guard = createSubmitGuard();

    expect(guard.tryStart()).toBe(true);
    expect(guard.tryStart()).toBe(false);

    guard.finish();

    expect(guard.tryStart()).toBe(true);
  });

  it('can be finished after validation fails and used again', () => {
    const guard = createSubmitGuard();

    expect(guard.tryStart()).toBe(true);
    guard.finish();

    expect(guard.tryStart()).toBe(true);
    expect(guard.tryStart()).toBe(false);
  });

  it('guards each form independently (no shared state)', () => {
    const guardA = createSubmitGuard();
    const guardB = createSubmitGuard();

    expect(guardA.tryStart()).toBe(true);
    expect(guardB.tryStart()).toBe(true);
  });
});
