# ExecPlan: Overnight Reliability & Real-World Certification Program V1

Plan-Version: 2
Status: ACTIVE

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

- Current milestone: Wave 1 COMPLETE — native baseline green incl. auth 3/3 x3; Wave 2 soak next.
- Completed: planner prompt authored/validated/pushed (2347b4a); executor
  startup reads (AGENTS.md via env, PLANS.md, EXECUTION_PROMPT ACTIVE,
  PLANNER_HANDOFF routing-only); Git reconciliation (HEAD == origin/main ==
  2347b4a, clean, descendant of Planned-From); campaign tracking list created.
- In progress: none (Wave 1 done); Wave 2 native soak queued.
- Important modified files: `.agent/execplans/overnight-reliability-certification-v1.md`
  (this plan); `.maestro/flows/auth-session-*.yaml` (TEST_BUG fixes +
  01/02/03 ordering). No product source changes.
- Last successful validation: Wave 0 executor baseline (2026-09-04) — hygiene PASS; diff-check clean; typecheck 0; lint 0 warnings; unit 1665/1665 (125 files); impact 13 rules; themes 140/140; supabase schema PASS; openspec 50/50; plan:validate:all PASS (incl. this ACTIVE plan after placeholder-word repair); sim:validate 23/23; dev:doctor PASS (Maestro 2.8.0, emulator present, EAS CLI absent/optional); 4 API-36 AVDs present, none booted.
- Current failures: None.
- Relevant quarantines: None (inherited residuals are follow-ups, not
  quarantines).
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Wave 2 — soak repetition (persistence full rerun +
  smoke rerun) on emulator-5554, watching for leaks/stale-state/runtime
  growth; then Waves 5–7 web lanes.
- Remaining definition of done: Waves 0–15 with evidence ledgers; all
  P0/P1 fixed/verified or deferred with evidence; final battery green;
  adversarial verification PASS; docs/gaps reconciled; clean pushed main;
  prompt marked COMPLETED with final report.

## Progress

- [x] Planner prompt ACTIVE at 2347b4a (validated, pushed).
- [x] Wave 0 recertification (git/hygiene/baseline/native-presence) — all green 2026-09-04.
- [x] Wave 1 native lane stability V1 — provision/smoke/persistence/
      lifecycle green; auth 3/3 x3 with exactly-1-signup proof; 2 TEST_BUG
      flow fixes committed (1c725d7 pill text, de89f5b ordering).
- [ ] Waves 2–4 native soak / heavy-state / long-horizon.
- [ ] Waves 5–6 soak-chaos / heavy-state performance.
- [ ] Wave 7 determinism + long-suite batteries.
- [ ] Waves 8–9 clean-env/build + CI hardening.
- [ ] Wave 10 architecture hardening.
- [ ] Waves 11–15 personas/a11y/security/docs/sweep + adversarial verification.

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

## Validation Ledger

- 2026-09-04 — planner `agent:plan:validate:all` — PASS (all versioned plans).
- 2026-09-04 — planner `openspec:validate` — PASS 50/50.
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

- Status: Active.
- Summary: campaign in progress (Wave 0).
- Follow-up: per remaining waves.
