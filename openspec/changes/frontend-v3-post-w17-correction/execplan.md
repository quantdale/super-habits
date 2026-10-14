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

- Current milestone: Validation ladder and native qualification complete; evidence pack committed (`16c5b2b`); independent read-only review in progress. Remaining: integrate review findings, push + PR, Outcomes, hygiene gate.
- Completed: Tasks 1–5.5 and 6.1/6.2/7.1. Native: APK provisioned at exact source `52a10d0` (SHA-256 `65558DFE…`, 0 remote hosts) on Nitro_API_36/:5594; smoke 2/2, persistence 11/11 (run 3 clean; runs 1–2 had one distinct FLAKY_TEST each — `habit-reminder-disable`, `workout-gym-v2-persistence` — both green elsewhere/replayed), lifecycle 6/6, reward 1/1, backup-v2 1/1, portable-backup 2/2 after a reproduced TEST_BUG flow fix (`eb718ca`: scroll-before-assert for 'Export data'; 2/2 repro → 2/2 green). iOS NOT RUN. Validation: typecheck 0, lint 0/0, themes 140/140, OpenSpec 87/87, plans PASS, npm test 2,702 executed (2,700 passed / 2 skipped / 0 failed), qa:timezones 111 (5 zones), settings-ripple 6/6, P0 25/25, counts recomputed (vitest list 2,700; playwright 501 tests/56 files). Evidence pack committed with verdict CONDITIONAL / NEAR-COMPLETE (unresolved: audit FAILED-UNREMEDIATED, iOS NOT RUN).
- In progress: independent read-only review of `bf09c0d..HEAD` (subagent run `62fbf05c`); review artifacts exposed under `.review-artifacts/` (temp, delete before push). Reviewer's confirmed interim finding integrated: the over-goal-day spec scenario has NO gated test (findings.md corrected — coverage gap recorded, not claimed).
- Important modified files: as before plus `docs/ui-ux/v3-audit/post-w17-correction/` (findings/evidence-index/release-convergence), `.maestro/flows/portable-backup.yaml` (flow fix), uncommitted `openspec/changes/frontend-v3-post-w17-correction/tasks.md` (checkboxes).
- Last successful validation: 2026-10-14 — `NATIVE_ANDROID_SERIAL=emulator-5594 node scripts/qa-native.mjs --platform android --tag portable-backup` 2/2 post-fix; `npx prettier --check` + `npx eslint --max-warnings 0` clean at `16c5b2b`.
- Current failures: None open in gates. Audit remains intentionally red (UNREMEDIATED).
- Relevant quarantines: None added.
- Blockers: None. iOS NOT RUN (no authorized lane — external).
- Exact next action: When the review returns: integrate any blocking findings, delete `.review-artifacts/`, commit the tasks.md/findings.md updates, then push the branch and open a normal PR against latest `origin/main` (task 6.4), then fill Outcomes (7.2) and run `npm run web:hygiene`.
- Remaining definition of done: review integrated (6.3), PR published (6.4), ExecPlan Outcomes filled after the verdict's unresolved lanes are named (7.2 — done in release-convergence.md), final hygiene gate.

## Progress

