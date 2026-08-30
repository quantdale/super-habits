# Account Recovery CI — Closure Audit Remediation Spec Delta

## Purpose

This delta remediates post-closure gaps in `fix-account-recovery-dist-sync-determinism`. It preserves that change's successful full-backup-scope routing fix while requiring the deterministic boundary to model non-empty owner footprints correctly and requiring durable closure state to match real validation evidence.

## ADDED Requirements

### Requirement: Production-shape footprint probes honor configured counts

The shared deterministic Supabase account/recovery boundary SHALL apply configured backup footprint counts to the exact request shape used by production `AccountCoordinator.getRemoteFingerprint()`: owner-scoped `HEAD` requests with `select=user_id` and exact-count semantics.

The boundary SHALL NOT hardcode zero for this request when deterministic state configures a non-zero count.

#### Scenario: Configured non-zero footprint is exposed

- **GIVEN** backup entity E is configured with count N > 0 for temporary account T,
- **WHEN** the coordinator issues `HEAD /rest/v1/E?select=user_id&user_id=eq.T` with exact-count semantics,
- **THEN** the deterministic boundary returns a successful response whose exposed `content-range` reports N.

#### Scenario: Default footprint remains empty

- **GIVEN** no remote footprint is configured for account T and entity E,
- **WHEN** the same production-shape probe runs,
- **THEN** the deterministic response reports count zero.

### Requirement: Footprint configuration is owner-scoped

A footprint configured for one authenticated/temporary owner SHALL NOT be implicitly applied to another owner when the request carries an explicit `user_id=eq.<uid>` filter.

#### Scenario: Temporary account data does not leak to source owner

- **GIVEN** entity `weekly_reviews` has count 1 for temporary owner T and no configured count for source owner A,
- **WHEN** the boundary receives otherwise identical owner-scoped probes for T and A,
- **THEN** T reports 1 and A reports 0.

### Requirement: Dist-sync proves non-empty temporary-account blocking

The portable imported-owner recovery E2E coverage SHALL include a deterministic negative scenario where the destination temporary anonymous account already owns remote backup state in a current production backup entity.

The scenario SHALL execute against normal production account/recovery logic and the shared backup-aware boundary.

#### Scenario: Weekly Review remote state blocks temporary-account replacement

- **GIVEN** an owner-backed portable dataset from source account A has been imported on a destination using temporary anonymous account T,
- **AND** T has a non-zero remote footprint in `weekly_reviews`,
- **WHEN** the user attempts the explicit matching-source-account recovery flow,
- **THEN** production safety detects T's remote backup state and blocks replacing T with A,
- **AND** the imported local dataset remains unchanged and is not rebound to A,
- **AND** the failure is not caused by an accidental 404, timeout, skip, or mock-only interception.

### Requirement: Existing successful account journeys remain intact

The remediation SHALL preserve the existing deterministic matching-account, wrong-account, session-loss, protection, restore, and first-write ownership journeys.

#### Scenario: Empty temporary account still recovers

- **GIVEN** temporary account T has zero remote footprint across the complete production backup scope,
- **WHEN** matching source account A completes imported-owner recovery,
- **THEN** the existing successful bind/recovery behavior remains unchanged.

#### Scenario: Wrong account still fails closed

- **WHEN** nonmatching account B attempts to claim A's imported dataset,
- **THEN** the existing owner-fingerprint/verified-account mismatch behavior remains fail-closed and local data remains untouched.

### Requirement: Shared boundary remains complete and strict

The remediation SHALL keep the existing exact drift guard against `BACKUP_ENTITIES + BACKUP_SYNTHETIC_ENTITIES`, including `weekly_reviews`, `user_backup_settings`, and `backup_manifest`.

Unknown/unmodeled Supabase REST endpoints SHALL continue to fail visibly rather than receiving blanket success responses.

#### Scenario: Future backup scope still cannot drift silently

- **WHEN** production backup scope changes,
- **THEN** the exact drift guard still fails unless the shared deterministic boundary is updated or derives the new entity automatically.

## MODIFIED Requirements

### Requirement: Known backup footprint probes model Supabase count semantics

The prior requirement is clarified: deterministic per-entity/per-owner count configuration MUST apply to the `select=user_id` HEAD footprint branch itself, because that is the request production uses to decide whether an account can be replaced. Supporting non-zero counts only in a different generic HEAD/read branch does not satisfy the requirement.

#### Scenario: Non-empty temporary account footprint

- **GIVEN** temporary account T has a configured non-zero count in any one production backup entity,
- **WHEN** imported-owner recovery checks T before switching accounts,
- **THEN** the production-shaped footprint query reports remote data and the account switch is blocked according to production safety semantics.

### Requirement: Closure records match actual evidence

The prior closure's task checklist and ExecPlan SHALL be reconciled after this audit. Checked state SHALL mean the requirement/command was actually satisfied, not merely that a related group was believed complete.

#### Scenario: Previously unchecked QA commands

- **GIVEN** the prior task file left named full-QA commands unchecked while its ExecPlan claimed full QA complete,
- **WHEN** this remediation closes,
- **THEN** those commands have either been executed and recorded or the task text has been explicitly updated to an evidence-backed current equivalent; no silent checkbox promotion is allowed.

#### Scenario: Historical final-SHA statement

- **GIVEN** the prior ExecPlan calls `8b1a1e3...` the final repository SHA even though `main` later advanced to `684dae9...`,
- **WHEN** historical records are reconciled,
- **THEN** valid CI evidence for `8b1a1e3...` is preserved but it is no longer described as the final repository head after the later commit.

### Requirement: Exact-final-SHA CI is externally verified without a bookkeeping loop

The final accepted repository SHA SHALL itself have GitHub Actions `quality = PASS` and `e2e = PASS`, including dist-sync.

The final session SHALL NOT create an additional bookkeeping commit after that green run merely to record the run ID, because doing so would create a new unverified SHA. The final report may carry the exact run ID as external evidence.

#### Scenario: Completion commit is pushed

- **WHEN** the final completion commit is pushed,
- **THEN** the session remains active until GitHub Actions for that exact SHA finishes,
- **AND** READY is reported only if both required jobs are green.

#### Scenario: Completion commit CI is red

- **WHEN** the exact completion SHA is red,
- **THEN** the task is reopened/continued in a corrective commit and no READY claim is made.

### Requirement: Production fail-closed semantics remain unchanged

This remediation SHALL fix the deterministic test model, not weaken production account safety.

#### Scenario: Genuine remote evidence failure

- **WHEN** remote ownership evidence is genuinely unavailable,
- **THEN** production continues to fail closed and no account switch/unsafe owner binding occurs.
