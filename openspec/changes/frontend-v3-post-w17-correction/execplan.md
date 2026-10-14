# ExecPlan: Frontend V3 post-W17 correction

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Correct the published Frontend V3 release record and any reproduced defect
without redoing W12–W17. A zero-context agent must be able to resume from this
plan, prove or reject the carried Calories journey failure, and leave an honest
conditional verdict rather than a false release-ready claim.

## Context

- Explore baseline: `main` and `origin/main` were `bf09c0d50ca35a23bcc9df2582ea8398124d1038` on 2026-10-14. The user's main checkout also has stash `pre-recovery-local-changes` and untracked `.tmp-ios36423379932/`. Do not stage, delete, or normalize either.
- This change lives only in worktree `D:/Documents/tryPython/superhabits-post-w17-correction`, branch `frontend-v3-post-w17-adversarial-correction`, created from that SHA. The worktree has no `node_modules` yet.
- OpenSpec artifacts: `proposal.md`, `design.md`, `tasks.md`, and specs for calorie-goal settings propagation, visual capture readiness, post-W17 evidence, and a release-contract schema sentence update.
- Parent plan `openspec/changes/frontend-v3-calm-momentum/execplan.md` is still `ACTIVE` and its checkpoint still says W12 has not begun. That is the first doc defect, not the first code edit.
- Source reading, not a runtime run, classified the `Goal 2,400` assertion as a stale selector. Runtime reproduction is still required before editing it.

## Scope

- Reproduce and repair the Settings to Calories goal ripple per `specs/calorie-goal-settings-propagation/spec.md`.
- Fail curated visual capture closed when settle or required font load is unmet, after a red negative control.
- Reconcile parent checkpoint, W17 current-status provenance, and the schema 25 / next-slot 26 sentence.
- Probe the remaining suspicion ledger and fix only reproduced defects.
- Publish through a normal pull request and write `docs/ui-ux/v3-audit/post-w17-correction/`.

## Non-Goals

- No W12–W17 redesign, capture regeneration, or mass checkbox edit of those slice task files.
- No dependency allowlist, audit waiver, schema migration, or production Supabase use.
- No iOS certification claim and no inheritance of the `b50034d` Android APK onto a later feature SHA.
- No edits in the user's main checkout.

## Current Checkpoint

- Current milestone: OpenSpec proposal, specs, design, and tasks are drafted. No product or test code has been edited. No hermetic export or journey has been run.
- Completed: Read-only explore against `bf09c0d`. Isolated worktree and branch created. Change `frontend-v3-post-w17-correction` scaffolded with proposal, four spec deltas, design, and tasks.
- In progress: None. Implementation has not started.
- Important modified files: `openspec/changes/frontend-v3-post-w17-correction/` only, uncommitted on the correction branch.
- Last successful validation: 2026-10-14, planning only. `openspec validate frontend-v3-post-w17-correction --strict --type change` passed with zero issues. `npm run agent:plan:validate -- --plan openspec/changes/frontend-v3-post-w17-correction/execplan.md` passed. Neither command is a product or journey pass.
- Current failures: None recorded from a test command. The carried `settings-ripple` failure is a source hypothesis until the journey runs.
- Relevant quarantines: None added.
- Blockers: None for the next reproduction. Android and iOS qualification may later be externally blocked; that does not block the journey reproduction.
- Exact next action: In `D:/Documents/tryPython/superhabits-post-w17-correction`, install dependencies if `node_modules` is absent, build the hermetic export, and reproduce `e2e/journeys/settings-ripple.spec.ts` on an owned free port before editing any assertion.
- Remaining definition of done: Tasks 1.1–7.2 are checked only with evidence. The Calories spec is proven by the journey plus SQL and reload oracles. Visual negative controls fail on the old helper and pass after the fail-closed change, with strict goldens preserved. Parent checkpoint no longer says to start W12 and stays `ACTIVE`. Current-status docs do not move old run counts onto a new SHA. Audit stays red unless the audit command itself is clean without a new waiver. Verdict is not release-ready while security, iOS, or exact-source Android evidence is missing.

