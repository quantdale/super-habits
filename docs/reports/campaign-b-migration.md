# Campaign B — todo ordering migration qualification

Base: `02d43088e10170d03f9db44c887227a9705f8dff`.
Scope: isolated engineering and synthetic, non-production qualification only.

## Decision

**Defer automatic repair; preserve existing ordering.** No runtime changes,
no version bump, and no edit to any historical migration. Runtime head is **25**
(`core/db/client.ts:15,1003,1042`); the next available append-only slot remains 26. Campaign A G/Q/R's suggested predicate, “head database with all live
`sort_order = 0`”, cannot distinguish interrupted migration from supported
restored ordering. Shipping that predicate would violate its own “never
overwrites authored ordering” condition.

This resolves the investigation, **not the historical ordering gap**. It does
not establish user-corpus prevalence, deployed-client safety, or production
readiness. Parent owns the campaign ExecPlan and final release decision.

## Source and history evidence

Read the complete bootstrap and ordered migration chain in `core/db/client.ts`
(2–25), not the partial reference `schema.sql`. Relevant transitions:

- `778fc9af` introduced block 6: due date, priority, sort order, unconditional
  creation-order rank, version 6. `git show 778fc9af:core/db/client.ts` shows
  older DDL error swallowing and no transaction around that original step.
- `dc051c47483e4a74ddf3db25251bfd6234e99be2` introduced block 24's missing-column
  repair. Its `addedSortOrder` predicate repairs a **missing column**, not an
  existing zero column (`core/db/client.ts:955–995`).
- `b899a871c2418353180857ed889e0c30a836be25` added block 6's column-presence
  guard but placed the sort-order ALTER **before** `applyMigration`. A failed
  inner transaction leaves version 5 with a durable zero-valued column;
  retry skips ranking, fills the other columns, and advances to head.
- `329cab413d26d42e03e75059d6686347132bddfe` moved that ALTER inside the existing
  transaction. Current `applyMigration` (`:134–143`) atomically commits DDL,
  ranking and version; block 6 (`:189–222`) prevents new instances of that
  particular window. This campaign does not rewrite either block.
- Other repairs inspected: 12 skips existing habit rule history; 14 imports
  legacy outbox rows; 18 conditionally rebuilds daily plans with count and
  active-uniqueness checks; 19 best-effort fills missing completion timestamps;
  24 backfills only when it actually adds sort order. None retains original
  block-6 attempt provenance.

A v5 client had **no persisted manual sort_order to lose**. The interrupted
upgrade fails to establish intended oldest-first initial ranks; equal zeros
then display newest-first. Later user reordering, additions, deletes and
restore can further mix the values. That differs from overwriting an existing
user-authored manual order. Comments/older reports conflating these outcomes
are not proof of original user intent.

`features/todos/todos.data.ts:95–138` sorts by completion, then sort_order ASC,
then created_at DESC. New and recurring rows allocate MAX + 1 (`:214,:281`).
`updateTodoOrder` (`:361–390`) records the explicitly supplied sequence, using
one synced mutation. `todos.domain.ts:151–179` preserves the data-layer order
in manual mode; timestamps do not encode a separate recoverable manual order.
Block 6 counts all live rows (including completed), excludes tombstones, and
assigns equal ranks for equal timestamps. Those semantics are preserved, not
silently replaced by rowid or ID tie-breaking. Todos have no archive column;
archived parent Projects and archived Habits are covered independently.

## Why zero is not a safe predicate

- `core/backup/backupValidators.ts:314–333` accepts sort_order **0**. Neither
  uniqueness nor strict positivity is required.
- `applyRemoteTodos` (`features/todos/todos.data.ts:1544–1588`) writes supplied
  ordering verbatim. Cloud Restore V1 (`core/sync/restore.coordinator.ts:585`),
  Restore V2 (`core/backup/backupRestore.ts:107,833`) and portable import
  (`core/portable/portableImport.ts:274–317`) use that same apply path.
- Historical Portable V1 files remain accepted with frozen columns
  (`core/portable/portableFormat.ts:275–285,356`); their checksummed zero values
  are valid data. A synthetic file passes the real preview/confirm importer,
  displays newest-first and remains byte-preserved across bootstrap/restart.
  Automatically ranking it oldest-first would change accepted recovery data.
