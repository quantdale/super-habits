# Production schema rollout — owner approval packet

**Classification: `OWNER_APPROVAL_GRANTED_BUT_NOT_EXECUTABLE`. Nothing in this packet has been executed.**

Produced by OpenSpec change `final-certification-closure`, task 2.3, which requires that, absent explicit approval, the approval packet is written and the write is marked `OWNER_APPROVAL_REQUIRED` **without mutating production**. No production SQL was run. No production object was created, altered, or dropped.

## 0. Approval status as of 2026-10-01

The owner granted DDL approval on 2026-09-29, naming the project and **three** migrations. The grant is **recorded and is not executed**, for four independent reasons:

1. **No production database credential exists in this environment.** The same questionnaire answer that carried the grant also chose to leave production blocked for read-only access. `psql` returns `fe_sendauth: no password supplied`, and the Supabase CLI SQL paths require an interactive password. The Management API is reachable and authenticated, and was used below for identity and recovery-inventory observations, but it does not open a SQL session, so the catalog re-verification of task 2.1 (migration head, Gym V2 table inventory, numeric column types) still cannot be performed.
2. **The recovery point is now directly observed and proven absent** (`pitr_enabled: false`, `backups: []`, `physical_backup_data: {}`, `walg_enabled: true` — §0.1), so task 2.2's recovery gate is a proven `FAIL`, not an open question. Section 8 requires a named, proven-restorable recovery point covering `public` and `auth`; no such point exists.
3. **The grant names three migrations where the repository now contains four.** The owner approved `20260824010000`, `20260824020000`, and `20260925125655`. `20260930000000_habit_completions_owner_scoped_uniqueness.sql` was added afterwards by `harden-silent-failure-certification` and is **not yet authorized**. Section 8 requires the approval to name the exact migration set, so the grant is incomplete against this change's own terms; acceptance of the section 6 verification procedure (now including the `habit_completions` uniqueness check) was also not given.
4. **The owner's own stated precondition is unmet.** Alongside the grant, the owner recorded that DDL approval for 2.4 "waits until that live catalog and a proven `public` plus `auth` recovery point exist," and that "the 2026-09-28 hypothesis is not enough." Neither precondition is satisfied: the catalog has still not been re-read, and the recovery point is now proven to be absent rather than merely unproven.

Task 2.2 independently mandates the stop: prove a restorable `public` and `auth` recovery point and **stop DDL** on drift, a missing recovery point, or any dry-run migration other than the exact four files in order. The recovery point is proven absent, so the stop condition is active.

**What this means practically:** the grant removes authorization as the blocker for 2.4 only for the three migrations it names. The credential, the recovery point, and the fourth migration's authorization remain blockers, and they are the binding ones. To execute, supply a production credential, re-obtain an approval that names all four migrations, and obtain a proven recovery point; the first action after connecting is to prove the recovery point, not to apply DDL. If the live catalog has drifted from section 3's hypothesis, or if a dry run shows anything other than these four files in this order, stop and update this packet before any write.

## 0.1 Directly observed production posture (2026-10-01, read-only, Management API)

These are direct observations from this session, not carried-forward figures. No production object was created, altered, or dropped by either command.

| Observation                 | Command                                                    | Result                                                                                                          | Meaning                                                                                                |
| --------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Project identity            | `supabase projects list`                                   | `kruubbynsmxzxfdunaal` is named `superhabits`, region `ap-northeast-1`, status `ACTIVE_HEALTHY`, `linked: true` | Task 2.1's identity precondition holds.                                                                |
| Recovery inventory          | `supabase backups list --project-ref kruubbynsmxzxfdunaal` | `{"region":"ap-northeast-1","walg_enabled":true,"pitr_enabled":false,"backups":[],"physical_backup_data":{}}`   | **No restorable recovery point covering `public` or `auth` exists.** Task 2.2 = `FAIL`, proven absent. |
| SQL catalog re-verification | `psql -w` to the Tokyo pooler; `supabase inspect db …`     | `fe_sendauth: no password supplied`; CLI stops at `Initialising login role…`                                    | Task 2.1's catalog read is still credential-blocked; the section 3 hypothesis stays unconfirmed.       |

**2026-10-01 re-observation by `windows-closure-reconciliation` (task 5.2), at 15:08Z:** `supabase projects list` still resolves `kruubbynsmxzxfdunaal` → `superhabits`, `ACTIVE_HEALTHY`, `linked: true`, and `supabase backups list --project-ref kruubbynsmxzxfdunaal` again returned `{"region":"ap-northeast-1","walg_enabled":true,"pitr_enabled":false,"backups":[],"physical_backup_data":{}}`. The recovery point remains **proven absent at the observation**, so the DDL stop condition is still active and the historical three-file grant is still not executable authority. The SQL credential check was made once (no `SUPABASE_DB_PASSWORD` / `DATABASE_URL` / `PGPASSWORD` / `SUPABASE_DB_URL` set; repo `.env` carries only the public `EXPO_PUBLIC_*` values) and was not retried.

