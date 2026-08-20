# Proposal: Harden Productivity Expansion Wave V1

## Summary

The implementation-only Productivity Expansion Wave V1 shipped Projects, Goals, Daily Plans, Planning Hub, Quick Capture, Activity Timeline, and Progress Insights on top of the previously green Super Habits baseline. That wave intentionally ran only minimal compile/spec validation and deliberately deferred durability, cloud backup, portability, migration torture, full regression, E2E, simulation, and native validation.

This change is the dedicated hardening campaign promised by that implementation wave.

It SHALL audit, repair, integrate, and fully validate the entire wave before any further broad product expansion begins.

## Starting Point

Implementation-wave head at audit time:

`64a76f73b7ec30d732be5feb01ee46f93cf81b84`

The last independently verified pre-wave green product baseline was:

`6f18cce75459e21d11c29a2b82330a402336d9f4`

GitHub Actions run `32269563521` on that baseline had `quality` and `e2e` green, including the dist-sync remote-boundary lane.

The implementation wave intentionally did not establish production readiness. Its completed ExecPlan explicitly says: **implementation complete, hardening required**.

## Independently Audited Findings

The hardening session MUST reproduce and resolve at least the following source-level findings before it may close.

### H1 — Opening Today planning mutates a pristine device

`DailyPlanView` calls `getOrCreateDailyPlan()` during its mount refresh. When no row exists, `getOrCreateDailyPlan()` inserts a `daily_plans` row through `runLocalMutation()`. `runLocalMutation()` calls `claimOwnerBindingOnFirstContent()`.

Therefore merely viewing the Today planner can turn a pristine provisional device into a populated/permanently claimed dataset, potentially removing Recover Existing eligibility even when the user never saves a plan.

The hardening campaign MUST make view/preview paths read-only. A Daily Plan becomes authoritative only after an explicit user mutation such as Save, Commit, or Complete.

### H2 — Soft-deleted Daily Plans cannot be recreated for the same date

Migration 17 declares `daily_plans.date_key TEXT NOT NULL UNIQUE` while the table also uses `deleted_at`. The global unique constraint continues to include soft-deleted rows.

The hardening campaign MUST replace this with uniqueness among active rows only, using a safe append-only local migration/table rebuild as needed, and prove delete/recreate for the same date.

### H3 — Progress date windows are not true local-calendar windows

The current 7-day range preserves the caller's time-of-day and then converts directly to UTC; the end is produced by adding a fixed 24-hour interval. This does not represent local midnight-to-midnight calendar periods and is unsafe across DST.

The hardening campaign MUST use canonical local calendar boundaries and prove Manila, UTC, New York DST, Honolulu, and Kiritimati behavior.

### H4 — Focus-session count is inferred from focus minutes

Progress currently estimates focus sessions as `ceil(totalFocusMinutes / 25)` instead of counting actual focus-session rows.

The hardening campaign MUST count real sessions independently from total minutes.

### H5 — Todo completion history uses mutable `updated_at`

Todo completion analytics and Activity Timeline infer completion time from `updated_at`. Editing an already-completed Todo can therefore move its apparent completion into a later reporting period.

The hardening campaign MUST introduce a stable completion timestamp, set it only on completion transitions, clear it on reopen, preserve it across unrelated edits, migrate legacy completed rows with a documented best-effort approximation, and use it in Progress/Timeline.

### H6 — Activity Timeline can shift calorie activity to the wrong local day

The timeline takes authoritative `consumed_on` local date keys, fabricates a `T12:00:00.000Z` timestamp, then converts that timestamp back to a local date. UTC+14 can shift the event to the next local day.

The hardening campaign MUST retain authoritative date keys directly rather than round-tripping them through fabricated UTC timestamps.

### H7 — Completion history for Projects, Goals, and Daily Plans is mutable

Timeline currently infers Project/Goal/Daily Plan completion from `updated_at`. Post-completion edits can move history.