- All-zero/mixed values, timestamps, updated_at equality, deleted/completed
  rows and a head schema version do not carry an authenticated reason for
  those values. Import-origin metadata alone is not historical provenance:
  a backup can carry the interrupted state too.

**Narrow transient signature:** entry version 5 + sort_order present + due_date
and priority absent strongly matches the b899 crash window. This is useful
for diagnosis of a preserved pre-upgrade copy, not a durable head predicate.
Block 6 fills those columns and commits version 6 before an appended block 26
could run. A failure at block 7 followed by retry demonstrably erases the
signature while retaining zeros. A robust pre-chain intervention/marker
protocol would need a separately reviewed durable metadata and retry design;
it is not smuggled into this tests/report-only change. Already-head databases
cannot recover that erased evidence from current rows.

## Reachability versus distribution

Read-only `gh` evidence collected; **no deployment or cloud mutation performed**.
Campaign A G's categorical “base placement was never deployed” is not verified
by the available records, and counting only GitHub's production flag is not a
complete distribution audit:

- `e6cf0d34aea03fe17c5186679b427c6838ef1af1` contains the vulnerable placement;
  `git merge-base --is-ancestor b899a871 e6cf0d34` exits 0, while the same query
  for `329cab41` exits 1. Exact file inspection confirms it.
- GitHub deployment IDs **7215671913** and **7215627335** name environments
  `Production – super-habits` and `Production – superhabits` respectively,
  dated 2026-10-21. Both have `production_environment:false` and their only
  returned status is **failure** (20128062432 / 20127953094). Thus these are
  attempted Production-named records, **not successful-serving evidence**.
- Four additional inspected Production-named records at `3477cdb1`/`89eb3714`
  (7209523036, 7209418404, 7209361791, 7209299302) also report failure; those
  commits' clients contain the same vulnerable placement.
- CI runs **39529457743** and **39670189143** on e6cf0d34 completed quality
  tests successfully but failed the dependency audit; e2e/nightly were skipped.
  They establish code/test execution, not a distributable build or installation.

No Vercel serving SHA, successful artifact installation, real user DB, or full
historical distribution inventory was available in this workstream. Failed
GitHub status does not prove Vercel never served any vulnerable source, nor
that native/off-platform users never ran it. Prevalence remains **unverified**;
source-level reachability is proven by a real-SQLite reproduction.

## Synthetic qualification

Added `tests/integration/migrationTodoOrdering.test.ts`: **16 tests**, all using
better-sqlite3 and the **actual** `getDatabase` bootstrap/migration runner via
the existing integration harness. No copied production migration runner or
shared dependency changes. Fixture coverage:

- Clean v5 → 25; completed rows, deleted rows, tied timestamps and restart.
- Valid authored v6, legitimate all-zero v6, column-present v5 authored/mixed.
- Historical autocommitted-ALTER + rolled-back inner migration → retry → 25;
  zeros honestly remain; asserted display exposes the unrepaired ordering gap.
- Current all-zero/authored/mixed/already-ranked/tied states, restored apply
  path, completed history, tombstones, archived project/habit, owner/outbox;
  whole-table snapshots unchanged after restart.
- Empty/current database; no artificial version 26.
- SQLite trigger abort at version 6 proves current DDL/rank rollback, closed
  failed initialization, retry and idempotent next restart (also covered by
  existing `migrations.test.ts`).
- Abort at version 7 proves loss of the transient v5 signature before a
  hypothetical appended repair.
- Explicit user-chosen ordering: trigger abort on second row proves first row
  and outbox roll back; retry commits selected ranks and update intents,
  leaves tombstone untouched, and survives restart.
- Historical checksummed Portable V1 preview → confirm → restart preserves zeros.

These are synthetic fixtures, **not real user-corpus or Expo/OPFS/native
power-loss certification**. The historical fixture models the verified SQL
boundary from Git; it does not dynamically execute an old checkout.

## Validation ledger and retained failures

Evidence root (external handoff sibling `evidence/`):
`C:/Users/Michael Roy/.pi/agent/sessions/--C--Users-Michael Roy-Documents-super-habits--/subagent-artifacts/outputs/731bf16c-ea06-43c2-bc76-374dfa0cabd9/b1/evidence/`.

