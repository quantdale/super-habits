# Production Hardening V1 — Tasks

## 1. Baseline (recorded at `ac0d9b2`, 2026-09-03)

- [x] 1.1 Git truth: clean tree, HEAD == origin/main == `ac0d9b2`, single worktree, no ACTIVE plans.
- [x] 1.2 Hygiene: 8081/8082 free (`web:hygiene` PASS).
- [x] 1.3 Gates: typecheck 0 errors; lint 0; Vitest full 1892/1892; qa:fast 1 flake observed (restore tombstone, passed on re-run 1665/1665); openspec 49/49; impact map valid; themes 140/140; supabase schema PASS; plan:validate:all PASS; sim:validate PASS (13 personas/23 scenarios); build:web OK; web:verify PASS (71.2s, exit 0); P0 journeys 25/25.
- [x] 1.4 Native doctor: PASS (JDK 17, adb, emulator 37.1.11, Maestro 2.8.0, 4 API-36 AVDs; EAS CLI optional-missing; no booted device).

## 2. Restore-tombstone parallel-load flake (CG-9 class)

- [x] 2.1 Reproduced load sensitivity (not the exact failure): solo file 2.37s /
      first-test 713ms → full parallel 6.17s / 1875ms; 4 concurrent solo runs
      4.2s each / ~1.2s first-test. Per-test wall clock scales with contention.
- [x] 2.2 Mechanism: wall-clock timeout, not logic. The test graph is fully
      deterministic under hermetic mocks (no timers/randomness/shared mutable
      state across tests — audited `restore.coordinator.ts`, `account.data.ts`,
      `backupRestore.ts`, `appMeta.ts`); the only load-sensitive dimension is
      time: 18 × full-graph re-import (`vi.resetModules()` + dynamic import per
      test, ~0.6s solo / ~1.9s loaded each) inside timed test bodies against the
      5s default unit `testTimeout`. Any scheduling spike drops one random test.
- [x] 2.3 Root fix in `tests/restore.coordinator.test.ts` (test-only, no product
      change): coordinator graph imported ONCE in `beforeAll` (untimed hook);
      per-test fixtures swap via a shared holder with delegating mocks; owner
      cache re-primed per fixture; freshness test serialized (same fixtures and
      assertion, preview read before next fixture install). No retries, no
      timeout change, no weakened assertion. Per-test cost 300–1900ms → 1–9ms.
- [x] 2.4 Battery: 8 consecutive clean full-parallel `qa:fast` runs — all exit 0
      (typecheck 0, lint 0, unit 1665/1665, journey-label parity OK each run).

## 3. Migration hardening

- [x] 3.1 Audit migration blocks 1–24 (read-only). Findings: every block
      2–24 runs through `applyMigration` (step + version bump in ONE
      `withTransactionAsync`); all DDL uses `IF NOT EXISTS` and all ALTERs go
      through PRAGMA-gated `addColumnIfMissing` (idempotent restart); garbage
      stored version safely restarts from 0; `openAndBootstrap` closes the handle
      on failure and `getDatabase` clears the cached promise (retryable init);
      no destructive statements (only m18 table rebuild, with row-count +
      active-uniqueness fail-closed checks inside the tx); m6/m24 backfills are
      bounded UPDATEs. No append-only violation found — no new migration needed.
      Existing cover: `tests/db.client.test.ts` (per-block mock proofs) +
      `tests/integration/migrations.test.ts` (real-SQLite bootstrap, indexes,
      idempotent rerun, REAL rollback proof at m7, m24 repair) +
      `tests/integration/migrationFixtures.test.ts` (v13, v17, v19 synthetic
      upgrades). Genuine gaps: no fail→fix→retry→24 test (§3.2); no TRUE
      pre-Gym v21 or v23→24 upgrade fixture (§3.3).
- [x] 3.2 Retry-after-failure regression (`migrations.test.ts`, real
      SQLite): m7 bump fails on a file DB → version stays 6 → row inserted
      post-failure → fault cleared → SAME file reopens at 24 with the row and
      m7 tables present. Full integration 230/230 green.
