# ExecPlan: backup-canonical-columns-guard-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Pin the backup canonical-column contract (`BACKUP_ENTITY_COLUMNS` in
`core/backup/backup.types.ts`) to the real migrated SQLite schema, so a
future migration that adds (or renames) a column without updating the
canonical list fails locally instead of silently excluding new user data
from checksums, backfill, checkpoint manifests, and restore verification.

## Context

- Repo `/home/box/Desktop/super-habits`, branch `main`, clean tree at
  `bd64e27` (quarantine-register-parity-v1 COMPLETED). Pinned Node
  `v22.23.2` on PATH (fnm); default shell Node 20 segfaults better-sqlite3
  (known-gaps E1 — do not redo).
- All contract gaps CG-1..CG-9 are CLOSED; remaining skips are lane
  attributes (known-gaps entries 8/9/10-13/20, Sunday calendar 14, host-load
  flake class 15). Overlay a11y saturated; J8 evidence-only closed (do not
  reopen); store repo-side guards done (remaining items are `[OWNER ACTION]`s
  or external blockers: billing-blocked CI, EAS submit, push, v1.0.0 tag).
- Backup inventory coherence at *entity* level is already guarded by
  `tests/backupInventoryCoherence.test.ts` (restore importers, sync adapter
  entities, emptiness-gate tables, soft/hard/never delete partition — all
  pinned to `BACKUP_ENTITIES`). Column-level drift is the remaining
  unguarded seam in that family: nothing compares `BACKUP_ENTITY_COLUMNS`
  to `PRAGMA table_info(<entity>)` on a real migrated DB (verified
  2026-09-19: no test references both; `grep PRAGMA` hits are
  soft-delete/migration/constraint tests, never the canonical map).
- Empirical survey 2026-09-19 (temporary integration spec, reverted):
  live column *sets* equal canonical *sets* for all 21 entities today
  (`DIFF_START {}`), so this is a guard-only increment with no product
  defect and no product code change.
- Conventions: integration project (`tests/integration/**/*.test.ts`)
  runs the real bootstrap DDL + `runMigrations()` verbatim against
  better-sqlite3 via `freshDatabase()` in `tests/integration/helpers/db.ts`.
  Canonical order is fixed for checksum stability and differs from PRAGMA
  order (e.g. `todos` live leads `created_at/updated_at`, canonical leads
  `due_date`), so the guard asserts *set* equality, not order equality.

## Scope

- New `tests/integration/backupCanonicalColumns.test.ts` asserting, for
  every `BACKUP_ENTITIES` member on a `freshDatabase()`:
  1. `PRAGMA table_info(<entity>)` column-name set equals the
     `BACKUP_ENTITY_COLUMNS[<entity>]` set (both directions: no silent
     exclusion, no phantom column).
  2. The canonical list for each entity is non-empty and duplicate-free.
  3. The canonical map covers exactly the 21 backup entities.
- Validation: focused integration run for the new file, `npm run qa:fast`,
  `npm run qa:affected`, `npm run agent:plan:validate -- --plan <path>`;
  local commit only, no push.

## Non-Goals

- Overlay x theme Ask/Auto matrix fill (saturated, low value).
- J8 product perf / threshold / fixture / oracle changes (evidence-only closed).
- Owner-only App Store console / screenshots / credentials / invented PII.
- GitHub Actions billing-blocked work; EAS submit; push; v1.0.0 tag.
- Redoing COMPLETED plans (quarantine-register-parity, tinypool E1,
  web-lifecycle, store guards, overlay a11y).
- Any product/schema change: live == canonical today, so no migration,
  no `BACKUP_ENTITY_COLUMNS` edit, no checksum/backfill/restore change.
- No weakening of any existing test, assertion, threshold, or lane gate.

## Current Checkpoint

- Current milestone: COMPLETE — guard shipped, all gates green, committed locally (no push).
- Completed: AGENTS.md + PLANS.md reads; Node v22.23.2 verified; HEAD
  `bd64e27` baseline clean (ahead origin/main by 16); `agent:plans`
  surveyed (no ACTIVE plans; one BLOCKED on external billing);
  known-gaps surveyed (contract register fully closed; capability gaps
  non-box-executable by design); parity guards re-run green
  (quarantine-register 13/13, journey-label OK, journeys 19/19);
  `aft_inspect` clean (0 diagnostics); store readiness surveyed
  (repo-side done, rest owner-action); backup entity coherence surveyed
  (guarded); appMeta raw-string usages surveyed (all via registry keys —
  no drift); live-vs-canonical column diff proven empty via temporary
  spec (created, run, deleted); plan created + validated ACTIVE;
  `tests/integration/backupCanonicalColumns.test.ts` created; lint fix
  (2 unnecessary assertions removed); `qa:fast` PASS; full integration
  PASS 65/65 files, 311/311 tests; plan validated COMPLETED; committed
  locally (no push; see git log).
- In progress: None — task complete.
- Important modified files: `.agent/execplans/backup-canonical-columns-guard-v1.md`
  (this plan); `tests/integration/backupCanonicalColumns.test.ts` (new guard).
- Last successful validation: `npm run test:integration` — PASS 65/65
  files, 311/311 tests (2026-09-19, includes new guard 2/2).
- Current failures: None.
- Relevant quarantines: None (task adds none).
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — every condition is complete
  (guard 2/2, negative sensitivity proven, `qa:fast` green, full
  integration green, plan validated, committed locally).

## Progress

