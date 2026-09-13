## 1. Reconcile and establish durable state

- [x] 1.1 Reconcile fetched `main` with `origin/main`, record the predecessor baseline and current SHA, and confirm the worktree is clean before implementation.
- [x] 1.2 Read the repository guidance, predecessor artifacts, affected source/callers, native guidance, QA impact map, and recent Git diff; record the audit boundary in the Version-2 ExecPlan.
- [x] 1.3 Run `npm run agent:plans`, create the campaign ExecPlan with `Status: ACTIVE`, and give it one exact next action.
- [x] 1.4 Run `npm run qa:affected -- --base 0187b98` (or the repository-equivalent impact command) and record the resolved gate set.

## 2. Whole-codebase contract audit

- [x] 2.1 Trace `buildDayCompletions` range handling through every caller and prove omitted/default full-history behavior, lifecycle masking, schedule transitions, targets, malformed dates, and timezone boundaries.
- [x] 2.2 Audit Momentum SQLite queries, limits, ordering, deleted/null handling, query count, one-connection behavior, and source/outbox read-only isolation on representative fixtures.
- [x] 2.3 Audit Overview refresh, day rollover, foreground refresh, unmount/remount, rapid switching, stale async responses, error/empty states, and Planning Hub 7/28-day toggles.
- [x] 2.4 Audit the shared simulation Calories locator change and all affected scenario/helper callers for regressions outside the predecessor Garden journey.

## 3. Reproduce and repair long-run simulation stability

- [x] 3.1 Reproduce the prior late-sequence `Start focus` timeout from a fresh build and preserve the original report, action log, state/database evidence, and repro bundle.
- [x] 3.2 Classify the reproduced failure with the repository taxonomy and document root cause evidence before changing synchronization or timeout policy.
- [x] 3.3 Implement the smallest source-level or observable test-helper repair justified by the root cause; do not add blind sleeps or weaken assertions.
- [x] 3.4 Add regression coverage for the reproduced cause and replay the exact late sequence repeatedly from fresh state.

## 4. Performance and data-boundary proof

- [x] 4.1 Build repeated empty, typical, and long-history measurements for Overview Today, 7/28-day detail, repeated refresh, and repeated view toggles.
- [x] 4.2 Measure query count/limits and long-history habit-domain behavior; fix and remeasure any material unbounded/N+1 or responsiveness regression attributable to the campaign.
- [x] 4.3 Add or strengthen real-SQLite/read-only assertions for deleted rows, date boundaries, outbox stability, restore/sync isolation, and no Garden persistence boundary.

## 5. Browser, simulation, and repository regression

- [x] 5.1 Build a fresh static export and run the focused Momentum Garden journey, including empty, attribution, reload, detail, keyboard, reduced-motion, and no-write behavior.
- [x] 5.2 Run P0 journeys and the broader impact-selected/full Playwright E2E suite; preserve and classify any failure without weakening selectors/assertions.
- [x] 5.3 Run `npm run sim:validate`, the exact long-run reproduction, and `npm run qa:simulation -- --all --mode deterministic` from fresh state; retain reports and action logs.
- [x] 5.4 Run unit, integration, timezone, theme, typecheck, lint, formatting, and diff-hygiene gates required by the impact map.

## 6. Sequential Android qualification

- [x] 6.1 Preflight the documented API-36 x86_64 target, package identity, toolchain, and current-source provenance; record an explicit ENVIRONMENT result if unavailable.
- [x] 6.2 Provision/install the current source sequentially when needed and run native smoke with preserved JSON/Maestro artifacts.
- [x] 6.3 Run the selected persistence, targeted, and lifecycle lanes sequentially, including a focused Garden reachability/read-only flow if existing coverage cannot prove it.
- [x] 6.4 Classify every native result and record exact replay commands; keep Windows iOS limitations honest unless an executable cloud lane is run.

## 7. Documentation, final validation, and delivery

- [x] 7.1 Update known gaps, QA impact metadata, and campaign docs only where fresh source/evidence changes the documented state.
- [x] 7.2 Reconcile the OpenSpec tasks and ExecPlan checkpoint/validation ledger with actual files, artifacts, classifications, and remaining limitations.
- [x] 7.3 Run strict OpenSpec validation, both ExecPlan validators, the final required QA ladder, and exact-SHA CI/deployment inspection.
- [x] 7.4 Commit coherent campaign changes with the required detailed session-report body, push normally to `origin/main`, and verify clean-tree/local-remote SHA parity.
