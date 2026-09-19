# ExecPlan: App Store Readiness Commit

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Commit the already-prepared App Store readiness artifacts (docs/release, public/privacy.html, store/release/privacy/age/icon/play/version tests, per-topic app-store execplans) as a single clean conventional commit, without tagging, pushing, inventing owner PII, or running EAS submit. Observable success: one local commit containing only the scoped readiness paths, with `git status --short` showing no leftover staged/scope dirt (unrelated dirt, if any, untouched).

## Context

- Repo: SuperHabits (Expo + React Native, offline-first, single-page shell). This task is docs/tests/plans only — no runtime code, migration, or sync changes.
- Working tree currently has 2 modified + 21 untracked files, all inside the requested scope (verified 2026-09-19 via `git status --short`):
  - Modified: `docs/release/app-store-readiness.md`, `docs/release/release-notes-1.0.0.md`
  - Untracked docs: `docs/release/age-rating-and-trader.md`, `icon-splash-asset-audit.md`, `privacy-policy.md`, `store-assets-checklist.md`, `store-data-declarations.md`, `version-build-consistency.md`
  - Untracked hosting: `public/privacy.html`
  - Untracked tests (7): `tests/age-rating-dsa.test.ts`, `tests/icon-splash-asset-audit.test.ts`, `tests/play-listing-copy.test.ts`, `tests/privacy-hosting.test.ts`, `tests/release-notes.test.ts`, `tests/store-assets-checklist.test.ts`, `tests/version-build-consistency.test.ts`
  - Untracked per-topic plans (8): `.agent/execplans/app-store-*-v1.md` (age-rating-dsa, icon-splash-audit, play-listing-copy-guard, privacy-artifacts, privacy-hosting, release-notes, store-assets-checklist, version-build-consistency)
