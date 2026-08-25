# ACTIVE Campaign — Whole-System Resilience, Migration & Long-Session Hardening

Status: ACTIVE
Planned-From: d923cd0b4575bba3e5ead60bbf67430c5bc66e40
Target-Branch: main
Campaign-Type: System hardening / migration torture / durability / long-session qualification
Suggested-OpenSpec-Slug: harden-whole-system-resilience-v1

## Mission

Take the exact current `main` after Momentum Garden V1 qualification and run the next meaningful repository-wide hardening campaign. Do **not** reopen Momentum Garden or repeat the just-completed qualification work. The previous campaign is terminal and already proved the normal unit/integration/browser/deterministic/Android lanes on current source.

The next objective is to attack the remaining **system-level failure modes that normal feature QA does not adequately exercise**: long-running resource growth, repeated lifecycle churn, historical SQLite upgrade paths, transactional recovery and corruption handling, backup/restore/portable-data failure atomicity, cross-feature date/time consistency, and native Android persistence/lifecycle endurance.

This campaign must treat the application as one connected system. It is not enough to inspect recently changed files. Trace public contracts through direct and transitive callers, data ownership, migrations, providers, background/foreground lifecycle, sync/backup/restore, portable import/export, PWA/service-worker behavior, native surfaces, simulation infrastructure, and tests. A defect discovered far from the latest feature is in scope when the systemic audit proves it can affect durability, correctness, recovery, or long-session operation.

The intended outcome is a repository that can survive sustained realistic use, repeated restart/foreground cycles, representative old-database upgrades, malformed/interrupted recovery operations, and broad cross-feature state transitions without silent data loss, duplicated writes, resource runaway, stale-day behavior, or dishonest test classifications.

## Why This Is the Next Campaign

The predecessor `openspec/changes/harden-momentum-garden-v1/` is `COMPLETED`. Its final evidence includes the full repository QA ladder, the deterministic library, repeated long-run recovery, focused Momentum coverage, full browser coverage, performance sampling, and current-source Android smoke/persistence/lifecycle. There is no justified reason to rerun that same campaign as if it were unfinished.

The repository's remaining registered capability/depth gaps are now mostly systemic:

- long-session/load/stress and memory/resource profiling are not covered by the normal HEAVY fixture;
- migration-from-old-database testing lacks a durable historical fixture laboratory;
- real pre-cutover/user-corpus date data remains unavailable, so fixture-based migration coverage must be clearly distinguished from real-corpus proof;
- some platform boundaries remain external capability gaps, especially local iOS on Windows;
- live Supabase round-trip/RLS proof requires an explicitly authorized target and must never be fabricated.

This campaign should close everything that is **actually executable from the repository and available environment**, strengthen the test infrastructure where justified, and leave irreducible external gaps explicitly registered rather than pretending they passed.

## Startup and Reconciliation — Mandatory Before Editing

1. Read `AGENTS.md` completely.
2. Read `.agent/PLANS.md`, `.agent/PLANNER_HANDOFF.md`, this file, `docs/PROJECT_STRUCTURE_MAP.md`, `docs/testing/autonomous-qa.md`, `docs/testing/known-gaps.md`, `docs/testing/native-e2e.md`, `simulation/README.md`, `qa/impact-map.json`, and the complete predecessor artifacts under `openspec/changes/harden-momentum-garden-v1/`.
3. Read the recent Git history far enough to understand the major architecture waves that produced the current database, backup/recovery, planning, Gym V2, reminders, simulation, and Momentum boundaries. Do not limit review to `d923cd0`'s changed files.
4. Run `git fetch --all --prune`; inspect `git status --short`, current branch, local HEAD, `origin/main`, and legitimate remote advancement. Reconcile only with safe normal Git operations. Never reset away unrelated work, discard another task's changes, force-push, or rewrite public history.
5. Run `npm run agent:plans`. Confirm there is no independent `ACTIVE` plan that supersedes this campaign. Historical completed plans are evidence, not current instructions.
6. Create a fresh OpenSpec change for this campaign, preferably `harden-whole-system-resilience-v1` unless the current repository requires a non-conflicting slug. Create proposal/design/tasks/spec deltas as appropriate plus a Version-2 ExecPlan with `Status: ACTIVE` and one concrete `Exact next action`.
7. Run `npm run qa:affected -- --base d923cd0b4575bba3e5ead60bbf67430c5bc66e40` after the initial campaign-doc creation, then expand the gate set based on the actual implementation areas touched.
8. Establish a clean current-source baseline before invasive fault injection. Use existing fresh QA evidence where it is still exact/current, but rerun the narrow baseline needed to prove the new harnesses and experiments are not starting from a broken tree.

