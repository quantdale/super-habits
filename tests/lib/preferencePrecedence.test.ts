import { describe, expect, it } from 'vitest';

import { createPreferencePrecedenceGuard } from '@/lib/preferencePrecedence';

describe('createPreferencePrecedenceGuard', () => {
  it('applies persisted hydration when no explicit choice was made (matrix 6)', () => {
    const guard = createPreferencePrecedenceGuard();
    expect(guard.shouldApplyPersisted()).toBe(true);
    expect(guard.hasChoiceBeenMade()).toBe(false);
  });

  it('a user choice after hydration starts blocks the stale persisted value (matrix 5)', () => {
    const guard = createPreferencePrecedenceGuard();
    // Hydration read begins; value not applied yet.
    expect(guard.shouldApplyPersisted()).toBe(true);
    // The user explicitly chooses a different valid value.
    guard.markChoiceMade();
    expect(guard.shouldApplyPersisted()).toBe(false);
    expect(guard.hasChoiceBeenMade()).toBe(true);
  });

  it('later persisted hydration cannot overwrite an already-made choice', () => {
    const guard = createPreferencePrecedenceGuard();
    guard.markChoiceMade();
    expect(guard.shouldApplyPersisted()).toBe(false);
  });
});
