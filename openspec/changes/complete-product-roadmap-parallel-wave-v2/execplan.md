# ExecPlan: Complete Product Roadmap Parallel Wave V2

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Close the largest remaining product gaps of SuperHabits in one massively
parallel implementation wave: deepen every feature module (planning layer,
core domains, command center, platform shell) so the app behaves like a
complete all-in-one productivity product. Success is ten substantial delegated
work packets implemented, reviewed, and integrated into local main with
minimal gates green and hardening debt explicitly recorded.

## Context

- Repo: Expo SDK 55 + RN 0.83 + TS strict offline-first PWA; SQLite (v15) is
  the source of truth; optional Supabase backup. Single-page shell renders
  sections behind `NavigationContext.activeSection`.
- Layering: `{feature}.data.ts` (SQLite + enqueue) → `{feature}.domain.ts`
  (pure, unit-tested) → `*Screen/View` UI (NativeWind className, no
  StyleSheet.create for new code; FlashList for lists; `core/ui` primitives).
- Invariants: soft delete only; `syncEngine.enqueue` after writes to synced
  entities; `getDatabase()` singleton; `createId(prefix)`; `toDateKey()`;
  append-only migrations (frozen at v15 this wave — no `core/db` edits).
- Starting point: SHA 6dbbc42, clean tree, main == origin/main. Prior waves
  completed backup V2/V4, portable V1, recoverable account V1, linked actions,
  weekly review V1, productivity expansion V1 + its hardening wave.

## Scope

Ten delegated work packets (matrix below) plus orchestrator-owned integration,
campaign artifacts, and minimal end validation. English only throughout.

## Non-Goals

Schema migrations; sync/backup/portable scope changes; E2E/native/simulation
QA expansion; performance campaigns; CI repair; production-readiness claims.
A dedicated hardening campaign follows this wave.

## Current Checkpoint

- Current milestone: Delegation phase — 10 workers spawned and running.
- Completed: Repository recovery (fetch/prune, clean tree at 6dbbc42);
  authoritative docs read (`AGENTS.md`, `.agent/PLANS.md`,
  `docs/PROJECT_STRUCTURE_MAP.md`, plan discovery via `npm run agent:plans`);
  gap audit (thin expansion modules 84–820 lines vs mature core 1.4k–6.2k;
  command intents lack planning entities; notifications habit-only;
  minimal PWA surface); campaign OpenSpec artifacts written and validated.
- In progress: Ten sub-agents implementing packets W1–W10 (matrix below).
- Important modified files: campaign OpenSpec change files only, so far.
- Last successful validation: `npm run openspec:validate` PASS;
  `npm run agent:plan:validate -- --plan openspec/changes/complete-product-roadmap-parallel-wave-v2/execplan.md` PASS (pre-delegation).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Monitor worker completion reports; review each returned
  diff against owned paths; integrate accepted work serially into main.
- Remaining definition of done: ≥10 packets attempted; every returned product
  reviewed; accepted work on local main; shared integration applied;
  HARDENING_HANDOFF current; typecheck/lint/openspec/execplan gates pass;
  main pushed; tree clean; final report delivered.

## SUB-AGENT ASSIGNMENT MATRIX

