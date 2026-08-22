import { describe, expect, it } from 'vitest';
import {
  applyCarriedForwardSelection,
  buildGuidedPlanDraft,
  buildGuidedSaveUpdates,
  resolveUnfinishedPriorities,
} from '@/features/planning-hub/guidedPlanning.model';
import { MAX_TOP_PRIORITIES } from '@/features/daily-plan/dailyPlan.types';

function todo(input: { id: string; title: string; completed?: 0 | 1 }) {
  return { id: input.id, title: input.title, completed: input.completed ?? 0 };
}

function existingPlan(input: {
  intention?: string;
  top_todo_ids?: string;
  focus_target_minutes?: number;
  notes?: string;
  reflection?: string;
  energy_score?: number | null;
}) {
  return {
    intention: input.intention ?? '',
    top_todo_ids: input.top_todo_ids ?? '[]',
    focus_target_minutes: input.focus_target_minutes ?? 0,
    notes: input.notes ?? '',
    reflection: input.reflection ?? '',
    energy_score: input.energy_score ?? null,
  };
}

describe('resolveUnfinishedPriorities — title alignment', () => {
  it('indexes titles by the original position when a completed priority is skipped', () => {
    // ids/titles are aligned UNFILTERED as stored at save time; the first
    // priority was completed overnight. The historical bug indexed `titles`
    // with the filtered index, shifting every later displayed title by one
    // (b showed 'A', c showed 'B').
    const result = resolveUnfinishedPriorities({
      ids: ['todo_a', 'todo_b', 'todo_c'],
      titles: ['First', 'Second', 'Third'],
      todos: [
        todo({ id: 'todo_a', title: 'First', completed: 1 }),
        todo({ id: 'todo_b', title: 'Second' }),
        todo({ id: 'todo_c', title: 'Third' }),
      ],
    });

    expect(result).toEqual([
      { id: 'todo_b', title: 'Second' },
      { id: 'todo_c', title: 'Third' },
    ]);
  });

  it('falls through an empty snapshot slot to the live todo title, then to the placeholder', () => {
    const result = resolveUnfinishedPriorities({
      ids: ['todo_a', 'gone', 'unknown'],
      titles: ['', 'Snapshot B'],
      todos: [todo({ id: 'todo_a', title: 'Live A' })],
    });

    expect(result).toEqual([
      { id: 'todo_a', title: 'Live A' },
      { id: 'gone', title: 'Snapshot B' },
      { id: 'unknown', title: 'A past priority' },
    ]);
  });
});

describe('buildGuidedPlanDraft — prefill from the existing plan', () => {
  it('starts empty with the guided-flow focus default on a pristine day', () => {
    expect(buildGuidedPlanDraft(null)).toEqual({
      selectedIds: [],
      intention: '',
      focusMinutesText: '25',
      notes: '',
      reflection: '',
      energyScore: null,
    });
  });

  it('prefills selections, intention, focus target, and untouched pass-through fields', () => {
    const draft = buildGuidedPlanDraft(
      existingPlan({
        intention: 'Ship the fix',
        top_todo_ids: JSON.stringify(['todo_a', 'todo_b']),
        focus_target_minutes: 90,
        notes: 'Deep-work morning only',
        reflection: 'Felt steady',
        energy_score: 4,
      }),
    );

    expect(draft).toEqual({
      selectedIds: ['todo_a', 'todo_b'],
      intention: 'Ship the fix',
      focusMinutesText: '90',
      notes: 'Deep-work morning only',
      reflection: 'Felt steady',
      energyScore: 4,
    });
  });
});