The hardening campaign MUST establish stable completion timestamps or an equivalent durable immutable completion fact and use it for derived history.

### H8 — Project/Goal target-date validation accepts impossible dates

Current validation checks only the `YYYY-MM-DD` string shape. Impossible calendar dates can pass.

The hardening campaign MUST validate real canonical local date keys without silently normalizing invalid dates.

### H9 — Project/Goal associations have no referential integrity contract

Todo/Habit/Goal association setters accept arbitrary IDs. Parent soft-delete does not reconcile children. Cross-domain combinations can become dangling or contradictory.

The hardening campaign MUST define and enforce one coherent local and remote owner-scoped association model, including deletion/move semantics.

### H10 — Daily Plan top-priority identity/history is fragile

The UI renders and removes selected priorities by Todo title rather than ID. Duplicate titles can target the wrong Todo. Completed/deleted Todos disappear from the pending candidate list even though the stored plan still references them.

The hardening campaign MUST use stable IDs for controls and preserve enough historical snapshot information for a Daily Plan to remain intelligible after referenced Todos later change or disappear.

### H11 — Backup/Portable version semantics need a real compatibility design

The cloud backup contract and portable format have evolved entity scope without a separately encoded backup-scope version in portable files/manifests. Simply appending Projects/Goals/Daily Plans to current constants risks making older valid portable files/restores unreadable.

The hardening campaign MUST introduce explicit prospective scope/version semantics and preserve known historical Portable/Backup inputs rather than silently reinterpreting them.

## Product Integration Required by This Hardening

Projects, Goals, and Daily Plans are authoritative user data. They SHALL no longer remain local-only after this campaign.

The campaign SHALL integrate them into:

- owner-scoped Supabase schema and RLS;
- durable backup outbox/backfill;
- backup manifest integrity;
- Restore V2;
- Portable Export/Import;
- owner remote-footprint safety;
- schema validators and deterministic mocks;
- source-to-backup-to-restore semantic equivalence.

The implementation-only `runLocalMutation` escape hatch SHALL no longer be used for authoritative recoverable Projects, Goals, or Daily Plans after remote integration is available.

## Goals

1. Reproduce and fix every audited correctness defect above.
2. Establish migration correctness for fresh installs and real upgrades.
3. Define stable Project/Goal/Daily Plan identity, deletion, completion, and association semantics.
4. Integrate all new authoritative user state into secure disaster recovery and portable export/import.
5. Preserve historical backup/portable compatibility for known prior formats/scopes.
6. Preserve Recoverable Account fail-closed ownership behavior.
7. Run the full repository QA stack that the implementation wave intentionally deferred.
8. Deploy only additive, validated Supabase migrations and verify live RLS/data preservation when authorized.
9. Finish on an exact pushed SHA with GitHub Actions `quality` and `e2e` green.

## Non-Goals

This is not another product-expansion wave.

Do NOT add:

- AI planning/autonomous mutation;
- collaboration or sharing;
- calendar scheduling integrations;
- a seventh top-level navigation tab;
- unrelated new feature families;
- arbitrary account merge/switch semantics;
- generalized two-way multi-master sync.

## Definition of Done

This change is complete only when:

- all audited defects are reproduced by tests and fixed;
- local schema upgrades and fresh bootstrap are proven;
- Projects/Goals/Daily Plans participate in owner-scoped cloud backup/restore and Portable Backup with backward compatibility;
- owner/RLS isolation is verified;
- source→backup→restore/import semantic equivalence includes Planning Hub state;
- full unit/integration/timezone/E2E/dist-sync/simulation gates pass;
- Android runtime validation is performed when the configured emulator is available, otherwise recorded honestly as ENVIRONMENT;
- Supabase live migration is applied and verified only when safe/authorized;
- working tree is clean;
- local `main == origin/main`;
- remote branch set is main-only;
- exact final SHA has GitHub Actions `quality = PASS` and `e2e = PASS`;
- final documentation and ExecPlan accurately distinguish any genuine external limitations from repository defects.
