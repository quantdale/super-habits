## Design — W16 Android API-36 current-source qualification

Authority: `docs/testing/native-e2e.md`, `docs/testing/known-gaps.md`,
`AGENTS.md` (§ "Server Lifecycle Rule", native E2E), campaign brief §3 (W16),
`qa/impact-map.json`.
Baseline: `b50034d` on `frontend-v3-w12-w17-integration` (W12–W15 integrated).

### D16.1 Source authenticity is a gate, not a claim

`scripts/qa-native.mjs` already fails closed on two conditions, and W16 relies
on both rather than re-implementing them:

1. `checkTarget()` requires a device reporting API **36** and ABI **x86_64**;
   anything else is an `ENVIRONMENT` blocker with a remediation string.
2. The provenance check refuses to certify when the **installed** build's source
   revision differs from `HEAD`.

Both guards fired during this wave (an API-35 AVD, then a stale APK), which is
the evidence that the eventual PASS is source-authenticated.

### D16.2 Certification from a clean checkout

`AGENTS.md` records that the native path requires an empty
`git status --porcelain=v1 --untracked-files=all`, and the campaign brief
forbids deleting the preserved `.tmp-ios36423379932/` foreign evidence. W16
therefore certifies from a **detached worktree at the same commit** rather than
mutating the campaign worktree:

```
git worktree add --detach ../superhabits-w16-native <sha>
```

`node_modules` is a junction to the shared install (git-ignored, so the tree
stays clean). Any evidence a run writes is copied back to
`docs/ui-ux/v3-audit/w16/` so the certification tree remains pristine between
lanes. The worktree is removed at the end of the wave.

### D16.3 Build identity

The APK is the repository's credential-free `e2e-test` equivalent (build kind
`canonical`): hermetic (`EXPO_NO_DOTENV=1`), bundle-scanned for `supabase.co`
(0 matches), and carrying only the documented test-only flag
`EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST=true` so the near-term reminder delivery
probe can run. Its SHA-256, path, app id, version and target identity are
recorded in `native-android-build.json`.

### D16.4 Flow fixes must preserve the contract

Most W16 failures were **test** defects: flows asserting copy that W6–W13
deliberately removed, or asserting a value on a surface that no longer shows it.
The rule applied:

- Replace a stale marker with a currently-rendered, **unique** marker.
- Never delete an assertion, relax a wait, or change the product to match a
  stale test.
- Where the oracle moved (habit schedule/reminder), prefer the
  **date-independent** surface (the detail modal's Settings tab) over the
  date-dependent list row, which is strictly stronger.
- Record the owning wave in a comment so the next drift is diagnosable.

### D16.5 Product fixes are narrow and additive

Two product defects were reproduced on-device:

- **N-1** bottom-nav label truncation (native-only, P2): fix in `TabButton` by
  letting the label use the full slot (`alignSelf: 'stretch'` +
  `textAlign: 'center'`). Label text, font size, destination count and touch
  targets are untouched.
- **N-2** weekly-plan day/assignment not related for assistive tech: add
  `accessibilityLabel={`${weekday}: ${assignment}`}` to the assignment text.
  Purely additive.

Both require a **new exact-source APK** and a re-run of the affected flows; an
old package is never reused after a source change.

### D16.6 Environment notes

The `Nitro_API_36` AVD segfaults with software/vulkan rendering on this host
(`Failed to load opengl32sw`) and boots with `-gpu host`, the mode the working
sibling AVD uses. This is an environment configuration, recorded rather than
worked around by substituting a different API level. Foreign emulator processes
are never terminated; only this campaign's own stray PIDs were.

### D16.7 iOS

Owner-deferred. The `.eas/workflows/native-e2e.yml` cloud path needs an
EAS-linked repository and a plan permitting Maestro jobs; neither was verified
here, so no iOS result is claimed and no iOS workaround is implied.
