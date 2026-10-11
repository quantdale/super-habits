# ExecPlan: Frontend V3 — W9 Workout wave

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Workout answers "what am I training and logging right now?" instead of
presenting a planning dashboard. Implements the
[frontend-v3-w9-workout OpenSpec change](proposal.md) inside the
[frontend-v3-calm-momentum campaign](../frontend-v3-calm-momentum/execplan.md):
a quick-start-first landing with one resume authority and a compact readable
weekly strip (SYS-20, SUR-06), a set-logging-first live session with a
nonblocking rest dock, a real session-local Add set, and truthful
finish/PR/cancel behavior — all on the unchanged workout engine, with
rendered-truth evidence and green gates before any closure claim.

## Context

- Baseline HEAD `1502ad3f6b188b5c4bc6548f4bed00261e0e9664` (= `origin/main`;
  W8.5 merged via PRs #63/#64; exact-head hosted CI `37944813818` green through
  unit/integration at 2,613 passed / 3 skipped, audit-only red on the two known
  undocumented HIGHs). Stash `pre-recovery-local-changes` and untracked
  `.tmp-ios36423379932/` preserved untouched. Clean working tree at start.
- Engine authority: `buildTimerSequence()` (sequential active/rest phases,
  zero-rest omission, superset adjacency), disposition rules (timeout =
  completed, Skip = skipped), draft serialization in `app_meta
.workout.active_session_draft`, `collectSessionSetRecords` →
  `groupSessionExercises` → `logWorkoutSession`, `findNewPersonalRecords`,
  XP-after-durable-commit. None of these are redesigned.
- Current landing (`WorkoutScreen.tsx`, ~1,150 lines) order: subtitle header →
  Today hero → Week card → Start/Resume card → two stat cards → empty state →
  add-routine → routine library → history/analytics. Current session
  (`WorkoutSessionScreen.tsx`, ~1,350 lines) is a phase-timer first: giant
  countdown + progress track + ACTIVE/REST badge + inputs + rest adjusts.
- Refero research recorded as R12 in `docs/ui-ux/14-v3-reference-ledger.md`.
- Design authority: `docs/ui-ux/13-calm-momentum-design-system.md`;
  requirements in the three delta specs (`workout-landing-experience`,
  `workout-live-session`, `ui-ux-interaction-density-a11y`,
  `ui-ux-visual-coherence`).
