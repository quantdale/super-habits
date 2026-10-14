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

- Current milestone: local web lanes are complete on a clean hermetic export; PR #79 stays open because the audit gate is red.
- Completed: recovery pointer; habit footer; workout flow hardening; over-goal tests; WASM discovery so a junctioned worktree export needs no manual copy; independent project lanes.
- In progress: none locally executable. Do not merge. Do not install over the attached emulators.
- Important modified files: `e2e/helpers/dbHarness.ts`, `e2e/journeys/the-commute.spec.ts`, `e2e/habits.spec.ts`, plus the earlier footer, flow, and plan files.
- Last successful validation: clean `npm run build:e2e` (0 Supabase hosts, wasm only under `dist/assets/_superhabits/...`). Chromium 250 passed / 44 skipped / 0 failed. Journeys 76 passed / 42 skipped / 0 failed. Visual 34/34. PWA 5/5. Simulation 3/3. Habit long-form keyboard save passed at 360×740.
- Current failures: hosted quality run `38612438342` failed only at `Audit runtime dependencies`. `e2e` and `nightly` skipped behind that gate. iOS workflow skipped.
- Relevant quarantines: none added. Chromium skips are opt-in audit/internal specs. Journey skips are `@sync` steps that belong to `journeys-sync`.
- Blockers: Android re-run BLOCKED_EXTERNAL. `adb devices` lists `emulator-5570` and `emulator-5594`, but `adb shell getprop` hung again. Do not kill adb or install over them. iOS NOT RUN. Audit FAILED-UNREMEDIATED.
- Exact next action: Keep PR #79 open. Do not waive the audit or merge. Do not start `qa:native:provision` against the hung emulators. Resume only if an upstream advisory fix appears or a responsive owned emulator is available.
- Remaining definition of done: the audit is clean without a waiver, and Android/iOS are either exact-source qualified or still explicitly unrun. Local web definition of done for this change is met.

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
