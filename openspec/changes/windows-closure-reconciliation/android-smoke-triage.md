# Android smoke residual — reviewed triage (`command-center-v2`)

Source evidence, read without modification:

| Item                     | Value                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Raw report               | `simulation-output/native/apply-closure-2026-10-01/native-android-smoke-Nitro_API_36-2026-10-01T013333396Z.json`                        |
| Raw machine status       | `FAILED_NEEDS_TRIAGE`, `classification: PRODUCT_BUG`                                                                                    |
| Source SHA               | `68db684d0915d8cd781d52b282a3934ca214171b` (clean detached checkout)                                                                    |
| APK SHA-256              | `5DF9D5DC72EF13B4B88DF32527244C50BD750D1C48EF79EB0CA3B6D2ADFA1014`                                                                      |
| Target                   | `Nitro_API_36`, `emulator-5554`, API 36, `x86_64`, package `com.dale16.superhabits` 1.0.0 (1)                                           |
| Hermetic build           | `EXPO_NO_DOTENV=1`, no ambient `EXPO_PUBLIC_*`, bundle scan 0 matches for `supabase.co`                                                 |
| Flow coverage            | `MISMATCH` — expected and executed both `[command-center-v2, native-smoke]`, `missing: []`, `unexpected: []`, reason "Maestro exited 1" |
| Failing step             | Debug tree `step-014-tapOnElement-Create`: `Element not found: Text matching regex: Create`                                             |
| Reproduced debug extract | `simulation-output/native/apply-closure-2026-10-01/command-center-v2-debug/` (hierarchy, screenshot, logcat)                            |

## What the artifact shows

The step-14 hierarchy is complete for the mounted screen and contains **no** `Create`, `Ask`, or `Auto` element. Its command-center texts are exactly:

`Command center`, `Command input`, `Parsing saves text in recent commands on this device. App actions require confirmation.`, `Command`, `Add a todo to call mom tomorrow`, `Create a habit to drink water every morning`, `Parse command`, `Supported examples`, `Overview` (plus the section-tab numerals). The screenshot shows the command center rendered and usable.

Maestro's selector is a **full-match** regex (`Text matching regex: Create` did not match the example text `Create a habit to drink water every morning`, which was on screen), so the absence is a real absence of an element whose text is exactly `Create`, not a matching artefact.

## Why the raw `PRODUCT_BUG` label is not supported

`CommandScreen` renders the mode selector only behind the rollout flag:

```tsx
if (!AI_ASK_EXPERIMENT_ENABLED) {
  return <View className="gap-4 pb-1 pt-1">{commandContent}</View>;
}
// …later: <ModeToggle mode={mode} onChange={handleModeChange} />
```

`AI_ASK_EXPERIMENT_ENABLED` is `process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT === 'true'` (`features/command/types.ts`). The hermetic E2E build sets only `EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST=true` and the envelope blocks dotenv loading, so the flag is false and `ModeToggle` is not mounted at all — not even its ordinary `Create` chip. `features/command/commandSurface.ts` makes the same decision as a pure function: `commandModeOptions(false)` is `[Create]`, but that list belongs to a component the ordinary build never renders.

That is the intended product boundary, not a defect: the `harden-native-evidence-and-release-posture` spec requires Ask and Auto to be default-off because both reach a paid provider, and it explicitly rejects satisfying a test by exposing a hidden control. The flow's step is stale with respect to that boundary: it was written when the selector was unconditional.

## Classification

**`TEST_BUG`** — the test step asserts a control the ordinary/release render boundary intentionally does not expose. Not `PRODUCT_BUG` (the ordinary surface is complete and reachable), not `EXPECTED_PROFILE_DIFFERENCE` (this is the default product profile, not a test-only profile), not `RELEASE_PROFILE_MISMATCH` (the installed APK is the hermetic release build the lane intends to qualify), not `ENVIRONMENT` (the device booted, installed, launched, rendered, and reported a deterministic selector miss).

The raw report's `PRODUCT_BUG` value is preserved verbatim: it is machine triage emitted before review, and the raw artifacts are never edited.

## Repair and residual uncertainty

Repair scope is the flow file only: the unconditional `tapOn: 'Create'` is replaced with platform-conditional behavior. Android now asserts the ordinary Create surface (`Command input` visible) and the absence of the rollout-gated `Ask`/`Auto` controls, then continues the unchanged example/parse/review/confirmation assertions. The iOS branch keeps the historical `tapOn: 'Create'` command, and no shared iOS semantics change.

`command-center-v2.yaml` is selected only by the Android runner's `smoke` tag; it is not in either `.eas/workflows/native-e2e.yml` flow list, so the iOS campaign's flow set and its 13-flow inventory are untouched.

**Residual uncertainty, stated rather than hidden:** run `68db684` aborted at step 14, so every later command in the flow (example chip, parse, review card, confirmation) is unproven on Android. A one-line selector correction is not proof that the full flow passes; the complete flow must execute on the current-source hermetic APK before this residual is closed. Regression protection lives in `tests/maestroCommandCenterFlowGuards.test.ts`, which also proves it rejects the original unconditional step.
