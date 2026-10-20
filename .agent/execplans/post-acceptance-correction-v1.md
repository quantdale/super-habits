---
Plan-Version: 2
Status: COMPLETED
---

# Backup integrity correction F1–F7

## Purpose / User Outcome

Correct the independent review's F1–F4 backup-generation integrity defects,
close the F5–F7 evidence/documentation findings, validate the actual client and
PostgreSQL paths, and leave a reviewable local package for a new independent
acceptance review. No commit, push, merge, deployment, or production migration.

## Context

- Repository: `https://github.com/quantdale/super-habits`
- Base review SHA: `85599dfbf3cbe2077f04ae51bfe3c19b6c04bff3`
- Isolated worktree: `D:\Documents\tryPython\superhabits-post-acceptance`
- Branch: `fix/post-acceptance-defects`
- The previous correction package was preserved, not recreated.
- Authoritative requirements: `openspec/changes/resolve-independent-repository-audit/`
- Final report: `docs/audit/BACKUP_INTEGRITY_CORRECTION_FINAL_REPORT_2026-10-20.md`
- The earlier report is retained as historical evidence with a superseded banner.

## Scope

1. Distinguish an observed remote head from a verified local baseline (F1).
2. Reject stale pending captures before mutable remote writes (F2).
3. Make keep-local resolution ordering safe and retryable (F3).
4. Enforce publication provenance and old-client fencing in an additive migration (F4).
5. Replace mock-only evidence with production-path tests and a real PostgreSQL lane (F5).
6. Add the active-conflict capture guard and re-read durable evidence for conflicts (F6).
7. Correct the completion report and preserve prior evidence (F7).
8. Preserve SH-04/SH-13; keep SH-11's native gap explicit.

## Non-Goals

- Hosted Supabase/PostgREST/Auth/RLS certification.
- Production migration/deploy or any commit/push/merge.
- Native Android/iOS notification lifecycle execution.
- Dependency-advisory waiver or unrelated feature work.

## Current Checkpoint

- Current milestone: Complete — local implementation, qualification, adversarial review, and final report are done.
- Completed: F1 verified-baseline correction and no unsafe sequence promotion; F2 generation-first pending-capture ordering; F3 clear-first/mark-last resolution with durable resume marker; F4 additive PostgreSQL provenance migration plus capability/old-client fences and privilege cleanup; F5 production-path adapter/maintenance/PostgreSQL evidence; F6 active-conflict guard, transactional conflict re-read, malformed-state fail-closed; F7 superseded banner and corrected final report.
- In progress: None — task complete.
- Important modified files: `core/sync/supabase.adapter.ts`; `core/backup/generations/capture.ts`; `core/backup/generations/conflict.ts`; `core/backup/generations/generationProtocol.ts`; `core/backup/generations/generationFormat.ts`; `core/backup/backupConflictResolution.ts`; `core/backup/backupRestore.ts`; `core/db/appMeta.ts`; `supabase/migrations/20261020090000_enforce_backup_publication_provenance.sql`; `scripts/qualify-backup-provenance.mjs`; `tests/integration/*` backup/conflict suites; `e2e/journeys/bad-backend.spec.ts`; `e2e/helpers/generationSupabaseMock.ts`; `package.json`; final report.
- Last successful validation: 2026-10-20 — pinned Node 22.23.2 `qa:fast` PASS (typecheck, lint, 194 unit files, guards); integration 103 passed / 1 skipped; PostgreSQL provenance qualification PASS; browser P0 25/25, sync 52/52, SH-04/13 2/2.
- Current failures: Repo-wide `format:check` is red on 91 pre-existing unrelated files; changed/new files pass `prettier --check`. No task-caused failure remains.
- Relevant quarantines: None added or changed.
- Blockers: None for local work; hosted/native production qualification remains external.
- Condition required to unblock: Authorized hosted/native/production migration environment.
- Exact resume action after unblock: Run hosted concurrency/RLS, native SH-11 rejection, then production rollout after client deployment.
- Exact next action: None — task complete.
- Remaining definition of done: Complete locally — F1–F7 evidence-backed; stale publication blocked; keep-local ordering safe; server provenance qualified; final report corrected; SH-04/13 preserved; SH-11 and external gates explicitly reported.

## Progress

- [x] Reconstruct F1–F7 from the rejected review and actual source.
- [x] Implement verified local baseline and remove unsafe sequence promotion.
- [x] Preflight pending captures and publish generation-first.
- [x] Fix keep-local ordering, marker, and conflict race handling.
- [x] Add server provenance migration, cleanup, and privilege hardening.
- [x] Add production-path adapter, conflict, and PostgreSQL tests.
- [x] Run pinned Node quality/integration/PostgreSQL gates.
- [x] Run final browser SH-04/SH-13, P0, and sync journeys.
- [x] Run independent adversarial reviews and address mandatory findings.
- [x] Write corrected final report and update ExecPlan.
- [x] Validate OpenSpec and ExecPlan structure; confirm ports free and worktree uncommitted.

