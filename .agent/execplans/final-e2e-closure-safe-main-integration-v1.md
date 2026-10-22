# Final E2E defect closure, deployment safety & controlled main integration

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Eliminate the last hosted Todo visual-test failure at its true root cause,
re-establish trustworthy final-head hosted CI evidence for the accepted
PR #82 → #83 → #84 stack, resolve (or precisely gate) production-deployment
safety prerequisites, and perform a controlled non-force integration into
`origin/main` **only** when every mandatory preflight condition holds.
Production release stays blocked and under explicit owner control.

## Context

- Repository: `quantdale/super-habits`. Worktree: the primary checkout on branch
  `web-export-bridge-isolation-v1` (PR #84 head).
- Verified start state: `origin/main` `e6cf0d34`, PR #82 `a70026ec`,
  PR #83 `caace05a`, PR #84 `2d188fbf` (14 commits ahead of main, no divergence).
- Predecessor plans are COMPLETED and must not be repeated:
  `security-blocked-ci-qualification-recovery.md` (PR #82),
  `.agent/execplans/web-export-bridge-isolation-todo-durability-v1.md` (PR #84).
- Failing hosted evidence: run `39708815790` at `2d188fbf`. Chromium functional
  261 passed / 47 skipped; visual 33 passed / 1 failed
  (`e2e/visual-regression.spec.ts:332` "to do long title (phone, light)");
  quality job red **only** on the dependency audit; downstream P0/simulation
  steps skipped behind the visual failure.
- Security posture is intentionally unchanged and red: `braces`
  (GHSA-vfj7-8cjw-p6xm) and `node-forge` (GHSA-86w9-cpqp-85rv) remain
  undocumented production-tree highs. The audit gate must not be weakened.
- Governance facts at start: ruleset "Protect Main" `15001092` is
  `enforcement: disabled` with no bypass actors; classic branch protection is
  absent (`404 Branch not protected`). Vercel holds are NOT established.

## Scope

1. P1: root-cause and fix the hosted Todo long-title failure (product + test).
2. P2: local + hosted re-qualification of the exact final head.
3. P3: verify both Vercel projects' production-deployment behavior (read-only).
4. P4: reconcile integration policy and record the owner decision.
5. P5: independent read-only review of the effective stack.
6. P6: conditional controlled main integration.
7. P7: post-integration audit; P8: remaining release blockers.

## Non-Goals

- No production release or promotion authorization.
- No dependency-audit weakening, allowlist edit, or advisory dismissal.
- No GitHub/Vercel setting changes without explicit owner authorization.
- No force push, history rewrite, or protection bypass.
- No broad repository audit unrelated to the changed surface.
- No golden regeneration, tolerance widening, test skips, or retry-based greens.

## Current Checkpoint

- Current Milestone: P1 and P2-local complete; publishing the correction, then
  hosted re-qualification, then P3/P4 governance boundary.
- Completed:
  - Full Phase 0 reconnaissance; SHAs confirmed unchanged; stack ancestry verified
    (`main` is a strict ancestor of `2d188fbf`).
  - Downloaded and analyzed the hosted failure artifacts (`e2e-report`,
    `visual-regression-diffs`: screenshot, `error-context.md`, `trace.zip`).
  - **Root cause PROVEN** from trace frame snapshots plus a local discriminating
    probe. Class: INPUT_LOST. The To Do page derived `Screen`'s `scroll` prop
    from `totallyEmpty`, so the empty→populated flip changed the container's
    ELEMENT TYPE (scrolling container vs plain view), which unmounted and
    recreated the whole child subtree INCLUDING the Quick Capture `TextInput`.
    The fixture list finished loading mid-typing, destroying the live input
    node; a 115-character title landed as `"Call th"` and was persisted as a To
    Do row with that 7-character title.
  - PR #84's lifted draft preserved the VALUE but not the node, so it was
    necessary but not sufficient.
  - Secondary TEST defect proven: the readiness gate matching `/^\\d+ open$/`
    also matches `"0 open"`, i.e. the EMPTY branch, so it never proved the
    populated branch was mounted.
  - PRODUCT FIX: pinned `Screen scroll={false}` in the To Do screen (one stable
    non-scrolling container), so the input node, its focus, and in-flight
    keystrokes survive the transition.
  - TEST FIX: readiness now requires the populated-branch-only `Search tasks`
    input hint plus absence of `No pending tasks`, and asserts the complete
    115-character value before submitting.
  - NEW discriminating regression: "keeps the input NODE and focus across an
    empty→populated transition" pins DOM node identity (tag-and-recheck).
  - **Negative control executed**: with the defect deliberately reintroduced the
    new test FAILS at the node-identity assertion; with the fix restored it
    PASSES. The fix was then restored byte-identically (verified by `diff -q` and
    by the identical rebuild hash `sha-b7c269fb6d2b5ab4`).
- In Progress: committing the P1 correction and preparing the publication and
  hosted re-qualification step; no other work is in flight.
- Important modified files: `features/todos/TodosScreen.tsx` (container pin),
  `e2e/visual-regression.spec.ts` (readiness + full-value contract), the Quick
  Add durability E2E spec (node-identity regression), and this plan.
- Last successful validation: visual 34/34 strict (`maxDiffPixels: 0`, zero
  golden changes); feature+visual 296 passed / 47 skipped / 0 failed / 0
  retries; retry-report gate OK; Quick Add durability 4/4; P0 journeys 25/25;
  workout recovery 2/2 plus `tests/workout.draft.test.ts` 8/8; `npm test` 3069
  passed / 3 skipped; typecheck 0; lint 0/0; Prettier clean on changed files;
  openspec 89/89; all versioned ExecPlans pass; `sim:validate` 23 scenarios.
- Current failures: Dependency-security audit remains RED by design (exit 1) with
  exactly the two mandated advisories — external release blocker, not a
  regression and not to be weakened.
- Relevant quarantines: none introduced.
- Blockers: production-deployment hold on both Vercel projects is NOT verified;
  Vercel project settings require owner-authorized access. No Vercel token or
  provider credential is available to this agent.
- Exact next action: commit the P1 correction and push it to the existing PR #84
  branch (`web-export-bridge-isolation-v1`), then wait for and inspect the
  final-head hosted CI run before attempting any integration step.
- Remaining definition of done: hosted final-head CI evidence (functional E2E,
  visual 34/34, P0 journeys, simulation/oracle validation, deterministic subset,
  unit/integration, ExecPlan validation), independent read-only source review,
  owner-selected integration policy, verified Vercel production-deployment hold
  on both projects, clean fast-forward ancestry, and post-integration audit.

## Progress

- [x] Phase 0 — repository/remote/PR/CI recon; ancestry + stack verified
- [x] Phase 1 — hosted artifact retrieval and trace analysis
- [x] Phase 1 — root cause proven (INPUT_LOST via container-type swap)
- [x] Phase 1 — product fix (`Screen scroll={false}`)
- [x] Phase 1 — test-contract fix (populated-branch readiness + full-value assert)
- [x] Phase 1 — discriminating regression test + executed negative control
- [x] Phase 2 — full local acceptance set
- [ ] Phase 2 — publish correction to PR #84 and pass hosted final-head CI
- [ ] Phase 3 — Vercel production-deployment hold verification (owner-gated)
- [ ] Phase 4 — integration policy decision record (owner-gated)
- [ ] Phase 5 — independent read-only source review
- [ ] Phase 6 — controlled main integration (conditional)
- [ ] Phase 7 — post-integration audit (conditional)

## Surprises & Discoveries

- The published "historical flake" explanation in the spec comments was WRONG in
  an important way. It claimed the submit "reads an empty title and no-ops" — an
  empty-title skip. The trace proves otherwise: a REAL Todo named `"Call th"`
  was created and persisted. The failure is silent data corruption of the user's
  title, not a no-op. The comment has been corrected rather than left in place.
- Lifting draft state (PR #84) addressed the _value_ half of the loss but not the
  _node identity_ half. Value-only assertions cannot detect the remaining
  defect, which is why the trace (not the test) was the only reliable evidence.
- The readiness gate was satisfiable by the empty branch (`"0 open"`), so the
  test could begin typing in a branch guaranteed to be replaced. A readiness
  signal must be unique to the branch the test depends on.
- `Screen`'s `scroll` prop is a container-type selector, not a cosmetic option;
  deriving it from data state makes any data transition a subtree remount.
- The repo's `tests/todos.listContract.test.ts` forbids the literal token
  `ScrollView` in `TodosScreen.tsx`, so even a comment naming it fails the gate.
  The guard was preserved (comment reworded) rather than relaxed.

## Decision Log

- Fix the PRODUCT (stable container) rather than only hardening the test.
  Rationale: the confirmed defect loses real user keystrokes in production, not
  just in tests; a test-only fix would hide a genuine product defect.
- Also fix the TEST's readiness contract. Rationale: its previous gate could not
  distinguish the empty from the populated branch, so it was not a valid proof.
- Keep `maxDiffPixels: 0`, keep the 20s assertion timeout, keep the long title,
  keep the durable-DB requirement. No golden was regenerated; the empty-To-Do
  golden still passes unchanged under the new container.
- Prove the regression discriminates by reintroducing the defect and observing a
  real failure, then restoring. Rationale: a test that cannot fail is not proof.
- Do NOT weaken or exempt the dependency audit; report it as truthfully red.

## Validation Ledger

- Hosted artifact analysis (run 39708815790) — trace frame snapshots prove the
  input held `"Call th"` after mid-typing remount and a Todo with that title was
  created; failure classified INPUT_LOST.
- Local discriminating probe (pre-fix) — `openAtReadiness=0 open`,
  `rowsAtReadiness=0`, `emptyCardAtReadiness=1`, `typedLen=115`,
  `emptyCardAfterType=0`: typing began in the empty branch.
- Local identity probe (post-fix) — `sameNode=true`, `typedLen=115`,
  `focused=true` across the empty→populated flip.
- Negative control — new regression test FAILS with the defect reintroduced
  (node-identity assertion) and PASSES with the fix; fix restored byte-identically.
- `npx playwright test --project=visual` — 34/34 passed, strict comparison,
  zero golden changes.
- `npx playwright test --project=visual --project=chromium` — 296 passed,
  47 skipped, 0 failed.
- `node scripts/e2e-retry-report.mjs` — OK, 0 retried-then-passed.
- `e2e/todo-quickadd-durability.spec.ts` — 4/4 passed.
- `npm run e2e:journeys:p0` — 25/25 passed.
- `e2e/workout-gym-v2.spec.ts` reload/resume — 2/2; `tests/workout.draft.test.ts`
  — 8/8.
- `npm test` — 3069 passed, 3 skipped, 0 failed (unit + integration).
- `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 0 warnings.
- `npx prettier --check` on changed files — clean.
- `npm run openspec:validate` — 89/89 passed.
- `npm run agent:plan:validate:all` — all versioned plans valid.
- `npm run sim:validate` — 23 scenarios, apiLeg guards clean.
- `node scripts/audit-runtime-deps.mjs` — RED (exit 1): `braces` +
  `node-forge` unresolved (expected; no exception added).

## Changed Files / Areas

- `features/todos/TodosScreen.tsx` — pinned the To Do `Screen` container to a
  single non-scrolling type so the Quick Capture input node is never recreated.
- `e2e/visual-regression.spec.ts` — populated-branch readiness contract plus a
  full-value assertion before submit.
- `e2e/todo-quickadd-durability.spec.ts` — new node-identity/focus discriminating
  regression; corrected the stale "empty-title skip" narrative.
- `.agent/execplans/final-e2e-closure-safe-main-integration-v1.md` — this plan.

## Recovery / Resume Instructions

1. `git -C <repo> status --short`; expect only this campaign's files modified (or
   clean if the correction is already committed).
2. Read this plan's `Current Checkpoint` and `Surprises & Discoveries`.
3. Verify SHAs: `origin/main` `e6cf0d34`, #82 `a70026ec`, #83 `caace05a`,
   #84 head = the correction commit on `web-export-bridge-isolation-v1`.
4. Do not repeat P1: the root cause and fix are settled and negative-controlled.
5. Resume at `Exact next action`. Integration is forbidden until the Vercel hold
   and the owner policy decision are both recorded in the checkpoint.

## Outcomes & Retrospective

(In progress — to be completed at the integration boundary or final stop.)
