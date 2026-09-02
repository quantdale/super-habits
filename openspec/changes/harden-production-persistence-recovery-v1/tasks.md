# Production Hardening V1 — Tasks

## 1. Baseline (recorded at `ac0d9b2`, 2026-09-03)

- [x] 1.1 Git truth: clean tree, HEAD == origin/main == `ac0d9b2`, single worktree, no ACTIVE plans.
- [x] 1.2 Hygiene: 8081/8082 free (`web:hygiene` PASS).
- [x] 1.3 Gates: typecheck 0 errors; lint 0; Vitest full 1892/1892; qa:fast 1 flake observed (restore tombstone, passed on re-run 1665/1665); openspec 49/49; impact map valid; themes 140/140; supabase schema PASS; plan:validate:all PASS; sim:validate PASS (13 personas/23 scenarios); build:web OK; web:verify PASS (71.2s, exit 0); P0 journeys 25/25.
- [x] 1.4 Native doctor: PASS (JDK 17, adb, emulator 37.1.11, Maestro 2.8.0, 4 API-36 AVDs; EAS CLI optional-missing; no booted device).

## 2. Restore-tombstone parallel-load flake (CG-9 class)

- [ ] 2.1 Reproduce under load; capture full failure log with stack.
- [ ] 2.2 Identify mechanism (shared state / unawaited chain / worker contention) from evidence.
- [ ] 2.3 Root fix + regression protection; no retries, no weakened assertion.
- [ ] 2.4 Battery: 8 consecutive clean full-parallel `qa:fast` runs.

## 3. Migration hardening

- [ ] 3.1 Audit migration blocks 1–24 for append-only/transaction/idempotency policy (read-only audit, findings recorded).
- [ ] 3.2 Failed-migration regression: injected failure leaves version unchanged, error surfaced, restart recovers.
- [ ] 3.3 Historical upgrade fixtures: pre-planning, pre-Gym (21), v23 → 24; assert data preservation, defaults, indexes, final version.

## 4. Persistence/mutation invariants + duplicate-write audit

- [ ] 4.1 Write-family inventory across 10 data layers; confirm tx + enqueue coverage; record findings.
- [ ] 4.2 Rapid double-invocation probes for todo add/complete, habit increment, calorie entry, saved meal, pomodoro completion, workout set logging, project/goal creation.
- [ ] 4.3 Fix any vulnerable path at root + regression tests.

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
