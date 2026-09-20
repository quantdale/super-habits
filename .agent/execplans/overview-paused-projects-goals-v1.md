# ExecPlan: Overview Paused Projects/Goals Inclusion

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

The Overview dashboard must honour the same live-portfolio contract as every other planning surface: a paused project or goal is still live work, not retired. Today `shapeProjectsSummary` / `shapeGoalsSummary` count only `status === 'active'`, so pausing a project makes it vanish from the dashboard ("No active projects") while the Projects list (default `all` filter), `countActiveProjects` / `countActiveGoals` (`NOT IN ('completed','archived')`), `ACTIVE_PROJECT_STATUSES` / `ACTIVE_GOAL_STATUSES` (`['active','paused']`), progress rollups, and the Planning Hub briefing (`activeProjectCount` / `activeGoalCount`) all still treat it as live. Fix the contradiction so paused items stay visible in counts, previews, averages, and empty-state CTA gating.

## Context

- Domain authorities (single source of truth for "live"):
  - `features/projects/projects.domain.ts:15`: `ACTIVE_PROJECT_STATUSES = ['active','paused']` ("live for active-project progress summaries").
  - `features/goals/goals.domain.ts:16`: `ACTIVE_GOAL_STATUSES = ['active','paused']`.
- Data counts (include paused):
  - `features/projects/projects.data.ts:275`: `status NOT IN ('completed','archived')`.
  - `features/goals/goals.data.ts:263`: `status NOT IN ('completed','archived')`.
  - `features/progress/progress.data.ts:242`: goals average over `NOT IN ('completed','archived')`.
- Briefing (calls them "active" but counts live):
  - `features/planning-hub/planningHub.briefing.ts:45-46,78-79`: `activeProjectCount` / `activeGoalCount` via the same `countActive*` helpers.
- Offenders:
  - `features/overview/overview.domain.ts:392-398`: `projects.filter((p) => p.status === 'active')`.
  - `features/overview/overview.domain.ts:406-418`: `goals.filter((g) => g.status === 'active')`.
- Consumers: `OverviewScreen.tsx:191-192` summaries; `ProjectsCard` / `GoalsCard` ("N active", empty when 0); `pickEmptyStateCta` / `listEmptyStateCtas` chain (`activeCount > 0`).
- Existing test pins the buggy behaviour: `tests/overview.test.ts:408-417` expects a paused project excluded (`activeCount 2`, preview `[p1,p3]` with `p2 paused` present). Goals test has no paused case.
- Habit analogy (why habits differ): paused habits owe nothing today, so `shapeHabitsSummary` correctly excludes them via `isActiveHabit`. Projects/goals have no today-obligation; pause means still-live portfolio. Status+history writes are atomic (`setHabitLifecycleStatus`), so no interval-mask nuance applies here.
- Import safety: `overview.domain` already imports `dailyPlan.domain`, `habits.domain`, `goals.types`, `projects.types`, `calories.domain`. `projects.domain` imports only `projects.types`; `goals.domain` imports `goals.types` + `projects.domain` (pure). No cycle back to overview.

## Scope

- Change `shapeProjectsSummary` to count/preview `active` + `paused` via `ACTIVE_PROJECT_STATUSES` (single source, not inline string union).
- Change `shapeGoalsSummary` to count/preview/average over `active` + `paused` via `ACTIVE_GOAL_STATUSES`.
- Update `tests/overview.test.ts`: paused project included (count + preview order); add paused-goal case (count + average + preview). Keep empty-input case.
- Targeted Vitest + `npm run typecheck` (+ eslint on touched files); local commit.

## Non-Goals

- No pomodoro-session assert invention (no UI message contract exists).
- No settings normalize-on-write policy rewrite.
- No weekly-review draft-shape contract invention.
- No `applyRemote*` changes (restore-only by design).
- No card copy redesign ("N active" wording already means live in briefing/progress contexts; no label change).
- No native/device/CI/Supabase/store lanes; no push/tags/EAS/PII.
- No change to Habits summary (paused exclusion correct there), no change to schedule resolution, no new validators.