describe('buildGuidedSaveUpdates — prefill preservation on save', () => {
  it('passes untouched notes/reflection/energy through verbatim instead of empty defaults', () => {
    const draft = buildGuidedPlanDraft(
      existingPlan({
        notes: 'Deep-work morning only',
        reflection: 'Felt steady',
        energy_score: 4,
      }),
    );

    const updates = buildGuidedSaveUpdates({
      draftNotes: draft.notes,
      draftReflection: draft.reflection,
      draftEnergyScore: draft.energyScore,
      intention: 'New intention',
      focusMinutesText: '45',
      selectedIds: ['todo_b'],
    });

    expect(updates.notes).toBe('Deep-work morning only');
    expect(updates.reflection).toBe('Felt steady');
    expect(updates.energyScore).toBe(4);
    expect(updates.intention).toBe('New intention');
    expect(updates.focusTargetMinutes).toBe(45);
    expect(updates.topTodoIds).toEqual(['todo_b']);
    expect(updates.status).toBe('committed');
  });

  it('keeps legacy fresh-day defaults for a plan that does not exist yet', () => {
    const updates = buildGuidedSaveUpdates({
      draftNotes: '',
      draftReflection: '',
      draftEnergyScore: null,
      intention: '',
      focusMinutesText: 'not-a-number',
      selectedIds: [],
    });

    expect(updates.notes).toBe('');
    expect(updates.reflection).toBe('');
    expect(updates.energyScore).toBeNull();
    expect(updates.focusTargetMinutes).toBe(0);
    expect(updates.topTodoIds).toEqual([]);
  });

  it('preserves the bounded top-three semantics in the payload', () => {
    const updates = buildGuidedSaveUpdates({
      draftNotes: '',
      draftReflection: '',
      draftEnergyScore: null,
      intention: '',
      focusMinutesText: '25',
      selectedIds: ['todo_a', 'todo_b', 'todo_c', 'todo_d'].slice(0, MAX_TOP_PRIORITIES + 1),
    });

    expect(updates.topTodoIds).toHaveLength(MAX_TOP_PRIORITIES);
  });
});

describe('carry-forward selection seeding', () => {
  it('seeds newly carried ids into the selection so they survive the save', () => {
    // Flow opened before today's plan existed; carry-forward then wrote both
    // unfinished yesterday priorities into today's plan.
    const selection = applyCarriedForwardSelection({
      selection: [],
      planIdsBeforeCarry: [],
      planIdsAfterCarry: ['todo_1', 'todo_2'],
    });

    expect(selection).toEqual(['todo_1', 'todo_2']);

    const updates = buildGuidedSaveUpdates({
      draftNotes: '',
      draftReflection: '',
      draftEnergyScore: null,
      intention: '',
      focusMinutesText: '25',
      selectedIds: selection,
    });
    expect(updates.topTodoIds).toEqual(['todo_1', 'todo_2']);
  });

  it('drops a carried id only when the user deselects it afterwards', () => {
    const selection = applyCarriedForwardSelection({
      selection: [],
      planIdsBeforeCarry: [],
      planIdsAfterCarry: ['todo_1', 'todo_2'],
    });
    const afterDeselect = selection.filter((id) => id !== 'todo_2');

    const updates = buildGuidedSaveUpdates({
      draftNotes: '',
      draftReflection: '',
      draftEnergyScore: null,
      intention: '',
      focusMinutesText: '25',
      selectedIds: afterDeselect,
    });
    expect(updates.topTodoIds).toEqual(['todo_1']);
  });

  it('never resurrects deliberately deselected items on a repeat carry press', () => {
    // The user deselected todo_2 after the first carry; re-pressing carry
    // rewrites the same plan ([todo_1, todo_2]) because the merge is
    // idempotent against the PLAN, but the delta vs flow-open must not
    // re-add todo_2 to the selection.
    const selection = applyCarriedForwardSelection({
      selection: ['todo_1'],
      planIdsBeforeCarry: ['todo_1', 'todo_2'],
      planIdsAfterCarry: ['todo_1', 'todo_2'],
    });

    expect(selection).toEqual(['todo_1']);
  });

  it('respects MAX_TOP_PRIORITIES when seeding on top of existing picks', () => {
    const selection = applyCarriedForwardSelection({
      selection: ['picked_1', 'picked_2', 'picked_3'],
      planIdsBeforeCarry: [],
      planIdsAfterCarry: ['carried_1'],
    });

    expect(selection).toHaveLength(MAX_TOP_PRIORITIES);
    expect(selection).not.toContain('carried_1');
  });
});
