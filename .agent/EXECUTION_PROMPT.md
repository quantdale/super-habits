# ACTIVE Campaign — Post–Momentum Garden Hardening & Qualification

Status: ACTIVE
Planned-From: 0187b98cc48691ee0410cb84923571e355b97902
Target-Branch: main
Campaign-Type: Hardening / validation / regression repair
Suggested-OpenSpec-Slug: harden-momentum-garden-v1

## Mission

Take the exact current `main` state after Momentum Garden V1 and close the remaining release-quality evidence gaps created or exposed by that campaign. This is not a new feature wave. The objective is to prove that Momentum Garden and its supporting bounded-read changes remain correct under long-running simulation, exhaustive browser journeys, and a clean current-source Android native lane; repair any repository-caused failures found; profile the new read paths and their whole-app impact; and leave the repository with reproducible evidence rather than optimistic claims.

The predecessor campaign (`openspec/changes/add-momentum-garden-v1/`) is complete and must not be reopened or reimplemented. Its explicit remaining debt is authoritative starting context:

1. the full long-term deterministic simulation repeatedly reaches approximately step 201 and then times out at step 202 while executing `Start focus`;
2. Android native smoke/persistence was not proven for the Momentum Garden tree because concurrent Expo prebuild work collided and the smoke session terminated during APK packaging before install/Maestro execution;
3. exhaustive browser/simulation/native performance qualification was intentionally deferred;
4. the new bounded habit-window input and asynchronous Momentum reads need broader regression/performance proof across the rest of the application.

## Startup and Reconciliation — Mandatory Before Editing

1. Read `AGENTS.md`, `.agent/PLANS.md`, `.agent/PLANNER_HANDOFF.md`, `docs/PROJECT_STRUCTURE_MAP.md`, `docs/testing/autonomous-qa.md`, `docs/testing/native-e2e.md`, `qa/impact-map.json`, and all artifacts under `openspec/changes/add-momentum-garden-v1/`.
2. Read the recent Git history and inspect the complete diff from `f0e293be906958ff933ca88dec996457cee30f9f` through `0187b98cc48691ee0410cb84923571e355b97902`, then inspect every directly and transitively affected caller around:
   - `features/momentum/**`
   - `features/habits/habits.domain.ts`
   - `features/overview/OverviewScreen.tsx`
   - `features/planning-hub/PlanningHubScreen.tsx`
   - `simulation/runner/actions.ts`
   - affected tests/E2E/QA infrastructure.
3. Run `git fetch --all --prune`, inspect `git status --short`, branch/HEAD/origin parity, recent commits, and any legitimate remote advancement. Never reset, discard, force-push, or overwrite unrelated work.
4. Run `npm run agent:plans` and confirm no separate ACTIVE task supersedes this campaign. Historical completed plans are evidence only.
5. Create a fresh OpenSpec change for this campaign (prefer `harden-momentum-garden-v1` unless repository state provides a better non-conflicting slug) with proposal/design/tasks/spec as appropriate plus a Version-2 ExecPlan. Set the plan to `Status: ACTIVE`, give it a real `Exact next action`, and keep it current throughout the campaign.
6. Run `npm run qa:affected -- --base <pre-campaign-baseline>` or the repository-equivalent impact command before deciding the final test ladder.

Do not assume conversation history is correct. Git, current source, current OpenSpec, current tests, and freshly produced evidence win.

## Governing Product Invariants

Preserve the shipped Momentum Garden architecture unless a demonstrated correctness defect requires a narrowly justified change:

- Momentum is a deterministic, derived, read-only model over authoritative local SQLite facts.
- Do not add a `momentum_events` ledger, migration, second source of truth, Supabase entity, sync queue entity, backup entity, export entity, or durable Garden preference.
- Do not introduce an opaque aggregate score, XP/currency, punishment/death state, negative nutrition judgment, streak punishment, random rewards, social/leaderboard mechanics, or feature expansion disguised as hardening.
- Source semantics remain explicit and independently attributable: Tasks, Habits, Focus, Workout, Nutrition, Planning/Review, and dated Goal/Project milestones.
- Habit schedule/lifecycle/off-day semantics must continue to come from the canonical habit resolver. A bounded Garden window must never alter the pre-existing full-history behavior used by streaks or Habit UI.
- Date windows are local-calendar windows. Timestamp-backed reads must respect established UTC half-open interval helpers and timezone invariants.
- Overview must remain useful before the Garden finishes loading. Garden failure/latency must not block or corrupt canonical dashboard facts.
- Garden reads must not mutate source rows, sync outbox state, account/backup state, or feature state.
- Accessibility, reduced-motion parity, semantic theme tokens, native-safe rendering, and keyboard/semantic interaction must remain intact.

## Workstream A — Deep Whole-Codebase Impact Audit

