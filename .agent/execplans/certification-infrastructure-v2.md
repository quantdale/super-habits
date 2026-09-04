# ExecPlan: Certification Infrastructure V2 (master orchestration)

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Execute the ACTIVE `.agent/EXECUTION_PROMPT.md` (Certification Infrastructure V2,
Planned-From `1e1f4d0`, executor start `2502a75`) so certification becomes
reproducible: multi-AVD orchestration, process-owned auth-mock lifecycle,
deterministic historical DB corpus + corpus-backed certification, long-run
repetition framework, provenance/triage standardization, justified CI/nightly
placement — ending in clean pushed `main` with adversarial verification.

## Context

- Repo `quantdale/super-habits`, branch `main`, single worktree.
- Planned-From `1e1f4d04aa30980667d27ecc1caa38734060e9ff`; executor start
  `2502a75d750fd5047c9985db9e7946293996f102` (planning commit only).
- Predecessor overnight campaign COMPLETED at `1e1f4d0` with zero
  product-source changes; full evidence in its ExecPlan Validation Ledger.
- Residuals (all still open at campaign start): manual multi-AVD work
  (`selectAndroidDevice` throws on multiple targets), manual auth-mock
  choreography (`scripts/native-auth-mock-server.mjs` standalone), real-corpus
  fixtures open (known-gaps #5/#6), manual long-run repetition.
- Authority: AGENTS.md, .agent/PLANS.md, ACTIVE execution prompt,
  autonomous-qa.md, known-gaps.md, simulation/matrix.ts, CI + native-e2e
  workflows, qa/impact-map.json.
- Invariants: soft-delete, outbox enqueue, getDatabase singleton, createId,
  toDateKey, append-only migrations (next `if (version < 25)`), no DB in
  UI/domain, single-page shell, COOP/COEP, FINITE-vs-SERVICE process safety,
  canonical-vs-TEST-ONLY provenance separation.

## Scope

Waves 0–10 per the ACTIVE prompt. Tooling/tests/docs are the expected
implementation surface; product-source changes only on proven P0/P1 evidence.

## Non-Goals

Per ACTIVE prompt §3 (no hardening re-implementation, no rewrites, no
production Supabase/credentials/real personal data, no parallel-AVD default,
no generic orchestrator, no PR-CI slowdown, no historical-log rewrites).

## Current Checkpoint

- Current milestone: Waves 0–7 COMPLETE at `86db9ea`; Wave 8 IN PROGRESS (recovery verified 2026-09-04).
- Completed: Wave 0 recert at `2502a75` (hygiene, typecheck 0, lint 0,
  unit 1665/1665, impact 13, themes 140/140, supabase PASS, OpenSpec
  50/50, sim:validate 23/23; 4 AVDs present; Maestro 2.8.0); Wave 1
  multi-AVD orchestration COMPLETED (8/8 tests; Nitro + CRBABot smoke
  2/2 each @45dc256; FAB PRODUCT_BUG + flow TEST_BUGs fixed);
  Wave 2 auth-mock lifecycle COMPLETED (auth 3/3 ×2 @b32bc7c, APK
  5642673B, exactly-1-signup/same-UID proof); Wave 3 mature corpus
  COMPLETED (seedMature ~9k rows, byte-reproducible @c2f7561, full
  171/1929 green); Wave 4 corpus-backed certification COMPLETED
  (backfill/restart/perf + 15/15 migrations @3f9046a); Waves 5/6
  repetition + provenance COMPLETED (repeat 5/5; unit×2 + p0×2
  25/25 collated PASS @3f9046a tree; native 21-field + repeat
  14-field contracts verified; `qa:repeat` landed @4049450).
- In progress: Wave 8 expensive stability battery.
- Important modified files: `.agent/execplans/certification-infrastructure-v2.md`
  (this plan); per-workstream COMPLETED plans for Waves 1–6.
- Last successful validation: 2026-09-04 Waves 5/6 closure — repeat
  5/5 + typecheck 0 + lint 0 + impact 13 valid + p0×2 collated PASS
  - provenance-contract PASS + hygiene PASS + plan:validate PASS.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Recovery 2026-09-04: branch `main`, HEAD `86db9ea` == origin/main, tree clean, single worktree, ports 8081/8082 FREE, adb 0 devices, 4 AVDs present (CRBABot_API_36, Nitro_API_36, braintraining-qa36, braintraining36), Node v22.23.2 / npm 10.9.8, no campaign-owned emulator/mock/server. Product drift check: `core/ features/ lib/ supabase/` identical since 1e1f4d0; only product change is Wave 1 FAB fix `9be8bcd` (app/index.tsx setTimeout); Waves 5-7 touch only .agent/scripts/tests/docs — handoff no-drift claim VERIFIED. Wave 7 Decision B stands unless Wave 8 finds new evidence.
- Wave 8A DONE: unit×5 collated PASS (5/5, 1691 each, ~12s each, `simulation-output/repeat/unit-5x-2026-09-04T095009493Z.json` @86db9ea); integration×5 collated PASS (5/5, 246 each, 23-27s each, `integration-5x-2026-09-04T095222974Z.json` @86db9ea). No variance anomalies; no flakes.
- Wave 8B DONE: P0×5 collated PASS (5/5, 25/25 each, fresh dist once @86db9ea build 93.9s, `p0-5x-2026-09-04T100108414Z.json`); per-run 97/78/77/73/75s, no trend, no pathological delay, browser-only (no emulator).
- Wave 8C PARTIAL: fresh `build:web` PASS @86db9ea; full `npm run e2e` BLOCKED by one diagnostic headroom gate (see Finding W8-1). PWA sub-lane inside that run: 5/5 PASS before the journeys failure (offline indicator, first-visit claim, apply-update, dismissed-resurface, reload-no-rejection). web:verify repetitions still pending.
- Finding W8-1 (EXPECTED_KNOWN_GAP, NOT product regression): `three-months-in` step 3 `section switch (max of 6)` misses the WM2.4 15% diagnostic headroom floor while HOLDING the 800ms hard ceiling. Four consecutive file-level samples @86db9ea, emulator OFF, ports free: worst 745/781/774/751ms (2.4-6.9% headroom); per-switch diag shows overview→todos dominates (774/751) with others 264-556ms. Historical band on this host is 625-797 (overnight 642 fast outlier; backup-closure 781; final-consolidation 753; D14 batch 735-773; parallel-headless 751/770; post-parallel 736; post-integration 797) — current 745-781 sits inside it. No product-code change in the switch path since predecessor (only Wave 1 FAB setTimeout). No progressive slowdown, no pathological one-off. Test left UNCHANGED (temporary diag log added/verified/reverted; `git diff` clean for the spec). Artifacts preserved under `.cursor/playwright-output/e2e-failures/three-months-in-*`. Disposition: record, continue battery, Wave 10 decides (no product fix without measured bottleneck signal; floor may be miscalibrated for this host).
- Wave 8C remainder DONE: chromium+pwa 121 passed / 7 skipped (expected internal-parser opt-in gates) / 0 failed; web:verify #1 PASS (exit 0, 118.7s, port released). Full `npm run e2e` remains blocked only by Finding W8-1 (journeys P2 headroom gate; ceiling held).
- Wave 8D DONE: sim:validate 23/23; repeat sim×1 PASS; deterministic full library 22/23 explicit PASS (all scenarios incl. 356-step disaster-recovery + soak) + smoke covered by repeat gate (harness timeout killed the wrapper at smoke tail, ENVIRONMENT, server cleaned, hygiene PASS); seeded sample PASS (smoke, seed 20260904, run_mtmvdu6q_bwlbni2h). Raw `sim:run` without a server fails with ERR_CONNECTION_REFUSED by design (needs owned server; qa-simulation owns it) — operator error, not a finding.
- Wave 8E DONE: dist-sync dummy-env build PASS; e2e:sync 40 passed / 6 skipped (expected live-restore gates) / 0 failed — matches historical 40/46. Outbox/reconnect regression intact (P5 offline 6/6 + broken-backend 6/6 incl. backoff/requeue/partial-failure).
- Wave 8F DONE: corpus matrix 20/20 (corpus/byte-repro 2/2, backfill scope-6→7, restart, perf all hot paths 0.6-18.8ms, migrationFixtures 5/5 incl. TRUE v21/v23, migrations 10/10); timezone matrix PASS (5 zones); emulator-OFF clean-env perf recorded.
- Wave 8G IN PROGRESS (native findings W8-2/W8-3 below; lifecycle GREEN).
- Finding W8-2 (TEST_BUG, fixed @371deff, verified both AVDs): smoke-tag flows raced slow-emulator timing. (a) ccv2 `hideKeyboard` acted as BACK when the sheet keyboard was not up yet → sheet dismissed → 'Describe it' unfindable (screenshot: sheet open at 'Add something', gone 20s later). Fix: tap sheet header 'Add something' (sheet-unique string) instead of hideKeyboard + re-assert. (b) native-smoke section taps aimed from settling hierarchies + 10s marker budgets too tight for cold-emulator return renders (screenshot+hierarchy proof: tap navigated correctly, 'Customize' rendered with valid bounds, poll still timed out). Fix: settle waits before taps (existing pattern) + 30s return-render budget (matches launch-Today 30s precedent); assertions unchanged. Product source untouched; no app crash in any logcat; app screenshots show healthy renders throughout.
- Wave 8G evidence so far (canonical APKs, owned emulators, reports under simulation-output/native/): smoke Nitro PASS 2/2 (133225316Z @e98ca57-pre, 134812730Z @371deff, FDC2C955), smoke CRBABot PASS (135812242Z @371deff, ccv2 75s + smoke 118s), lifecycle Nitro 6/6 PASS in 13m18s (124738692Z @e5ba46f: habit-reminder-actions-replay/actions/delivery, pomodoro-lifecycle/notification-path, workout-gym-v2-session-lifecycle 4m50s). Pre-fix failures (6 consecutive, 2 AVDs, identical product source to Wave 1 green) reclassified from suspected PRODUCT/ENVIRONMENT to W8-2 TEST_BUG by screenshot+hierarchy proof.
- Finding W8-3 (ENVIRONMENT, under triage): auth-persistence lane attempts 1-2 @371deff FAILED mock proof (signupCount 1 OK = device→mock connectivity fine via adb reverse, but 0 PUT /auth/v1/user + 0 verify). Flow 03-protect scroll for 'Email for backup recovery' 20s: screenshot shows the field rendered; hierarchy reports the exact node with valid on-screen bounds — third instance of Maestro missing screenshot-proven-visible text (after W8-2 Customize/Calories-marker). Same flows passed Wave 2 morning (auth 3/3 ×2 @b32bc7c). Attempt-3 orphaned its emulator+mock when the 30-min harness window killed the wrapper; exact-PID cleanup done (taskkill mock :4545 PID, emu kill), adb empty + ports free verified. Next: single persistence probe, then disposition (Wave 2 auth proof stands on identical product source).
- Exact next action: Single persistence lane on Nitro (probe whether W8-3 affects all Maestro text asserts or auth-flow-specific); then Wave 8H repeat self-cert + 8I static pass + closure commit; then Waves 9/10.
- Remaining definition of done: Wave 8 battery;
  Wave 9 adversarial verification; Wave 10 sweep; prompt COMPLETED;
  clean pushed main.

## Progress

- [x] Git truth reconciled; master orchestration plan opened.
- [x] Wave 0 recertification (hygiene, baseline, native presence, drift check).
- [x] Wave 1 COMPLETED 2026-09-04: orchestration + 8/8 tests; Nitro +
      CRBABot smoke 2/2 each @45dc256; FAB PRODUCT_BUG + flow TEST_BUGs fixed.
- [x] Wave 2 COMPLETED 2026-09-04: owned auth-mock lifecycle + auth 3/3 ×2
      with mock proof @b32bc7c (APK 5642673B); plan COMPLETED @b9e2697.
- [x] Wave 3 COMPLETED 2026-09-04: deterministic mature corpus + edge
      states, byte-reproducible @c2f7561; full 171/1929 green.
- [x] Wave 4 COMPLETED 2026-09-04: corpus backfill/restart/perf +
      15/15 migrations @3f9046a.
- [x] Waves 5/6 COMPLETED 2026-09-04: `qa:repeat` runner + 5/5 tests +
      unit×2 + p0×2 (25/25) collated PASS + provenance contracts verified
      (@4049450 + plan @0b0b3c0).
- [x] Wave 7 COMPLETED 2026-09-04: CI/nightly evaluation — decision B (no CI changes; evidence below).
- [ ] Wave 8 expensive stability battery (quiet window).
- [ ] Wave 9 adversarial verification PASS; Wave 10 P0/P1 sweep.
- [ ] Prompt marked COMPLETED; final report appended; clean pushed main.

## Surprises & Discoveries

- 2026-09-04 (Wave 7) — Corpus certification is already PR-gated: `corpus.test` / `corpusBackfill` / `corpusRestart` / `corpusPerformance` / `migrationFixtures` / `migrations` all ride the `integration` Vitest project inside the `quality` job (`npm test`), so the Wave 3/4 corpus matrix needs no new CI lane. Verified by inspection (tests under `tests/integration/`, `vitest.config.ts` projects, `ci.yml` quality runs `npm test`), not by re-running the full suite in this wave.

## Decision Log

- 2026-09-04 — One master orchestration plan + per-workstream plans opened
  lazily as implementation work opens (predecessor precedent). No OpenSpec
  change until a workstream justifies one.
- 2026-09-04 (Wave 7) — Decision B: keep current CI unchanged.
  Placement: PR keeps quality + chromium + P0 + sim:validate +
  deterministic @p0 (fast, fake-backed, deterministic per matrix);
  main keeps full e2e + full deterministic library + dist-sync +
  e2e:sync; nightly keeps full e2e + seeded + dist-sync + e2e:sync +
  guarded disposable-backend (report-only); native stays manual/on-demand
  - `.eas/workflows/native-e2e.yml` label/dispatch (no GitHub-runner
    emulator infra — adding emulator work to `ci.yml` would fake
    certification). `qa:repeat` (unit/integration/p0/sim/native suites,
    10–30min backstops) stays manual/on-demand for Wave 8 + future
    stability work: PR already gates single unit+integration + P0, and
    Waves 5/6 + predecessor show zero recurring flake (unit×2, P0 25/25
    ×2 here; P0 ×5 + 30+ native runs zero flakes before) to justify 2–5×
    PR latency. Corpus migration/restart/perf already ride `npm test`
    integration in quality (Backfill 10.9s, Restart 4.3s, perf ≤4.3ms vs
    5000ms tripwires, migrations 15/15); web J8 ceilings already ride
    main/nightly full e2e by design. Matrix unchanged (`sim:validate`
    23/23 incl. `validateMatrix`); no new lanes, no promotion criteria
    met, no overturning defect class (Wave 1 FAB race is
    hardware-geometry-specific, only catchable on a second physical AVD,
    not on ubuntu runners).

## Validation Ledger

- 2026-09-04 — planner `agent:plan:validate:all` — PASS (all versioned plans).
- 2026-09-04 — planner `openspec:validate` — PASS 50/50.
- 2026-09-04 — Wave 0 at `2502a75`: hygiene PASS; `git diff --check`
  clean; typecheck 0; lint 0; unit 1665/1665; label parity OK;
  impact 13; themes 140/140; supabase schema PASS; openspec 50/50;
  plan:validate:all PASS; sim:validate 23/23; adb 0 devices; 4 AVDs
  present; Maestro 2.8.0; no product-tree drift vs `1e1f4d0`.
- 2026-09-04 — Waves 5/6 closure: repeat 5/5; typecheck 0; lint 0;
  impact 13 valid; unit×2 collated PASS; p0×2 collated PASS (25/25
  each, fresh dist/ once); provenance-contract PASS; hygiene PASS +
  adb empty; plans validated; feat(qa) @4049450 + docs(agent) @0b0b3c0.
- 2026-09-04 — Wave 7 decision (no code change): hygiene PASS
  (8081/8082 free); `adb devices` empty; `git diff --check` clean;
  impact-map 13 valid; `sim:validate` 23/23 (includes
  `validateMatrix`); `openspec:validate` 50/50;
  `agent:plan:validate:all` PASS; tree clean at `454d9bd` ==
  `origin/main`; Waves 0–6 remain COMPLETED with zero
  product-source drift from the repetition/provenance waves.

## Changed Files / Areas

- `.agent/execplans/certification-infrastructure-v2.md` — campaign durable
  state (this file).

## Recovery / Resume Instructions

1. Read AGENTS.md, .agent/PLANS.md, .agent/EXECUTION_PROMPT.md (ACTIVE),
   .agent/PLANNER_HANDOFF.md.
2. Run `npm run agent:resume -- --plan .agent/execplans/certification-infrastructure-v2.md`.
3. Inspect `git status -s`, `git diff --stat`, `git diff --name-only`,
   `git log --oneline -5`; Git wins over narrative.
4. Run `npm run web:hygiene`; confirm ports.
5. Continue only from `Exact next action` in Current Checkpoint.

## Outcomes & Retrospective

- Status: Active.
- Summary: campaign starting; Wave 0 in progress.
- Follow-up: none yet.
