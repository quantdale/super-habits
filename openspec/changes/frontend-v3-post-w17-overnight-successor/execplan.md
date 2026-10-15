# ExecPlan: Post-W17 overnight successor convergence

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Close the post-W17 reliability gaps that a new agent can still hit: a recovery pointer that restarts a completed correction, a gated Calories over-goal day that no standard test exercises, and two Android persistence flows that failed on navigation/scroll misses. Leave an honest security and iOS boundary.

## Context

- Verified baseline: `main` = `origin/main` = `fb10d6ccfe66b54613c6fd22cb82da7dd7626e4f` (PR #78 merge record). No newer remote commits on 2026-10-15.
- Worktree: `D:/Documents/tryPython/superhabits-overnight`, branch `frontend-v3-post-w17-overnight-successor`.
- Foreign state preserved: stash `pre-recovery-local-changes`, untracked `.tmp-ios36423379932/` in the main checkout. Do not pop, clean, or stage them.
- Native failure artifacts live only in the correction worktree's gitignored `simulation-output/native/`. They were read in place.
- Hosted CI run `38595232448` on `fb10d6c` failed at the dependency audit. `e2e` and `nightly` were skipped behind that gate.
- `npm view` on 2026-10-15: `braces@3.0.3` and `node-forge@1.4.0` are still the latest published versions.

## Scope

- Parent recovery pointer, this change's OpenSpec artifacts, gated Calories over-goal tests, habit editor footer, and the two Maestro flows named by the Oct 14 failures.
- A truthful overnight register under `docs/ui-ux/v3-audit/post-w17-overnight/`.
- Security re-verification without a waiver.
- Further successor fixes only when a reproduced defect justifies them.

## Non-Goals

- Re-authoring or re-running W12–W17.
- Waiving `braces` or `node-forge`, editing `scripts/audit-runtime-deps.mjs`, or marking hosted e2e/nightly passed.
- iOS certification, production Supabase, schema migration, or golden regeneration without an inspected product pixel change.
- Killing unrelated emulators or processes. `emulator-5570` and `emulator-5594` were already attached at session start.

## Current Checkpoint

- Current milestone: post-W17 RC convergence campaign (2026-10-15, autonomous session). Native coverage accounting corrected (the big reinterpretation), the 4 real iOS failures triaged with fixes/deferrals, security bounded-recheck confirmed UNREMEDIATED, web-e2e dispatchability determined (NOT dispatchable). PR #79 stays OPEN: the audit gate is genuinely unremediable and must not be waived.
- Completed: (1) A1 — `readExecutedFlows` only understood Maestro's legacy `<flowId>/manifest.json` layout, so on Maestro CLI 2.2.0 every run undercounted `executed: []` and 9 genuinely-passing iOS flows were misreported NOT_CERTIFIED. Fixed to read the 2.x flat evidence (`commands-(<flow>.yaml).json` etc.), aggregate across the split run dirs, and treat unrecognized evidence as UNPROVEN (never a false empty-run). Also stopped auto-labeling every non-zero Maestro exit `PRODUCT_BUG` (it is FAILED_NEEDS_TRIAGE until evidence classifies it). Verified against the real run-38676461813 debug trees: reader now detects 13/13 (was 0/13). (2) A2 — classified all 4 FAILED_NEEDS_TRIAGE flows from the captured hierarchies/logs and fixed the two clear TEST_BUGs: the To-Do persistence flow (row a11y name is `Edit task: <title>`, so a full-match title regex missed a visible, persisted row -> partial-match title regex) and workout-gym-v2-session-lifecycle (`tapOn: Weight` hit the column header index 0, not the input index 1, so `inputText 42` was dropped -> `index: 1`, same convention habit-persistence documents). Deferred the two nav/gesture divergences (calories-persistence opens onto the Focus surface; workout-gym-v2-persistence `scrollUntilVisible` escapes the exercise card to the Workout landing) for evidence-based triage, NOT a speculative selector change. (3) Priority E — bounded recheck (no disproven experiments redone): registry braces 3.0.3 / node-forge 1.4.0 unchanged, both advisories `first_patched_version: null`, 87 security guards green (forge tripwire still accepts the forgery). SECURITY_UNREMEDIATED retained; audit gate correctly red. (4) Priority D — `web-e2e-validation.yml` is dispatch-confirmed UNAVAILABLE (HTTP 404: not on the default branch; introduced by PR #79, unmerged), so the authorized scoped path is a local hermetic build + Playwright run.
- In progress: iOS GHA re-run 38712060166 at head db04415 (verifies A1 + the 2 fixes, certifies the 9 passing flows, ~2.5h). Local web E2E (`build:e2e` hermetic OK -> `npm run e2e`) running as the scoped web-evidence path. Pending: doc truth-correction (NATIVE-CERTIFICATION still says iOS NOT RUN), adversarial review, release decision, final report.
- Important modified files: `scripts/native-flow-coverage.mjs`, `scripts/qa-native.mjs`, `tests/nativeHermeticityAndCoverage.test.ts` (29dd16a, A1); the To-Do persistence + Gym V2 session-lifecycle Maestro flow files (db04415, A2). Untracked evidence: `.tmp-ios36423379932/campaign-ios-artifact/` (downloaded run-38676461813 artifact). Inherited `.tmp-ios36423379932/` (run 36423379932) lives in the MAIN checkout and is untouched.
- Last successful validation: `tsc --noEmit` exit 0; `eslint . --max-warnings 0` exit 0; full Vitest 2703 passed | 2 skipped (265 files); native coverage tests 22 passed; security guards 87 passed; `npm run build:e2e` hermetic export OK (0 Supabase hosts in dist/). A1 reader proven 13/13 against the real artifact.
- Failures: `node scripts/audit-runtime-deps.mjs` exit 1 with the two UNDOCUMENTED HIGH advisories (braces, node-forge) - genuinely unfixable today. Do not merge. Do not waive. Do not reclassify. The 2 deferred iOS flows (calories-persistence, workout-gym-v2-persistence) are real divergences, not yet fixed.
- Relevant quarantines: none added. Chromium skips are opt-in audit/internal specs. Journey skips are @sync steps that belong to journeys-sync (NOT RUN: no disposable backend).
- Blockers: (a) SECURITY gate red (unremediated) -> PR #79 must stay OPEN, no merge. (b) Android ENVIRONMENT_BLOCKED (host RAM ~1.3-1.6GB free, two FOREIGN emulators emulator-5570/emulator-5594 never touched; 7 bounded campaign-owned attempts failed) -> no exact-source Android qualification. (c) web-e2e-validation.yml NOT dispatchable (404 on default branch) -> hosted web evidence unavailable; local scoped path used instead. (d) Sync/remote lanes NOT RUN (no authorized disposable backend; production Supabase out of scope). (e) 2 iOS flows need device-verified fixes.
- Exact next action: when iOS run 38712060166 and the local web E2E finish, record their genuine outcomes; write the corrected NATIVE-CERTIFICATION + this checkpoint (iOS suite EXECUTED and failed at 9aa0f78 - not NOT RUN); run the independent adversarial review; decide release readiness; publish the final evidence pack and the required report. Keep PR #79 OPEN.
- Remaining definition of done: every observed iOS failure classified with evidence (done for all 4); native coverage accounting truthful (done, verified); reproducible in-scope defects corrected (2 of 4; 2 deferred with evidence); affected regressions pass at their recorded revisions; iOS certification either earned or explicitly reported incomplete with a concrete blocker; Android requalified or its environmental blocker documented (documented); hosted functional evidence collected where config permits (web workflow unrunnable -> local scoped path); security audit uncompromised (retained); release decision distinguishes implemented/tested/ready; PR #79 + parent plan carry current recovery instructions.

## Progress

- [x] Baseline and isolated worktree
- [x] Native artifact forensics
- [x] Recovery pointer
- [x] Calories gated tests written
- [x] Habit footer and workout flow hardening written
- [x] Hermetic web validation
- [x] Security re-verification recorded
- [x] Native re-run or explicit external block
- [x] Independent review and successor decision
- [x] Final convergence: security lanes re-verified to closure and dispositioned (2026-10-15)
- [x] Final convergence: harness fail-closed fixes + weak assertion strengthened + macro coverage gap closed (2026-10-15)
- [x] Final convergence: non-release hosted validation workflow added (2026-10-15)
- [ ] Final convergence: Android exact-source qualification or explicit ENVIRONMENT_BLOCKED (in progress)
- [ ] Final convergence: hosted lanes dispatched at the final head (pending final push)
- [ ] Final convergence: final local ladder + release decision at the final head

## Surprises & Discoveries

- Oct 14 native JSON reports are not in the main checkout. They are in `D:/Documents/tryPython/superhabits-post-w17-correction/simulation-output/native/`. The runner's `classification: PRODUCT_BUG` is the default failure enum list plus a failed exit, not a triaged product defect.
- `habit-reminder-disable` failed at `scrollUntilVisible` "Save changes" while the Edit Habit sheet was open and the reminder toggle was already off. The button was below the fold.
- `workout-gym-v2-persistence` tapped `New routine name` at bounds y=2199–2325 on a 2400px screen, then the failure hierarchy was the Plan sheet (`Save Plan`) with no `Add routine` node.
- `aria-hidden` on inactive sections already maps to `importantForAccessibility="no-hide-descendants"` in React Native 0.83, so the workout miss is not explained by hidden-section leakage.
- `npm view` still shows no patched `braces` or `node-forge`.

## Decision Log

- 2026-10-15 — One OpenSpec change for the overnight successor, not six plans. Campaigns stay milestones.
- 2026-10-15 — Move habit Create/Save to the modal footer rather than only lengthening a Maestro timeout. The failure screenshot shows the action off screen, and the modal already has a footer slot.
- 2026-10-15 — Treat the workout failure as a harness gesture bug. Do not change workout persistence code without a lost-row reproduction.
- 2026-10-15 — Do not waive the two HIGH advisories.
- 2026-10-15 — Final convergence: keep the audit gate red rather than reclassify. The tailwindcss devRelocation experiment was executed in a throwaway worktree and disproven (peer deps + metro path); no allowlist/policy change is authorized or needed to describe the truth.
- 2026-10-15 — Final convergence: hosted E2E evidence may run from a dispatch-only, explicitly non-release workflow that does not depend on the red audit; the audit job remains a separate hard gate and no combined-green is produced.
- 2026-10-15 — Final convergence: the iOS keyboard/footer exposure (no KeyboardAvoidingView; `UIModalPresentationOverFullScreen` means the pinned footer is covered while the name field is focused) is recorded as a P2 known gap with repro steps, not fixed blind: the fix is a shared-Modal change that cannot be device-verified in this campaign (iOS NOT RUN except the GHA lane, which does not run the habit-editor flow).

## Validation Ledger

- 2026-10-15 — `git fetch` and `git rev-parse HEAD origin/main`: both `fb10d6ccfe66b54613c6fd22cb82da7dd7626e4f`.
- 2026-10-15 — `gh run list`: latest main CI `38595232448` failed; e2e/nightly not executed on that head.
- 2026-10-15 — `npm view braces version` = `3.0.3`; `npm view node-forge version` = `1.4.0`.
- 2026-10-15 — `npm run agent:plan:validate` both plans ACTIVE; `npm run openspec:validate` 88/88; `tsc --noEmit` exit 0; `npx vitest run tests/calories.domain.test.ts --project unit` 44/44.
- 2026-10-15 — `npm run build:e2e` hermetic, 0 Supabase hosts. `npx playwright test e2e/calories-w10.spec.ts e2e/habits.spec.ts --project=chromium` 29 passed, 0 failed, 0 skipped.
- 2026-10-15 — `node scripts/audit-runtime-deps.mjs` exit 1, 2 undocumented HIGH. No waiver.
- 2026-10-15 — `adb devices` showed emulator-5570 and emulator-5594; `adb shell getprop` and `adb emu avd name` hung. Native install not attempted.
- 2026-10-15 — P0 journeys 25/25. Broader chromium+pwa+journeys+simulation+visual battery interrupted after 365 passed / 86 skipped / 0 failed observed (through test 451). Not a completed full run. `e2e:sync` NOT RUN.
- 2026-10-15 — Published as PR #79 (`https://github.com/quantdale/super-habits/pull/79`), head `6617d85`, base `main` `fb10d6c`. Not merged. Hosted quality was pending at publication; the audit gate is still expected to fail.
- 2026-10-15 — Hosted quality run `38612438342` failed only at the audit step. Typecheck, lint, OpenSpec, ExecPlans, and unit/integration passed. `e2e`/`nightly` skipped. iOS workflow skipped.
- 2026-10-15 — Clean hermetic rebuild with no canonical wasm copy. Discovery used `dist/assets/_superhabits/...`. Over-goal SQL oracles passed. Later lanes: chromium 250/44/0, journeys 76/42/0, visual 34/34, pwa 5/5, simulation 3/3. `journeys-sync` NOT RUN.

## Changed Files / Areas

- `features/habits/HabitsScreen.tsx` — primary action in the modal footer.
- `e2e/calories-w10.spec.ts` — gated over/exact/delete-back oracles.
- `e2e/habits.spec.ts` — 390×844 viewport reachability for Create habit.
- `.maestro/flows/habit-reminder-disable.yaml` — wait for footer Save changes instead of scrolling the sheet.
- `.maestro/flows/workout-gym-v2-persistence.yaml` — edge swipe, typed-name oracle, no center swipe before Add routine.
- `openspec/changes/frontend-v3-calm-momentum/execplan.md` — recovery pointer.
- `docs/ui-ux/v3-audit/post-w17-overnight/` — convergence register.

## Recovery / Resume Instructions

- Fresh session: `npm run agent:resume -- --plan openspec/changes/frontend-v3-post-w17-overnight-successor/execplan.md` from the overnight worktree, then `git status --short` and `git rev-parse HEAD`.
- Do not resume `openspec/changes/frontend-v3-post-w17-correction/execplan.md` for implementation. It is COMPLETED.
- Do not pop `pre-recovery-local-changes` or delete `.tmp-ios36423379932/`.
- Do not kill emulators you did not start. Identify AVD ownership before `qa:native:*`.
- Continue only from Exact next action above.

## Outcomes & Retrospective

- Not complete. Fill this section only when Status becomes COMPLETED.
