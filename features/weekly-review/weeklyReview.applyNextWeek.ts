/**
 * Applies next-week plan suggestions produced by the weekly review into the
 * daily-plan data layer. Explicit, user-initiated write path; review
 * computation itself stays read-only.
 *
 * Idempotent: merging into each day's existing top priorities skips ids that
 * are already selected and respects MAX_TOP_PRIORITIES capacity.
 */
import type { NextWeekPlanSuggestion } from './weeklyReview.domain';
import { getDailyPlan, setDailyPlanTopTodos } from '@/features/daily-plan/dailyPlan.data';
import { parseTopTodoIds } from '@/features/daily-plan/dailyPlan.domain';
import { MAX_TOP_PRIORITIES } from '@/features/daily-plan/dailyPlan.types';

export type ApplyNextWeekSuggestionsResult = {
  /** Date keys whose plans were updated. */
  appliedDateKeys: string[];
  /** Total todo ids actually added (deduped against existing selections). */
  addedCount: number;
};

export async function applyNextWeekPlanSuggestions(
  suggestions: NextWeekPlanSuggestion[],
): Promise<ApplyNextWeekSuggestionsResult> {
  const appliedDateKeys: string[] = [];
  let addedCount = 0;

  for (const suggestion of suggestions) {
    if (suggestion.todoIds.length === 0) continue;
    const existing = await getDailyPlan(suggestion.dateKey);
    const currentIds = parseTopTodoIds(existing?.top_todo_ids ?? '[]');
    const merged = [...currentIds];
    for (const todoId of suggestion.todoIds) {
      if (merged.length >= MAX_TOP_PRIORITIES) break;
      if (!merged.includes(todoId)) {
        merged.push(todoId);
        addedCount++;
      }
    }
    if (merged.length === currentIds.length) continue;
    await setDailyPlanTopTodos(suggestion.dateKey, merged);
    appliedDateKeys.push(suggestion.dateKey);
  }

  return { appliedDateKeys, addedCount };
}
