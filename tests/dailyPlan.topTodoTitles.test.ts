import { describe, it, expect } from 'vitest';
import { resolveTopTodoTitles } from '@/features/daily-plan/dailyPlan.domain';

/**
 * The plan editor's live top-priority selection can diverge from the saved
 * snapshot (unsaved add/remove between loads). Titles must resolve per todo
 * id — index-aligning the live selection against the saved title snapshot
 * showed another priority's title after a removal.
 */
describe('resolveTopTodoTitles', () => {
  const liveTitles: Record<string, string> = {
    a: 'Buy milk',
    b: 'Call mom',
    c: 'New task',
  };
  const liveTitleFor = (id: string) => liveTitles[id];

  it('keeps each todo titled with its own name after an earlier priority is removed', () => {
    expect(
      resolveTopTodoTitles({
        selectedIds: ['b'],
        savedIds: ['a', 'b'],
        savedTitles: ['Buy milk', 'Call mom'],
        liveTitleFor,
      }),
    ).toEqual(['Call mom']);
  });

  it('re-restores each title when a removed priority is re-added at the end', () => {
    expect(
      resolveTopTodoTitles({
        selectedIds: ['b', 'a'],
        savedIds: ['a', 'b'],
        savedTitles: ['Buy milk', 'Call mom'],
        liveTitleFor,
      }),
    ).toEqual(['Call mom', 'Buy milk']);
  });

  it('uses the saved snapshot title when the live todo was deleted or renamed', () => {
    expect(
      resolveTopTodoTitles({
        selectedIds: ['b'],
        savedIds: ['a', 'b'],
        savedTitles: ['Buy milk', 'Call mom (snapshotted)'],
        liveTitleFor: () => undefined,
      }),
    ).toEqual(['Call mom (snapshotted)']);
  });

  it('falls back to the live title for a newly added todo', () => {
    expect(
      resolveTopTodoTitles({
        selectedIds: ['a', 'c'],
        savedIds: ['a', 'b'],
        savedTitles: ['Buy milk', 'Call mom'],
        liveTitleFor,
      }),
    ).toEqual(['Buy milk', 'New task']);
  });

  it('falls through empty snapshot slots to the live title', () => {
    expect(
      resolveTopTodoTitles({
        selectedIds: ['a', 'b'],
        savedIds: ['a', 'b'],
        savedTitles: ['', 'Call mom'],
        liveTitleFor,
      }),
    ).toEqual(['Buy milk', 'Call mom']);
  });

  it('degrades to the unavailable label when nothing resolves', () => {
    expect(
      resolveTopTodoTitles({
        selectedIds: ['zz'],
        savedIds: [],
        savedTitles: [],
        liveTitleFor: () => undefined,
      }),
    ).toEqual(['(unavailable)']);
  });
});
