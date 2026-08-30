# native-release-qualification Specification

## Purpose

Define repeatable, honestly classified Android E2E provisioning and native Gym
V2 persistence/recovery qualification for the current source tree.

## Requirements

### Requirement: Android E2E provisioning is repeatable

On an Android-capable workstation, the repository SHALL provide a documented
one-command or near-one-command path that preflights the SDK, JDK, ADB target,
and E2E build configuration; builds the credential-free `e2e-test` equivalent;
installs it on the selected booted x86_64 API-36 target; and emits actionable
diagnostics when any prerequisite or build/install step fails.

#### Scenario: No APK is installed but the toolchain is usable

- **WHEN** the native QA command finds a valid booted target but no installed
  SuperHabits E2E package
- **THEN** it builds the test APK, installs it, verifies the package is
  available, and proceeds to the requested native lane

#### Scenario: A prerequisite or build step fails

- **WHEN** the SDK, target identity, native build, or install step cannot be
  completed
- **THEN** the command exits non-zero, reports the failing prerequisite and
  replayable command, and classifies the lane as `ENVIRONMENT` or the applicable
  failure class rather than reporting PASS

### Requirement: Installed build identity is checked

Before executing native flows, the runner SHALL verify that the installed app
has the expected E2E package/application identity, a readable version/build
identity, and provenance tied to the current source checkout. Production
secrets and production release credentials MUST NOT be required for the local
lane.

#### Scenario: Stale or wrong package is installed

- **WHEN** ADB resolves a package or build that does not match the requested
  E2E identity
- **THEN** the runner refuses to run product flows, reports the observed and
  expected identity, and leaves a replay command for rebuilding/installing the
  current source

### Requirement: Native Gym V2 persistence is covered semantically

The focused native layer SHALL prove that a user can create a Gym V2 routine
using built-in or custom exercise identity and typed prescription metadata,
terminate/relaunch the app, and observe the same user-visible routine and
schedule state. Flows MUST use semantic selectors and state-based waits.

#### Scenario: Typed routine survives relaunch

- **WHEN** a user creates or edits a typed Gym V2 routine and terminates the
  E2E app
- **THEN** relaunching the app shows the routine, exercise identity, typed
  prescription, and any persisted weekly/scheduled state without coordinate-only
  app interaction

### Requirement: Native durable-session recovery is covered

The focused native layer SHALL prove, where the platform supports the
operation, that a Gym V2 session draft with a typed measurement survives an
interrupt or process termination and can be resumed without fabricating or
silently losing the measurement.

#### Scenario: Interrupted typed session resumes

- **WHEN** a user starts a Gym V2 guided session, enters a typed measurement,
  and backgrounds or terminates the app before completion
- **THEN** relaunching and resuming the session exposes the same draft and
  measurement, and a completed session appears in history/progress only after
  an explicit completion action

### Requirement: Native results remain honestly classified

Native reports SHALL include platform, flow/tag, target, app identity, source
SHA when available, replay command, and status. Missing iOS/Xcode or other
unavailable platform capabilities MUST be reported as `ENVIRONMENT`, `EXTERNAL
BLOCKER`, or `NOT RUN`, never as a passing cross-platform certification.

#### Scenario: Windows cannot execute iOS

- **WHEN** the local host has no Xcode `xcrun`/`simctl` capability
- **THEN** the iOS lane records the external environment limitation and the
  Android result remains separately reportable
