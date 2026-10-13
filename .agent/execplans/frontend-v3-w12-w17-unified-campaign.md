# ExecPlan: Frontend V3 W12–W17 Unified Campaign (Calm Momentum completion)

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Carry the Frontend V3 "Calm Momentum" programme from its W11.5.1 baseline
through the six remaining waves (W12 Weekly Review/Progress/Activity, W13
Settings/Command/Achievements, W14 whole-app integrity sweep, W15 persistent
visual regression, W16 Android API-36 native qualification, W17 release
candidate assessment) to **near-complete, reviewable release-candidate
readiness with honest certification limits**.

Observable success: all six waves have real user-facing implementation (not
checklists), rendered before/after evidence that was actually inspected,
executable regression oracles with real-SQLite/browser/native evidence where
the contract requires it, truthful plan statuses, and a bounded correction
handoff. The parent V3 plan stays ACTIVE unless every certification condition
is met.

Authority: `D:\Downloads\SuperHabits_Frontend_V3_W12-W17_Unified_Campaign.md`
(the campaign brief), executed under `AGENTS.md` and `.agent/PLANS.md`.

## Context

- Baseline at campaign start: `HEAD = 1f23da4defd7fa45c679261e0db5fade1374bbd5`
  = `origin/main` (W11.5.1 closure). Single worktree
  `D:/Documents/tryPython/superhabits`; working tree clean except the
  foreign untracked `.tmp-ios36423379932/` (preserved untouched). Stash
  `stash@{0}` = `pre-recovery-local-changes` (preserved untouched).
- Branch: `frontend-v3-w12-w17-integration` cut from `main`.
- Parent change: `openspec/changes/frontend-v3-calm-momentum/` (design D4/D5,
  tasks §12–§17). Design authority
  `docs/ui-ux/13-calm-momentum-design-system.md`; references
  `docs/ui-ux/14-v3-reference-ledger.md`; defects `docs/ui-ux/15-v3-defect-ledger.md`.
- W12 target modules: `features/weekly-review/*`, `features/progress/*`,
  `features/activity/*`, entered through `features/planning-hub/PlanningHubScreen.tsx`
  (Progress + Timeline views, Weekly Review overlay button).
- Environment verified: Node v24.3.0 / npm 11.4.2 (repo pins Node 22.23.2 for
  some lanes), Java 17, Android SDK at `%LOCALAPPDATA%\Android\Sdk`, AVD
  `Nitro_API_36` present, Maestro 2.9.0 on PATH, `adb` available, `gh`
  authenticated as `quantdale` with `repo`+`workflow` scopes, `origin/main`
  unprotected (no branch protection), previous PRs mergeable via normal flow.
- Inherited residuals (unchanged, must stay classified): `braces`
  GHSA-vfj7-8cjw-p6xm and `node-forge` GHSA-86w9-cpqp-85rv HIGH advisories
  block hosted `e2e`/`nightly` (quality job otherwise green); Windows-CRLF
  register-parsing ENVIRONMENT failure; D14 host-load headroom; Focus
  notification-timestamp residual. Android API36 pending W16; iOS
  owner-deferred.

## Scope

- W12: narrative-first Weekly Review, truthful Progress Insights, readable
  Activity timeline.
- W13: grouped-row Settings, input-first Command Center, milestone-first
  Achievements.
- W14: whole-app rendered integrity sweep + bounded convergence fixes.
- W15: deterministic curated Playwright screenshot regression suite + CI.
- W16: exact-source Android API-36 qualification (or precise external blocker).
- W17: full verification ladder, cross-wave correction, RC verdict, handoff.
- Docs/evidence under `docs/ui-ux/v3-audit/w12..w17/`; per-wave OpenSpec slices;
  master + per-wave ExecPlans; defect ledger updates.

## Non-Goals

- No reimplementation of W0–W11.5.1; no new phone tabs; no reopening closed
  campaigns except to fix a reproduced regression caused by these waves.
- No `core/db`/`core/sync`/`core/backup`/`core/portable` semantics change; no
  migration or schema change; no production Supabase mutation.
- No dependency remediation of the two inherited HIGH advisories unless a
  safe, bounded, independently verifiable fix exists (W17 §C decides).
- No iOS certification (owner-deferred); no fabricated native passes.
- No test weakening, no baseline-threshold loosening, no `test.fixme`
  inflation.

## Current Checkpoint

- Current milestone: **C7 complete → C8 — W17 integrated release-candidate
  verification** (W12–W16 done; W17 not yet started).
- Completed:
  - C0 recovery; C1/C2 W12; C3/C4 W13; C5 W14; C6 W15; **C7 W16 Android**.
  - W16: exact-source `Nitro_API_36` (API 36 / x86_64) qualification at
    `b50034d` from a clean detached worktree with a credential-free
    `e2e-test`-equivalent APK (`AA89D9FE…`, 0 remote hosts). All six lanes
    green: smoke 2/2, persistence 11/11, lifecycle 6/6, reward 1/1,
    backup-v2 1/1, portable-backup 2/2. Two product defects fixed and
    re-verified on a rebuilt APK (native nav-label truncation; weekly-plan
    day/assignment a11y link) and nine stale/date-dependent flow markers
    corrected without weakening any assertion. iOS remains owner-deferred.
- In progress: W16 commit/publication and certification-worktree cleanup.
- Important modified files: `app/index.tsx`,
  `features/workout/WorkoutScreen.tsx`, `.maestro/flows/*` (9),
  `docs/ui-ux/v3-audit/w16/**`,
  `openspec/changes/frontend-v3-w16-android-qualification/*`.