- Blockers inherited (not W9's): braces `GHSA-vfj7-8cjw-p6xm` and node-forge
  `GHSA-86w9-cpqp-85rv` audit reds (no waiver authorized); Android API36
  qualification pending (W16); iOS owner-deferred; D14 headroom floor and the
  Windows CRLF doc-consistency failures are recorded ENVIRONMENT residuals;
  the Focus `planTimerStartup()` notification-scheduling timestamp residual
  stays a separate Focus/native-lifecycle follow-up — untouched by W9.

## Scope

- `features/workout/WorkoutScreen.tsx` rebuilt landing: training-state header,
  quick-start rows, weekly strip + assignment sheet, history disclosure with
  gated analytics, preserved routine management and modals.
- New pure view models: `features/workout/workoutLanding.ts`,
  `features/workout/workoutSessionView.ts` (+ unit tests).
- `features/workout/WorkoutSessionScreen.tsx` rebuilt session anatomy:
  session top bar, exercise set-table, rest dock, Add set, truthful finish/PR/
  cancel, accurate progress labels.
- `features/workout/workout.data.ts`: additive optional `addedSets` draft field
  (normalize-only); no schema/migration/sync change.
- New presentational helpers under `features/workout/` as needed
  (`WorkoutWeekStrip`, session set-row components) — no cross-feature edits.
- Specs/tests/docs: new tests (`tests/workoutLanding.test.ts`,
  `tests/workoutSessionView.test.ts`, add-set integration), updated
  `e2e/workout.spec.ts` + `e2e/workout-gym-v2.spec.ts` selectors to the new
  anatomy with unchanged oracles, new `e2e/workout-w9-audit.spec.ts`,
  `docs/ui-ux/v3-audit/w9/`, ledger updates, parent tasks/execplan checkpoints.

## Non-Goals

- No workout-engine rewrite: no change to `buildTimerSequence`, dispositions,
  per-set rest semantics, sync/outbox, backup scope, routine-template writes,
  linked actions, reminders, gamification, or PR math.
- No random-access set editing (the cursor stays strictly sequential), no
  second draft authority, no schema migration.
- No W10+ work; no dependency/security waiver; no Android/iOS certification;
- no threshold, floor, or quarantine relaxation to force green.

## Current Checkpoint

- Current milestone: W9 COMPLETE and merged to main. W9.5 — the bounded workout convergence correction (save integrity + single scroll authority) — is tracked separately in `../frontend-v3-w95-workout-convergence/execplan.md` and is the only active workout work.
- Completed: preflight (baseline `1502ad3f6b188b5c4bc6548f4bed00261e0e9664` verified = origin/main; stash, `.tmp-ios36423379932/`, W1–W8.5 captures, single worktree intact); source audit; fresh Refero research (R12); W9 OpenSpec change (proposal, design, tasks, four spec deltas — `openspec validate` PASS); `workoutLanding.ts` + `workoutSessionView.ts` pure view models (35 unit tests); `listRoutineCounts()` additive data read; draft `addedSets` field (normalize-tested); landing rebuilt (training state, quick-start rows, collapsed week strip + assignment sheet, new-routine form, History & insights disclosure gating all heavy analytics); session rebuilt (session bar with accurate progress, exercise set table with previous context and modality-correct inputs, dominant DONE per actionable set, Skip set, session-local Add set with phase-index remap through draft/resume/log, docked rest panel, truthful finish error+retry, draft-preserving leave via the shared web-safe confirmation); e2e: workout.spec 14/14, workout-gym-v2 7/7, workout-w9 6/6 (quick-start hierarchy, week-strip template/override SQL oracles, set-table logging, add-set log numbering, draft-preserving leave, nonblocking rest dock), boundary 22/22, a11y 10/10 (one W9-introduced contrast defect found and re-inked to AA), command/theming green, fat-fingers 13/13, a-tuesday 8/8, three-months-in D14 7/7 (maxSwitch 538/800ms, 32.8% headroom), sim model 23/23; W9 rendered evidence 22 captures under `docs/ui-ux/v3-audit/w9/`, all manually inspected; defect ledger SYS-20 + SUR-06 VERIFIED-FIXED with Workout portions of SYS-01/02/07/17 noted; parent tasks 9.1–9.3 checked; known-gaps W9 addendum recorded.
- In progress: none for W9. W9 closed to main in two merges: PR #65 (`55f8532`, Workout reconstruction) and PR #66 (`a8d1c3b` + closure `8cdee8e717ac36dbe4eafbc25099ac0eeeb786a4`, W9 closure + W10 handoff). W9.5 corrections are owned by their own plan and do not reopen W9 tasks.
- Important modified files: `features/workout/WorkoutScreen.tsx` (landing rebuild), `features/workout/WorkoutSessionScreen.tsx` (session rebuild + web-safe leave + finish retry), `features/workout/workoutLanding.ts` (new), `features/workout/workoutSessionView.ts` (new), `features/workout/workout.data.ts` (`listRoutineCounts`, draft `addedSets`), `e2e/workout.spec.ts`, `e2e/workout-gym-v2.spec.ts`, `e2e/workout-w9.spec.ts` (new), `e2e/workout-w9-audit.spec.ts` (new), `e2e/journeys/three-months-in.spec.ts` (workout section marker), `tests/workoutLanding.test.ts` (new), `tests/workoutSessionView.test.ts` (new), `tests/workout.draft.test.ts`, `tests/integration/workoutQueries.data.test.ts`, `docs/ui-ux/v3-audit/w9/` (22 captures), `docs/ui-ux/14-v3-reference-ledger.md` (R12), `docs/ui-ux/15-v3-defect-ledger.md`, `docs/testing/known-gaps.md`, parent execplan/tasks, this change.
- Last successful validation: `npx tsc --noEmit` 0 errors; `npx eslint .`-scope workout+tests 0 errors/0 warnings; `npm run validate:themes` 140/140; `openspec validate --all` 77/77; `agent:plan:validate:all` PASS; `npm test` 2640 passed / 2 skipped with the single pre-existing Windows-CRLF `tests/agentDocConsistency.test.ts` ENVIRONMENT failure (register parser sees zero entries under `core.autocrlf=true`; passes in CI's LF checkout — identical at the W8.5 baseline).
- Current failures: none attributable to W9. Hosted audit red (braces GHSA-vfj7-8cjw-p6xm, node-forge GHSA-86w9-cpqp-85rv) and hosted e2e/nightly skip remain inherited; Android API36/x86_64 qualification pending (W16); iOS owner-deferred; Focus `planTimerStartup()` notification-scheduling timestamp residual remains a separate Focus/native-lifecycle follow-up.
- Relevant quarantines: none added.
- Blockers: None for web continuation.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — W9 is complete and merged (PR #65 merge `55f8532`; PR #66 closure merge `8cdee8e717ac36dbe4eafbc25099ac0eeeb786a4`). Active workout work continues in `../frontend-v3-w95-workout-convergence/execplan.md`; W10 begins only after W9.5 closes.
- Remaining definition of done: All W9.1–W9.3 tasks complete and evidenced; validation ladder green (typecheck, lint, themes 140/140, openspec 77/77, plans, Vitest, e2e:full 271 passed, journeys + D14, sim 23/23); 22 W9 captures inspected; defect ledger and parent plan reconciled; W9 merged with exact-head hosted frontend gates passing (2650 tests passed / 3 skipped at final main `8cdee8e` via runs `38083748134` and the PR #66 runs) and only the two pre-existing undocumented audit advisories red with hosted e2e/nightly skipped. Remaining campaign work lives in the parent plan and the W9.5 correction plan; nothing in W9 is left open.

## Progress

- [x] Preflight + preservation audit (baseline, stash, iOS dir, captures)
- [x] Source + test-suite audit of the Workout system
- [x] Fresh Refero research + R12 ledger entry
- [x] W9 OpenSpec change (proposal/design/tasks/specs + this plan)
- [x] W9.1 landing: training state, quick start, single resume, week strip,
      history disclosure, preserved routine management
- [x] W9.2 live session: session bar, set table, modality inputs, rest dock,
      Add set, performance posture
- [x] W9.3: truthful finish/PR/cancel, accurate progress labels
- [x] Regression suites: unit, integration, e2e updates + new coverage
- [x] Rendered evidence docs/ui-ux/v3-audit/w9/ inspected manually (22 captures)
- [x] Validation ladder + defect ledger + parent reconciliation
- [x] Publication + exact-head CI verification (PR 65 merged at 55f8532; PR 66 closure merged at 8cdee8e; exact-main run 38083748134: every frontend gate passes — typecheck, Supabase edge-function type-check, lint, themes, openspec contracts, journey-label + quarantine-register parity, versioned ExecPlans, unit+integration 2,650 passed / 3 skipped; first failing step `Audit runtime dependencies` on exactly the two pre-existing undocumented HIGH advisories (`braces` GHSA-vfj7-8cjw-p6xm, `node-forge` GHSA-86w9-cpqp-85rv); hosted `e2e`/`nightly` SKIPPED behind the quality gate — not passed, not claimed)
- [x] W9 closed; W9.5 bounded corrections handed to `../frontend-v3-w95-workout-convergence/execplan.md` (W9 tasks are not reopened)

## Surprises & Discoveries

- Baseline verified exactly at `1502ad3f6b188b5c4bc6548f4bed00261e0e9664` =
  `origin/main`; the W8.5 closure commit `7075f2d` (CI record) is already in
  this baseline, so no reconciliation was needed.
- The live session already has the right primitives for a set table:
  `enteredSets` is keyed by sequence index and the seeding effect fills
  previous-performance values; the table is a presentation over that state,
  not an engine change.
- `advanceFromCurrent` skips zero-duration rest phases defensively, which
  keeps the dock's Skip behavior correct for legacy sequences.

## Decision Log

- D1 (W9): landing analytics computations move behind the open History
  disclosure instead of running on every render — satisfies the hierarchy
  requirement and the performance audit in one move.
- D2 (W9): Add set is session-local with a pure `withAddedSet` transform plus
  index remap, persisted through an additive draft field; the routine template
  is never written mid-session. Random-access set editing is explicitly out.
- D3 (W9): cancel becomes draft-preserving (leave keeps the draft, landing
  shows Resume); discard remains the separate confirmed destructive path, so
  the copy matches persistence truth.
- D4 (W9): rest dock is laid out in flow (content padding above it), never an
  overlay, satisfying "never blocks set inputs" on web and native alike.

## Validation Ledger

- 2026-10-10 — W9 change authored — NOT RUN (no code yet).
- 2026-10-10 — preflight (`git fetch --all --prune`, status, worktree,
  stash list) — PASS — baseline `1502ad3f` verified, tree clean, stash
  `stash@{0}` and `.tmp-ios36423379932/` intact, no extra worktrees.

## Changed Files / Areas

- `openspec/changes/frontend-v3-w9-workout/` — proposal, design, tasks, four
  spec deltas, this plan.

## Validation Ledger

- 2026-10-10 — preflight (`git fetch --all --prune`, status, worktree, stash) — PASS — baseline `1502ad3f` verified = origin/main, tree clean, `stash@{0}` and `.tmp-ios36423379932/` intact, single worktree.
- 2026-10-10 — W9 change authored; Refero R12 recorded; parent checkpoint redirected — PASS.
- 2026-10-10 — `npx tsc --noEmit` — PASS — 0 errors (landing + session + view models + tests).
- 2026-10-10 — `npx eslint features/workout tests/workoutLanding.test.ts tests/workoutSessionView.test.ts tests/workout.draft.test.ts tests/integration/workoutQueries.data.test.ts e2e/workout*.spec.ts --max-warnings 0` — PASS — 0 errors / 0 warnings.
- 2026-10-10 — `npx vitest run tests/workoutLanding.test.ts tests/workoutSessionView.test.ts` — PASS — 35/35.
- 2026-10-10 — `npx vitest run` workout suites (data, domain, draft, duplicate, pr, restPreferences, name-write, reminder) — PASS — 131 + new draft/integration coverage.
- 2026-10-10 — `npx vitest run tests/integration/workoutQueries.data.test.ts --project integration` — PASS — 6/6 incl. the add-set log oracle.
- 2026-10-10 — `npm run validate:themes` — PASS — 140/140.
- 2026-10-10 — `npx openspec validate frontend-v3-w9-workout --type change` + `npm run openspec:validate` — PASS — 77/77 (one MODIFIED-requirement scenario gap found and repaired during authoring).
- 2026-10-10 — `npm run agent:plan:validate:all` — PASS — W9 + parent plans valid.
- 2026-10-10 — `npm run qa:affected` — PASS — resolves the full ladder for the workout/e2e/docs areas.
- 2026-10-10 — e2e (hermetic dist, E2E_PORT=8083): `e2e/workout.spec.ts` 14/14; `e2e/workout-gym-v2.spec.ts` 7/7; `e2e/workout-w9.spec.ts` 6/6; `e2e/boundary.spec.ts` 22/22; `e2e/a11y.spec.ts` 10/10 (one W9-introduced contrast defect found and re-inked to AA); `e2e/command.spec.ts` + `e2e/theming.spec.ts` green; journeys `fat-fingers` 13/13, `a-tuesday` 8/8, `three-months-in` 7/7 (D14: coldOverview 606/5000ms 87.9%, maxSwitch 538/800ms 32.8%, diarySearch 367/500ms 26.6%, pickerSearch 183/500ms 63.4%); `npm run sim:validate` 23/23.
- 2026-10-10 — `npm run e2e:full` — PASS — 271 passed / 72 skipped / 0 failed (33.8 min, chromium + journeys + simulation + pwa projects).
- 2026-10-10 — `npm test` — 2640 passed / 2 skipped / 1 pre-existing Windows-CRLF ENVIRONMENT failure at authoring time; the register-parse residual was removed when the known-gaps register was rewritten (11/11 locally thereafter). No threshold, floor, assertion, or quarantine changed.
- 2026-10-10 — rendered evidence: 22 captures under `docs/ui-ux/v3-audit/w9/`, all opened and inspected (populated, rest day, empty, quick start, week strip, week editor, routine detail, history open, active strength, add set, rest dock, bodyweight, timed, cardio, long exercise name, leave confirmation, draft resume, finish summary, saved PR, dark, large text, 360, 1280).
- 2026-10-10 — publication: branch `frontend-v3-w9-workout`, PR #65 MERGED as merge commit `55f8532fffc9b538a548873042bfd9be73924a79`. Exact-head push run `38079602954` and exact-main run `38079997882`: every frontend gate PASS (typecheck, Supabase edge-function type-check, lint, themes, openspec contracts, journey-label + quarantine-register parity, versioned ExecPlans, unit+integration 258 files passed / 1 skipped, 2650 tests passed / 3 skipped); first failing step `Audit runtime dependencies` on exactly the two pre-existing undocumented HIGH advisories (`braces` GHSA-vfj7-8cjw-p6xm, `node-forge` GHSA-86w9-cpqp-85rv — documented brace-expansion entries do not gate); hosted `e2e`/`nightly` SKIPPED behind the quality gate (not passed, not claimed).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, this plan, `proposal.md`, and `design.md`.
2. `git status --short` and `git log --oneline -5`; reconcile with the
   checkpoint above (Git wins).
3. W9 itself is complete: do not redo W9 work. Active workout corrections
   resume from `../frontend-v3-w95-workout-convergence/execplan.md`
   (its "Exact next action").
4. Validation for any further workout work: `npm run typecheck`,
   `npm run lint`, then the workout suites after `npm run build:e2e` with
   `E2E_PORT=8083` (inspect port owners first; never kill unrelated
   processes).
5. If hosted CI fails at "Validate versioned ExecPlans": run
   `npm run agent:plan:validate:all` and fix the named sections.

## Outcomes & Retrospective

- Status: COMPLETE. W9 merged to main through PR #65 (`55f8532`, Workout reconstruction) and PR #66 (closure `8cdee8e717ac36dbe4eafbc25099ac0eeeb786a4`). Exact-head hosted frontend gates pass through unit/integration (2,650 passed / 3 skipped at run `38083748134`); the only red is the two pre-existing undocumented audit advisories (`braces`, `node-forge`), with hosted e2e/nightly skipped. W9.5 corrections (skipped-save false success, nested Screen scroll) are tracked in their own plan and do not reopen any W9 task.
- Summary: Workout now trains-first — a quick-start landing with one resume authority and a readable collapsed week (SYS-20, SUR-06 verified-fixed), a set-logging-first live session with a docked nonblocking rest panel and a real persisted session-local Add set, and truthful finish/PR/cancel behavior — all on the untouched workout engine, with 22 inspected captures and a clean D14 baseline.
- Follow-up: W10 (Calories/Health) per the parent campaign; native Android API36/x86_64 qualification (W16) and iOS (owner-deferred) remain; the Focus `planTimerStartup()` notification-scheduling timestamp residual remains a separate Focus/native-lifecycle follow-up.
