## MODIFIED Requirements

### Requirement: Native results remain honestly classified

Native reports SHALL include platform, flow/tag, target, app identity, source SHA when available, replay command, and status. Missing iOS/Xcode or other unavailable platform capabilities MUST be reported as `ENVIRONMENT`, `EXTERNAL BLOCKER`, or `NOT RUN`, never as a passing cross-platform certification. An owner-deferred iOS lane MUST be explicitly identified as `DEFERRED_BY_OWNER` without implying execution or certification.

When a raw failure classification differs from reviewed triage, the raw artifact MUST remain immutable and the reviewed record MUST name the original label, evidence-supported replacement, rationale, reviewer disposition, and validation. Default runner classification MUST NOT override established feature/profile semantics, and a prose reclassification alone MUST NOT convert a failing flow into PASS.

#### Scenario: Windows cannot execute iOS

- **WHEN** the local host has no Xcode `xcrun`/`simctl` capability
- **THEN** the iOS lane records the external environment limitation and the Android result remains separately reportable

#### Scenario: Raw smoke classification disagrees with triage

- **WHEN** raw Android output says `PRODUCT_BUG` but source/profile/artifact review establishes a stale-selector `TEST_BUG`
- **THEN** the original artifact is preserved and reviewed triage records the evidence for the changed classification
- **AND** smoke remains failed until the meaningful complete flow passes on the qualified build

#### Scenario: iOS is deferred by the owner

- **WHEN** the owner excludes iOS from the Windows campaign
- **THEN** the report names the deferral, preserves prior iOS evidence, and makes no current iOS or cross-platform PASS claim

## ADDED Requirements

### Requirement: Android command smoke honors the ordinary-build surface

Android command smoke SHALL verify the ordinary default-off command profile without requiring a mode selector intentionally absent from that profile. It SHALL prove the Create command input, parse, review, and explicit-confirmation affordance remain usable while Ask/Auto controls and their paid-provider paths remain unavailable. A corrected selector or profile branch MUST preserve all meaningful draft/review/save-boundary assertions and MUST NOT enable AI, expose test-only controls in release, make a required step optional, or lower test budgets to manufacture success. Android-specific adaptation MUST preserve the existing iOS command path and its assertions.

#### Scenario: An ordinary Android build opens Command center

- **WHEN** the user opens advanced capture without an AI rollout flag
- **THEN** smoke verifies the Create input and parse/review/confirmation boundary without tapping a hidden mode chip
- **AND** absence of Ask/Auto remains enforced without a paid-provider request

#### Scenario: Android correction is applied to a shared flow

- **WHEN** a profile-aware Android branch replaces interaction with an intentionally absent selector
- **THEN** the iOS command sequence and assertions remain semantically unchanged and no iOS certification is inferred

### Requirement: Final Android qualification proves source binary and complete coverage

A final Android certification claim SHALL name the exact committed candidate source SHA, clean checkout state, selected target/AVD/serial, API/ABI, package/version, installed APK hash, build profile, hermetic remote configuration, bundle-scan outcome, and complete expected/executed flow sets with per-flow results. Provisioning, smoke, persistence, and lifecycle SHALL qualify the candidate, not an ancestor APK. A zero-flow selection, missing debug coverage, hash/source mismatch, nonzero flow exit, or unprovisioned replay MUST NOT count as current-source PASS. Any unavoidable failure SHALL remain precisely classified with preserved artifacts and an exact resume action.

#### Scenario: Historical persistence and lifecycle are green

- **WHEN** an earlier source has persistence/lifecycle passes but the final candidate has changed
- **THEN** those passes remain historical and the candidate is qualified on a matching current-source hermetic build

#### Scenario: A selected smoke flow fails

- **WHEN** the expected flow set executes but any required flow fails
- **THEN** the lane stays failed with its original artifact and does not become PASS from matching coverage alone

#### Scenario: Target infrastructure is unavailable

- **WHEN** a clean candidate checkout cannot provision or run the supported target
- **THEN** qualification records `ENVIRONMENT` with the missing dependency and replay command rather than reusing an old APK as a pass