- [x] 3.3 Trigger-frozen TRUE-shape fixtures (`migrationFixtures.test.ts`,
      no hand-copied DDL, no product seam): v21 (12-row era corpus incl.
      tombstone) → 24 with all rows/ids preserved, Gym tables empty, legacy
      exercise defaults (`timed`/0/1), v24 + Gym indexes present; v23 (Gym
      corpus) → 24 with rows preserved, snapshot defaults (`[]`/0), hot-path
      indexes landed. Also fixed stale schema-version line in the
      db-and-sync-invariants skill (23 → 24).

## 4. Persistence/mutation invariants + duplicate-write audit

- [x] 4.1 Inventory complete (14 data files + linked-actions + syncedMutation
      core). All user-table writes ride `runSyncedMutation`/`runBackupMutation`
      or a contract-equivalent bespoke tx (durable outbox upsert in-tx +
      post-commit `enqueuePrepared`): habit/todo notification completions
      (module promise-queue serialized + claim-deduped), linked-action habit
      effects, linked-action rules. Restore apply paths run inside the
      coordinator/import tx with no enqueue by design. Momentum/progress/
      activity-timeline are read-only. Raw `withTransactionAsync` appears only
      at the 3 queued notification-claim sites. No bypassing write found except
      §4.3.
- [x] 4.2 Probes (`tests/integration/duplicateWriteProbes.test.ts`, 7/7
      green on real SQLite): toggle round-trip + complete-wins-noop (CAS +
      serialization deterministic), adds repeatable with distinct slots, pomodoro
      same-id idempotent incl. true overlap, concurrent set logs land cleanly,
      saved-meal upsert keeps one row (use_count 2), backfill mints intent +
      retry no-op. Habit increment race already covered by
      `constraints.test.ts`; submit-guard covers UI double-tap (WM2.3).
- [x] 4.3 One real defect fixed at root: `backfillLegacyPomodoroSessionMeta`
      used plain UPDATEs with no outbox intent, so pre-v20 legacy session meta
      (linked todo + note, canonical backup columns) stayed NULL remotely
      forever — now `runBackupMutation` with one `update` intent per
      actually-touched row (NULL predicates keep crash-retry exact), matching
      `setPomodoroSessionMeta`'s contract. Unit + integration regression added.
      Also corrected the stale skill line claiming `habit_completions` needs no
      enqueue.

## 5. Restore disaster-recovery matrix

- [ ] 5.1 Malformed/adversarial payload matrix (checksum, owner, scope, truncation, duplicate ids) → pre-import rejection, classified errors.
- [ ] 5.2 Atomicity: injected mid-import failure → DB byte-identical, no outbox rows, version untouched.
- [ ] 5.3 Wrong-owner refusal + legacy V1 honesty re-verified (extend existing tests only where a gap is found).

## 6. Offline/reconnect outbox torture

- [ ] 6.1 Offline restart survival: failing adapter → close/reopen DB → outbox rows survive → hydrate → flush.
- [ ] 6.2 Flapping: alternating success/failure cycles with concurrent flush triggers; no duplicate pushes, no lost records, sane backoff.

## 7. Native readiness

- [ ] 7.1 Boot API-36 AVD; `qa:native:provision`; verify APK provenance == current HEAD.
- [ ] 7.2 `qa:native:smoke` (+ targeted persistence if green); classify any blocker exactly.

## 8. Validation and closure

- [ ] 8.1 `qa:affected` after each workstream; focused gates per lane.
- [ ] 8.2 Full matrix: typecheck, lint, vitest, qa:integration, openspec:validate, plan:validate:all, sim:validate, build:web, web:verify, web:hygiene, P0, full Chromium.
- [ ] 8.3 Independent verification agent PASS.
- [ ] 8.4 Docs: known-gaps updates if any; campaign evidence recorded; commits coherent; push per policy.
