# ExecPlan: Frontend V3 — W9.5 Workout convergence

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close two independently verified source-level defects at the W9 baseline and
reconcile campaign records, without redesigning Workout:

1. **P1 — Save integrity.** A workout must never be reported as saved unless
   its durable workout log was actually committed. `handleFinish()` currently
   treats `logWorkoutSession()` → `status: 'skipped'` as success: it clears the
   draft and shows "Workout saved" although no row was inserted.
2. **P2 — Scroll structure.** The Workout landing renders one scroll-enabled
   `Screen` inside another, duplicating the safe-area shell, ScrollView,
   gutter math, bottom clearance, and keyboard behavior.

Success is observable as: a skipped/failed finish shows an accurate,
actionable failure with the entered sets intact and no success state, no XP,
no draft clearing; a committed finish (including through post-commit
bookkeeping failure) stays truthfully saved and exactly-once; the landing has
exactly one page-level scroll authority; W9/W9.5/W10 records are coherent.

## Context

- Baseline HEAD `8cdee8e717ac36dbe4eafbc25099ac0eeeb786a4` (= `origin/main`;
  W9 published via PR #65 `55f8532` and PR #66 `a8d1c3b`/`8cdee8e`; latest
  exact-head hosted run `38083748134`). Stash `pre-recovery-local-changes`
  and untracked `.tmp-ios36423379932/` preserved untouched; single worktree;
  clean tree at start.
- Data contract: `logWorkoutSession()` returns
  `{ status: 'applied' | 'skipped', logId: string | null }` and may return
  `skipped` without throwing — `insertWorkoutLogRecord()` skips when the
  routine is missing/soft-deleted (`reason: 'target_missing'`).
- `features/workout/WorkoutSessionScreen.tsx` `handleFinish()` (~line 776):
  `clearDraft()` and `setSavedOutcome({ newRecords })` run unconditionally;
  only the XP call is guarded (`logResult.status === 'applied' && logResult.logId`).
- Draft design: `persistDraft` is a 250 ms-debounced best-effort async write;
  a `useEffect` clears the draft when the session reaches the summary
  (`isComplete`); `saveWorkoutSessionDraft` / `clearWorkoutSessionDraft` /
  `getWorkoutSessionDraft` live in `features/workout/workout.data.ts`.
- `features/workout/WorkoutScreen.tsx` (~line 1201) renders
  `<Screen scroll><Screen scroll>…</Screen></Screen>`; `core/ui/Screen.tsx`
  builds the whole page shell per instance (SafeAreaView, ScrollView, gutter
  16/24/32, 144 + safe-area bottom padding, keyboard dismiss).
- Engine/persistence/sync/backup contracts are W9-verified and out of scope;
  gamification's `recordAction` already isolates its own failures.
