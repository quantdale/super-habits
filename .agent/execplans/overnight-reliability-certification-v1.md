# ExecPlan: Overnight Reliability & Real-World Certification Program V1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Execute the ACTIVE `.agent/EXECUTION_PROMPT.md` campaign from the verified
`5ee3531` baseline (plus planning commit `2347b4a`): prove the hardened tree
under real-world conditions — repeatable native lanes, soak/chaos repetition,
heavy-state performance with measured evidence, test/CI determinism, bounded
evidence-led architecture hardening, whole-product persona certification —
ending in clean pushed `main` with adversarial verification.

## Context

- Repo `quantdale/super-habits`, branch `main`, single worktree.
- Planned-From `5ee35318dd3a932c6aa6cdaf2553080cd19fa3c2`; executor start
  `2347b4aac97271657535635ea5cdcf877d8d85f1` (planning commit only).
- Predecessor hardening COMPLETED: typecheck 0, lint 0, unit 1665/1665,
  integration 241/241, OpenSpec 50/50, P0 25/25, full E2E 241, web:verify PASS,
  native 11/11 on Nitro_API_36 (API-36 x86_64).
- Residuals inherited: 1-in-5 portable-import infra flake (FLAKY_TEST),
  auth-lane tap-target ambiguity in unverified lanes, one-off >30s cold
  starts, real-corpus migration proof open, format:check baseline gap in
  historical/agent files.
- Authority: AGENTS.md, .agent/PLANS.md, .agent/EXECUTION_PROMPT.md (ACTIVE),
  docs/PROJECT_STRUCTURE_MAP.md, autonomous-qa.md, known-gaps.md,
  simulation/matrix.ts, CI + native-e2e workflows, qa/impact-map.json.
- Invariants: soft-delete, outbox enqueue via runSyncedMutation/
  runBackupMutation, getDatabase singleton, createId, toDateKey, append-only
  migrations (next `if (version < 25)`), no DB in UI/domain, single-page
  shell, COOP/COEP, FINITE-vs-SERVICE process safety, exact-PID cleanup.

## Scope

Waves 0–15 per the ACTIVE prompt: recert → native stability (auth,
lifecycle, seeded, multi-AVD, playbook) → native soak → heavy-state native →
long-horizon lifecycle → soak/chaos → heavy-state perf → test determinism →
clean-env/build → CI hardening → architecture hardening → personas → a11y →
security → docs audit → P0/P1 sweep → adversarial verification → final report.

## Non-Goals

No hardening re-implementation without new evidence; no second Gym state;
no sync rewrite; no new tab/framework; no production Supabase or real
credentials; no unreproducible chaos; no retry-as-fix / weakened assertions;
no aesthetic CI redesign; no speculative indexes/splits; no formal security
certification; no historical-log rewrites.

## Current Checkpoint

- Current milestone: COMPLETE — all waves executed, adversarial
  verification passed on re-verification (F1–F3 fixed), prompt closing.
- Completed: planner prompt authored/validated/pushed (2347b4a); executor
  startup reads (AGENTS.md via env, PLANS.md, EXECUTION_PROMPT ACTIVE,
  PLANNER_HANDOFF routing-only); Git reconciliation (HEAD == origin/main ==
  2347b4a, clean, descendant of Planned-From); campaign tracking list created.
- In progress: none.
- Important modified files: `.agent/execplans/overnight-reliability-certification-v1.md`
  (this plan); `.maestro/flows/auth-session-*.yaml` (TEST_BUG fixes +
  01/02/03 ordering). No product source changes.
- Last successful validation: full campaign matrix (2026-09-04, HEAD c6a018a
  unless noted) — see Validation Ledger. No product source changes in the
  entire campaign (diff: prompt + plan + 3 Maestro flows).
- Current failures: None.
- Relevant quarantines: None (inherited residuals are follow-ups, not
  quarantines).
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Complete — Waves 0–15 evidenced;
  P0/P1 findings fixed/verified or deferred with evidence; final battery
  green; adversarial verification PASS (F1–F3 fixed, re-verified);
  docs/gaps reconciled; clean pushed main; prompt marked COMPLETED.

## Progress

- [x] Planner prompt ACTIVE at 2347b4a (validated, pushed).
- [x] Wave 0 recertification (git/hygiene/baseline/native-presence) — all green 2026-09-04.
- [x] Wave 1 native lane stability V1 — provision/smoke/persistence/
      lifecycle green; auth 3/3 x3 with exactly-1-signup proof; 2 TEST_BUG
      flow fixes committed (1c725d7 pill text, de89f5b ordering).
- [x] Waves 2–4 native soak / heavy-state / long-horizon — persistence
      11/11 x2 (10m52s, 10m40s, no growth), smoke 2/2 x2, lifecycle 6/6,
      auth 3/3 x3; J8 headroom variance triaged to emulator contention
      (ENVIRONMENT, ceiling never breached); Wave 3 heavy-native fixtures
      deferred (no product change to certify; web HEAVY J8 + soak scenario
      green); Wave 4 via timezone matrix 5/5 + long-horizon sim scenarios.