Audit the latest Momentum Garden commit as a system change, not just a list of modified files.

Trace each new/changed public function, data read, component mount, hook dependency, query boundary, and test helper into its callers and downstream behavior. Explicitly inspect:

- `buildDayCompletions(..., rangeStartDateKey)` and every call site, including default behavior when the new argument is omitted, malformed dates, history before/inside/after the bounded window, lifecycle pauses/archives, targets greater than one, rule-history transitions, timezone rollovers, and long histories;
- Momentum SQLite queries for boundedness, indexes/query plans where meaningful, one-connection behavior, ordering, null/deleted-row handling, duplicate facts, timestamp/date-key conversion, and read-only guarantees;
- Overview refresh, day rollover, foreground refresh, unmount/remount, rapid section switching, repeated Garden opening, stale async response races, error states, empty state, and database-reset/test harness interactions;
- Planning Hub Progress integration and seven/28-day switching, including repeated toggles and large historical datasets;
- SVG/native rendering and text/accessibility equivalents under light/dark themes, reduced motion, narrow screens, and repeated renders;
- the shared simulation Calories locator correction and whether it affects scenarios outside Momentum Garden;
- any cache, memoization, hook, navigation, SQLite, sync/backup, or provider behavior indirectly touched by the new reads.

Do not stop at recently changed files. Follow impact across the full codebase and identify regressions caused by changed contracts even when the failure manifests elsewhere.

For every real defect found, classify severity and root cause, add a regression test where practical, fix the source problem rather than masking the symptom, and rerun the narrowest proving lane followed by the required broader lane.

## Workstream B — Reproduce and Eliminate the Long-Run `Start focus` Timeout

This is a required closure item, not optional debt.

1. Reproduce the failure from a clean deterministic state using the full long-term/full-library simulation path that previously reached step ~202.
2. Preserve the original report, action sequence, scenario/persona/seed where applicable, database evidence, screenshots/traces, and repro bundle before changing code.
3. Determine whether the timeout is a `PRODUCT_BUG`, `TEST_BUG`, `FLAKY_TEST`, `ENVIRONMENT`, `EXPECTED_KNOWN_GAP`, or `SPEC_AMBIGUITY` using repository taxonomy. A passing retry alone is not enough to call it flaky.
4. Instrument observability narrowly if necessary. Inspect the exact `Start focus` action, semantic launcher state, section navigation, timer state, app/database state after the preceding ~201 actions, focus controls, scroll/viewport behavior, and any accumulated async work or performance degradation.
5. Fix the actual cause. Do not solve it by merely increasing an arbitrary timeout or fixed sleep. If an observable readiness condition exists, synchronize on that condition. If product state is wrong, repair the product.
6. Add regression coverage that fails for the reproduced cause and passes after the fix.
7. Rerun the exact failing sequence repeatedly enough to establish stability, then run the full deterministic simulation library from a fresh build. No late `Start focus` timeout may remain hidden behind a quarantine unless repository evidence proves it is a legitimate external capability gap; if so, document why and mark the campaign BLOCKED rather than falsely COMPLETE.

## Workstream C — Clean Sequential Android Native Qualification

The previous Momentum campaign's native evidence is `ENVIRONMENT`, not PASS. Obtain fresh current-source proof using the supported Android lane.

Important: run native provisioning/build/install/test **sequentially**. Do not run competing Expo prebuild, Gradle packaging, provision, or Maestro lanes in parallel. The previous collision is specifically what must be avoided.

1. Preflight the documented Android requirements and verify the intended API-36 x86_64 target/package provenance.
2. If the installed package is absent or stale, run the repository provisioner for the selected serial and allow it to complete fully before launching another native command.
3. Run a clean current-source smoke flow.
4. Run the persistence lane and verify at minimum the existing representative Todo, Habit, Calories, Workout, and Settings persistence contracts relevant to the current source.
5. Run lifecycle coverage required by impact analysis. Do not expand native scope simply to duplicate the web matrix, but do test native platform realities that browser tests cannot prove.
6. Add a focused Momentum Garden native flow only if the existing native suite cannot prove the new surface is reachable/renderable/semantically usable after a current-source build. Keep it small and semantic; no raw absolute-coordinate taps or arbitrary sleeps.
7. Verify app relaunch/foreground behavior and that opening/viewing Momentum remains read-only. Where direct native DB assertions are not practical, pair native visual proof with real-SQLite tests rather than inventing unsupported claims.
8. Preserve JSON/Maestro reports and record exact replay commands.

A missing toolchain/device is `ENVIRONMENT`, never PASS. If the supported Nitro/Windows Android environment is available, environmental setup issues that are repository-fixable must be repaired. iOS must remain honestly reported as local `ENVIRONMENT` on Windows unless an executable cloud/EAS path is actually run and evidenced.

