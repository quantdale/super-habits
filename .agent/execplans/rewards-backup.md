# Preserve reward history in backups

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Portable imports and cloud restores preserve XP, levels, streak freezes, quests and badges.

## Context

The SQLite reward ledger has four tables. Portable files use the backup scope and canonical checksums. Cloud generations carry checksummed chunks under a verified owner. The existing mutable-cloud tables follow the sync outbox contract.

## Scope

Add current snapshot coverage, restore validation, historical compatibility, and regression evidence.

## Non-Goals

Changing the XP economy, adding reward records to the sync outbox, or deploying to hosted services.

## Current Checkpoint

- Current milestone: Complete.
- Completed: Versioned portable and cloud snapshots preserve the four reward tables. Legacy recovery, owner checks, rollback, and the Chromium round trip passed.
- In progress: None.
- Important modified files: Core backup and portable contracts, reward data and provider, PostgreSQL migration, integration and browser tests, and backup and release docs.
- Last successful validation: 5,528 full Vitest tests, 822 focused tests, 13 Chromium tests, 89 local PostgreSQL checks, five-zone date verification, typecheck and lint.
- Current failures: None.
- Relevant quarantines: Two existing opt-in backend Vitest skips.
- Blockers: None.
- Exact next action: None — task complete.
- Remaining definition of done: Complete.

## Progress

- [x] Set up the worktree and trace the backup paths.
- [x] Reproduce missing reward data.
- [x] Implement and verify the portable and cloud snapshot changes.
- [x] Document and package the verified fix in the task commit.

## Surprises & Discoveries

- The cloud generation verifier has an explicit entity scope independent of the mutable backup tables.

## Decision Log

- Use immutable cloud generations for rewards so individual reward writes never enter the sync outbox.
- Apply the existing empty-device guard to reward-only content. Eligible legacy restores leave rewards empty and do not award imported activity.
- Portable format 3 and immutable cloud scope 10 carry the four checksummed tables. Preserve the mutable Scope 9 manifest and older snapshot checksums.

## Validation Ledger

- FAIL — `npx vitest run tests/integration/portableExportImport.test.ts tests/integration/generationClientRecovery.test.ts -t "preserves the reward ledger"` — both restores returned four empty reward tables.
- FAIL — `E2E_PORT=8141 flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npx playwright test --project=chromium e2e/portable-backup.spec.ts --grep earned-and-spent` — source displayed 166 XP, and the restored UI did not.
- PASS — `npx vitest run portable backup restore gamification generation recurrenceBackup accountSupabaseMock` — 821 tests passed in the first corrected run.
- PASS — `E2E_PORT=8141 flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npx playwright test --project=chromium e2e/portable-backup.spec.ts e2e/gamification.spec.ts` — 13 passed, including restored 166 XP and one earned-and-spent freeze.
- PASS — `node scripts/qualify-backup-generations.mjs --pg-bin "$PWD/.tmp-pg/root/usr/lib/postgresql/17/bin"` — 89 checks passed on PostgreSQL 17.12 with local auth shims.
- PASS — `npm run qa:timezones` — 129 cases passed in each of five zones.

- PASS — `flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npm test` — 5,528 passed, 2 existing opt-in backend tests skipped.
- PASS — `npx vitest run portable backup restore gamification generation recurrenceBackup accountSupabaseMock` — 822 passed on the final implementation.
- PASS — `npm run typecheck`, `npm run supabase:schema:validate`, `npm run openspec:validate`, and `node scripts/release-facts-guard.mjs`.

- PASS — `npm run lint` after fixing type narrowing in the reward row validator.
- PASS — `E2E_PORT=8141 flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npm run build:e2e` and the final Chromium command above. All 13 tests passed, and port 8141 is free.
- PASS — `npm run web:hygiene` and `npm run agent:plan:validate:all`.

## Changed Files / Areas

- Core backup, portable backup, reward persistence, regression tests and backup contract docs.

## Recovery / Resume Instructions

Read AGENTS.md and .agent/PLANS.md, run npm run agent:resume -- --plan .agent/execplans/rewards-backup.md, reconcile Git and QA evidence, then follow the checkpoint.

## Outcomes & Retrospective

Portable format 3 and immutable cloud scope 10 recover reward history with
feature data. A successful older restore starts at 0 XP and level 1 with no
earned or spent freezes. Existing reward-only data triggers the same
empty-device protection as other local history. Cloud behavior was verified
with SQLite, a transport double, and PostgreSQL 17.12, with deployment still
pending.
