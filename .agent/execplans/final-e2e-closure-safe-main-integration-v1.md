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

- Current Milestone: P1/P2 complete; the production-deployment hold is
  IMPLEMENTED and EMPIRICALLY PROVEN on both Vercel projects (`7ff88e2a`).
  Awaiting hosted CI on the hold commit, then the controlled non-force main
  integration (Policy B, owner-authorized).
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
- In Progress: hosted CI on `7ff88e2a` (the hold commit), then Phase 6 preflight
  and the single non-force fast-forward of the stack into `origin/main`.
  Commits `30ff9188` (input-loss fix + tests), `a14a2c0c` (empty-state
  scrollability + discriminating test), `7ff88e2a` (Vercel production hold +
  contract test), plus plan commits, are on
  `origin/web-export-bridge-isolation-v1` = PR #84.
- Important modified files: `vercel.json` (main-scoped deployment hold),
  `tests/vercelProductionHold.test.ts` (hold + preserved-settings contract),
  `features/todos/TodosScreen.tsx` (container pin + empty-branch wiring), the
  new `features/todos/TodoEmptyStateScroll.tsx`,
  `e2e/visual-regression.spec.ts` (readiness + full-value contract), the Quick
  Add durability E2E spec (node-identity + scrollability regressions), and this
  plan.
- Last successful validation: **hosted FINAL HEAD run `39749716950` at
  `d83a9ae8`** — the entire `e2e` job is GREEN: feature suite 262 passed /
  47 skipped / 1 non-strict flake, visual **34/34** with 0 retried-then-passed
  (`to do long title (phone, light)` ✓ on its first attempt), P0 journeys 25/25
  with 0 retried, simulation model+oracle 9/9, deterministic scenario subset
  pass, and every retry gate reports `strictRetriedThenPassed: 0`. The `quality`
  job is green on typecheck, lint, edge-function typecheck, theme tokens,
  openspec, journey-label/quarantine parity, ExecPlan validation and
  unit+integration, and red ONLY on the mandated dependency audit. **Locally at
  `a14a2c0c`:** visual 34/34, feature 263 passed / 47 skipped / 0 failed /
  0 flaky, P0 25/25, `npm test` 3069 passed / 3 skipped, typecheck 0, lint 0/0,
  openspec 89/89, all 149 versioned ExecPlans valid.
- Current failures: Dependency-security audit remains RED by design (exit 1) with
  exactly the two mandated advisories (`braces` GHSA-vfj7-8cjw-p6xm,
  `node-forge` GHSA-86w9-cpqp-85rv) — external release blocker, not a regression
  and not to be weakened.
- Relevant quarantines: none introduced. The single hosted flake at the final
  head (`workout.spec.ts:400`, non-strict, failed→passed) recurs intermittently
  and also flaked on the previous head; it touches neither the To Do surface nor
  any file this campaign changed, and passes 3/3 at repeat-each 3 in isolation.
  It is reported, not hidden or quarantined.
- Blockers: none for source integration. The production hold is established and
  verified (see Surprises & Discoveries for the empirical proof). Production
  RELEASE remains blocked by the unresolved dependency advisories and the other
  external gates listed in Outcomes — that is the intended state, not a blocker
  to source integration.
- Exact next action: confirm hosted CI at `7ff88e2a` is green on `e2e` and red
  only on the dependency audit, then run the Phase 6 preflight and perform ONE
  non-force fast-forward push of the stack head into `origin/main`.
- Remaining definition of done: hosted CI at the hold commit (in flight),
  independent read-only review of the hold design (done; empirically controlled),
  Policy B recorded (owner-authorized), verified production hold on both
  projects (DONE), clean fast-forward ancestry (verified), and the
  post-integration audit of GitHub + both Vercel projects (after the push).
- Condition required to unblock: not applicable — the previous blocker (no
  verifiable production hold) is resolved. Production RELEASE still requires the
  dependency advisories to be remediated plus the external certification gates.
- Exact resume action after unblock: if context is lost, re-read this checkpoint,
  verify `origin/main` is still `e6cf0d34` and the branch head matches
  `origin/web-export-bridge-isolation-v1`, then perform the single non-force
  fast-forward and the post-integration audit.

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
- **No Vercel production hold existed** before this campaign. GitHub environment
  protection was empty for every Vercel environment (`Production – super-habits`,
  `Production – superhabits`, and `Production` all reported
  `protection_rules=0`), Vercel keeps `main` as the Production branch for both
  projects, and both projects created a Production-target deployment on every
  `main` push. GitHub environment rules do not gate Vercel's own Git integration.
- **The hold is now established and EMPIRICALLY proven, not assumed.** Vercel's
  documentation states that `git.deploymentEnabled` suppresses deployments for a
  branch but does NOT document whether it is honoured for the commit that
  INTRODUCES the rule, and it also states the precedence trap: "If a branch
  matches multiple rules and at least one rule is `true`, a deployment will
  occur." Both questions were answered by controlled experiment on a throwaway
  branch keyed to itself (production never involved; every resulting deployment
  was a Preview):
  - `16eed75b` — `vercel.json` with `deploymentEnabled: {"probe/…": false}` in
    the same commit: **0 deployments on BOTH projects**, sampled every ~25s for
    > 90s after the push.
  - `62412c02` — the same branch with that exclusion reverted out: **1 Preview
    deployment on BOTH projects** (`Preview – super-habits` then
    `Preview – superhabits`).
    The control run isolates the exclusion as the cause (rather than an unrelated
    webhook failure) and proves webhook-ingestion evaluation, including for the
    introducing commit. The probe branch was then deleted.
- Because the precedence rule means a `true` rule matching `main` would silently
  re-open auto-release, the shipped contract test explicitly rejects any `true`
  rule that matches `main`, not just a lost `git` key.
- The live production bundle (`entry-43967ff40971c1af910330775e71bb9a.js`)
  differs from the current fixed build
  (`entry-b7df53c14d2e42eed52564596de9abbe.js`), confirming production is served
  from the older pre-fix source.
- No Vercel token, CLI, project secret, or repository variable is available to
  this agent, so Vercel DASHBOARD settings cannot be read or changed from here.
  That is why the hold was implemented through the repository-controlled
  `vercel.json` mechanism instead of a dashboard toggle, and why it could be
  verified without any dashboard access.
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
