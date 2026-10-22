# Final E2E defect closure, deployment safety & controlled main integration

Plan-Version: 2
Status: BLOCKED

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

- Current Milestone: P1, P2-local and P2-hosted complete. Stopped at the P3/P4
  owner-authorization boundary: no Vercel production-deployment hold can be
  established from this environment.
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
  - **Second defect caught by my own regression probing (P2, fixed):** pinning
    `scroll={false}` removed the ONLY scroller from the empty branch, whose stack
    ends ~420px down — on a landscape phone (390px tall) the "Add your first
    task" action was clipped with no scrollable ancestor. Fixed by giving the
    empty branch its own scroll region (`TodoEmptyStateScroll`) placed AFTER the
    quick-add row, so cards scroll while the input stays mounted. It lives in
    its own component because the W6.5 list contract forbids a `ScrollView`
    token in the To Do screen (guard preserved, not relaxed).
  - TEST FIX: readiness now requires the populated-branch-only `Search tasks`
    input hint plus absence of `No pending tasks`, and asserts the complete
    115-character value before submitting.
  - NEW discriminating regression: "keeps the input NODE across an
    empty→populated transition" pins DOM node identity (tag-and-recheck).
  - **A second regression test was rejected as a false proof and rewritten.**
    The first landscape check asserted a successful click and PASSED with the
    defect reintroduced: Playwright's `click()` scrolls the element into view
    itself (and `body{overflow:hidden}` still permits it), so it masked the bug.
    The shipped version asserts ancestor scrollability or in-viewport position
    and was verified to FAIL against the defect build and PASS against the fix.
  - **Negative control executed**: with the original defect deliberately
    reintroduced the node-identity test FAILS; with the fix restored it PASSES.
    The fix was restored byte-identically (verified by `diff -q` and by the
    identical rebuild hash `sha-b7c269fb6d2b5ab4`).
- In Progress: none. Engineering closure is complete. Commits `30ff9188`
  (input-loss fix + tests), `a14a2c0c` (empty-state scrollability + discriminating
  test), and the plan commits are pushed non-force to
  `origin/web-export-bridge-isolation-v1` = PR #84. The remaining work is
  owner-gated.
- Important modified files: `features/todos/TodosScreen.tsx` (container pin +
  empty-branch wiring), the new `features/todos/TodoEmptyStateScroll.tsx`,
  `e2e/visual-regression.spec.ts` (readiness + full-value contract), the Quick
  Add durability E2E spec (node-identity + scrollability regressions), and this
  plan.
- Last successful validation: **hosted** run `39731413378` at `582a1547` —
  visual 34/34 with 0 retried-then-passed, P0 journeys 25/25 with 0 retried,
  functional suite 260 passed / 47 skipped / 2 non-strict flakes, simulation
  model+oracle self-tests pass, deterministic scenario subset pass, every retry
  gate OK (`strictRetriedThenPassed: 0`), and quality green on typecheck, lint,
  openspec, journey-label parity, ExecPlan validation and unit+integration — red
  ONLY on the mandated dependency audit. **Locally at `a14a2c0c` (the final
  head):** visual 34/34, feature 263 passed / 47 skipped / 0 failed / 0 flaky,
  retry gate 0 retried, P0 25/25, `npm test` 3069 passed / 3 skipped, typecheck
  0, lint 0/0, openspec 89/89, all 149 versioned ExecPlans valid.
- Current failures: Dependency-security audit remains RED by design (exit 1) with
  exactly the two mandated advisories — external release blocker, not a
  regression and not to be weakened.
- Relevant quarantines: none introduced. The 2 hosted flakes
  (`planning-w115-reliability.spec.ts:345`, `workout.spec.ts:400`) are
  pre-existing, non-strict, and touch neither the To Do surface nor any file
  this campaign changed; both pass 3/3 at repeat-each 3 in isolation.
- Blockers: **no Vercel production-deployment hold exists, and none can be
  created from this environment.** Verified read-only: both projects
  (`super-habits`, `superhabits`) keep `main` as their Production branch,
  created a Production-target deployment on every `main` push, have
  `protection_rules=0` on every Production environment, and their last five
  `main` deployments all FAILED at the pre-fix build defect (last success
  `fb10d6cc` 2026-10-14 — still what the live domains serve). PR #84 previews
  now SUCCEED (`7241901485`, `7241857197`), so the next `main` push would build
  and promote unqualified code to production. No Vercel token, CLI, repo secret
  or variable exists in this environment, so activating a hold requires owner
  action.
- Exact next action: push `a14a2c0c` to PR #84, confirm the hosted final-head CI
  run is green on the visual lane (34/34, 0 retries) with quality red only on
  the audit, then hand off to the owner to activate an enforceable Vercel
  production hold on BOTH projects. Only after positive evidence of that hold
  plus an explicit Policy A vs Policy B decision may the single non-force
  fast-forward into `origin/main` be performed. Do not push to `main` before
  that.
- Remaining definition of done: independent read-only source review of the
  changed surface (done), owner-selected integration policy (NOT chosen),
  verified Vercel production-deployment hold on both projects (BLOCKED,
  owner-gated), clean fast-forward ancestry (verified), and the
  post-integration audit (not reached).
- Condition required to unblock: the owner activates an enforceable Vercel
  production-deployment hold on BOTH projects (`super-habits`
  `prj_lv9lvnsEH1hLuiRNCFIRQCz16ZQr`, `superhabits`
  `prj_RYrRGteH3w6pSYERrPDL27DJJAAd`) — meaning a Production-target build may no
  longer be promoted/alias-assigned automatically — and provides positive
  evidence of the effective setting, together with an explicit Policy A vs
  Policy B decision for integrating a stack whose security audit is red.
