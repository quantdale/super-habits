---
Plan-Version: 2
Status: COMPLETED
---

# Acceptance response: finalize the backup-integrity correction package

## Purpose / User Outcome

Act on the independent acceptance review
(`docs/audit/BACKUP_INTEGRITY_ACCEPTANCE_REPORT_2026-10-20.md`,
ACCEPT_WITH_CONDITIONS): implement the three pre-integration conditions plus the
local hardening items, re-verify every gate, and land the whole package as one
controlled local commit. No push, merge, deployment, or production migration.

## Context

- Worktree: `D:\Documents\tryPython\superhabits-post-acceptance`
- Branch: `fix/post-acceptance-defects`, base `85599dfbf3cbe2077f04ae51bfe3c19b6c04bff3`
- Input: acceptance findings W-1..W-8 (Section G of the acceptance report)
- Predecessor plan: `.agent/execplans/post-acceptance-correction-v1.md` (COMPLETED)

## Scope

1. W-1: close the provenance-0 reservation-hijack wedge in the unapplied
   migration; extend `scripts/qualify-backup-provenance.mjs` (hijack resistance,
   reservation idempotency, cleanup preservation); re-qualify.
2. F7 conditions: amend the final report (W-1 disclosure, §F5 evidence-list
   qualification, W-2 flake classification).
3. W-5 comment fix; W-3 preview blast-radius fix (+tests); W-4 false-failure fix.
4. Full gate re-run (typecheck, lint, unit, integration, both qualify lanes).
5. One controlled local commit; no push/merge.

## Non-Goals

- Hosted/native/cloud certification, production migration, browser lane re-runs
  on Node 22, SH-20/SH-21 (external release gates).

## Current Checkpoint

- Current milestone: Complete.
- Completed: W-1 fix + 3 new SQL qualification cases (PASS on PostgreSQL 17.5);
  report §K acceptance response; W-3/W-4/W-5 fixes; 2 new preview tests;
  acceptance report committed as repo evidence; full gates green (unit retains
  the classified W-2 flake: `tests/portableExportSize.test.ts` 5s timeout under
  full parallel load, passes isolated).
- In progress: None.
- Important modified files: `supabase/migrations/20261020090000_enforce_backup_publication_provenance.sql`,
  `scripts/qualify-backup-provenance.mjs`, `core/sync/restore.coordinator.ts`,
  `core/backup/backupConflictResolution.ts`, `core/backup/generations/generationFormat.ts`,
  `tests/restore.coordinator.test.ts`, `docs/audit/*`.
- Last successful validation: 2026-10-20 — `backup:provenance:qualify` PASS
  (post-fix, incl. hijack/idempotency/preservation cases); targeted 23/23 unit +
  30/30 integration; typecheck/lint/prettier PASS; integration 103/1.
- Current failures: none task-caused; W-2 flake classified and documented.
- Relevant quarantines: None — this plan created no quarantines and skipped no
  tests; the inherited W-2 flake (`tests/portableExportSize.test.ts`, 5s
  timeout under full parallel load) stayed in the suite and is classified
  FLAKY_TEST/environment, not quarantined.
- Blockers: none locally; hosted/native gates external.
- Exact next action: None — task complete.
- Remaining definition of done: None — all authorized plan work (W-1 fix and
  re-qualification, F7 report amendments, W-3/W-4/W-5 hardening, full gate
  re-run, one controlled local commit) is complete and evidenced in the
  Validation Ledger above. External release qualifications (hosted Supabase,
  production migration authorization, native/SH-11, browser lanes on pinned
  Node 22, SH-20/SH-21) remain outside this plan's authorized scope and are
  not claimed as complete.

## Progress

- [x] Fix W-1 trigger (exact reservation match: sequence + provenance + base pair)
- [x] Extend qualification (hijack resistance, reservation idempotency, cleanup preservation)
- [x] Re-qualify on disposable PostgreSQL 17.5 (actual migration chain)
- [x] Amend final report §F5 + add §K acceptance response (F7 conditions)
- [x] W-5 comment fix (content protocol vs capability version)
- [x] W-3 fix + 2 discriminating preview tests
- [x] W-4 fix (post-commit maintenance best-effort)
- [x] Full gate re-run and honest ledger
- [x] Commit as one controlled change (no push/merge)

## Surprises & Discoveries

- The provenance-0 hijack needed TWO trigger variants blocked (NULL base and
  mirrored base), so the fix requires exact provenance-version equality with the
  reservation, not just base-pair matching.
- The second-owner cleanup-preservation fixture needed an `auth.users` row
  (FK on `backup_generation_sequence_reservation.user_id`).
- `pull()` returning `[]` materially bounds the mutable-staging TOCTOU: stale
  staging rows cannot regress other devices; only the no-generation fallback and
  legacy V1 reads observe them.

## Decision Log

- 2026-10-20 — W-1 fixed in place (migration unapplied anywhere); threat scope
  restated: same-account reservation-conforming writes remain inside the account
  trust domain by design.
- 2026-10-20 — W-2 classified FLAKY_TEST/environment (inherited; load-sensitive
  5s timeout), not a correction regression.
- 2026-10-20 — W-6 accepted as-is (idempotent shortcut is state-free).

## Validation Ledger

| Date       | Command                                         | Outcome                                            |
| ---------- | ----------------------------------------------- | -------------------------------------------------- |
| 2026-10-20 | `backup:provenance:qualify` (post-fix, Node 22) | PASS — incl. hijack/idempotency/preservation cases |
| 2026-10-20 | `backup:generations:qualify`                    | PASS — PostgreSQL 17.5                             |
| 2026-10-20 | targeted unit (restore.coordinator + prompt)    | PASS — 23/23 (2 new W-3 tests)                     |
| 2026-10-20 | targeted integration (3 gate suites)            | PASS — 30/30                                       |
| 2026-10-20 | `typecheck` / `lint` / `prettier --check`       | PASS                                               |
| 2026-10-20 | `vitest --project integration` (full)           | PASS — 103 passed / 1 skipped                      |
| 2026-10-20 | `vitest --project unit` (full)                  | 2430 passed / 1 flaky (W-2, classified)            |

## Changed Files / Areas

- `supabase/migrations/20261020090000_enforce_backup_publication_provenance.sql`
- `scripts/qualify-backup-provenance.mjs`
- `core/sync/restore.coordinator.ts`, `core/backup/backupConflictResolution.ts`,
  `core/backup/generations/generationFormat.ts`
- `tests/restore.coordinator.test.ts`
- `docs/audit/BACKUP_INTEGRITY_CORRECTION_FINAL_REPORT_2026-10-20.md`,
  `docs/audit/BACKUP_INTEGRITY_ACCEPTANCE_REPORT_2026-10-20.md`

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan, and the acceptance report.
2. `git status --short` / `git diff --stat` — Git wins over narrative.
3. Resume only from `Exact next action` (none — task complete).

## Outcomes & Retrospective

All three pre-integration conditions plus W-3/W-4/W-5 hardening are implemented
and re-verified; the acceptance conditions are satisfied locally. Remaining
work is exclusively external release certification (hosted Supabase, production
migration authorization, native/SH-11, browser lanes on pinned Node 22,
SH-20/SH-21).
