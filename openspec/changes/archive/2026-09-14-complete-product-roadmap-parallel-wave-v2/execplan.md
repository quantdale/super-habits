# ExecPlan: Complete Product Roadmap Parallel Wave V2

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the largest remaining product gaps of SuperHabits in one massively
parallel implementation wave: deepen every feature module (planning layer,
core domains, command center, platform shell) so the app behaves like a
complete all-in-one productivity product. Success was ten substantial
delegated work packets implemented, reviewed, and integrated into local main
with minimal gates green and hardening debt explicitly recorded.

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

Eleven delegated work packets (W1–W10 plus a W5 follow-up) under strict path
ownership, orchestrator-owned integration of shared surfaces, campaign
artifacts, and minimal end validation. English only throughout.

## Non-Goals

Schema migrations; sync/backup/portable scope changes; E2E/native/simulation
QA expansion; performance campaigns; CI repair; production-readiness claims.
A dedicated hardening campaign follows this wave.

## Current Checkpoint

- Current milestone: CAMPAIGN COMPLETE — all delegated packets implemented,
  reviewed, integrated, validated, and pushed.
- Completed: repository recovery at 6dbbc42; gap audit; campaign scaffolding;
  11 delegated packets implemented and reviewed; orchestrator integration
  (restoration of race-lost files, screen wiring, shared-surface hooks, type
  fixes); all end gates green; main pushed.
- In progress: None.
- Important modified files: see Changed Files / Areas; full detail in the
  wave commit range `6e0a262..HEAD` (124+ files, ~11.9k insertions).
- Last successful validation: typecheck 0 errors; focused Vitest 346/346
  across 23 wave test files including association invariants; eslint 0 errors
  (8 pre-existing-pattern warnings against a gate of 25); openspec validate
  36/36; agent:plan:validate:all PASS; git diff --check clean.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete. The next session is the dedicated
  hardening campaign, starting from HARDENING_HANDOFF.md.
- Remaining definition of done: Complete — all conditions met and evidenced in
  the Validation Ledger.

## SUB-AGENT ASSIGNMENT MATRIX

| #   | Mission                                                 | Owned paths                                                                                                            | Result commit SHA                                                                    | Status    | Integration status                                                                        | Discoveries / debt                                        |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| W1  | Todos + Habits depth                                    | `features/todos/`, `features/habits/`, `tests/todos*`, `tests/habits*`                                                 | 327e426, f4b1b1f, a552c9d, a3a6079, 140c4c9, d5d6897, 5155428 (+ content in 7d87b93) | completed | accepted; HabitsScreen wiring finished by orchestrator 889bb9d                            | habit lifecycle device-local; bulk ops sequential         |
| W2  | Projects + Goals depth                                  | `features/projects/`, `features/goals/`, `tests/projects*`, `tests/goals*`                                             | 8d85a57, fa388cb, 667d016, 2dce8ac, e1952ca                                          | completed | accepted; goal→project nav prop added by orchestrator 2a36558                             | rollup SQL needs real-SQLite integration tests            |
| W3  | Daily Plan + Planning Hub + Weekly Review               | `features/daily-plan/`, `features/planning-hub/`, `features/weekly-review/`, `tests/dailyPlan*`, `tests/weeklyReview*` | de43679, 69086d6, bae53ae, 4aaafa9, 86ca431                                          | completed | accepted; five race-lost files restored + screens wired by orchestrator 611d755 / 1c712f7 | apply-next-week write path lacks DB-contract test         |
| W4  | Activity Timeline + Progress Insights + Quick Capture   | `features/activity/`, `features/progress/`, `features/quick-capture/`, own tests                                       | 7d87b93, 9db4e9e, aacc17d, bcb43f2, 45d873e                                          | completed | accepted                                                                                  | workout "volume" = session count until schema adds weight |
| W5  | Overview dashboard                                      | `features/overview/`, `tests/overview*.test.ts`                                                                        | follow-up worker agent-10: 84a2624; typing fixes ee283c7                             | completed | accepted (original report truncated; work finished by follow-up)                          | greeting static per render; no per-card secondary actions |
| W6  | Command Center planning coverage                        | `features/command/`, command/ask tests                                                                                 | 50dbdf1, d6b5e64                                                                     | completed | accepted; sibling deletion damage repaired by orchestrator                                | remote parser prompts still needed (INTEGRATION_NEED)     |
| W7  | Pomodoro depth                                          | `features/pomodoro/`, `tests/pomodoro*`                                                                                | 0775d7c (+ content swept into 50dbdf1 / 7d87b93)                                     | completed | accepted                                                                                  | session meta device-local; auto-start timing untested     |
| W8  | Workout depth                                           | `features/workout/`, `tests/workout*`                                                                                  | content landed in 7d87b93 / 50dbdf1 (attribution swept by index races)               | completed | accepted                                                                                  | SCHEMA_REQUEST for weight/reps/duration recorded          |
| W9  | Calories depth                                          | `features/calories/`, `tests/calories*`                                                                                | c1f1fee, ba1b8a2, 14cc150, 52cbc45, ddd83ea, 8a3e9d6, befbc91                        | completed | accepted                                                                                  | targets device-local; copy-day sequential inserts         |
| W10 | Platform completion (reminders, PWA, settings, core/ui) | `core/notifications/`, `core/pwa/`, `lib/notifications.ts`, `features/settings/`, `core/ui/`, `public/sw.js`           | c1016cc, 5b267f1 (+ content in 7d87b93)                                              | completed | accepted; banner/indicator mounted by orchestrator 2a36558                                | snooze handler pending; scheduler bridges need mocks      |

