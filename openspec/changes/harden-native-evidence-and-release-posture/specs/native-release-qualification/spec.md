## Purpose

Extends native release qualification so that a native PASS is produced by a hermetic build whose remote configuration is recorded, proves the flow coverage it claims and the binary it actually ran, and so the Android release configuration does not hand local user data to OS-level backup or request permissions the store declarations do not cover.

## ADDED Requirements

### Requirement: The native E2E build is hermetic and self-describing

The native Android E2E build SHALL disable environment-file loading, strip ambient `EXPO_PUBLIC_*` values before building, and fail if the produced bundle contains any routable `supabase.co` host. The provenance record for a native run SHALL state the resolved Supabase endpoint, or state explicitly that no remote endpoint was configured. A native run whose remote configuration was not recorded SHALL NOT be reported as a pass.

#### Scenario: A developer environment points at production

- **WHEN** a workstation's environment file names a live Supabase project and the native lane is provisioned
- **THEN** the built APK carries no live Supabase host and the provenance record states the endpoint actually used

#### Scenario: The bundle contains a live host

- **WHEN** a post-build scan finds a routable `supabase.co` reference in the native bundle
- **THEN** provisioning fails before any flow runs

### Requirement: A native pass requires proven flow coverage

The native runner SHALL resolve an expected flow list for the requested tag, non-empty and free of duplicates, and SHALL report a pass only when the number of executed flows equals the expected count and every executed flow passed. A tag that matches no flow SHALL NOT be reported as a pass.

#### Scenario: A tag matches no flow

- **WHEN** the requested tag selects zero flows
- **THEN** the lane reports a coverage failure, not a pass

#### Scenario: A flow is dropped

- **WHEN** fewer flows execute than the expected list contains
- **THEN** the lane reports the shortfall and does not report a pass

### Requirement: A native pass records the binary it ran

A native run SHALL record whether it provisioned the build, and the SHA-256 of the installed binary when it can be obtained. A run that used an already-installed binary SHALL record that fact and the installed binary's identity, so a later reader can tell current-source evidence from an unverified install.

#### Scenario: The lane uses an already-installed build

- **WHEN** the runner is invoked without provisioning
- **THEN** the report records that it ran on an unverified installed binary and identifies that binary

#### Scenario: The lane provisions the build

- **WHEN** the runner builds and installs from the current source
- **THEN** the report records provisioning and the installed binary's SHA-256

### Requirement: Android release configuration does not expose local data to OS backup

The tracked Android configuration SHALL disable OS-level application backup and device-to-device transfer unless backup exclusion rules are declared that omit the local database and the persisted authentication store. The privacy-policy and store-data-declaration documents SHALL state the actual OS-level backup posture.

#### Scenario: A prebuild emits the manifest

- **WHEN** the Android application is generated from the tracked configuration
- **THEN** the emitted manifest does not permit OS-level backup of the application's data directory

#### Scenario: The privacy policy describes data leaving the device

- **WHEN** the privacy policy states whether data leaves the device
- **THEN** the statement is consistent with the actual OS-level backup posture

### Requirement: Declared permissions match the built manifest

The store-declaration guard SHALL observe the permissions the built application actually requests, not only the permissions declared in the application configuration. A permission present in the built manifest and absent from the declarations SHALL fail the guard, and a permission the application never uses SHALL be removed from the application's own manifest contribution.

#### Scenario: A library adds a permission

- **WHEN** a dependency change adds a permission to the merged manifest
- **THEN** the declaration guard fails until the declarations are updated

#### Scenario: The application requests an unused permission

- **WHEN** the built manifest requests a permission no code path uses
- **THEN** the permission is removed from the application's own contribution and the declarations stay truthful

### Requirement: Test-only seams cannot ship in a release build

A build profile other than the E2E test profile SHALL reject the test-only native seam environment value, and the guard SHALL run for every release-candidate profile.

#### Scenario: A release profile is built with the test seam set

- **WHEN** a non-test build profile carries the test-only seam environment value
- **THEN** the build fails loudly rather than shipping the seam

### Requirement: Release signing posture is recorded honestly

The repository SHALL record that its only executable release-build path is signed with a debug keystore, that the E2E and store builds share an application identity and version code, and that release builds are neither shrunk nor obfuscated. These SHALL be recorded as unproven release posture with an exact resume action, and SHALL NOT be described as a store-buildable artifact.

#### Scenario: A reader asks whether a store artifact exists

- **WHEN** the release documentation is consulted for a store-buildable artifact
- **THEN** it states that none exists and names the signing action required