## Progress

- [x] Explore completed and dispositions recorded in `design.md`
- [x] OpenSpec change drafted (proposal, specs, design, tasks, this plan)
- [ ] Worktree dependencies installed and planning files validated
- [ ] Settings-ripple reproduced and repaired or disproven
- [ ] Visual readiness negative controls and fail-closed helper
- [ ] Parent plan and provenance reconciliation
- [ ] Independent probes and any confirmed fixes
- [ ] Validation ladder, review, publication, and evidence pack

## Surprises & Discoveries

- `Goal 2,400` is not produced by Calories. The hero says `Edit goal`; the title is the remaining-kcal fact. SMALL seeds today at 0 kcal, so `2,400 kcal left` can be true. This is not yet a runtime pass.
- `settle()` returns after its deadline, treats non-finite opacity as settled, and swallows font-load rejection. No negative control exists. Inactive sections use `pointerEvents: 'none'` immediately, so a full-fade hit-test hole is not supported by source.
- `af8eeda` changed activity and weekly-review feature files after Android SHA `b50034d`. The test/docs-only Android inheritance claim is false after that commit.
- W12–W17 slice ExecPlans say `COMPLETED` while their `tasks.md` boxes are mostly unchecked. Do not treat those checkbox counts as authority and do not re-execute the waves to check them.
- `e2e` and `nightly` already need the quality job. The audit allowlist does not cover the two inherited highs.

## Decision Log

- D1: Implementation stays in the correction worktree. See `design.md` D1.
- D2: Do not restore a `Goal N` chip. Retarget the journey unless runtime shows the goal does not propagate.
- D3: Visual helper changes only after a red negative control.
- D4: Parent Calm Momentum plan stays `ACTIVE`; replace its checkpoint in place.
- D5: Historical run records keep their original SHAs. New evidence is written under `docs/ui-ux/v3-audit/post-w17-correction/`.
- D6: No security waiver. Android and iOS stays unearned until exact-source runs exist.

## Validation Ledger

- 2026-10-14 — read-only `git rev-parse HEAD` and `origin/main` on the user's checkout — both `bf09c0d50ca35a23bcc9df2582ea8398124d1038`. Not a test pass.
- 2026-10-14 — `openspec new change frontend-v3-post-w17-correction` in the worktree — scaffold created.
- 2026-10-14 — `openspec validate frontend-v3-post-w17-correction --strict --type change` — passed, 0 issues.
- 2026-10-14 — `npm run agent:plan:validate -- --plan openspec/changes/frontend-v3-post-w17-correction/execplan.md` — passed, Status ACTIVE.

## Changed Files / Areas

- `openspec/changes/frontend-v3-post-w17-correction/proposal.md` — why the correction exists.
- `openspec/changes/frontend-v3-post-w17-correction/design.md` — dispositions and approach.
- `openspec/changes/frontend-v3-post-w17-correction/tasks.md` — implementation checklist.
- `openspec/changes/frontend-v3-post-w17-correction/specs/` — four behavior deltas.
- `openspec/changes/frontend-v3-post-w17-correction/execplan.md` — this living plan.
- No product, test, CI, or golden file has been changed.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this file completely.
2. `cd D:/Documents/tryPython/superhabits-post-w17-correction`
3. Run `git status --short`, `git diff --stat`, and `git rev-parse HEAD`.
4. Confirm the user's main checkout at `D:/Documents/tryPython/superhabits` was not used as the edit root.
5. Run `npm run agent:resume -- --plan openspec/changes/frontend-v3-post-w17-correction/execplan.md`
6. Continue only from Exact next action. Do not restart W12–W17.

```bash
npm run agent:resume -- --plan openspec/changes/frontend-v3-post-w17-correction/execplan.md
```

## Outcomes & Retrospective

Not started. Explore and the OpenSpec draft are the only completed work. No release verdict is claimed.
