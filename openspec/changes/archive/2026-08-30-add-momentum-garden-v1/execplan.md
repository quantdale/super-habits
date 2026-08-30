# Momentum Garden V1 — Unified Living Progress

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Ship a derived, deterministic Momentum Garden that makes meaningful work from Super Habits visibly accumulate across Tasks, Habits, Focus, Workout, Nutrition, and Planning without adding a score, duplicate event system, or persistence silo. A user should see a calm Today artifact in Overview, open bounded recent history in the existing Progress/Planning surface, and understand exactly which source facts caused each area to grow.

## Context

- Repository: `C:\Users\Michael Roy\Documents\super-habits`, Expo/RN/PWA, local SQLite source of truth, optional Supabase backup.
- Campaign change: `openspec/changes/add-momentum-garden-v1/`.
- Startup source audit confirmed there is no system-wide Momentum/Garden implementation. `features/pomodoro/FocusSprout.tsx` is an isolated Focus visual and remains behaviorally stable.
- Actual startup branch was `codex/post-gym-release-convergence-v1` at `f0e293be906958ff933ca88dec996457cee30f9f`; it was fast-forwarded safely onto local `main`. Initial `git fetch origin --prune` failed with a network connection error; `origin/main` remains the older `3e2c8aa0259ec01bce183049694928f0314c956f` until a later retry.
- Current implementation surfaces: `features/overview/OverviewScreen.tsx`, `features/planning-hub/PlanningHubScreen.tsx`, `features/progress/ProgressInsightsView.tsx`, `features/activity/ActivityTimelineView.tsx`; six-section shell remains in `app/index.tsx`.
- Existing sanctioned utilities: `getDatabase()` singleton, `toDateKey()`, `timestampToLocalDateKey()`, `getUtcIsoRangeForLocalDateKeys()`, `buildDayCompletions()`, theme tokens, `useReducedMotion()`, `useDayRolloverGeneration()`, and foreground refresh hooks.
- Existing source truth: active completed todos, canonical habit rule/completion rows, completed focus sessions, completed workout logs, active calorie-entry dates, completed Daily Plans/Weekly Reviews, and active completed Goal/Project timestamps.

## Scope

- New `features/momentum/` pure domain, read-only data collector, types, SVG art, compact Overview card, and detailed Progress view.
- Explicit source caps and attribution copy; Today and seven-day history, with bounded 28-day detail context.
- Overview and Planning Hub Progress integration, accessible labels/text equivalents, light/dark and reduced-motion behavior.
- Pure Vitest tests, real-SQLite integration tests, targeted Playwright journey, UI roadmap documentation, QA impact metadata if needed.
- Focused validation, native attempt/classification, final normal push to `origin/main`.

## Non-Goals

- No `momentum_events` table, migration, sync/backup/portable entity, Supabase change, or durable “last viewed” flag.
- No opaque Momentum Score, XP/currency, streak punishment, login reward, random reward, leaderboard, social layer, or feature-screen redesign.
- No broad production-readiness sweep beyond gates required by the current impact rules; remaining browser/simulation/native/performance hardening is recorded for the follow-up campaign.

## Current Checkpoint

