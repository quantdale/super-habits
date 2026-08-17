# Proposal: Account Recovery Dist-Sync Determinism Closure

## Summary

Close the repository-caused GitHub Actions failure that currently prevents `main` from being fully green after Weekly Review & Planning V1.

The product implementation itself is not the primary failure. The failing `journeys-sync` account/recovery tests use duplicated Supabase route mocks that still recognize only the four historical V1 sync tables (`todos`, `habits`, `calorie_entries`, `workout_routines`). Production account safety now derives its remote-footprint probes from the complete backup contract: every `BACKUP_ENTITIES` table plus `BACKUP_SYNTHETIC_ENTITIES`. The stale mocks therefore return 404 for legitimate probes such as `habit_completions`, `saved_meals`, `pomodoro_sessions`, `linked_action_rules`, `weekly_reviews`, `user_backup_settings`, and `backup_manifest`. The Account Coordinator correctly fails closed when those probes fail, so the E2E UI never reaches `Protected` or `Sign-in pending`.

This change makes the dist-sync account boundary deterministic and contract-aware, removes the duplicated four-table test assumption, adds drift detection so future backup-scope additions cannot silently break account E2E again, and reconciles the Weekly Review ExecPlan with the actual exact-SHA CI result.

## Current Evidence

Current reviewed `main` before this change:

- `36f01f881248252d1b675714d9c963eafe4f1303`
- only remote branch: `main`
- GitHub Actions run `32024054019` / CI #412:
  - `quality`: PASS
  - full main E2E lane: PASS
  - deterministic scenario library: PASS
  - dist-sync `journeys-sync`: FAIL

Observed failing assertions in the dist-sync lane:

1. Portable owner recovery matching-account journey: `Sign-in pending` does not appear.
2. Portable owner recovery wrong-account journey: `Protected` does not appear.
3. Recoverable Account V1 journey: `Protected` does not appear.

The failures are reproducible consequences of the stale mock contract, not acceptable flakes to quarantine.

## User / Developer Outcome

After this closure:

- account protection and recovery journeys exercise the same backup entity scope that production uses;
- adding a new backup entity causes an explicit drift test or type/test failure unless the test boundary supports it;
- known backup-table probes receive deterministic valid empty/count responses instead of accidental 404s;
- truly unknown Supabase endpoints still fail loudly;
- Portable owner recovery and Recoverable Account V1 dist-sync journeys pass without relying on retries, longer timeouts, skips, or quarantines;
- `npm run e2e:sync` is fully green;
- the exact final `main` SHA has GitHub Actions `quality` PASS and `e2e` PASS;
- the Weekly Review plan no longer claims exact-SHA green CI for a SHA whose final workflow was red.

## Goals

1. Replace duplicated stale account/recovery Supabase table matching with one authoritative, backup-aware E2E boundary helper.
2. Cover every current `BACKUP_ENTITIES` entry, including `weekly_reviews`.
3. Cover `BACKUP_SYNTHETIC_ENTITIES`: `user_backup_settings` and `backup_manifest`.
4. Preserve per-journey custom behavior such as Todo backup rows, pushed-row capture, account identities, OTP flows, and owner mismatch scenarios.
5. Add a drift guard tied to the production backup contract.
6. Keep unexpected Supabase REST endpoints strict rather than making the mock globally permissive.
7. Prove account protection, fresh recovery, imported-owner matching recovery, imported-owner wrong-account failure, and remote-footprint fail-closed semantics in `dist-sync`.
8. Reconcile the inaccurate Weekly Review exact-final-SHA CI statement.
9. Finish with a clean, main-only, exact-SHA green repository state.

## Non-Goals

