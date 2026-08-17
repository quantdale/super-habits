# Proposal: Weekly Review & Planning V1

## Summary

Add a first-class Weekly Review & Planning experience that turns the data already collected by Super Habits into a deterministic, actionable weekly planning workflow.

The product already tracks Todos, Habits, Calories, Focus/Pomodoro, Workouts, progress insights, Linked Actions, Command Center, cloud backup, account recovery, and portable backups. The next product-value gap is not more infrastructure; it is helping the user convert that accumulated information into a deliberate plan for the next week.

Weekly Review & Planning V1 introduces a guided review that summarizes the completed week, surfaces unfinished or risky items, lets the user make explicit carry-forward and scheduling decisions, and saves a durable weekly plan locally. AI may optionally help phrase or summarize already-computed local facts, but all calculations and mutations remain deterministic and local-first.

## User Problem

Super Habits currently records many useful signals, but users still need to manually inspect several screens to answer questions such as:

- What did I actually complete this week?
- Which Todos are overdue or repeatedly carried forward?
- Which Habits are slipping?
- How consistent was my Focus work?
- Did I train enough this week?
- How did Calories compare with my configured goal?
- What should I deliberately carry into next week?
- What are the few priorities I want to protect next week?

Without a dedicated planning loop, the application is primarily a collection of trackers rather than a system that closes the feedback loop from execution to reflection to planning.

## User Outcome

A user can open Weekly Review near the end of a week, see a deterministic summary of the week, make explicit planning decisions, and finish with a saved plan for the next week.

The completed weekly plan should answer:

1. What went well?
2. What needs attention?
3. Which unfinished Todos should be carried forward, rescheduled, or left unchanged?
4. Which Habits need attention next week?
5. What are the user's top priorities for next week?
6. What concrete Todo commitments are being created or rescheduled?
7. What note or reflection does the user want to preserve?

The review must remain useful without any network connection or AI provider.

## Goals

1. Add a guided Weekly Review flow using existing local data.
2. Compute all review facts deterministically from SQLite/domain selectors.
3. Support explicit, safe planning mutations with preview and confirmation.
4. Persist weekly review history and next-week plans locally.
5. Keep the workflow useful offline and without AI.
6. Integrate review summaries into Home/Today and Command Center in a bounded way.
7. Preserve all existing local-first, ownership, backup, and side-effect guarantees.
8. Add the new authoritative weekly-plan data to Backup Completeness V2 and Portable Backup V1.

## Non-Goals

- autonomous AI planning that writes arbitrary tasks without user confirmation
- automatic deletion or mass completion of Todos
- changing historical Habit completions
- changing historical calorie, workout, or focus records
- automatically changing Habit schedules or targets
- automatic calendar integration
- external calendar sync
- project-management hierarchies
- goals/OKR system
- multi-user/shared planning
- social features
- replacing Today’s Workout
- rebuilding the Home screen
- full natural-language planner agent

## Product Scope

### Weekly Review Summary

The review should include bounded deterministic facts for the completed/current review week:

- Todos
  - completed count
  - incomplete count
  - overdue count
  - due-next-week candidates
  - carry-forward candidates
- Habits
  - scheduled occurrences
  - completed occurrences
  - consistency percentage
  - current streak and notable misses
  - attention-needed Habits
- Focus
  - completed focus sessions
  - total focused minutes
  - comparison with prior week when enough data exists
- Workouts
  - completed workout sessions
  - routine frequency summary
  - comparison with prior week when enough data exists
- Calories
  - days with entries
  - average daily calories over logged days
  - comparison with configured calorie goal when available
- Cross-feature
  - a concise deterministic list of wins
  - a concise deterministic list of attention items

### Planning Decisions

The user can:

- choose up to 3–5 top priorities for next week
- carry selected unfinished Todos forward
- reschedule selected Todos to explicit next-week dates
- leave selected Todos unchanged
- create a small number of explicit new Todo commitments
- save an optional reflection/note
- review all proposed mutations before committing

### Saved Weekly Plan

A completed review stores an authoritative local record for the reviewed week and next-week plan, including:

- review week start/date range
- completion timestamp
- deterministic summary snapshot or normalized summary fields
- user reflection
- selected next-week priorities
- Todo decision records
- created/rescheduled Todo references
- schema/version metadata

The durable representation must be designed so it can be backed up/restored safely without replaying mutations.

## Safety Principles

- No mutation before explicit confirmation.
- Review calculations do not write data.
- AI never selects internal IDs or mutates SQLite directly.
- Todo mutations use canonical domain functions.
- Historical records are never rewritten to make the review look better.
- Weekly plan persistence must not trigger historical Linked Actions.
- Any new Todo creation/completion/rescheduling semantics must preserve existing Linked Action and recurrence invariants.
- Backup/restore imports weekly-review history without re-running plan actions.

## Offline-First Requirement

The complete review and planning flow must work with:

- no Supabase connection
- no Command Center remote classifier
- no AI phrasing endpoint

If optional AI summarization is unavailable, deterministic local wording is used.

## AI Boundary

AI is optional in V1.

Allowed:

- phrase a deterministic local weekly summary
- suggest wording for reflection prompts
- summarize already-selected deterministic facts

Not allowed:

- direct database reads from the model
- arbitrary entity selection
- autonomous Todo creation without preview/confirmation
- changing Habit targets/schedules
- inventing calories, workouts, or focus sessions
- replacing deterministic calculations

## Data Model Direction

Create a repository-consistent authoritative local model, likely centered on a `weekly_reviews` table plus a normalized or validated JSON payload for next-week priorities/decisions, unless a normalized multi-table design is materially safer.

The final design must support:

- deterministic lookup by review week
- one completed canonical review per week unless explicit revision semantics are designed
- safe re-open/read history
- backup/restore
- portable export/import
- runtime validation
- schema migration

## Backup / Portability Requirement

Weekly Review & Planning V1 creates authoritative user state and therefore must be integrated into:

- Backup Completeness V2
- cloud backfill/checkpoint integrity
- Restore V2 dependency validation and atomic import
- Portable Backup V1 export/import and checksums

Do not add the table locally and leave disaster recovery incomplete.

## UX Direction

Entry points should be discoverable but not intrusive. Preferred surfaces:

- Home/Today card when a weekly review is due or available
- Progress/Insights history area
- optional Settings/debug test seam only for deterministic QA

The review itself should be a focused step-by-step flow rather than one dense dashboard.

Suggested steps:

1. Week summary
2. Wins and attention items
3. Unfinished Todo decisions
4. Next-week priorities
5. New commitments / rescheduling
6. Reflection
7. Final preview
8. Confirm and save

## Definition of Done

Weekly Review & Planning V1 is complete only when:

- deterministic review calculations are implemented and tested
- the guided UI is accessible and works offline
- Todo planning decisions are previewed before mutation
- confirmation applies canonical mutations exactly once
- weekly review history persists across restart
- duplicate submission is safe
- week/date boundaries are timezone-correct
- prior-week comparison is correct around year/month/DST boundaries
- review history is included in cloud backup and portable backups
- Restore V2/Portable Import restore reviews without replaying plan actions
- Command Center integration, if added, is bounded and deterministic
- Web E2E is green
- Android status is known
- OpenSpec and ExecPlan are complete
- final GitHub `main` is clean, main-only, and final CI has quality + e2e PASS

## Language

All user-facing copy, documentation, ExecPlans, OpenSpec files, tests added by this change, commit messages, progress reports, and final reports must be English only.
