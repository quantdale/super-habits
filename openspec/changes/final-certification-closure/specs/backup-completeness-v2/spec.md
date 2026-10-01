## ADDED Requirements

### Requirement: Production Scope-7 schema and historical manifests are certified only from direct evidence

Production backup certification MUST target project `superhabits` / `kruubbynsmxzxfdunaal` only after the operator independently verifies project name, ref, API host, and database host. Repository migration files and a disposable numeric round trip MUST NOT be reported as production schema health or historical manifest health. Before any production DDL, the campaign MUST re-verify the live migration head, Gym V2 table inventory, backed-up numeric column types, and a restorable recovery point covering both `public` and `auth`. The recovery point MUST be established from a direct read-only observation of the project's own recovery inventory (for example the Management API backups listing, which reports PITR enablement, the backup set, and physical backup data) rather than inferred from project status, repository state, or the disposable project. If the live state differs from the expected missing-migration set, production DDL MUST stop. If no usable recovery point exists, production DDL MUST be classified `OWNER / INFRASTRUCTURE BLOCKED` and MUST NOT run; a directly observed empty recovery inventory is a PROVEN-ABSENT recovery point and MUST be recorded as `FAIL`, not as `unverifiable`.

A production migration dry run MUST list exactly four migrations, in this order: `20260824010000_add_gym_training_v2_backup_scope.sql`, `20260824020000_add_gym_workout_deep_expansion.sql`, `20260925125655_backup_numeric_precision.sql`, and `20260930000000_habit_completions_owner_scoped_uniqueness.sql`. The fourth migration is an independent, strictly additive owner-scoping correction on `habit_completions` with no dependency on the Gym V2 tables or on the numeric-precision conversion, so it is order-safe before or after them; it is required LAST because that preserves the repository's append-only filename order and keeps the owner-granted three-file prefix intact as a verified prefix of the dry run. Any other migration, repair migration, schema reset, or destructive surprise MUST stop the write. Production DDL MUST NOT run unless explicit approval names that project, all four migrations, the recovery point, and the verification procedure. Applying schema migrations MUST NOT authorize deletion of incident residue.

After an approved apply, the campaign MUST verify that all four versions are recorded, that `custom_exercises`, `workout_weekly_plan`, `workout_schedule_overrides`, and `body_weight_entries` exist, that targeted backed-up numeric columns are `NUMERIC` and none remains `REAL`, that `habit_completions` no longer carries the global `UNIQUE (habit_id, date_key)` constraint and does carry the owner-scoped `UNIQUE (user_id, habit_id, date_key)` index, and that RLS, owner policies, authenticated grants, indexes, and the absence of unintended anonymous grants hold. It MUST prove a fresh synthetic-owner decimal backup and empty-device Restore V2, then remove that synthetic data. Each existing owner manifest cohort MUST be recomputed and classified `HEALTHY`, `MISSING_ROWS`, `PRECISION_DRIFT`, `OTHER_CHECKSUM_MISMATCH`, or `INSUFFICIENT_EVIDENCE`. The campaign MUST NOT rewrite manifests to match rounded remote state and MUST NOT weaken Restore V2 checksum rejection. Confirmed synthetic cleanup MUST remain a separate approval boundary. Probable and ambiguous incident records MUST remain untouched.

#### Scenario: Disposable numeric proof exists

- **WHEN** a disposable project has passed a decimal backup and empty-device restore
- **THEN** that result is not recorded as production schema or historical-manifest certification

#### Scenario: Live production drift

- **WHEN** a read-only production check does not show exactly the expected four missing migrations
- **THEN** production DDL stops and the plan is redesigned from the live state

#### Scenario: Dry run contains an extra migration

- **WHEN** the linked dry run lists any migration other than the four named files in the required order
- **THEN** no production write runs

#### Scenario: Recovery point is absent

- **WHEN** the project's own recovery inventory reports PITR disabled and an empty backup set, so no restorable recovery point covers both `public` and `auth`
- **THEN** production DDL is `OWNER / INFRASTRUCTURE BLOCKED`
- **AND** the recovery gate is recorded as a PROVEN-ABSENT `FAIL`, not as `unverifiable`
- **AND** independent non-production lanes continue

#### Scenario: Historical values were already rounded

- **WHEN** an existing manifest checksum disagrees because remote `REAL` storage already rounded a value
- **THEN** the cohort is classified as precision drift or another honest mismatch
- **AND** the manifest is not rewritten and Restore V2 checksum rejection is not weakened

#### Scenario: Schema rollout is approved but cleanup is not

- **WHEN** the owner approves only an explicitly named set of schema migrations
- **THEN** schema rollout is limited to exactly that approved set under the approved recovery point
- **AND** confirmed synthetic rows are not deleted

#### Scenario: The owner approved fewer migrations than the repository now contains

- **WHEN** the approval names three migrations and the repository's dry run would list four
- **THEN** the fourth migration is treated as not yet authorized
- **AND** the missing authorization is recorded in the approval packet before any write
