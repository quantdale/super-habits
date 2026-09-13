# Proposal: Complete Repository Depth & Truth V1

## Summary

Close the remaining evidence-backed gaps found by a fresh repository audit at `c65b96a`: a fully implemented but never-invoked durable-state migration for legacy Pomodoro session metadata, a fully implemented but UI-unreachable daily-plan deletion capability, duplicate/dead internal APIs around correctness-sensitive paths, zero-oracle test surfaces across several mature sections, and multiple confirmed documentation-truth discrepancies.

## Why

- `migrateLegacySessionMeta` (`features/pomodoro/pomodoro.sessionMeta.ts`) promotes legacy device-local AsyncStorage session association/note maps into the durable `pomodoro_sessions` columns (migration 20) and retires the legacy keys. It has unit tests and a documented contract, but no production caller: legacy notes/associations stay in AsyncStorage, out of backup/restore, forever.
- `softDeleteDailyPlan` (`features/daily-plan/dailyPlan.data.ts`) is the only plan-deletion implementation and is covered by integration tests, but the Plan history surface is read-only with no delete affordance.
- The todo reminder cancel path is duplicated: `cancelTodoReminderSafely` exists in `core/notifications/todoReminderScheduler.ts` with a docstring saying the todos data layer wraps its sync points with it, while `features/todos/todos.data.ts` defines a private copy.
- `WEEKLY_REVIEW_REMINDER_DATA_VERSION` exists but the weekly-review scheduler hardcodes `version: 1`.
- `getBackfillStatus` in `core/backup/backupBackfill.ts` is a dead public API while `backupRestore.ts` keeps a private duplicate with the correct scope-version comparison.
- `createPreferencePrecedenceGuard` (F-05 fix) is tested but adopted nowhere; Calories keeps its ad-hoc equivalent.
- Multiple shipped write surfaces certify through UI text only: `e2e/todos.spec.ts`, `e2e/calories.spec.ts`, `e2e/workout-gym-v2.spec.ts`, `e2e/settings.spec.ts` carry zero data-layer oracles, the Overview surface (next-best-action, customize cards) has no direct E2E, Todo bulk operations have no real-SQL integration test, and planning/workout/pomodoro-timer/motion paths lack real-SQL or unit coverage.
- AGENTS.md/README/structure maps/known-gaps contain confirmed stale claims (tab labels, Settings IA buckets, test inventories, lint gate, createId prefixes, dependency pins, E2E project list).

## What Changes

- **legacy-pomodoro-session-meta-promotion** (new): bootstrap promotes legacy AsyncStorage session metadata into durable columns exactly once, retires the keys, drops orphans, never clobbers newer data, and never blocks startup.
- **daily-plan-deletion** (new): Plan history gains a confirmed danger delete that soft-deletes the plan with one durable delete intent and excludes it from history/adherence.
- Consolidations (no behavior change): single `cancelTodoReminderSafely`, scheduler uses `WEEKLY_REVIEW_REMINDER_DATA_VERSION`, dead `getBackfillStatus` removed, preference-precedence guard adopted where an ad-hoc equivalent exists.
- Test floor: real-SQL integration suites for Todo bulk, planning detail/history queries, Workout Gym V2 mutators/queries, Pomodoro active timer, habit lifecycle/rule paths, motion preference; E2E data oracles added to the zero-oracle specs; a direct Overview E2E; planning history/delete journey.
- Documentation truth: AGENTS.md, README.md, both structure maps, known-gaps register, ui-ux README, and stale claims corrected to code reality.
- Bounded dead-code removal: zero-reference, zero-test exports and UI components only.

## Non-Goals

No new top-level section, no new product feature beyond activating already-implemented capabilities, no schema migration, no two-way sync, no external Supabase/iOS lanes, no test weakening, no broad refactors outside the named consolidations, no reopening of completed Production Hardening V1 / Certification Infrastructure V2 campaigns.

## Impact

- Affected specs: `daily-plan-deletion`, `legacy-pomodoro-session-meta-promotion` (both new).
- Affected code: `core/providers/AppProviders.tsx`, `features/pomodoro/*`, `features/daily-plan/*`, `features/todos/todos.data.ts`, `core/notifications/todoReminderScheduler.ts`, `core/backup/*`, `features/calories/*`, `lib/preferencePrecedence.ts`, docs, tests, e2e.
- Persistence: no schema change (version stays 24); writes reuse `runBackupMutation`/durable outbox.
