# ExecPlan: Account Recovery Dist-Sync Determinism Closure

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Close the repository-caused GitHub Actions failure that prevents `main` from being
fully green after Weekly Review & Planning V1. The failing `journeys-sync`
account/recovery journeys use duplicated Supabase route mocks that recognize only
the four historical V1 sync tables while production account safety now probes the
complete `BACKUP_ENTITIES + BACKUP_SYNTHETIC_ENTITIES` surface (13 tables + 2
synthetic records). The stale mocks return 404 for legitimate probes, so
production correctly fails closed and the E2E UI never reaches `Protected` or
`Sign-in pending`.

Make the dist-sync account boundary deterministic and contract-aware, add drift
detection so future backup-scope additions cannot silently break account E2E
again, and reconcile the Weekly Review ExecPlan with the actual exact-SHA CI
result. No production fail-closed semantics are weakened; no timeout/retry/skip/
fixme/quarantine band-aids are used.

## Context

- Repository: `quantdale/super-habits`, Expo + React Native, offline-first SQLite.
- Account Coordinator (`core/auth/accountCoordinator.ts`) derives
  `ACCOUNT_REMOTE_BACKUP_ENTITIES = [...BACKUP_ENTITIES, ...BACKUP_SYNTHETIC_ENTITIES]`
  and, in `getRemoteFingerprint`, issues an owner-scoped count/head probe per
  entity: `client.from(entity).select('user_id', { count: 'exact', head: true }).eq('user_id', userId)`.
  This emits a `HEAD` request with `select=user_id`, `user_id=eq.<uid>`, and
  `Prefer: count=exact`; count is parsed from the `content-range` header
  (`0-0/N`), falling back to 0 when absent.
- Production `getRemoteFingerprint` throws if any probe errors (404). The calling
  recovery/protection flows catch and fail closed. This is correct safety
  behavior; the defect is that the E2E mock does not model the full probe
  surface, so it manufactures the 404s itself.
- The two affected journeys (`e2e/journeys/recoverable-account-v1.spec.ts`,
  `e2e/journeys/portable-owner-recovery.spec.ts`) each forward-match only
  `todos|habits|calorie_entries|workout_routines` and 404 everything else under
  `/rest/v1/`.
- In the main `journeys` Playwright project the app build has no configured
  Supabase, so `getRemoteFingerprint` short-circuits (`supabase` is null) and the
  account journeys are `test.fixme`-skipped by `requireAccountBoundary`. In the
  `journeys-sync` project the dist-sync build bakes in a dummy Supabase URL, so
  the probes actually fire and the stale mock 404s them.
- OpenSpec change `fix-account-recovery-dist-sync-determinism` (proposal,
  design, normative spec, tasks, README/IMPLEMENTATION_PROMPT) is already
  authored in the repository at `openspec/changes/fix-account-recovery-dist-sync-determinism/`.

## Scope

- Introduce one shared, backup-aware E2E Supabase REST boundary helper.
- Derive the recognized entity set from the production contract via an explicit
  E2E list plus a mandatory drift-guard unit test (direct `@/` import is avoided
  inside the E2E tree so Playwright never needs to resolve path aliases).
- Refactor the two account/recovery journeys to use the shared helper instead of
  the four-table regex.
- Add a focused shared-helper + drift test.
- Reconcile `.agent/execplans/weekly-review-planning-v1.md` (it falsely claims
  exact-SHA CI green for `36f01f8...`, whose final run `32024054019` was red in
  dist-sync).
- Keep all production account fail-closed semantics intact.

## Non-Goals

- Changing production account ownership / fail-closed logic.
- Weakening RLS, Supabase schema, owner-binding, or portable format.
- Increasing UI assertion timeouts, adding retries, skips, fixmes, or quarantine
  as the root fix.
- Creating a permissive catch-all mock for arbitrary unknown endpoints.
- New product features.

## Current Checkpoint

- Current milestone: IMPLEMENT — build shared boundary + drift guard, refactor
  the two journeys, reconcile the Weekly Review plan, then run full QA.
- Completed:
  - Root cause independently verified from GitHub Actions run `32024054019`
    (per proposal/README).
  - OpenSpec proposal, design, normative spec, tasks, README/IMPLEMENTATION_PROMPT
    authored upstream at `openspec/changes/fix-account-recovery-dist-sync-determinism/`.
  - Fresh session fetched/pruned `origin/main`; local `main` reconciled to
    `a82bbe4` (fast-forward, tree clean).
  - Verified request/response shape by reading `postgrest-js` (HEAD +
    `content-range` count) and the Account Coordinator source.
- In progress: authoring the shared helper + drift guard and refactoring the two
  journeys.
- Important modified files: (expected) `e2e/helpers/accountBackupEntities.ts`
  (new), `e2e/helpers/accountSupabaseMock.ts` (new),
  `tests/accountSupabaseMock.drift.test.ts` (new),
  `e2e/journeys/recoverable-account-v1.spec.ts` (refactor),
  `e2e/journeys/portable-owner-recovery.spec.ts` (refactor),
  `.agent/execplans/weekly-review-planning-v1.md` (reconcile).
- Last successful validation: `npm run e2e:sync` — 44 passed (3.6m); main-lane
  E2E — 167 passed / 41 skipped; all quality gates green.
- Current failures: none (pre-commit).
- Relevant quarantines: none.
- Blockers: none.
- Condition required to unblock: none.
- Exact resume action after unblock: none.
- Exact next action: commit all changes to `main`, push without force, verify
  exact-SHA GitHub Actions `quality` + `e2e` PASS.
