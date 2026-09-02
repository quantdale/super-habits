# reliability-heavy-state-completion Specification

## Purpose

Define the Warm Momentum 2.4 contract: service-worker registration
robustness against reload races, journey-label parity guarding, and
heavy-state performance headroom reporting — reliability work that keeps
the WM2.0–2.3 product contracts intact.

## ADDED Requirements

### Requirement: Service-worker registration race robustness

The service-worker registration path (`core/pwa/registerServiceWorker.ts`)
SHALL NOT produce an unhandled rejection when
`navigator.serviceWorker.register()` resolves `undefined` (reload-during-
registration race) or when workbox-internal access to `registration.waiting`
throws; the failure SHALL be logged with its cause and the registration
SHALL be retried on the next page load; the existing update flow
(`applyServiceWorkerUpdate`, skip-waiting messaging) SHALL remain
behaviorally unchanged.

#### Scenario: Reload during registration does not crash

- **GIVEN** the PWA shell loading while a service-worker registration is in flight
- **WHEN** the page reloads before `register()` resolves and the registration resolves `undefined`
- **THEN** no unhandled promise rejection reaches the console as a crash, the failure is logged, and the next load re-attempts registration

#### Scenario: Update flow still works

- **GIVEN** a deployed shell with a bumped `CACHE_VERSION`
- **WHEN** the pwa-update E2E runs
- **THEN** the update flow completes as before (waiting worker activated via skip-waiting)

### Requirement: Journey-label parity guard

A static parity check SHALL validate that every tab label used by journey
helpers matches the app's section-rail labels, and SHALL run in the PR
quality lane (`qa:fast`-adjacent); a mismatch SHALL fail with an explicit
diff naming the helper and the app constant.

#### Scenario: Renamed tab fails the parity guard

- **GIVEN** the app rail renames a tab label
- **WHEN** journey helpers still use the old label
- **THEN** the parity script fails naming both sides before any journey lane runs

### Requirement: Heavy-state headroom reporting

The P2 heavy journey SHALL report measured-vs-ceiling headroom for each
budgeted step (cold start, section switch max, diary search) and SHALL
fail when a step's sustained headroom falls below 15% of its ceiling.

#### Scenario: Headroom drift is visible before failure

- **GIVEN** a section-switch measurement at 700ms against the 800ms ceiling
- **WHEN** the journey reports headroom
- **THEN** the report shows 12.5% headroom and the step fails the 15% floor with measured/ceiling in the message

## MOVED Requirements

None.

## REMOVED Requirements

None.