Git, current source, current OpenSpec, current tests, current artifacts, and freshly reproduced evidence are authoritative. Conversation summaries are not.

## Governing Invariants

Preserve these unless a demonstrated defect and updated specification require change:

- SQLite is the local source of truth.
- Database migrations are monotonic, explicit, idempotent under the repository's supported initialization semantics, and never silently discard user data.
- A recovery/import operation must either validate and commit a coherent supported dataset or fail without partially mutating authoritative state.
- Backup, restore, portable import/export, account ownership, and sync boundaries must not silently diverge in entity inventory or semantics.
- Soft deletion/tombstone semantics remain intentional and must not resurrect deleted user intent.
- Local calendar dates and timestamp-backed intervals must preserve established timezone semantics.
- Repeated foreground/background, section switches, reloads, process death, and test-harness transitions must not create duplicate writes, stale async overwrites, leaked timers/listeners, runaway renderers/workers, or unbounded DB work.
- Existing feature engines remain canonical. Hardening must not introduce a second timer, second habit engine, second workout ledger, second timeline ledger, duplicate source of truth, or speculative cache/persistence silo.
- Do not weaken meaningful assertions, delete failing tests, increase timeouts without causal evidence, or classify a retry-pass as flakiness by itself.
- No live remote mutation is allowed unless the environment clearly identifies an authorized disposable/test target and the repository's safety guidance permits it.

## Workstream A — Deep Whole-Codebase System Audit

Before optimizing or adding harness code, map the whole system and inspect contract propagation.

At minimum audit:

- `core/db/**`: bootstrap schema, every migration block, transaction boundaries, indexes, schema-version metadata, connection lifecycle, WAL/native behavior, web/OPFS behavior, and error paths;
- `core/backup/**`, `core/sync/**`, `core/portable/**`, `core/auth/**`: entity inventories, tombstones, owner binding, restore emptiness, manifest/checksum validation, transaction atomicity, outbox semantics, replay/idempotency, settings allowlists, and cross-version compatibility;
- all feature `*.data.ts` writers/readers and any cross-feature engines such as linked actions, planning/review, reminders, command execution, Momentum, Gym V2, and Overview aggregation;
- `AppProviders`, navigation/providers, foreground/day-rollover hooks, timers/listeners, notification handlers, service-worker registration, and anything that persists across section switches or app lifecycle transitions;
- simulation/E2E DB harnesses, static servers, service-worker isolation, native runners, repro tooling, QA impact mapping, and artifact retention;
- current indexes and query shapes on the largest realistic user histories;
- docs and tests that claim entity/schema completeness, ensuring those claims still match runtime source rather than stale snapshots.

For every new/changed public contract encountered, follow its direct and transitive callers. Search for duplicated assumptions, stale schema inventories, hard-coded version/entity lists, inconsistent date conversion, unbounded reads, missing cleanup, and failure paths that can leave partial state.

Create a concise audit ledger in the campaign ExecPlan. Severity-classify findings. Critical/High correctness or durability defects are mandatory fixes. Medium issues directly affecting the campaign's resilience goals should be fixed when evidence is strong. Low/cosmetic unrelated cleanup should not turn this into an unbounded refactor.

