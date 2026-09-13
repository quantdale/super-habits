# ExecPlan: Production Hardening V1 — Persistence, Recovery, Heavy-State, Offline

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Super Habits behaves like software the user can trust with years of personal
productivity data: no lost writes, no duplicate writes, no partial restore,
safe migrations, durable restart behavior, honest offline behavior. This
campaign proves (and where needed fixes) those properties with evidence.

## Context

- Predecessor: WM2.4 closed at `ac0d9b2` (origin/main), all gates green.
- Baseline flake reproduced during Phase 1: `tests/restore.coordinator.test.ts`
  — "blocks restore when local synced tables contain tombstones" failed once
  under full `qa:fast` parallel load; passed in isolation (18/18) and on a
  full re-run (1665/1665). Same class as WM2.4 CG-9; mechanism unknown.
- Native environment: doctor PASS; four API-36 AVDs exist (CRBABot_API_36,
  Nitro_API_36, braintraining-qa36, braintraining36); none booted; EAS CLI
  not on PATH (optional).

## Scope

- `core/db/client.ts` migration safety (test-only unless a defect is found).
- `tests/restore.coordinator.test.ts` + related restore/backup/sync tests.
- Data-layer write families under `features/` (only if a duplicate-write
  defect is proven).
- Sync outbox integration coverage (`tests/integration/syncOutbox*.test.ts`).
- Native provisioning/smoke via existing scripts (no product code changes).

## Non-Goals

- No domain semantics changes, no schema redesign, no product surface work.
- No production Supabase; remote-boundary evidence via stubs/disposable lane.
- No performance frameworks; no speculative caching layers.

## Current Checkpoint

- Current milestone: COMPLETE — all tasks §1–§8 checked with evidence;
  final commits pushed; emulator shut down; no campaign-owned servers.
- Completed: Phase 0, Phase 1, OpenSpec change, §2 (flake root fix +
  8/8 battery), §3 (retry + v21/v23 fixtures), §4 (inventory + 7 probes +
  backfill fix), §5 (mid-import rollback + legacy), §6 (restart + flap
  torture), §7 (provision ×5 + smoke 2/2 + persistence 11/11 + lifecycle
  - web workout 7/7), §8 (full matrix + reconciled verification).
- Important modified files: see Changed Files / Areas below.
- Last successful validation: closing tree — typecheck 0; lint 0;
  unit 1665/1665; integration 241/241; openspec 50/50; impact 13 rules;
  themes 140/140; supabase schema PASS; plan:validate:all PASS;
  sim:validate PASS; deterministic sim 24/24; timezones 5/5; build:web OK;
  web:verify exit 0; hygiene PASS; P0 25/25; full e2e exit 0 (241 tests);
  native 11/11 PASS report on final HEAD.
- Current failures: None (one portable-import infra flake observed 1-in-5
  runs, classified FLAKY_TEST with evidence in tasks §8.2; no product
  impact).
- Relevant quarantines: None.
- Blockers: None.
- In progress: none.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Complete — all §2–§8 boxes checked,
  validation ledger holds final evidence, Outcomes & Retrospective filled,
  commits pushed, hygiene PASS.

## Recovery Notes

- After compaction: reread AGENTS.md, .agent/PLANS.md, this plan;
  `npm run agent:resume -- --plan openspec/changes/harden-production-persistence-recovery-v1/execplan.md`;
  inspect `git status --short` + `git log --oneline -5`; continue from
  `In progress` above.
- The flake is the first implementation item; do not skip to §3+ until its
  mechanism is identified and recorded.

## Progress

- [x] 2026-09-03: Campaign created. Baseline recorded (tasks §1).
- [x] §2: restore-tombstone flake root-caused (wall-clock timeout from
      per-test full-graph re-import) and fixed (single beforeAll import +
      fixture holder); 8/8 `qa:fast` battery green; committed `9ddc01f`.
- [x] §3: migration audit clean (all blocks transactional/idempotent);
      retry-after-failure + TRUE v21/v23 trigger-frozen fixtures added;
      integration green; committed `bc8e6e4`.
- [x] §4: write-family inventory clean except one real defect —
      `backfillLegacyPomodoroSessionMeta` never enqueued (fixed at root with
      per-row update intents + unit/integration regression); 7 duplicate-write
      probes green; committed `d970826`.
