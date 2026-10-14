# Post-W17 overnight successor — convergence register

Change: `frontend-v3-post-w17-overnight-successor`
Branch: `frontend-v3-post-w17-overnight-successor`
Starting SHA: `fb10d6ccfe66b54613c6fd22cb82da7dd7626e4f` (`origin/main`, verified 2026-10-15)
Worktree: `D:/Documents/tryPython/superhabits-overnight`

This register is the living evidence index for the overnight successor. It does not rewrite W12–W17 or PR #78 history. Counts below are for the runs that produced them, at the revisions named.

## Findings

| ID   | Type          | Severity | Disposition                                    | Grounding                                                               |
| ---- | ------------- | -------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| ON-1 | DOCUMENTATION | P1       | VERIFIED_FIXED in source; plan validates       | Parent recovery no longer resumes the COMPLETED correction              |
| ON-2 | COVERAGE_GAP  | P2       | VERIFIED_FIXED on web                          | Over-by-1, 400 kcal delete-back, and exact-goal tests passed 29/29      |
| ON-3 | FLAKY_TEST    | P1       | web proof only; device re-run BLOCKED_EXTERNAL | `habit-reminder-disable` at app source `52a10d0`, report `…T102936199Z` |
| ON-4 | FLAKY_TEST    | P1       | flow hardened; device re-run BLOCKED_EXTERNAL  | `workout-gym-v2-persistence` at `52a10d0`, report `…T111149074Z`        |
| ON-5 | SECURITY      | P1       | FAILED-UNREMEDIATED                            | `braces@3.0.3`, `node-forge@1.4.0`, audit exit 1                        |

## ON-3 signature

Source `52a10d01a4d73394a699880766a612c009fc0cd8`, APK SHA-256 `65558DFEEA587E11124CE3D4920564EE8938236A7CC37EA731EE0F91156E4D0D`, AVD `Nitro_API_36`, serial `emulator-5594`.

`scrollUntilVisible` text `Save changes` failed after 24670 ms: `No visible element found: "Save changes"`. The screenshot shows the Edit Habit sheet, reminder Off, and Linked Actions entering the viewport. The button was below the fold. Three later standalone replays were reported green; this register does not treat a retry as proof the scroll is reliable.

Fix: Create habit / Save changes move to the modal footer. The Maestro step now waits for that label instead of scrolling the sheet for 20s.

## ON-4 signature

Same APK and AVD. Command 09 tapped `New routine name` at bounds `[82,2199][1000,2325]` on a 2400px display. Command 12 then failed looking for `Add routine`. The failure hierarchy contains `Plan`, `Save Plan`, and `Plan for 2026-10-14`, and does not contain `Add routine` or `Routine name`. The runner JSON says `PRODUCT_BUG` because Maestro exited 1; that label is not a triaged persistence defect. No lost workout row was observed — the flow died before Add routine.

Fix: edge-swipe the field off the tab bar, assert the typed name is visible, reveal Add routine from the screen edge, and assert the Plan sheet is not open before the tap.

## Web validation on this worktree

`npm run build:e2e` exported a hermetic `dist/` with 0 Supabase hosts. The export nested wasm under `dist/assets/_superhabits/` because this worktree's `node_modules` is a junction to the sibling checkout; the harness still reads `dist/assets/node_modules/...`. A copy of the wasm file was placed at the harness path for the run. That copy is gitignored `dist/` and is not a product change.

`npx playwright test e2e/calories-w10.spec.ts e2e/habits.spec.ts --project=chromium`: **29 passed, 0 failed, 0 skipped** (3.5m). That includes the new over-by-1, 400 kcal delete-back, exact-goal, and habit-footer viewport tests, plus the existing W10 and habit save/reload specs.

`npx tsc --noEmit`: exit 0. `tests/calories.domain.test.ts`: 44/44.

P0 journeys: `npx playwright test --project=journeys --grep @p0` — **25 passed**.

Broader local battery (`--project=chromium --project=pwa --project=journeys --project=simulation --project=visual`) was interrupted. Captured output through test 451: **365 passed, 86 skipped, 0 failed**. The skips are the `@sync` steps, which do not run in the local journeys project. The runner was then killed after the tool wait ended and the process stopped making artifacts; it is not a completed suite. A follow-up `--project=simulation` run observed 2 passed before that wait also ended. Do not read this as 453/453.

`e2e:sync` / hosted `nightly`: **NOT RUN**. No disposable backend was used.

## Security

`npm view` on 2026-10-15: both packages are still the latest published versions and both advisory ranges were `*` at the last gate run. No allowlist edit. Hosted `e2e` / `nightly` on run `38595232448` remain SKIPPED, not passed.

## Not claimed

- iOS: NOT RUN.
- Android exact-source pass at this branch: NOT RUN until an APK is built from this app source and the affected flows execute.
- Full Playwright inventory: not an execution result.