## Workstream B — Repeatable Long-Session / Resource Soak Qualification

The normal HEAVY fixture is not a load test. Build or extend a **repeatable, bounded soak lane** that exercises realistic sustained usage without depending on manual DevTools operation.

The lane should stress the system through behavior, not synthetic tight loops that bypass product contracts. Cover combinations such as:

- hundreds/thousands of section transitions over a long sequence;
- repeated Overview refreshes and Planning Hub opens/toggles;
- repeated Todo/Habit create/edit/complete/archive flows;
- Focus start/pause/complete cycles using safe accelerated/test clocks where supported;
- repeated Workout and Calories interactions on seeded history;
- command/quick-capture open/close/execute cycles;
- app reload/relaunch/foreground cycles;
- PWA/service-worker registration/unregistration/update paths in the lane designed for them;
- DB-harness transitions used by simulation;
- long-history reads across Habits, Momentum, Timeline/Progress, Calories, Workout, backup inventory, and planning;
- recovery from interrupted/failed test actions without leaving the next action poisoned.

Measure what the environment can prove reliably. Candidate metrics include process/renderer count, JS heap where supported, active page/context count, outstanding timers/listeners when observable, SQLite/OPFS handle behavior, request/query counts, long-task timing, section-switch latency, repeated read latency, and final data-row invariants.

Do **not** invent arbitrary green thresholds just to create a test. Derive ceilings from existing D14/product responsiveness contracts, known-good baselines, repeated distributions, or explicit documented rationale. Prefer trend assertions such as bounded growth/stabilization when absolute metrics are environment-sensitive.

The soak lane must produce a compact machine-readable report and a deterministic/replayable seed or action manifest when practical. Preserve failing artifacts before fixes.

Acceptance for this workstream requires at least two clean repeated post-fix runs from fresh state with no unexplained monotonic resource runaway, no late-sequence product failure, and no data-integrity drift.

## Workstream C — Historical SQLite Migration Fixture Laboratory

Create durable automated coverage for upgrading representative historical databases instead of proving only migration-from-zero.

1. Inspect the actual runtime migration chain in `core/db/client.ts` and current schema version. Do not trust stale documentation.
2. Identify meaningful historical boundaries: major entity introductions, ownership/outbox changes, planning entities, habit lifecycle/rule-history changes, Gym V2, and other high-risk schema transitions.
3. Build representative historical SQLite fixture generators or committed compact fixtures using repository-safe, anonymized synthetic data. Do not claim they are real user corpora.
4. For each selected historical boundary, exercise upgrade to current schema and verify:
   - schema version advances correctly;
   - required columns/tables/indexes exist;
   - pre-existing rows survive with correct defaults/transformations;
   - soft deletes remain deleted;
   - date keys/timestamps retain intended semantics;
   - foreign/association references degrade safely when nullable or missing by design;
   - ownership/outbox/account safety state remains coherent;
   - new feature readers can consume upgraded rows without crashes or silent coercion;
   - running initialization again does not reapply destructive changes.
5. Add failure-torture cases where supported: interrupted/throwing migration step under a test seam, malformed legacy metadata, unexpected but representable legacy values, and rollback proof.

Do not falsify the known gap about a real legacy corpus. If this campaign adds only synthetic historical fixtures, update documentation to state precisely what moved from "untested" to "synthetic migration matrix covered" and what still requires a real anonymized corpus.

## Workstream D — Recovery, Backup, Restore & Portable Fault Injection

Treat every recovery boundary as hostile input and verify transaction atomicity.

Exercise representative failures across current Backup Completeness V2, Restore V2, portable export/import, account ownership, and sync/outbox integration:

- corrupted or mismatched manifest/checksum;
- missing required entity sections;
- duplicate IDs;
- invalid enum/range/date fields;
- deleted/tombstoned rows;
- owner mismatch;
- partial settings payloads and disallowed keys;
- unsupported future schema/scope versions;
- supported legacy versions;
- interrupted validation/import transaction where a test seam can safely inject failure;
- reattempt after failure;
- repeated import/recovery attempts;
- empty-device gate race/recheck;
- restore/import interactions with outbox and local owner binding;
- cross-entity references to missing/deleted optional parents;
- export→import round-trip on a broad seeded dataset.

