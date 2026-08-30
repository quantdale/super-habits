# Design — Harden UI/UX Mass Implementation Wave V1

## 1. Source of truth

Read and reconcile all of the following before fixes:

- `AGENTS.md`
- `.agent/PLANS.md`
- `docs/ui-ux/README.md`
- `docs/ui-ux/01-current-state-audit.md`
- `docs/ui-ux/02-design-dna.md`
- `docs/ui-ux/03-feature-blueprints.md`
- `docs/ui-ux/04-roadmap-and-acceptance.md`
- `docs/ui-ux/05-inspiration-research.md`
- `openspec/changes/harden-parallel-completion-wave-v2/**`
- this change.

The UI/UX documents define the design contract; current production code defines actual behavior; OpenSpec defines required correctness.

## 2. Reconcile the previous hardening campaign first

`harden-parallel-completion-wave-v2` remains ACTIVE even though substantial implementation and E2E triage landed before the UI/UX wave. Do not abandon it or falsely mark it complete.

The new hardening orchestrator must:

1. read its current ExecPlan/tasks/evidence;
2. map already-implemented items to actual code/evidence;
3. rerun the required gates against current `main` rather than trusting pre-UI-wave runs;
4. carry unresolved requirements into this campaign;
5. mark the old plan COMPLETED only when its non-environment definition of done is now genuinely satisfied, otherwise leave it ACTIVE/BLOCKED with exact reason.

## 3. Authoritative schema state

Current local migration head is 21:

- migration 20 introduced durable Habit lifecycle, Pomodoro metadata, workout-set metrics/timing, and related hardening data;
- migration 21 adds `daily_plans.top_todo_titles`.

Never reuse migration 20 or 21. Any new local migration starts at the actual next free version, expected >=22.

## 4. Live Supabase convergence is blocking

Independent live query after the code wave found production migration ledger still ends at `20260820010000_planning_schema_convergence`.

The repository contains later migrations that are not live:

- `20260821000000_weekly_reviews_remote_table.sql`
- `20260821010000_hardening_wave_v2_durable_columns.sql`
- `20260822000000_daily_plan_priority_title_snapshots.sql`

Before applying:

- inspect the DDL against current live rows/schema;
- snapshot row counts, owner/null/orphan counts, RLS/policies/grants/indexes;
- validate migration order and idempotent/additive safety.

After applying:

- verify migration ledger;
- verify all expected columns/tables/FKs/indexes;
- verify owner RLS and grants;
- verify existing row counts/owners are preserved;
- run the schema validator and remote-boundary/dist-sync lane.

Do not mark this campaign complete while the client requires remote fields/tables that production lacks.

## 5. UI/UX regression strategy

The code-only wave intentionally changed selectors, hierarchy, modal behavior, filters, navigation affordances, and visual states. Tests must be updated only when the product change is correct.

For every failing E2E assertion:

1. reproduce against current UI;
2. classify as PRODUCT_BUG, TEST_DRIFT, FLAKY, ENVIRONMENT, or SPEC_AMBIGUITY;
3. for TEST_DRIFT, update selectors/assertions to semantic roles, labels, IDs, or stable user-visible contracts;
4. never delete/skip/weaken a meaningful journey merely because the UI changed.

Priority journeys:

- Todo delete confirmation and Filters disclosure;
- Habit day strip, quantitative check-in, lifecycle behavior;
- Pomodoro resting/active/completion/recovery modes;
- Workout resume, measurements, PR/history, rest timer;
- Calories quick kcal, frequent foods, target/diary behavior;
- Today/Overview Next Best Action, pinned orientation, zero-data onboarding;
- Guided Planning flow and priority title snapshots;
- responsive shell, focus visibility, reduced motion, keyboard navigation.

## 6. Known product debts to resolve

### Workout resumed drafts

The wave reports mid-session draft persistence but measurements entered into resumed drafts are not fully persisted. Hardening must establish whether weight/reps/completion/timing state survives suspend/reload/restart at the same semantic point without fabricating completed sets.

### Quick Add kcal

Quick kcal currently uses the saved-meal/upsert path. Verify that a one-off quick calorie log does not unintentionally create/update saved-meal history, usage counts, or suggestions unless the user explicitly chose to save/reuse it. Split the canonical paths if necessary.

### Pomodoro crash recovery completion summary

A recovered completed/finishing focus session must produce the same exactly-once persisted session and coherent completion UX as a non-crash path. No duplicate log, no lost log, no missing required summary caused solely by recovery.

### Habit past-day lifecycle enforcement

Historical check-in UI must not permit writes on dates where the habit was paused, archived, not yet effective, or otherwise non-actionable according to authoritative lifecycle/schedule history. Enforce this in the data/domain boundary, not UI alone.

### Daily Plan priority title snapshots

Migration 21 adds historical title snapshots. Validate alignment of `top_todo_ids` and `top_todo_titles`, fallback behavior for pre-v21 plans, rename/delete behavior, Backup Scope/Portable/Supabase canonicalization, corruption handling, and restore/import.

## 7. Warm Momentum design-system acceptance

Hardening must verify the new design system rather than restyle it again.

Required properties:

- shared semantic spacing/radius/type/elevation/layout/motion tokens are used coherently;
- reduced-motion preference actually changes animation behavior and remains understandable;
- interactive components expose visible focus/pressed/disabled/loading states where applicable;
- no critical state relies on color alone;
- ordinary missed/over-target states remain neutral rather than punitive;
- high-frequency actions remain as fast or faster than before;
- phone/tablet/web layouts do not clip or hide primary actions;
- keyboard and screen-reader semantics are preserved or improved.

## 8. Testing ladder

Run in escalating order and fix root causes:

1. typecheck + lint;
2. full Vitest/integration;
3. OpenSpec + ExecPlan validation;
4. Supabase schema validator;
5. web build;
6. focused Playwright for changed surfaces;
7. full Playwright/journeys/PWA;
8. deterministic simulations;
9. timezone matrix;
10. dist-sync/remote-boundary;
11. native Android/iOS when environment is available;
12. live Supabase/Edge Function verification;
13. exact-final-SHA GitHub Actions.

Focused reruns are diagnostic only. Completion requires the broad gates defined in tasks/spec.

## 9. Sub-agent policy

Sub-agents are encouraged for disjoint hardening packets such as Todos/Habits, Focus/Workout, Calories/Today, Planning/accessibility, and E2E triage.

The orchestrator exclusively owns:

- `core/db/client.ts` migration numbering;
- Backup/Restore/Portable contracts;
- Supabase migration application;
- account/sync safety;
- campaign ExecPlans/tasks;
- final integration and CI closure.

No shared-tree concurrent commits that can invoke stash-based lint-staged races. Use worktrees/branches where practical or serialize commits.

## 10. Completion philosophy

Do not add new product scope during hardening. Fix correctness, integration, accessibility, persistence, deployment, and regressions until the implemented product is demonstrably coherent.
