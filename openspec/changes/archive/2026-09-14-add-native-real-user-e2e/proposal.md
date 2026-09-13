## Why

SuperHabits now has a substantial web QA loop, but browser automation cannot prove native lifecycle, notification permission, native persistence, or platform accessibility behavior. A small, real-device native layer is needed so autonomous agents can validate the native surfaces that are otherwise unobserved.

## What Changes

- Add a focused Maestro workspace for semantic Android/iOS smoke, persistence, lifecycle, Pomodoro, and notification-path flows.
- Add a deterministic native preflight/runner command that reports missing tools, devices, builds, and native failures using the existing QA classification vocabulary.
- Add an EAS `e2e-test` build profile and a manually or explicitly labeled native E2E workflow, without making ordinary web PRs wait for cloud mobile infrastructure.
- Add native gate and feature-impact mappings, replay/artifact guidance, and authoritative agent instructions.
- Improve accessibility semantics only where native automation exposes a meaningful user-facing control that is otherwise ambiguous.
- Keep notification delivery, true background timing, native Alert behavior, offline system toggling, and unavailable local platforms explicit as capability gaps when the current harness cannot prove them.
- Preserve the existing recurring-todo performance assertion as an explicit quarantined contract gap tied to `fix-recurring-todo-expansion-idempotency`; do not change its threshold.

## Capabilities

### New Capabilities

- `native-real-user-e2e`: Focused, semantic Maestro flows and reproducible native failure handling for Android/iOS builds.

### Modified Capabilities

- `user-simulation-testing`: Extend the autonomous QA escalation model and known-gap register to include native gates and native-only lifecycle/notification coverage.

## Impact

Affected areas include `.maestro/`, `scripts/qa-native.mjs`, `eas.json`, `app.json`, `.eas/workflows/`, `package.json`, `qa/impact-map.json`, native-accessibility labels in feature screens, CI/agent/testing documentation, and the existing journey quarantine helper. No new runtime dependency or production feature behavior is required.
