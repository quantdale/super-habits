# Campaign B — cloud qualification

## Disposition and authority

**Overall: BLOCKED_EXTERNAL for hosted qualification; LOCAL_ONLY / STATIC_VERIFIED evidence below. Production remains NO-GO.**

Source base: `02d43088e10170d03f9db44c887227a9705f8dff`; writer branch `campaign/b3-cloud`. Observed 2026-10-23 using Node `v22.23.2` and Supabase CLI `2.113.0`. No cloud mutation, project activation, restore, deployment, account creation, email/OTP request, data deletion, migration apply, signing, release, push, or protection change occurred. Historical approvals do not authorize this campaign to write production. Shared junctioned `node_modules` was not installed into or edited intentionally; bounded follow-up Vitest uses `--cache=false`.

This report supplements, rather than replaces:

- [Existing schema rollout](../../openspec/changes/external-blocker-closure/production-schema-rollout.md).
- [Historical production approval packet](../../openspec/changes/final-certification-closure/production-approval-packet.md).
- [Generation rollout / rollback](../../openspec/changes/resolve-independent-repository-audit/resolution-report.md#4-backup-protocol-rollout-and-rollback).
- [Published generation requirements](../../openspec/changes/resolve-independent-repository-audit/specs/published-backup-generations/spec.md), [owner isolation](../../openspec/specs/supabase-backup-ownership/spec.md), and [recoverable accounts](../../openspec/specs/recoverable-account/spec.md).

The prior three-/four-file production approval packets and prior ACTIVE_HEALTHY observations are historical, **not current migration or availability evidence**. The parent owns the campaign ExecPlan; no competing plan was created.

## Current provider observations (read-only)

Cached CLI authentication resolved successfully, despite no exported `SUPABASE_ACCESS_TOKEN` or `~/.supabase/access-token` file. Only presence was inspected; no credential was extracted or printed. This worktree has no `.env`, `.env.local`, or linked `supabase/.temp/project-ref`. `SUPABASE_DB_PASSWORD`, `DATABASE_URL`, `PGPASSWORD`, `SUPABASE_DB_URL`, and checked disposable credentials are absent.

`node node_modules/supabase/dist/supabase.js projects list --output json` returned these allowlisted metadata fields:

| Project ref            | Name                                       | Region           | Status     | Outcome                                           |
| ---------------------- | ------------------------------------------ | ---------------- | ---------- | ------------------------------------------------- |
| `kruubbynsmxzxfdunaal` | `superhabits`                              | `ap-northeast-1` | `INACTIVE` | HOSTED_VERIFIED identity/status only              |
| `slvctfwphtpeymzghyoc` | `superhabits-disposable-202609240546-tqp3` | `us-east-1`      | `INACTIVE` | HOSTED_VERIFIED identity/status only              |
| `nsrfmpbvnjxywcizfyww` | `quantdale's Project`                      | `ap-northeast-1` | `INACTIVE` | HOSTED_VERIFIED inventory only; not a test target |

`node node_modules/supabase/dist/supabase.js backups list --project-ref kruubbynsmxzxfdunaal --output json`, reobserved at `2026-10-23T08:40:28.779Z`, returned `pitr_enabled: false`, `walg_enabled: true`, `backups: null`, empty physical-backup metadata, region `ap-northeast-1`. **Null is not an empty array and is not a verified backup count.** No current restorable `public` + `auth` recovery point is demonstrated. No restore was attempted.

| Requirement                                                                                                 | Outcome          | Boundary                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| Target identity / region / status                                                                           | HOSTED_VERIFIED  | Management metadata only                                                                 |
| Hosted migration ledger, policies/RLS, effective ACLs, definer ownership/search_path, constraints, triggers | BLOCKED_EXTERNAL | Inactive project; no authorized SQL connection available; no activation attempted        |
| Hosted PostgREST exposed schemas / runtime capabilities and Auth configuration / migrations                 | BLOCKED_EXTERNAL | Not inferred from `supabase/config.toml` or repository SQL                               |
| Proven restorable database recovery point                                                                   | BLOCKED_EXTERNAL | PITR false, backup inventory null; no restore rehearsal                                  |
| Disposable hosted A/B Auth, protection/recovery, atomic generation/race/restore tests                       | BLOCKED_EXTERNAL | Existing disposable project inactive; no active authorized disposable target/credentials |
| Fresh local PostgreSQL generation/provenance qualification                                                  | UNEXECUTED       | Commands attempted but could not start: `initdb.exe` ENOENT                              |
| Existing account/generation/restore tests                                                                   | LOCAL_ONLY       | 253 tests passed; real SQLite plus mocked remote/Auth, not hosted PostgreSQL/Auth        |
| Migration source contract                                                                                   | STATIC_VERIFIED  | Validator passed against 20 SQL files; source guards are not hosted evidence             |
| New read-only preflight runtime                                                                             | UNEXECUTED       | Source guards pass; SQL body parses; no PostgreSQL execution claimed                     |

No requirement achieved DISPOSABLE_HOST_VERIFIED. Hosted Auth email conversion, unknown-account no-create behavior, JWT refresh/restart, A/B PostgREST isolation and exact-final-client cloud round trip remain unqualified here.

## Actual SQL contract and new executable preflight

Runtime local schema remains SQLite 25. `core/db/migrations/001_initial_supabase.sql` is a reference-only profiles placeholder, **not** the Supabase deployment chain. The authoritative remote chain has 20 files under `supabase/migrations/`, through `20261020090000_enforce_backup_publication_provenance.sql`.

Two limitations prevent overclaiming reproducibility:

1. `20260810130000_add_habits_rule_history.sql` alters `public.habits` before `20260814140000_sync_schema_baseline.sql` creates it. A truly empty full-chain rehearsal needs the historically dashboard-created baseline or a separately reviewed bootstrap correction. Do not silently reorder/edit historical migrations or claim the existing qualification scripts replay all 20 files.
2. `qualify-backup-generations.mjs` applies the **three** generation migrations through `20261019162537`; `qualify-backup-provenance.mjs` applies those plus `20261020090000`. Both use synthetic `auth.users` / `auth.uid()` fixtures, not the Supabase Auth service. They complement one another; neither proves hosted Auth/PostgREST or full-chain parity.

Added [`scripts/cloud-readonly-preflight.sql`](../../scripts/cloud-readonly-preflight.sql). Run **only after** separate read-only SQL access to an independently confirmed target is available, using an operator-managed service/credential (never a password/URL in logs):

```sh
psql -X -w -v ON_ERROR_STOP=1 -f scripts/cloud-readonly-preflight.sql
node --test scripts/cloud-readonly-preflight.test.mjs
```

The SQL opens a repeatable-read **READ ONLY** transaction, sets 30-second statement / 3-second lock bounds, and rolls back. It does not invoke application RPCs, create objects or print owner IDs, snapshots, payloads, tokens or Auth users. It inventories:

- Migration and Auth ledgers when present; all 28 expected backup/synthetic/generation relations including missing tables.
- RLS/forced RLS, policy expressions, direct PUBLIC ACLs, effective role privileges, memberships, constraints, valid/ready indexes, triggers.
- All 17 precision-conversion targets, including missing/non-NUMERIC columns.
- Function identities, owner, SECURITY DEFINER, search_path settings, definition hashes and execute privileges; retired and current RPC signatures.
- Pre-provenance staging/reservation/cascading-chunk cleanup impact; head/generation/journal consistency and raw manifest/chunk SHA-256 mismatches without payload disclosure.

**Interpretation constraints:** counts are only rows visible to the inspecting role. Check `rolsuper`, `rolbypassrls`, table owner/forced-RLS and SELECT access before treating a zero as global. PostgREST connection settings may be null and do not establish hosted exposure. Hash agreement is not canonical entity/settings/graph validity or a successful restore. A partial five-table installation skips row queries but stays visibly incomplete. After provenance is applied, staging counts are historical comparison candidates, not authorization to rerun cleanup.

New `scripts/cloud-readonly-preflight.test.mjs` has six source tests, including mutation/RPC/shell/meta-command negative controls, exact 28-table scope parity and exact 17-column migration parity. These are explicitly source guards, not a SQL execution harness. SQLFluff 4.4.0 parses the SQL body with psql meta-lines removed; its parser rejects PostgreSQL transaction-mode syntax. Original parser failures are preserved; a separate body-only parse passes. The real transaction fence remains intact in the shipped script.

## Practical operator preflight / forward / recovery gates

These are preparation steps, **not authorization or execution**. Reuse the existing packets linked above, with these current-source deltas:

1. **Availability and target:** the owner must independently resolve the INACTIVE posture; activation/paid changes are outside Campaign B. Establish a separately authorized audit connection and confirm target/ref/region, current migration ledger and exact repository SHA. Never use another project because it is conveniently accessible.
2. **Recovery before DDL:** obtain a named recovery point covering both `public` and `auth` with retention, timestamp, operator and isolated restore-rehearsal evidence. A successful inventory GET, `walg_enabled`, a dump file, or this preflight is not a recovery proof. Preserve current/previous published generations and a portable source-device recovery path; no cleanup is authorized.
3. **Exact pending set:** compare the live ledger against `git ls-files supabase/migrations`. Do not assume the historical 12-applied/eight-pending hypothesis. Review checksums, prerequisites and any drift before an owner-run dry-run. A ledger mismatch, unexpected file, absent recovery point, destructive ACL or old-client exposure is NO-GO. Initial-chain bootstrap needs separate review for a genuinely fresh disposable project.
4. **Forward SQL:** use the actual committed migrations, not copied SQL. After any earlier missing prerequisites, the generation sequence is `20261018000000_add_backup_generation_protocol.sql` → `20261019000000_fix_backup_generation_publication.sql` → `20261019162537_verify_and_reserve_backup_generations.sql` → `20261020090000_enforce_backup_publication_provenance.sql`. The final file is transaction-wrapped but **not purely additive**: it retires provenance-0 reservations and unpublished/non-head generation rows, cascading their chunks. Published/journal/head history is preserved by its predicates. Measure the preflight cleanup-impact counts and review the exact predicates before any separately authorized apply. Numeric conversion cannot recover historically rounded REAL values.
5. **Qualification before production consideration:** on an active, authorized disposable target with exact-chain prerequisites, rehearse all four generation files and the final client; use two real Auth sessions A/B plus two same-owner devices. Prove denied cross-owner CRUD/upsert/reassignment/publish, Auth protection preserves UUID, no-create recovery for unknown email, empty-device-only recovery, coherent G1 restore at every interrupted G2 boundary, settings/deletes, corrupt/omitted chunks, lost acknowledgements, stale-base and simultaneous first-publication races. Exercise actual PostgREST row/body caps, decimal/Unicode checksums and retained G1/G2 restores; preserve raw failures without retry inflation. Existing fixture tests are not a substitute.
6. **Post-change read-only validation:** rerun the same preflight and compare ledgers, ACLs, definitions and invariants. Require capability **2**, publication provenance **1**, content protocol **1**, schema **2**, scope **7**, settings **5** through the real client. Restore each tested retained generation to an empty disposable SQLite device with unmodified canonical checksums, graph/settings validation and no historical side effects. Classify historical legacy manifests by actual owner-scoped validation, never by count alone.
7. **Rollback / recovery:** on failure, stop publication and preserve local captures/outbox ownership, immutable heads/chunks/journal and recovery evidence. Prefer reviewed forward repair; never downgrade capability, regrant the retired publisher, drop generation tables, rewrite stored schema versions or delete staging to hide conflicts. The final migration's committed staging deletion has no safe inverse SQL; recover needed pre-change data only from the rehearsed recovery point into an isolated environment for reviewed reconciliation. Run the same read-only preflight against that recovered environment. No destructive rollback script was introduced.

### Old-client go/no-go

- **Current client + pre-provenance remote:** NO-GO for publication. Adapter requires capability 2/provenance 1 and preserves pending local work when absent; offline use remains allowed.
- **Generation-capability-1 client + provenance remote:** NO-GO for publication. Final SQL drops one-argument reservation and four-argument public publication signatures; the renamed internal v1 publisher is revoked from PUBLIC/anon/authenticated/service_role. Unsupported clients must fail closed, not fall back.
- **Pre-generation legacy client:** may still alter legacy mutable entity tables. It cannot thereby rewrite immutable generation chunks/head, but its later legacy edits are **not automatically captured** in a newer immutable recovery point. Do not claim full multi-device sync or blanket compatibility. Coexistence plus recovery from both paths needs disposable proof.
- **New client + complete provenance remote:** conditional engineering GO only after disposable tests and final-source review. Existing captured manifests remain content protocol 1; transport capability 2 is not a content-format migration. For production, current availability, recovery and authorization blockers still mean NO-GO.

## Commands, counts and evidence

All logs are bounded command output under `simulation-output/campaign-b-cloud/` (gitignored, preserved on disk). No logs contain credential values. Important exact commands:

| Command                                                                                                     | Result / evidence file                                                                                          |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `node node_modules/supabase/dist/supabase.js --version`                                                     | PASS, 2.113.0; `provider-inventory.log`                                                                         |
| `node node_modules/supabase/dist/supabase.js projects list --output json`                                   | PASS, 3 inactive projects, allowlisted fields only; `provider-inventory.log`                                    |
| `node node_modules/supabase/dist/supabase.js backups list --project-ref kruubbynsmxzxfdunaal --output json` | PASS read-only inventory, no recovery certification; `recovery-inventory.log`, `recovery-inventory-current.log` |
| `npm run supabase:schema:validate`                                                                          | PASS, 20 migration files; `schema-validation.log`                                                               |
| `npm run backup:qualify`                                                                                    | FAIL / ENVIRONMENT, initdb ENOENT; `backup-qualification.log`; provenance part of `&&` did not execute          |
| `npm run backup:provenance:qualify`                                                                         | FAIL / ENVIRONMENT, initdb ENOENT; `provenance-qualification.log`                                               |
| `npm run qa:fast`                                                                                           | FAIL / ENVIRONMENT at TypeScript, Node native OOM, exit 3; `qa-fast.log`; remaining chain not run               |
| `npm test`                                                                                                  | FAIL / ENVIRONMENT, worker IPC channel closed, exit 1; `vitest-all.log`; no full-suite pass claimed             |
| `npm run qa:affected`                                                                                       | PASS; unmatched new tooling resolves qa:fast → qa:full; `qa-affected.log`; full gate remains unexecuted         |
| `NODE_OPTIONS=--max-old-space-size=2048 npm run typecheck`                                                  | PASS; `typecheck-bounded.log`                                                                                   |

The initial `qa:fast` and `npm test` were concurrent. Shared resource pressure included <200 MiB free disk and other campaign work. Parent subsequently stopped PG provisioning; no tools were downloaded or installed. These failures remain ENVIRONMENT evidence, not waived gates. Follow-up tests ran serially with one worker and cache disabled:

```sh
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism --cache=false tests/account.domain.test.ts tests/account.coordinator.test.ts tests/accountRemoteFingerprint.test.ts tests/accountSupabaseMock.contract.test.ts tests/accountSupabaseMock.drift.test.ts tests/supabaseAuthOptions.test.ts tests/supabaseOwnership.test.ts tests/backupGenerationSchemaGuard.test.ts tests/integration/accountOwnership.test.ts tests/integration/accountOwnershipTransition.test.ts tests/integration/accountRecoverySqlite.test.ts tests/integration/backupRestore.test.ts tests/integration/generationClientRecovery.test.ts tests/integration/publishedGenerations.test.ts
```

**PASS: 14 files / 253 tests / 0 failures**, `focused-tests.log`. These include SQLite persistence and mocked transport; no hosted qualification is implied. New preflight source-test and final lint/format/hygiene results are recorded in the final handoff artifact.

## Decision / next action

No product, migration, dependency, cloud configuration or historical approval files changed. Production remains blocked; no waiver or release authorization is implied by local green tests. The immediate safe next action is independent review of the new read-only tooling and integration of this evidence into the parent campaign plan. The next external action requires an owner-provided active authorized disposable target / safe PG17 environment, exact bootstrap provenance and a non-production rehearsal; production availability/recovery/authorization remains a separate decision boundary.