## Current Checkpoint

- Current milestone: COMPLETE — fix verified and committed locally.
- Completed: Survey; RED (2 failed / 32 passed on paused-inclusion cases); GREEN fix (summaries use ACTIVE_PROJECT_STATUSES / ACTIVE_GOAL_STATUSES); related suites 63/63; typecheck 0 errors; eslint clean on touched files; local commit.
- In progress: None.
- Important modified files: `features/overview/overview.domain.ts`, `tests/overview.test.ts`.
- Last successful validation: 34/34 overview + 63/63 related + typecheck + eslint (2026-09-20).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — all conditions proven (RED 2-fail pre-fix; paused projects/goals counted via domain authorities; 34/34 + 63/63 green; typecheck + lint green; committed locally).

## Progress

- [x] Survey candidates against HEAD; isolate one real box-executable gap.
- [x] ExecPlan created (Plan-Version: 2, ACTIVE).
- [x] RED: failing paused-inclusion tests.
- [x] GREEN: summaries use ACTIVE_PROJECT_STATUSES / ACTIVE_GOAL_STATUSES.
- [x] Targeted tests + typecheck (+ lint) pass.
- [x] Local commit + plan COMPLETED + validate.

## Surprises & Discoveries

- Existing `tests/overview.test.ts` pinned the buggy behaviour by name ("keeps active projects only" with a paused row expected excluded); the fix renames the intent to live-portfolio and updates the pin rather than weakening coverage.

## Decision Log

- 2026-09-20 — Chose ACTIVE_* domain constants as fix source (not inline `!== completed/archived`) to keep one authority; equivalent today but survives future status additions.
- 2026-09-20 — Chose not to relabel cards ("N active" stays): briefing/progress already use "active" to mean live (active+paused); relabel would expand scope into copy design.
- 2026-09-20 — Ruled out Todos/Habits missing-catch and DailyPlan persist guard as the chosen gap: pre-validation mirrors are exact with same messages; remaining throw paths are rare FK races (project/goal deleted mid-save) or idempotent/clamped upserts — lower value than the dashboard silent-drop of all paused portfolio items.

## Validation Ledger

- 2026-09-20 — Survey vs HEAD 22c928e — PASS (evidence only, no run).
- 2026-09-20 — `npx vitest run tests/overview.test.ts` pre-fix — FAIL RED (2 failed / 32 passed: paused project count + paused goal count).
- 2026-09-20 — `npx vitest run tests/overview.test.ts` post-fix — PASS (34/34).
- 2026-09-20 — `npx vitest run tests/overview.test.ts tests/planningHub.briefing.test.ts tests/projects.domain.test.ts tests/goals.domain.test.ts` — PASS (63/63).
- 2026-09-20 — `npm run typecheck` — PASS (0 errors).
- 2026-09-20 — `npx eslint features/overview/overview.domain.ts tests/overview.test.ts --max-warnings 0` — PASS (clean).

## Changed Files / Areas

- `features/overview/overview.domain.ts` — reason: use ACTIVE_* for projects/goals summaries.
- `tests/overview.test.ts` — reason: RED→GREEN coverage for paused inclusion.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan completely.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`; reconcile with checkpoint (Git wins).
3. Continue from `Exact next action` above.
4. After fix: `npx vitest run tests/overview.test.ts`, `npm run typecheck`, `npx eslint features/overview/overview.domain.ts tests/overview.test.ts --max-warnings 0`.
5. Commit locally; mark plan COMPLETED; run `npm run agent:plan:validate -- --plan .agent/execplans/overview-paused-projects-goals-v1.md`.

## Outcomes & Retrospective

- Status: Completed.
- Summary: Overview projects/goals summaries now use the domain live-portfolio authorities (active + paused); paused portfolio no longer silently drops from dashboard counts, previews, goal averages, or empty-state CTA gating. RED→GREEN proven; no label/copy change.
- Follow-up: None. Thinning survey remains the next step per Run 1 mission (no further high-value box-executable gap claimed here).
