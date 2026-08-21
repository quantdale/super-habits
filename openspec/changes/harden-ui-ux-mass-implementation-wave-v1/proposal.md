# Proposal — Harden UI/UX Mass Implementation Wave V1

## Summary

Harden the code-only UI/UX implementation campaign that advanced `main` from `3ee030cbefb0bbc4438a062e63509adc3656ae4e` to `6dd41bbd51f091aed44f4918ca8f336ec5c421c9` after merging `docs/ui-ux-design-dna` into `main`.

The implementation wave intentionally deferred broad testing. It changed 82 files with roughly 9.1k insertions and introduced/expanded the Warm Momentum design system, Today/Overview, Todos, Habits, Focus, Workout, Calories, Planning, accessibility/settings, responsive shell behavior, and SQLite migration 21 (`daily_plans.top_todo_titles`).

This change is a hardening campaign, not another feature wave.

## Why this change is required

The latest wave explicitly ended with `IMPLEMENTATION COMPLETE — HARDENING/TESTING REQUIRED`. The repository also still has the older `harden-parallel-completion-wave-v2` ExecPlan in ACTIVE state. Its implementation had already advanced the local schema through migration 20 and Backup Scope V5, but its final E2E/live-remote closure was interrupted before the newer UI/UX wave landed.

Independent post-wave review established:

- current remote `main` equals `6dd41bbd51f091aed44f4918ca8f336ec5c421c9` and only remote `main` remains;
- authoritative SQLite migrations now run through version 21, so any new migration must use the actual next free version (expected >=22);
- live Supabase is still only migrated through `20260820010000_planning_schema_convergence`;
- repository migrations `20260821000000_weekly_reviews_remote_table.sql`, `20260821010000_hardening_wave_v2_durable_columns.sql`, and `20260822000000_daily_plan_priority_title_snapshots.sql` are not yet present in the live migration ledger;
- therefore current client Backup/restore/sync contracts are ahead of production remote schema and live convergence is a blocking closure item.

## Goals

1. Reconcile and finish the older ACTIVE hardening campaign without discarding its evidence.
2. Establish a fresh regression baseline on the exact post-UI-wave tree.
3. Fix product regressions and stale test expectations caused by the UI/UX implementation wave.
4. Harden all new high-frequency flows and accessibility/responsive contracts from `docs/ui-ux/`.
5. Resolve the reported workout-resume, quick-kcal, crash-recovery Pomodoro, and past-day Habit lifecycle debts.
6. Apply and verify all required pending Supabase migrations in order when live access is available.
7. Preserve Backup Scope V5, Portable compatibility, owner/RLS safety, and canonical feature mutation boundaries.
8. Obtain green full repository validation and exact-final-SHA GitHub `quality` + `e2e` success.

## Non-goals

- No unrelated feature expansion.
- No visual redesign beyond fixing/hardening the already-implemented Warm Momentum roadmap.
- No history rewrite or force push.
- No weakening meaningful tests or production safety to obtain green CI.
- No false native/mobile PASS when a required environment is unavailable.

## Completion rule

This change is complete only when the post-wave product is broadly validated, live remote schema matches the current client contract where required, the previous ACTIVE hardening plan is honestly reconciled, Git is main-only and clean, and the exact final pushed SHA has GitHub Actions `quality` and `e2e` PASS.