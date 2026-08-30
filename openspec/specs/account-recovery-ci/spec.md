# account-recovery-ci Specification

## Purpose

Define the deterministic account/recovery remote-footprint test boundary:
known backup entities receive realistic owner-scoped responses while unknown
REST endpoints remain strict.

## Requirements

### Requirement: Dist-sync account boundary covers the complete backup scope

The deterministic Supabase boundary used by account/recovery `journeys-sync` tests SHALL recognize every remote entity in the authoritative production backup contract: all entries in `BACKUP_ENTITIES` plus all entries in `BACKUP_SYNTHETIC_ENTITIES`.

The boundary SHALL NOT maintain an unguarded historical subset of backup tables.

#### Scenario: Every current backup entity is recognized

- **GIVEN** the current production backup contract,
- **WHEN** the Account Coordinator performs an owner-scoped remote-footprint probe for any `BACKUP_ENTITIES` entry,
- **THEN** the dist-sync boundary handles the request using deterministic configured backup behavior rather than returning an accidental 404.

#### Scenario: Weekly Review backup state is recognized

- **GIVEN** `weekly_reviews` is part of `BACKUP_ENTITIES`,
- **WHEN** account protection or recovery probes `weekly_reviews`,
- **THEN** the test boundary returns a valid deterministic footprint response and the probe is included in ownership-safety coverage.

#### Scenario: Synthetic backup records are recognized

- **WHEN** account safety probes `user_backup_settings` or `backup_manifest`,
- **THEN** the dist-sync boundary recognizes both records as meaningful backup-scope endpoints and responds according to configured footprint state.

### Requirement: Backup-scope drift is detected automatically

The test architecture SHALL make production backup-scope additions visible to account/recovery tests without relying on a developer remembering to update multiple journey-local regexes.

The preferred implementation SHALL derive the recognized entity set from production constants. If direct derivation is not technically viable, an explicit drift-guard test SHALL compare the centralized E2E entity set exactly with `BACKUP_ENTITIES + BACKUP_SYNTHETIC_ENTITIES`.

#### Scenario: A future backup entity is added

- **WHEN** a future change adds an entity to the authoritative production backup contract,
- **THEN** either the shared E2E boundary recognizes it automatically or a deterministic drift-guard test fails with an actionable mismatch before account journeys silently return 404 for it.

### Requirement: Known backup footprint probes model Supabase count semantics

The deterministic boundary SHALL model the request/response semantics actually used by the installed Supabase client for owner-scoped footprint queries, including exact count/head behavior and required PostgREST headers.

#### Scenario: Empty temporary account footprint

- **GIVEN** temporary account T has no configured rows in any backup entity,
- **WHEN** the coordinator probes every backup entity for T,
- **THEN** every probe deterministically resolves to count zero and imported-owner recovery may proceed if all other safety conditions are satisfied.

#### Scenario: Non-empty temporary account footprint

- **GIVEN** temporary account T has a configured non-zero count in any one production backup entity,
- **WHEN** imported-owner recovery checks T before switching accounts,
- **THEN** the footprint check reports remote data and the account switch is blocked according to production safety semantics.

### Requirement: Unexpected Supabase REST endpoints fail loudly

The shared deterministic boundary SHALL NOT become a blanket success responder for arbitrary Supabase REST endpoints.

#### Scenario: Unknown REST table is requested

- **WHEN** application code requests an unmodeled `/rest/v1/<unknown>` endpoint that is not part of the known test contract,
- **THEN** the test boundary fails visibly or returns an explicit unexpected-endpoint response so the new dependency cannot be silently ignored.

### Requirement: Journey-specific behavior remains explicit

Generic backup-footprint handling SHALL be shared, while journey-specific auth identities, OTP outcomes, custom backup rows, and push-capture behavior SHALL remain explicit and deterministic.

#### Scenario: Recoverable Account Todo restore row

