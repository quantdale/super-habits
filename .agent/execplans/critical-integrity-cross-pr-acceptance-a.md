# ExecPlan: Correction Campaign A — Critical Integrity, Cross-PR Convergence, Adversarial Certification & Controlled Main Integration

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Turn six separately validated workstreams (PRs #85–#90) into one coherent,
independently reviewed, data-safe source baseline: correct the highest-risk
reliability defects (storage quota/eviction, multi-tab OPFS contention,
transaction atomicity), close PR #85's two visual failures, independently review
PRs #86–#90, integrate everything on one acceptance branch, validate the exact
combined candidate, and integrate to `origin/main` only when every mandatory
preflight condition is satisfied. Production release is NOT authorized.

## Context

- Repo: `https://github.com/quantdale/super-habits.git`, Windows workstation,
  Node v22.23.2, npm 10.9.8. `gh` available. No Docker/WSL distro, no
  `vercel`/`supabase` CLI, no Supabase/Vercel tokens (hosted cloud work stays
  EXTERNAL unless evidence proves otherwise).
- Starting `origin/main`: `0259c2a72bb71ba3f9459cd071b791feb2a4ff35` (verified
  2026-10-23). Six PR heads verified unchanged vs the prior campaign:
  #85 `c88b4d40`, #86 `f632b00b`, #87 `4132a23c`, #88 `cda1e378`,
  #89 `a0a4e2ce`, #90 `0bf967be`. All MERGEABLE/UNSTABLE (advisory gate red).
- Prior campaign: `.agent/execplans/full-spectrum-preproduction-campaign-v1.md`
  (COMPLETED) + `docs/reports/full-spectrum-preproduction-campaign-report.md`
  (corrections backlog CORR-A-01..D-05). This campaign = "Campaign A".
- Worktrees: primary (`super-habits`, owned by this campaign) and `sh-branding`
  (holds `main`, read-only to me). Recovery reference: branch
  `campaign/ws02-dependency-scope` @ `f632b00b` (pushed to origin) is the state
  of the primary worktree before this campaign switched it.
- Visual baselines are platform-suffixed (`*-linux.png` from hosted CI). This
  workstation is Windows with no WSL/Docker, so Linux captures come only from
  hosted CI evidence (run 39814238152 artifacts) or a dispatched workflow.
- Security gate: `node scripts/audit-runtime-deps.mjs` is RED by design on
  `braces` GHSA-vfj7-8cjw-p6xm and `node-forge` GHSA-86w9-cpqp-85rv (both
  `first_patched_version: null`). Must stay visible; no waivers.
- Deployment boundary: Vercel hold `"git": {"deploymentEnabled": {"main": false}}`
  must be preserved and verified on BOTH Vercel projects. No production release.

## Scope

- Phase A: storage quota/eviction handling, durable-write error classification,
  recovery UX, negative tests (CORR-A-02, P0).
- Phase A2: multi-tab OPFS contention detection + bounded recovery (CORR-A-03).
- Phase A3: `withSQLiteTransaction` fallback audit + atomicity tests (CORR-A-04).
- Phase B: PR #85 visual closure (2 failures), planning flake triage,
  independent review of PR #86–#90.
- Phase C: combined integration branch `integration/full-spectrum-correction-a`
  with deliberate conflict resolution and lockfile invariant checks.
- Phase D: combined acceptance on the exact final SHA + adversarial review.
- Phase E: controlled, non-force integration to `origin/main` only if all 17
  mandatory preflight conditions hold; post-integration GitHub + Vercel verify.
- Final report: `docs/reports/critical-integrity-cross-pr-acceptance-report.md`.

## Non-Goals

- No production deployment/promotion; no Vercel-hold removal.
- No destructive cloud/native actions; no native identity change.
- No security-policy weakening, allowlist additions, or advisory downgrades.
- No force-push, no protection bypass, no synthetic green statuses.
- No blind screenshot baseline regeneration; no `maxDiffPixels` increases.
- No break of SQLite/OPFS/portable-backup compatibility.

## Current Checkpoint

- Current milestone: Phase C partial (six PRs merged into integration branch,
  lockfile semantics verified) → Phase A implementation in progress.
- Completed: recon; PR #85 visual failure ROOT-CAUSED (both failures are the
  single intended branding string `SuperHabits`→`super-habits` in the Settings
  Theme-mode helper line; diff masks prove pixel changes confined to that line;
  evidence under .agent/evidence/campaign-a/run-39814238152/); all six PRs
  merged `--no-ff` into `integration/full-spectrum-correction-a` with zero
  textual conflicts; lockfile inventory proven identical to PR #86's validated
  lock (0 version diffs vs f632b00b; exactly the 2 intended brace-expansion
  bumps vs main; 131 platform packages intact); advisory gate still honest
  (braces + node-forge only).
- In progress: Phase A implementation — core/storage/storageSafety.ts
  (classification/estimate/persist), core/storage/dbOwnership.ts (Web Locks
  single-writer), core/storage/storageSentinel.ts (reset detection),
  transactions fail-closed, runBackupMutation error classification,
  quick-add failure notice, AppProviders wiring.
- Important modified files: this plan; merged PR content (86: core/db/client.ts
  migration-6 transaction + scripts/audit-runtime-deps.mjs; 87:
  core/providers/localDbPhase.ts; 88: scripts/validate-supabase-schema.mjs;
  89: docs/release/release-signing-posture.md; 90: scripts/release-readiness.mjs;
  85: brand copy + ci.yml + package metadata).
- Last successful validation: `git fetch origin --prune` (origin/main =
  0259c2a7, matches brief) 2026-10-23.
