# ExecPlan: Frontend V3 W7 Habits check-in

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

A daily Habits check-in answers whether scheduled habits are done and what to
check in next, without weakening schedule, lifecycle, streak, reminder,
linked-action, or XP rules.

## Context

Parent campaign plan: `openspec/changes/frontend-v3-calm-momentum/execplan.md`.
Implementation slice: `openspec/changes/frontend-v3-w7-habits`. Baseline
`d29c67b`. W6.5 is merged (PR 58, `f37539a`); exact-head CI `37717090214`
passes through unit/integration and fails only the known braces and node-forge
advisories.

W7 itself is CLOSED: merged to main as merge commit `f679a26` (PR 59,
https://github.com/quantdale/super-habits/pull/59) from branch
`frontend-v3-w7-habits`; the exact-head CI run is `37822880601`.

## Scope

- Habits daily list, filters, detail/progress consolidation, and regression
  selectors for that presentation.

## Non-Goals

- No schema, sync, or completion-write rewrite.
- No W8 Focus work, Android certification, or production Supabase mutation.

## Current Checkpoint

- Current milestone: W7 complete and merged to main; the parent campaign
  advances to W8 planning (not implemented).
- Completed: Baseline `d29c67b`, branch `frontend-v3-w7-habits`; stash/foreign iOS/history untouched. Corrective matrix33/33 PASS; all43 replacement PNGs opened/inspected. SUR-05/SYS-16/SYS-12 VERIFIED-FIXED, Habits daily portions of SYS-01/07/17 recorded. Simple rows57px, actions48px; editor choices44px. All eight failures of the previous `w7-full` qa:full (empty Trends PRODUCT_BUG; the semantic-selector/quantitative-fixture TEST_BUGs across habits, P1 Maya and P2 heatmap) are resolved on this tree and none recur in the fresh gate. Three coherent commits (`9bf4fda` feature, `0a8e86d` regressions/evidence, `3086b27` spec/ledgers/plans), PR 59 merged to main as `f679a26`. Exact-head CI `37822880601` passes typecheck, lint, theme tokens, openspec contracts, journey-label and quarantine-register parity, versioned ExecPlans, and the unit+integration test projects; it fails only the two pre-existing undocumented `braces` / `node-forge` advisories (identical set to baseline `d29c67b`, GHSA-vfj7-8cjw-p6xm and GHSA-86w9-cpqp-85rv) and therefore skips e2e/nightly behind the quality gate. No dependency file changed.
- In progress: None.
- Important modified files: `features/habits/`, habit E2E/Maestro/simulation selectors, `core/ui/SegmentedControl.tsx`, shared rendered audit helper/contracts, reference/defect/evidence ledgers and both plans, `docs/testing/known-gaps.md` (W7 host-load addendum). New web-only checkbox keyboard hook; no schema/data-layer change.
- Last successful validation: Fresh supported-runtime `qa:full` on isolated 8083 (`E2E_PORT=8083 TZ=Asia/Manila`, pinned node v22.23.2 / npm 10.9.8, exact-tree hashes in `.cursor/playwright-output/w7-final-full-2/start.json`). typecheck PASS; lint PASS; Vitest 2571 passed / 2 skipped (254 files); `openspec validate --all` 74/74; `e2e:full` hermetic export PASS + 253 passed / 64 skipped / 2 unexpected; `qa:simulation --all --mode deterministic` 23/23 PASS. Exact-head CI `37822880601` green on every quality step except the two pre-existing advisories.
- Current failures: Two unexpected D14 budgeted steps in the local `e2e:full`, both `ENVIRONMENT` (foreign host load at ~95% CPU): `habits-w7.spec.ts:452` `checkInMs` 1045.08ms and 1049.79ms against the unchanged 800ms ceiling, and `three-months-in` headroom fails at three different measurements on the same tree (435/500ms diary 13.0%, `calories→todos` 854ms, worst-switch 683ms 14.6%). A second isolated replay of the HEAVY step PASSED in 7.2s at CPU avg 84.8% and the earlier corrective matrix passed it in 5.7s on habits source last modified 22:30:59 — the assertion flips on unchanged product code. Guard, ceiling and 15% floor unchanged; no retry, skip or quarantine. Original artifacts preserved under `w7-final-full-2/preserved/`. Classification and numbers are recorded as a W7 addendum on `docs/testing/known-gaps.md` gap 15; a quiet-host or CI confirmation of these two steps remains an open, honestly-recorded residual outside this slice's scope.
- Relevant quarantines: Existing internal/remote/visual opt-ins; W7 screenshot instrument uses the existing VISUAL_AUDIT policy. No behavioral failure skipped or quarantined.
- Blockers: Native qualification remains blocked by environment, unchanged and outside this slice's scope. The only booted Android target is emulator-5554 at API35/x86_64 versus the required API36/x86_64; smoke/persistence/lifecycle are NOT RUN (reports `native-android-*-2026-10-08T1501*.json`), with no provisioning, reset or device mutation. Full Android qualification is tracked separately (W16); iOS is owner-deferred.
- Exact next action: None — W7 is complete and merged. W8 Focus is a new, separately-authorized wave and is not started by this plan.
- Remaining definition of done: Complete — broad local gates run and truthfully classified; plan/ledger reconciliation; coherent commits/PR/main publication (`f679a26`, PR 59); exact-head CI `37822880601` and the advisory inventory verified unchanged from baseline; final server hygiene PASS. W8 was not implemented.

## Progress

- [x] W7.1 Check-in model and daily rows
- [x] W7.2 Filters, groups, and date-scoped summary
- [x] W7.3 Detail consolidation, evidence, and gates

## Surprises & Discoveries

- SYS-12 is identity red (`#ef4444` in the audit palette) painted as the zero count, not a separate threshold function.
- Streaks count scheduled occurrences, not calendar days. The compact row says Current streak N; its accessible label explicitly says scheduled occurrences. Unit expectations now pin both current attribution and the absence of a misleading days unit.
- The original fat-fingers oracle intentionally asserts TWO quantitative increments. Its fixture now explicitly has target 2, rather than incorrectly driving the new binary check/undo control; row uniqueness and count=2 assertions remain intact.

- The retained RN Web confirmation host can sit below a newly mounted detail portal. Forced clicks hid this interception. Habits suspends the web detail portal during confirmation, preserves its section for Cancel, and keeps native Alert behavior unchanged; it does not rewrite shared Modal or persistence.

## Decision Log

- 2026-10-08 — Binary rows toggle through increment/decrement; quantitative rows keep a separate add control. Reason: preserve the completion API.
- 2026-10-08 — Selected-date summary uses date-specific targets and lifecycle masks. Reason: do not mix today with a historical day.

## Validation Ledger

- 2026-10-09 — Publication CLOSED. Three coherent commits landed (`9bf4fda` feature, `0a8e86d` regressions + rendered evidence, `3086b27` spec/ledgers/plans); PR 59 merged to main as merge commit `f679a26a28a8abf3472b44e3b5fbdf229222b927`. Exact-head CI run `37822880601` at that SHA: every quality step success (Typecheck, Lint, Validate theme tokens, Validate openspec contracts, journey-label and quarantine-register parity, Validate versioned ExecPlans, Test unit+integration); the only failure is the `Audit runtime dependencies` gate on the two pre-existing undocumented `braces` GHSA-vfj7-8cjw-p6xm and `node-forge` GHSA-86w9-cpqp-85rv advisories — byte-identical set to baseline `d29c67b` (CI `37717090214`) — so `e2e` and `nightly` skip behind the quality gate and are NOT passed. `git diff main..HEAD` contains no `package.json`/lockfile/patches change, so the advisory inventory is provably unchanged by this wave. Final `npm run web:hygiene` PASS (8081/8082 free). Stash `stash@{0}` and foreign `.tmp-ios36423379932/` evidence preserved untouched.

- 2026-10-09 — Fresh supported-runtime `E2E_PORT=8083 TZ=Asia/Manila npm run qa:full` — PARTIAL PASS, honest residual. Command log `.cursor/playwright-output/w7-final-full-2/command.log`; typecheck, lint, Vitest (2571 passed / 2 skipped, 254 files) and `openspec validate --all` (74/74) PASS; `e2e:full` hermetic export PASS with 253 passed / 64 skipped / 2 unexpected; `qa:simulation --all --mode deterministic` 23/23 PASS. The first harness background invocation was killed by its own 1800s cap mid-battery at test 150/319 (exit 124) with no product signal; the identical tree was then re-run detached through `e2e:full` to completion and the simulation lane separately, with exact-tree hashes captured in `w7-final-full-2/start.json`. Both unexpected results are D14 budgeted steps, `ENVIRONMENT`-classified under foreign host load at ~95% CPU (QEMU emulator + editor + browser) and re-verified standalone: `habits-w7.spec.ts:452` measured 1045.08/1049.79ms vs the unchanged 800ms ceiling in battery/replay, then PASSED in 7.2s at CPU avg 84.8% and had passed in 5.7s in the 22:45 matrix on habits source last modified 22:30:59; `three-months-in` failed at three different measurements on the same tree (435/500ms diary 13.0% headroom; `calories→todos` 854ms; worst-switch 683ms 14.6%). Guard, 800ms ceiling, 15% floor and all assertions unchanged; original failure artifacts preserved under `w7-final-full-2/preserved/`. Fresh nested report captured as `w7-final-full-2/e2e-report-report.json`. Zero determinism/oracle findings.

- 2026-10-08 — Exact Standards/Spec follow-up workflow39dce9ca-4374-4516-85fe-68e3420a21af complete; both reports read: OK with notes, no issues, source only. Reviewer children f59a093e-f04d-4d14-a62c-411968832d09 /fb0ea7fe-e878-42d4-b4af-c877db1bd975; output bindings under the workflow's managed `w7-review/` artifacts. All accepted findings resolved; no new correction-blast-radius issue. Final qa:fast, timezones, themes, all-plan and strict slice validation PASS. Native2/11/6-flow smoke/persistence/lifecycle preflight EXIT2 ENVIRONMENT API35-vs36; no device mutation. Hygiene8081/8082/8083 PASS. Fresh qa:full next, not yet earned.

- 2026-10-08 — Corrective supported checks/build PASS; boundary3/3, continuous affected journeys23/23, Habits/contracts26/26, deterministic J7 1/1 PASS with exact count/uniqueness retained. J7 target1 red preserved before target2 correction. Empty/dark instrument1/1 PASS; all six regenerated PNGs inspected (46-image final inventory); earlier empty/dark images preserved separately. Compaction resume/impact PASS; actual Git unchanged HEAD d29c67b, stash/foreign files preserved. Source-only reviewer follow-up commissioned for the two exact retained runs; no broad/publication pass inferred.

- 2026-10-08 — Supported-runtime qa:full EXIT1 (fresh report238 PASS/8 FAIL, zero retries/flaky); earlier quality/build phases PASS. Report collector corrected, no stale report substitution. Both final reviewers BLOCK: workflow `f0a2ec28-f01b-4057-b12e-ae7d0a9c4abe`, Standards `70630fb0-5028-4732-8244-fa9fd992802b`, Spec `4aa482dd-b1df-4ca0-9a42-e39f707a1f9d`; accepted all three concrete findings. Recovery resume/impact PASS; task-only impact excludes foreign iOS paths. Focused corrective gates next.

- 2026-10-08 — `npx openspec validate frontend-v3-w7-habits --strict` — PASS.
- 2026-10-08 — Initial hermetic `npm run build:e2e` — PASS; `npx playwright test e2e/habits.spec.ts --project=chromium` — 10 PASS / 1 PRODUCT_BUG (delete); `qa:fast` — interrupted at lint, no pass claimed.
- 2026-10-08 — Independent read-only Standards (4 findings) and Spec (6 findings, including unfinished evidence/publication) reviews — BLOCK. Workflow `e4979362-2678-47b1-adca-44be37a526dc`; reviewers `4c847e28-be64-4ba8-ae38-759a99579fed`, `b33459d3-6c88-40e0-9360-c3ee9685c1f6`. Output references preserved under `.cursor/playwright-output/w7-review/`.

- 2026-10-08 — Resume/impact PASS; corrective typecheck PASS and focused unit 71/71 PASS. Initial broad lint interruption remains visible; no post-fix browser pass yet.

- 2026-10-08 — Corrective browser10/11 and normal-click delete probe FAIL (PRODUCT_BUG portal stacking); artifacts preserved. Overlay correction rebuilt hermetically and focused delete PASS (`delete-overlay-fixed.log`). No visual closure claimed yet.

- 2026-10-08 — New typecheck PASS; focused units72 PASS/1 TEST_BUG in the new fixture's closing-day expectation. `isHabitLifecycleMaskedOn` and `applyHabitLifecycleTransition` explicitly define inclusive bounds. Corrected the new test to assert closing-day2/2 and following-day3/0; the domain implementation is unchanged. Build/browser matrix did not start because the unit gate stopped the command chain.

- 2026-10-08 — Corrected focused units73/73 and typecheck PASS, hermetic build PASS. Browser matrix21 PASS/5 FAIL (11 existing Habits tests green;7 audit instruments green but images rejected after inspection). Missing web states, duplicate copy scope and inactive contrast triaged above; no visual closure or broad-gate pass claimed.

- 2026-10-08 — Pinned runtime22.23.2/npm10.9.4; `typecheck-aria.log`, `unit-aria.log` (focused habit + real constraints), `build-aria.log` PASS. Later editor/row corrections are NOT covered by that build. Earlier shell was Node24/npm11 (outside supported envelope); broad release gates must use pinned runtime. Hygiene8081/8082 PASS. First images copied to rejected evidence; baseline visual direction not restarted.

- 2026-10-08 — `typecheck-rendered.log` PASS; `lint-rendered.log` FAIL on one redundant fixture union, corrected without behavior change. Build/browser never started. The command copied the preceding run's artifacts; renamed `previous-matrix-before-lint-failure-*` so they cannot be mistaken for fresh evidence.

- 2026-10-08 — Supported-runtime rendered matrix30 PASS/2 FAIL; all11 existing Habits tests,7 capture instruments,4 audit contracts green. Actual checkbox Space gap and deletion-oracle timing require the above corrections. Manual image inspection additionally rejects Today-offscreen resized capture. Source/selector fixes implemented; no closure claim until rerun.

- 2026-10-08 — Supported-runtime correction: typecheck/scoped lint/build PASS; keyboard matrix33/33 PASS, zero retries/skips. All43 replacement images opened and inspected; measurements57px rows/48px actions/44px editor, HEAVY543.42/471.14ms. Earlier30/32 and initial21/26 artifacts preserved. Broad fast first stops at redundant test cast, second passes lint and2164 assertions but aborts parity suite for missing W7 instrument registration. Both TEST_BUG corrections retain assertions and only document the already-opt-in capture lane; broad rerun next.

- 2026-10-08 — Recovery verified `qa-fast-evidence.log` PASS2174/174 files plus parity guards; earlier similarly named fixed log remains a failed attempt. Resume/impact PASS (foreign iOS evidence excluded from task ownership). v9 guidance pins aligned, hook invariant documented, SW findings adjudicated against unchanged baseline. Final source reviews and release-tree qa:full next.

## Changed Files / Areas

- `openspec/changes/frontend-v3-w7-habits/` — implementation slice
- `openspec/changes/frontend-v3-calm-momentum/execplan.md` — W6.5 closure and W7 checkpoint
- `features/habits/` and `tests/habitCheckIn.domain.test.ts` — check-in reconstruction
- `e2e/`, `.maestro/flows/`, `simulation/runner/actions.ts`, `simulation/scenarios/journeys.ts` — semantic selector/quantitative fixture retargets; `e2e/habits-w7*.spec.ts` + `e2e/helpers/habitsW7.ts` add real-DB regressions and an explicit opt-in audit
- `core/ui/SegmentedControl.tsx` — explicit web selected state required by the new detail tabs
- `e2e/helpers/a11yAudit.ts`, `e2e/a11y-audit-contract.spec.ts` — exclude unpainted contrast but independently retain hidden-focus and visible contrast oracles
- `features/habits/HabitEditorChoice.tsx` — accessible44pt editor choices with per-option keyboard focus and readable active labels
- `features/habits/useHabitCheckboxKeyboard.ts` — web-only missing Space key; preserves RN Web Enter/pointer and native press handling
- `docs/ui-ux/v3-audit/w7/` —46 settled/inspected PNGs and reproduction/measurement README; older rejected images retained in ignored evidence
- `tests/habitsScreenDerivations.test.ts` — creation/lifecycle strip and summary regression
- `docs/ui-ux/14-v3-reference-ledger.md` — W7 research
- `docs/testing/known-gaps.md`, `docs/ui-ux/15-v3-defect-ledger.md` — capture-gate registration and inspected defect dispositions
- `docs/testing/known-gaps.md` — W7 host-load addendum on gap 15 with the measured numbers, standalone verification and unchanged guard/ceiling/floor
- `public/sw.js`, `CLAUDE.md`, `.cursor/commands/pre-pr.md` — v8→v9 deploy-generation literal and existing derived guidance pins; no cache-strategy change
- `.tmp-ios36423379932/` — pre-existing untracked owner evidence; preserved, not task work or publication

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan.
2. Nothing to resume: W7 is COMPLETED and merged as `f679a26` (PR 59) and
   this slice's three commits are on main. Do not redo W7.
3. For the W7 broad-gate residuals and the exact-head CI/advisory record,
   read the Validation Ledger above, `docs/testing/known-gaps.md` gap 15
   (W7 addendum) and
   `.cursor/playwright-output/w7-final-full-2/preserved/`.
4. For the next wave, follow the parent campaign plan
   `openspec/changes/frontend-v3-calm-momentum/execplan.md` and its
   `Exact next action`; W8 is a new, separately-authorized wave.

## Outcomes & Retrospective

- Status: Complete.
- Summary: W7 rebuilt Habits as a date-scoped, list-first daily check-in surface and merged it to main as `f679a26` (PR 59). All 27 OpenSpec tasks are checked. The previous session's eight `w7-full` failures are resolved and none recur; the fresh broad gate added two `ENVIRONMENT`-classified D14 timing steps that flip PASS/FAIL on unchanged product code with host load.
- Evidence: Fresh `qa:full` on isolated 8083 — typecheck/lint/Vitest 2571 passed (254 files)/openspec 74 PASS, `e2e:full` 253 passed / 64 skipped / 2 `ENVIRONMENT`, deterministic simulation 23/23; exact-head CI `37822880601` green on every quality step except the two pre-existing `braces`/`node-forge` advisories; 46 opened and inspected web images; 57px rows / 48px actions / 44pt editor choices.
- Remaining: Only the two D14 timing steps await a quiet-host or CI confirmation (the CI e2e lane skips behind the advisory gate). Android native smoke/persistence/lifecycle remain NOT RUN on an API35 versus required API36 target. Neither is a W7 code defect and neither is claimed as passed.
- Follow-up: W8 Focus is a new, separately-authorized wave. `.tmp-ios36423379932/` and `stash@{0}` are deliberately preserved, not cleaned.
