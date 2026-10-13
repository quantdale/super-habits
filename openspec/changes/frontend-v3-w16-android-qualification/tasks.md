# W16 — Android API-36 current-source native qualification

## 1. Preflight and planning

- [x] 1.1 Author this slice + `execplan.md` before native work
- [x] 1.2 Verify the toolchain: Android SDK, `Nitro_API_36` (API 36 x86_64), Java 17, Maestro 2.9.0, `adb`
- [x] 1.3 Confirm the candidate source SHA and that the campaign worktree can stay untouched

## 2. Target and provenance

- [x] 2.1 Boot `Nitro_API_36` as an owned process; verify API 36 / x86_64 / AVD name on-device
- [x] 2.2 Diagnose and resolve the AVD boot crash (environment note in `design.md` D16.6)
- [x] 2.3 Certify from a clean detached worktree at the exact SHA
- [x] 2.4 Build the credential-free `e2e-test`-equivalent APK; verify the bundle scan
- [x] 2.5 Record source SHA, tree-clean state, APK SHA-256, target identity

## 3. Mandatory native matrix

- [x] 3.1 Cold launch → Today, all six destinations, correct selected tab
- [x] 3.2 Quick Capture + Command Center open/close
- [x] 3.3 Settings open/close; one modal and one keyboard form
- [x] 3.4 Persistence across process kill/relaunch (todos, habits, reminders, calories, workout, settings)
- [x] 3.5 Lifecycle lane (habit reminder actions/replay/delivery, Pomodoro lifecycle + notification path, gym-v2 session resume)
- [x] 3.6 Reward, backup-v2 and portable-backup lanes

## 4. Defects, fixes and re-verification

- [x] 4.1 N-1 nav-label truncation reproduced, fixed, new APK, re-verified
- [x] 4.2 N-2 weekly-plan day/assignment a11y gap fixed (additive)
- [x] 4.3 Correct every stale/date-dependent flow marker without weakening an assertion
- [x] 4.4 Rebuild the exact-source APK after each source change and re-run the affected lanes

## 5. Evidence and closure

- [x] 5.1 `docs/ui-ux/v3-audit/w16/README.md` with provenance, matrix, defect register and residuals
- [x] 5.2 Machine-readable native reports archived under `docs/ui-ux/v3-audit/w16/native-reports/`
- [x] 5.3 On-device captures inspected (nav before/after, Today)
- [x] 5.4 Adversarial review of source/APK identity and claim truthfulness
- [ ] 5.5 Commit and publish W16; advance the parent checkpoint to W17
- [ ] 5.6 Remove the certification worktree and confirm development ports are free
