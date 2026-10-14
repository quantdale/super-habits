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

A first hermetic export nested wasm under `dist/assets/_superhabits/` because this worktree's `node_modules` is a junction to the sibling checkout. The harness then required a manual copy onto `dist/assets/node_modules/...`. That copy is gone. `discoverWasmAsset()` now uses the path the export actually hosts.

Proof: `dist/` was deleted and `npm run build:e2e` was run again. The only wasm was `dist/assets/_superhabits/node_modules/expo-sqlite/web/wa-sqlite/wa-sqlite.7ca566fbbc2ec2a172c5aefa63a20f4b.wasm`. Canonical `dist/assets/node_modules` was absent. The over-goal tests, which call `queryRows`, passed against that export. Bundle scan: 0 Supabase hosts.

Completed independent lanes on that clean export, working tree before the recording commit:

| Lane          | Command                                    | Result                           |
| ------------- | ------------------------------------------ | -------------------------------- |
| chromium      | `npx playwright test --project=chromium`   | 250 passed, 44 skipped, 0 failed |
| journeys      | `npx playwright test --project=journeys`   | 76 passed, 42 skipped, 0 failed  |
| visual        | `npx playwright test --project=visual`     | 34 passed, 0 skipped, 0 failed   |
| pwa           | `npx playwright test --project=pwa`        | 5 passed, 0 skipped, 0 failed    |
| simulation    | `npx playwright test --project=simulation` | 3 passed, 0 skipped, 0 failed    |
| journeys-sync | not executed                               | NOT RUN — no disposable backend  |

Chromium skips are opt-in visual-audit and internal-parser specs. Journey skips are `@sync` steps that run only in `journeys-sync`. Visual goldens were not regenerated.

The earlier combined battery that stopped at test 451 is superseded by these finished lanes. Do not add the two runs together.

## Review

- Habit footer: a 360×740 edit of an existing habit keeps `Save changes` in the viewport after scrolling to linked actions. Tab from the name field reaches it. Enter saves. Reload and SQLite agree. Create uses an unforced button click. Older specs still force-click; they passed and were not rewritten.
- Workout Maestro: the extra 16% edge swipe after `Add routine` becomes visible is an unverified assumption that it will not scroll the button off the top. It was not changed again because no responsive owned emulator was available. It is a residual harness risk, not a reproduced persistence defect.
- `habit-reminder-disable` still has `scrollUntilVisible` for `Create habit`. The footer should make that label visible immediately, so the center swipe should not run. Not device-proven.
- No new product P0/P1 was reproduced in the completed lanes.

## Security

`npm view` on 2026-10-15: both packages are still the latest published versions. No allowlist edit. Hosted quality run `38612438342` on PR #79 failed only at `Audit runtime dependencies`. Hosted `e2e` and `nightly` were skipped behind that gate. They are not passed.

## Not claimed

- iOS: NOT RUN. GitHub iOS workflow `38612438402` skipped.
- Android exact-source pass at this branch: NOT RUN. `adb shell` hung on the already-attached emulators; they were not rebooted or overwritten.
- `e2e:sync` and hosted nightly: NOT RUN.
- PR #79 is not merge-ready while the audit gate is red.