For each failure, prove the final authoritative database state, not only a UI error message. A failed operation must not leave half-imported rows or a misleading success marker.

Do not connect to or mutate a live Supabase project unless the environment is explicitly authorized for disposable testing. When a real remote is unavailable, fully exercise local validation, adapters/mappers, mocked boundary contracts, schema-validation tooling, and `dist-sync`/journeys-sync lanes that the repo already supports; keep the real-remote capability gap honest.

## Workstream E — Cross-Feature Time, Lifecycle & Data-Integrity Stress

Stress the boundaries where individually correct features can disagree when combined.

Cover at minimum:

- local midnight/day rollover while the app remains mounted;
- foreground after one or more day changes;
- timezone matrix around DST/non-DST and UTC-offset extremes already represented by repo tooling;
- habit schedule/rule-history/lifecycle transitions crossing planning and Momentum windows;
- Todo/Habit project/goal associations across archive/delete/restore-like local operations;
- Daily Plan and Weekly Review historical references to rows later deleted or archived;
- Focus and Workout sessions that start/end around date boundaries;
- Calories day aggregation at timestamp boundaries;
- reminders/actions delivered after their source habit changes state;
- Linked Actions replay/idempotency after reload/restart;
- rapid overlapping refreshes where stale async results could overwrite newer state;
- account/session-loss conditions where local use must continue but remote operations must pause safely.

Use existing domain helpers rather than introducing ad hoc date logic in tests. Any newly discovered cross-feature invariant should get targeted regression proof at the narrowest stable layer plus the relevant integration/journey lane.

## Workstream F — Native Android Endurance & Lifecycle Proof

Use the supported current-source Android lane when the environment provides it. All native provisioning/build/install/test operations must be sequential; never run competing Expo prebuild/Gradle/native runners against the same project/device.

After preflight and current-source provenance verification:

- run smoke and targeted persistence as required by impact analysis;
- exercise repeated kill/relaunch/foreground flows;
- exercise representative persistence across Todos, Habits, Planning, Workout, Calories, settings, and any campaign-touched shared modal/navigation path;
- replay notification/lifecycle paths selected by impact mapping;
- run a bounded native endurance sequence when the harness can do so reliably;
- verify no test-only seam changes production behavior outside guarded test mode;
- preserve reports and classify every failure before retrying.

Do not claim iOS PASS on Windows. If a real EAS/macOS lane is available and authorized, it may be run and evidenced; otherwise retain `ENVIRONMENT`/capability-gap status.

## Workstream G — QA Infrastructure, Reproducibility & Observability Hardening

Only add instrumentation that helps prove a real campaign question.

Good additions include:

- reusable historical DB fixture builders;
- deterministic fault-injection seams that are impossible in production mode;
- soak reports with action counts, resource samples, timing distributions, and final database oracles;
- automatic repro bundle capture on long-run failures;
- leak/resource diagnostics that stay test-only;
- impact-map entries for newly shared infrastructure;
- clearer classification output when a failure is `PRODUCT_BUG`, `TEST_BUG`, `FLAKY_TEST`, `ENVIRONMENT`, `EXPECTED_KNOWN_GAP`, or `SPEC_AMBIGUITY`.

Avoid giant bespoke test frameworks, environment-specific hacks, coordinate-only native scripts, permanent sleeps, or instrumentation that materially changes the product behavior being measured.

## Workstream H — Documentation, Known Gaps & Repository Truth

Update only documentation justified by current source and fresh evidence.

Reconcile:

