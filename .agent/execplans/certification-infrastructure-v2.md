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

- Current milestone: Wave 0 COMPLETE at `2502a75`; Wave 1 opening.
- Completed: Wave 0 recertification — hygiene PASS (8081/8082 free);
  `git diff --check` clean; typecheck 0; lint 0 (max-warnings 0);
  unit 1665/1665; journey-label parity OK; impact map 13 rules valid;
  themes 140/140; Supabase schema PASS; OpenSpec 50/50;
  `agent:plan:validate:all` PASS (incl. this ACTIVE plan); sim:validate
  23/23. Native presence: adb OK with 0 devices attached (nothing
  booted); AVDs present: CRBABot_API_36, Nitro_API_36,
  braintraining-qa36, braintraining36 (same set as predecessor
  observed); Maestro 2.8.0. No tree drift: `app core features lib
scripts supabase` identical to `1e1f4d0` (only tracked diff since
  Planned-From is the ACTIVE prompt itself).
- In progress: Wave 2 auth-mock lifecycle automation (workstream
  plan next).
- Important modified files: `.agent/execplans/certification-infrastructure-v2.md`
  (this plan).
- Last successful validation: planner-era `agent:plan:validate:all` PASS +
  `openspec:validate` 50/50 PASS (pre-executor, at planning commit).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Open Wave 1 workstream ExecPlan, audit
  `scripts/qa-native*.mjs` + `native-qa-utils.mjs` + provisioner, then
  implement sequential multi-AVD orchestration with unit tests.
- Remaining definition of done: Waves 0–10 evidenced per prompt; tooling
  landed with tests; corpus reproducible; battery green; verifier PASS;
  clean pushed main; prompt marked COMPLETED.

## Progress

- [x] Git truth reconciled; master orchestration plan opened.
- [x] Wave 0 recertification (hygiene, baseline, native presence, drift check).
- [x] Wave 0 recertification (done). Wave 1 COMPLETED 2026-09-04:
      orchestration landed + 8/8 tests; Nitro + CRBABot smoke 2/2 each
      @45dc256; PRODUCT_BUG (FAB tap race, fixed in app/index.tsx) +
      TEST_BUGs (below-fold scrolls, keyboard hide, fixed in flows)
      verified both AVDs; commits 3c1ddfe/ab3588c/9be8bcd/94d2c80/
      65063a5/45dc256 pushed.
- [ ] Wave 2 auth-mock lifecycle automation + tests + auth 3/3 ×N.
- [ ] Wave 3 historical DB corpus (seeded synthetic; regeneration proof).
- [ ] Wave 4 corpus-backed migration/restart/performance certification.
- [ ] Wave 5/6 repetition framework + provenance standardization.
- [ ] Wave 7 CI/nightly evaluation with placement decision.
- [ ] Wave 8 expensive stability battery (quiet window).
- [ ] Wave 9 adversarial verification PASS; Wave 10 P0/P1 sweep.
- [ ] Prompt marked COMPLETED; final report appended; clean pushed main.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-04 — One master orchestration plan + per-workstream plans opened
  lazily as implementation work opens (predecessor precedent). No OpenSpec
  change until a workstream justifies one.

## Validation Ledger

- 2026-09-04 — planner `agent:plan:validate:all` — PASS (all versioned plans).
- 2026-09-04 — planner `openspec:validate` — PASS 50/50.
- 2026-09-04 — Wave 0 at `2502a75`: hygiene PASS; `git diff --check`
  clean; typecheck 0; lint 0; unit 1665/1665; label parity OK;
  impact 13; themes 140/140; supabase schema PASS; openspec 50/50;
  plan:validate:all PASS; sim:validate 23/23; adb 0 devices; 4 AVDs
  present; Maestro 2.8.0; no product-tree drift vs `1e1f4d0`.

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
