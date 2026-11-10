# ExecPlan: Projects & Goals E2E lifecycle coverage

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Projects and Goals had only a handful of E2E tests spread across the planning
specs (`planning-hub.spec.ts`, `planning-w11.spec.ts`,
`planning-w115-reliability.spec.ts`, `projects-status-back-race.spec.ts`). This
task adds ONE new spec that drives the real user journeys end to end on web —
create/edit/lifecycle/association/delete/persistence for both entities, keyboard
and rendered a11y on every reached control — asserting UI state AND persisted
SQLite rows/intents through the existing DB-harness oracles.

Observable success: `e2e/projects-goals-lifecycle.spec.ts` passes deterministically
(3 repeats) at `E2E_PORT=8099`, adds no product change, and does not touch existing
specs, helper behaviour, or shared code.

## Context

- Worktree `/workspace/wt-test-projects-goals`, branch `test/projects-goals-lifecycle`
  from `main 97b25e92`. Isolated E2E port **8099**.
- Product surfaces: `features/projects/` (`ProjectListView`, `ProjectDetailView`,
  `projects.data.ts`, `projects.domain.ts`) and `features/goals/` (`GoalListView`,
  `GoalDetailView`, `goals.data.ts`, `goals.domain.ts`). Both detail views are
  rendered inside `PlanningHubScreen` (`features/planning-hub/`) — read-only here.
- Entry path every planning spec uses: Overview → `Plan today` → the
  `Planning hub views` tablist → `Projects` / `Goals` tab → row press → detail.
- Oracles: `e2e/helpers/oracles.ts` + `e2e/helpers/dbHarness.ts` (`queryRows`,
  `runSql`, `returnToApp`). The DB harness destroys app React state, so all UI
  steps finish before row oracles; `returnToApp(page)` re-enters the app.
- Validation needs a hermetic `dist/` (`npm run build:e2e`; ambient
  `EXPO_PUBLIC_SUPABASE_*` must stay unset).

## Scope

- New `e2e/projects-goals-lifecycle.spec.ts` (single file).
- `features/projects/*` / `features/goals/*` fixes ONLY if a test reveals a real,
  small, confined product bug.

## Non-Goals

- No changes to `features/planning-hub|weekly-review|daily-plan|todos|habits|pomodoro`,
  `core/*`, `constants/*`, tailwind, `package*.json`, `playwright.config.ts`, golden
  PNGs, `e2e/helpers/*` behaviour, or any existing spec.
- No new dependencies, no commits/push/PR, no golden PNG updates, no use of ports
  8081/8082.

## Current Checkpoint

Milestone: complete.

Completed:

- Read product sources (`projects.data/.domain`, `ProjectListView`, `ProjectDetailView`,
  `goals.data/.domain`, `GoalListView`, `GoalDetailView`, `PlanningHubScreen`,
  `PlanningSummaryRow`) and existing planning coverage (`planning-hub`, `planning-w11`,
  `planning-w12`, `planning-w115-reliability`, `projects-status-back-race`) plus the
  fixtures/helpers used by them.
- Wrote `e2e/projects-goals-lifecycle.spec.ts` (7 tests).
- Built the hermetic export and ran the spec to determinism.

In progress: nothing.

Modified files: `e2e/projects-goals-lifecycle.spec.ts` (new), this plan.

Last successful validation:

- `npm run build:e2e` OK (hermetic dist).
- New spec 7/7 passed; `--repeat-each=3` → 21/21 passed.
- New spec + `planning-hub` + `planning-w11` + `projects-status-back-race` → 16/16.
- `npm run typecheck` 0 errors; eslint/prettier clean on the new spec.
- `npm run web:hygiene` PASS (8081/8082 free, 8099 released).

Current failures: none.

Relevant quarantines: none.

Blockers: None.

Exact next action: none — parent runs the full gates, commits and opens the draft PR.

Remaining definition of done: Complete — all seven journeys pass with `--repeat-each=3`, the full gates are green (see Validation Ledger), and @codex review is the only step left to the parent.

## Progress

- [x] Read product sources + existing E2E coverage
- [x] Write the new spec
- [x] Build hermetic dist and run the spec (3× determinism)
- [x] eslint/prettier on the touched file
- [x] Report handed to the parent session

## Surprises & Discoveries

