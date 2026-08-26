import { describe, expect, it } from 'vitest';

import { createPreviewAdoptionGuard } from '@/core/providers/previewAdoption';

describe('createPreviewAdoptionGuard', () => {
  it('only the newest preview task may adopt (regression matrix 7)', () => {
    const guard = createPreviewAdoptionGuard();
    const older = guard.begin();
    const newer = guard.begin();
    expect(guard.isCurrent(older)).toBe(false);
    expect(guard.isCurrent(newer)).toBe(true);
  });

  it('a late older preview cannot overwrite a newer adopted preview', () => {
    const guard = createPreviewAdoptionGuard();
    const older = guard.begin();
    const newer = guard.begin();
    const adopted: string[] = [];
    // Newer preview settles/applies first.
    if (guard.isCurrent(newer)) adopted.push('newer');
    // The older preview settles later but must be rejected.
    if (guard.isCurrent(older)) adopted.push('older');
    expect(adopted).toEqual(['newer']);
  });

  it('sequential previews each win in turn', () => {
    const guard = createPreviewAdoptionGuard();
    expect(guard.isCurrent(guard.begin())).toBe(true);
    expect(guard.isCurrent(guard.begin())).toBe(true);
    expect(guard.isCurrent(guard.begin())).toBe(true);
  });
});