- Exact resume action after unblock: re-verify `origin/main` is still
  `e6cf0d34` (or rebase the candidate if it advanced), then perform ONE non-force
  fast-forward push of the accepted stack head into `origin/main`, fetch again,
  and run the Phase 7 post-integration audit (GitHub ancestry + CI + both Vercel
  production targets).

## Progress

- [x] Phase 0 — repository/remote/PR/CI recon; ancestry + stack verified
- [x] Phase 1 — hosted artifact retrieval and trace analysis
- [x] Phase 1 — root cause proven (INPUT_LOST via container-type swap)
- [x] Phase 1 — product fix (`Screen scroll={false}`)
- [x] Phase 1 — test-contract fix (populated-branch readiness + full-value assert)
- [x] Phase 1 — discriminating regression test + executed negative control
- [x] Phase 2 — full local acceptance set
- [x] Phase 2 — publish correction to PR #84 and pass hosted final-head CI
- [x] Phase 3 — Vercel production-deployment behavior verified (read-only); hold
      cannot be established here (owner-gated)
- [ ] Phase 4 — integration policy decision record (owner-gated)
- [x] Phase 5 — independent read-only source review of the changed surface
- [ ] Phase 6 — controlled main integration (conditional, NOT performed)
- [ ] Phase 7 — post-integration audit (conditional, not reached)

## Surprises & Discoveries

- **CRITICAL production-safety fact (read-only provider evidence).** Every
  `main` push since 2026-10-19 created a **failing** Production-target
  deployment in BOTH Vercel projects (`super-habits`, `superhabits`):
  `9cee7718`, `85599dfb`, `89eb3714`, `3477cdb1`, and the current `main` head
  `e6cf0d34` all report `state=failure` at the pre-fix build defect. The last
  **successful** Production deployment is `fb10d6cc` (2026-10-14), which is what
  the live domains still serve.
- Therefore the earlier assumption that "a push to main is harmless because
  production builds have always failed" is **false and now unsafe**: PR #84's
  preview builds succeed (`7241901485`, `7241857197` = `success`), so the very
  next `main` push would build, deploy, and — absent a hold — promote to
  production automatically.
- **No Vercel production hold exists.** GitHub environment protection is empty
  for every Vercel environment (`Production – super-habits`,
  `Production – superhabits`, and `Production` all report
  `protection_rules=0`), Vercel keeps the `main` branch as its Production branch
  for both projects, and both projects created a Production-target deployment on
  every `main` push. GitHub environment rules do not gate Vercel's own Git
  integration.
- The live production bundle (`entry-43967ff40971c1af910330775e71bb9a.js`)
  differs from the current fixed build
  (`entry-b7df53c14d2e42eed52564596de9abbe.js`), confirming production is served
  from the older pre-fix source.
- No Vercel token, CLI, project secret, or repository variable is available to
  this agent, so Vercel project settings cannot be read or changed from here.
  The hold therefore requires owner action — a hard authorization boundary.
- The published "historical flake" explanation in the spec comments was WRONG in
  an important way. It claimed the submit "reads an empty title and no-ops" — an
  empty-title skip. The trace proves otherwise: a REAL To Do row named
  `"Call th"` was created and persisted. The failure is silent data corruption
  of the user's title, not a no-op. The comment has been corrected rather than
  left in place.
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

Engineering closure SUCCEEDED; main integration is correctly BLOCKED at the
owner-authorization boundary.

Delivered:

- The hosted Todo long-title failure is root-caused from provider evidence, not
  inferred: the To Do page derived `Screen`'s `scroll` prop from `totallyEmpty`,
  so the empty→populated flip changed the container's element type, unmounting
  and recreating the Quick Capture input mid-typing and silently truncating a
  115-character title to `"Call th"`. Fixed at source by pinning one stable
  non-scrolling container.
- The test's readiness contract was also wrong and is fixed: `/^\d+ open$/`
  matches `"0 open"` (the EMPTY branch), so the spec could begin typing in a
  branch guaranteed to be replaced. It now requires the populated-branch-only
  `Search tasks` input, the absence of the empty card, and asserts the complete
  title is in the input before submitting.
- A discriminating regression pins DOM node identity across the transition and
  was proven to FAIL with the defect reintroduced and PASS with the fix.
- Hosted re-qualification at `582a1547`: visual 34/34 (0 retried), P0 25/25
  (0 retried), simulation model+oracle pass, deterministic subset pass, retry
  gates clean, quality red only on the mandated dependency audit.
- Strictness preserved end to end: `maxDiffPixels: 0`, zero golden
  regenerations, no timeout increase, no skip, no quarantine, no retry-based
  green, and the dependency audit untouched and truthfully red.

NOT delivered, by design:

- No production-deployment hold was activated. Both Vercel projects currently
  auto-create Production deployments from `main` with no environment protection,
  and their last five `main` deployments failed at the pre-fix defect — so a
  `main` push would now promote unqualified code. Establishing the hold requires
  owner credentials/authorization that this environment does not have.
- No `main` integration, therefore no post-integration audit and no PR closure.
- Policy A vs Policy B was NOT chosen on the owner's behalf.
- All external release gates remain open (dependency advisories, hosted Supabase
  qualification, backup provenance, old-client compatibility, native lifecycle,
  SH-11, SH-21, Linux golden spot-check, production release authorization).

Lesson worth keeping: a value-preserving fix can leave the underlying defect
intact. PR #84 lifted the draft VALUE and its tests passed, yet the input NODE
was still being destroyed. Only the hosted trace distinguished "the title is
wrong" from "the title was never received", and only a node-identity assertion
can keep that defect from returning.