- `ProjectDetailView` has **no archive/unarchive toggle** and delete is an
  **unconfirmed** `Delete Project` button; `GoalDetailView` matches (`Delete Goal`,
  unconfirmed). Status reversal exists only through the editor's Status chips +
  Save, and the lifecycle row disappears entirely once a row is archived. The spec
  pins exactly what the UI offers (chips for reversal) and the real delete path.
  These are UX gaps (destructive action without confirmation), not data defects:
  tombstone + H9 child reconciliation + outbox intent all behave correctly and are
  already pinned by `planning-w115-reliability.spec.ts`. Not fixed here because a
  shared confirmation would require `core/ui` changes, outside this task's file split.
- The Plan overlay keeps the app shell mounted behind it, and Overview renders the
  same todo title as the project's "Next up" candidate row. Candidate rows are
  therefore addressed by their own `• <title>` accessible name, and audits scope out
  the shell `[role="tabpanel"]`/`[role="tablist"]` nodes (the same scoping
  `planning-v2-surfaces.spec.ts` uses).
- Goal progress validation lives at the `Set`/save boundary: typing `150` or `-5`
  shows a field error and leaves the committed value untouched (no silent clamp),
  while the `+/-10` buttons clamp at 0/100.
- Options disclosures are named per view (`Project more options` / `Goal more
options`, default `accessibilityLabel` "… more options"), not "More options".

## Decision Log

- One spec file, ordered so every test finishes its UI steps before row oracles.
- Reuse `clearDatabase`, `goToTab`, `planningHubTab`, `seedSql`/`runSql`, `queryRows`,
  `returnToApp`; no `data-testid` (project rule).
- UI-created rows carry the write-path assertions (outbox intents only exist for the
  real data layer); raw SQL seeds only the todo a journey does not author.
- The rejected-delete test asserts that no DELETE intent exists after the failed
  write (the create intent legitimately remains queued) instead of pinning a total
  outbox count, which would encode an implementation detail as a product contract.

## Validation Ledger

| Command                                                                                         | Outcome                              | Date       |
| ----------------------------------------------------------------------------------------------- | ------------------------------------ | ---------- |
| `npm run build:e2e`                                                                             | OK — hermetic dist, 0 Supabase hosts | 2026-11-10 |
| `env E2E_PORT=8099 npx playwright test e2e/projects-goals-lifecycle.spec.ts --project=chromium` | 7 passed (1.1m)                      | 2026-11-10 |
| same spec, `--repeat-each=3`                                                                    | 21 passed (3.4m)                     | 2026-11-10 |
| new spec + `planning-hub` + `planning-w11` + `projects-status-back-race` (chromium)             | 16 passed (2.1m)                     | 2026-11-10 |
| `npm run typecheck`                                                                             | 0 errors                             | 2026-11-10 |
| `npx eslint e2e/projects-goals-lifecycle.spec.ts --max-warnings 0` + `npx prettier --check`     | clean                                | 2026-11-10 |
| `npm run web:hygiene`                                                                           | PASS — 8081/8082 free                | 2026-11-10 |

## Changed Files / Areas

- `e2e/projects-goals-lifecycle.spec.ts` (new, 7 tests)
- `.agent/execplans/projects-goals-e2e-lifecycle-v1.md` (this plan)

No product files changed: no product bug was found in `features/projects/*` or
`features/goals/*`.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, this plan, then `git status --short`.
2. Re-read the sources listed in Context.
3. Run the spec:
   `flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh env E2E_PORT=8099 npx playwright test e2e/projects-goals-lifecycle.spec.ts --project=chromium`
   (rebuild `dist/` first with `npm run build:e2e` after any product change).

## Outcomes & Retrospective

Delivered the first end-to-end lifecycle coverage for Projects and Goals: seven
tests that each assert rendered state plus the persisted row/intent evidence, with
no fixed sleeps and no product change. The journeys cover validation, editing,
every reachable status transition and reversal, task/goal↔project association with
progress recomputation, tombstone deletion that keeps children alive, the
failure/retry path for a rejected delete, cold-reload persistence, and keyboard +
rendered a11y at 390px. Two UX gaps (unconfirmed destructive delete, no un-archive
control) are recorded above rather than papered over; neither is a data defect and
both are outside this task's allowed file split to change.