## Surprises & Discoveries

- The device-global `backup.generation_sequence` counter can survive owner replacement; it cannot be used as provenance.
- Old clients could leave both legacy and normal captures populated; the legacy early return then bypassed the normal-capture preflight.
- Supabase-style default table grants include TRUNCATE, which bypasses RLS; the migration must revoke ALL and re-grant exact DML.
- A keep-local transaction that marks the conflict resolved before clearing evidence lets a concurrent reader observe an inconsistent resolved state.
- A conflict record could point at a capture replaced between read and write; recording now re-reads inside a transaction.

## Decision Log

- 2026-10-20 — Verified baseline is separate from observed head; no silent promotion from a global sequence.
- 2026-10-20 — Pending captures publish before mutable writes; known stale captures fail before remote mutation.
- 2026-10-20 — Keep-local uses marker → clear → chosen base/dirty → resolve last.
- 2026-10-20 — Server capability 2/provenance 1 fences old clients; content protocol 1 remains restorable.
- 2026-10-20 — Mutable staging TOCTOU is disclosed residual; immutable head protection is authoritative.

## Validation Ledger

| Date       | Command                                            | Outcome                                            |
| ---------- | -------------------------------------------------- | -------------------------------------------------- |
| 2026-10-20 | `npm run qa:fast` (Node 22.23.2)                   | PASS — typecheck, lint, 194 unit files, guards     |
| 2026-10-20 | `npm run test:integration` (Node 22.23.2)          | PASS — 103 files passed, 1 skipped                 |
| 2026-10-20 | `npm run backup:provenance:qualify` (Node 22.23.2) | PASS — actual four-migration PostgreSQL 17.5 chain |
| 2026-10-20 | `npm run backup:qualify`                           | PASS — 67 predecessor checks + provenance lane     |
| 2026-10-20 | `npm run build:e2e`                                | PASS — hermetic export, 0 Supabase hosts           |
| 2026-10-20 | SH-04 + SH-13 focused Playwright                   | PASS — 2/2                                         |
| 2026-10-20 | `npm run e2e:journeys:p0`                          | PASS — 25/25                                       |
| 2026-10-20 | `npm run build:sync`                               | PASS                                               |
| 2026-10-20 | `npm run e2e:sync`                                 | PASS — 52/52                                       |
| 2026-10-20 | `npx prettier --check <changed files>`             | PASS                                               |
| 2026-10-20 | `npm run format:check` (repo-wide)                 | FAIL — 91 pre-existing unrelated files             |
| 2026-10-20 | `npm run web:hygiene`                              | PASS — 8081/8082 free                              |
| 2026-10-20 | `npm run openspec:validate`                        | PASS — 89/89                                       |

## Changed Files / Areas

- `core/sync/supabase.adapter.ts` — verified/observed split, preflight/publication, conflict evidence.
- `core/backup/generations/capture.ts` — `baseHeadProof`, verified-base helpers, F6 guard.
- `core/backup/generations/conflict.ts` — fail-closed reads, resolution marker.
- `core/backup/generations/generationProtocol.ts`, `generationFormat.ts` — capability/provenance versions and v1 restore compatibility.
- `core/backup/backupConflictResolution.ts` — clear-first, resolve-last, resume.
- `core/backup/backupRestore.ts` — restored head becomes verified base.
- `core/db/appMeta.ts` — verified-base, resolution-marker keys.
- `supabase/migrations/20261020090000_enforce_backup_publication_provenance.sql` — server enforcement, cleanup, privileges.
- `scripts/qualify-backup-provenance.mjs` — real PostgreSQL qualification.
- `tests/integration/*` backup/conflict suites and helpers.
- `e2e/helpers/generationSupabaseMock.ts`, `e2e/journeys/bad-backend.spec.ts`.
- `package.json`, `docs/audit/*`, this plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`.
2. Read this plan and `docs/audit/BACKUP_INTEGRITY_CORRECTION_FINAL_REPORT_2026-10-20.md`.
3. Run `git status --short` and `git diff --stat`; Git wins over narrative.
4. Run `npm run agent:resume -- --plan .agent/execplans/post-acceptance-correction-v1.md`.
5. Continue only from the checkpoint; for this completed task, no implementation action remains.

## Outcomes & Retrospective

F1–F7 now have local, evidence-backed dispositions. The immutable recovery head
cannot be advanced by stale captures, old RPC signatures, or unverified local
data; keep-local no longer flushes stale settings/manifest; and the PostgreSQL
migration is proven on the real chain. Remaining risks are explicit: mutable
staging TOCTOU after a successful preflight, keep-local destructive-before-
replacement, pre-provenance owner review, ancient-client mutable staging, and
all hosted/native/cloud gates. No commit/push/merge/deploy occurred.