- Inherited blockers (not W9.5's): audit red on braces `GHSA-vfj7-8cjw-p6xm`
  and node-forge `GHSA-86w9-cpqp-85rv` (no waiver authorized); Android API36
  qualification pending (W16); iOS owner-deferred; W7 HEAVY Habits and
  three-months-in D14 headroom-floor sensitivities; Focus
  `planTimerStartup()` notification-timestamp residual; Windows CRLF
  reproducibility residual.

## Scope

- `features/workout/WorkoutSessionScreen.tsx`: durable-success guard,
  accurate failure messaging, post-commit bookkeeping isolation, draft
  write/clear race closure.
- `features/workout/workout.data.ts`: additive skip-reason propagation on
  `LogWorkoutSessionResult` (no behavior change for existing callers).
- `features/workout/WorkoutScreen.tsx`: remove the nested scroll-enabled
  `Screen` (exactly one page-level scroll authority).
- Tests: new `tests/workoutSaveIntegrity.test.ts` (unit/contract) and
  `tests/integration/workoutSaveIntegrity.data.test.ts` (real SQLite
  oracles: exactly one row on success, zero on skip, draft retention,
  exactly-once double finish, reward attribution target).
- E2E: `e2e/workout-w95-*.spec.ts` regression + rendered evidence under
  `docs/ui-ux/v3-audit/w9.5/`.
- OpenSpec change `frontend-v3-w95-workout-convergence` (this plan,
  proposal, design, tasks, two spec deltas); parent campaign tasks/execplan
  and W9 execplan reconciliation.

## Non-Goals

- No workout redesign: W9 landing/session anatomy, engine, dispositions,
  PR math, sync/outbox, backup scope, and gamification semantics unchanged.
- No routine-restoration feature; no random-access set editing; no schema or
  migration; no dependency or security-policy change; no Focus/native work;
  no W10 implementation; no gate weakening.

## Current Checkpoint

- Current milestone: W9.5 COMPLETE and merged to main (`24b01b5d47bdc9088428fe1df3e549d318e98109`, PR #67, commits `3bee453` + `e40ef87`); exact-head CI verified.
- Completed: preflight (baseline `8cdee8e` verified = origin/main; stash, `.tmp-ios36423379932/`, W1–W9 captures, single worktree intact); source audit of the finish path, draft functions, and landing shell; root-cause confirmation of both defects; OpenSpec change authored (validated 78/78 with `openspec validate --all`; this plan validated by `agent:plan:validate`); **pre-fix reproduction executed** (a routine soft-deleted mid-session makes `logWorkoutSession()` return `skipped` with no thrown error and zero durable rows while the pre-fix handler entered the saved state, cleared the draft, and surfaced no error — fixture output preserved, fixture removed after capture); durable-success guard implemented (`resolveSessionSave` in `workoutSessionView.ts`; success requires `applied` AND a log id; post-commit bookkeeping isolation; accurate routine-unavailable message; draft clear-generation race closure; additive `reason` propagation in `workout.data.ts`); nested scroll-enabled `Screen` removed from `WorkoutScreen.tsx`; regressions authored and passing (`tests/workoutSessionSave.test.ts` 8/8; `tests/integration/workoutSaveIntegrity.data.test.ts` 7/7 real-SQLite oracles; `e2e/workout-w95.spec.ts` 6/6 rendered); W9.5 rendered audit 2/2 with 9 inspected captures under `docs/ui-ux/v3-audit/w9.5/` (the skipped-save rendered state is not stageable in-browser — entering the DB harness destroys the live session and resume re-validates the routine — so it is covered by the integration oracles, as the W9.5 task plan records); parent + W9 records reconciled (control characters removed, remaining-work corrected, W7 fragment removed, W9.5 represented with W10 next).
- In progress: none. W9.5 is closed; W10 (Calories / Health) is the parent campaign's next wave and is not started.
- Important modified files: `features/workout/WorkoutSessionScreen.tsx` (durable-success guard, post-commit bookkeeping isolation, draft write/clear race), `features/workout/workout.data.ts` (additive skip-reason propagation), `features/workout/workoutSessionView.ts` (new `resolveSessionSave`), `features/workout/WorkoutScreen.tsx` (nested `Screen` removed), `tests/workoutSessionSave.test.ts` (new), `tests/integration/workoutSaveIntegrity.data.test.ts` (new), `e2e/workout-w95.spec.ts` (new), `e2e/workout-w95-audit.spec.ts` (new), `docs/ui-ux/v3-audit/w9.5/` (9 captures), `openspec/changes/frontend-v3-w95-workout-convergence/`, parent execplan/tasks, W9 execplan.
- Last successful validation: `npx tsc --noEmit` 0 errors; `npx openspec validate --all` 78/78; `npm run agent:plan:validate:all` PASS; `npm run lint` 0 errors / 0 warnings; `npm run validate:themes` 140/140; `tests/workoutSessionSave.test.ts` 8/8; `tests/integration/workoutSaveIntegrity.data.test.ts` 7/7; `npm test` 2,664 passed / 2 skipped with the single pre-existing Windows-CRLF `tests/agentDocConsistency.test.ts` ENVIRONMENT failure (register parse sees zero entries on this host's CRLF checkout; passes in CI's LF checkout — identical at the W9 baseline); `E2E_PORT=8083 npx playwright test e2e/workout-w95.spec.ts` 10/10 twice; `e2e/workout.spec.ts` + `e2e/workout-gym-v2.spec.ts` 21/21; `e2e/workout-w9.spec.ts` + `e2e/boundary.spec.ts` 28/28; a11y + a11y-audit-contract + theming + gamification + linked-actions-log 23/23; journeys fat-fingers + a-tuesday 21/21; simulation project 3/3 + `sim:validate` 23/23; full deterministic simulation library 23/23 scenarios; W9.5 rendered audit 2/2 with 9 inspected captures.
- Current failures: none attributable to W9.5. Inherited residuals remain recorded (audit red on the two known advisories; hosted e2e/nightly skip; native qualification pending; D14 host-load residuals; the Windows-CRLF register-parse failure; the pre-existing mid-transition capture frame visible in landing captures, identical to the accepted W9 baseline).
- Relevant quarantines: none.
- Blockers: None for web continuation.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — W9.5 is complete and merged (`24b01b5`, PR #67) with exact-head hosted CI verified (run `38162706650` at the merge commit: every frontend gate PASS — typecheck, Supabase edge-function type-check, lint, themes, openspec contracts, journey-label + quarantine-register parity, versioned ExecPlans, unit+integration 2,665 passed / 3 skipped; first failure `Audit runtime dependencies` on exactly the two pre-existing undocumented HIGH advisories; hosted `e2e`/`nightly` SKIPPED; Vercel production deployment success). W10 begins per the parent campaign plan.
- Remaining definition of done: All W9.5 tasks complete and validated, and the full acceptance checklist is satisfied: `skipped` can never enter success, clear the draft, or award XP; the user receives accurate routine-unavailable guidance; in-memory entered values remain intact; durable draft behavior is verified (no clear on the error path plus the write/clear race closure); valid `applied` still succeeds; a missing log id fails closed; database exceptions remain recoverable; post-commit bookkeeping failure cannot trigger misleading duplicate-save behavior; double Finish remains idempotent; SQLite oracles confirm exactly what was persisted; the Workout landing has exactly one scroll-enabled Screen with no nested page-level scroll shell; mobile and desktop scrolling and keyboard interactions are verified at 360/390/412/768/1280; rendered evidence is inspected; W9 and parent records are reconciled with control characters removed and correct remaining-work text; the wave is merged through the normal workflow with exact-head hosted frontend gates passing; and the known audit/native/performance limitations remain documented.

## Progress

- [x] Preflight + preservation audit (baseline, stash, iOS dir, captures)
- [x] Source audit: finish path, draft functions, nested Screen
- [x] OpenSpec change `frontend-v3-w95-workout-convergence` authored
- [x] Reproduce skipped-save false success (pre-fix reproduction executed)
- [x] Implement durable-success guard + reason propagation
- [x] Post-commit bookkeeping isolation + draft race closure
- [x] Save-integrity regression suites (unit + real-SQLite integration)
- [x] Remove nested Screen; scroll/keyboard verification (360/390/412/768/ 1280) + 9 inspected rendered captures
- [x] Reconcile W9 execplan, parent execplan, parent tasks
- [x] Full validation ladder (typecheck, lint, themes, openspec, plans,
      vitest, workout + collateral e2e, deterministic simulation 23/23)
- [x] Publication (PR #67 merged as `24b01b5`) + exact-head CI verification (run `38162706650` at the merge commit: all frontend gates pass, 2,665 passed / 3 skipped; audit-only red on braces/node-forge; hosted e2e/nightly skipped; Vercel deploy success)

## Surprises & Discoveries

- `logWorkoutSession()` already computed the skip reason
  (`target_missing`) inside `insertWorkoutLogRecord()` but dropped it at the
  boundary — additive propagation is enough for truthful messaging.
- `recordAction` swallows its own failures by design, so the post-commit
  isolation is defense-in-depth for synchronous throws and test seams rather
  than a behavior repair.
- The debounced draft write can resolve after the summary-time clear,
  resurrecting a cleared draft — the race is real but narrow; a clear
  generation counter closes it without new synchronous DB traffic.

## Decision Log

- D1 (W9.5): success = `status === 'applied'` AND truthy `logId`, one
  predicate reused by the success state, draft cleanup, and XP — no second
  source of truth.
- D2 (W9.5): propagate the skip reason additively; do not change the result
  contract for existing callers or tests.
- D3 (W9.5): post-commit bookkeeping is isolated so a committed log is never
  rewritten into a false "not saved" and never invites a duplicate insert.
- D4 (W9.5): keep the outer `Screen scroll` and `ScreenSection` grammar;
  delete only the inner wrapper (no ad-hoc ScrollView).

## Validation Ledger

- 2026-10-11 — preflight (`git fetch --all --prune`, status, branch, HEAD,
  origin/main, log, stash, worktree) — PASS — baseline
  `8cdee8e717ac36dbe4eafbc25099ac0eeeb786a4` verified = origin/main, tree
  clean, `stash@{0}` and `.tmp-ios36423379932/` intact, single worktree.
- 2026-10-11 — `openspec validate --all` (clean baseline) — PASS — 77/77.
- 2026-10-11 — W9.5 change authored (proposal/design/tasks/specs/plan) —
  PASS — `npx openspec validate frontend-v3-w95-workout-convergence
--type change` valid.
- 2026-10-11 — pre-fix reproduction (real SQLite, temporary fixture, removed
  after capture) — PASS — skipped result with zero durable rows drove the
  pre-fix saved-outcome state; the W9.5 decision reports not-saved with the
  routine-unavailable message.
- 2026-10-11 — `npx tsc --noEmit` — PASS — 0 errors (session, data, view
  model, tests, e2e).
- 2026-10-11 — `tests/workoutSessionSave.test.ts` — PASS — 8/8.
- 2026-10-11 — `tests/integration/workoutSaveIntegrity.data.test.ts` —
  PASS — 7/7 real-SQLite oracles.
- 2026-10-11 — `E2E_PORT=8083 npx playwright test e2e/workout-w95.spec.ts`
  — PASS — 10/10 (committed save exactly one log + one reward;
  resume-then-save path; rapid double Finish idempotent; one page-level
  scroll container at 360/390/412/768/1280; desktop 760 cap; keyboard
  form usable inside the scroll page); repeated on the same tree — 10/10.
- 2026-10-11 — `npm run lint` — PASS — 0 errors / 0 warnings
  (repo-wide).
- 2026-10-11 — `npm run validate:themes` — PASS — 140/140.
- 2026-10-11 — `npm test` (unit + integration) — 2,664 passed /
  2 skipped / 1 pre-existing Windows-CRLF ENVIRONMENT failure
  (`tests/agentDocConsistency.test.ts` register parse on this host's CRLF
  checkout; passes in CI's LF checkout; identical at the W9 baseline).
- 2026-10-11 — existing workout + collateral e2e lanes (hermetic dist,
  E2E_PORT=8083) — PASS — `e2e/workout.spec.ts` +
  `e2e/workout-gym-v2.spec.ts` 21/21; `e2e/workout-w9.spec.ts` +
  `e2e/boundary.spec.ts` 28/28; a11y + a11y-audit-contract + theming +
  gamification + linked-actions-log 23/23; journeys fat-fingers +
  a-tuesday 21/21; simulation project 3/3.
- 2026-10-11 — `npm run sim:validate` — PASS — 23/23.
- 2026-10-11 — full deterministic simulation library (owned static
  server on 8083, `E2E_PORT=8083`, 23 scenarios) — PASS — 23/23.
- 2026-10-11 — W9.5 rendered audit (`VISUAL_AUDIT=1`) — PASS — 2/2, 9
  captures under `docs/ui-ux/v3-audit/w9.5/` captured and inspected.
- 2026-10-11 — `npm run agent:plan:validate:all` + `openspec validate
--all` — PASS — plans valid, 78/78.

## Changed Files / Areas

- `openspec/changes/frontend-v3-w95-workout-convergence/` — proposal,
  design, tasks, two spec deltas, this plan (authored first; source files
  follow).

- 2026-10-11 — publication: branch `frontend-v3-w95-workout-convergence`, PR #67 MERGED as merge commit `24b01b5d47bdc9088428fe1df3e549d318e98109` (commits `3bee453` source fix + `e40ef87` tests/evidence/records). Exact-head run `38162706650` at the merge commit: every frontend gate PASS (typecheck, Supabase edge-function type-check, lint, themes, openspec contracts, journey-label + quarantine-register parity, versioned ExecPlans, unit+integration 260 files passed / 1 skipped, 2,665 tests passed / 3 skipped); first failing step `Audit runtime dependencies` on exactly the two pre-existing undocumented HIGH advisories (`braces` GHSA-vfj7-8cjw-p6xm, `node-forge` GHSA-86w9-cpqp-85rv); hosted `e2e`/`nightly` SKIPPED behind the quality gate (not passed, not claimed); Vercel production deployment success at the same SHA.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan, `proposal.md`,
   `design.md`, and `tasks.md`.
2. `git status --short` and `git log --oneline -3`; reconcile with the
   checkpoint above (Git wins).
3. Continue from "Exact next action".
4. Validation: `npm run typecheck`, `npm run lint`,
   `npx vitest run tests/workoutSaveIntegrity.test.ts
tests/integration/workoutSaveIntegrity.data.test.ts`, then the workout
   e2e suites after `npm run build:e2e` with `E2E_PORT=8083` (inspect port
   owners first; never kill unrelated processes).
5. If hosted CI fails at "Validate versioned ExecPlans": run
   `npm run agent:plan:validate:all` and fix the named sections.

## Outcomes & Retrospective

- Status: COMPLETE. W9.5 merged to main as `24b01b5d47bdc9088428fe1df3e549d318e98109` (PR #67); exact-head hosted run `38162706650` passed every frontend gate through unit+integration (2,665 passed / 3 skipped), the only red is the two pre-existing undocumented audit advisories, hosted e2e/nightly skipped, Vercel deploy success.
- Summary: a workout can no longer be reported as saved unless its durable log was committed — `skipped` (and any result without a log id) fails closed with an accurate routine-unavailable message, keeps entered sets and the durable draft, and earns no XP; the durable commit is separated from post-commit bookkeeping so a committed save is never rewritten into a false failure or a duplicate insert; the debounced draft write/clear race is closed; and the Workout landing keeps exactly one page-level scroll-enabled `Screen` (verified at 360/390/412/768/1280 with the desktop 760 cap and keyboard usability). W9's design, the engine, persistence, sync, and backup contracts are untouched.
- Follow-up: W10 (Calories / Health) per the parent campaign plan; native Android API36/x86_64 qualification (W16) and iOS (owner-deferred) remain; the Focus `planTimerStartup()` notification-scheduling timestamp residual, the W7 HEAVY-Habits and three-months-in D14 host-load residuals, the Windows-CRLF register-parse residual, and the two undocumented audit advisories remain recorded.