- Current milestone: Momentum Garden V1 implementation, validation, and delivery complete.
- Completed: OpenSpec artifacts; deterministic domain and bounded SQLite read model; Overview compact card; Planning Hub Progress detail; original native-safe SVG Garden; roadmap documentation; 10 Momentum domain tests; 49 existing habit-domain tests plus an explicit bounded-window regression; 2 real-SQLite integration tests; static web build; complete four-test targeted browser file; shared simulation calorie locator correction; full repository Vitest run; timezone matrix; theme contrast validation; final Git delivery.
- In progress: None.
- Important modified files: `features/momentum/`, `features/habits/habits.domain.ts`, `features/overview/OverviewScreen.tsx`, `features/planning-hub/PlanningHubScreen.tsx`, `simulation/runner/actions.ts`, `tests/momentum.domain.test.ts`, `tests/habits.domain.test.ts`, `tests/integration/momentumGarden.test.ts`, `e2e/momentum-garden.spec.ts`, `openspec/changes/add-momentum-garden-v1/`, and the Phase 4.4 UI roadmap.
- Last successful validation: `npm test` — 150 files / 1,790 tests passed; `npm run qa:timezones` passed all five zones; `npm run validate:themes` passed all 140 checks; `npm run qa:simulation -- --scenario @p0 --mode deterministic` passed the 24-step smoke scenario; `npx playwright test e2e/momentum-garden.spec.ts --project=chromium` passed 4/4; `npm run e2e:journeys:p0` passed 25/25; strict OpenSpec validation, typecheck, focused/full lint, formatting, and `git diff --check` passed.
- Current failures: The first mandatory `qa:fast` aggregate run exposed one FLAKY_TEST in `tests/restore.coordinator.test.ts` (timeout with an unhandled mocked-DB `getFirstAsync` error); the spec passed isolated and the final full Vitest run passed 150/150 files and 1,790/1,790 tests. The first deterministic simulation run exposed four TEST_BUG Calories locators; the runner now uses the actual `Save calorie entry` accessibility contract and the focused smoke scenario, J1, and J3 pass. The full simulation library and two post-Overview-performance long-term probes reached step 201 before a late `Start focus` timeout at step 202; the Garden read is deferred until canonical Overview facts are painted and the compact query is one local day, while the remaining long-horizon issue is preserved for the hardening campaign. The initial Momentum browser TEST_BUGs were fixed and the complete browser rerun is green. The habit-derived read model was tightened with an explicit local window start so historical rules cannot expand a bounded Garden query.
- Relevant quarantines: None.
- Blockers: None for the core implementation. Native smoke/persistence remain ENVIRONMENT evidence only: concurrent Expo prebuild caused the persistence block, and the smoke session terminated with Windows exit `1073807364` during final APK packaging before install/Maestro evidence. Remote fetch was retried successfully; `origin/main` had no advancement.
- Condition required to unblock: None.
- Exact resume action after unblock: None — campaign complete.
- Exact next action: None — task complete; final Git SHA and parity are recorded in the campaign handoff.
- Remaining definition of done: All implementation, validation, and delivery work complete.

## Progress

- [x] Repository startup audit and safe local-main reconciliation.
- [x] Required AGENTS/PLANS/OpenSpec/UI/feature/data/QA guidance read.
- [x] Duplication guard completed: only isolated FocusSprout/Pomodoro GardenGrid exist; no unified system-wide Garden.
- [x] OpenSpec change created with proposal, delta spec, design, and tasks.
- [x] Strict OpenSpec validation passed before implementation.
- [x] Pure domain and tests (10 focused tests pass).
- [x] Bounded read model and integration proof (2 real-SQLite tests pass; outbox unchanged on read).
- [x] Native-safe visual components and Overview integration (focused typecheck pass).
- [x] Progress detail, docs, and E2E (targeted Momentum Playwright file: 4/4 pass).
- [x] Bounded habit-window performance hardening and shared simulation locator correction.
- [x] Final validation, commit, push, parity verification.

## Surprises & Discoveries

- The user prompt’s old `3e2c8aa` main reference was stale; post-Gym release work was already present on a separate local branch. It was preserved through a fast-forward to `main`, never reset or discarded.
- `origin/main` could not be refreshed during startup because GitHub was unreachable; the final retry succeeded and showed no legitimate remote advancement to reconcile.
- Overview already performs several bounded/current-week source reads. The Garden read model must avoid per-habit queries and should use one database connection with bulk bounded SELECTs; a later profile can decide whether to fold reads into Overview’s existing loader.
- Existing FocusSprout uses `react-native-svg` and its own timer visual; changing it is not required for a safe V1.

## Decision Log