- [x] Waves 5–6 soak-chaos / heavy-state performance — soak-sustained-use
      132 steps PASS; J8 7/7 with measured ceilings (cold 544/5000,
      maxSwitch 642/800, diary 318/500, picker 108/500); query/render audit
      not triggered (no bottleneck signal; identical code to hardened
      baseline).
- [x] Wave 7 determinism + long-suite batteries — full Vitest 1906/1906;
      P0 25/25 x5 consecutive; full e2e 198 passed/43 expected-skips/0
      failed; sim library 23/23 deterministic; seeded smoke PASS;
      sync lane 40/46 (6 capability-gated skips); web:verify PASS;
      hygiene PASS.
- [x] Waves 8–9 clean-env/build + CI hardening — fresh build:web (3
      routes, no prototype), dist-sync build, canonical native provision;
      CI quality-lane parity complete incl. deno edge check; no CI changes
      justified (matrix enforced by validateMatrix, all green).
- [x] Wave 10 architecture hardening — dependency-graph evidence:
      zero feature imports of effects/targetProviders (no cycle; engine is
      leaf); no product change justified. Side-effect/hot-module review:
      no new code, extensive reload/restart lanes green, no split.
- [x] Waves 11–15 personas/a11y/security/docs/sweep — personas via
      13 sim personas + P1–P6 journeys green; a11y via textFieldA11y unit +
      theming/keyboard E2E green with no UI changes; security: no new code,
      no credentials tracked, release manifest verified clean; docs: schema
      still 24, no stale refs to renamed flows; sweep: only scaffolder
      template TODOs. Adversarial verification: see next.

## Adversarial verification (first pass: 1 FAIL with F1–F3)

- F1 (load-bearing, fixed): green auth runs had used direct Maestro with
  no saved PASS artifacts (0 PASS auth JSONs; 4 FAILED + 1 BLOCKED triage
  reports preserved as history). Remedy executed: mock-backed cleartext
  APK rebuilt at c00d6eb (SHA
  44B632BE7F99B498E6EEC5664607B976F9F7760E4D7B9EAD08C6683473787E45),
  auth lane re-run 3x with per-run Maestro stdout
  (`auth-manual-run{1,2,3}.log`) + per-run mock logs
  (`mock-auth-run{1,2,3}-4545.log`): 3/3 each, exactly 1 signup/run,
  same UID, verify preserves UID, 0 unauthenticated checks. Labeled
  provenance in `auth-manual-provenance.json` (executor-recorded, not
  runner output). Mock torn down, reverse removed, canonical APK
  re-provisioned at c00d6eb (SHA 0E20EB1F), generated manifest verified
  clean, final runner smoke 2/2 with saved stdout
  (`runner-smoke-c00d6eb.log`), emulator shut down.
- F2 (supporting, dispositioned): runner PASS JSONs carry no flow counts
  by design (counts live in runner stdout). Saved-runner-stdout pattern
  established (`runner-smoke-c00d6eb.log`); transcript counts stand for
  earlier lanes; runner-JSON flow-results enrichment filed as Wave 1E
  follow-up, not re-run justification.
- F3 (minor, waived with proof): native evidence newest at c6a018a vs
  later plan-only commits. Waiver proof: product dirs
  (`app core features lib scripts supabase`) byte-identical between
  native-evidence SHA and closure HEAD (verified via git diff before
  final push); all later commits are `.agent/*` + `.maestro/*` only.
  Static gates re-ran at closure HEAD regardless.

## Surprises & Discoveries

- Auth lane 0/3 root causes (all setup/test, no product defect): (1) flows
  asserted styled-uppercase pill text, Maestro matches raw hierarchy text;
  (2) lane was run against local-only APK with no Supabase URL, so the
  account card never entered anonymous state; (3) mock server died with its
  parent shell (`start /B` does not survive) and `adb root` wiped the
  reverse forward; (4) Android blocks cleartext HTTP — mock-backed APK
  needs a test-only manifest cleartext patch in gitignored `android/`
  (repo precedent agrees; release config untouched); (5) restart flow ran
  after protect alphabetically and inherited permanent state — fixed by
  01/02/03 filename ordering. Mock proof per green run: exactly 1 signup,
  same UID, verify email_change preserves UID, 0 unauthenticated checks.
- Native runner has no first-class auth-mock support (server start, reverse,
  mock-URL build, cleartext patch all manual). Candidate Wave 1E tooling:
  `--auth-mock` option for provision/runner. Deferred until post-soak.

## Decision Log

- 2026-09-04 — One master ExecPlan for campaign orchestration; per-workstream
  OpenSpec/ExecPlans only if implementation work opens — avoids competing
  ACTIVE state files.
- 2026-09-04 — Wave 1D multi-AVD deferred: zero native flakes across
  30+ flow runs on Nitro_API_36 gives no triage question a second AVD
  would answer; emulator-hours better spent on web lanes.
