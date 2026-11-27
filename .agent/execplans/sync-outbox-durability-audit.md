# Sync outbox durability audit

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Verify that committed local changes survive interruption, reconnect, and
partial pushes, and that outbox retries cannot strand unrelated data or send
it under another account. Reproduce each fix before editing production code.

## Context

The SQLite outbox stores one revision per entity and ID. The sync engine
retires only the revision it attempted. The adapter pushes owner-scoped rows
and integrates with the immutable backup checkpoint. Browser SQLite uses
Expo's dedicated worker and the OPFS access-handle pool.

## Scope

Work in /workspace/wt-cx-sync on rv/sync-durability at acf859f2. Audit
core/sync, SQLite writer and web worker behavior, and outbox enqueue callers.

## Non-Goals

Exclude workout and gamification feature files, the backup generations
directory, and remote migrations. Use local mocks and port 8146. Preserve
existing tests, use the shared lock for heavy runs, and commit locally.

## Current Checkpoint

- Current milestone: Complete. Four defects fixed and committed locally with failing and passing regression evidence.
- Completed: Scoped source audit, real-SQLite regressions, static gates, full Vitest, Chromium infrastructure and sync journeys, and baseline attribution.
- In progress: None.
- Important modified files: Sync adapter, engine, retry ledger, errors, three integration suites, and this plan.
- Last successful validation: Typecheck, lint, Vitest 5,579 passed, Chromium infrastructure 10 passed, baseline portable export integration 2 passed, and port hygiene.
- Current failures: One preexisting Chromium assertion expects portable export version 2. Baseline integration and unchanged source confirm that the exporter already emits version 3.
- Relevant quarantines: None. Chromium serial execution prevented the next matching-account import step after the assertion failed.
- Blockers: None for the audit deliverables.
- Exact next action: None. Task complete.
- Remaining definition of done: Complete.

## Progress

- [x] Read the brief and repository rules.
- [x] Reproduce and address confirmed defects.
- [x] Run affected integration and browser verification.
- [x] Record final evidence and commit.

## Surprises & Discoveries

- A persistent error in the second batch blocked a healthy unsent third batch after five flushes.
- A push could observe an uncommitted habit edit on the shared SQLite handle and clear the earlier durable intent after rollback.
- A blocked update caused a later delete to fall out of retry after one offline error, both in the original process and after rehydrate. Store retry evidence with the attempted revision.
- A Postgres check or uniqueness failure can reject a statement because of one record. Bisect only those typed rejections so valid neighbors can upload and be acknowledged.
- App bootstrap already uses a page-lifetime Web Lock before opening the OPFS worker. The browser infrastructure test exercises a second tab.

## Decision Log

- Use real SQLite for outbox state and the existing Supabase transport mocks for server outcomes.

## Validation Ledger

- 2026-11-27 — Worktree sanity — PASS — clean rv/sync-durability at acf859f2.

- 2026-11-27 — `npx vitest run --project integration tests/integration/syncResponseCaps.test.ts -t 'stores a healthy later batch'` — FAIL before the fix, expected healthy row absent.
- 2026-11-27 — `npx vitest run --project integration tests/integration/syncResponseCaps.test.ts` — PASS 14 after the fix.
- 2026-11-27 — `npx vitest run --project integration tests/integration/syncPushVerification.test.ts -t 'writer rolls back'` — FAIL before the fix, uploaded rolled-back title.

- 2026-11-27 — `npx vitest run --project integration tests/integration/syncPushVerification.test.ts tests/integration/syncResponseCaps.test.ts` — PASS 18 after the committed-read fix.
- 2026-11-27 — `E2E_PORT=8146 flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npm run build:e2e` — PASS, local-only export used for the infrastructure probe.
- 2026-11-27 — `E2E_PORT=8146 flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npx playwright test --project=chromium e2e/infrastructure.spec.ts` — PASS 10.

