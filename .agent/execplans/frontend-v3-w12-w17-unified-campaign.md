# ExecPlan: Frontend V3 W12–W17 Unified Campaign (Calm Momentum completion)

Plan-Version: 2
Status: COMPLETED

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
  owner-deferred. `[Post-W17 correction (2026-10-14): the
“Windows-CRLF register-parsing ENVIRONMENT failure” classification was
wrong and is resolved — it was a TEST_BUG in
`tests/agentDocConsistency.test.ts`'s `read()`(CRLF checkouts), fixed at`3aaca2a`(see`docs/ui-ux/v3-audit/w17/defect-register.md` R-1). The
suite is green end-to-end; it is not an environment residual.]`

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

- Current milestone: **C9/C10 complete — campaign operationally finished and
  handed off.** All six waves (W12–W17) are implemented, integrated, evidenced,
  published on `frontend-v3-w12-w17-integration`, and their slice plans are
  COMPLETED. Parent full-application certification stays open (see below).
- Completed:
  - W12 `1d54b70` — Weekly Review / Progress / Activity narrative-first.
  - W13 `b1569f0` — Settings grouped rows, input-first Command Center,
    milestone-first Achievements; plus a real `PillChip` a11y fix.
  - W14 `c6937b5` — whole-app integrity sweep (247 captures) + P1 44pt fix.
  - W15 `42d1c20` — 30 deterministic visual-regression goldens, two-run
    stability, negative sensitivity, CI lane.
  - W16 `d04793b` — exact-source Android API-36 PASS (23/23 flows) with
    provenance; two product defects fixed on-device.
  - W17 `af8eeda`/`528fbe9` — seven-lane ladder; **Vitest fully green
    (2,700 passed / 0 failed)**; five defects resolved (R-1…R-5); security
    reconciled without waiver; RC manifest, verification matrix, defect
    register and correction handoff written. Verdict: CONDITIONAL /
    NEAR-COMPLETE.
  - Publication: PR #76 open on the campaign branch; all three Codex P2 review
    threads replied to and `isResolved: true`; certification worktree removed
    and ports free.
- In progress: None — the campaign is operationally complete.
- Important modified files: see the six slices and
  `docs/ui-ux/v3-audit/w12…w17/`.
- Last successful validation: `npm test` 2,700 passed / 2 skipped / 0 failed;
  typecheck 0; lint 0/0; themes 140/140; OpenSpec 86/86; plans PASS;
  integration 419 pass; timezones 105; P0 journeys 25/25; Chromium 245/245;
  visual 30/30; a11y 10/10; simulation 1/1.
- Current failures: the dependency audit gate (2 inherited advisories, no
  upstream fix, documented not waived) and the pre-existing `settings-ripple`
  journey.
- Relevant quarantines: none added by this campaign.
- Blockers: none for web/PWA. iOS owner-deferred; hosted CI gated by the audit.
- Condition required to unblock: an upstream patched release for `braces` /
  `node-forge` (or removing their tooling chains); an authorized iOS lane.
- Exact resume action after unblock: `node scripts/audit-runtime-deps.mjs`, then
  the acceptance gates in `docs/ui-ux/v3-audit/w17/correction-handoff.md` §7.
- Exact next action: None — the campaign is complete. The next session should
  follow `docs/ui-ux/v3-audit/w17/correction-handoff.md`, whose first bounded
  action is the `settings-ripple` Calories marker decision (C-3).
  `[Post-W17 correction (2026-10-14): C-3 is RESOLVED — the journey's
`Goal 2,400`assertion was a stale selector and was retargeted to the W10
grammar with its SQL/reload/entry-count oracles intact (green 6/6). Active
work is`openspec/changes/frontend-v3-post-w17-correction/`; do not redo
C-3.]`
- Remaining definition of done: Complete for the W12–W17 campaign scope. The
  **parent** Frontend V3 change stays open only for full-certification
  conditions outside this campaign (security advisories, iOS, hosted CI,
  Android re-earn at the RC SHA), which are tracked in
  `docs/ui-ux/v3-audit/w17/correction-handoff.md`.

## Progress

- [x] C0 — recovery: baseline `1f23da4` verified, branch created, foreign
      stash/untracked evidence preserved
- [x] Master ExecPlan + W12 OpenSpec slice authored before production edits
- [x] W12 baseline inventory (`baseline.md`) + hermetic `build:e2e` PASS
- [x] W12 design lock (reflection hierarchy, narrative rules, filter grammar)
- [x] W12 implementation: Weekly Review, Progress Insights, Activity Timeline
- [x] W12 regressions + real-SQLite oracles + rendered before/after evidence
- [x] W13 implementation: Settings grouped rows, Command input-first,
      Achievements milestone-first
- [x] W13 regressions + rendered evidence + adversarial review
- [x] C5 — W14 whole-app matrix, defect ledger, bounded convergence fixes
- [x] C6 — W15 curated baselines, two-run stability, CI integration
- [x] W14 publication (commit `c6937b5`)
- [x] W15 publication (commit `42d1c20`)
- [x] W16 publication (commit `d04793b`)
- [x] W17 publication (commits `af8eeda`, `528fbe9`; PR #76 threads resolved)
- [x] C7 — W16 exact-source Android API-36 qualification
- [x] C8 — W17 verification ladder, RC verdict, correction handoff
- [x] C9/C10 — publication, review threads, final source and records

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
