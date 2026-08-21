/**
 * Applies next-week plan suggestions produced by the weekly review into the
 * daily-plan data layer. Explicit, user-initiated write path; review
 * computation itself stays read-only.
 *
 * Idempotent: merging into each day's existing top priorities skips ids that
 * are already selected and respects MAX_TOP_PRIORITIES capacity. All days are
 * applied inside ONE canonical backup-mutation transaction, so a failure
 * applies nothing rather than leaving a partial week behind. Per-item results
 * (skipped/failed) and the count of candidates truncated by the 21-slot
 * suggestion cap are reported to the caller instead of being dropped silently.
 *
 * The implementation lives in the data layer (`weeklyReview.data.ts`) because
 * it touches SQLite directly; this module stays a pure barrel so UI consumers
 * keep a stable, DB-free import site.
 */
export type {
  ApplyNextWeekSkippedReason,
  ApplyNextWeekSkipped,
  ApplyNextWeekFailed,
  ApplyNextWeekSuggestionsResult,
} from './weeklyReview.data';

export { applyNextWeekPlanSuggestions } from './weeklyReview.data';
