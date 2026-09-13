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

- [x] 5.1 Matrix audited against `backupRestore.test.ts` (25 tests) +
      `portableImportCorruption.test.ts` + unit coordinator: checksum, malformed
      rows, broken dependencies, corrupt/future/unknown-scope manifests,
      duplicate ids, mid-fetch failure, owner mismatch, remote-disabled, and all
      settings-integrity variants are covered with pre-import rejection. One gap
      added: missing manifest → `legacy` fallthrough with device untouched.
- [x] 5.2 Mid-import atomicity (`backupRestore.test.ts`): row-level tripwire
      fails the habit_completions applier after 5 entities applied → rejects;
      zero user rows, zero outbox rows, version 24, app_meta identical,
      no linked-action side effects; dropping the tripwire restores cleanly on
      the same handle. Lesson: file-level vi.mock of a getDatabase()-dependent
      data layer freezes the first registry generation and breaks later
      freshDatabase() generations — DB tripwires instead (see execplan).
- [x] 5.3 Wrong-owner refusal proven (unit owner variants + integration
      owner_mismatch matrix); legacy V1 import scope proven (unit V1 import +
      integration `restore.test.ts`); `Legacy (V1)` label + honest disclosure
      copy verified in `SettingsBackupSection.tsx` (static, no logic to test).

## 6. Offline/reconnect outbox torture

- [x] 6.1 `syncOutboxTorture.test.ts`: real `addTodo` writes offline →
      file DB closed/reopened (fresh modules) → new engine hydrates 2 pending
      → recovering adapter flushes both exactly once; second flush is silent;
      outbox drained; local rows intact.
- [x] 6.2 Flapping in the same file: 3 concurrent flushes offline share ONE
      push (single-flight), records retained, failures=1, `shouldAttemptFlush`
      false; 4th record + 2 concurrent flushes → still one push, failures=2
      with strictly growing `nextRetryAt`; reconnect flushes all 4 exactly once
      each and resets metadata; empty-queue flush issues no push. No product
      defect found — the engine's snapshot/revision/single-flight machinery
      holds; the tests lock it in.

## 7. Native readiness

- [x] 7.1 Booted Nitro_API_36 (emulator-5554, API 36 x86_64); `qa:native:provision`
      PASS with provenance (sourceSha == HEAD, clean tree, apkSha256 recorded,
      installed). Smoke 2/2 PASS on the current-source APK.
- [x] 7.2 Targeted persistence 11/11 green with a PASS report on the final
      HEAD (`native-android-persistence-...-105431261Z.json`, provision PASS at
      the same SHA). Path: the stale `Overview` rail marker fix (→ `Today`,
      24 flow files) took 10/11; the gym-v2 picker failure root-caused with
      screenshots/logcat/hierarchy (see execplan) to ambiguous tap targets
      (inputs shared their accessible name with their visible labels → taps hit
      the non-focusable label, text dropped; plus BACK-via-hideKeyboard modal
      hazard) — proven by a tap-order diag flow (index 0 taps label/no-op,
      index 1 taps input/focuses). Fixed with distinct `accessibilityLabel`s
      on the 6 picker inputs plus routine name/description
      (CaloriesEntryFields convention), explicit-name taps/scrolls, index:1
      taps for habit names (diag-proven), `pressKey enter` instead of
      `hideKeyboard` in modals, settle/filter-proof waits, and diary-settle
      waits. Two further single-flow lane flakes met the same bar (evidence
      first): a >30s cold start on a saturated emulator (app legitimately in
      bootstrap loader — replays green, no change) and a label-position scroll
      miss (scroll retargeted to the input). Web `workout-gym-v2` Chromium
      spec 7/7 green on fresh `dist/` after the label change.

## 8. Validation and closure

- [x] 8.1 `qa:affected` after each workstream; focused gates per lane.
- [x] 8.2 Full matrix on the final tree: typecheck 0; lint 0;
      unit 1665/1665 (×10 consecutive `qa:fast` all green); integration 241/241
      (43 files) on re-run — one `portableExportImport` infra flake observed
      (`appMetaKeys` undefined inside a fresh `client` import; 1 in 5 full
      runs; green in isolation, in pair runs, and on immediate re-run).
      Investigated (all mock sites audited; no partial appMeta mock exists;
      no product code implicated): classified FLAKY_TEST infrastructure
      (module-registry/transform scheduling), recorded for the successor — no
      blind retry added. Independent verification re-ran the key files
      (restore.coordinator 18/18, migrations+fixtures 15/15, probes 7/7,
      backupRestore 27/27, torture 2/2, tsc 0) all PASS; its two FAILs were
      Git/provenance staleness at check time (unpushed docs commit; native
      provision predating it) — reconciling now: push, then re-run the
      persistence lane for a PASS report on the final HEAD.
      openspec 50/50; impact map 13 rules; themes 140/140; supabase schema
      PASS; plan:validate:all PASS (incl. repairing the stale checkpoint of
      the long-closed `agent-safe-web-lifecycle` plan, untouched since WM2.2);
      sim:validate PASS; deterministic sim @p0 24/24; timezone matrix 5/5;
      build:web OK; web:verify PASS; web:hygiene PASS; P0 25/25; full `npm run
e2e` exit 0 (241 tests, conditional skips only); native provision PASS
      ×3 with provenance + smoke 2/2 + persistence 11/11 + lifecycle gym flow.
- [x] 8.3 Independent verification agent ran read-only over all claims:
      functional/tests/typecheck/spec gates all PASS; its two FAILs were
      Git/provenance staleness at check time, both reconciled afterward (pushed
      to HEAD == origin/main; persistence lane re-run to a PASS report at the
      final HEAD). No product defect found by the verifier (its defect hunt:
      NONE FOUND).
- [ ] 8.4 Docs: known-gaps updates if any; campaign evidence recorded; commits coherent; push per policy.