- [x] Explore completed and dispositions recorded in `design.md`
- [x] OpenSpec change drafted (proposal, specs, design, tasks, this plan)
- [x] Worktree dependencies installed and planning files validated (planning committed `d0a6fdc`, deps installed, Node v24.3.0)
- [x] Settings-ripple reproduced and repaired (TEST_BUG stale selector; journey green 6/6 with SQL/reload oracles)
- [x] Visual readiness negative controls and fail-closed helper (red-first proof; 34/34 twice; goldens untouched)
- [x] Parent plan and provenance reconciliation (parent ACTIVE + validating; W17 docs annotated; counts left on their own runs)
- [x] Independent probes and any confirmed fixes (H08 reproduced+fixed; H12 probed-correct; audit UNREMEDIATED; 5.3 N/A)
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
- 2026-10-14 — `npm install` in the correction worktree (Node v24.3.0, npm 11.4.2) — dependencies installed; `npm audit` reports existing findings (kept for task 5.4; no fix applied).
- 2026-10-14 — `git commit` docs-only planning commit `d0a6fdc` on `frontend-v3-post-w17-adversarial-correction` — 9 planning files added; lint-staged/prettier hook passed.
- 2026-10-14 — `npm run build:e2e` — hermetic export OK, `dist/` written, 0 Supabase hosts.
- 2026-10-14 — `npx playwright test --project=journeys e2e/journeys/settings-ripple.spec.ts` (port 8081, pre-fix) — FAIL at settings-ripple.spec.ts:145: `getByText('Goal 2,400')` not found (15s); step 1 passed; failure snapshot showed W10 grammar `2,400 kcal left` / `Today · 0 of 2,400 kcal logged` / `Edit daily calorie goal`. Classified `TEST_BUG` (stale selector), consistent with locked C-3/H01.
- 2026-10-14 — `npx playwright test --project=visual -g "capture readiness self-checks"` (pre-fix, old `settle()`) — 3 failed / 1 passed. All three fail-open branches proven: stuck opaque section, non-finite opacity, rejected font family each reported `settle() unexpectedly succeeded — readiness must fail closed here`. The strict-comparison control passed (it must pass on both helpers).
- 2026-10-14 — `npx playwright test --project=visual -g "capture readiness self-checks"` (first fail-closed attempt) — 3 failed: `SETTLE_TIMEOUT_MS is not defined` inside `page.evaluate` (Node-side constant leaked into browser context). Fixed by passing `{ families, timeoutMs }` as the evaluate argument; unnecessary `as` assertions removed per lint.
- 2026-10-14 — `npx playwright test --project=visual -g "capture readiness self-checks"` (post-fix) — 4/4 passed: named `section readiness unmet` diagnostics (incl. non-finite opacity) and `required font load failed — Nunito_700Bold`, strict comparison accepted the settled capture and rejected the perturbed one.
- 2026-10-14 — `npx playwright test --project=visual` (:8081, fresh) — 34/34 (3.0m). Golden-set hash before/after: `f19261d5d676ac1ef10cc526a4fb19d41e0edbf1a6e3ebd87fcb437c50dcdeaa` (unchanged; distinct from historical `0676368d…`).
- 2026-10-14 — `npx playwright test --project=visual` (:8089, fresh) — 34/34 (3.1m). Hash `f19261d5…` stable across both runs; `git status -- e2e/__screenshots__/` empty (no golden rewritten).
- 2026-10-14 — `npx prettier --write` + `npx eslint --max-warnings 0` on `e2e/visual-regression.spec.ts` and `e2e/journeys/settings-ripple.spec.ts` — LINT CLEAN.

## Changed Files / Areas

- `openspec/changes/frontend-v3-post-w17-correction/proposal.md` — why the correction exists.
- `openspec/changes/frontend-v3-post-w17-correction/design.md` — dispositions and approach.
- `openspec/changes/frontend-v3-post-w17-correction/tasks.md` — implementation checklist.
- `openspec/changes/frontend-v3-post-w17-correction/specs/` — four behavior deltas.
- `openspec/changes/frontend-v3-post-w17-correction/execplan.md` — this living plan.
- `e2e/journeys/settings-ripple.spec.ts` — stale `Goal 2,400` selector retargeted to the W10 grammar (title + context line + edit-goal accessible name) at both the ripple and reload checks; SQL, reload, and entry-count oracles untouched.
- `e2e/visual-regression.spec.ts` — `settle()` fail-closed with named diagnostics (section readiness incl. non-finite opacity; required font family), `prepareCapture` extracted from `capture()`, 4 harness self-checks (negative controls + strict comparison) appended.
- All of the above committed as docs-only `d0a6fdc` (planning only). The two e2e files are uncommitted product/test edits so far.

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