- 2026-11-27 — `npx vitest run --project integration tests/integration/syncOutboxPartialFailure.test.ts -t 'replacement delete'` — FAIL 2 before the fix, replacement queue count was zero.
- 2026-11-27 — `npx vitest run tests/integration/syncOutboxPartialFailure.test.ts tests/sync.engine.test.ts tests/outboxRetryAccounting.test.ts tests/integration/backupCheckpoint.test.ts` — PASS 42 after the revision fix.

- 2026-11-27 — `npx vitest run --project integration tests/integration/syncResponseCaps.test.ts -t 'row-specific constraint'` — FAIL before the fix, both valid neighbors were absent remotely.
- 2026-11-27 — `npx vitest run --project integration tests/integration/syncResponseCaps.test.ts` — PASS 15 after the fix.
- 2026-11-27 — `npm run qa:affected -- --base origin/main` — PASS, sync/restore and agent workflow impact. Run the affected persistence and browser lanes.

- 2026-11-27 — `npm run typecheck` and `npm run lint` — PASS.
- 2026-11-27 — `npm test -- --maxWorkers=4` — PASS 5,579, skipped 2.
- 2026-11-27 — `E2E_PORT=8146 flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npm run build:sync` — PASS, dummy-only export.
- 2026-11-27 — `E2E_PORT=8146 E2E_DIST_DIR=dist-sync E2E_BASE_URL=http://localhost:8146 flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh node --require ./.tmp-sync-durability-audit/playwright-network.cjs node_modules/@playwright/test/cli.js test --project=journeys-sync` — 50 passed, 1 failed, 1 did not run. The matching-account portable case at e2e/journeys/portable-owner-recovery.spec.ts:334 expects version 2 and got version 3. The dependent matching-account import step is blocked by serial execution. Partial push, outage/backoff, wrong-owner isolation, reload, and reconnect all passed. The browser launch preload disables non-local hostname resolution while retaining routed mocks.
- 2026-11-27 — `git diff --exit-code acf859f2 -- e2e/journeys/portable-owner-recovery.spec.ts core/portable/portableFormat.ts core/portable/portable.types.ts` — PASS. The assertion, export version constant, and exporter assignment match the base commit.
- 2026-11-27 — `npx vitest run --project integration tests/integration/portableExportImport.test.ts -t 'valid envelope|one-way owner fingerprint'` in an archive of acf859f2 — PASS 2. Confirmed baseline format 3 export and owner fingerprint. The supplemental baseline Chromium replay was cancelled while waiting for the shared build lock. Current-tree failure artifacts remain under .cursor/playwright-output/e2e-failures.
- 2026-11-27 — `npm run web:hygiene -- 8081 8082 8146` — PASS. All three ports free.

## Changed Files / Areas

- .agent/execplans/sync-outbox-durability-audit.md — audit checkpoint and evidence.
- core/sync/supabase.adapter.ts and core/sync/syncErrors.ts — upload outcomes, committed reads, and row-constraint isolation.
- core/sync/sync.engine.ts and core/sync/outboxAttempts.ts — revision-scoped retry decisions across restarts.
- tests/integration/syncResponseCaps.test.ts, syncPushVerification.test.ts, and syncOutboxPartialFailure.test.ts — real-SQLite regressions with local adapters.

## Recovery / Resume Instructions

1. Read AGENTS.md, .agent/PLANS.md, this plan, and /workspace/pi-sessions/cx/cx1-sync.brief in the designated worktree.
2. Reconcile Git changes and QA evidence, then run the plan resume command for this file and follow Exact next action.

## Outcomes & Retrospective

- Status: Completed.
- Fix commits: 73abd177 isolates bounded request results. ac77a4f0 serializes projection reads against the SQLite writer. 0b5b7dfe scopes retry evidence to the revision. b9ed6d4e isolates row-specific constraint failures.
- Chromium classification: TEST_BUG for the preexisting portable export assertion. Its dependent matching-account step did not run. The wrong-account, reload, reconnect, and partial-failure journeys passed.
- The audit used real local SQLite, the existing Supabase mocks, and Chromium on port 8146.
