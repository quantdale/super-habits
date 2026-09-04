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
- Finding W8-1 (EXPECTED_KNOWN_GAP for headroom + ONE recorded ceiling breach; Wave-9 verifier forced evidence repair — see below). `three-months-in` step 3 `section switch (max of 6)`: SIX consecutive file-level samples @86db9ea→5c077ce, emulator OFF, ports free, host idle: worst 745 / 781 / 774 / 751 / **910 (workout→calories, HARD 800ms ceiling breach)** / 775ms. Headroom floor (<15%) missed 5/5 runs that reached it (2.4-6.9%); ceiling held 5/6. Worst-switch VARIES by run (overview→todos ~750s vs workout→calories 910) → no single-component bottleneck; host-timing jitter on ~700ms warm renders. Historical band 625-797 (overnight 642 fast outlier; backup-closure 781; D14 batch 735-773; post-integration 797) — current sits inside it except the single 910 excursion. No product-code change in the switch path since predecessor. Test UNCHANGED (temporary diag log added/verified/reverted; `git diff` clean). Artifacts: REGENERATED post-verifier at `.cursor/playwright-output/e2e-failures/three-months-in-P2-—-Tom-t-9ffe1-x-of-6-measured-switches-p2-journeys/` (screenshot + trace + error-context, latest 775 run; earlier bundles rotated by Playwright reruns — lesson: copy failure bundles to stable paths immediately). Disposition: no product fix (varying bottleneck, 5/6 holds, typical margin +25-55ms); Wave 10 files a P2 perf-hardening follow-up, does not block; floor may be miscalibrated for this host.
- Wave 8C remainder DONE: chromium+pwa 121 passed / 7 skipped (expected internal-parser opt-in gates) / 0 failed; web:verify #1 PASS (exit 0, 118.7s, port released). Full `npm run e2e` remains blocked only by Finding W8-1 (journeys P2 headroom gate; ceiling held).
- Wave 8D DONE: sim:validate 23/23; repeat sim×1 PASS; deterministic full library 22/23 explicit PASS (all scenarios incl. 356-step disaster-recovery + soak) + smoke covered by repeat gate (harness timeout killed the wrapper at smoke tail, ENVIRONMENT, server cleaned, hygiene PASS); seeded sample PASS (smoke, seed 20260904, run_mtmvdu6q_bwlbni2h). Raw `sim:run` without a server fails with ERR_CONNECTION_REFUSED by design (needs owned server; qa-simulation owns it) — operator error, not a finding.
- Wave 8E DONE: dist-sync dummy-env build PASS; e2e:sync 40 passed / 6 skipped (expected live-restore gates) / 0 failed — matches historical 40/46. Outbox/reconnect regression intact (P5 offline 6/6 + broken-backend 6/6 incl. backoff/requeue/partial-failure).
- Wave 8F DONE: corpus matrix 20/20 (corpus/byte-repro 2/2, backfill scope-6→7, restart, perf all hot paths 0.6-18.8ms, migrationFixtures 5/5 incl. TRUE v21/v23, migrations 10/10); timezone matrix PASS (5 zones); emulator-OFF clean-env perf recorded.
- Wave 8G IN PROGRESS (native findings W8-2/W8-3 below; lifecycle GREEN).
- Finding W8-2 (TEST_BUG, fixed @371deff, verified both AVDs): smoke-tag flows raced slow-emulator timing. (a) ccv2 `hideKeyboard` acted as BACK when the sheet keyboard was not up yet → sheet dismissed → 'Describe it' unfindable (screenshot: sheet open at 'Add something', gone 20s later). Fix: tap sheet header 'Add something' (sheet-unique string) instead of hideKeyboard + re-assert. (b) native-smoke section taps aimed from settling hierarchies + 10s marker budgets too tight for cold-emulator return renders (screenshot+hierarchy proof: tap navigated correctly, 'Customize' rendered with valid bounds, poll still timed out). Fix: settle waits before taps (existing pattern) + 30s return-render budget (matches launch-Today 30s precedent); assertions unchanged. Product source untouched; no app crash in any logcat; app screenshots show healthy renders throughout.
- Wave 8G evidence so far (canonical APKs, owned emulators, reports under simulation-output/native/): smoke Nitro PASS 2/2 (133225316Z @e98ca57-pre, 134812730Z @371deff, FDC2C955), smoke CRBABot PASS (135812242Z @371deff, ccv2 75s + smoke 118s), lifecycle Nitro 6/6 PASS in 13m18s (124738692Z @e5ba46f: habit-reminder-actions-replay/actions/delivery, pomodoro-lifecycle/notification-path, workout-gym-v2-session-lifecycle 4m50s). Pre-fix failures (6 consecutive, 2 AVDs, identical product source to Wave 1 green) reclassified from suspected PRODUCT/ENVIRONMENT to W8-2 TEST_BUG by screenshot+hierarchy proof.
- Finding W8-3 (ENVIRONMENT, under triage): auth-persistence lane attempts 1-2 @371deff FAILED mock proof (signupCount 1 OK = device→mock connectivity fine via adb reverse, but 0 PUT /auth/v1/user + 0 verify). Flow 03-protect scroll for 'Email for backup recovery' 20s: screenshot shows the field rendered; hierarchy reports the exact node with valid on-screen bounds — third instance of Maestro missing screenshot-proven-visible text (after W8-2 Customize/Calories-marker). Same flows passed Wave 2 morning (auth 3/3 ×2 @b32bc7c). Attempt-3 orphaned its emulator+mock when the 30-min harness window killed the wrapper; exact-PID cleanup done (taskkill mock :4545 PID, emu kill), adb empty + ports free verified. Next: single persistence probe, then disposition (Wave 2 auth proof stands on identical product source).
- Finding W8-4 (P1 SUSPECT, product-read vs harness undetermined — Wave 10 must resolve before campaign close): calories-persistence post-restart diary shows EMPTY (Today 0 kcal, screenshot proof, 3 consecutive runs) while the device DB dump proves the row EXISTS. DURABLE PROOF (Wave-9 verifier repair): `simulation-output/native/w8-4-calories-device.db` + `.db-wal` (root-pulled superhabits.db pair from campaign-owned Nitro emulator-5554) + `simulation-output/native/w8-4-calories-db-query.json` (read-only better-sqlite3 transcript: 1 calorie_entries row `Native breakfast/370/breakfast/2026-09-04/deleted_at NULL`, 2 outbox creates, schema 24, 0 todos). NO DATA LOSS (P0 dead). Pre-restart save genuine ('Logged today' needs entries.length>0; 370-kcal diary card screenshot). Save path transactional via runSyncedMutation; diary refreshes on isActive so stale-mount theory weak. First Wave-10 probe: post-restart Form view (read-layer vs diary-layer) + instrumented repro. Product code UNCHANGED on suspicion. Replay: `node scripts/qa-native.mjs --platform android --flow .maestro/flows/calories-persistence.yaml --avd Nitro_API_36`.
- Wave 8G tally: smoke Nitro 2/2 + CRBABot 2/2 (hardened flows, canonical APKs); lifecycle Nitro 6/6 (13m18s); persistence Nitro 10/11 (W8-4 single failure; settings-fix verified 52s); auth 0/3 attempts (W8-3 Maestro-matching; Wave 2 auth 3/3 ×2 mock proof stands on identical product source). No leaks (adb empty, ports free, mock :4545 free — all verified after each kill).
- Wave 8H DONE: repeat runner proven under real workloads (collated repeat records under simulation-output/repeat/ for unit×5, integration×5, P0×5, sim×1, native-smoke×3, native-auth×3; lifecycle 6/6 + persistence 10/11 via per-target native records under simulation-output/native/ — no repeat-suite collation exists for those two lanes). Failure contract verified on real evidence: native-auth-3x collation (3 FAILED_NEEDS_TRIAGE, status FAIL, SHA + replay, exit 1) + native-smoke-3x BLOCKED collation + config-error path (`--suite bogus` → exit 1). No early abort, no leak (post-kill hygiene adb empty/ports free/mock :4545 free). No tooling changes needed.
- Wave 8I DONE (final static matrix @7d4dff1): git diff --check clean; typecheck 0; lint 0 (max-warnings 0); full Vitest 1937/1937 (175 files, up from predecessor 1906 by campaign-added tests); OpenSpec 50/50; impact-map 13 valid; themes 140/140; supabase schema PASS; plans all PASS (master ACTIVE, rest COMPLETED); sim:validate 23/23; timezones 5/5 zones; web:verify #2 PASS (exit 0, 164s, port released, current-SHA bundle entry-c77bc1de). No Deno edge runner in repo (supabase fn has no local gate — recorded, not a gap).
- Wave 8 CLOSED (web:verify #1/#2/#3 all PASS exit 0 with port release; #3 at final 5c077ce). Master Validation Ledger covers Wave 0/5/6/7 inline; Waves 1-4 evidence lives in per-workstream ExecPlan ledgers (multi-avd-orchestration, auth-mock-lifecycle, historical-db-corpus, corpus-certification) — distributed by campaign design, linked here. No product-source changes in Wave 8 (flows/tests/docs only); product tree identical to Wave 7 head except Wave-1 FAB fix.
- Wave 9 round 1 DONE: adversarial FAIL with 2 MAJOR (W8-1 cited bundle rotated; W8-4 DB proof not on disk) + 3 MINOR (master-ledger distribution; stale next action; 8H collation wording) — ALL REPAIRED in this checkpoint (bundle regenerated + samples updated incl. 910 breach; DB pair + query transcript preserved; ledger/wording corrected; next action current).
- Exact next action: Commit verifier repairs, push, run Wave 9 round 2 (second adversarial verification per protocol), then Wave 10 P0/P1 sweep (W8-4 Form-view probe first; W8-1 P2 follow-up filing; remaining sweep) and campaign closure.
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
- 2026-09-04 — Waves 1–4 (evidence in per-workstream ledgers, linked):
  Wave 1 multi-avd-orchestration COMPLETED (8/8 unit; Nitro +
  CRBABot smoke 2/2 each @45dc256; FAB PRODUCT_BUG + flow TEST_BUGs
  fixed; see `.agent/execplans/multi-avd-orchestration.md` ledger).
  Wave 2 auth-mock-lifecycle COMPLETED (auth 3/3 ×2 @b32bc7c, APK
  5642673B, exactly-1-signup/same-UID proof; see
  `.agent/execplans/auth-mock-lifecycle.md` ledger). Wave 3
  historical-db-corpus COMPLETED (MATURE ~9k rows byte-reproducible
  @c2f7561, full 171/1929 green; see
  `.agent/execplans/historical-db-corpus.md` ledger). Wave 4
  corpus-certification COMPLETED (backfill/restart/perf + 15/15
  migrations @3f9046a; see `.agent/execplans/corpus-certification.md`
  ledger).
- 2026-09-04 — Wave 8 battery (this plan Checkpoint + artifacts):
  unit×5 PASS (1691 each); integration×5 PASS (246 each); P0×5 PASS
  (25/25 each, fresh dist once); chromium+pwa 121 passed/7 gated
  skips/0 failed; full e2e blocked ONLY by W8-1 (P2 J8 switch;
  ceiling 5/6 + one 910 breach; hard-budget ledger in Checkpoint);
  sim:validate 23/23 + deterministic 22/23 explicit + smoke gate +
  seeded PASS (seed 20260904); e2e:sync 40/6 gated/0 failed;
  corpus matrix 20/20 + timezones 5/5; native smoke Nitro 2/2 +
  CRBABot 2/2 + lifecycle 6/6 + persistence 10/11 (W8-4) + auth
  0/3 (W8-3; Wave 2 proof stands); repeat self-cert PASS +
  config-error exit 1; static matrix all green (typecheck 0, lint 0,
  Vitest 1937/1937, OpenSpec 50/50, impact 13, themes 140/140,
  schema PASS, plans PASS); web:verify #1/#2/#3 PASS exit 0.
  Test-only fixes: 4 Maestro flow race hardenings (W8-2 + persistence
  pair; product untouched). Open findings: W8-1 (P2 follow-up),
  W8-3 (auth re-probe), W8-4 (P1 diary-read probe) → Wave 10.
- 2026-09-04 — Wave 9 round 1 adversarial FAIL → all repaired:
  W8-1 bundle regenerated + 6-sample ledger (incl. 910 breach);
  W8-4 DB pair + query transcript preserved under
  simulation-output/native/; master-ledger distribution + 8H wording
  corrected; next action current.

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
