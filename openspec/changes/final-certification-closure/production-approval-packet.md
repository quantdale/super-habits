# Production schema rollout — owner approval packet

**Classification: `OWNER_APPROVAL_GRANTED_BUT_NOT_EXECUTABLE`. Nothing in this packet has been executed.**

Produced by OpenSpec change `final-certification-closure`, task 2.3, which requires that, absent explicit approval, the approval packet is written and the write is marked `OWNER_APPROVAL_REQUIRED` **without mutating production**. No production SQL was run. No production object was created, altered, or dropped.

## 0. Approval status as of 2026-09-29

The owner granted DDL approval, naming the project and the three migrations. The grant is **recorded and is not executed**, for three independent reasons:

1. **No production credential exists in this environment.** The same questionnaire answer that carried the grant also chose to leave production blocked for read-only access. `psql` returns `fe_sendauth: no password supplied`, the Supabase CLI SQL paths require an interactive password, and no Supabase MCP server is configured. Without a connection there is no way to apply a migration, take a recovery point, or even confirm the live catalog.
2. **The grant is incomplete against this change's own terms.** Section 8 of this packet requires an approval to name four things: the project, the three migrations, **a named proven-restorable recovery point**, and acceptance of the verification procedure. The grant names the first two. The recovery point does not exist yet and cannot be proven without the credential, and acceptance of section 6 was not given.
3. **The owner's own stated precondition is unmet.** Alongside the grant, the owner recorded that DDL approval for 2.4 "waits until that live catalog and a proven `public` plus `auth` recovery point exist," and that "the 2026-09-28 hypothesis is not enough." Neither precondition is satisfied, and this change's design (Decision 4) says the same.

Task 2.2 independently mandates the stop: prove a restorable `public` and `auth` recovery point and **stop DDL** on drift, a missing recovery point, or any dry-run migration other than the exact three files in order. The recovery point is unproven, so the stop condition is active.

**What this means practically:** the grant removes authorization as the blocker for 2.4. The credential and the recovery point remain blockers, and they are the binding ones. To execute, supply a production credential; the first action after connecting is to prove the recovery point, not to apply DDL. If the live catalog has drifted from section 3's hypothesis, or if a dry run shows anything other than these three files in this order, stop and update this packet before any write.

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

**Missing prerequisite:** the production database password (or a configured read-only Supabase MCP / management-API credential). The predecessor's note that "direct `psql` cannot resolve/reach its AAAA-only database host" is consistent: the direct host is IPv6-only, and the pooler path works but needs the password.

Consequence: tasks 2.1 and 2.2 are **not complete** and are not marked complete. A missing credential is never reported as a pass.

## 3. The unconfirmed hypothesis (last read 2026-09-28; NOT re-queried)

- Applied migrations: 12, through `20260822000000`.
- Exactly three repository migrations are missing: `20260824010000`, `20260824020000`, `20260925125655` (the repository has 15).
- Four Gym V2 backup tables are absent: `custom_exercises`, `workout_weekly_plan`, `workout_schedule_overrides`, `body_weight_entries`.
- Targeted numeric columns are still `REAL`.
- Roughly 41 backup manifests exist.

The repository's own `scripts/validate-supabase-schema.mjs` checks the **repository SQL**, not the live database. It cannot substitute for this re-verification.

## 4. The exact three migrations, in order

| Order | File                                                                      | Bytes | Effect                                                                                                    |
| ----- | ------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| 1     | `supabase/migrations/20260824010000_add_gym_training_v2_backup_scope.sql` | 7,828 | Strictly additive; advances recoverable scope V5 → V6; adds Gym V2 columns and the four backup tables     |
| 2     | `supabase/migrations/20260824020000_add_gym_workout_deep_expansion.sql`   | 916   | Strictly additive; adds `unilateral` / `supports_external_load` and workout deep-expansion columns        |
| 3     | `supabase/migrations/20260925125655_backup_numeric_precision.sql`         | 1,820 | Converts targeted numeric columns from `REAL` to unconstrained `NUMERIC` via `USING (col::text)::numeric` |

Order matters: migration 3 must follow both Gym V2 migrations, as its own header states.

**Known and accepted consequence, stated up front:** historical values already rounded by remote `REAL` **cannot be recovered** by the `REAL` → `NUMERIC` conversion. The migration header says so explicitly. Converting the column type fixes future round-trips; it does not repair past precision. Any historical cohort needing exact values must be recaptured from an authoritative source device, which is a separate owner-scoped decision.

## 5. Recovery point (task 2.2 — must be proven, not assumed)

A **restorable** recovery point covering both `public` and `auth` must exist and be proven restorable **before** any DDL. If it cannot be proven, or if the dry run produces anything other than these three files in this order, the write stops and this packet is updated with the observed state.

Note that the project is in Northeast Asia (Tokyo) and the direct database host is AAAA-only from some networks; a restore rehearsal may need the pooler or the Supabase dashboard. This is a reason to prove the recovery point early, not to proceed without it.

## 6. Verification procedure to run after applying

1. Schema: all three migrations present in `supabase_migrations.schema_migrations`; the four Gym V2 tables exist; targeted numeric columns report `NUMERIC`, not `REAL`.
2. RLS and grants: policies and grants unchanged in intent for every touched table; no policy widened by the conversion.
3. Indexes: no index silently dropped or invalidated by the `ALTER COLUMN … TYPE`.
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
2. the three migrations — exactly `20260824010000`, `20260824020000`, `20260925125655`, in that order;
3. the recovery point — a named, proven-restorable point covering `public` and `auth`;
4. the verification procedure — acceptance of section 6, including the decision that historical `REAL` rounding stays unrepaired unless separately approved for recapture.

A read-only credential is enough to unblock task 2.1 alone; it is **not** authorization to apply DDL.

## 9. Terminal effect on certification

Until section 8 is satisfied and section 6 passes, the production backup-integrity gate stays substantively red. Per the change's spec, a substantive unresolved recovery gate keeps the terminal state **`NOT CERTIFIED`** and `external-blocker-closure` stays unarchived, regardless of any iOS, Android, J8, or CI result.