- changing production account ownership semantics;
- weakening fail-closed behavior when remote evidence is unavailable;
- changing RLS or production Supabase policies;
- changing the portable backup format;
- changing backup scope merely to make tests pass;
- reducing Backup V2/V3 coverage;
- adding retries to hide deterministic failures;
- increasing UI assertion timeouts as the primary fix;
- marking tests flaky, skipped, quarantined, or expected-failure;
- creating a permissive catch-all mock that returns success for arbitrary unknown endpoints;
- introducing a new product feature in this closure;
- modifying production data.

## Scope

### Shared backup-aware Supabase E2E boundary

Introduce a reusable helper for account/recovery dist-sync tests. It must know the production backup remote surface through an authoritative mechanism.

Preferred design:

- import `BACKUP_ENTITIES` and `BACKUP_SYNTHETIC_ENTITIES` directly when Playwright/test compilation permits it; or
- centralize an E2E list and add a drift-guard test that compares it exactly with the production constants.

The helper must support:

- identifying known backup REST table requests;
- deterministic empty responses;
- exact count/head responses including `content-range` where Supabase JS expects them;
- optional per-entity row/count overrides;
- optional capture of POSTed rows for ownership assertions;
- auth route handlers layered by the calling journey;
- strict failure for unknown/unexpected REST tables.

### Journey migration

Refactor at least:

- `e2e/journeys/recoverable-account-v1.spec.ts`
- `e2e/journeys/portable-owner-recovery.spec.ts`

to use the shared boundary rather than independent four-table regexes.

### Drift protection

Tests must prove the E2E boundary recognizes the full current contract:

- all 13 current backup tables, including `weekly_reviews`;
- both synthetic entities.

A future production backup-scope addition must not silently become a 404 in these account journeys.

### Historical plan reconciliation

`.agent/execplans/weekly-review-planning-v1.md` currently states that exact-SHA GitHub CI was green even though final run `32024054019` on `36f01f8...` failed in `e2e`/dist-sync.

Reconcile this record honestly. Preserve the fact that Weekly Review implementation, quality, main-lane E2E, and deterministic scenarios passed, while recording that repository closure required this subsequent test-boundary fix. Do not rewrite history to imply the red run was green.

## Safety Constraints

- Production account code must remain fail closed when remote backup evidence cannot be verified.
- Owner matching and fingerprint rules must not be relaxed for test convenience.
- No account merging or generic populated-device account switching.
- Mock responses may be deterministic but must model the request shapes the production Supabase client actually sends.
- Unknown REST endpoints remain explicit failures so new unmodeled dependencies are visible.
- Tests must verify state transitions, not merely wait longer for text.

## Validation Expectations

At minimum:

- focused shared-helper/drift tests;
- account coordinator/domain regressions;
- `npm run build:sync`;
- `npm run e2e:sync` with zero failed tests;
- `npm run typecheck`;
- `npm run lint`;
- `npm test`;
- `npm run openspec:validate`;
- `npm run agent:plan:validate:all`;
- `npm run qa:simulation -- --all --mode deterministic` or current repository equivalent;
- `npm run e2e:full` / repository-required broad E2E;
- final GitHub Actions exact-SHA verification.

## Definition of Done

This change is complete only when:

1. the stale four-table duplication is removed from the affected account/recovery journeys;
2. current production backup entities and synthetic entities are all recognized;
3. `weekly_reviews` is included automatically or by a drift-enforced contract;
4. unknown REST tables still fail loudly;
5. matching-account portable recovery passes in dist-sync;
6. wrong-account portable recovery passes in dist-sync;
7. Recoverable Account V1 protection/recovery passes in dist-sync;
8. account fail-closed production semantics remain unchanged;
9. `npm run e2e:sync` is fully green without relying on retry success;
10. the Weekly Review ExecPlan accurately describes the red final SHA and this closure;
11. OpenSpec and all versioned ExecPlans validate;
12. all completed work is committed and pushed to `main`;
13. working tree is clean;
14. local `main == origin/main`;
15. only remote `main` exists;
16. the exact final SHA has GitHub Actions `quality` PASS and `e2e` PASS;
17. all session output and newly authored prose are English only.
