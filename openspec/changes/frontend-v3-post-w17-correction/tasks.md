# Post-W17 correction tasks

## 1. Worktree and living plan

- [x] 1.1 Confirm the correction worktree is `D:/Documents/tryPython/superhabits-post-w17-correction` on `frontend-v3-post-w17-adversarial-correction`, and that the user's main checkout still has no staged campaign edits
- [x] 1.2 Install dependencies in that worktree only, then record Node version and `git rev-parse HEAD` in the ExecPlan
- [x] 1.3 Keep `execplan.md` at Plan-Version 2 and `ACTIVE`, with one exact next action, before the first production or test edit

## 2. Calories settings ripple

- [x] 2.1 Build a hermetic web export and run `e2e/journeys/settings-ripple.spec.ts` on an owned free port; save the failure or pass output before editing
- [x] 2.2 If the title, consumed-of-goal line, and `app_meta.calorie_goal` row already match `specs/calorie-goal-settings-propagation/spec.md`, retarget only the stale `Goal 2,400` assertions and keep the SQL, reload, and entry-count oracles
- [x] 2.3 If the saved goal does not reach Calories or the durable row, fix that product path and add a regression at the layer that failed — NOT REQUIRED: the pre-fix failure snapshot and the post-retarget SQL oracle both show the goal reaches Calories and `app_meta.calorie_goal`; no product defect reproduced
- [x] 2.4 Re-run the settings-ripple journey and record the SHA, port, and result in the ExecPlan

## 3. Visual capture readiness

- [x] 3.1 Add a negative control that keeps an inactive hidden section opaque through the settle deadline and expects a named failure
- [x] 3.2 Add a negative control that rejects a required font-face load and expects a failure naming that family
- [x] 3.3 Confirm both controls fail on the current helper, then make capture fail closed without raising `maxDiffPixels` or masking goldens — red run proved the old helper fail-open (`settle() unexpectedly succeeded` on all three branches); `settle()` now throws named readiness/font diagnostics before `toHaveScreenshot`; `maxDiffPixels: 0`, no masks, 30 goldens untouched
- [x] 3.4 Re-run the curated visual suite twice from a fresh state and record the current golden-set hash separately from the historical W15 hash — two fresh runs 34/34 (30 goldens + 4 readiness self-checks) on :8081/:8089; current golden-set hash `f19261d5d676ac1ef10cc526a4fb19d41e0edbf1a6e3ebd87fcb437c50dcdeaa` (W15 post-fix value, unchanged), historical two-run-proof hash stays `0676368d…`

## 4. Plan and provenance truth

- [x] 4.1 Replace the parent Calm Momentum Current Checkpoint and Recovery text so the next action is not "author W12", and leave that plan `ACTIVE`
- [x] 4.2 Annotate present-tense W17 README, matrix, manifest, and handoff lines that call `1177ac2` or `3aaca2a` the current head, without moving historical run counts onto a later SHA
- [x] 4.3 State that Android qualification at `b50034d` does not cover later `features/` edits, and that slice `tasks.md` checkbox counts are not current authority
- [x] 4.4 Update the current-runtime sentence in the release-contract delta only after confirming migration 25 is still the last applied block — CONFIRMED: `core/db/client.ts` ends at `if (version < 25)` (no migration 26 added); delta sentence already reads schema 25 / next slot 26; all current-runtime docs verified consistent
- [x] 4.5 Remove or annotate unqualified present-tense known-gap claims that still call the fixed CRLF parser failure an environment residual — `docs/testing/known-gaps.md` claims verified already W17-annotated; annotated the unqualified claim in `.agent/execplans/frontend-v3-w12-w17-unified-campaign.md` plus its resolved C-3 pointer

## 5. Independent probes