## Workstream D — Exhaustive Browser and Real-User Regression

Build a fresh static web export and exercise both Momentum-specific and whole-app journeys.

At minimum prove:

- empty-device Garden neutral state;
- task-only, habit-only, focus-only, workout-only, nutrition-only, planning/review, and multi-domain attribution semantics where existing fixtures allow deterministic proof;
- completion followed by Overview refresh and reload reconstruction;
- seven-day and 28-day detail windows;
- local-midnight/day-rollover behavior and lifecycle-masked Habit dates;
- repeated Overview ↔ other-section switching while Garden loads;
- rapid open/close/toggle interactions without stale results or duplicate work;
- keyboard operation and semantic accessibility labels;
- reduced-motion behavior and light/dark theme readability;
- no writes/outbox mutations from simply viewing Garden;
- canonical feature CRUD still works after Garden integration;
- the P0 real-user journey set remains green;
- broader E2E selected by `qa:affected`/impact mapping is green, including PWA/service-worker infrastructure if the impact map requires it.

Do not weaken selectors or assertions merely to make tests pass. Repair brittle test code only when product behavior is demonstrably correct and document the evidence.

## Workstream E — Performance & Resource Qualification

The predecessor campaign deliberately deferred deeper performance proof. Measure before optimizing.

Profile the new paths on representative empty, typical, and long-history datasets. Include repeated operation, not only cold-start samples.

Measure and investigate as applicable:

- Overview time-to-canonical-content with the one-day Garden request present;
- one-day Garden read latency distribution;
- seven-day and 28-day detail read latency distribution;
- query count and whether any per-habit/N+1 or accidental unbounded-history read occurs;
- long-history behavior of `buildDayCompletions` with `rangeStartDateKey` versus the full-history pre-existing path;
- repeated Overview refresh/foreground/day-rollover behavior for unnecessary duplicate DB work;
- repeated Planning Hub 7/28 switching;
- section-switch responsiveness compared with existing performance gates;
- memory/resource growth during the long deterministic simulation and repeated Garden navigation, where tooling permits meaningful evidence;
- Android perceived/observable responsiveness on the current-source build, without fabricating unavailable frame/memory metrics.

Use repeated samples/distributions for variable timings rather than deciding from one run. Optimize only when evidence shows a real regression or material waste. Preserve readability and architecture; do not introduce speculative caches or new persistence solely for benchmark scores.

## Workstream F — Data Integrity, Timezone, Sync/Backup Isolation, and Recovery Regression

Re-prove that the Garden remains outside all mutation/recovery boundaries:

- no new schema migration or schema-version bump unless an unrelated demonstrated defect absolutely requires one;
- no Garden entity in sync outbox, Supabase adapters, backup manifests, restore mappings, portable export, account ownership, or remote restore logic;
- read-only Momentum operations leave relevant source rows and outbox state unchanged;
- deleted/archived/lifecycle-ineligible records do not leak into Garden facts;
- timezone and local-date boundaries remain correct across the repository's five-zone matrix;
- restore/sync/account flows still pass impacted regression lanes despite extra read activity in Overview;
- day rollover and foreground refresh cannot surface yesterday's Garden as today or race a newer read with stale results.

If the audit finds a pre-existing unrelated Critical/High defect that is exercised by this campaign and threatens correctness, fix it with regression proof. Do not turn the campaign into an unbounded cleanup wave for unrelated Medium/Low debt; document lower-severity unrelated findings separately.

## Workstream G — Documentation, OpenSpec, QA Mapping, and Durable State

Keep the new campaign's OpenSpec and ExecPlan synchronized with reality throughout implementation.

Update documentation only where the current source/evidence changed. In particular:

- close the long-term simulation known gap only after exact proof;
- record native evidence as PASS/FAIL/ENVIRONMENT precisely;
- update `docs/testing/known-gaps.md` when a registered gap is genuinely added/removed/changed;
- update `qa/impact-map.json` if Momentum's shared boundaries are not conservatively represented;
- keep the predecessor `add-momentum-garden-v1` artifacts historically accurate rather than rewriting its completed evidence as though it happened in this campaign;
- record command, outcome, classification, artifact/repro path, and date in the new ExecPlan Validation Ledger.

## Failure Policy

Use exactly the repository taxonomy after reproduction:

- `PRODUCT_BUG`
- `TEST_BUG`
- `FLAKY_TEST`
- `ENVIRONMENT`
- `EXPECTED_KNOWN_GAP`
- `SPEC_AMBIGUITY`

An untriaged failure remains untriaged. A retry pass is not proof of flakiness. Preserve original evidence and fix the root cause. Never delete, skip, loosen, or inflate timing on a meaningful test merely to obtain green output.