The recovery inventory is the authoritative answer to task 2.2's "prove or explicitly fail a restorable `public` and `auth` recovery point": the answer is **explicitly failed, proven absent**. It is recorded as `OWNER / INFRASTRUCTURE BLOCKED`, not as `unverifiable`, and it independently keeps production DDL stopped even if a credential appears tomorrow.

## 1. Why this packet exists

The predecessor campaign `external-blocker-closure` left the production Scope-7 backup-integrity gate red. This change requires that posture be established from direct evidence rather than inferred, and that any write stay behind an explicit owner approval naming the project, the exact migrations, the recovery point, and the verification procedure.

## 2. Why the read-only re-verification could not be completed here (task 2.1 / 2.2)

Task 2.1 requires a read-only re-verification of project `superhabits` / `kruubbynsmxzxfdunaal`. That re-verification did **not** happen in this session, so the 2026-09-28 hypothesis below remains an unconfirmed hypothesis and MUST NOT be treated as current production state.

What was established:

| Fact                                                                                                                                   | How it was established                     |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Project `kruubbynsmxzxfdunaal` is named `superhabits` and is the linked project                                                        | `supabase projects list`                   |
| The repo `.env` / `.env.local` `EXPO_PUBLIC_SUPABASE_URL` host is `kruubbynsmxzxfdunaal.supabase.co`                                   | read from `.env` (host only)               |
| `supabase/.temp/project-ref` is `kruubbynsmxzxfdunaal`; `supabase/.temp/pooler-url` is the Tokyo pooler                                | file read                                  |
| The IPv4 pooler `aws-1-ap-northeast-1.pooler.supabase.com:5432` **is reachable** from this host (resolves to 18.176.230.146)           | `psql` connect attempt                     |
| A direct Postgres connection is nevertheless **not possible**: `psql` returns `fe_sendauth: no password supplied`                      | `psql -w`                                  |
| The Supabase CLI's SQL paths (`supabase inspect db …`) stop at `Initialising login role…` and require an interactive database password | `supabase inspect db table-sizes --linked` |
| No Supabase MCP server is configured in this environment                                                                               | `mavis mcp list` returns `servers: []`     |

**Missing prerequisite:** the production database password (or a configured read-only SQL credential). The predecessor's note that "direct `psql` cannot resolve/reach its AAAA-only database host" is consistent: the direct host is IPv6-only, and the pooler path works but needs the password. The Management API — used for the §0.1 identity and recovery observations — is authenticated but does not open a SQL session, so it cannot read the catalog.

Consequence: task 2.1's catalog re-verification is **not complete** and is not marked complete. Task 2.2 **is** complete by explicit failure: §0.1 is the direct observation that no restorable `public`/`auth` recovery point exists. A missing credential is never reported as a pass.

## 3. The unconfirmed hypothesis (last read 2026-09-28; NOT re-queried)

- Applied migrations: 12, through `20260822000000`.
- Four repository migrations are missing: `20260824010000`, `20260824020000`, `20260925125655`, and `20260930000000` (the repository now has 16; the 2026-09-28 read predates the fourth file).
- Four Gym V2 backup tables are absent: `custom_exercises`, `workout_weekly_plan`, `workout_schedule_overrides`, `body_weight_entries`.
- Targeted numeric columns are still `REAL`.
- `habit_completions` still carries the global `UNIQUE (habit_id, date_key)` constraint, because its owner-scoping migration is the fourth missing file.
- Roughly 41 backup manifests exist.

The repository's own `scripts/validate-supabase-schema.mjs` checks the **repository SQL**, not the live database. It cannot substitute for this re-verification.

## 4. The exact four migrations, in order

| Order | File                                                                               | Bytes | Effect                                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `supabase/migrations/20260824010000_add_gym_training_v2_backup_scope.sql`          | 7,828 | Strictly additive; advances recoverable scope V5 → V6; adds Gym V2 columns and the four backup tables                                              |
| 2     | `supabase/migrations/20260824020000_add_gym_workout_deep_expansion.sql`            | 916   | Strictly additive; adds `unilateral` / `supports_external_load` and workout deep-expansion columns                                                 |
| 3     | `supabase/migrations/20260925125655_backup_numeric_precision.sql`                  | 1,820 | Converts targeted numeric columns from `REAL` to unconstrained `NUMERIC` via `USING (col::text)::numeric`                                          |
| 4     | `supabase/migrations/20260930000000_habit_completions_owner_scoped_uniqueness.sql` | 1,486 | Replaces the global `UNIQUE (habit_id, date_key)` constraint with the owner-scoped `UNIQUE (user_id, habit_id, date_key)` index in one transaction |