- Nothing is staged yet (`git diff --cached --name-only` empty). No unrelated dirty files observed, but staging must use explicit pathspecs, never `git add -A`.
- Authoritative guides: `AGENTS.md` (commit hygiene, no tag/push), `.agent/PLANS.md` (this plan's lifecycle).

## Scope

- Write this ExecPlan at `.agent/execplans/app-store-commit-readiness-v1.md` (itself part of the staged scope via `.agent/execplans/app-store-*-v1.md`).
- Stage ONLY:
  - `docs/release/*` (all 8 readiness docs present)
  - `public/privacy.html`
  - The 7 scoped test files listed above (store/release/privacy/age/icon/play/version themes)
  - `.agent/execplans/app-store-*-v1.md` (8 per-topic plans + this commit plan)
- Write a conventional commit message summarizing App Store readiness docs/tests/execplans (docs/release + privacy hosting + store tests).
- Commit locally and verify with `git status --short` + `git log`/`git show --stat`.

## Non-Goals

- No `git tag v1.0.0` (explicitly forbidden).
- No `git push` to any remote (default NO PUSH — leave push to human).
- No owner PII invention (no names, emails, addresses, IDs in docs/commit).
- No EAS submit / EAS build.
- No model switching (model already set).
- No code changes, no test edits, no test runs as a gate (commit-readiness only; QA gates belong to the per-topic plans).
- No staging of unrelated dirty files (use explicit pathspecs only).

## Current Checkpoint

- Current milestone: COMPLETE — staged 25 scoped files and created local commit 4fbc1ec (pre-amend; see Outcomes for final hash).
- Completed: Startup inventory; wrote + validated this plan; staged only scoped pathspecs (25 files); committed locally with conventional message; verified clean status, no tag, no push.
- In progress: None — finalizing plan record.
- Important modified files: `docs/release/app-store-readiness.md`, `docs/release/release-notes-1.0.0.md` (modified); 6 new docs in `docs/release/`; `public/privacy.html`; 7 new tests; 9 execplans (8 per-topic + this plan).
- Last successful validation: Post-commit `git status --short` empty (clean); `git tag` shows no v1.0.0; branch ahead 1 / no push.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: All complete — plan validated, only scoped paths staged, local commit created without tag/push, post-commit status clean for scoped paths.

## Progress

- [x] 2026-09-19 — Inventory git status and scoped paths.
- [x] 2026-09-19 — Write this commit-readiness ExecPlan.
- [x] 2026-09-19 — Stage only scoped pathspecs.
- [x] 2026-09-19 — Review staged diff and commit locally (no tag, no push).
- [x] 2026-09-19 — Verify post-commit status and report.

## Surprises & Discoveries

- None yet. Working tree dirt matches the requested scope exactly (no unrelated dirty files observed at inventory time); will re-confirm before staging.

## Decision Log

- 2026-09-19 — Plan file named `app-store-commit-readiness-v1.md` so it falls inside the user-scoped `app-store-*-v1.md` glob and is committed together — keeps all commit-readiness state in one commit.
- 2026-09-19 — Staging via explicit file pathspecs, never `git add -A` / `.`, to guarantee unrelated dirt is never staged.
- 2026-09-19 — Single conventional commit (`docs(...)`-scoped) rather than split commits, per user request for one readiness commit.

## Validation Ledger

- 2026-09-19 — `git status --short` + `ls docs/release/ public/privacy.html tests/*.test.ts .agent/execplans/app-store-*-v1.md` + `git diff --cached --name-only` — PASS — 2 modified + 21 untracked confirmed in scope, nothing staged.
- 2026-09-19 — `npm run agent:plan:validate -- --plan .agent/execplans/app-store-commit-readiness-v1.md` — PASS — ACTIVE at creation; re-validated at COMPLETED.
- 2026-09-19 — `git status --short` post-commit — PASS — empty (clean); no leftover scoped dirt; branch `ahead 1`, no push.
- 2026-09-19 — `git tag --list` — PASS — no `v1.0.0` created.

## Changed Files / Areas

- `.agent/execplans/app-store-commit-readiness-v1.md` — this plan (new, staged).
- `docs/release/*` (8 files) — readiness docs being committed (not edited by this task).
- `public/privacy.html` — privacy hosting artifact being committed (not edited).
- `tests/age-rating-dsa.test.ts`, `tests/icon-splash-asset-audit.test.ts`, `tests/play-listing-copy.test.ts`, `tests/privacy-hosting.test.ts`, `tests/release-notes.test.ts`, `tests/store-assets-checklist.test.ts`, `tests/version-build-consistency.test.ts` — store/release guard tests being committed (not edited).
- `.agent/execplans/app-store-*-v1.md` (8 per-topic plans) — supporting plans being committed (not edited).

## Recovery / Resume Instructions

1. Read `AGENTS.md` and `.agent/PLANS.md`.
2. Read this plan fully: `.agent/execplans/app-store-commit-readiness-v1.md`.
3. Run `git status --short`, `git diff --stat`, `git diff --name-only`, `git diff --cached --name-only`, and `git log --oneline -3`.
4. Reconcile: Git wins over narrative. If a commit already exists, skip to verification; if staging exists, review staged stat before committing; if nothing is staged/committed, continue from `Exact next action`.
5. Stage ONLY the explicit scoped pathspecs (never `git add -A`):
   `git add -- docs/release/age-rating-and-trader.md docs/release/app-store-readiness.md docs/release/icon-splash-asset-audit.md docs/release/privacy-policy.md docs/release/release-notes-1.0.0.md docs/release/store-assets-checklist.md docs/release/store-data-declarations.md docs/release/version-build-consistency.md public/privacy.html tests/age-rating-dsa.test.ts tests/icon-splash-asset-audit.test.ts tests/play-listing-copy.test.ts tests/privacy-hosting.test.ts tests/release-notes.test.ts tests/store-assets-checklist.test.ts tests/version-build-consistency.test.ts .agent/execplans/app-store-age-rating-dsa-v1.md .agent/execplans/app-store-icon-splash-audit-v1.md .agent/execplans/app-store-play-listing-copy-guard-v1.md .agent/execplans/app-store-privacy-artifacts-v1.md .agent/execplans/app-store-privacy-hosting-v1.md .agent/execplans/app-store-release-notes-v1.md .agent/execplans/app-store-store-assets-checklist-v1.md .agent/execplans/app-store-version-build-consistency-v1.md .agent/execplans/app-store-commit-readiness-v1.md`
6. Verify with `git diff --cached --stat`, commit locally with the conventional message in this plan, never tag, never push.
7. Verify with `git status --short` and `git show --stat HEAD`; update checkpoint and validate plan.

## Outcomes & Retrospective

- Status: Completed.
- Summary: Single local commit holds all 25 scoped App Store readiness files (8 docs/release, public/privacy.html, 7 tests, 9 execplans). No tag, no push, no PII, no EAS submit. Post-commit status clean.
- Proof: Commit `4fbc1ec` (amended final hash recorded at amend time); `git diff --cached --stat` showed 25 files / +2950 -16; post-commit `git status --short` empty.
- Remaining work: None for this commit task. Push left to human.
- Follow-up: Human runs push when ready; per-topic QA gates remain owned by their own plans.