- Remaining definition of done: see OpenSpec `tasks.md` Definition of Done —
  dist-sync fully green, production safety unchanged, Weekly Review plan
  reconciled, all QA green, committed + pushed, working tree clean, local
  `main == origin/main`, only remote `main`, exact final SHA has GitHub Actions
  `quality` PASS and `e2e` PASS.

## Progress

- [x] 0.1 Root cause verified from run `32024054019` (stale four-table mock vs
      15-entity production probe surface).
- [x] 0.2 Proposal/design/spec/tasks/README authored upstream.
- [x] 0.3 Fresh session fetched latest `origin/main` (a82bbe4), verified SHA.
- [x] 0.4 Run `openspec:validate` + `agent:plan:validate:all`; repair schema.
- [x] 1.x Reproduce the exact dist-sync failure locally.
- [x] 2.x Shared backup-aware E2E boundary helper.
- [x] 3.x Drift-guard + negative test.
- [x] 4.x Recoverable Account V1 journey refactor.
- [x] 5.x Portable owner recovery journey refactor.
- [x] 6.x Determinism proof (first-attempt passes, no retry dependency).
- [x] 7.x Production regression (coordinator/domain/portable/backup tests).
- [x] 8.x Dist-sync closure gate (`build:sync`, `e2e:sync` zero failures).
- [x] 9.x Weekly Review plan reconciliation.
- [x] 10.x Full repository QA.
- [x] 11.x Documentation / plan closure.
- [ ] 12.x Git + exact-SHA CI closure.

## Surprises & Discoveries

- None yet beyond the verified root cause.

## Decision Log

- 2026-08-17 — Use an explicit E2E entity list in `accountBackupEntities.ts` plus
  a Vitest drift-guard test rather than importing production constants via `@/`
  inside the Playwright E2E tree, to avoid alias-resolution risk in the E2E
  runner. The drift test (run by Vitest, which resolves `@/`) keeps the two lists
  exactly equal.
- 2026-08-17 — Replicate the existing passing four-table response semantics
  (HEAD + `content-range` count, `select=user_id` empty footprint, `select=*`
  rows) in the shared helper, generalized to all 15 entities, so the recoverable
  journey's `todos` restore-read override is preserved via the per-entity
  `count`/`rows` option.

## Validation Ledger

- 2026-08-17 — `git fetch --prune && git merge --ff-only origin/main` — PASS,
  local `main` == `a82bbe4`, tree clean.
- 2026-08-17 — `npm run openspec:validate` — PASS (31 items).
- 2026-08-17 — `npm run agent:plan:validate:all` — PASS (all versioned plans valid;
  Weekly Review plan reconciled).
- 2026-08-17 — `npm run typecheck` — PASS; `npm run lint` — PASS (0 errors).
- 2026-08-17 — `npm test` — PASS (1145 tests, incl. 7 drift/helper tests).
- 2026-08-17 — `npm run validate:themes`, `npm run supabase:schema:validate`,
  `npm run qa:impact:validate` — PASS.
- 2026-08-17 — `npm run build:web` + `npm run build:sync` — PASS (dummy Supabase
  env baked in).
- 2026-08-17 — `npm run e2e:sync` — PASS, 44/44 (full `journeys-sync`
  remote-boundary lane green).
- 2026-08-17 — main-lane `chromium`+`journeys` E2E — PASS, 167 passed / 41 skipped.

## Changed Files / Areas

- `e2e/helpers/accountBackupEntities.ts` — new: explicit full backup REST
  entity list + `isBackupRestEntity` (no `@/` import).
- `e2e/helpers/accountSupabaseMock.ts` — new: `handleBackupRestRequest` shared
  boundary helper (deterministic empty footprint, POST capture/echo, per-entity
  overrides, strict unknown-table pass-through).
- `tests/accountSupabaseMock.drift.test.ts` — new: drift guard against
  production constants + negative unknown-table test + handler shape test.
- `e2e/journeys/recoverable-account-v1.spec.ts` — refactor mock to shared helper.
- `e2e/journeys/portable-owner-recovery.spec.ts` — refactor mock to shared helper.
- `.agent/execplans/weekly-review-planning-v1.md` — reconcile exact-SHA claim.

## Recovery / Resume Instructions

1. Read `AGENTS.md`.
2. Read `.agent/PLANS.md`.
3. Read this ExecPlan completely.
4. Read `openspec/changes/fix-account-recovery-dist-sync-determinism/{proposal,design,specs/account-recovery-ci/spec,tasks,README}.md`.
5. Run `git status --short` and `git diff --stat`; reconcile with this checkpoint.
6. Run `npm run agent:resume -- --plan .agent/execplans/account-recovery-dist-sync-determinism.md`.
7. Continue from `Exact next action`.

## Outcomes & Retrospective

- Status: Active (final commit + exact-SHA CI confirmation pending).
- Summary: The stale four-table Supabase mock contract drift (only
  `todos|habits|calorie_entries|workout_routines` routed) was replaced by a shared
  backup-aware E2E boundary that recognizes the full production
  `BACKUP_ENTITIES + BACKUP_SYNTHETIC_ENTITIES` surface (13 tables + 2 synthetic
  records), with a Vitest drift guard that fails if the two lists drift. Both
  account/recovery `@sync` journeys were refactored to the shared helper. The
  inherited dist-sync `journeys-sync` failure (CI run `32024054019` on `36f01f8`,
  3 red account/recovery journeys) is resolved: `npm run e2e:sync` is fully green
  (44/44), and main-lane E2E is green (167 passed / 41 skipped). No production
  account fail-closed / ownership semantics were weakened.
- Follow-up: commit to `main`, push without force, and confirm exact-SHA GitHub
  Actions `quality` + `e2e` PASS before marking this plan COMPLETED.