Order matters: migration 3 must follow both Gym V2 migrations, as its own header states. **Migration 4 is independent of migrations 1–3** — it touches only `habit_completions`, reads no Gym V2 column, and neither depends on nor is depended upon by the numeric conversion — so it is semantically order-safe before or after them. It is nevertheless required **last**, which preserves the repository's append-only filename order and keeps the owner-granted three-file prefix intact as a verified prefix of the dry run. Migration 4's authorization status is recorded in §0 and §8.

**Known and accepted consequence, stated up front:** historical values already rounded by remote `REAL` **cannot be recovered** by the `REAL` → `NUMERIC` conversion. The migration header says so explicitly. Converting the column type fixes future round-trips; it does not repair past precision. Any historical cohort needing exact values must be recaptured from an authoritative source device, which is a separate owner-scoped decision.

## 5. Recovery point (task 2.2 — proven absent, not assumed)

A **restorable** recovery point covering both `public` and `auth` must exist and be proven restorable **before** any DDL. If it cannot be proven, or if the dry run produces anything other than these four files in this order, the write stops and this packet is updated with the observed state.

**Task 2.2 is complete as an explicit failure.** The direct read-only observation in §0.1 (`supabase backups list --project-ref kruubbynsmxzxfdunaal` → `pitr_enabled: false`, `backups: []`, `physical_backup_data: {}`, `walg_enabled: true`) establishes that **no restorable recovery point covering `public` or `auth` exists**. The classification is `OWNER / INFRASTRUCTURE BLOCKED` — a proven-absent recovery point, not `unverifiable`. Production DDL therefore stays stopped regardless of credentials or authorization.

Note that the project is in Northeast Asia (Tokyo) and the direct database host is AAAA-only from some networks; a restore rehearsal would need the pooler or the Supabase dashboard. That route is moot until a recovery point exists at all: enabling PITR or a scheduled physical backup is an owner/infrastructure action, not a repository change.

## 6. Verification procedure to run after applying

1. Schema: all four migrations present in `supabase_migrations.schema_migrations`; the four Gym V2 tables exist; targeted numeric columns report `NUMERIC`, not `REAL`; `habit_completions` no longer carries `habit_completions_habit_date_unique` and does carry the owner-scoped `uq_habit_completions_owner_habit_date` unique index on `(user_id, habit_id, date_key)`.
2. RLS and grants: policies and grants unchanged in intent for every touched table; no policy widened by the conversion or by the uniqueness swap.
3. Indexes: no index silently dropped or invalidated by the `ALTER COLUMN … TYPE`; the new owner-scoped unique index is valid and ready.
4. Advisors: no new error-severity `pg_class`/`pg_statistic` findings on the altered tables.
5. Round trip: a cleaned-up synthetic decimal Restore V2 cycle (write decimals, push, wipe, restore, verify byte equality) succeeds **with checksums enabled and unmodified**. Restore V2's fail-closed checksum rejection must not be weakened to make this pass.
6. Manifest audit: each historical manifest cohort classified honestly. Manifests are **not** rewritten and checksums are **not** relaxed to force agreement.

## 7. Incident-residue cleanup is a separate gate (task 2.5)

The predecessor's 2026-09-28 read-only classification reported 482 candidate records: 135 confirmed synthetic in five exact J8 cohorts, 96 probable, 251 ambiguous. These are predecessor figures carried forward unchanged; they were NOT re-verified in this session, because the same missing credential blocks any live query, and must be re-confirmed before any deletion decision.

- Schema approval does **not** imply deletion approval. They are separate decisions.
- The 135 confirmed-synthetic records stay `OWNER_APPROVAL_REQUIRED` unless exact-target deletion approval already exists.
- The 96 probable and 251 ambiguous records are left **untouched**.
- Exact record IDs live only in a gitignored snapshot and are not reproduced here.

## 8. What an approval must contain

To unblock tasks 2.1 and 2.4, an explicit owner message must name all four:

1. the project — `superhabits` / `kruubbynsmxzxfdunaal`;
2. the migrations — exactly `20260824010000`, `20260824020000`, `20260925125655`, and `20260930000000`, in that order. **The owner's existing grant names only the first three, so `20260930000000_habit_completions_owner_scoped_uniqueness.sql` is not yet authorized**; the grant must be amended to include it before any write;
3. the recovery point — a named, proven-restorable point covering `public` and `auth`. None exists today (§0.1), so this item also requires an owner/infrastructure action (enable PITR or a physical backup) before it can be named;
4. the verification procedure — acceptance of section 6, including the decision that historical `REAL` rounding stays unrepaired unless separately approved for recapture.

A read-only SQL credential is still needed to unblock task 2.1's catalog re-verification; the Management API is authenticated but cannot read the catalog. Read-only access is **not** authorization to apply DDL.

## 9. Terminal effect on certification

Until section 8 is satisfied and section 6 passes, the production backup-integrity gate stays substantively red. Per the change's spec, a substantive unresolved recovery gate keeps the terminal state **`NOT CERTIFIED`** and `external-blocker-closure` stays unarchived, regardless of any iOS, Android, J8, or CI result.