- [x] 2026-09-19 — Startup + survey; gap chosen (canonical-columns drift guard).
- [x] 2026-09-19 — Empirical proof: live column sets == canonical sets (21/21).
- [x] 2026-09-19 — ExecPlan created + validated.
- [x] 2026-09-19 — Integration guard implemented + focused run green (2/2) + negative sensitivity proven.
- [x] 2026-09-19 — `qa:affected` resolved (qa:fast → qa:full, broad regression not required).
- [x] 2026-09-19 — `qa:fast` green (typecheck 0, lint 0, 1805 unit / 142 files, both parity guards OK).
- [x] 2026-09-19 — full integration green (65/65 files, 311/311 tests, incl. new guard 2/2).
- [x] 2026-09-19 — Plan validated COMPLETED; local commit (no push).

## Surprises & Discoveries

- 2026-09-19 — Live-vs-canonical column sets match exactly today, so the
  value is purely the guard (rot-class closure), not a defect fix. This
  keeps the change to one test file with zero product risk.

## Decision Log

- 2026-09-19 — Chose canonical-columns guard over appMeta-registry,
  security-header, native, or product-polish alternatives. Why: appMeta
  usages already go through the registry (verified — no drift); headers
  are enforced and speculation was rejected by the prior pass; native
  lanes need unavailable device/credential infrastructure; product polish
  without a measured defect would be scope creep. The column seam is the
  last unguarded member of the backup-coherence family whose silent
  failure mode is backup-integrity corruption, it is box-executable, and
  it fits the mission prefer-order (known-gap polish / parity guards).
- 2026-09-19 — Set-equality (not order-equality) as the contract. Why:
  canonical order is checksum-stable by design and differs from PRAGMA
  order; asserting order would couple the guard to storage layout.
- 2026-09-19 — Integration project (not unit) for the guard. Why: the
  unit project stubs expo-sqlite with no rows; only the integration
  harness runs the real bootstrap + migrations.

## Validation Ledger

- 2026-09-19 — startup checks — PASS — Node v22.23.2, HEAD bd64e27,
  clean tree, ahead origin/main by 16, no ACTIVE plans.
- 2026-09-19 — `node scripts/quarantine-register-parity.mjs` — PASS — 13/13.
- 2026-09-19 — `npm run agent:plan:validate -- --plan .agent/execplans/backup-canonical-columns-guard-v1.md` — PASS (ACTIVE).
- 2026-09-19 — `npx vitest run --project integration tests/integration/backupCanonicalColumns.test.ts` — PASS — 2/2.
- 2026-09-19 — negative sensitivity (temp spec: canonical minus `due_date`) — PASS — drift flagged, spec deleted.
- 2026-09-19 — `npm run qa:affected` — resolved — agent-workflow-and-documentation → qa:fast → qa:full, broad regression not required.
- 2026-09-19 — `npm run qa:fast` — PASS — typecheck 0 errors, lint 0 errors/0 warnings, 1805 unit / 142 files, label parity OK, quarantine-register OK 13/13.
- 2026-09-19 — `npm run test:integration` — PASS — 65/65 files, 311/311 tests (baseline 64/64 + 309/309 per E1 note; +1 file / +2 tests are this guard).
- 2026-09-19 — `node scripts/journey-label-parity.mjs` — PASS.
- 2026-09-19 — temporary live-vs-canonical diff spec — PASS — `{}` (21/21
  sets equal; spec deleted, tree clean).

## Changed Files / Areas

- `.agent/execplans/backup-canonical-columns-guard-v1.md` — this plan.
- `tests/integration/backupCanonicalColumns.test.ts` — new guard (to create).

## Recovery / Resume Instructions

1. `export PATH="$HOME/.local/share/fnm/node-versions/v22.23.2/installation/bin:$PATH"; node --version` (must be v22.x).
2. Read `AGENTS.md`, then `.agent/PLANS.md`, then this plan.
3. `git status --short; git log --oneline -3`; HEAD should include `bd64e27`.
4. `npm run agent:resume -- --plan .agent/execplans/backup-canonical-columns-guard-v1.md` for orientation.
5. Continue from `Exact next action` above; keep this checkpoint current.
6. Never push, tag, EAS-submit, or switch models. Kill orphan vitest
   workers before re-running tests if memory pressure appears.

## Outcomes & Retrospective

- Status: COMPLETED.
- Summary: the last unguarded seam in the backup-coherence family is
  closed. `tests/integration/backupCanonicalColumns.test.ts` (2 tests)
  pins `BACKUP_ENTITY_COLUMNS` to the real migrated schema on a
  `freshDatabase()`: exact entity coverage, duplicate-free canonicals,
  and PRAGMA set-equality per entity with aggregated diff output.
  Live == canonical today (21/21 sets equal — no product change), so the
  increment is guard-only with zero product risk; the negative probe
  (stale canonical minus `due_date`) proves it is not vacuous. Full
  integration moves 64/64 → 65/65 files, 309/309 → 311/311 tests.
- Follow-up: if a migration adds/renames a column, update
  `BACKUP_ENTITY_COLUMNS` (and the frozen scope snapshots only if the
  scope contract intends it) — this guard will fail loudly until then.
  No E2E battery: zero product/UI surface touched and the impact map
  requires no broad regression.
- Lessons: canonical order is checksum-stable and differs from PRAGMA
  order, so column guards must assert set equality; the unit project
  stubs expo-sqlite, so schema guards belong in the integration project.