- `docs/testing/known-gaps.md` — close or narrow only gaps actually proven; distinguish synthetic migration fixtures from real historical-user corpus evidence;
- `docs/testing/autonomous-qa.md` and native docs if new durable lanes are added;
- `qa/impact-map.json` when new harnesses or shared boundaries require conservative escalation;
- `docs/PROJECT_STRUCTURE_MAP.md`, `AGENTS.md`, and knowledge-base docs only if architecture or canonical commands truly changed;
- OpenSpec tasks/spec and the campaign ExecPlan with actual evidence, failure classifications, artifact paths, and exact commands.

Historical completed campaign docs must remain historically accurate. Do not rewrite old reports as if new evidence existed at the time.

## Failure Policy

Use the repository taxonomy only after reproduction and evidence:

- `PRODUCT_BUG`
- `TEST_BUG`
- `FLAKY_TEST`
- `ENVIRONMENT`
- `EXPECTED_KNOWN_GAP`
- `SPEC_AMBIGUITY`

Rules:

- A retry pass alone is not proof of flakiness.
- Preserve the first failing artifact/repro before modification.
- Fix root causes, not symptoms.
- Never delete/skip/weaken a meaningful assertion merely to get green.
- Never use arbitrary timeout inflation as the primary fix when an observable readiness condition exists.
- Critical/High durability, corruption, data-loss, migration, ownership, or cross-feature correctness defects discovered by this campaign must be fixed before completion.
- If an external capability is genuinely unavailable, record `ENVIRONMENT` or the existing known gap; do not fabricate proof.

## Parallelization and Isolation Rules

Parallel work is allowed only when it is safe and useful.

- The primary agent owns the campaign ExecPlan and integration decisions.
- Delegate non-overlapping audits/tests by subsystem when available, but record scope and expected output before delegation.
- Do not let parallel workers mutate the same files or migrations without explicit ownership.
- Do not run native prebuild/provision/build lanes concurrently.
- Do not run multiple destructive/fault-injection DB tests against the same persistent database instance.
- Use isolated temp databases, ports, browser contexts, output directories, emulator state, and worktrees when concurrency could otherwise collide.
- Integrate findings into the primary ExecPlan before relying on them after context loss.

The campaign must remain runnable by a single capable agent as well; do not make completion depend on a specific multi-agent framework, model, vendor, or slash-command implementation.

## Required Validation Ladder

Use `qa:affected` to add gates based on actual modified areas. Before `COMPLETED`, fresh evidence should include all applicable items below:

1. `npm run typecheck`
2. `npm run lint`
3. targeted unit/integration tests added by each workstream
4. full `npm test`
5. `npm run qa:integration`
6. `npm run qa:timezones`
7. `npm run validate:themes` when shared UI/theme surfaces are touched
8. `npm run supabase:schema:validate` when backup/sync/schema contracts are touched
9. `npm run build:web`
10. targeted Playwright specs for changed product/harness boundaries
11. `npm run e2e:journeys:p0`
12. `npm run e2e` or `npm run e2e:full` when shared/browser infrastructure is touched
13. `npm run e2e:sync` when remote-boundary mock/sync/restore paths are touched
14. `npm run sim:validate`
15. targeted deterministic/repro scenarios
16. `npm run qa:simulation -- --all --mode deterministic`
17. the new/extended long-session soak lane, repeated from fresh state at least twice after final fixes
18. the historical migration matrix from each selected fixture boundary
19. recovery/portable fault-injection matrix and broad round-trip proof
20. current-source Android smoke/targeted/lifecycle lanes selected by impact analysis, sequentially, when the supported environment is available
21. strict validation of the new OpenSpec change
22. `npm run agent:plan:validate -- --plan <campaign-execplan>`
23. `npm run agent:plan:validate:all`
24. `npm run qa:impact:validate`
25. `npm run format:check` or focused Prettier validation covering changed files
26. `git diff --check`
27. final `npm run qa:full` unless a more comprehensive explicitly documented superset has already run on the exact final tree

Inspect GitHub Actions/deployment state for the exact final pushed SHA. If a workflow is not configured to run for that delivery mode, record that fact instead of inventing a CI PASS.

