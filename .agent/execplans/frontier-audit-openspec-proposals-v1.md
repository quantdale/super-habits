# ExecPlan: Frontier repository audit → OpenSpec proposals

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Perform a repository-wide engineering audit of SuperHabits against
`D:\Downloads\frontier open spec.txt` and convert every sufficiently
substantiated, material, actionable finding that is not already covered by
`openspec/specs/` or archived/active OpenSpec changes into implementation-ready
OpenSpec change proposals. Do not implement product code. Leave new changes
active with implementation tasks unchecked.

## Context

- SuperHabits: Expo + RN + PWA, SQLite source of truth, optional Supabase backup.
- OpenSpec 1.8.0, schema `spec-driven`, ~57 capabilities, archive-only changes
  (zero active at campaign start).
- Skills: `.cursor/skills/openspec-explore`, `.cursor/skills/openspec-propose`.
- Campaign is NOT itself an OpenSpec change; this ExecPlan is the durable state.
- Evidence and the final report live under the goal scratch dir.

## Scope

- Repository-wide audit (source, tests, CI, OpenSpec corpus, scripts/tooling).
- Hidden-signal search, flow tracing, diagnostics as evidence.
- New OpenSpec changes for justified, non-duplicate remaining work.
- Final report with the nine required headings.

## Non-Goals

- Implementing, applying, or archiving proposed product changes.
- Syncing deltas into main `openspec/specs/`.
- Rewriting functioning systems; speculative vulnerabilities.
- Line-by-line review of generated trees (`node_modules/`, `dist/`, etc.).
- A minimum number of OpenSpec changes.

## Current Checkpoint

- Current milestone: COMPLETE — audit converted into three active OpenSpec changes.
- Completed: Inventory, deep audit, triage, three instruction-driven changes,
  strict + aggregate validation (twice), report.
- In progress: None — task complete.
- Important modified files: this ExecPlan; `openspec/changes/fix-backup-push-hard-delete-and-owner-stamping/`; `openspec/changes/close-gamification-overnight-reconcile-gap/`; `openspec/changes/route-workout-day-reminder-taps/`.
- Last successful validation: `openspec validate --all` 60/60 twice; typecheck PASS; lint PASS; vitest 2055/2055.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Complete.

## Progress

- [x] Create campaign ExecPlan; inventory OpenSpec; map topology.
- [x] Deep-inspect, trace flows, hidden signals, diagnostics.
- [x] Triage vs OpenSpec corpus; group change boundaries.
- [x] Propose justified OpenSpec changes via installed workflow.
- [x] Strict-validate, aggregate-validate twice, second-pass, successor loop.
- [x] Write frontier-audit-report.md; capture git path list.

## Surprises & Discoveries

- Zero active OpenSpec changes at campaign start; large archived corpus.
- Gamification is a complete shipped local-only layer with no OpenSpec
  capability. Restating the whole feature is not justified; one overnight
  reconcile/freeze ordering defect is.
- `workout-correction` requires durable delete intents for accidental logs,
  but `BACKUP_NEVER_DELETED_ENTITIES` still lists `workout_logs` /
  session tables as append-only. Adapter throws; outbox sticks; restore
  can resurrect the deleted session.
- Notification and linked-action completion paths call `syncEngine.prepare`
  without `ownerUserId`; todo reminder path also skips `enqueuePrepared`.
- Several user-visible holes (restore UI refresh, Settings V1 copy, Auto
  misroute, settings form clobber, submit-guard on workout, CI label
  parity) are already required by existing specs — do not duplicate.

## Decision Log

- 2026-09-14 — Keep this campaign's state in `.agent/execplans/` rather than
  inventing an OpenSpec change for the audit itself. The frontier directive
  wants OpenSpec changes only for justified product/engineering work.
- 2026-09-14 — Propose exactly three new changes: backup-push hard-delete +
  owner stamping; gamification prior-day reconcile before freeze; workout-day
  reminder tap routing. Already-specified incomplete implementations are
  reported, not re-proposed.

## Validation Ledger

- 2026-09-14 — `openspec list --json` — PASS — `"changes": []`.
- 2026-09-14 — `openspec validate --help` — PASS — supports `--strict`,
  `--all`, `--changes`, `--type change`.
- 2026-09-14 — `npm run typecheck` — PASS — 0 errors.
- 2026-09-14 — `npm run lint` — PASS — 0 errors / 0 warnings.
- 2026-09-14 — `npm test` — PASS — 2055 / 196 files.
- 2026-09-14 — `openspec validate <change> --type change --strict` × 3 — PASS.
- 2026-09-14 — `npm run openspec:validate` × 2 — PASS — 60/60 both runs.

## Changed Files / Areas

- `.agent/execplans/frontier-audit-openspec-proposals-v1.md` — campaign state.
- `openspec/changes/fix-backup-push-hard-delete-and-owner-stamping/` — High backup-push change.
- `openspec/changes/close-gamification-overnight-reconcile-gap/` — Medium-High ledger change.
- `openspec/changes/route-workout-day-reminder-taps/` — Medium notification routing change.

## Recovery / Resume Instructions

1. Read AGENTS.md, `.agent/PLANS.md`, this ExecPlan.
2. `git status --short` and `git diff --name-only`.
3. `openspec list --json`.
4. Continue from Exact next action. Do not implement product code.

## Outcomes & Retrospective

- Status: Completed.
- Summary: Repository-wide audit; three active OpenSpec changes; no product-code edits; report in scratch `frontier-audit-report.md`.
- Follow-up: Implement the three changes later via `/opsx:apply`. Do not treat planning as production certification. Already-specified implementation gaps (restore UI refresh, Settings V1 copy, Auto misroute, settings draft hydration, remaining submit guards, CI label parity) stay on their existing specs.
- Lessons: Inventory coherence tests can lock a broken partition and still pass; archive plans whose Purpose lines were left unfilled are hygiene, not remaining product work.