Any Critical/High regression introduced or exposed by the Momentum Garden change must be fixed before campaign completion. Medium/Low unrelated issues may be recorded for a later campaign when fixing them would broaden scope materially.

## Required Validation Ladder

Use `qa:affected` to refine the exact ladder, but the campaign cannot be completed without fresh evidence for the following unless a command is genuinely unavailable and explicitly classified:

1. `npm run qa:fast`
2. `npm test`
3. `npm run qa:integration`
4. `npm run qa:timezones`
5. `npm run validate:themes`
6. `npm run build:web`
7. targeted Momentum Garden Playwright spec
8. `npm run e2e:journeys:p0`
9. broader Playwright/E2E required by impact analysis; prefer the full `npm run e2e` / `npm run e2e:full` before completion because shared simulation/Overview/Habit infrastructure changed
10. `npm run sim:validate`
11. exact deterministic reproduction of the prior long-run timeout
12. `npm run qa:simulation -- --all --mode deterministic`
13. `npm run qa:native:provision -- --serial <verified-serial>` when provisioning is needed
14. `npm run qa:native:android -- --serial <verified-serial>`
15. `npm run qa:native:targeted -- --serial <verified-serial>` when selected by impact/native scope
16. `npm run qa:native:lifecycle -- --serial <verified-serial>` when selected by impact/native scope
17. strict validation of the new OpenSpec change
18. `npm run agent:plan:validate -- --plan <new-execplan-path>`
19. `npm run agent:plan:validate:all`
20. `git diff --check`

Also inspect current CI/deployment checks on the exact pushed final SHA. A green Vercel deployment alone is not a substitute for repository QA. If GitHub Actions are configured only for PR triggers and no run exists for a direct-main commit, record that fact instead of fabricating a CI pass.

## Acceptance Gates

This campaign is complete only when all of the following are true:

1. The previously reproducible long-term `Start focus` failure has an evidence-backed root-cause classification and is either fixed with regression proof or the campaign is honestly BLOCKED by a real external limitation. It may not remain an unexplained timeout.
2. The complete deterministic simulation library passes from a fresh build with no hidden late-sequence failure.
3. Current-source Android provisioning/install and the required Maestro smoke/persistence/lifecycle lanes execute sequentially and produce real evidence, or an irreducible external environment blocker is explicitly documented. A collision caused by concurrently launched repo commands is not an acceptable final blocker.
4. Momentum Garden source semantics, bounded local-date behavior, read-only guarantees, accessibility, reduced motion, and reconstruction are proven in targeted automated tests.
5. The wider P0 and impact-selected browser regression suite is green; full E2E is green unless an explicitly classified external blocker prevents it.
6. Performance measurements show no material unbounded/N+1 behavior, no persistent Overview responsiveness regression, and no unexplained resource degradation attributable to the new feature. Any real regression is repaired and remeasured.
7. The new `rangeStartDateKey` parameter is proven not to change callers that rely on historical/full-range habit semantics.
8. No Momentum state has leaked into migration/sync/backup/restore/export/account boundaries.
9. All repository-caused Critical/High defects found by this campaign are fixed with regression coverage.
10. OpenSpec, ExecPlan, testing docs/known gaps, and QA mapping match the final source and evidence.
11. The final ExecPlan is `Status: COMPLETED` only after its full definition of done is proven; otherwise leave it `ACTIVE` or `BLOCKED` with a precise exact next action.

## Git and Delivery Requirements

- Work from current `main` after safe reconciliation with `origin/main`.
- Do not force-push or rewrite history.
- Keep task state in the new task-specific ExecPlan, not in `AGENTS.md` or a second global progress file.
- Commit coherent milestones as repository policy allows.
- Before final delivery, fetch/reconcile remote advancement, inspect the complete diff, run required final validation, and ensure no unrelated generated artifacts/logs are accidentally committed.
- Final campaign commit message must be a detailed session/campaign report summarizing: baseline SHA, root causes and classifications, implementation fixes, simulation evidence, browser evidence, native evidence, performance findings, remaining limitations, and exact validation results.
- Push all campaign commits normally to `origin/main`.
- Verify final local HEAD equals `origin/main` and the worktree is clean.
- Inspect checks/workflow results for the exact pushed final SHA and repair actionable repository-caused failures before claiming completion.

## Executor Behavior

Proceed autonomously. Do not return a prompt for another agent to paste. This file is the durable campaign instruction.

When invoked through `/goal continue`, read repository instructions and this prompt, create/resume the campaign's task-specific ExecPlan, reconcile Git, and execute from the first genuinely incomplete requirement. Do not redo already-landed predecessor work. Keep going through audit → reproduction → root-cause repair → broad validation → native/performance qualification → documentation → commit/push → exact-SHA verification until the acceptance gates are met or a genuine external blocker requires `Status: BLOCKED`.
