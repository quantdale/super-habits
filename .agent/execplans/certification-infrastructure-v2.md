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

- Current milestone: Waves 0–6 COMPLETE at `0b0b3c0`; Wave 7 opening.
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
- In progress: Wave 7 CI/nightly placement evaluation.
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
- Exact next action: Open Wave 7 evaluation (audit matrix.ts +
  CI workflows vs Wave 1–6 evidence; placement decision only).
- Remaining definition of done: Wave 7 decision; Wave 8 battery;
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
- 2026-09-04 — Waves 5/6 closure: repeat 5/5; typecheck 0; lint 0;
  impact 13 valid; unit×2 collated PASS; p0×2 collated PASS (25/25
  each, fresh dist/ once); provenance-contract PASS; hygiene PASS +
  adb empty; plans validated; feat(qa) @4049450 + docs(agent) @0b0b3c0.

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
