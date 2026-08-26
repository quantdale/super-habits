import { describe, expect, it } from 'vitest';

import { createEditableFieldOwner } from '@/lib/editableDraft';

type Field = 'intention' | 'notes';

describe('createEditableFieldOwner', () => {
  it('applies a pristine field and skips a dirty one', () => {
    const owner = createEditableFieldOwner<Field>();
    const applied: string[] = [];
    owner.markDirty('intention');
    owner.applyIfPristine('intention', () => applied.push('intention'));
    owner.applyIfPristine('notes', () => applied.push('notes'));
    expect(applied).toEqual(['notes']);
  });

  it('preserves an in-progress user edit when an older load settles (regression matrix 4)', () => {
    const owner = createEditableFieldOwner<Field>();
    // Load begins; the user edits `intention` before the read settles.
    owner.markDirty('intention');
    const settled: string[] = [];
    owner.applyIfPristine('intention', () => settled.push('intention=db'));
    owner.applyIfPristine('notes', () => settled.push('notes=db'));
    // The stale load must not overwrite the user's newer intention edit.
    expect(settled).toEqual(['notes=db']);
  });

  it('hydrates untouched fields normally (regression matrix 6)', () => {
    const owner = createEditableFieldOwner<Field>();
    const settled: string[] = [];
    owner.applyIfPristine('intention', () => settled.push('intention=db'));
    owner.applyIfPristine('notes', () => settled.push('notes=db'));
    expect(settled).toEqual(['intention=db', 'notes=db']);
  });

  it('clears dirty tracking so a later explicit save can re-adopt', () => {
    const owner = createEditableFieldOwner<Field>();
    owner.markDirty('intention');
    owner.clear();
    const settled: string[] = [];
    owner.applyIfPristine('intention', () => settled.push('intention=db'));
    expect(settled).toEqual(['intention=db']);
  });
});