- [x] 5.1 Reproduce or reject host-local calendar keys in the planning-hub, calories, calories-day-navigation, and workout-w9 specs across a UTC/Manila date boundary — REPRODUCED (16 failed / 25 passed under a −1 day host-date shim; control 41/41 green), FIXED page-side via `browserDate` helpers (incl. calories-w10), re-proven 41/41 under the boundary + 41/41 control; absolute `toISOString()` timestamps untouched
- [x] 5.2 Probe weekly-review commitment-create failure and decision-update throw behavior; add a regression only where the visible result or durable rows disagree with the existing partial-failure contract — PROBED: commitment failure → named partial-failure surface + saved review row (correct); decision-update throw → honest "The review was not saved", no review row, idempotent receipts (correct). No disagreement → no regression added (per locked H12)
- [x] 5.3 Sample keyboard focus, 44pt targets, and one narrow/dark theme path on surfaces touched by any product fix; do not regenerate the 247-capture matrix unless a shared primitive changes — NOT APPLICABLE: this change touches zero product surfaces (no files under `features/`, `core/`, `app/`, `lib/` changed; verified via `git status`)
- [x] 5.4 Run the dependency audit and record each high finding's chain, version, and fix availability without editing the allowlist — audit re-run: 2 UNDOCUMENTED highs (`braces` GHSA-vfj7-8cjw-p6xm, `node-forge` GHSA-86w9-cpqp-85rv) at latest published versions, range `*`, no upstream fix → UNREMEDIATED — exposure limited; gate left red; no allowlist/script/lockfile edits
- [x] 5.5 If `Nitro_API_36` is available, qualify the correction SHA with the credential-free provisioner; otherwise record `BLOCKED_EXTERNAL` and the last valid APK SHA — PROVISIONED at exact source `52a10d0` (APK `65558DFE…`, 0 remote hosts); 23/23 flows across six tags with 2 recorded FLAKY_TEST incidents + 1 TEST_BUG flow fix; iOS NOT RUN

## 6. Validation and review

- [x] 6.1 Run typecheck, lint, theme validation, OpenSpec validation, plan validation, and `npm run qa:affected` for the files actually changed
- [x] 6.2 Run unit and integration tests, plus timezone and the corrected journey, at the correction SHA — 2,700 passed / 2 skipped / 0 failed; qa:timezones 111 (5 zones); settings-ripple 6/6; P0 25/25; counts recomputed via `npx vitest list` (2,700) and `npx playwright test --list` (501 tests / 56 files)
- [x] 6.3 Have a reviewer who did not write the patch try the old failure, a sibling date boundary, and a double-submit or rejected-write case for every product fix — independent read-only review completed (run `62fbf05c`): VERDICT blocking-findings → 1 BLOCKING (findings.md over-goal coverage misgrounding) + 4 NITs, ALL integrated (coverage claim corrected with real citations + opt-in-only gap recorded; timeout note qualified; typo fixed; H08 one-shot residual documented; parent Recovery `w65-main/final-ci*` pointer restored). Probes: old failure COVERED; date boundary COVERED one-shot (residual documented); double-submit UNTRIGGERED (zero product fixes — verified by the reviewer)
- [x] 6.4 Publish through a normal pull request, then record the merged `origin/main` SHA separately from the pre-merge evidence — PR #78 published against `origin/main` (`bf09c0d`); the merged-SHA record is the post-merge tail (noted in the ExecPlan Outcomes)

## 7. Evidence pack

- [x] 7.1 Write `docs/ui-ux/v3-audit/post-w17-correction/` with findings, evidence index, and release convergence, using the verdict taxonomy in `specs/post-w17-correction-evidence/spec.md` — verdict: CONDITIONAL / NEAR-COMPLETE naming the audit (FAILED, UNREMEDIATED) and iOS (NOT RUN) as the unresolved lanes
- [x] 7.2 Fill the ExecPlan Outcomes section only after the verdict's unresolved lanes are named, and set its next action to a no-op only if no in-scope implementation remains — Outcomes filled; next action is the post-merge SHA record (in-scope implementation is complete), so it is not yet a no-op