Orchestrator-reserved hotspots were never edited by workers. During
integration the orchestrator alone changed `app/_layout.tsx`,
`features/goals/GoalDetailView.tsx`, `features/todos/todos.data.ts`, planning
domain/test repairs, and campaign artifacts (commits 611d755, 889bb9d,
2a36558, ee283c7, 1c712f7, d49d4fe).

## Progress

- [x] Recover repository to origin/main (6dbbc42, clean)
- [x] Read authoritative guidance and discover plans
- [x] Audit gaps and design 10 non-overlapping packets
- [x] Write campaign proposal/design/spec/tasks/ExecPlan/HARDENING_HANDOFF
- [x] Validate OpenSpec artifacts and ExecPlan structure
- [x] Spawn 10 sub-agents (W1–W10), all completed
- [x] Collect and review worker reports/diffs
- [x] Integrate accepted work serially; apply shared integration
- [x] Second-pass delegation: W5 follow-up worker completed Overview wiring
- [x] Record SCHEMA_REQUESTs / debt in HARDENING_HANDOFF
- [x] Minimal end gates green
- [x] Reconcile ExecPlan to COMPLETED; push main; clean tree

## Surprises & Discoveries

- The "six tab" description in older docs understates reality: 17 feature
  modules exist; the productivity-expansion layer is present but thin — that
  thinness was the wave's main target.
- Schema v15 already carries project/goal associations on todos and habits, so
  most planned depth needed no migration; the schema freeze was low-cost.
- lint-staged's stash-based pre-commit hook is unsafe with concurrent agents:
  it caused lost unstaged edits, cross-worker commit attribution, deletion of
  committed W3 files, and merge markers landing at HEAD. All damage was
  detected and repaired; see HARDENING_HANDOFF for the recommendation.

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
- 2026-08-20 — W5 packet re-delegated to a follow-up worker — the original
  worker's final report was truncated mid-run and its screen wiring had not
  landed; a focused follow-up completed and committed it cleanly.

## Validation Ledger

- 2026-08-20 — `git fetch --prune && git status` — PASS — clean tree, main == origin/main at 6dbbc42.
- 2026-08-20 — `npm run agent:plans` — PASS — 8 COMPLETED plans, 1 ACTIVE hardening plan awaiting environment-dependent gates only.
- 2026-08-20 — `npm run openspec:validate` — PASS — 36/36 items after scaffolding and again at close.
- 2026-08-20 — `npm run agent:plan:validate -- --plan <this plan>` — PASS — ACTIVE pre-delegation; COMPLETED at close via validate:all.
- 2026-08-20 — `npx tsc --noEmit` — PASS — 0 errors repo-wide after integration.
- 2026-08-20 — `npx vitest run <23 wave test files>` (TZ=Asia/Manila) — PASS — 346/346 including associationInvariants.
- 2026-08-20 — `npx eslint app/ features/ core/ lib/ tests/ --max-warnings 25` — PASS — 0 errors, 8 warnings (pre-existing patterns).
- 2026-08-20 — `git diff --check` — PASS — no whitespace/conflict artifacts.
- 2026-08-20 — `git push origin main` — PASS — recorded at close; local main == origin/main.

## Changed Files / Areas

- `openspec/changes/complete-product-roadmap-parallel-wave-v2/**` — campaign
  artifacts (proposal, design, spec delta, tasks, ExecPlan, handoff).
- Worker + integration changes: 124+ files across all 17 feature modules,
  `core/ui`, `core/notifications`, `core/pwa`, `lib/notifications.ts`,
  `features/settings`, `public/sw.js`, and 23 test files (~11.9k insertions).
  Git remains the authority; the matrix above maps packets to commits.

## Recovery / Resume Instructions

1. This plan is COMPLETED; no implementation resume action exists.
2. For the next campaign, read HARDENING_HANDOFF.md in this change folder and
   `docs/testing/autonomous-qa.md`; start from its RISKs and DEFERRED lists.

## Outcomes & Retrospective

- Status: Completed.
- Summary: eleven delegated packets delivered planning-system depth (project/
  goal rollups, carry-forward, briefings, review outputs), dashboard
  customization, command-center planning intents through the safe pipeline,
  pomodoro association/presets/stats, workout PRs/templates/rest/volume,
  calorie trends/targets/copy-day, to-do due-date and daily-plan reminders
  behind platform guards, PWA update/offline affordances, settings entries,
  and new shared UI primitives — integrated with all minimal gates green.
- Follow-up: the dedicated hardening campaign owns E2E/native QA, the three
  recorded SCHEMA_REQUESTs, remote parser prompt updates, stash cleanup, and
  the lint-staged parallel-safety fix (see HARDENING_HANDOFF.md).
- Lessons: shared-tree parallelism works only with per-worker pathspec
  discipline AND a serialization-safe commit hook; lint-staged must be
  disabled or serialized for future parallel waves.
