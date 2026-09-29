# iOS flow failure classification (task 3.1)

Source evidence: run `36423379932`, source SHA `e9b42a3f31984f86dd50e0b337300df74898f422`, repository `quantdale/super-habits`, attempt 1, executable SHA-256 `ef22674b03518115bd465ac7a1293a7ad9e5439238a5af1ac9a6ac6085be9010`, Xcode 26.2, Maestro 2.2.0, iPhone 17 Pro / iOS 26.2 simulator. The three `FAILED_NEEDS_TRIAGE` flows were classified from the uploaded artifact `10980993163`, read through the untracked local extract `.tmp-ios36423379932/`. That extract was confirmed to be this run's evidence before use: its `ios-gha-36423379932-1-e9b42a3f3198.json` and `ios-provenance-36423379932-1.json` both name run `36423379932`, source `e9b42a3f…`, and executable `ef22674b…`.

Classification is per the failure-class vocabulary in each `native-ios-all-*.json` report: `PRODUCT_BUG`, `TEST_BUG`, `FLAKY_TEST`, `ENVIRONMENT`, `EXPECTED_KNOWN_GAP`, `SPEC_AMBIGUITY`.

This file is the single detailed source for the three iOS classifications. The flow YAML comments and the regression-test header deliberately carry only a short pointer here, so one narrative is not duplicated across four files.

## 1. `native-smoke` — TEST_BUG

**Observed.** The `Focus` tap inside the `Section tabs` landmark completes, then `Assert that "Classic sequence: focus → short breaks → long break — durations saved on device." is visible` polls for the full 10 s budget and fails at `14:48:32.617`.

**Evidence the product is correct.**

- The failure screenshot shows the Pomodoro section fully rendered, with the Focus tab selected and the subtitle painted on screen.
- The hierarchy captured in the failure dump contains the target twice, both at bounds `[20,119][382,160]`, with `enabled: "true"`. Every ancestor is full-width and non-degenerate: the nearest scroll container is `[0,62][402,2504]` on a 402×874-point screen, so the element's frame is entirely inside the visible region.
- A code-point comparison of the selector against the dumped `accessibilityText` is byte-identical, and both an anchored full-match and a substring test succeed. The selector is therefore not the problem.
- In the same run and the same binary, `pomodoro-lifecycle.yaml` PASSED against this exact screen: it taps `Focus` in `Section tabs`, then `Start focus`, and asserts `Pause`. The section mounts and is interactive.

**Conclusion.** The string is present, correct, and on screen, and Maestro still reports it not visible. The failing assertion depends on a long, two-line-wrapped, Unicode-heavy subtitle. `pomodoro-lifecycle` passing on the same screen is the direct control.

**The discriminator visible in the dump.** Grouping the 33 distinct accessibility texts on the failure screen by how many nodes expose them gives 16 single-occurrence and 17 duplicated. The failing subtitle is exposed **twice at identical bounds** `[20,119][382,160]` — a nested container/Text pair. So is the `Pomodoro` heading at `[20,74][382,115]`. By contrast every element this run matched successfully is single-occurrence: `Start focus`, `Focus timer mode`, `Short Break`, `Long Break`, `Edit timer duration`, `Quick capture`, `Section tabs`, and the six section tab labels. An intermediate draft of the fix asserted the `Pomodoro` heading; the dump shows that heading has the same duplicated shape as the failing element, so that fix was withdrawn in favour of a single-occurrence marker.

**Residual uncertainty, stated rather than hidden.** Duplication is the best-supported discriminator available from the artifact, not a proven root cause, and the failure mechanism inside Maestro's iOS visibility computation is not observable from the artifact. A first fix could still fail at run time. That is exactly why task 3.3 requires a new exact-SHA 13/13 run before iOS may be called certified; the fix is a well-evidenced hypothesis under test, not a certified result.

## 2. `workout-gym-v2-persistence` — TEST_BUG

**Observed.** `seq64` runs the bounded `repeat … while: notVisible 'Native custom press progression increment'`, its eight swipes (`seq65`–`seq72`) all report COMPLETED, and `seq73` asserts the same string and fails. Immediately before, `seq59` `assertVisible 'Configure Native custom press exercise'` and `seq60` `assertVisible 'Strength'` both passed, so the routine detail and the expanded custom-exercise card were mounted.

**Evidence the product is not at fault.**

- The failure hierarchy contains 45 text nodes and none of `Configure Native custom press`, `progression increment`, `Linear`, `Strength`, `Target load`, `Reps`, or `Weight`. It does contain `Weekly volume` at `[45,236][322,264]` and `Workout history` at `[45,401][322,429]`.
- The failure screenshot shows the Workout section's own landing content — `Log weight`, `Weekly volume`, `Workout history` — scrolled to the bottom, with the Workout tab active.

