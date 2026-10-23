# ExecPlan: Correction Campaign A — Critical Integrity, Cross-PR Convergence, Adversarial Certification & Controlled Main Integration

Plan-Version: 2
Status: COMPLETED

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

- Current milestone: **COMPLETE** — integrated to `main`.
- Completed: Phase A (storage safety + mandatory negative tests), Phase A2
  (multi-tab OPFS ownership), Phase A3 (fail-closed transactions + real-engine
  rollback proofs), Phase B (PR #85 visual closure + planning flake), Phase B2-B4
  (independent adversarial review of PRs #86-#90 with all P1s corrected and
  mutation-proven), Phase C (six-branch integration with lockfile semantics
  verified), Phase D (combined acceptance on the exact candidate + final
  adversarial review), Phase E (**main integration complete**: PR #91 merged
  non-force at `3022e9dd64e3a692d144fd02ec87fe711999022b`).
- In progress: nothing.
- Important modified files: see the campaign report
  `docs/reports/critical-integrity-cross-pr-acceptance-report.md` (sections B, D,
  K); Git is authoritative.
- Last successful validation: on the final candidate `0c05c74f` — typecheck 0,
  lint 0, 3174 unit+integration tests pass, visual 34/34, schema validator PASS,
  brand inventory OK, plus hosted `e2e` PASS (run 39887821954) and `quality` red
  only on the dependency-advisory step.
- Current failures: dependency-advisory gate red by design (`braces`,
  `node-forge`; `first_patched_version: null`; no waiver added).
- Relevant quarantines: none.
- Blockers: none for source integration. Remaining release gates are external
  (hosted Supabase/Vercel certification, native device certification, store and
  legal owner actions, branch-protection enablement, advisory policy decision).
- Condition required to unblock: owner credentials/devices for those external
  gates — tracked in report section Q.
- Exact resume action after unblock: see report section R (Correction
  Campaign B: native certification + migration block 26 cohort repair).
- Exact next action: None — task complete.
- Remaining definition of done: none for this campaign.

## Progress

- [x] Recon: remote/PR/worktree/security/CI state established
- [x] Phase A: storage safety (CORR-A-02) + negative tests
- [x] Phase A2: multi-tab OPFS (CORR-A-03) + tests
- [x] Phase A3: transaction atomicity (CORR-A-04) + rollback tests
- [x] Phase B: PR #85 visual closure + planning flake triage
- [x] Phase B2–B4: independent review PR #86–#90 (+ negative controls)
- [x] Phase C: integration branch + conflict/lockfile resolution
- [x] Phase D: combined acceptance + adversarial review
- [x] Phase E: conditional main integration + post-verification
- [x] Final report + ExecPlan COMPLETED

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

### Final integration evidence (2026-10-23)

- **PR #91 MERGED non-force** at `2026-10-23T03:02:08Z`; merge commit
  `3022e9dd64e3a692d144fd02ec87fe711999022b`; `origin/main` = `3022e9dd`.
- All six PR heads verified in `main` ancestry; PRs #85–#91 all state=MERGED.
- Hosted `e2e` on the final candidate `0c05c74f` (run `39887821954`) — **PASS**
  (48m39s, 0 failing steps; includes the Linux visual corpus validating the two
  updated goldens). `quality` red on the advisory step ONLY.
- **Production safety:** `gh api repos/.../deployments` after the merge → ZERO
  deployments created; ZERO Production-environment deployments in all history.
  The hold prevented promotion. CI triggered on the integrated head `3022e9dd`.
- Preflight at merge: main unchanged at `0259c2a7`; ruleset `Protect Main`
  enforcement=disabled (nothing bypassed); classic protection absent;
  `vercel.json` = `{"git":{"deploymentEnabled":{"main":false}}}` unchanged.

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

- Status: Complete — integrated to `main`.
- Summary: six independently developed workstreams became one validated
  source package. Two genuine product defects were found and fixed that no
  unit test would have caught: (a) this campaign's own `StorageSafetyHost`
  called `useAppNavigation` above `NavigationProvider`, crashing the app behind
  the error boundary — caught only by the visual gate; (b) the backup-capture
  path bypassed the mutation-level storage-error classification — caught only by
  a real-SQLite negative test. The visual gate also proved PR #85's failures
  were exactly the intended branding string (443/575 px confined to one line),
  and a _second_ stale E2E contract (`infrastructure.spec.ts`) failed all three
  hosted attempts after CORR-A-03 legitimately changed the multi-tab mechanism —
  fixed by asserting the guarantee rather than the superseded mechanism.
- Corrected: 7 P1 + 5 P2 adversarial-review findings (guard evasions, one-sided
  signing claim, READY-from-local-verdict, owner-action under-count, stale
  `dbError` race, account-token theft, quick-add input loss, dead lint
  exemption, lock-after-remount, classification collisions), each pinned by a
  mutation/negative test rather than by prose.
- Proof of production safety: `gh api .../deployments` shows zero deployments
  after the merge and zero Production-environment deployments in history.
- Follow-up: report section Q/R — advisory policy decision, hosted Supabase/Vercel
  certification, native device certification, migration block 26 cohort repair,
  web non-transactional interleave, branch protection.
- Lessons: a `#!/usr/bin/env node` shebang breaks Vite's transform of an
  imported `.mjs` (the whole suite silently failed to collect); text-matching
  security guards need per-item mutation tests or their template literals go
  vacuous; hosted E2E is the only place cross-platform contracts (visual
  rasterization, multi-tab locking) are actually proven; and an automated
  delta-lint queue can lag far enough behind edits to report resolved findings —
  the repo gates (`npm run lint`, `tsc`, `eslint --no-cache`) stay authoritative.
