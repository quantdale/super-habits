# Proposal — Release Candidate: Native/Performance/Production Closure

## Summary

Take SuperHabits from its post-hardening state (`main` @ `6cc4172f4292839fa0b28d8289ee0c1a81e43899`, commit message "unfinished progress") to a freshly certified release-candidate baseline, then close the remaining native, performance-uncertainty, and production-integration gaps.

This is a certification campaign, not a feature wave. It proves that what already exists is correct, deployable, current, and recoverable before any new product work begins.

## Why this change is required

Independent reconciliation of the actual repository state (not historical claims) found:

- **CI is red at HEAD.** GitHub Actions run `32577614654` for `6cc4172` fails at the `quality` job's "Validate versioned ExecPlans" step; the `e2e` job was skipped downstream. Root cause: commit `6cc4172` rewrote the Current Checkpoint of `openspec/changes/harden-parallel-completion-wave-v2/execplan.md` and dropped the required `Completed`, `Important modified files`, and `Remaining definition of done` labeled fields.
- **Documentation drift on schema truth.** Actual `core/db/client.ts` migrations run through version 21 (`daily_plans.top_todo_titles`), so the next free migration is >=22. But `.cursorrules` and `.cursor/rules/superhabits-rules.mdc` claim v15 (next = 16), `docs/PROJECT_STRUCTURE_MAP.md` claims v15, and `AGENTS.md` claims v20. Several docs also carry stale sync-scope wording.
- **HEAVY-device performance is unresolved.** A prior hardening session observed an ~846 ms section-switch measurement against an 800 ms ceiling in the D14 scenario, followed by one isolated passing rerun, and retained a `FLAKY_TEST` classification without timing distributions or a root cause.
- **Native Android evidence predates the tree.** Prior native validation ran against an installed APK that does not include the latest UI/hardening work; the current source has never been natively exercised end-to-end.
- **Production remote residuals remain.** The live Supabase migration ledger was last verified at `20260822000000`; the `parse-ai-command` Edge Function reached source parity but live redeployment was not proven; advisors were never run.
- **Recovery invariants must be re-proven after all changes**, because SuperHabits is offline-first and user data is valuable.

## Goals

1. Repair the CI-breaking ExecPlan drift and re-validate all plans.
2. Establish a completely fresh, exact-HEAD baseline by running the repository's own gates from scratch (typecheck, lint, full Vitest unit+integration, timezone QA, OpenSpec validation, plan validation, Supabase schema validation, theme validation, QA impact-map validation).
3. Build web + sync bundles fresh; run the full Playwright suite, PWA lane, deterministic simulation, and `e2e:sync`.
4. Resolve the HEAVY-device performance uncertainty with controlled repeated measurement, identify the dominant cause(s) from evidence, optimize only if justified, and establish a stable performance gate with real headroom.
5. Validate Android with a current-source build to the extent the local environment allows, classifying anything genuinely unavailable precisely.
6. Audit production Supabase state against repository migrations and contracts; deploy/verify the Edge Function where credentials permit.
7. Correct stale authoritative documentation against source truth.
8. Re-prove backup/restore/portable/account recovery invariants with targeted suites and journeys.
9. Push coherent commits, capture the exact final SHA, and require GitHub `quality` + `e2e` PASS on that exact SHA.
10. Then perform a fresh product gap audit, select the next highest-value campaign, create its OpenSpec change + ExecPlan, and begin implementation.

## Non-goals

- No new user-facing feature wave inside this change (a separate follow-up campaign owns the first post-RC feature).
- No weakening of meaningful assertions, Backup/Restore validation, account-owner protections, RLS, canonical mutation paths, or exactly-once protections to obtain green gates.
- No history rewrite or force push; no deletion of committed hardening evidence without determining repository policy first.
- No fabricated iOS/native evidence when no valid runtime exists.

## Completion rule

This change is complete only when: Git is reconciled and main-only; every repository-caused gate failure is fixed at root cause; the performance question is answered with distribution evidence and a stable gate; Android status is either validated on the current build or precisely environment-blocked; Supabase/Edge Function status is known and converged where access permits; authoritative docs match source; recovery invariants are re-proven; all applicable local gates are green; and the exact pushed SHA has green GitHub `quality` and `e2e` checks — followed by selection and start of the next product campaign as a separate OpenSpec change.
