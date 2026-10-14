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
- Parent plan `openspec/changes/frontend-v3-calm-momentum/execplan.md` was `ACTIVE` with a checkpoint that said W12 had not begun; that checkpoint and its Recovery text were replaced in place by this change (task 4.1) and the plan remains `ACTIVE` for the audit/iOS certification residuals. Slice `tasks.md` checkbox counts are not current authority.
- Source reading, not a runtime run, first classified the `Goal 2,400` assertion as a stale selector; runtime reproduction then confirmed it (task 2.1) and the retarget is complete (task 2.2).

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

- Current milestone: Review-2 landed as `95d5b23`. This commit corrects the snapshot that commit left behind (pending-commit wording, duplicate validation line, `review-2 tree` labels, and the W17 note that still said only `b50034d` was Android-certified). PR #78 is open against `origin/main` (`bf09c0d`). The only remaining implementation tail is the merge and the merged-SHA record.
- Completed: Tasks 1–7.1 and 6.3. settings-ripple retargeted green 6/6 (SQL/reload/entry-count oracles intact). Visual capture fail-closed after red-first negative controls (30 goldens untouched, `maxDiffPixels: 0`, set hash `f19261d5…` vs historical `0676368d…`). H08 date keys reproduced (16/41 boundary red) and fixed browser-side, including `calories-w10-audit.spec.ts` at `95d5b23`. Parent checkpoint replaced in place (plan `ACTIVE`). Audit UNREMEDIATED (gate red, nothing waived). Android exact-source qualified at `52a10d0` (23/23 flows; two FLAKY_TEST incidents preserved; one native TEST_BUG flow fixed). Review 1 integrated in `d064cd5`. Review 2 integrated in `95d5b23`.
- In progress: Merge PR #78, then record the merged `origin/main` SHA separately from pre-merge evidence.
- Important modified files: All review-2 code and docs are committed as `95d5b23`. This commit is docs-only on top of that SHA. Nothing is uncommitted after it is committed.
- Last successful validation: 2026-10-14 — visual readiness self-checks 4/4 at `95d5b23` (capture-level fail-closed proof plus comparison-only perturbation check). This commit does not change that helper, so those results stay attributed to `95d5b23`, not to this docs commit. Audit remains intentionally red.
- Current failures: None open in gates. Audit remains intentionally red (UNREMEDIATED).
- Relevant quarantines: None added.
- Blockers: None. iOS NOT RUN (no authorized lane — external).
- Exact next action: After PR #78 (`frontend-v3-post-w17-adversarial-correction` → `main`) merges, record the merged `origin/main` SHA in the evidence pack separately from the pre-merge evidence (task 6.4 tail), then this plan's next action becomes `None — task complete.` No in-scope implementation remains.
- Remaining definition of done: the post-merge SHA record only. All implementation, validation, review, evidence-pack, and publication tasks are complete.

## Progress