- [x] §5: DR matrix audited (existing 25-test matrix strong); added
      mid-import tripwire rollback + retry and missing-manifest legacy tests;
      committed `2aa3597`.
- [x] §6: outbox restart + flapping torture added (2/2 green, no product
      defect — engine machinery holds); committed `3c424a6`.
- [x] §7: provision PASS ×5 with provenance; smoke 2/2; persistence lane
      to 11/11 PASS (stale Overview marker, picker tap-target ambiguity, and
      settle timing fixed with evidence); lifecycle gym flow green; web
      workout-gym-v2 7/7; commits `a47d1b6`/`1f20d8b`/`423d2fe`/`5b16d33`/
      `7f1c1d2`/`ea91f4b`.
- [x] §8: full matrix green; independent verification reconciled;
      closure commit + push.

## Changed Files / Areas

- `openspec/changes/harden-production-persistence-recovery-v1/` (new):
  proposal.md, design.md, tasks.md, specs/persistence-recovery-hardening/spec.md, execplan.md.
- `tests/restore.coordinator.test.ts` — single-import fixture holder (§2).
- `tests/integration/migrations.test.ts` — retry-after-failure (§3.2).
- `tests/integration/migrationFixtures.test.ts` — TRUE v21/v23 fixtures (§3.3).
- `features/pomodoro/pomodoro.data.ts` — backfill outbox intents (§4.3).
- `tests/pomodoro.data.test.ts` — backfill intent assertion (§4.3).
- `tests/integration/duplicateWriteProbes.test.ts` (new, 7 probes) (§4.2).
- `tests/integration/backupRestore.test.ts` — mid-import + legacy tests (§5).
- `tests/integration/syncOutboxTorture.test.ts` (new, restart+flap) (§6).
- `features/workout/RoutineDetailScreen.tsx` + `WorkoutScreen.tsx` —
  distinct picker/routine input accessibilityLabels (§7).
- `.maestro/flows/` (24 files) — Today marker, deterministic taps (§7).
- `e2e/workout-gym-v2.spec.ts` — new accessible names (§7).
- `.cursor/skills/db-and-sync-invariants/SKILL.md` — stale version +
  habit_completions sync lines corrected (§3/§4).
- `.agent/execplans/agent-safe-web-lifecycle.md` — stale COMPLETED
  checkpoint repaired to the validator contract (§8).

## Recovery / Resume Instructions

1. Reread `AGENTS.md`, `.agent/PLANS.md`, this ExecPlan.
2. `npm run agent:resume -- --plan openspec/changes/harden-production-persistence-recovery-v1/execplan.md`
   — reconcile Git discrepancies and QA impact.
3. `git status --short` must show only campaign-owned files; anything else
   is user work — do not overwrite.
4. Continue from **Exact next action** in Current Checkpoint.

## Surprises & Discoveries

- Baseline `qa:fast` reproduced a load-sensitive flake in
  `tests/restore.coordinator.test.ts` (tombstone test): 1 failed /
  1663 passed under full parallel load; isolated run 18/18; full re-run
  1665/1665. Same CG-9 class WM2.4 closed elsewhere — mechanism not yet
  identified.
- §5: file-level `vi.mock` of a getDatabase()-dependent data layer is
  UNSAFE with this repo's reset-per-test integration pattern — the mock
  namespace freezes the first registry generation, so later
  `freshDatabase()` generations hit a stale closed handle (broke the
  success-path restore test deterministically). Safe file-level mocks are
  db-explicit (appMeta, transactions) or external (AsyncStorage). For
  row-level fault injection prefer DB tripwires (triggers) over module
  mocks — same technique as the §3.3 version-freeze.

## Decision Log

- D1–D7 recorded in design.md (battery protocol, injected-failure migration
  test, runtime-derived fixtures, duplicate probes at data-layer boundary,
  validator-reuse DR matrix, fake-timer outbox torture, native provision on
  available AVD).

## Validation Ledger