- **GIVEN** Recoverable Account V1 needs one owner-scoped Todo backup row to validate restore behavior,
- **WHEN** the shared boundary handles generic backup probes,
- **THEN** the journey can still configure the Todo-specific row response without changing behavior for unrelated backup entities.

#### Scenario: First synced write ownership is captured

- **WHEN** a Recoverable Account journey POSTs a synced row,
- **THEN** the journey can capture the posted owner ID and assert correct ownership while still using the shared backup endpoint contract.

### Requirement: Account protection is deterministic in dist-sync

The account-protection journey SHALL reach the protected state from a valid anonymous owner + valid OTP without failures caused by missing backup endpoint mocks.

#### Scenario: Anonymous owner is protected

- **GIVEN** a valid anonymous owner, valid email-protection request, UUID-preserving verification, and deterministic empty/valid remote ownership evidence,
- **WHEN** the user enters the valid OTP,
- **THEN** the account becomes `Protected` and the assertion passes on the first attempt without depending on Playwright retry recovery.

### Requirement: Imported-owner recovery is deterministic in dist-sync

Both matching-account and wrong-account portable owner recovery SHALL execute against the complete backup-aware boundary.

#### Scenario: Matching account binds imported dataset

- **GIVEN** a valid owner-backed portable file from account A, a fresh destination temporary account T with an empty remote backup footprint, and a verified recovery session for A,
- **WHEN** the user completes source-account recovery,
- **THEN** `Sign-in pending` and subsequent `Protected` states are reached deterministically, the imported dataset binds to A, and cloud completeness is not falsely claimed.

#### Scenario: Wrong account cannot bind imported dataset

- **GIVEN** the same imported dataset from A,
- **WHEN** account B completes OTP verification,
- **THEN** B is rejected/signed out according to production behavior, A's imported data remains untouched, and the journey passes without test-boundary 404s.

### Requirement: Production fail-closed semantics are preserved

The closure SHALL NOT change production account logic to ignore missing or failed remote evidence merely to make E2E pass.

#### Scenario: Remote footprint evidence is genuinely unavailable

- **WHEN** the configured remote evidence dependency genuinely fails,
- **THEN** the Account Coordinator continues to fail closed with the existing safe result, and no account switch or unsafe owner binding occurs.

### Requirement: Retry, timeout, skip, and quarantine are not root fixes

The closure SHALL repair the deterministic boundary contract rather than masking the defect.

#### Scenario: Closure implementation is reviewed

- **WHEN** the affected account/recovery tests become green,
- **THEN** the change SHALL be attributable to correct endpoint modeling/state control, not solely to increased assertion timeouts, additional retries, `test.skip`, `test.fixme`, quarantine, or weakened assertions.

### Requirement: Weekly Review completion record reflects actual CI history

The persisted Weekly Review ExecPlan SHALL not state that the exact final SHA had green CI when GitHub Actions run `32024054019` on `36f01f881248252d1b675714d9c963eafe4f1303` concluded failure in the dist-sync portion of the `e2e` job.

#### Scenario: Weekly Review plan is reconciled

- **WHEN** this closure updates project state,
- **THEN** the Weekly Review plan preserves its valid implementation/quality/main-E2E evidence, records the inherited dist-sync closure accurately, and points to this change without rewriting the red exact-SHA run as green.

### Requirement: Exact-final-SHA CI is the closure gate

This change SHALL not be considered complete until the exact final pushed `main` SHA has both GitHub Actions `quality` and `e2e` jobs completed successfully, including the remote-boundary dist-sync journey step.

#### Scenario: Prior implementation SHA is green but final SHA is red or pending

- **WHEN** an earlier commit is green but the current final `main` SHA is red or pending,
- **THEN** the ExecPlan remains incomplete and the session continues rather than reporting READY.

#### Scenario: Final closure succeeds

- **WHEN** all local validation is green and the exact final `main` SHA has `quality = PASS` and `e2e = PASS`,
- **THEN** the closure may be marked complete after verifying clean working tree, `main == origin/main`, and remote main-only state.
