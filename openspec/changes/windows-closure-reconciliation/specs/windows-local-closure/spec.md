## Purpose

Define a bounded Windows closure campaign that reconciles canonical evidence, exhausts authorized local engineering, and publishes an honest certification posture while preserving deferred iOS and production safety gates.

## ADDED Requirements

### Requirement: The campaign preserves scope and repository ownership

The campaign MUST begin by establishing current local and remote Git identities, worktree/stash state, active OpenSpec changes, newer CI, and local work since the handoff. Git and captured execution evidence MUST override the brief's historical observations. Implementation and normal fast-forward publication MUST target current `main`; an isolated clean checkout of the same committed candidate MUST be used when required for native evidence. Foreign edits, stashes, evidence extracts, and prior change directories MUST be preserved and excluded from campaign commits. The campaign MUST NOT force-reset, force-push, rewrite history, apply unrelated stashes, restart broad hardening, or terminate unrelated processes.

#### Scenario: The handoff omits local changes

- **WHEN** preflight finds preserved evidence and additional OpenSpec directories absent from the brief
- **THEN** the campaign inventories and preserves them without absorbing them into its commits
- **AND** native cleanliness is obtained through an isolated checkout, not deletion or weakened gates

#### Scenario: Remote main has advanced

- **WHEN** actual `origin/main` differs from the observed handoff SHA
- **THEN** the campaign re-establishes the authoritative baseline and evidence applicability before editing or closing a task

### Requirement: Canonical tasks are reconciled individually

The existing 22-task `final-certification-closure` ledger MUST remain the canonical source of task disposition. Each task MUST record its actual evidence and a disposition distinguishing `COMPLETE`, `INCOMPLETE`, `BLOCKED`, `DEFERRED_BY_OWNER`, `NOT_TRIGGERED`, and `PROVEN_FAIL` as applicable. A checkbox MUST NOT imply a gate passed when it only completed an investigation or recorded a proven failure. Deferred and non-triggered tasks MUST NOT be silently checked as passed. The campaign MUST correct stale counts, candidate identities, pending-CI claims, QA deferrals, and native status in current checkpoints/reports while preserving dated historical evidence and completed predecessor tasks.

#### Scenario: Exact-head CI already passed

- **WHEN** completed required jobs belong to the current relevant pushed SHA with no superseding commit
- **THEN** task `6.2` records that exact SHA/run/jobs as complete for that candidate
- **AND** any later repository commit invalidates that candidate's final-tip attestation until new exact-head CI completes

#### Scenario: Recovery absence was already proved

- **WHEN** a checked task documents an explicitly failed recovery-point investigation
- **THEN** the task stays recorded as investigated with `PROVEN_FAIL` evidence
- **AND** neither the checkbox nor a later local pass promotes recovery to certified

### Requirement: Independent local review continues past external gates

Missing production SQL credentials, recovery infrastructure, and owner authorization MUST NOT block independent Windows Android work, repository adversarial review, or truthful closure reporting. The review MUST cover recovery/restore integrity and precision; local/remote ownership and isolation; migration chain/order/parity; durable sync/outbox attempts, terminal blocking, retry/idempotency, read-back and checkpoints; native release hermeticity/provenance/permissions; CI syntax/retry gates/skips/concurrency/quarantines; store/privacy claims; default-off AI/provider boundaries; test-only behavior; and documentation consistency. Live assertions unavailable to the reviewer MUST remain explicitly unverified, not inferred from repository tests.

#### Scenario: Catalog credentials are unavailable

- **WHEN** live production catalog inspection cannot run
- **THEN** repository-level review of all ten critical surfaces continues
- **AND** the report distinguishes validated local contracts from credential-blocked live facts

### Requirement: Executable findings are fixed and reviewed again

