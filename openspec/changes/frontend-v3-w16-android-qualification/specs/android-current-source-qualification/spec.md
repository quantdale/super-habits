## Purpose

Defines how an Android native result is proven for Frontend V3 W16: the
exact-source provenance contract, the executed flow matrix, the platform-specific
UX checks, and the rule that an unavailable capability is classified rather than
reported as a pass. Existing behavioural capabilities keep their contracts.

## ADDED Requirements

### Requirement: Native evidence is tied to the exact source revision

A native result SHALL record the source revision of the build that produced it,
and SHALL NOT be reported against a revision other than the one installed on the
target device.

#### Scenario: A mismatched target is refused

- **WHEN** the connected device does not report the required API level and ABI
- **THEN** the lane reports an external/environment blocker instead of a result
- **AND** no pass is recorded for that target

#### Scenario: A stale installed build is refused

- **GIVEN** a device holding an APK built from an older revision
- **WHEN** the qualification lane runs against the current source
- **THEN** the lane refuses to certify and names the mismatch
- **AND** the affected flows are re-run only after the current revision is rebuilt and installed

### Requirement: The qualified build is credential-free and attributable

The installed build SHALL be a test-equivalent, credential-free artifact, and its
identity (application id, version, APK SHA-256) SHALL be recorded alongside the
source revision.

#### Scenario: The bundle carries no remote credentials

- **WHEN** the qualification APK is produced
- **THEN** the bundle scan finds no configured remote host
- **AND** the provenance record names the build kind and any test-only flag

### Requirement: The mandatory native matrix is executed

The qualification SHALL execute, on the verified target: cold launch, all six
primary destinations, the capture affordance, a modal, a keyboard form, Settings
open/close, and persistence across process kill/relaunch.

#### Scenario: Every required surface is exercised

- **WHEN** the lanes complete
- **THEN** each of the required surfaces appears in at least one executed flow
- **AND** each lane reports its flow count and every flow result individually

#### Scenario: Lifecycle persistence is proven by restart

- **GIVEN** data created through a flow
- **WHEN** the app is terminated and relaunched
- **THEN** the same flow re-reads the persisted value from device storage
- **AND** the flow fails if the value is absent

### Requirement: Native UX defects are fixed at the owning surface

A reproduced native-only defect SHALL be fixed at the surface that owns it, and
the fix SHALL be re-verified on a freshly built exact-source APK.

#### Scenario: A clipped label is repaired and re-measured

- **GIVEN** a label clipped only on the device
- **WHEN** the fix lands
- **THEN** a new exact-source APK is built and installed
- **AND** the affected flow or a fresh capture shows the label fully rendered
- **AND** the web behaviour and accessible name are unchanged

### Requirement: Test-flow defects are never resolved by weakening the product contract

A failing native flow whose cause is stale or incorrect test expectations SHALL
be corrected in the flow, using a currently-rendered unique marker, and SHALL NOT
be resolved by removing the assertion, relaxing it, or changing the product to
match the stale test.

#### Scenario: A stale marker is replaced, not deleted

- **GIVEN** a flow asserting copy that a later wave removed
- **WHEN** the flow is corrected
- **THEN** the replacement is a currently-rendered, unique marker
- **AND** the surrounding assertions and any durable oracle are retained or strengthened

### Requirement: Unavailable capabilities are classified, not fabricated

A platform capability that cannot be exercised in the environment SHALL be
recorded as an external blocker or a known gap with the required condition, and
SHALL NOT be reported as passing.

#### Scenario: An unprovisioned platform stays unclaimed

- **WHEN** iOS or a cloud device lane is not provisioned
- **THEN** no iOS or cloud result is claimed
- **AND** the residual is recorded with what would be required to run it