1. **Derived read model, no ledger:** authoritative source rows remain the only truth; Garden opens no mutation boundary and is excluded from backup/sync/export.
2. **Independent beds, no score:** Tasks, Habits, Focus, Workout, Nutrition, and Planning each expose a capped level and factual explanation. A tiny source-area count can be descriptive only.
3. **Canonical habits:** group bulk completion rows and call `buildDayCompletions` per active habit; off-days/lifecycle masks stay neutral and target overages do not farm growth.
4. **Daily caps:** Tasks 3, Habits 3, Focus 2 sessions, Workout 1 session, Nutrition one tracked day, Daily Plan one, Weekly Review one; Goal/Project completions are dated milestones only.
5. **Seven-day default, 28-day detail:** all date windows are local-calendar and injected in pure tests; timestamp reads use `getUtcIsoRangeForLocalDateKeys`.
6. **Existing hierarchy:** compact card below pinned Today Progress; detail above existing Progress Insights inside Planning Hub’s existing `progress` view; no seventh tab.
7. **Original compact SVG:** add a small native-safe Garden art component, keep FocusSprout unchanged, and make all graphical children decorative behind a textual summary.

## Validation Ledger

| Check                      | Status                    | Evidence / next action                                                                                                                                                             |
| -------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startup Git truth          | PASS                      | Local `main` at `f0e293b`; final `git fetch origin --prune` succeeded and `origin/main` remained the ancestor `3e2c8aa`.                                                           |
| OpenSpec strict validation | PASS                      | `openspec validate add-momentum-garden-v1 --strict`; final change valid.                                                                                                           |
| Typecheck                  | PASS                      | `npm run qa:fast` completed `tsc --noEmit` successfully.                                                                                                                           |
| Lint / formatting          | PASS with warnings        | `npm run qa:fast` completed with 0 errors / 13 baseline warnings; focused changed-file ESLint passed with `--max-warnings 0`; Prettier check passed.                               |
| Momentum domain tests      | PASS                      | `npx vitest run tests/momentum.domain.test.ts tests/habits.domain.test.ts` — 59/59; final `npm test` — 150 files / 1,790 tests.                                                    |
| Real SQLite integration    | PASS                      | Momentum integration 2/2; final `npm run qa:integration` — 37 files / 212 tests.                                                                                                   |
| Web build / targeted E2E   | PASS                      | Final `npm run build:web`; Momentum Playwright 4/4; `npm run e2e:journeys:p0` 25/25.                                                                                               |
| Timezone matrix            | PASS                      | `npm run qa:timezones` — Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati; 43 tests per zone.                                                              |
| Theme contrast             | PASS                      | `npm run validate:themes` — all 140 checks pass.                                                                                                                                   |
| Simulation                 | PASS with hardening debt  | `npm run sim:validate`; final deterministic `@p0` smoke 24/24 steps pass. Full-library attempts preserve the long-term step-202 `Start focus` timeout for hardening.               |
| Native smoke/targeted      | ENVIRONMENT               | Smoke reached current-source Android packaging then the session terminated before install/Maestro; persistence recorded an ENVIRONMENT prebuild collision. No native pass claimed. |
| QA impact / affected       | PASS with classified debt | `npm run qa:affected`, `npm run qa:fast`, `npm run qa:integration`, P0 journeys, deterministic smoke, and native attempts executed; long-horizon/native follow-up recorded.        |
| ExecPlan validation        | PASS                      | Final `npm run agent:plan:validate -- --plan openspec/changes/add-momentum-garden-v1/execplan.md`.                                                                                 |
| Diff hygiene               | PASS                      | `git diff --check` passed; final staged diff inspected before commit.                                                                                                              |
| Main/remote parity         | PASS                      | Final normal push and exact `HEAD == origin/main` verification are recorded in the campaign handoff.                                                                               |

## Changed Files

Current:

- `openspec/changes/add-momentum-garden-v1/proposal.md`
- `openspec/changes/add-momentum-garden-v1/specs/momentum-garden/spec.md`
- `openspec/changes/add-momentum-garden-v1/design.md`
- `openspec/changes/add-momentum-garden-v1/tasks.md`
- `openspec/changes/add-momentum-garden-v1/execplan.md`

Expected implementation areas:

- `features/momentum/`
- `features/habits/habits.domain.ts`
- `features/overview/OverviewScreen.tsx`
- `features/planning-hub/PlanningHubScreen.tsx`
- `simulation/runner/actions.ts`
- `tests/habits.domain.test.ts`
- `docs/ui-ux/04-roadmap-and-acceptance.md`
- `tests/momentum.domain.test.ts`
- `tests/integration/momentumGarden.test.ts`
- targeted `e2e/` spec and any QA impact metadata required by repository tooling.

## Recovery / Resume Instructions

After context loss or a fresh session:

1. Read `AGENTS.md`, `.agent/PLANS.md`, this file, and `openspec status --change add-momentum-garden-v1`.
2. Run `npm run agent:resume -- --plan openspec/changes/add-momentum-garden-v1/execplan.md` and inspect Git discrepancy/QA warnings.
3. Run `git status --short`, `git diff --stat`, `git diff --name-only`, and inspect relevant diffs; never infer state from conversation history.
4. Continue from the exact `Current Checkpoint` action, updating this plan before and after every meaningful milestone.

## Outcomes & Retrospective

### Delivered outcome

Momentum Garden V1 is implemented as a derived, deterministic read model over existing SQLite facts. Overview now shows a compact Today Garden without blocking the canonical dashboard load; Planning Hub’s existing Progress view defers the bounded 7/28-day detail. The feature has no migration, event ledger, sync entity, backup row, export row, or durable preference.

### Contribution semantics

Tasks cap at three completed tasks per day; Habits count only scheduled, eligible, target-complete occurrences through the canonical rule/lifecycle resolver with off-days and paused/archived days neutral; Focus counts completed positive-duration focus sessions capped at two; Workout counts completed sessions capped at one; Nutrition counts one neutral tracked day regardless of calorie target; Daily Plan and Weekly Review count one completed record each; completed Goal/Project facts appear as dated milestones. Every visual change has a source label and factual explanation.

### Validation and taxonomy

- PRODUCT_BUG: none found in the shipped Garden slices.
- TEST_BUG: corrected the shared simulation Calories locator to use the real `Save calorie entry` accessibility contract; corrected initial Momentum E2E assertions/selectors without weakening product assertions.
- FLAKY_TEST: the first aggregate `qa:fast` run timed out in `restore.coordinator.test.ts`; isolated rerun and final full Vitest run passed.
- ENVIRONMENT: initial remote fetch failure recovered; timezone/theme esbuild spawn failures recovered with the final direct runs; native persistence collided with concurrent Expo prebuild and native smoke ended at APK packaging before Maestro execution.
- EXPECTED_KNOWN_GAP: long-term deterministic simulation reached step 201 and timed out at step 202 while starting Focus after the multi-week sequence. This remains follow-up hardening debt; it does not alter the bounded Garden model or the green focused smoke/P0/browser evidence.

### Remaining hardening debt

Run a clean, sequential current-source Android provision/install and Maestro smoke/persistence pass; isolate and repair the long-term simulation `Start focus` timeout; run the full exhaustive browser/simulation matrix and native lifecycle permutations; perform deeper performance profiling on long-running sessions and compact Overview refreshes. None requires a new Garden persistence architecture.

The implementation met the required user-visible slices: cross-domain Garden, deterministic reconstruction, transparent semantics, Today and Progress integration, native-safe/light-dark/reduced-motion visuals, accessibility summaries, bounded queries, offline operation, and focused automated proof. The final commit SHA and exact pushed `origin/main` SHA are recorded in the final campaign handoff.