Every adversarial finding MUST carry direct evidence, severity, classification, affected scope, and disposition. Stale documentation MUST be distinguished from an executable defect. Each safely executable in-scope defect MUST receive a root-cause fix, meaningful regression protection, affected validation, and a second review before local engineering is declared exhausted. The campaign MUST NOT replace that work with speculative refactors, recommendation-only handoffs, deleted assertions, blind retries, or arbitrary timeout/threshold changes.

#### Scenario: Review discovers a false-green certification path

- **WHEN** a safely executable guard defect can report success without the required proof
- **THEN** the campaign repairs it, proves regression coverage rejects the defective behavior, reruns affected gates, and reviews the repair again

### Requirement: Production inspection and mutation remain separately gated

The production target MUST remain `superhabits` / `kruubbynsmxzxfdunaal`. Available authorized SQL access MUST be used read-only to establish identity, live migration head, Gym V2 tables, numeric types, owner-scoped habit-completion constraints/indexes, manifest inventory and required policy/grant posture. Missing credentials MUST remain `CREDENTIAL / EXTERNAL` with exact resume queries/actions; passwordless retry loops MUST NOT substitute for access. A recorded empty recovery inventory MUST be reported as recovery **proven absent at the observation**, not merely unknown or a pass.

Production DDL MUST remain stopped unless the live catalog is verified, a named proven-restorable recovery point covers both `public` and `auth`, explicit owner approval covers the project, exact migration set and verification procedure, and the dry run contains exactly the four named migrations `20260824010000`, `20260824020000`, `20260925125655`, `20260930000000` in that order. A fifth migration, drift, missing prerequisite, or a grant covering only three MUST stop the write. Approval for a three-file prefix MUST NOT authorize the fourth or bypass recovery. If all prerequisites later genuinely hold, only approved DDL MUST execute with schema/RLS/grant/index/advisor verification and a cleaned-up synthetic decimal restore with checksums unchanged; historical cohorts MUST be audited without rewriting manifests to force integrity.

#### Scenario: SQL credentials arrive but recovery is absent

- **WHEN** catalog access is available while no proven-restorable `public` plus `auth` point exists
- **THEN** authorized read-only inspection proceeds and production DDL stays stopped

#### Scenario: The prior grant covers only three migrations

- **WHEN** the dry-run contract requires the four-file set but approval names only its first three
- **THEN** no production DDL executes and the residual names the missing fourth-file/procedure approval and recovery prerequisites

#### Scenario: A surprise migration appears

- **WHEN** dry-run output contains another migration or a different order
- **THEN** execution stops before production mutation and the owner packet is reconciled to the observed drift

### Requirement: Incident precision and cleanup do not inherit DDL approval

The 135 confirmed-synthetic, 96 probable, and 251 ambiguous record counts MUST be labeled historical unless freshly established read-only. The campaign MUST NOT delete production records, including confirmed-synthetic records. Any future confirmed-synthetic cleanup MUST remain a separate exact-target owner action after recovery is proven; probable and ambiguous records MUST stay untouched. Already rounded historical numeric values MUST NOT be represented as repaired by a type conversion. Recapture MUST require an authoritative source device and a separate owner decision. Gap-21 policy changes, production anonymous-auth enablement, paid AI activation, signing, release tags, and store submission MUST remain separate external decisions.

#### Scenario: Schema approval exists

- **WHEN** the owner approves schema convergence
- **THEN** incident deletion and historical-value recapture remain separate gates and no probable or ambiguous records are touched

### Requirement: iOS remains explicitly deferred

Tasks `3.2` and `3.3` MUST remain `DEFERRED_BY_OWNER / ENVIRONMENT` unless the owner separately reopens iOS. The Windows campaign MUST NOT dispatch or pursue iOS certification, chase 13/13, alter iOS-specific flows, change shared iOS execution semantics to fix Android, or claim iOS certified. Existing iOS evidence and its original source/binary identities MUST be preserved as historical. iOS deferral MUST NOT stop Windows work or waive the existing iOS certification contract.