- Baseline (2026-09-03, `ac0d9b2`): typecheck 0 errors; lint 0;
  `npm test` 1892/1892 (166 files); `qa:fast` exit 1 with 1 flake, then
  exit 0 1665/1665 on re-run; openspec 50/50 (after campaign add);
  qa:impact:validate OK (13 rules); validate:themes 140/140;
  supabase:schema:validate PASS; agent:plan:validate:all PASS;
  sim:validate PASS; build:web OK; web:verify PASS exit 0 (71.2s,
  crossOriginIsolated=true); P0 journeys 25/25 (1.1m);
  migrations/restore/backup integration subset 46/46; web:hygiene PASS
  (8081/8082 free); dev:doctor PASS.
- §2 battery (2026-09-03): 8 consecutive `qa:fast` exit 0 post-fix
  (typecheck 0, lint 0, unit 1665/1665, parity OK each run).
- §3–§6 lanes: full integration 230/230 then 237/237 then 241/241
  (43 files) green incl. all campaign tests.
- §8 final (2026-09-03, closing tree): typecheck 0; lint 0;
  `qa:fast` exit 0 (unit 1665/1665); `qa:integration` 241/241 with one
  `portableExportImport` infra flake (`appMetaKeys` undefined in a fresh
  client import; 1 in 5 runs; green on immediate re-run + pair +
  isolation) classified FLAKY_TEST infrastructure, no product code
  implicated; openspec 50/50; impact map 13 rules; themes 140/140;
  supabase schema PASS; plan:validate:all PASS (after repairing the stale
  checkpoint of long-closed `agent-safe-web-lifecycle`); sim:validate
  PASS; deterministic sim @p0 24/24; timezone matrix 5/5;
  `build:web` OK; `web:verify` PASS exit 0 (60.8s); hygiene PASS;
  P0 25/25; full `npm run e2e` exit 0 (241 tests, conditional skips only).
- §7 native (API-36 x86_64, Nitro_API_36): provision PASS with provenance
  (sourceSha == HEAD each build); smoke 2/2; persistence lane 11/11 PASS
  report on the final HEAD; lifecycle gym flow green; web workout-gym-v2
  7/7. Two lane flakes met the evidence bar (cold-start bootstrap loader
  screenshot → ENVIRONMENT, replays green; label-position scroll miss →
  retargeted to inputs).
- Independent verification: read-only agent re-ran key files + tsc +
  defect hunt (NONE FOUND); its two FAILs were Git/provenance staleness,
  reconciled by push + the 11/11 lane PASS report.

## Outcomes & Retrospective

- Status: COMPLETE. Every task §1–§8 is checked with evidence in tasks.md
  and this ledger.
- Summary: the campaign proved (and where needed repaired) years-of-data
  trust: one test-flake root fix (no product change), migration
  failure/upgrade proofs, one real backup-fidelity defect fixed
  (pomodoro legacy meta now rides the outbox), restore mid-import
  atomicity + legacy proofs, outbox restart/flap proofs, and a native
  suite repaired from 0/11 stale selectors to 11/11 green — with the
  tap-target ambiguity that caused it fixed at the product layer via
  distinct accessible names (also a screen-reader win).
- Product changes (2): pomodoro backfill outbox intents;
  picker/routine input accessibilityLabels. Everything else is tests,
  flows, specs, and docs.
- Remaining work: the 1-in-5 portable-import infra flake (FLAKY_TEST,
  mechanism unidentified after bounded investigation — full evidence in
  tasks §8.2); auth-lane Maestro inputs share the tap-target ambiguity
  class but run in unverified lanes (playbook recorded: explicit labels
  or proven index taps); one-off >30s emulator cold starts need no
  action.
- Follow-up recommendation: a native-lane stability campaign (auth +
  lifecycle tags on the emulator, seeded repetition counts) using this
  campaign's evidence-first triage playbook (screenshot + logcat +
  hierarchy + diag-flow tap-order proof).
- Lessons: (1) load-sensitive cost inside timed test bodies is the CG-9
  signature — move it to untimed hooks; (2) file-level vi.mock of
  getDatabase()-dependent modules freezes a stale registry — prefer DB
  tripwires; (3) Maestro taps on TextField visible labels silently miss —
  tap inputs via distinct accessible names or proven indices, and never
  hideKeyboard inside a modal on emulator IME.
