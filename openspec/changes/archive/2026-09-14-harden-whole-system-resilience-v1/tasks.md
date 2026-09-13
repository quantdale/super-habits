## 1. Reconcile and establish durable state

- [x] 1.1 Fetch `origin`, fast-forward local `main` to the planner commit `7a49647`, and confirm no ACTIVE plan supersedes this campaign.
- [x] 1.2 Read AGENTS.md, `.agent/PLANS.md`, handoff/execution prompts, QA/native/simulation guidance, impact map, and predecessor artifacts.
- [x] 1.3 Inventory the inherited uncommitted working-tree change set and validate typecheck plus the full Vitest suite before adopting it.
- [x] 1.4 Create this OpenSpec change and the Version-2 ExecPlan (`Status: ACTIVE`) with one exact next action.
- [x] 1.5 Run `npm run qa:affected -- --base d923cd0` and record the resolved gate set in the ExecPlan.

## 2. Whole-codebase system audit (Workstream A)

- [x] 2.1 Audit `core/db/**` bootstrap/migrations/indexes/connection lifecycle/error paths; verify documented schema-version claims match runtime source.
- [x] 2.2 Audit backup/sync/portable/account inventories, transaction atomicity, outbox semantics, replay/idempotency, settings allowlist, and cross-version compatibility.
- [x] 2.3 Audit feature data writers/readers, cross-feature engines, providers/hooks/timers/listeners, service-worker registration, and harnesses for stale assumptions, unbounded reads, and missing cleanup.
- [x] 2.4 Record severity-classified findings in the ExecPlan audit ledger; fix Critical/High defects with regression proof.

## 3. Validate and land the inherited read-path hardening wave

- [x] 3.1 Complete the caller-level audit of migration 24 indexes, concurrent reads, existence probes, batched deletes, and the captured-manifest preview gate against governing invariants.
- [x] 3.2 Run lint, format checks, timezone/theme gates, and integration suites over the adopted tree; repair any introduced regression at the source.
- [x] 3.3 Land the validated wave as a coherent campaign commit with evidence in the body.

## 4. Long-session soak lane (Workstream B)

- [x] 4.1 Build the repeatable bounded soak lane driving realistic sustained behavior with machine-readable resource/report output.
- [x] 4.2 Derive assertion thresholds from existing contracts/baselines; document rationale.
- [x] 4.3 Produce two clean post-fix fresh-state runs with no unexplained resource runaway or data-integrity drift.

## 5. Historical SQLite migration fixture laboratory (Workstream C)

- [x] 5.1 Select meaningful historical upgrade boundaries from the runtime migration chain.
- [x] 5.2 Build representative synthetic fixture generators/compact fixtures with row/default/idempotency oracles.
- [x] 5.3 Add failure-torture coverage where safely supported (interrupted step seam, malformed legacy metadata).
- [x] 5.4 Update documentation to distinguish synthetic matrix coverage from real-corpus proof.

## 6. Recovery/backup/restore/portable fault injection (Workstream D)

- [x] 6.1 Exercise the malformed/interrupted input matrix across Backup V2, Restore V2, portable import, owner binding, and outbox interaction.
- [x] 6.2 Prove final authoritative database state after each failure; add missing atomicity regressions.
- [x] 6.3 Prove broad seeded export→import round-trip determinism.

## 7. Cross-feature time/lifecycle stress (Workstream E)

- [x] 7.1 Stress day rollover/foreground/timezone/DST boundaries across combined features using existing domain helpers.
- [x] 7.2 Prove stale-async guards and linked-action/reminders replay idempotency under reload/restart.

## 8. Native Android endurance (Workstream F)

- [x] 8.1 Preflight/provision sequentially when the environment provides the API-36 x86_64 target; otherwise record ENVIRONMENT.
- [x] 8.2 Run impact-selected smoke/persistence/lifecycle lanes plus repeated kill/relaunch endurance as far as reliably supported.

## 9. Documentation, final validation, delivery (Workstreams G/H)

- [x] 9.1 Reconcile known gaps, QA impact map, docs, OpenSpec tasks/spec, and the ExecPlan with final evidence.
- [x] 9.2 Run the full applicable validation ladder including `qa:full`, strict OpenSpec validation, both plan validators, `qa:impact:validate`, format check, and `git diff --check`.
- [x] 9.3 Commit the detailed session-report body, push normally to `origin/main`, verify HEAD == fetched origin/main with a clean tree, and inspect exact-SHA CI where configured.
