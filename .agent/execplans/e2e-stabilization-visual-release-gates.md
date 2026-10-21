# E2E Stabilization, Visual Fidelity & Release-Gate Hardening

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Recover PR #82's newly exposed hosted E2E failures to a defensible root cause,
correct confirmed defects without weakening any gate, establish trustworthy
cross-environment visual regression evidence, and prepare (not apply) an
owner-actionable branch-protection / release-governance configuration. Workout
recovery durability and honest security-gate behavior are preserved throughout.

## Context

- Branch: `e2e-stabilization-visual-fidelity` (successor to
  `ci/independent-e2e-qualification` = PR #82 head `a70026ec`, base `e6cf0d34`
  = `origin/main`). PR #82 scope (CI decoupling) is verified correct and left
  untouched; this branch carries the bounded engineering fixes.
- Hosted evidence preserved as artifact archives under
  `C:/Users/Michael Roy/pi-evidence/super-habits-e2e-stab-2026/hosted/`
  (runs 39541914477 [workout failure] and 39545583888 [visual failures];
  SHA-256 recorded in the final report).
- Run A (39541914477, head 64dc72df): functional Chromium 257 passed / 1
  failed / 47 skipped; `e2e/workout-gym-v2.spec.ts:265` failed 3/3 attempts.
- Run B (39545583888, head a70026ec): functional Chromium green (255/47/0);
  visual lane 31 failed / 3 passed at `maxDiffPixels: 0`.

## Scope

- Workout reload/resume durability defect + regression evidence.
- Visual baseline provenance / cross-environment fidelity.
- Minimal test-synchronization fixes discovered en route.
- Read-only governance investigation + owner-actionable configuration text.
- Validation gates and evidence preservation.

## Non-Goals

- No merges to main; no deployments; no ruleset/environment changes; no
  dependency or security-policy changes; no screenshot tolerance changes; no
  broad CI refactoring.

## Current Checkpoint

- Current Milestone: hosted verification + adversarial review (milestone 7 of 7)
- Completed: root causes A+B established from hosted artifacts; Track A fix
  (handleStart awaits draft write before running state) + strengthened
  regression + discriminating fault-injection demo; Track B platform-scoped
  goldens (win32 = original reviewed corpus, linux = hosted Run B actuals,
  each classified as rasterization-only drift); long-title To Do snapshot
  remount race fixed; golden-manifest provenance + table-column fix;
  lint-scope exclusion for derived QA evidence; Track C ciLaneIntegrity
  13/13; Track D governance read-only investigation (Protect Main ruleset
  15001092 enforcement=disabled; classic branch protection 404; 7
  environments all can_admins_bypass=true with zero protection rules;
  vercel.json has no branch pinning beyond Vercel defaults).
- In Progress: None — task complete. Hosted verification finished on run
  39634540721 (SHA 8dcffd1f): e2e job SUCCESS (feature 258/258 with
  retriedThenPassed=0, visual 34/34, P0 25/25, sim self-tests 9/9,
  deterministic scenarios all passed); quality stays honestly red on the
  dependency audit only.
- Important Modified Files: `.gitignore`, `eslint.config.mjs`, `playwright.config.ts`,
  `features/workout/WorkoutSessionScreen.tsx`, `e2e/workout-gym-v2.spec.ts`,
  `e2e/visual-regression.spec.ts`, `e2e/__screenshots__/visual-regression.spec.ts/*`
  (30 renamed `-win32`, 30 new `-linux`), `docs/ui-ux/v3-audit/w15/golden-manifest.md`,
  `.agent/execplans/e2e-stabilization-visual-release-gates.md`.
- Last Successful Validation: typecheck clean; eslint clean (0/0); unit 2436/2436; unit
  ciLaneIntegrity 13/13; integration workout suites 33/33; workout E2E 7/7;
  visual 34/34 (post-fix, platform-scoped goldens); audit-runtime-deps
  honestly red (braces + node-forge) — 2026-10-21.
- failures: hosted quality step "Validate versioned ExecPlans" failed on this
  plan's missing sections — corrected in this rewrite; re-verify hosted.
- quarantines: none.
- blockers: none local. WSL/Docker unavailable (cross-env proof = hosted
  artifacts + hosted re-run). Vercel API access unavailable — deployment
  review is repository-configuration-based only.
- Exact next action: None — task complete. PR #83 is open for owner review
  with the final report published. Remaining items are external gates only.
- Remaining Definition of Done: None — hosted re-verification green
  (39634540721, retriedThenPassed=0), Track E adversarial review complete
  (4 P2 findings: 1 fixed in-repo, 3 documented), final report published.

## Progress

- [x] Phase 0: repo/PR state recovered; worktree clean; PR #82 head verified.
- [x] Phase 1: failure matrix from hosted artifacts (trace-level evidence).
- [x] Phase 2: workout root cause (fire-and-forget draft write raced reload).
- [x] Phase 2 fix + regression + negative controls + fault-injection demo.
- [x] Phase 3: visual forensics (31/31 classified: rasterization drift).
- [x] Phase 3 fix: platform-scoped goldens; strict comparison retained.
- [x] Phase 4: lane evidence re-run (workout 7/7, visual 34/34 local).
- [x] Phase 5: governance read-only investigation + target config prepared.
- [x] Phase 6: security gate verified unchanged and honestly red.
- [x] Phase 9: quality gates run (see Validation Ledger).
- [x] Hosted verification of pushed SHA (39634540721: e2e SUCCESS, 0 retries).
- [x] Phase 10: independent adversarial review (reviewer agent; findings triaged).
- [x] Phase 11: final report published.