- Current failures: dependency-advisory gate red (braces + node-forge) — by
  design, unchanged.
- Relevant quarantines: none added/removed.
- Blockers: hosted Supabase/Vercel certification EXTERNAL (no credentials);
  native device certification EXTERNAL; branch-protection enablement EXTERNAL.
- Condition required to unblock: n/a (unrelated work proceeds).
- Exact resume action after unblock: n/a.
- Exact next action: commit Phase A increment 1; then implement
  core/storage/dbOwnership.ts + storageSentinel.ts + runBackupMutation
  classification + quick-add failure notice + integration negative tests
  (quota write, interrupted backup, retry/no-duplicate, real-adapter rollback).
  Then correct the P1 guard findings from the #88–#90 review (verify by
  mutation first), then PR #85 visual baseline closure, then Phase D/E.
- Remaining definition of done: all of §18 of the campaign brief — Phase A/A2/A3
  fixes + mandatory negative tests, PR #85 visual closure, independent review of
  #86–#90, combined candidate validated on final SHA, security posture honest,
  Vercel hold verified on both projects, conditional main integration +
  post-verification, final report sections A–R.

## Progress

- [x] Recon: remote/PR/worktree/security/CI state established
- [ ] Phase A: storage safety (CORR-A-02) + negative tests
- [ ] Phase A2: multi-tab OPFS (CORR-A-03) + tests
- [ ] Phase A3: transaction atomicity (CORR-A-04) + rollback tests
- [ ] Phase B: PR #85 visual closure + planning flake triage
- [ ] Phase B2–B4: independent review PR #86–#90 (+ negative controls)
- [ ] Phase C: integration branch + conflict/lockfile resolution
- [ ] Phase D: combined acceptance + adversarial review
- [ ] Phase E: conditional main integration + post-verification
- [ ] Final report + ExecPlan COMPLETED

## Surprises & Discoveries

- WSL binary exists but no distro is installed → no local Linux screenshot
  capture path; Linux visual baselines must close from hosted evidence.
- `gh api .../dependabot/alerts` is disabled for the repo (403); advisory truth
  is the audit script + advisory API, as the prior campaign used.

## Decision Log

- 2026-10-23 — Integration strategy: single acceptance branch
  `integration/full-spectrum-correction-a` off `origin/main`; merge PRs in the
  recommended order (86→87→88→89→90→85), then land Phase A corrections on top
  so corrections are written against the combined base. Why: corrections touch
  `core/db/client.ts` (PR #86) and startup (PR #87); writing them on the merged
  base avoids re-merging the same files twice.
- 2026-10-23 — Primary worktree repurposed from `campaign/ws02-dependency-scope`
  (clean, fully pushed at `f632b00b`) to the integration branch; `sh-branding`
  worktree stays untouched holding `main`. Why: single writer, reuse node_modules
  for iterative validation, nothing unpushed is at risk.
- 2026-10-23 — Visual baseline closure will use hosted-run _actual_ captures as
  the new Linux baselines only after pixel-level proof that the diffs are solely
  intended branding; never wholesale `--update-snapshots`.

## Validation Ledger

- 2026-10-23 — `git fetch origin --prune` + `git rev-parse origin/main` — PASS —
  origin/main = 0259c2a7 matches the brief's last-verified SHA.
- 2026-10-23 — `gh pr view #85..#90` — PASS — all six heads byte-identical to
  the historical references; all MERGEABLE against main.
- 2026-10-23 — lockfile inventory diff (WORK vs main/ws02/brand85) — PASS —
  identical package key sets; version diffs exactly the 2 intended
  brace-expansion bumps vs main; 0 diffs vs f632b00b; 131 platform packages.
- 2026-10-23 — `node scripts/audit-runtime-deps.mjs` — FAIL (by design) —
  exactly braces + node-forge HIGH, allowlist empty.
- 2026-10-23 — `npx vitest run tests/storageSafety.test.ts` — PASS 17/17.
- 2026-10-23 — `npx vitest run` (full, after transactions fail-closed + 57
  double updates + release-readiness shebang fix) — PASS — 3130 passed /
  3 skipped / 0 failed (305 files). Note: `tests/releaseReadiness.test.ts`
  could not even collect on the merged tree — PR #90's script carried a
  `#!/usr/bin/env node` shebang that Vite's transform rejects on import; removed
  (scripts run via `node scripts/...`), 8/8 green.
- 2026-10-23 — review lanes: PR #86 review (builtin reviewer) — OK with notes
  (1 P2 crash-window cohort, 3 INFO); PR #88–#90 review — BLOCK, 7 P1
  guard-effectiveness findings (to verify + correct); PR #87 review — lane
  lacked tooling (redo needed); claude-code + codex-exec external lanes —
  ENVIRONMENT failures (OAuth expired / sandbox rejection); hy3-free-worker —
  BLOCKED fail-closed.

## Changed Files / Areas

- `.agent/execplans/critical-integrity-cross-pr-acceptance-a.md` — this plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan end-to-end.
2. `git status --short`, `git log --oneline -15`, `git worktree list`,
   `git diff --stat origin/main...HEAD`.
3. `npm run agent:resume -- --plan .agent/execplans/critical-integrity-cross-pr-acceptance-a.md`.
4. Re-verify: `git fetch origin` + `git rev-parse origin/main`; advisory state
   (`node scripts/audit-runtime-deps.mjs`); PR heads (`gh pr view`); Vercel hold
   (both projects) — all drift.
5. Continue from **Exact next action** in Current Checkpoint.

## Outcomes & Retrospective

- Status: Active.
- Summary: campaign in progress.
- Follow-up: fill at completion.
