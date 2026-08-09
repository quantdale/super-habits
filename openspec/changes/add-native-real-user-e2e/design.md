## Context

The web QA foundation already provides Vitest, real-SQLite integration, Playwright journeys, deterministic simulations, repro metadata, and six-value failure classification. Native behavior is currently unverified. Expo SDK 55 supports EAS development/preview-style builds and EAS Maestro jobs, while the repository has no committed iOS project and the local Windows environment has no Android emulator, Java, Maestro, or Xcode tooling.

The native layer therefore needs to be an outside-in test surface that is useful locally when an Android device exists and executable in EAS for Android and iOS without changing production semantics.

## Goals / Non-Goals

**Goals:**

- Provide a small semantic Maestro workspace with independently runnable smoke, persistence, lifecycle, Pomodoro, and notification-path flows.
- Make missing native prerequisites explicit and machine-readable instead of producing obscure command errors.
- Provide stable EAS build/workflow definitions and native QA commands that fit the existing Gate 0–6 escalation model.
- Preserve replay context, platform/build metadata, screenshots/logs, and the existing failure classifications.
- Make native-only gaps explicit, especially true notification delivery, native alerts, and offline system controls.

**Non-Goals:**

- Replacing Playwright or the simulation platform.
- Adding Appium, Detox, a new runtime dependency, or a large native test framework.
- Implementing deferred Pomodoro resume-after-process-death behavior, full native sync coverage, or product redesign.
- Making iOS a local prerequisite on non-macOS development machines.

## Decisions

1. **Use Maestro with a committed `.maestro/` workspace.** Maestro tests the built app from outside, matches the requested real-user layer, and keeps selectors close to user-visible labels. Playwright remains the deep web suite; Vitest and integration tests remain the cheaper correctness layers. Appium and Detox were rejected because they add unnecessary framework/runtime surface for the focused native scope.

2. **Use an EAS `e2e-test` profile and an explicit EAS workflow.** The profile uses an Android APK and iOS simulator build with no production credentials. The workflow is manually dispatchable or explicitly labeled so normal web PRs do not incur mobile cloud cost. A cloud job is the executable iOS path when local macOS tooling is unavailable.

3. **Use a repository runner for local preflight.** `scripts/qa-native.mjs` checks Maestro, platform tooling, a booted device/simulator, and the installed app before invoking Maestro. It emits a focused JSON report with a replay command and `ENVIRONMENT` classification for prerequisite blockers. Test failures are left for evidence-backed triage rather than auto-labeled flaky or product failures.

4. **Keep flows small and tag-based.** Each flow has one user goal and tags such as `native`, `smoke`, `persistence`, `lifecycle`, `pomodoro`, or `notifications`. Flows use semantic labels, `extendedWaitUntil`, and explicit app lifecycle commands; no arbitrary sleeps or coordinate taps are introduced.

5. **Improve real accessibility semantics where needed.** Native-only ambiguous controls receive useful labels/roles in the feature UI. Opaque test IDs are not added, and these changes remain beneficial to users and assistive technology.

6. **Quarantine the known recurring-todo performance contract gap.** The existing D14 assertion remains unchanged and the journey step receives the repository's explicit expected-failure marker naming `fix-recurring-todo-expansion-idempotency`. This keeps the contract visible while allowing the remaining journey coverage to run.

## Risks / Trade-offs

- [Risk] Maestro CLI, emulator, and EAS Maestro job availability varies by machine and service maturity → local commands perform preflight and report `ENVIRONMENT`; the EAS workflow is the supported cloud path.
- [Risk] Notification shade and background execution differ between Android and iOS simulators → the committed flow proves native permission/scheduling entry behavior; actual delivery and long-running background timing remain documented device-lane gaps until a stable platform assertion exists.
- [Risk] Native databases may persist between flows → persistence flows clear state only at their start and each flow is independently launchable; CI runs flows in isolated app state where the platform supports it.
- [Risk] EAS workflow syntax or account policy can change → validate the workflow locally with the installed EAS CLI and keep cloud execution explicit rather than claiming a local pass.
- [Risk] Native accessibility labels can become part of the user-visible contract → labels are descriptive, stable, and derived from existing visible content rather than test-only strings.

## Migration Plan

1. Add the OpenSpec contract, native workspace, accessibility labels, runner, EAS profile/workflow, impact rules, and documentation.
2. Validate YAML/JSON/scripts and run web QA plus native preflight locally.
3. On Android-capable hosts, run `npm run qa:native:android`; on macOS or EAS, run the iOS smoke flow.
4. Roll back the native layer independently by removing the EAS workflow/profile and native scripts; no application data migration is involved.

## Open Questions

- Which EAS account/worker policy will be used for scheduled native runs is intentionally left to deployment configuration; this change supplies the executable workflow but does not submit builds.
- A stable cross-platform assertion for notification delivery and system offline toggling still needs a device-lab decision.
