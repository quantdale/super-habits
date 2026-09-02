# Proposal: Production Hardening V1 — Persistence Integrity, Recovery, Heavy-State, Offline

**Status:** Proposed
**Author:** Verboo Code
**Date:** 2026-09-03
**Predecessors:** WM2.1 (`9727abe`) · WM2.2 (`716f7be`) · WM2.3 (`7a0983b`) · WM2.4 (`ac0d9b2`)

## Why

The polish arc (2.0–2.4) simplified the product, unified visuals, made data
entry deterministic, and closed web-lifecycle gaps. The next layer of risk is
deeper: **can Super Habits safely hold months or years of real user data while
surviving interruptions, restarts, offline periods, recovery attempts, heavy
history, and imperfect environments?**

Baseline evidence gathered at `ac0d9b2` (2026-09-03):

- **Load-sensitive restore test flake (reproduced):** `tests/restore.coordinator.test.ts`
  — "blocks restore when local synced tables contain tombstones" failed once
  under full `qa:fast` parallel load (1 failed / 1663 passed, exit 1), then
  passed in isolation (18/18) and on a full `qa:fast` re-run (1665/1665).
  This is exactly the CG-9 class WM2.4 closed for other files: timing
  sensitivity under parallel load, not a product defect — but the mechanism
  is unidentified and must be proven, not assumed.
- **Test-infra gaps in hardening-relevant areas:** migration failure-path
  behavior (a migration that throws halfway must not advance
  `db_schema_version`), duplicate-write idempotency for habit/todos/calories
  rapid double-taps beyond the WM2.3 Calories guard, and interrupted-sync
  ordering under network flapping are covered thinly or by single-path tests.
- **Native readiness is high but unexercised:** doctor PASS with JDK 17,
  adb, emulator 37.1.11, Maestro 2.8.0, four API-36 AVDs available; no
  booted device. The repository supports `qa:native:provision` + provenance.
- **Backup/restore has strong V2 machinery** (validators, canonical
  checksums, atomic import, empty-device requirement) — but disaster-recovery
  evidence must be re-derived and extended adversarially rather than assumed
  from predecessor campaigns.

## What Changes

### 1. Baseline flake: restore tombstone test under load

Identify the mechanism (fixture leak, shared module state, unawaited
persistence chain, or port/worker contention), fix it at the root, and prove
with a repeated full-parallel battery (8 runs, WM2.4 CG-9 protocol). No
global retries; no timeout inflation.

### 2. Migration hardening

Audit all migration blocks against the append-only policy. Add an
integration regression proving a migration failure does not advance the
stored schema version and restart is recoverable. Exercise at least three
representative historical-version upgrade fixtures (old minimal, pre-Gym,
recent-previous) verifying data preservation, index creation, and startup.

### 3. Persistence/mutation invariants + duplicate-write audit

Inventory the write families across all 10 data layers; verify each syncable
write rides `runSyncedMutation`/`runBackupMutation` inside a transaction with
sync enqueue on commit. Probe rapid repeated execution of the sibling write
paths WM2.3 did not cover (todo add/complete, habit completion, saved-meal
creation, focus completion, workout set logging, project/goal creation) for
duplicate-write vulnerability; fix real risks at the root.

### 4. Backup/restore disaster-recovery matrix

Re-derive and extend the restore evidence: valid round trip on a mature
dataset, malformed/adversarial payloads (wrong checksum, wrong owner,
truncated, duplicate IDs, wrong scope), restore atomicity under injected
import-stage failures, wrong-owner refusal, and legacy V1 honesty.

### 5. Offline/reconnect outbox torture

Extend the sync-outbox integration coverage: offline writes survive restart,
reconnect flush ordering, no duplicate remote mutations after repeated
network flapping, partial-failure retry metadata sanity.

### 6. Native readiness

Run `qa:native:provision` on the available API-36 x86_64 emulator, verify
APK provenance against current HEAD, and run the smoke lane. Classify any
infrastructure blocker exactly; do not certify a stale binary.

## Non-Goals

- No domain semantics changes, no schema redesign, no new product surfaces.
- No Supabase production credentials; remote-boundary work uses the
  disposable-backend lane or mocks only.
- No performance framework introduction; heavy-state measurement reuses the
  existing P2 journey ceilings unless evidence shows a real bottleneck.
- No push, no force-push, no main history edits.

## Risks and Trade-offs

- Historical-version fixtures risk drift from the runtime migration truth;
  mitigated by deriving fixtures from the migration blocks in
  `core/db/client.ts` and asserting against runtime schema, not `schema.sql`.
- Native emulator runs are slow and environment-sensitive; they are strictly
  additive evidence, not gates for local web work.
- The restore-test flake fix must not weaken the tombstone assertion.

## Validation

- `qa:fast` green 8/8 consecutive full-parallel runs after the flake fix.
- Focused integration: migrations, restore, backup, sync outbox lanes green.
- Full Vitest, typecheck, lint, openspec:validate, plan:validate:all,
  sim:validate, build:web, web:verify, P0 journeys, full Chromium.
- Native smoke when the emulator path permits; otherwise exact blocker
  classification.
