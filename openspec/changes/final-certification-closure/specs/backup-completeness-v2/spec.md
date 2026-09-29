## ADDED Requirements

### Requirement: Production Scope-7 schema and historical manifests are certified only from direct evidence

Production backup certification MUST target project `superhabits` / `kruubbynsmxzxfdunaal` only after the operator independently verifies project name, ref, API host, and database host. Repository migration files and a disposable numeric round trip MUST NOT be reported as production schema health or historical manifest health. Before any production DDL, the campaign MUST re-verify the live migration head, Gym V2 table inventory, backed-up numeric column types, and a restorable recovery point covering both `public` and `auth`. If the live state differs from the expected missing-migration set, production DDL MUST stop. If no usable recovery point exists, production DDL MUST be classified `OWNER / INFRASTRUCTURE BLOCKED` and MUST NOT run.

A production migration dry run MUST list exactly `20260824010000_add_gym_training_v2_backup_scope.sql`, `20260824020000_add_gym_workout_deep_expansion.sql`, and `20260925125655_backup_numeric_precision.sql`, in that order. Any other migration, repair migration, schema reset, or destructive surprise MUST stop the write. Production DDL MUST NOT run unless explicit approval names that project, those three migrations, the recovery point, and the verification procedure. Applying schema migrations MUST NOT authorize deletion of incident residue.

After an approved apply, the campaign MUST verify that all three versions are recorded, that `custom_exercises`, `workout_weekly_plan`, `workout_schedule_overrides`, and `body_weight_entries` exist, that targeted backed-up numeric columns are `NUMERIC` and none remains `REAL`, and that RLS, owner policies, authenticated grants, indexes, and the absence of unintended anonymous grants hold. It MUST prove a fresh synthetic-owner decimal backup and empty-device Restore V2, then remove that synthetic data. Each existing owner manifest cohort MUST be recomputed and classified `HEALTHY`, `MISSING_ROWS`, `PRECISION_DRIFT`, `OTHER_CHECKSUM_MISMATCH`, or `INSUFFICIENT_EVIDENCE`. The campaign MUST NOT rewrite manifests to match rounded remote state and MUST NOT weaken Restore V2 checksum rejection. Confirmed synthetic cleanup MUST remain a separate approval boundary. Probable and ambiguous incident records MUST remain untouched.

#### Scenario: Disposable numeric proof exists

- **WHEN** a disposable project has passed a decimal backup and empty-device restore
- **THEN** that result is not recorded as production schema or historical-manifest certification

#### Scenario: Live production drift

- **WHEN** a read-only production check does not show exactly the expected three missing migrations
- **THEN** production DDL stops and the plan is redesigned from the live state

#### Scenario: Dry run contains an extra migration

- **WHEN** the linked dry run lists any migration other than the three named files in the required order
- **THEN** no production write runs

#### Scenario: Recovery point is absent

- **WHEN** no restorable recovery point covers both `public` and `auth`
- **THEN** production DDL is `OWNER / INFRASTRUCTURE BLOCKED`
- **AND** independent non-production lanes continue

#### Scenario: Historical values were already rounded

- **WHEN** an existing manifest checksum disagrees because remote `REAL` storage already rounded a value
- **THEN** the cohort is classified as precision drift or another honest mismatch
- **AND** the manifest is not rewritten and Restore V2 checksum rejection is not weakened

#### Scenario: Schema rollout is approved but cleanup is not

- **WHEN** the owner approves only the three schema migrations
- **THEN** schema rollout is limited to those three migrations under the approved recovery point
- **AND** confirmed synthetic rows are not deleted