**Conclusion.** The swipes did not merely fail to reach the field; they left the routine detail entirely and returned to the underlying Workout section. This is the same escape the flow already documents in its own comment ("the failure screenshot showed the underlying Workout screen on the exact-SHA run"), so it is a recurring harness-interaction defect in this card, not a persistence or rendering regression. No product code change is warranted.

**What the artifact does not establish.** It does not show _which_ gesture caused the escape, and it does not show that any alternative will stay on the card. The replacement below is therefore an unproven hypothesis, and this is the weakest of the three fixes.

## 3. `workout-gym-v2-session-lifecycle` — TEST_BUG

**Observed.** `seq64` `inputTextCommand("42")` and `seq65` `assertVisible: "42"` both COMPLETED. `seq66` `hideKeyboardCommand` fails with Maestro's own error: `Couldn't hide the keyboard. This can happen if the app uses a custom input or doesn't expose a standard dismiss action.` Maestro's debug message recommends tapping a non-interactive element instead.

**Evidence.**

- The weight-survival assertion the change requires is already passing at the point of failure, and the post-restart survival proof at lines 179-180 (`assertVisible: '42'` / `assertVisible: '6'` after `killApp`/`launchApp` and `Resume workout`) is still in place and untouched.
- The sibling flow documents the same platform limitation and its substitute, at `workout-gym-v2-persistence.yaml` lines 66-69: "pressKey enter (blur) is used instead of hideKeyboard inside the picker: on an emulator without a soft keyboard, hideKeyboard sends BACK and dismisses the modal."

**Conclusion.** The failing step is `seq66 hideKeyboardCommand`, and the weight assertion at `seq65` passed immediately before it, which is exactly the precondition the change design set before replacing this command. The defect is scoped, not universal: the tree has **12 `hideKeyboard` steps across 11 flows**, of which exactly **4 ran in run `36423379932`** — `habit-persistence`, `habit-progress-insights`, `habit-reminder-actions`, and `habit-reminder-actions-replay` — and **all 4 passed**. The other 7 flows were not part of that run and prove nothing either way. The failure therefore belongs to the active workout session's custom numeric `Weight input` / `Reps input` rather than to Maestro or the simulator in general. The repository's own substitute is `pressKey: enter` (blur), already used after numeric `inputText` in this same feature's persistence flow — but that substitution is itself untested against this custom numeric input, because the flow never got past the dismissal.

## Cross-cutting conclusion

All three are `TEST_BUG`. No `PRODUCT_BUG`, `FLAKY_TEST`, or `ENVIRONMENT` class is supported by the artifact. No user-facing copy is changed to satisfy Maestro. Product and Maestro changes are therefore confined to `.maestro/flows/`, and any fix still requires a new exact-SHA 13/13 run to be certified.

## Fixes applied — task 3.2 is NOT checked

| Flow                                    | Change                                                                                          | Strength of evidence                                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `native-smoke.yaml`                     | Focus marker: wrapped subtitle → `Start focus`                                                  | **Strong.** `Start focus` is single-occurrence in the dump and is the exact element `pomodoro-lifecycle` matched and passed on in the same run.              |
| `workout-gym-v2-session-lifecycle.yaml` | `hideKeyboard` → `pressKey: enter`                                                              | **Moderate.** Maestro's own error at that step, plus the sibling flow's documented substitute. The substitute is untested against this custom numeric input. |
| `workout-gym-v2-persistence.yaml`       | Bounded right-margin swipe repeat → `scrollUntilVisible` (DOWN, 50 %, 30 s, no `centerElement`) | **Weak — hypothesis.** See below.                                                                                                                            |

### Why 3.2 is not checked

An earlier draft of this file claimed that `scrollUntilVisible` "already reached `Linear`, `Target reps min`, `Target reps max` and `Target load` in the same card in the same run." **That claim was false and has been removed.** Parsing the flow's command order puts the failing increment command at index 60, while `Native custom press minimum reps` (65), `Native custom press maximum reps` (69), `Target reps min` (73), `Target reps max` (77) and `Target load` (82) all sit _after_ it. Run `36423379932` aborted at the increment, so it reached none of them. Only `Linear` (index 57), reached at `seq61`, precedes the failure.

The replacement deliberately omits `centerElement`, because the comment it replaced recorded that a _centered_ scroll already escaped to the Workout screen — but Maestro's default swipe is still centred, so this stays a hypothesis. The regression guard pins the removal of the escape-prone repeat and the absence of `centerElement`; it does not claim the new scroll works.

Task 3.3 is the test of all three fixes. Until a new exact-SHA run passes 13/13, none of them is certified.

## Regression coverage

`tests/maestroIosFlowGuards.test.ts`, six guards, 6/6 passing. It bans `hideKeyboard` in the Gym V2 flows only (not repo-wide, which would be false), pins the Focus marker to the evidenced single-occurrence element while leaving the `Pomodoro` heading selectable, keeps the persistence scroll free of `centerElement` and of the swipe-repeat, and asserts the lifecycle weight-survival proof still exists before and after the app restart.