| Exact command                                                                                                                                                                                                          | Result / evidence filename                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run qa:affected`                                                                                                                                                                                                  | PASS planner; default rule requests qa:fast → qa:full for new integration filename; `qa-affected.log`                                                                                                                                            |
| `npx vitest run --project integration tests/integration/migrationTodoOrdering.test.ts`                                                                                                                                 | Initial FAIL 13 pass / 1 fail: invalid fixture IDs; `todo-ordering-first.log`                                                                                                                                                                    |
| `npx vitest run --project integration tests/integration/migrationTodoOrdering.test.ts -t 'Portable V1'`                                                                                                                | Diagnostic FAIL 1 / 13 filtered; explicit “id is invalid”; `portable-diagnostic.log`                                                                                                                                                             |
| `npx vitest run --project integration tests/integration/migrationTodoOrdering.test.ts tests/integration/migrations.test.ts tests/integration/migrationFixtures.test.ts tests/integration/portableExportImport.test.ts` | First FAIL 35 pass / 1 fail: expected imported instead of established restored status (`focused-sqlite.log`); then PASS 36/36 (`focused-sqlite-final.log`); final expanded suite PASS **38/38, 4 files**, 16 new tests (`focused-sqlite-38.log`) |
| `npm run qa:fast`                                                                                                                                                                                                      | ENVIRONMENT FAIL exit 3 at tsc: V8 “Fatal process out of memory: Zone”; later gates did not run; `qa-fast.log`                                                                                                                                   |
| `npm run typecheck`                                                                                                                                                                                                    | PASS before and after OOM; `typecheck.log`, `typecheck-final.log`                                                                                                                                                                                |
| `npx eslint tests/integration/migrationTodoOrdering.test.ts --max-warnings 0`                                                                                                                                          | Initial unnecessary assertion fixed; final PASS, 0 errors/warnings; `focused-eslint.log`                                                                                                                                                         |
| `npx prettier --write tests/integration/migrationTodoOrdering.test.ts`                                                                                                                                                 | PASS; `prettier-final.log`                                                                                                                                                                                                                       |

Both portable failures were **TEST_BUG** in the new fixture, not product faults:
canonical createId values and the actual `restored` result contract corrected;
validation/order assertions were not weakened. qa:fast OOM was not hidden or
converted into a pass by successful standalone typecheck. Full qa:fast,
qa:full, full integration inventory and browser/native lanes remain **NOT
QUALIFIED** by this focused workstream. No runtime changed; requesting broad
qualification beyond the focused checks remains the parent's decision.

Read-only provenance replay commands:

```sh
git show b899a871 -- core/db/client.ts
git show 329cab41 -- core/db/client.ts
git show e6cf0d34:core/db/client.ts
gh api 'repos/quantdale/super-habits/deployments?sha=e6cf0d34aea03fe17c5186679b427c6838ef1af1&per_page=100'
gh api 'repos/quantdale/super-habits/deployments/7215671913/statuses?per_page=100'
gh api 'repos/quantdale/super-habits/deployments/7215627335/statuses?per_page=100'
gh run list --repo quantdale/super-habits --commit e6cf0d34aea03fe17c5186679b427c6838ef1af1 --json databaseId,headSha,name,status,conclusion,createdAt --limit 20
gh api repos/quantdale/super-habits/actions/runs/39529457743/jobs
gh api repos/quantdale/super-habits/actions/runs/39670189143/jobs
```

Saved JSON uses allowlisted metadata fields only (no tokens, logs or secrets).

## Precise opt-in alternative and next action

Do not reset db_schema_version or bulk-rank zeros. Preserve an untouched
portable export first (a historical pre-upgrade database copy, if one already
exists, is stronger diagnostic evidence). Have the user explicitly choose the
visible pending-task sequence using existing manual drag order; the UI already
calls `updateTodoOrder(orderedIds)`. That API ranks only selected non-deleted
IDs as i+1, updates timestamps and emits durable per-row update intents in one
transaction. This is a **new user decision**, not a claim to reconstruct lost
intent. Existing test proves rollback/retry. Do not silently include completed,
deleted or otherwise hidden rows in a repair.

A future dedicated “reset to creation order” tool, if desired, needs separate
approval: display the exact affected IDs and proposed order (including an
explicit tie policy), require confirmation, validate the snapshot again inside
the mutation transaction, enqueue updates, preserve a reversible before-image,
and test interruption/retry. No such product UI/API or early provenance marker
is implemented here. Independent review should accept preservation plus honest
deferral, or request that separate scoped design—not a broad all-zero migration.
