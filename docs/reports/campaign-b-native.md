# Campaign B — native environment and replay candidate

Source inspected: `02d43088e10170d03f9db44c887227a9705f8dff`.
**Fresh APK/build/install/runtime: BLOCKED_ENVIRONMENT.** No native runtime pass.

A disposable `SH_Campaign_B_API36` AVD was created and launched on serial5588,
owned launcher PID28496; the existing emulator5554 was untouched. Host disk fell
from approximately10GB to under200MB while provisioning. Worker process38472
exited3221226505 before producing a result. That exit code alone is not proof of
an OOM root cause; disk pressure was directly observed. Parent verified the owned
launcher command, terminated that exact tree, and removed only this newly-created
unused AVD (no app installed) to recover3.48GB. A same-protocol worker recovery
then hit provider quota. No foreign device data was cleared, no APK built or
installed, and no old APK was used as current-source evidence.

## Candidate corrections

- `native-resource-preflight.mjs`: conservative16GiB free-disk /4GiB free-RAM
  admission floors for workspace/temp/AVD/Gradle paths, fail closed on probe failure,
  and private dependency requirement for native build output. Drive aliases are
  not summed. These are floors, not a guarantee that a build will fit.
- Provision/owned-emulator paths check admission before build/launch. Prebuild uses
  `--no-install` so it does not silently install into shared dependencies.
- `qa-native-campaign-b.ps1`: explicit disposable emulator identity, clean exact SHA,
  credential-free build, APK/hash comparison, debug signing inspection and existing
  smoke/persistence/lifecycle flow replay. It never starts a target implicitly.
  The script remains unexecuted beyond static review; do not certify it as runtime.
- Resource tests plus six synthetic real-JS-adapter/mocked-Expo scheduler tests.
  First parent replay23 pass/1 fail was a CRLF-sensitive source assertion; corrected
  to accept LF/CRLF without weakening launch-order requirements.

## Certification boundary

SH-11 scheduling success/rejection/invalid ID/permission behavior is only
SYNTHETIC_PASS where the focused suite actually passes. Scheduler timeout,
process interruption, real notification tray delivery, lock/background/foreground,
clock/timezone changes, cancel/duplicates, native SQLite durability/quota/migration,
Workout recovery/measurements and the complete native smoke matrix remain
BLOCKED_ENVIRONMENT or UNEXECUTED. No notification permission was added and no
native application ID changed. Debug build success would not prove release signing.

## Replay

From a clean reviewed commit, with sufficient host resources/private dependencies
and an already booted **explicitly disposable API36 x86_64 target**:

```powershell
powershell -NoProfile -File scripts/qa-native-campaign-b.ps1 -Serial emulator-5588 -ExpectedAvd <disposable-avd-name> -SourceSha <exact-40-character-sha> -DisposableTarget
```

The script executes fixtures that reset app data and must never target a user's
installed dataset. SH-11 actual native rejection still needs a separately justified
native fault seam; the replay does not supply that proof. Existing scripts' resource
floor is a new proposed contract requiring independent review before integration.
Evidence: `simulation-output/native/campaign-b/` in the preserved native worktree;
parent validation logs `/tmp/campaign-b-native-recovery.log` and subsequent replay.
