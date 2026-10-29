# ExecPlan: date-key-dst-consolidation-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close Audit C §9: every shipped day-gap, day-shift, and date-key builder routes
through `lib/time.ts`, so the "bare date parsed as UTC / fixed-millisecond day"
defect class has one choke point instead of four copied helpers.

## Context

- Audit: `/workspace/super-habits-audit.md` Appendix C §9. Primitives
  `toDateKey`, `parseLocalDateKey`, `addLocalDays`, `diffLocalDays`,
  `isValidDateKey` already existed in `lib/time.ts` (PR #96).
- Verified residue at `bcc40d52`: four day-gap helpers still used
  `Math.round(diff / 86_400_000)`, five sites hand-built a shifted key, and two
  duplicate `isValidDateKey` copies existed outside `lib/time.ts`.
- The audit's "four shadow builders" was already two: `todos.domain` and
  `caloriesFormat` were consolidated by an earlier PR.

## Scope

- `features/projects/projects.domain.ts` — `daysUntilDate`
- `features/workout/workout.domain.ts` — `formatLastPerformedLabel`
- `features/activity/activityTimeline.domain.ts` — `formatTimelineDayLabel`
  (moved out of the view so it is unit-testable), `filterTimelineByRange` cutoff
- `features/momentum/momentum.domain.ts` — `formatMomentumDateLabel` (same move)
- `features/command/askParser.ts`, `ask.retrieval.ts` — range-bound day counts
- `features/daily-plan/dailyPlan.domain.ts`,
  `features/weekly-review/weeklyReview.domain.ts` — `shiftDateKeyByDays`
- `features/planning-hub/planningHub.briefing.ts`, `GuidedPlanningFlow.tsx` —
  private `shiftDateKey`
- `core/notifications/workoutReminderScheduler.ts` — key via `toDateKey`
- `features/command/realCommandParser.ts`, `command.domain.ts` — duplicate
  `isValidDateKey`

## Non-Goals

- No migrations, schema, backup, or sync changes.
- No `lib/time.ts` API redesign.
- No change to reminder scheduling semantics (§1) or streak rules (§10).
- `core/backup/backupValidators.ts` keeps its own intentionally strict validator.

## Current Checkpoint

- Current milestone: Complete.
- Completed: all listed sites delegate to `lib/time`; regression tests added.
- In progress: None.
- Important modified files: 14 source files, 5 test files (see `git diff`).
- Last successful validation: `npm run typecheck` 0 errors, `npm run lint` 0
  problems, unit 2131 pass, `npm run qa:timezones` pass in all 5 zones.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Exact next action: None; task complete.
- Remaining definition of done: Complete.

## Progress

- [x] Verify audit §9 against code
- [x] Consolidate day-gap helpers onto `diffLocalDays`
- [x] Consolidate day-shift and cutoff builders onto `addLocalDays`
- [x] Collapse duplicate date-key validators
- [x] Add calendar-skip regression tests
- [x] Validate gates and commit

## Surprises & Discoveries

- `Math.round((localMidnightB - localMidnightA) / 86_400_000)` is _correct_
  across an ordinary DST transition: the rounding absorbs the ±1 h. It fails
  only when a local calendar day is skipped outright (Samoa 2011-12-30). The
  regression tests therefore force `Pacific/Apia`; a DST-only test would have
  passed against the buggy code.
- `addLocalDays` is not invertible across a skipped day
  (`addLocalDays('2011-12-31', -1)` returns `'2011-12-31'`): "one day before
  Dec 31" names a non-existent key and the runtime normalizes it forward. It
  cannot occur at any DST transition, so it is documented in `tests/time.test.ts`
  rather than changed.
- `npm run qa:timezones` was already red on `main` at the UTC lane: the "local
  midnight is not the UTC parse" assertion is vacuous under UTC (TEST_BUG).

## Decision Log

- 2026-09-20 — Change the four helpers to delegate to `diffLocalDays` instead of
  deleting them — they carry surface labels ("Today", "Yesterday") and their
  names are public test contracts.
- 2026-09-20 — Move the two view-local label formatters into their feature
  domain modules — the arithmetic becomes unit-testable instead of trapped in
  a component.
- 2026-09-20 — Fix the UTC-lane assertion by forcing a west-of-UTC zone rather
  than deleting the claim (TEST_BUG, not a weakened assertion).
- 2026-09-20 — Guard `formatTimelineDayLabel` against a malformed key
  (`isValidDateKey` check returning the raw key) — `diffLocalDays` throws on a
  bad key and this runs in the render path, where a corrupt timestamp can
  produce `NaN-NaN-NaN`; the removed view helper degraded instead of crashing.
- 2026-09-20 — Dropped an out-of-scope `askParser` outbound-URL allowlist and
  its 5 tests at review: unrelated to date keys.

## Validation Ledger

| Command                  | Outcome                      | Date       |
| ------------------------ | ---------------------------- | ---------- |
| `npm run typecheck`      | pass, 0 errors               | 2026-09-20 |
| `npm run lint`           | pass, 0 problems repo-wide   | 2026-09-20 |
| `npm run test:unit`      | pass, 2131 tests / 153 files | 2026-09-20 |
| `npm run qa:integration` | pass, 634 passed / 2 skipped | 2026-09-20 |
| `npm run qa:timezones`   | pass in all 5 zones          | 2026-09-20 |

## Changed Files / Areas

Source: `features/projects/projects.domain.ts`,
`features/workout/workout.domain.ts`,
`features/activity/activityTimeline.domain.ts`,
`features/activity/ActivityTimelineView.tsx`,
`features/momentum/momentum.domain.ts`,
`features/momentum/MomentumDetailView.tsx`,
`features/command/askParser.ts`, `features/command/ask.retrieval.ts`,
`features/command/command.domain.ts`, `features/command/realCommandParser.ts`,
`features/daily-plan/dailyPlan.domain.ts`,
`features/weekly-review/weeklyReview.domain.ts`,
`features/planning-hub/planningHub.briefing.ts`,
`features/planning-hub/GuidedPlanningFlow.tsx`,
`core/notifications/workoutReminderScheduler.ts`.
Tests: `tests/time.test.ts`, `tests/projects.domain.test.ts`,
`tests/workout.domain.test.ts`, `tests/momentum.domain.test.ts`,
`tests/activityTimeline.test.ts`.

## Recovery / Resume Instructions

1. `git status --short`, `git diff --stat`.
2. Read Current Checkpoint above.
3. `npm run qa:affected` to pick the cheapest sufficient gates.

## Outcomes & Retrospective

Every shipped day-gap helper now delegates to `diffLocalDays`, every
day-shift/cutoff builder to `addLocalDays`, and no shipped file outside
`lib/time.ts` composes a date key with `padStart`. The duplicate
`isValidDateKey` copies collapsed onto `lib/time.isValidDateKey`, leaving
`core/backup/backupValidators.ts`'s separate strict validator alone.

Two corrections to the audit: the "four shadow builders" were already two, and
the four `Math.round(diff / 86_400_000)` helpers are not wrong across ordinary
DST transitions — only when a local calendar day is skipped or when accumulated
drift crosses the 12 h rounding boundary over long spans.

Review round r2 removed an out-of-scope `askParser` SSRF guard and restored a
`formatTime` doc comment that the original commit had deleted by accident, and
added the malformed-key guard the delegation made necessary.