- 2026-09-04 — Wave 1E `--auth-mock` automation deferred: manual path
  proven and recorded, but baking mock builds into provision risks
  provenance confusion (mock vs canonical); automate in a dedicated
  change with its own tests, not inside a certification campaign.
- 2026-09-04 — J8 floor misses classified ENVIRONMENT, not TEST_BUG:
  the 15% floor is a guard band on identical code; ceiling contract
  holds; contention source identified and removed with measured
  recovery (642ms/19.8%). No assertion weakened.

## Validation Ledger

- 2026-09-04 — planner `agent:plan:validate:all` — PASS (all versioned plans).
- 2026-09-04 — planner `openspec:validate` — PASS 50/50.
- 2026-09-04 — Wave 2 soak: persistence 11/11 rerun 10m40s (vs 10m52s,
  per-flow ±4s, no growth); smoke 2/2 rerun; auth 3/3 x3 with per-run
  exactly-1-signup/0-unauth mock proof.
- 2026-09-04 — qa:integration 241/241 (43 files); full `npm test`
  1906/1906 (168 files); qa:timezones 5/5 x43.
- 2026-09-04 — P0 25/25 x5 consecutive (1.0m each).
- 2026-09-04 — full `npm run e2e` attempt 1: 193 passed, J8 step 3
  headroom-floor miss (701ms/800ms = 12.4% < 15% floor; ceiling held).
  Isolated J8 rerun: 691ms (13.6%) — reproduced. Emulator shutdown →
  J8 7/7 (maxSwitch 642ms, 19.8%). Classified ENVIRONMENT (campaign-owned
  emulator contention, ~50–60ms on overview→todos; identical product
  code; ceiling never breached). Full `npm run e2e` rerun (emulator
  off): 198 passed, 43 expected skips, 0 failed (16.0m).
- 2026-09-04 — sim library deterministic 23/23 (incl. 356-step recovery
  - 132-step soak); seeded smoke PASS; e2e:sync 40/46 (6 gated skips);
    web:verify PASS (45.3s); hygiene PASS (8081/8082 free).
- 2026-09-04 — deno edge check PASS; arch grep proof (no cycle);
  security: tracked tree has no mock key/cleartext, generated manifest
  clean; sweep: only scaffolder template TODOs.
- 2026-09-04 — executor Wave 1 native (Nitro_API_36, emulator-5554):
  canonical provision PASS at de89f5b; smoke 2/2; persistence 11/11;
  lifecycle 6/6; auth-persistence 3/3 x3 on functionally-exact cleartext
  mock build (APK DBD2B3D9, 1 signup/same-UID/verify-preserves-UID proof).
  Commits 1c725d7 + de89f5b pushed.
- 2026-09-04 — executor Wave 0: hygiene PASS; `git diff --check` clean;
  typecheck 0; lint 0; unit 1665/1665; impact 13; themes 140/140; supabase
  schema PASS; openspec 50/50; plan:validate:all PASS; sim:validate 23/23;
  dev:doctor PASS; AVDs CRBABot_API_36/Nitro_API_36/braintraining-qa36/
  braintraining36 present, none booted.

## Changed Files / Areas

- `.agent/execplans/overnight-reliability-certification-v1.md` — campaign
  durable state (this file).

## Recovery / Resume Instructions

1. Read AGENTS.md, .agent/PLANS.md, .agent/EXECUTION_PROMPT.md,
   .agent/PLANNER_HANDOFF.md.
2. Run `npm run agent:resume -- --plan .agent/execplans/overnight-reliability-certification-v1.md`.
3. Inspect `git status --short`, `git diff --stat`, `git diff --name-only`,
   `git log --oneline -5`; Git wins over narrative.
4. Run `npm run web:hygiene`; confirm ports.
5. Continue only from `Exact next action` in Current Checkpoint.

## Outcomes & Retrospective

- Status: Completed.
- Summary: full overnight reliability program executed from c00d6eb-line
  baseline with zero product-source changes. Native: canonical provision
  - smoke/persistence/lifecycle green with soak repeats and no
    degradation; auth lane stabilized (2 TEST_BUG flow fixes) and certified
    3/3 x3 with per-run 1-signup/same-UID mock proof. Web: full Vitest
    1906/1906, P0 25/25 x5, full E2E 198/43-skips/0-fail, sim 23/23 +
    seeded sample, sync 40/46, web:verify + hygiene PASS, timezones 5/5,
    deno edge PASS. One ENVIRONMENT finding (emulator contention vs J8
    headroom floor) triaged with measured recovery; ceiling never
    breached. Arch/security/docs/sweep: evidence-led no-change with
    recorded rationale. Adversarial verification: 1 FAIL (F1–F3) → fixed →
    re-verified PASS.
- Follow-up: Wave 1E tooling (`--auth-mock` lane support; runner-JSON
  flow-result enrichment) as a dedicated tested change; multi-AVD
  repetition when a native triage question needs it; real-corpus
  migration fixtures remain open per known-gaps #5/#6.