## Surprises & Discoveries

- The hosted workout failure is a durability race, not a hydration race: the
  failure snapshot showed the landing fully rendered with hero "Rest day" —
  `getWorkoutSessionDraft()` returned null because the write never committed.
- The visual suite's 3 "passes" are the readiness negative controls; every
  screenshot comparison failed — one root cause (cross-OS text rasterization).
- `snapshotPathTemplate` was deliberately platform-NEUTRAL, binding Windows
  goldens to an Ubuntu gate — the provenance defect behind all 31 failures.
- A pre-existing remount race in the long-title To Do snapshot: the
  `TodoQuickCapture` subtree swaps when `totallyEmpty` flips, discarding a
  bulk `fill()`; `scrollIntoViewIfNeeded` fails hard (no retry) on the
  missing row. Fixed with per-key typing + canSubmit-derived enabled gate +
  retry-capable visibility assertion.
- pi-lens lint replayed stale findings on extracted Playwright Trace Viewer
  vendored code (`snapshot.html`) held in evidence archives; resolved by
  preserving archives outside the workspace and excluding derived evidence
  from lint scope per repo convention. No product code was involved.

## Decision Log

- Successor branch (not PR #82's branch): the fixes are outside PR #82's
  decoupling scope; keeping PR #82 review-clean. — settled 2026-10-21.
- Track A fix location: `handleStart` gates the running UI on the draft write
  (observable readiness contract) rather than test-side sleeps or timeout
  inflation; write failure keeps best-effort semantics so a storage failure
  never blocks a workout. — settled 2026-10-21.
- Track B approach: platform-scoped goldens (`{-platform}` token), not
  tolerance changes, masks, or blind regeneration. linux corpus derived from
  hosted actual captures after per-image classification; win32 corpus keeps
  the reviewed goldens byte-identical. — settled 2026-10-21.
- Evidence archives live outside the repo workspace (pi-evidence) with
  SHA-256 checksums; extracted trees deleted after entry-complete zips
  verified. — settled 2026-10-21.
- Governance findings recorded, not applied (owner authorization required).

## Validation Ledger

- `npm run typecheck` — clean (0 errors). 2026-10-21.
- `npm run lint` — clean (0 errors, 0 warnings). 2026-10-21.
- `npm run test:unit` — 194 files / 2436 tests passed. 2026-10-21.
- `npx vitest run tests/ciLaneIntegrity.test.ts` — 13/13. 2026-10-21.
- integration `workoutRecoveryIdentity` + `workoutPendingSaveRecovery` —
  33/33. 2026-10-21.
- `npx playwright test e2e/workout-gym-v2.spec.ts --project=chromium` — 7/7.
  2026-10-21.
- `npm run visual` — 34/34 (strict maxDiffPixels: 0 retained). 2026-10-21.
- Fault-injection discrimination: delayed draft write + reverted gate →
  test fails with exact hosted signature; fix restored → 3/3 pass. 2026-10-21.
- `node scripts/audit-runtime-deps.mjs` — FAILS (2 undocumented high:
  braces GHSA-vfj7-8cjw-p6xm, node-forge GHSA-86w9-cpqp-85rv) — expected,
  unchanged. 2026-10-21.

## Changed Files / Areas

- `features/workout/WorkoutSessionScreen.tsx` — durability readiness at Start.
- `e2e/workout-gym-v2.spec.ts` — durability row oracles + negative controls.
- `e2e/visual-regression.spec.ts` — long-title remount-race fix.
- `playwright.config.ts` — platform-scoped snapshot template.
- `e2e/__screenshots__/visual-regression.spec.ts/` — 30 renamed `-win32`,
  30 added `-linux`.
- `docs/ui-ux/v3-audit/w15/golden-manifest.md` — provenance contract +
  change-log fix.
- `.gitignore`, `eslint.config.mjs` — derived evidence out of lint scope.
- Git is authoritative for the actual diff.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`, `git log --oneline -3` on
   `e2e-stabilization-visual-fidelity`.
3. `npm run agent:resume -- --plan .agent/execplans/e2e-stabilization-visual-release-gates.md`.
4. Resume from `Exact next action` in Current Checkpoint.

## Outcomes & Retrospective

Completed 2026-10-21. Workout durability defect fixed with a true
readiness gate (Work timer signal after an initially insufficient Skip-set
gate was caught by the hosted retry-report and re-fixed); visual baselines
platform-scoped with strict comparison intact (hosted 34/34 on linux);
long-title remount race fixed; security gate preserved honestly red.
Adversarial review accepted all areas (no P0/P1). Retrospective: the first
gating signal (Skip set) was phase-derived, not running-state-derived —
hosted retry evidence caught it; the fault-injection discipline made each
fix independently verifiable.
