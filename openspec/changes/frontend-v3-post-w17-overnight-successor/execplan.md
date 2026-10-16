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

- Current milestone: iOS native reliability closure (Campaign 1 of the overnight successor directive, 2026-10-15/16). Run 38726951043 (head 5ebf2d4) finished 10 PASS / 3 FAIL; all three failures are now root-caused from the run's own Maestro logs, command JSON, hierarchies, screenshots, and simulator system logs.
- Completed: (1) calories-persistence classified **TEST_BUG (tap-target occlusion)** — `Manual add` resolved to [204,776][318,820] under the floating tab bar (`Section tabs` [8,778][394,840]); Maestro's bounds-center tap activated the Focus tab (identical at run 38676461813). Fixed by anchoring on the empty day-log title (`No meals logged on this day`) before tapping so the row scrolls clear. (2) workout-gym-v2-persistence classified **TEST_BUG (tap-target occlusion on the dialog clip edge)** — `progression increment` resolved to [41,812][141,843] against the routine dialog panel's bottom edge (~813); the center tap landed on core/ui/Modal's full-screen Dismiss scrim and closed the routine detail (identical at run 38676461813, which refutes the old 'gesture escaped the card' hypothesis: the scroll command completed without a single swipe). Fixed with `centerElement: true` scrolls before each field tap + centered routine-row tap post-restart. (3) workout-gym-v2-session-lifecycle classified **ENVIRONMENT (automation launch race, NOT a crash)** — SpringBoard recorded PID 64694 `running-active-Visible` at 14:23:05 while XCTestDriver's 14:23:06 viewHierarchy returned "Application com.dale16.superhabits is not running"; the same PID logged app/JS activity at 14:23:17; the failure screenshot is the black pre-first-frame screen; no crash record exists. Maestro's `IOSDeviceErrors.AppCrash` is not a `MaestroException`, so `optional: true`/`retry` cannot absorb it (verified against Maestro sources: MaestroCommandRunner rethrows non-MaestroException failures). Fixed at the harness layer: `scripts/qa-ios-launch-race.mjs` + `qa-ios-github-actions.mjs` now capture crash reports, process liveness, and a failure screenshot per failed flow, and allow exactly one evidence-gated, identified full re-run (signature + alive process + no new crash report) reported as `PASS_AFTER_LAUNCH_RACE_RECOVERY` (never a plain PASS).
- In progress: iOS qualification — run 38855979274 (head bf0fe1b) closed **11 PASS / 2 FAIL** with both gym flows deep in their scripts (gym-persistence reached the form's bottom — the scrollability fix worked; session-lifecycle resumed the saved session and completed the workout). The last two defects localized to the tap-occlusion class and are fixed in c548f52: (a) the history disclosure parked at [16,748][386,808] — bounds-center (201,778) on the floating tab bar's top edge, tap never opened it — both 'History and insights' scrolls now centerElement first; (b) a 300ms side swipe FLINGS the modal scroll ~1000pt past the progression row while plain scrolls can't reposition a row the screen-based metric already calls 100% visible — the field scrolls now use centerElement + direction DOWN (the pairing that bypasses the visibility early-return and converges in one swipe; UP pairing forbidden by run 38793221651) with 30s budgets. Run 38869382876 dispatched at c548f52. PR #79 stays OPEN (security gate red).
- Android exact-source qualification remains ENVIRONMENT_BLOCKED (see the 2026-10-16 §A note: boot solved via `-gpu host`; the foreign `emulator-5594` adbd wedge blocks Maestro's device enumeration on the shared adb server; owner-action remediation documented; campaign-owned `emulator-5578` + provisioned APK at 5e62038 kept ready).
- Review round 2 (independent): all 7 round-1 fixes CONFIRMED FIXED; NEW-1 (P1) fixed in 5f7a45b — the takeScreenshot breadcrumbs (bare names → repo root) failed BOTH lanes' source-cleanliness gates (runs 38676461813/38726951043 both ended `sourceUnchangedApartFromGeneratedIos: false`); now gitignored + guard-tested + the lane records the offending git-status lines. NEW-2 (P2) fixed (SUBSET_PASS_WITH_LAUNCH_RACE_RECOVERY keeps the retry marker). NEW-3/NEW-4 (P3: runner glue untested, scripts/*.mjs outside ESLint) accepted as documented residual.
- Important modified files: `.maestro/flows/calories-persistence.yaml`, `.maestro/flows/workout-gym-v2-persistence.yaml`, `scripts/qa-ios-launch-race.mjs` (new), `scripts/qa-ios-github-actions.mjs`, `.github/workflows/ios-native-e2e.yml` (focused-subset dispatch input), `tests/qaIosLaunchRace.test.ts` (new), `docs/ui-ux/v3-audit/post-w17-overnight/NATIVE-CERTIFICATION.md`. Untracked evidence preserved: `.tmp-ios36423379932/` (run artifacts 38676461813 / 38712060166 / 38726951043).
- Last successful validation: 2026-10-16 at this head — `tsc --noEmit` exit 0; `eslint . --max-warnings 0` exit 0; full Vitest in the worktree **2720 passed | 2 skipped** (266 files; 14 launch-race gate tests, 9 flow-guard tests); YAML structural parse of all edited flows + workflow OK; ExecPlan validation PASS; targeted web E2E after the RoutineDetailScreen change (`workout-gym-v2` + `calories-w10`, hermetic `build:e2e` with 0 Supabase hosts): **25 passed | 3 skipped**, exercising the routine editor and calories paths the change touches.
- Failures: `node scripts/audit-runtime-deps.mjs` remains exit 1 (braces 3.0.3 / node-forge 1.4.0 HIGH, no published compatible patch) - genuinely unfixable today. Do not merge. Do not waive. Do not reclassify.
- Relevant quarantines: none added. The three fixes weaken no assertion: each occluded tap is re-anchored semantically, and the post-relaunch readiness requirement is still strict (the runner's recovery is bounded, evidence-gated, and identified).
- Blockers: (a) SECURITY gate red (unremediated) -> PR #79 must stay OPEN, no merge. (b) Android ENVIRONMENT_BLOCKED unchanged. (c) web-e2e-validation.yml NOT dispatchable unchanged. (d) Sync/remote lanes NOT RUN unchanged. (e) iOS certification pending the qualification run at this head.
- Exact next action: dispatch the focused iOS run (flows=calories-persistence,workout-gym-v2-persistence,workout-gym-v2-session-lifecycle) at this head; while it runs, execute successor checks (Android env recheck, security advisory recheck, adversarial review of the harness change); then dispatch the full 13-flow qualification and record its true matrix here.
- Remaining definition of done: the three flows requalified at exact source (focused run then full matrix); launch-race recovery validated or its failure recorded truthfully; native coverage accounting still truthful; security audit uncompromised (retained); release decision distinguishes implemented/tested/ready; PR #79 + parent plan carry current recovery instructions.

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
- 2026-10-15 (RC convergence campaign) — A1 coverage reader proven 13/13 against the real run-38676461813 debug trees (was 0/13): the 13-flow iOS suite at `9aa0f78` is 9 genuine PASS + 4 genuine FAIL, not 0/13.
- 2026-10-15 (RC convergence) — QA gates green at head `beb6a26`: `tsc --noEmit` 0; `eslint . --max-warnings 0` 0; full Vitest 2703 passed | 2 skipped (265 files, unit + real-SQLite integration); `openspec validate --all` 88/88; `agent:plan:validate` ACTIVE/valid; `npm run build:e2e` hermetic (0 Supabase hosts); security guards 87 passed.
- 2026-10-15 (RC convergence) — Scoped web evidence (web-e2e-validation.yml NOT dispatchable, HTTP 404 on default branch): local full Playwright suite **369 passed / 86 skipped / 0 failed** (455 tests, 43.9m, chromium+journeys+visual+pwa+simulation) + `e2e-retry-report.mjs` OK (strictRetriedThenPassed 0). `journeys-sync` NOT RUN (no disposable backend).
- 2026-10-15 (RC convergence) — iOS verification re-run dispatched at `db04415` (run `38712060166`) to certify the 9 passing flows and confirm the 2 selector fixes (To-Do persistence, Gym V2 session-lifecycle); result pending at this line.
- 2026-10-15 (RC convergence) — `node scripts/audit-runtime-deps.mjs` exit 1 (braces + node-forge, both `first_patched_version: null`). SECURED UNCHANGED. No merge.

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