## Acceptance Gates

This campaign is complete only when all of the following are true:

1. A deep whole-codebase system audit was completed and material findings are recorded with severity/root-cause classification.
2. No unresolved Critical/High repository-caused durability, migration, corruption, ownership, data-loss, lifecycle, or long-session defect remains.
3. A repeatable long-session/resource soak lane exists or the repository already had an equivalent that was proven sufficient; it passes at least two fresh post-fix runs without unexplained resource runaway or data-integrity drift.
4. Representative historical SQLite versions upgrade to current schema through automated fixture-based tests with row/schema/default/idempotency assertions. Documentation clearly states whether fixtures are synthetic or real.
5. Migration/fault-injection tests prove failures do not silently leave partially upgraded authoritative state where transactional guarantees are expected.
6. Backup/Restore V2 and portable-data malformed/interrupted inputs fail safely, and supported broad round-trip recovery preserves deterministic authoritative state.
7. Cross-feature local-date/timezone/lifecycle stress is green across the affected domain/integration/journey matrix.
8. Full browser and deterministic simulation regression remains green on the final source.
9. Current-source Android lanes selected by impact analysis pass when the supported environment is available; unavailable iOS/remote environments remain honestly classified.
10. The new OpenSpec artifacts and Version-2 ExecPlan are complete, validated, and contain exact reproducible evidence rather than generic claims.
11. The final working tree is clean; local `main` and fetched `origin/main` are at the same exact final SHA after normal push.
12. The final commit message contains a detailed session report: baseline, audit scope, root causes/classifications, implementation, tests/evidence, known external limitations, and delivery state.

## Stop Conditions

Do not stop merely because one workstream is green or because the first soak run passes.

Continue through **AUDIT → REPRODUCE → FIX → REGRESSION TEST → STRESS → MIGRATION/RECOVERY TORTURE → FULL VALIDATION → DELIVERY** until the acceptance gates are proven.

Stop early only when:

- a genuine external blocker makes the remaining required proof impossible and the ExecPlan is accurately changed to `BLOCKED` with the exact condition needed to resume; or
- the audit proves a proposed sub-workstream is already fully covered by current source/tests and fresh evidence, in which case record that proof and spend effort on the next unresolved systemic risk instead of manufacturing changes.

If no meaningful repository-executable hardening work remains after evidence-driven audit, do not invent features or churn. Mark the campaign complete with proof and leave external capability gaps explicitly documented.

## Final Delivery Protocol

Before final delivery:

1. Reconcile the campaign OpenSpec tasks/spec, ExecPlan Current Checkpoint, Validation Ledger, changed-file inventory, known gaps, and actual Git diff.
2. Run the final applicable validation ladder on the exact candidate tree.
3. Fetch `origin`, reconcile any legitimate remote advancement safely, and rerun affected checks if reconciliation changes code.
4. Commit coherent final changes with a **full detailed session-report commit body**, not a one-line summary only.
5. Push normally to `origin/main` without force.
6. Fetch again and verify local `HEAD == origin/main` and the working tree is clean.
7. Inspect exact-SHA CI/deployment results where configured.
8. Set the campaign ExecPlan to `COMPLETED` only when the acceptance gates are proven. If an irreducible external blocker remains for a mandatory gate, use `BLOCKED`, not optimistic completion language.

## Autonomous Continuation

Proceed autonomously from repository state. Do not wait for conversational memory or ask the user to restate this campaign. The durable handoff is this file plus the task-specific OpenSpec/ExecPlan created during startup.

After context loss or a fresh session: read `AGENTS.md`, `.agent/PLANS.md`, this campaign's ExecPlan, inspect Git, run the repository resume/impact commands, reconcile the checkpoint with actual files, then continue from its `Exact next action`.

Do not output a replacement prompt for the user to paste elsewhere. Keep durable state in the repository and continue the campaign through the repository's normal agent/goal continuation mechanism when the active environment supports one.