| #   | Mission                                                                 | Owned paths (exclusive edit rights)                                                                                                                                         | Prohibited overlap                                                    | Expected deliverables                                                        | Branch/worktree                               | Status    | Result commit SHA | Integration status | Discoveries/debt |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------- | --------- | ----------------- | ------------------ | ---------------- |
| W1  | Todos+Habits depth: search/filter/sort, bulk ops, habit history detail  | `features/todos/`, `features/habits/`, `tests/todos*.test.ts`, `tests/habits*.test.ts`, `tests/habitInsights*`                                                              | app/, core/**, features/settings/, other features                     | Domain functions + tests, list toolbar, bulk actions, detail surfaces        | shared tree, owned-path commits to local main | delegated | pending           | pending            | —                |
| W2  | Projects+Goals depth: rollups, detail enrichment, lifecycle flows       | `features/projects/`, `features/goals/`, `tests/projects*.test.ts`, `tests/goals*.test.ts`                                                                                  | app/, core/**, other features                                         | Rollup domain + tests, enriched detail views, filter/sort                    | same                                          | delegated | pending           | pending            | —                |
| W3  | Daily Plan + Planning Hub + Weekly Review continuity                    | `features/daily-plan/`, `features/planning-hub/`, `features/weekly-review/`, `tests/dailyPlan*.test.ts`, `tests/weeklyReview*.test.ts`                                      | app/, core/**, other features                                         | Carry-forward, history nav, adherence, review outputs                        | same                                          | delegated | pending           | pending            | —                |
| W4  | Activity Timeline + Progress Insights + Quick Capture                   | `features/activity/`, `features/progress/`, `features/quick-capture/`, `tests/activityTimeline*.test.ts`, `tests/progress*.test.ts`, `tests/quickCapture*.test.ts`          | app/, core/**, other features                                         | Filters, 7/30/90 comparisons, capture parsing                                | same                                          | delegated | pending           | pending            | —                |
| W5  | Overview dashboard cards + customization                                | `features/overview/`, `tests/overview*.test.ts`                                                                                                                             | app/, core/**, other features                                         | Card set/order persistence, cross-surface summaries                          | same                                          | delegated | pending           | pending            | —                |
| W6  | Command Center planning coverage                                        | `features/command/`, `tests/command*.test.ts`, `tests/ask*.test.ts`, `tests/realCommandParser*.test.ts`                                                                     | app/, core/**, supabase/functions (report-only), other features       | New intents via canonical pipeline, ask retrieval, history/suggestions       | same                                          | delegated | pending           | pending            | —                |
| W7  | Pomodoro depth: association, notes, presets, stats                      | `features/pomodoro/`, `tests/pomodoro*.test.ts`                                                                                                                             | app/, core/**, lib/notifications.ts, other features                   | Association + presets domain/UI, stats views                                 | same                                          | delegated | pending           | pending            | —                |
| W8  | Workout depth: history detail, PRs, templates, rest                     | `features/workout/`, `tests/workout*.test.ts`                                                                                                                               | app/, core/**, other features                                         | PR domain + tests, history detail, duplication, volume charts                | same                                          | delegated | pending           | pending            | —                |
| W9  | Calories depth: trends, targets, copy-day, saved meals                  | `features/calories/`, `tests/calories*.test.ts`                                                                                                                             | app/, core/**, other features                                         | Trend/target domain + UI, copy-day, saved-meal UX                            | same                                          | delegated | pending           | pending            | —                |
| W10 | Platform: reminders beyond habits, PWA offline/update, settings entries | `core/notifications/`, `core/pwa/`, `lib/notifications.ts`, `features/settings/`, `core/ui/`, `public/sw.js`, `tests/notifications*.test.ts`, `tests/inAppNotices*.test.ts` | app/ (report INTEGRATION_NEED), core/db, core/sync, feature internals | Reminder scheduling with guards, SW update bridge, settings bucket additions | same                                          | delegated | pending           | pending            | —                |

Orchestrator-reserved hotspots (no worker may edit): `app/index.tsx`,
`app/_layout.tsx`, `core/providers/**`, `core/db/**`, `core/sync/**`,
`core/backup/**`, `core/auth/**`, `core/portable/**`, `package.json`,
`qa/impact-map.json`, campaign OpenSpec files, `features/shared/`.

## Progress

- [x] Recover repository to origin/main (6dbbc42, clean)
- [x] Read authoritative guidance and discover plans
- [x] Audit gaps and design 10 non-overlapping packets
- [x] Write campaign proposal/design/spec/tasks/ExecPlan/HARDENING_HANDOFF
- [x] Validate OpenSpec artifacts and ExecPlan structure
- [ ] Spawn 10 sub-agents (W1–W10)
- [ ] Collect and review worker reports/diffs
- [ ] Integrate accepted work serially; apply shared integration
- [ ] Second-pass delegation if capacity and gaps remain
- [ ] Record SCHEMA_REQUESTs / debt in HARDENING_HANDOFF
- [ ] Minimal end gates green
- [ ] Reconcile ExecPlan to COMPLETED; push main; clean tree

## Surprises & Discoveries

- The "six tab" description in older docs understates reality: 17 feature
  modules exist; the productivity-expansion layer is present but thin — that
  thinness is the wave's main target.
- Schema v15 already carries project/goal associations on todos and habits, so
  most planned depth needs no migration; schema freeze is low-cost.

## Decision Log

- 2026-08-20 — Shared-tree owned-path commits instead of git worktrees —
  harness subagents share one filesystem and node_modules; Windows junction
  setup for 10 worktrees is the dominant failure risk; path ownership prevents
  collisions equally well.
- 2026-08-20 — Schema frozen at v15 for this wave — avoids concurrent
  migration-number claims; durable-shape needs are recorded as SCHEMA_REQUESTs
  for the next campaign's approved migration.
- 2026-08-20 — Workers commit directly to local main with explicit pathspecs —
  branch switching in a shared tree would destroy parallel uncommitted work;
  nothing is pushed until orchestrator review completes.

## Validation Ledger

- 2026-08-20 — `git fetch --prune && git status` — PASS — clean tree, main == origin/main at 6dbbc42.
- 2026-08-20 — `npm run agent:plans` — PASS — 8 COMPLETED plans, 1 ACTIVE hardening plan awaiting environment-dependent gates only.
- 2026-08-20 — `npm run openspec:validate` — PENDING RERUN — initial run after artifact creation recorded here during integration.
- 2026-08-20 — `npm run agent:plan:validate -- --plan <this plan>` — PENDING RERUN — rerun at each checkpoint.

## Changed Files / Areas

- `openspec/changes/complete-product-roadmap-parallel-wave-v2/**` — campaign
  artifacts (proposal, design, spec delta, tasks, ExecPlan, handoff). Worker
  changes are tracked per-commit by Git; the matrix above records outcomes.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, then this ExecPlan fully.
2. `git status --short`; `git log --oneline -30` — identify worker commits by
   their `wave(wN):` prefixes and compare against the matrix Status column.
3. For each completed-but-unintegrated packet: `git show --stat <sha>`, verify
   owned-path discipline, then integrate/reject per the matrix.
4. Resume from `Exact next action` in Current Checkpoint.

## Outcomes & Retrospective

- Status: Active — filled at campaign close.
