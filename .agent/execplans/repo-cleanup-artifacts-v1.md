Plan-Version: 2
Status: COMPLETED

# Repository artifact cleanup

## Purpose / User Outcome

Remove committed run artifacts that no tracked document or test references, so the
repository is smaller without changing application behavior, goldens, or cited evidence.

## Context

`origin/main` at `38f17e1a` already contains prior dead-code audits. The remaining
high-confidence bloat is 62 `.agent/hardening-evidence/*.log` files, an unreferenced
`lint-full.txt`, and 556 `docs/ui-ux` screenshots whose basename and path appear in
no tracked text file. Open PRs #188 and #189 overlap this area; #189's e2e job failed
on visual goldens the same day `main`'s push CI failed the same way. This plan lands
an independently verified subset instead of merging those PRs.

## Scope

- Delete only unreferenced audit screenshots and stale gate logs.
- Ignore future copies of those artifacts, plus local scratch dumps.
- Leave referenced images, `e2e/__screenshots__/`, and non-log migration snapshots.

## Non-Goals

- No dependency upgrades, formatting sweeps, or behavior changes.
- No merge or deletion of open/draft PRs, unmerged remote branches, or dirty worktrees.
- No rewrite of archived execplans that still name the removed logs.

## Current Checkpoint

- Current milestone: complete.
- Completed work: independent reference scan (556 unreferenced / 161 referenced pngs); artifacts removed; ignore rules updated.
- In progress: None.
- Important modified files: `.gitignore`, `.agent/hardening-evidence/README.md`, deleted logs and pngs.
- Last successful validation: `npm run typecheck` pass, `npm run lint` pass, `npm run test:unit` pass (173 files, 2331 tests).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Exact next action: None — task complete.
- Remaining definition of done: complete.

## Progress

- [x] Verify screenshot and log references
- [x] Delete unreferenced artifacts and update ignore rules
- [x] Validate
- [x] Integrate to `main` and push
- [x] Local Git hygiene for fully merged branches with no worktree

## Surprises & Discoveries

- Local `main` was 163 commits behind `origin/main`. Cleanup is based on `origin/main`.
- Screenshot reference count matched open PR #189 exactly (556 / 161) without using that diff as input.
- Archived plans still name removed logs. Those sentences stay; the spec already says logs do not certify.

## Decision Log

- Do not merge PR #188. Its Vercel-deletion claim was not re-verified here.
- Do not merge PR #189 outright because its e2e check is red. Land the same artifact class after an independent scan, and leave the PR open for the author to close or rebase.
- Keep `audit-reports.md` and live-migration snapshots because plans cite them or they are schema evidence, not raw logs.

## Validation Ledger

- 2026-11-03: `npm run typecheck` pass.
- 2026-11-03: `npm run lint` pass (`--max-warnings 0`).
- 2026-11-03: `npm run test:unit` pass (173 files, 2331 tests).
- 2026-11-03: `node scripts/journey-label-parity.mjs`, `quarantine-register-parity.mjs`, `release-profile-guard.mjs`, `cloud-native-isolation.mjs`, `release-facts-guard.mjs` pass.

## Changed Files / Areas

- `.gitignore`
- `.agent/hardening-evidence/`
- `docs/ui-ux/**` unreferenced pngs

## Recovery / Resume Instructions

1. Read this plan.
2. `git status --short` in the cleanup worktree.
3. Continue from Exact next action.

## Outcomes & Retrospective

Removed 556 unreferenced audit screenshots and 63 stale gate logs. Application code, visual goldens, cited audit reports, and migration snapshots were not changed. Open PRs, draft UI branches, and the pre-wipe backup branch were left in place. Follow-up: PR #189 overlaps this deletion and will need a rebase or close; PR #188 was not merged because its Vercel-deletion claim was not re-verified.