- [x] Explore completed and dispositions recorded in `design.md`
- [x] OpenSpec change drafted (proposal, specs, design, tasks, this plan)
- [x] Worktree dependencies installed and planning files validated (planning committed `d0a6fdc`, deps installed, Node v24.3.0)
- [x] Settings-ripple reproduced and repaired (TEST_BUG stale selector; journey green 6/6 with SQL/reload oracles)
- [x] Visual readiness negative controls and fail-closed helper (red-first proof; 34/34 twice; goldens untouched)
- [x] Parent plan and provenance reconciliation (parent ACTIVE + validating; W17 docs annotated; counts left on their own runs)
- [x] Independent probes and any confirmed fixes (H08 reproduced+fixed; H12 probed-correct; audit UNREMEDIATED; 5.3 N/A)
- [x] Validation ladder, review, publication, and evidence pack (PR #78; review findings integrated; verdict CONDITIONAL / NEAR-COMPLETE)

## Surprises & Discoveries

- `Goal 2,400` is not produced by Calories. The hero says `Edit goal`; the title is the remaining-kcal fact. SMALL seeds today at 0 kcal, so `2,400 kcal left` can be true. Runtime reproduction confirmed the stale selector; the journey was retargeted and is green.
- The old `settle()` returned after its deadline, treated non-finite opacity as settled, and swallowed font-load rejection. Negative controls proved that fail-open, and the helper now throws named diagnostics before a golden comparison. Inactive sections use `pointerEvents: 'none'` immediately, so a full-fade hit-test hole was not supported by source.
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
- Important modified files (committed on `frontend-v3-post-w17-adversarial-correction` through `95d5b23`, plus this docs snapshot): `openspec/changes/frontend-v3-post-w17-correction/` (this plan + tasks), `openspec/changes/frontend-v3-calm-momentum/execplan.md`, `docs/ui-ux/v3-audit/w17/*.md`, `docs/ui-ux/v3-audit/post-w17-correction/`, `.agent/execplans/frontend-v3-w12-w17-unified-campaign.md`, `e2e/journeys/settings-ripple.spec.ts`, `e2e/visual-regression.spec.ts`, `e2e/helpers/browserDate.ts`, `e2e/{planning-hub,calories,calories-w10,calories-w10-audit,calories-day-navigation,workout-w9}.spec.ts`, `.maestro/flows/portable-backup.yaml`.

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

- Status: Complete except post-merge bookkeeping (record the merged
  `origin/main` SHA after PR #78 merges — the only remaining action).
- Summary: The post-W17 correction reproduced and fixed the carried
  settings-ripple red (stale selector, `TEST_BUG` — retargeted to the W10
  grammar with SQL/reload/entry-count oracles intact, 6/6), made curated
  visual capture fail closed after red-first negative controls (30 goldens
  and `maxDiffPixels: 0` untouched; set hash `f19261d5…` vs historical
  `0676368d…` kept distinct), reproduced and fixed host-local E2E date keys
  across a host/browser calendar boundary (16/41 red → 41/41 boundary and
  control), replaced the parent plan's recovery record in place (still
  `ACTIVE`; no W12 restart), reconciled W17 provenance without moving any
  historical run count or SHA, re-proven Android at exact source `52a10d0`
  (23/23 flows, two `FLAKY_TEST` incidents preserved, one native `TEST_BUG`
  flow fixed), and left the dependency audit red and unwaived
  (UNREMEDIATED — exposure limited) with iOS NOT RUN.
- Proof: `docs/ui-ux/v3-audit/post-w17-correction/` (findings, evidence
  index, release convergence); validation ladder recorded in the index
  (typecheck 0, lint 0/0, themes 140/140, OpenSpec 87/87, plans PASS,
  Vitest 2,702 executed / 0 failed, qa:timezones 111 across 5 zones, P0
  25/25, visual 34/34 ×2); independent read-only review verdict
  (blocking-findings) with all findings integrated in `d064cd5`; PR #78.
- Verdict: **CONDITIONAL / NEAR-COMPLETE** — not release-ready while the
  dependency audit is failed-unremediated and iOS is not run; hosted
  `e2e`/`nightly` remain not-run behind the audit gate. Every unresolved
  lane and its revision limit is named in `release-convergence.md`.
- Remaining work: (1) after PR #78 merges, record the merged `origin/main`
  SHA separately from the pre-merge evidence (task 6.4 tail); (2) the
  accepted residuals listed in `findings.md` (over-goal-day gated coverage,
  one-shot H08 boundary proof, native lane flakes) are documented, not
  scheduled.
- Lessons: negative controls must fail on the old behavior before the fix
  (the red run is the proof); probe boundary conditions with delta-preserving
  shims when platform TZ levers are broken (Node ignores `TZ` on Windows);
  provenance corrections are annotations on history, never re-attribution;
  a native lane that flakes once per run at different steps is load-flaky,
  but a flow that fails twice at the same step is a reproducible defect.