- Last successful validation: W16 native lanes above; typecheck 0; eslint 0/0;
  W15 visual 30/30; W14 full Chromium 245/245; OpenSpec 84/84.
- Current failures: the inherited Windows-CRLF `agentDocConsistency`
  ENVIRONMENT residual and the pre-existing `settings-ripple` step.
- Relevant quarantines: none added.
- Blockers: None. iOS is owner-deferred and not claimed; EAS/cloud Maestro
  access was not verified.
- Condition required to unblock: None for Android/web.
- Exact resume action after unblock: None currently.
- Exact next action: Begin W17 — reconcile the integrated source and exact RC
  SHA, run the full seven-lane verification ladder (static, unit+integration,
  Playwright/PWA, timezone, simulation/performance, visual/a11y, native +
  security), fix bounded cross-wave defects, then write
  `docs/ui-ux/v3-audit/w17/{README,rc-manifest,verification-matrix,defect-register,correction-handoff}.md`
  and publish the campaign.
- Remaining definition of done: W17 seven-lane verification matrix, RC verdict
  and correction handoff; publication and review-thread reconciliation.

## Progress

- [x] C0 — recovery: baseline `1f23da4` verified, branch created, foreign
      stash/untracked evidence preserved
- [x] Master ExecPlan + W12 OpenSpec slice authored before production edits
- [x] W12 baseline inventory (`baseline.md`) + hermetic `build:e2e` PASS
- [ ] W12 design lock (reflection hierarchy, narrative rules, filter grammar)
- [ ] W12 implementation: Weekly Review, Progress Insights, Activity Timeline
- [ ] W12 regressions + real-SQLite oracles + rendered before/after evidence
- [ ] W13 implementation: Settings grouped rows, Command input-first,
      Achievements milestone-first
- [ ] W13 regressions + rendered evidence + adversarial review
- [x] C5 — W14 whole-app matrix, defect ledger, bounded convergence fixes
- [x] C6 — W15 curated baselines, two-run stability, CI integration
- [x] W14 publication (commit `c6937b5`)
- [x] W15 publication (commit `42d1c20`)
- [ ] W16 publication (commit)
- [x] C7 — W16 exact-source Android API-36 qualification
- [ ] C8 — W17 verification ladder, RC verdict, correction handoff
- [ ] C9/C10 — publication, review threads, final source and records

## Surprises & Discoveries

- 2026-10-14 — The hosted quality job at the campaign baseline fails **only**
  `Audit runtime dependencies` (run 38380431690); every other step passes. The
  inherited audit red is real and unchanged. Hosted `e2e`/`nightly` skip
  behind it.
- 2026-10-14 — `origin/main` has **no branch protection**, so per-wave PRs can
  merge through the normal workflow as previous waves did (PRs #58–#75).
- 2026-10-14 — The workspace `node` is v24.3.0, but the repository documents
  Node 22.23.2 for some QA lanes; the hermetic `build:e2e` succeeded on
  v24.3.0 with the Supabase leak guard reporting 0 hosts.

## Decision Log

- 2026-10-14 — Master plan file is `.agent/execplans/` (non-OpenSpec) because
  it coordinates six OpenSpec slices rather than implementing one change. Each
  wave owns its own `openspec/changes/<slug>/execplan.md`.
- 2026-10-14 — Use one integration branch
  `frontend-v3-w12-w17-integration` with per-wave commit groups, then publish
  per-wave PRs through the normal workflow (campaign §6.2 preferred path).
- 2026-10-14 — W15 baselines live under `e2e/__screenshots__/` per design D5;
  the W1 `visual-audit.spec.ts` harness remains the campaign's inspection
  instrument and is never converted into regression assertions.

## Validation Ledger

- 2026-10-14 — `npm run build:e2e` (unset `EXPO_PUBLIC_*`) — PASS — hermetic
  export, 0 Supabase hosts in `dist/`.
- 2026-10-14 — `gh run view 38380431690` — CONFIRMED — only
  `Audit runtime dependencies` fails; all other quality steps pass.
- Per-wave evidence: see each `openspec/changes/<slug>/execplan.md`
  Validation Ledger and `docs/ui-ux/v3-audit/<wave>/README.md`.

## Changed Files / Areas

- `.agent/execplans/frontend-v3-w12-w17-unified-campaign.md` — this master plan.
- `openspec/changes/frontend-v3-w12-reflection-insights/*` — W12 slice.
- `features/weekly-review/*`, `features/progress/*`, `features/activity/*` —
  W12 implementation.
- `docs/ui-ux/v3-audit/w12/*` — W12 rendered evidence.
- (W13–W17 paths recorded as those waves land.)

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, then this file completely.
2. Read the current wave slice plan
   (`openspec/changes/frontend-v3-<wave>-*/execplan.md`).
3. `git status --short`; `git diff --stat`; `git diff --name-only`.
4. `npm run agent:plans`; `npm run agent:resume -- --plan .agent/execplans/frontend-v3-w12-w17-unified-campaign.md`.
5. `npm run qa:affected` and follow the resolved gates.
6. Reconcile the checkpoint with Git and the rendered state; update this plan
   before continuing. Resume only from `Exact next action`.

## Outcomes & Retrospective

- Status: Active.
- Summary: Campaign opened; W12 slice in progress.
- Follow-up: W13–W17 remain.
