import type { DailyPlan, Todo } from '@/core/db/types';
import type { DailyPlanUpdate } from '@/features/daily-plan/dailyPlan.data';
import { addTopTodoId, parseTopTodoIds } from '@/features/daily-plan/dailyPlan.domain';
import { MAX_TOP_PRIORITIES } from '@/features/daily-plan/dailyPlan.types';

/**
 * Pure decision logic for GuidedPlanningFlow — the same split used by
 * planningHub.briefing.ts: no DB access, no React, fully unit-testable.
 */

export const GUIDED_FOCUS_MINUTES_DEFAULT = '25';

/** One carry-over review row on step 1. */
export type UnfinishedPriority = { id: string; title: string };

/**
 * Resolve yesterday's still-open priorities for the carry-over review.
 *
 * `titles` is the save-time snapshot aligned index-wise with the UNFILTERED
 * `ids`, so each surviving id reads its title by its own original position —
 * a completed priority must never shift later titles (index-alignment fix).
 * An empty/missing snapshot slot falls through to the live todo title, then
 * to the 'A past priority' placeholder.
 */
export function resolveUnfinishedPriorities(input: {
  ids: string[];
  titles: string[];
  todos: Pick<Todo, 'id' | 'title' | 'completed'>[];
}): UnfinishedPriority[] {
  const completedIds = new Set(input.todos.filter((t) => t.completed === 1).map((t) => t.id));
  const todoById = new Map(input.todos.map((t) => [t.id, t] as const));
  const result: UnfinishedPriority[] = [];
  input.ids.forEach((id, index) => {
    if (completedIds.has(id)) return;
    const snapshotTitle = input.titles[index];
    result.push({
      id,
      title: snapshotTitle || todoById.get(id)?.title || 'A past priority',
    });
  });
  return result;
}

/**
 * Draft state prefilled from today's existing plan (mirrors DailyPlanView
 * refresh semantics): selections, intention, and focus target come from the
 * stored row; notes/reflection/energyScore are not edited by the guided flow
 * but ride along so a save never clobbers them with empty defaults.
 */
export type GuidedPlanDraft = {
  selectedIds: string[];
  intention: string;
  focusMinutesText: string;
  notes: string;
  reflection: string;
  energyScore: number | null;
};

const EMPTY_DRAFT: GuidedPlanDraft = {
  selectedIds: [],
  intention: '',
  focusMinutesText: GUIDED_FOCUS_MINUTES_DEFAULT,
  notes: '',
  reflection: '',
  energyScore: null,
};

export function buildGuidedPlanDraft(
  existing: Pick<
    DailyPlan,
    'intention' | 'top_todo_ids' | 'focus_target_minutes' | 'notes' | 'reflection' | 'energy_score'
  > | null,
): GuidedPlanDraft {
  if (!existing) return EMPTY_DRAFT;
  return {
    selectedIds: parseTopTodoIds(existing.top_todo_ids),
    intention: existing.intention,
    focusMinutesText: String(existing.focus_target_minutes),
    notes: existing.notes,
    reflection: existing.reflection,
    energyScore: existing.energy_score,
  };
}

/**
 * Merge ids newly written by carry-forward into the current selection. Only
 * the delta against the plan captured at flow open is added, so re-pressing
 * "Carry forward" (idempotent write) can never resurrect an item the user
 * deliberately deselected. Bounded by MAX_TOP_PRIORITIES via addTopTodoId.
 */
export function applyCarriedForwardSelection(input: {
  selection: string[];
  /** Today's plan ids as of flow open (before any carry-forward write). */
  planIdsBeforeCarry: string[];
  /** Today's plan ids re-read after carryForwardFromPreviousDay succeeded. */
  planIdsAfterCarry: string[];
}): string[] {
  const before = new Set(input.planIdsBeforeCarry);
  const carriedNew = input.planIdsAfterCarry.filter((id) => !before.has(id));
  return carriedNew.reduce((acc, id) => addTopTodoId(acc, id), [...input.selection]);
}

/**
 * Save payload for the guided flow's single upsertDailyPlan mutation. Fields
 * the wizard does not edit pass through verbatim from the prefilled draft so
 * untouched notes/reflection/energy survive; only the edited fields (ids,
 * intention, focus target) plus the commit status transition are fresh.
 */
export function buildGuidedSaveUpdates(input: {
  draftNotes: string;
  draftReflection: string;
  draftEnergyScore: number | null;
  intention: string;
  focusMinutesText: string;
  selectedIds: string[];
}): DailyPlanUpdate {
  return {
    intention: input.intention,
    notes: input.draftNotes,
    reflection: input.draftReflection,
    energyScore: input.draftEnergyScore,
    focusTargetMinutes: Math.min(Number(input.focusMinutesText.replace(/\D/g, '')) || 0, 24 * 60),
    topTodoIds: input.selectedIds.slice(0, MAX_TOP_PRIORITIES),
    status: 'committed',
  };
}