#### Scenario: Android needs a flow adjustment

- **WHEN** the smoke residual can be repaired by Android-specific behavior
- **THEN** that adjustment preserves the iOS path and its assertions without executing iOS certification

#### Scenario: The only proposed fix changes iOS semantics

- **WHEN** a candidate fix cannot respect the iOS boundary
- **THEN** the campaign leaves that portion owner-gated with an exact resume action rather than silently changing iOS

### Requirement: Final closure publication is evidence complete

The final publication MUST include current/final repository identity (starting and final SHAs, branch, remote ref, Git state and commits); actual typecheck, lint, unit, integration, fast/full QA, OpenSpec, schema and deterministic simulation evidence; final exact-head CI run/jobs/expected skips; J8 chronology and unchanged budgets; Android provisioning/flow/binary/source evidence; explicit iOS deferral; production credential/catalog/recovery/migration/approval/residue posture; an explicit production-mutation declaration; active OpenSpec inventory/task counts/archive decisions; and every residual's `WHY`, `CLASSIFICATION`, `WHAT IS REQUIRED`, and `EXACT RESUME ACTION`. Superseded/current/absent evidence MUST be distinguished. Applicable historical QA MUST name its original source and applicability, not masquerade as a fresh command. A documentation-only reconciliation left unpushed MUST NOT count as campaign publication.

#### Scenario: The current draft contains superseded claims

- **WHEN** the draft says old CI is pending, Android never ran, iOS is in progress, or full QA remains deferred despite later evidence
- **THEN** publication replaces those current claims with the verified chronology and retains useful historical events as explicitly historical

#### Scenario: A remaining lane is external

- **WHEN** closure leaves a credential, recovery, approval, infrastructure, or owner-deferred residual
- **THEN** publication includes all four residual fields and does not certify the absent execution

### Requirement: Local exhaustion and overall certification are distinct

The campaign MUST choose only a repository-native terminal classification: `COMPLETE`, `LOCALLY COMPLETE — EXTERNAL ACTIONS REQUIRED`, `BLOCKED`, or `NOT CERTIFIED`. A substantive unresolved recovery or product gate MUST keep overall certification `NOT CERTIFIED` even when authorized Windows engineering is exhausted. Neither `external-blocker-closure` nor `final-certification-closure` MUST be archived from checked-task counts or for tidiness; each archival predicate MUST be evaluated explicitly. Preserved unresolved iOS evidence MUST NOT become certified or an archival pass through deferral.

#### Scenario: All Windows work is done but recovery remains red

- **WHEN** Android, review, report, and final exact-head CI are complete while production recovery remains absent
- **THEN** the report can state Windows engineering exhausted but overall `NOT CERTIFIED`
- **AND** changes with unmet archival predicates remain active and named

### Requirement: Validation is proportional without weakening evidence

The campaign MUST use pinned Node 22.23.2 for applicable QA and follow changed-file impact. Existing valid full-run evidence MUST NOT be repeated solely for ceremony, but changes invalidating that evidence MUST trigger sufficient new gates. Hermetic test/native exports MUST refuse ambient Supabase configuration rather than leaking endpoints. Meaningful assertions, fixtures, thresholds, checksums and quarantine semantics MUST stay intact. Missing device/tooling MUST be recorded as `ENVIRONMENT`, never PASS. The final campaign MUST leave no campaign-owned web/test server behind and MUST report port hygiene.

#### Scenario: Runtime or shared QA code changes during review

- **WHEN** a fix invalidates prior full-QA applicability or changes shared QA infrastructure
- **THEN** the campaign runs the impacted broad gates and preserves any original failure artifacts before claiming local closure

#### Scenario: Ambient production environment reaches a test build

- **WHEN** exported Supabase variables would contaminate the build
- **THEN** the build refuses, variables are safely unset for the hermetic lane, and no live endpoint is shipped to certification
