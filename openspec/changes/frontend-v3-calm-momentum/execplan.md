# ExecPlan: Frontend V3 — Calm Momentum UI/UX reconstruction

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Reconstruct SuperHabits' frontend into a visually polished, coherent, fast,
accessible consumer productivity app ("Calm Momentum") while preserving proven
domain behavior. Implements the
[frontend-v3-calm-momentum OpenSpec change](proposal.md). The owner explicitly
rejected the current rendered experience; prior "visual QA complete" claims are
historical evidence only.

## Context

- Baseline HEAD `3a376374a643786ce70152ce2c427156e9f502df` (= `origin/main` at
  campaign start). One stash (`pre-recovery-local-changes`) and one untracked
  `.tmp-ios36423379932/` dir preserved untouched.
- Rendered-truth audit found systemic Pop-reflex damage (SYS-01…SYS-20 in the
  defect ledger): doc-copy subtitles push content below the fold, saturated
  slab headers dominate, five-hue stat strips, FAB overlaps content/forms on
  4 of 6 sections, dark-theme hero has white-on-light-lavender contrast
  failure, triple-duplicated counts on Todos, "Reset (not logged)" clipped,
  neutral progress rendered in danger-red on Habits.
- Refero research synthesized into reference lock: calm information-first
  primary (Perplexity/Todoist/ChatGPT neutrals, single-accent discipline);
  task/habit/workout/nutrition/capture screen patterns recorded with
  adopt/reject decisions per area.
- Design system doc `docs/ui-ux/13-calm-momentum-design-system.md` is the
  campaign authority; Pop doc `12` is superseded for visual rules.
- W4 shipped the five-destination phone model (Health parents
  Workout/Calories) with the capture slot replacing the floating FAB. At W4,
  the owner's unrelated `brain-training` server occupied 8081. W6.5 preflight
  found 8081/8082 free; continue isolated `E2E_PORT=8083` lanes and inspect
  current owners rather than acting on historical PID 42924.

## Scope

- `core/theme/*` token values + derivation; `core/ui/*` shared primitives;
  `app/index.tsx` shell/navigation; one screen wave per feature area
  (W5–W13); persistent visual-regression suite (W15); Android qualification
  (W16); final regression (W17).
- W6.5 closed the bounded W6 residuals: measured standard-row density,
  windowed query/selection/completed-heavy states, planning capture accent,
  and campaign reconciliation. W7 is implemented and in broad QA/publication
  convergence; its slice plan owns current detail. Preserve W6 history and domain semantics.

## Non-Goals

- No domain/persistence/sync/backup semantics changes (`core/db`, `core/sync`,
  `core/backup`, `core/portable`, Supabase functions).
- No production Supabase mutations; no iOS certification (owner-deferred).
- No dependency-security work: braces/node-forge audit reds stay upstream.
- No broad redesign restart: Calm Momentum direction is preserved unless
  rendered evidence proves a decision wrong.
- No Android full certification before W16 (bounded native checks only if a
  wave correction makes it necessary).
- No casual changes to todo persistence, sync, recurrence, completion
  semantics, project linkage, priority meaning, due-date calculations,
  notification scheduling, or backup/restore during W6.

## Current Checkpoint

- Current milestone: W11.5.1 Timezone Determinism & Review Closure COMPLETE and merged to main as `ec53e1efcae8deb1531238409293d10b201170ec` (PR #75, branch `frontend-v3-w1151-timezone-review-closure`, final head `8299339`): the W11.5 planning fixtures now derive their browser-local date inside the Chromium context (`e2e/helpers/browserDate.ts`, mirroring `toDateKey()`), the UTC→Manila crossover is proven deterministically with a clock-controlled regression (`e2e/planning-w1151-timezone.spec.ts`) plus host-TZ independence runs, both PR #74 Codex P2 threads are resolved with verified `isResolved: true` (timezone fixed with evidence; stale ExecPlan verified already corrected on `main` `17553e6`), and no production/schema/dependency/security change was made. W11.5 closure state preserved; W12 Weekly Review / Progress / Activity remains the next unstarted milestone.
- Completed: W0–W7 unchanged semantically; W6.5 closed and MERGED to main as merge commit `f37539a969bdc7c3dc539c2d47db3f6580429c64` (PR58 MERGED 2026-10-08). W7 rebuilt Habits as a date-scoped, list-first daily check-in and merged to main as merge commit `f679a26a28a8abf3472b44e3b5fbdf229222b927` (PR 59) in three commits `9bf4fda`, `0a8e86d`, `3086b27`; its exact-head CI run is [37822880601](https://github.com/quantdale/super-habits/actions/runs/37822880601) with the follow-up scheduled run [37848841434](https://github.com/quantdale/super-habits/actions/runs/37848841434) recorded as reference ids only. W8 Focus was published in three merges: `b47179b` (PR 60, Focus reconstruction), `ce00e37` (PR 61, visual-audit registration), and the W8 closure `c32685364cbe9c6d34a512c3b2bcef9b3a432e0b` (PR 62, commits `3c4b96c`, `e4fd28f`, `9009c17`). The final W8 baseline is `c32685364cbe9c6d34a512c3b2bcef9b3a432e0b`, with exact-head CI run [37914856206](https://github.com/quantdale/super-habits/actions/runs/37914856206) succeeding on every frontend gate through unit/integration — 2,576 hosted tests passed / 3 skipped — and failing only the two pre-existing undocumented HIGH advisories (`braces` GHSA-vfj7-8cjw-p6xm, `node-forge` GHSA-86w9-cpqp-85rv), so hosted `e2e`/`nightly` skip behind that gate and are NOT passed. W8.5 closed the Focus timer-start race and merged to main as merge commit `aa5835e9fe8ecaa43b55b805d866232503b28c77` (PR 63, branch `frontend-v3-w85-focus-startup`) in two coherent commits `be6db92` and `ca169f5`. Its exact-head CI runs are [37942994150](https://github.com/quantdale/super-habits/actions/runs/37942994150) (push) and [37942146908](https://github.com/quantdale/super-habits/actions/runs/37942146908) (pull request): every frontend gate passed — Typecheck, the Supabase edge-function type-check, Lint, theme tokens, openspec contracts, journey-label and quarantine-register parity, versioned ExecPlans, and the unit+integration test projects — and the first failing step was `Audit runtime dependencies (gates on new high/critical)`, failing on exactly the same two pre-existing undocumented HIGH advisories (`braces` GHSA-vfj7-8cjw-p6xm at `node_modules/braces`, `node-forge` GHSA-86w9-cpqp-85rv at `node_modules/node-forge`), so hosted `e2e`/`nightly` skipped behind that gate and are NOT passed. No dependency, lockfile, or patch file changed in either wave. No new hosted failure was introduced and no security-gate waiver was added. Stash, foreign iOS evidence, and historical captures preserved. No overall certification.
- In progress: None in W11.5 after publication; its code, evidence and records close through PR #74. W12 has not begun. Existing security/native product-certification residuals remain tracked; W11.5 introduced no dependency, schema, migration or security-policy change.
- Important modified files: W8.5 touched `features/pomodoro/pomodoro.startup.ts` (new), `features/pomodoro/PomodoroScreen.tsx`, `features/pomodoro/pomodoro.domain.ts`, `features/pomodoro/pomodoroCommandBridgeContext.ts`, `features/pomodoro/pomodoroCommandBridge.tsx`, `features/command/command.executor.ts`, `tests/pomodoro.startup.test.ts` (new), `tests/integration/pomodoroStartupIntent.test.ts` (new), `e2e/pomodoro.spec.ts`, `e2e/pomodoro-w85-audit.spec.ts` (new), `docs/ui-ux/v3-audit/w8.5/`, and both plans. No data-layer, schema, dependency, or security-policy change; no migration was added.
- Last successful validation: W11 local exact-head `74d4aaf` — typecheck 0; lint 0/0; Vitest 2,675 passed / 3 skipped (single failure proven to be the Windows-CRLF residual, identical on pristine main); integration 416 passed / 2 skipped; themes 140/140; OpenSpec 80/80; plans PASS; parity guards OK; hermetic export PASS; planning 7/7; journeys P0 25/25; deterministic simulation PASS. W10.5 standalone targeted Playwright run `38277711149` at `15b859a` — 26/26 Chromium PASS; W10.5 hosted CI `38277711157` PASS through unit/integration 2,676 / 3 skipped before inherited audit-only red.
- Current failures: Inherited high advisories `braces` GHSA-vfj7-8cjw-p6xm and `node-forge` GHSA-86w9-cpqp-85rv block hosted E2E/nightly; Windows-CRLF register parsing, D14 host-load headroom, and Focus notification-timestamp issues remain recorded; no new W10 product regression proven.
- Relevant quarantines: none added; existing internal/remote/visual opt-ins unchanged.
- Blockers: None for web continuation. Native Android qualification remains environment-blocked (the required API36/x86_64 target was not previously available; Android W16 pending) and iOS remains owner-deferred, so no native timer or notification certification is claimed from browser tests. Full application certification is not claimed.
- Exact next action: Author the W12 Weekly Review / Progress / Activity OpenSpec slice and versioned ExecPlan (narrative-first review, charts supporting the story, reduced analytics-wall presentation — SUR-12), inspect the live weekly-review/progress/activity flows, then begin source changes only after design lock.
- Remaining definition of done: Overall Frontend V3 campaign remains ACTIVE. W0–W11 published and documented; W12–W17 pending. Android API36 W16, iOS owner-deferred, Focus notification timestamp, D14/CRLF environmental residuals and unresolved dependency audit advisories prevent overall application certification.

## Progress

- [x] W0 — repository truth reconciled (HEAD `3a37637` = origin, stash/tmp
      evidence preserved)
- [x] W1 — 47-image rendered audit + 33-defect ledger (`docs/ui-ux/15`)
- [x] W2 — Refero research + reference lock + design system (`docs/ui-ux/13`,
      `docs/ui-ux/14`)
- [x] W3 — foundation shipped (`8888084`): tokens, theme derivation, Screen,
      Button (+celebrate), Card, PageHeader, StatBlock, PillChip,
      SegmentedControl, EmptyStateCard, SectionLabel; TactileButton absorbed
- [x] W4 — five-destination shell + capture slot + Health parent (`282bfce`)
- [x] W4.5 — foundation/shell correction pass (commit 10e1462; hosted run
      37509416280 green through unit/integration)
- [x] W5 — Today reconstruction (orientation-first; 5 defects verified fixed)
- [x] W6 — To Do + Quick Capture (flat list anatomy; SYS-05/SUR-03/SUR-04/
      SUR-10/SYS-13 verified fixed; HEAVY/long-title/bulk/completed/empty
      states rendered and inspected)
- [x] W6.5 — bounded density / HEAVY virtualization / completed scalability /
      campaign-record convergence (local gates PASS; hosted audit-only red;
      native qualification limits explicit)
- [x] Owner-requested W6.5 main publication — deploy-generation bump,
      normal merge (PR58 MERGED, main=f37539a), exact-main CI
      (run37716057446, audit-only red) and full report (2026-10-08)
- [x] W7 — Habits daily check-in (merge commit `f679a26`, PR 59,
      exact-head CI 37822880601 green on every quality step except the two
      pre-existing braces/node-forge advisories; two D14 timing steps recorded
      as ENVIRONMENT host-load residuals on known-gap 15)
- [x] W8 — Focus reconstruction (merge `b47179b`, PR 60; register fix
      `ce00e37`, PR 61; closure merge `c326853`, PR 62; exact-head CI
      37914293799 and the final W8-baseline exact-head CI 37914856206 both
      green through unit/integration — 2,576 hosted tests passed / 3 skipped —
      audit-only red on braces/node-forge; hosted e2e skipped)
- [x] W8.5 — bounded Focus timer-start safety convergence (explicit
      IDLE → STARTING → RUNNING → PAUSED authority, synchronously guarded
      configuration paths, frozen governing preset, honest notification
      tri-state, and rejected-startup recovery; deterministic deferred-
      scheduling race regression, real-SQLite durable-intent integration
      coverage, 16/16 Focus E2E, and 13 inspected W8.5 rendered captures)
- [x] W9 — Workout (merge 55f8532, PR 65; exact-head CI 38079997882 green through unit/integration at 2650 passed / 3 skipped, audit-only red on braces/node-forge, hosted e2e skipped; W9 closure + W10 handoff PR 66 merged as 8cdee8e with exact-head CI 38083748134 green through unit/integration at 2650 passed / 3 skipped, audit-only red on braces/node-forge, hosted e2e skipped; 22 inspected captures in docs/ui-ux/v3-audit/w9/)
- [x] W9.5 — bounded workout convergence: skipped-save false success closed (durable-success guard + accurate routine-unavailable message + post-commit bookkeeping isolation + draft write/clear race) and the landing reduced to exactly one page-level scroll-enabled `Screen`; evidence: unit decision contract, real-SQLite save-integrity oracles, 10/10 W9.5 e2e regressions, 9 inspected captures in `docs/ui-ux/v3-audit/w9.5/`; merged as `24b01b5` (PR #67) with exact-head CI `38162706650` green through unit/integration at 2,665 passed / 3 skipped, audit-only red on braces/node-forge, hosted e2e/nightly skipped
- [x] W10 — Calories reconstruction + D3 navigation gate (slice `openspec/changes/frontend-v3-w10-calories/`; logging-first hierarchy with one remaining/consumed/goal fact each, shared meal-grouped day log with visible edit/delete, collapsed History & insights disclosure with disclosure-scoped derivations, SYS-06/SYS-18/SUR-07 verified fixed; D3 measured five-destination 3/3/1 taps vs six-tab 2/2/1 → six-tab shipped with 11px labels and >=44pt targets at 360; `health` kept as a valid non-bar section; evidence in `docs/ui-ux/v3-audit/w10/`, regressions in `e2e/calories-w10.spec.ts` 14/14 and `e2e/health-nav-w10.spec.ts` 6/6, real-SQLite oracles in `tests/integration/caloriesW10LoggingIntegrity.test.ts` 7/7; merged as `f7d313b` (PR #70, 6 commits) with exact-head CI run 38259047679 green on every frontend gate through unit/integration at 2,676 passed / 3 skipped, audit-only red on the same two braces/node-forge advisories, hosted e2e/nightly skipped, Vercel production deploy success)
- [x] W10.5 — bounded Calories truth/reliability and record convergence; source merged PR #71 (`10cff427`), original W10 Codex duplicate-goal P2 review resolved, targeted Chromium E2E 26/26 PASS (`38277711149`), hosted TypeScript/lint/themes/OpenSpec/plans and 2,676 unit/integration PASS before inherited audit-only red (`38277711157`); source provenance clarified without rewriting original D3 captures; no schema/dependency/policy changes
- [x] W11 — Planning / Goals / Projects / Daily Plan (slice `openspec/changes/frontend-v3-w11-planning/`; shared objective/status/context/progress row grammar, collapsed filter/sort disclosures with persisted state and active-filter signal, detail disclosures for secondary fields, Daily Plan intention/priority-first hierarchy with Save above optional sections, Today briefing disclosure; adversarial-review failure surfaces for rejected saves/deletes/lifecycle transitions; 82 inspected before/after captures in `docs/ui-ux/v3-audit/w11/`; planning E2E 7/7, journeys P0 25/25, integration 416 passed local exact-head; merged to main as `ffb02f2` (PR #73) with exact-head CI run 38343799936 green on every quality step through unit+integration, audit-only red on the two inherited advisories, hosted e2e/nightly skipped)
- [x] W11.5 — Planning reliability & regression closure (branch `frontend-v3-w115-planning-reliability`, merged to main as `d8bb43a`, PR #74; PR #73 P2 full-card press-target thread verified and resolved with executable title/context/percent/bar clicks + reorder independence; 8 real-SQLite trigger-injection regressions close the W11 D10 not-stageable limitation with row/outbox/retry oracles; raw engine-message leak fixed via `planningWriteError.ts`; evidence in `docs/ui-ux/v3-audit/w11.5/`; ExecPlan `.agent/execplans/frontend-v3-w115-planning-reliability.md` COMPLETED; no schema/dependency/policy change)
- [x] W11.5.1 — Timezone determinism & review closure (branch `frontend-v3-w1151-timezone-review-closure`, merged to main as `ec53e1e`, PR #75; W11.5 planning fixtures derive their browser-local date in Chromium via `e2e/helpers/browserDate.ts`, deterministic UTC→Manila crossover regression `e2e/planning-w1151-timezone.spec.ts` plus host-TZ independence runs under TZ=UTC / TZ=Pacific/Kiritimati; both PR #74 Codex P2 threads resolved with verified `isResolved: true`; no production/schema/dependency/security change; ExecPlan `.agent/execplans/frontend-v3-w1151-timezone-review-closure.md` COMPLETED)
- [ ] W12 — Weekly Review / Progress / Activity
- [ ] W13 — Settings / secondary surfaces
- [ ] W14 — full visual integrity sweep
- [ ] W15 — persistent visual regression suite
- [ ] W16 — Android current-source qualification
- [ ] W17 — final regression + adversarial review

## Surprises & Discoveries

- W6.5 rendered baseline: plain 65px (48 checkbox + 16 padding + 1 separator),
  metadata 65px, two-line title 65px, two-line + metadata 75px. More face 40px.
  Regression deliberately failed before implementation; baseline screenshot,
  geometry attachment and trace preserved in `.cursor/playwright-output/w65-baseline/`.
- W6.5 broad12 failures reproduce on baseline; not product regressions.
  Button paints solid face through an absolute sibling, not ancestor bg;
  Weekly Review has page+modal entries; workout modal is measured mid-scale;
  P5 expects pre-W6 Show-completed copy; simulation expects pre-W6 child1.
  Baseline junction export puts WASM under assets/_superhabits/node_modules;
  first attempt ENVIRONMENT before any UI. Aliased that exact generated asset
  directory to the harness's standard path without changing source/bundle;
  clean rerun reproduces all12. Isolated owned detached worktree
  `../superhabits-w65-baseline` at adc4844; evidence preserved, clean owned
  worktree and junction removed (shared node_modules untouched).
- W6.5: Select all's count-only comparison fails if a query changes to another
  same-sized result set. Use membership of visible ids, with selection state
  retained in TodosScreen and passed through SectionList.extraData.
- W6.5 release gate: a 160-row HEAVY bulk-complete settles5.1–9.1s (per-row
  post-commit dispatch) — beyond the 5s UI expect default though well within
  one user action. No D14-style ceiling covers bulk batch cost; the test now
  measures it as evidence instead of absorbing it into an assertion timeout.
- Security lane (W5, bounded): both NEW advisories had patched releases
  available and parent ranges permitting semver-compatible overrides —
  the repo's existing overrides block already carried a shell-quote pin
  that had aged into the vulnerable range; refreshing it was the minimal
  repair per the ladder (override before parent-upgrade). Neither package
  ships in the web/Android bundles (verified by dist grep + dependency
  chain classification), so the fix is defense-in-depth for the CI gate,
  not a runtime rescue.

- The W1 audit showed the damage was systemic (Pop reflexes), not isolated
  bugs: every primary screen reproduced the same five defects patterns.
- `canvasTint` rendered as a stray quarter-disc arc at the 900px rail
  breakpoint — removed entirely rather than patched.
- At W4, port8081 was occupied by unrelated brain-training (then PID42924).
  W6.5 preflight/final hygiene find8081/8082 free; owned8083 also released.
  Historical PID is not present ownership evidence; never kill unrelated
  processes. Continue isolated finite `E2E_PORT=8083` lanes.
- The repository enforces ExecPlan schema as a hosted quality gate
  (`Validate versioned ExecPlans`), so plan drift is a build failure, not
  paperwork — discovered when run 37479209183 failed before the known
  dependency-audit step.
- Overview's stat strip is screen-local (not `StatBlock`), which is why W3's
  neutral-stat fix did not change the rendered glance cards; that belongs to
  W5's Today rebuild.

## Decision Log

- D1: evolve existing token exports (no fork) — minimizes churn across ~20
  screens and keeps 14 themes derivable.
- D2: TactileButton deleted; `Button variant="celebrate"` carries the retired
  Pop 3D lip (single press-physics implementation).
- D3: five-destination phone navigation with a W10 evidence gate; six-tab
  fallback documented. Health parents Workout/Calories; both remain
  first-class AppSections so deep links and linked actions keep working.
- D4: screen waves W5–W13 may parallelize across disjoint feature dirs only
  after foundation stabilizes; shared primitives stay single-owner.
- D5: visual regression = curated `toHaveScreenshot` baselines, not every
  state; baseline edits require defect-ledger notes.
- D6: capture affordance = raised center slot in the phone bar / rail header
  action on desktop; floating FAB removed everywhere (SYS-04).
- D7: W4.5 is a convergence pass — Calm Momentum stands unless rendered
  evidence disproves a specific decision.
- D8 (W6.5): two explicit list paths, not a fragile generic drag abstraction.
  Collapsed normal/manual uses pending-only DraggableFlatList; query/filter,
  selection and expanded completed history use one SectionList (window5,
  initial/batch12, variable height). Expanded history retains pending order
  but disables drag until collapsed; no nested virtualized lists.
- D9 (W6.5): planning capture uses tokens.accent (no borrowed Health identity).
  Preserve destination section hues and the W6 reference lock. New captures
  go to `docs/ui-ux/v3-audit/w6.5/`, leaving earlier audit files untouched.
- D10 (main publication): owner authorizes normal PR58 merge despite known
  audit-only red. Main has no protection/rules; do not use admin/force or
  weaken audit. Actual PWA generation is static; bump v7→v8 for shell-changing
  deployment and keep asserted guidance pins aligned. Cache strategy unchanged.
- D11 (2026-10-08) — HEAVY bulk-complete settle is batch-scoped — the
  160-row durable batch (updates + outbox enqueue + per-row post-commit
  reminder/linked-action dispatch) measures5.1s under suite load (trace
  `w65-main/trace-analysis/`) and9065ms focused. The toolbar-restore expect
  uses one documented20s batch window with the measured settle attached;
  every row/count/SQL oracle and the geometry/timing ceilings stay exact.
  This widens only the settle synchronization for a known heavy batch — it
  creates no bulk-performance acceptance threshold and no D14 ceiling.

## Validation Ledger

- 2026-10-13 W11.5.1 MERGED and closed on main: PR #75 merged as
  `ec53e1efcae8deb1531238409293d10b201170ec` (branch
  `frontend-v3-w1151-timezone-review-closure`, final head `8299339`).
  The W11.5 completed-plan fixture previously derived its date in Node,
  so on a host whose calendar date differed from Chromium's pinned
  `Asia/Manila` (a UTC host between 16:00 and midnight UTC) the
  rejected-Complete journey seeded the wrong `date_key` and failed
  before exercising the intended SQLite UPDATE rejection; the defect
  was locally masked because the workstation TZ is also Manila.
  Correction: `e2e/helpers/browserDate.ts` derives the browser-local
  date with the same local-calendar getters as `toDateKey()`, the
  journey derives it before any DB-harness navigation with
  fixture-selection oracles (`Plan for <date>` + `date_key` rows +
  preserved table-wide exactly-one-row), and
  `e2e/planning-w1151-timezone.spec.ts` proves the crossover
  deterministically with the shared `installClock` helper at
  `2026-10-13T16:30:00.000Z` (UTC Oct 13 vs browser Oct 14). Executed:
  focused lanes 18/18 (Planning Hub 4/4, W11 3/3, W11.5 8/8, timezone
  3/3); host-TZ independence 11/11 under `TZ=UTC` and 11/11 under
  `TZ=Pacific/Kiritimati`; P0 journeys 25/25; deterministic simulation
  PASS; focused impact tests 35/35; typecheck 0; lint 0/0; themes
  140/140; OpenSpec 80/80; plans PASS; parity + release-profile guards
  OK; full Vitest 2,679 passed / 2 skipped / 1 failed (the documented
  Windows-CRLF residual, identical on pristine main). Hosted: final-head
  CI [38379209565](https://github.com/quantdale/super-habits/actions/runs/38379209565)
  / [38379215776](https://github.com/quantdale/super-habits/actions/runs/38379215776)
  green on every quality step with only the inherited
  braces/node-forge audit red (hosted e2e/nightly skipped); the
  temporary branch-only targeted lane
  [38378633411](https://github.com/quantdale/super-habits/actions/runs/38378633411)
  ran the planning journeys on hosted Chromium — SUCCESS — removed
  before merge. Both PR #74 threads replied to (4257073023, 4257188665) and resolved with `isResolved: true` verified. Known
  residual documented in `docs/ui-ux/v3-audit/w11.5.1/`: sibling specs
  (`planning-hub.spec.ts`, `calories*.spec.ts`) share the Node-local
  date pattern; `e2e/helpers/browserDate.ts` is the follow-up drop-in.
  No production, schema, migration, dependency or security-policy
  change.
- 2026-10-13 W11.5 MERGED and closed on main: PR #74 merged as
  `d8bb43ab1193f3ec3c94597862c694fa343f1a12` (branch
  `frontend-v3-w115-planning-reliability`, final head `b3db181`). PR #73
  Codex P2 thread `PRRT_kwDORgzj086rkJjX` verified on live code — the
  `Pressable` in `PlanningSummaryRow.tsx` already wraps title, context
  line, percentage and progress bar with reorder controls independent —
  pinned with new semantic assertions in `e2e/planning-w11.spec.ts`
  (3/3) plus the untouched `e2e/planning-hub.spec.ts` (4/4); the thread
  reply (comment 4255394284) was posted and the thread resolved
  (`isResolved: true` read back from GraphQL). The W11 D10 limitation is
  closed: `e2e/planning-w115-reliability.spec.ts` 8/8 PASS rejects real
  writes with SQLite `RAISE(ABORT)` triggers through the DB harness
  (Daily Plan save/complete, Goal create/rename/soft-delete, Project
  lifecycle/soft-delete, backup-intent-only) and asserts UI failure
  states, row/outbox atomicity and retry-success exactly-once behavior;
  raw engine messages no longer leak (`planningWriteError.ts`, unit
  3/3). Local gates: typecheck 0; lint 0/0; themes 140/140; OpenSpec
  80/80; plans PASS; parity guards OK; Vitest 2,679 passed / 2 skipped /
  1 failed (the documented Windows-CRLF residual, identical on pristine
  main); `e2e:journeys:p0` 25/25; deterministic simulation PASS; full
  Playwright battery 309 passed / 2 failed / 78 skipped / 4 did not run —
  both failures classified (one battery-load flake passing standalone on
  baseline and branch, one pre-existing baseline failure in
  `settings-ripple.spec.ts` reproduced on pristine `2cfe168`). Hosted
  exact-head CI: push run
  [38365404337](https://github.com/quantdale/super-habits/actions/runs/38365404337)
  and PR run
  [38365411189](https://github.com/quantdale/super-habits/actions/runs/38365411189)
  pass every quality step through unit+integration and fail only the
  inherited `Audit runtime dependencies` gate on `braces`
  GHSA-vfj7-8cjw-p6xm / `node-forge` GHSA-86w9-cpqp-85rv; hosted
  e2e/nightly skipped. The temporary branch-only targeted workflow
  [38357160655](https://github.com/quantdale/super-habits/actions/runs/38357160655)
  ran the 11 planning journeys on hosted Chromium — SUCCESS — and was
  removed before merge. No schema, migration, dependency or
  security-policy change; W11's 82 captures preserved with an additive
  W11.5 audit record; W11 ExecPlan's COMPLETED status untouched.
- 2026-10-13 W11.5 closed (branch `frontend-v3-w115-planning-reliability`,
  PR #74, final head recorded at closure): PR #73 Codex P2 thread
  `PRRT_kwDORgzj086rkJjX` verified on live code — the `Pressable` in
  `PlanningSummaryRow.tsx` already wraps title, context line, percentage
  and progress bar with reorder controls independent — and pinned with
  new semantic assertions in `e2e/planning-w11.spec.ts` (3/3) plus the
  untouched `e2e/planning-hub.spec.ts` (4/4). The W11 D10
  "browser failed-write injection NOT STAGEABLE" limitation is closed:
  `e2e/planning-w115-reliability.spec.ts` 8/8 PASS rejects real writes
  with SQLite `RAISE(ABORT)` triggers through the DB harness (Daily Plan
  save/complete, Goal create/rename/soft-delete, Project lifecycle/
  soft-delete, backup-intent-only) and asserts UI failure states, row/
  outbox atomicity and retry-success exactly-once behavior; raw engine
  messages no longer leak (`planningWriteError.ts`, unit 3/3). Local
  exact-head gates: typecheck 0; lint 0/0; themes 140/140; OpenSpec
  80/80; plans PASS; parity guards OK; Vitest 2,679 passed / 2 skipped /
  1 failed (the documented Windows-CRLF residual, identical on pristine
  main); `e2e:journeys:p0` 25/25; deterministic simulation PASS. No
  schema, migration, dependency or security-policy change; W11's 82
  captures preserved with an additive W11.5 audit record.
- 2026-10-13 W11 MERGED and closed on main: PR #73 merged as merge commit
  `ffb02f2f176f7794386f6ca96f7db5262b8ea04d` (branch
  `frontend-v3-w11-planning`, final head `e669385` = implementation
  `74d4aaf` + this closure record). Exact-head CI at `e669385`: push run
  [38343799936](https://github.com/quantdale/super-habits/actions/runs/38343799936)
  and pull-request run
  [38343804230](https://github.com/quantdale/super-habits/actions/runs/38343804230)
  pass every quality step — Typecheck, Supabase/Deno edge-function
  type-check, Lint, theme tokens, OpenSpec contracts, journey-label and
  quarantine-register parity, versioned ExecPlans, and Test (unit +
  integration projects) — and fail only the first inherited step
  `Audit runtime dependencies (gates on new high/critical)` on
  `braces` GHSA-vfj7-8cjw-p6xm and `node-forge` GHSA-86w9-cpqp-85rv;
  hosted e2e/nightly skip behind that gate and are NOT passed. Local
  exact-head gates at `74d4aaf`: typecheck 0; lint 0/0; Vitest 2,675
  passed / 3 skipped with the single failure proven to be the documented
  Windows-CRLF residual that fails identically on pristine main;
  integration 416 passed / 2 skipped; themes 140/140; OpenSpec 80/80;
  plans PASS; parity guards OK; hermetic export PASS; planning 7/7;
  journeys P0 25/25; deterministic simulation PASS. Independent hosted
  Planning Chromium lanes `38285465187` and `38287180079` 7/7 PASS on
  real SQLite; visual recapture `38287180103`. Adversarial-review
  correction `74d4aaf` added visible failure surfaces for rejected Daily
  Plan saves, Goal/Project deletes, and persist-before-refresh Project
  lifecycle transitions — no data-layer/semantics change. No dependency,
  lockfile, patch, schema, migration, sync or security-policy change; no
  new quarantine; native qualification NOT claimed.
- 2026-10-11 W9.5 closed: PR #67 MERGED to main as merge commit
  `24b01b5d47bdc9088428fe1df3e549d318e98109` (branch
  `frontend-v3-w95-workout-convergence`; commits `3bee453` source fix +
  `e40ef87` tests/evidence/records). Exact-head run
  [38162706650](https://github.com/quantdale/super-habits/actions/runs/38162706650)
  succeeds every frontend gate (typecheck, Supabase edge-function type-check,
  lint, themes, openspec contracts, journey-label + quarantine-register parity,
  versioned ExecPlans, unit+integration 260 files passed / 1 skipped,
  2,665 tests passed / 3 skipped) and fails only the two pre-existing
  undocumented `braces`/`node-forge` advisories; hosted e2e/nightly skip behind
  that gate and are NOT passed. Vercel production deployment succeeded at the
  same SHA. Stash `stash@{0}`, foreign `.tmp-ios36423379932/`, and all
  historical captures preserved; no security-policy, dependency, schema, or
  migration change.
- 2026-10-11 W9.5 final exact-head run at the closure commit `94be24db3e2b22e9328ab6e40368edc4af71af0a`: [38167261836](https://github.com/quantdale/super-habits/actions/runs/38167261836) succeeds every frontend gate (typecheck, Supabase edge-function type-check, lint, themes, openspec contracts, journey-label + quarantine-register parity, versioned ExecPlans, unit+integration 260 files passed / 1 skipped, 2,665 tests passed / 3 skipped) and fails only the same two undocumented `braces`/`node-forge` advisories; hosted e2e/nightly skip behind that gate. Vercel production deployment succeeded at the same SHA.
- 2026-10-11 W9.5 opened and implemented (baseline `8cdee8e` verified =
  origin/main; stash `pre-recovery-local-changes`, foreign
  `.tmp-ios36423379932/`, and W1–W9 captures preserved; single worktree):
  pre-fix reproduction executed — a routine soft-deleted mid-session makes
  `logWorkoutSession()` return `{ status: 'skipped', logId: null }` without
  throwing while zero `workout_logs` rows exist, and the pre-fix handler
  entered the saved-outcome state with the draft cleared and no error
  (fixture output preserved; fixture removed after capture). W9.5 evidence:
  `npx tsc --noEmit` 0 errors; `npx openspec validate --all` 79/79;
  `npm run agent:plan:validate:all` PASS;
  `tests/workoutSessionSave.test.ts` 8/8 (decision contract + submit guard);
  `tests/integration/workoutSaveIntegrity.data.test.ts` 7/7 (real-SQLite
  oracles: exactly one log + set rows on applied, zero rows + `target_missing`
  reason on skipped, draft retention, exactly-once double submission, reward
  attribution to the committed id, no reward on skip);
  `E2E_PORT=8083 npx playwright test e2e/workout-w95.spec.ts` 6/6; W9.5
  rendered audit 2/2 with 9 inspected captures in
  `docs/ui-ux/v3-audit/w9.5/` (the skipped-save rendered state is not
  stageable in-browser — documented limitation covered by the integration
  oracles). Full ladder, publication, and exact-head hosted CI verification
  remain.

- 2026-10-09 W7 publication closed: three coherent commits `9bf4fda`
  (feature), `0a8e86d` (regressions + rendered evidence) and `3086b27`
  (spec, ledgers, plans) on branch `frontend-v3-w7-habits`; PR 59 MERGED to
  main as merge commit `f679a26`. Fresh supported-runtime W7
  `E2E_PORT=8083 TZ=Asia/Manila npm run qa:full` (pinned node v22.23.2 /
  npm 10.9.8; exact-tree hashes in
  `.cursor/playwright-output/w7-final-full-2/start.json`): typecheck PASS,
  lint PASS, Vitest 2571 passed / 2 skipped (254 files),
  `openspec validate --all` 74/74, `e2e:full` hermetic export PASS with 253
  passed / 64 skipped / 2 unexpected, `qa:simulation --all --mode
deterministic` 23/23. Exact-head CI run 37822880601 succeeds every quality
  step (typecheck, lint, theme tokens, openspec contracts, journey-label and
  quarantine parity, versioned ExecPlans, unit+integration tests) and fails
  only the two pre-existing undocumented `braces`/`node-forge` advisories —
  identical set to baseline d29c67b run 37717090214; no package.json,
  lockfile or patches file changed, so the advisory inventory is provably
  unchanged. Hosted e2e/nightly skip behind that gate and are NOT passed.
  The two local unexpected results are D14 budgeted steps classified
  `ENVIRONMENT` under ~95% foreign host load: `habits-w7.spec.ts:452`
  1045.08/1049.79ms vs the unchanged 800ms ceiling, and `three-months-in`
  failing at three different measurements on the same tree (435/500ms diary
  13.0%; calories→todos 854ms; worst-switch 683ms 14.6%); a second isolated
  HEAVY replay PASSED in 7.2s at CPU avg 84.8% and the earlier 22:45 matrix
  passed it in 5.7s on habits source last modified 22:30:59. Guard, ceiling,
  floor and all assertions unchanged; artifacts preserved in
  `w7-final-full-2/preserved/`; numbers recorded as a W7 addendum on
  `docs/testing/known-gaps.md` gap 15. Final `npm run web:hygiene` PASS.
  Stash `stash@{0}` and foreign `.tmp-ios36423379932/` preserved untouched.

- 2026-10-08 W7 exact reviewer convergence: workflow39dce9ca complete;
  Standards f59a093e and Spec fb0ea7fe reports both read, OK with notes /
  no issues (source only). Final qa:fast, timezones, themes, plans and strict
  slice validation PASS; hygiene8081/8082/8083 PASS. Fresh native smoke/
  persistence/lifecycle2/11/6 flows EXIT2 ENVIRONMENT API35-vs36, no device
  mutation. Broad qa:full next; publication not yet earned.

- 2026-10-08 W7 corrective convergence: supported checks/build PASS;
  boundary3/3, continuous affected journeys23/23 (rollover + HEAVY),
  Habits/contracts26/26, deterministic J7 1/1 PASS with unchanged exact rows.
  Target1 binary J7 red preserved before explicit target2 fix. Empty/dark
  instrument1/1 PASS; six regenerated PNGs inspected,46-image inventory.
  Recovery resume/impact PASS. All eight broad reds now focused-green, but
  fresh broad proof and exact retained Standards/Spec follow-up still required.

- 2026-10-08 W7 release-tree qa:full EXIT1: quality/build PASS, browser238
  PASS/8 FAIL/73 skipped entries, zero flaky. Fresh report/artifacts preserved
  under `w7-full/`; corrected a reporter-path collection mistake rather than
  substituting old focused proof. Final Standards and Spec reviews both BLOCK
  (workflow f0a2ec28-f01b-4057-b12e-ae7d0a9c4abe): empty Trends, ambiguous
  group choice and J7 binary/two-increment fixture accepted for correction.
  Original broad-red signatures and recovery evidence in `w7-convergence/`.

- 2026-10-08 W6.5 merged to main and exact-main CI verified: normal
  `--no-ff` merge of PR58 as `f37539a969bdc7c3dc539c2d47db3f6580429c64`
  (PR state MERGED), pushed to origin/main; release tree commit `0db6ab3`
  (bulk-settle race fix + PWA v8 + guidance pins + closure records). Exact
  main CI run37716057446: install/typecheck/Deno/lint/themes/OpenSpec/parity/
  plans PASS, unit+integration253 files PASS/1 skip +2558 tests PASS/3 skips,
  OpenSpec73/73, then ONLY `Audit runtime dependencies` fails on exactly the
  two known undocumented HIGHs (braces GHSA-vfj7-8cjw-p6xm, node-forge
  GHSA-86w9-cpqp-85rv; no critical). Hosted E2E/nightly skipped behind
  quality — not passed, not claimed. Evidence `w65-main/final-ci.json`,
  `final-ci-failed.log`, `final-quality.log`, `main-merge.log`,
  `pr-post-merge.json`.

- 2026-10-08 W6.5 HEAVY bulk-settle race (TEST_BUG): the release-gate run
  failed `HEAVY selection survives…` at toolbar restore while the failure
  screenshot showed correct product state (377 completed). Trace proof: the
  160-row batch settles5.0–5.1s under suite load, just past the 5s UI
  default. Repaired with one batch-scoped settle window + attached
  measurement (`bulkSettleMs`, 9065ms focused); no oracle weakened. Focused
  convergence6/6 PASS, and the same test re-passed in-suite (21.1s) in the
  next full run. Trace preserved in `w65-main/trace-analysis/`.
- 2026-10-08 release-tree final gates: qa:fast PASS (typecheck0, lint0/0,
  unit2162/2162, journey/quarantine/profile guards). qa:full final-tree
  phases: typecheck/lint/npm test2559 PASS/2 existing skips, OpenSpec73/73,
  chromium159 PASS/14 existing opt-in skips, pwa5/5 (v8 freshness), then two
  invocations externally interrupted mid-journeys (ENVIRONMENT, harness
  abort, exit1073807364; zero failure artifacts from either). Bounded
  completion runs all PASS on the same tree: journeys76/42 existing @sync
  skips + J8 D14 (cold615/5000, maxSwitch578/800, diary304/500,
  picker184/500), simulation project3/3, deterministic library23/23.
  Deploy preparation: PWA CACHE_VERSION v7→v8 with the two derived guidance
  pins (tests/agentDocConsistency derives them from source).
- 2026-10-07 main-release impact: explicit four follow-up paths resolve
  qa:fast +qa:full; no foreign iOS paths treated as task changes. SW diff is
  one generation literal; no handler/strategy edits. Active diagnostics has
  two pre-existing auxiliary AST findings at unchanged SW lines95/140
  (async map's implicit undefined return, URL(Request.url) without catch),
  not introduced by v8; repo lint/TypeScript and rendered gates decide this
  release. CLAUDE/pre-pr Markdown probe unavailable; Prettier/gates still run.
- 2026-10-07 final W6.5 documentation head bbd06a9: push37639196888 and
  PR37639207906 PASS through unit/integration (2558/3 existing skips), fail
  only the same two audit HIGHs; E2E skipped. Local doc-only fast2162 and
  focused agent-plan9/9, plans120/120 PASS. Owner now explicitly requests
  promotion to main. Fresh fetch: mainadc4844, PR58 headbbd06a9 mergeable;
  main unprotected with no active branch rules. Original stash object
  c35e281d740df1e367c1be0f38383237ca080239 and foreign iOS dir preserved.
  public/sw.js still has static v7, not asset-derived: v8 deploy bump needed,
  plus CLAUDE/pre-pr source-consistency pins. New release validation follows.
- W6 historical exact-head hosted: `37583824728` at
  `adc4844b26e31788f8f97c557d7afd55bf196079` — PASS through unit/integration
  (252 files passed / 1 skipped; 2553 tests passed / 3 skipped). First failure
  dependency audit: exactly braces GHSA-vfj7-8cjw-p6xm and node-forge
  GHSA-86w9-cpqp-85rv HIGH, known in repo but undocumented to the audit gate.
- W6.5 preflight: baseline equals expected remote main; resume validation
  PASS; web:hygiene 8081/8082 free. No security files changed.
- W6.5 focused unit/integration: typecheck PASS; Todo domain/data/list-contract,
  inline-submit and real-SQLite bulk suites 73/73 PASS. Active LSP reported
  no diagnostics but all four checks inconclusive; tsc is the confirmed gate.
- W6.5 baseline Chromium density repro: FAIL (PRODUCT_BUG) at 65px >56;
  four geometry samples attached and preserved before implementing repair.
- W6.5 focused rendered: standard55 / metadata55 / two-line55 / two-line+meta65
  px; checkbox48 and More44; browser large-type expansion PASS. Expanded
  HEAVY: 520 seeded, 311 open /217 completed after recurrence, 246 No-date
  results, query117ms, completed window23 near end; all deep scroll paths
  pass. Bulk priority/project/delete and full-order drag row oracles PASS.
- W6.5 targeted battery first pass: 56 PASS /2 FAIL /6 not run. Failures
  preserved under `.cursor/playwright-output/w65-chromium/`: density asserted
  floating rect47.999984px as <48 (TEST_BUG; round sub-millipixel noise only);
  fat-fingers stale-edit swipe bound a completion-settle copy that unmounted
  (TEST_BUG; await the existing 0-open atom, not a timeout). J8 strict D14
  PASS: cold685/5000, maxswitch599/800, diary419/500, picker224/500ms.
  New selection-test authoring failures were TEST_BUGs: initial batch pinning,
  Space versus supported Enter activation, and 201–209 being nine fixture ids.
- 2026-10-07 W6.5: qa:fast PASS (typecheck0, lint0/0, unit2162 across173 files,
  journey/quarantine/profile parity). Focused convergence+fat-fingers19/19
  PASS, geometry55/55/55/65; query152ms, completed window23. Fresh audit7/7
  PASS, 60captures in `docs/ui-ux/v3-audit/w6.5/`; 16 affected captures read
  visually (phone populated/long/bulk/empty, heavy normal/query/filter/
  selection/history, completed boundary, dark, 360/768/1280, Project/Goal).
  Historical W1–W6 files unchanged. Browser large-type proxy PASS; largest
  native OS font still unverified, not claimed. Earlier local gates used
  Node22.23.2 with host npm11.4.2; final broad gate pins npm10.9.4 too.
- 2026-10-07 W6.5 qa:full first invocation: typecheck/lint PASS, npm test253
  files passed/1 skipped, 2559 tests passed/2 skipped, OpenSpec73/73 PASS.
  Build then aborted EUSAGE before Expo: outer npx -c exported
  npm_config_call, npm10 rejects inherited --call plus positional Expo args.
  ENVIRONMENT, no repo-tooling change; precise probe confirmed call=true and
  unsetting only that flag made nested `npx expo --version` PASS (55.0.36).
  Original log `.cursor/playwright-output/w65-full/command.log`; its report
  JSON is the earlier focused report, not full-suite evidence.
- 2026-10-07 W6.5 native smoke (2 expected flows) /targeted (11 flows):
  both EXIT2, BLOCKED/ENVIRONMENT, API35 target versus required36. Reports
  `simulation-output/native/native-android-smoke-2026-10-07T111110202Z.json`
  and `native-android-persistence-2026-10-07T111117918Z.json`. No emulator
  started/stopped, no APK provisioning/reset. iOS NOT RUN (owner-deferred).
- 2026-10-07 qa:full clean launcher: typecheck/lint, unit+integration2559
  passed/2 skipped, OpenSpec73/73, hermetic export PASS. Full web227 passed,
  12 failed,55 skipped,3 not run (24.7min); no retries. Evidence preserved in
  `.cursor/playwright-output/w65-full-rerun/` plus simulation run_muy1libm_
  zsv988hk and run_muy1lpbq_3khghp7p. All six new convergence tests and J8
  PASS (cold614/5000, maxswitch574/800, diary414/500, picker174/500ms).
  Full simulation-library phase not reached. Extra theme140/140 and
  versioned ExecPlans PASS. Broad failures are not quarantined or waived.
- 2026-10-07 full-gate baseline differential: unchanged adc4844, hermetic
  export, same Node/npm/8083,21 selected tests:6 PASS/12 FAIL/3 not run,
  identical failure signatures. `.cursor/playwright-output/w65-full-baseline/`
  holds report/log/screenshots/traces/simulation; first WASM-path ENVIRONMENT
  attempt separately in `w65-baseline-infra/`, not product evidence. QA drift
  repairs retain4.5:1/3:1 contrast,40px chips, completed/outbox SQL oracles.
- 2026-10-07 bounded QA-drift corrections:22 PASS/1 existing remote-boundary
  skip,0 flaky; all12 original reproductions pass, SQLite assertions intact.
  Paint contracts first2 FAIL (false-positive and false-negative), then2 PASS;
  no new exclusions/relaxed thresholds. Workout trial-click waits for stable
  actionability. Simulation activates semantic checkbox and awaits old state
  disappearing (removed400ms settle). Typecheck PASS; focused Prettier
  flagged2 formatting-only files, correction required before broad rerun.
  Evidence `.cursor/playwright-output/w65-a11y-helper-red/`, `w65-qa-drift/`.
- 2026-10-07 FINAL qa:full PASS (Node22.23.2/npm10.9.4; inherited call cleared;
  hermetic8083): typecheck0, lint0/0,253 test files passed/1 existing skip;
  2559 tests passed/2 existing skips; OpenSpec73/73; hermetic exports PASS.
  Browser243 PASS/56 existing skips/0 FAIL/0 flaky (chromium159, journeys76,
  pwa5, simulation3); six convergence tests PASS, measured55/55/55/65,
  checkbox48/More44, search129ms, completed window23. Full deterministic
  library23/23 PASS, including132-step soak (one run, not a new resource
  certification). `.cursor/playwright-output/w65-final-full/` preserves
  report/log/artifacts; scenario reports in simulation-output (soak
  run_muy4hsqv_rjxcah8i; smoke run_muy4ljgh_wzxzb1uk). All56 skips are existing
  gates (visual opt-in7, command-internal7, journeys42); no skipped regressions.
  Active LSP: no TS errors, existing deprecation hints;5 checks unconfirmed,
  generic auxiliary style warnings are not repo policy. tsc confirms types.
  Post-run hygiene8081/8082 free;8083 has no listener. Owned baseline removed
  after evidence capture; stash/foreign iOS/historical captures untouched.
- 2026-10-07 final extra impact gates PASS: qa:fast (typecheck0/lint0/0,
  unit2162 across173 files, journey/quarantine/profile guards); qa:integration
  397 PASS/2 existing disposable-cloud skips (80 files PASS/1 skipped);
  qa:journeys hermetic rebuild + P0 25/25 PASS,0 skips/0 flaky; themes140/140;
  versioned plans120/120. Evidence `w65-final-impact-rerun/` (P0 report/log).
  Prior quoted-&& launcher SyntaxError occurred before any gate; log retained
  in `w65-final-impact/launcher-error.log`, its copied report is explicitly
  previous-full-not-p0-report.json, not claimed as P0 evidence. Separate
  supported-runtime spawns resolved it. Final hygiene8081/8082/8083 free.
- 2026-10-07 publication first attempt ENVIRONMENT: normal Git pre-commit
  could not launch npx because npm's POSIX shim selects adjacent `node`, which
  the Windows downloaded node package marks as an intentional blank file.
  HEAD remains adc4844; no commit/push.79 files staged (19 text/60 fresh
  images), foreign iOS unstaged, stash preserved. Use exact Node22.exe/npm10
  through ignored launch shims; normal hooks remain mandatory.
- 2026-10-07 normal publication: f0e02910aae56fe2902fae4ec1574e3aa7c502f8
  pushed on dedicated fix/ui-v3-w6.5-convergence;79 campaign files,60 fresh
  images, no foreign/data/dependency paths staged. Node22.exe/npm10 launch
  shims in ignored QA output resolved Git-hook ENVIRONMENT; lint-staged ran
  normally. Plan validator's literal stub wording triggered a lifecycle-token
  check; corrected wording then PASS. After commit, only foreign iOS dir is
  untracked; original stash remains. Hosted exact-head review next.
- 2026-10-07 W6.5 exact product-head hosted: push37635421767 and PR37635650147
  at f0e02910aae56fe2902fae4ec1574e3aa7c502f8. Install, typecheck, Deno/
  Supabase, lint, themes, OpenSpec, parity, plans, unit/integration PASS
  (hosted253 files PASS/1 skipped,2558 tests PASS/3 existing skips). Only
  failed step: audit; exact two undocumented HIGHs braces GHSA-vfj7-8cjw-p6xm
  and node-forge GHSA-86w9-cpqp-85rv. Hosted E2E/nightly skipped, not green.
  PR58 OPEN; normal branch publication, no merge/bypass/security change.
  Source hashes verified against remote and CI metadata; evidence/logs in
  `w65-publication/`. Final documentation head gets its own CI recheck.
- W1: `VISUAL_AUDIT=1 npx playwright test e2e/visual-audit.spec.ts` — 5/5
  passes, 47 captures; manual inspection of 12+ key captures.
- W3 (commit `8888084`): typecheck 0 errors; lint 0 errors/0 warnings;
  `validate:themes` all 140 contrast checks pass; `test:unit` 2143/2143;
  quarantine-register-parity OK (entry 24 added); audit re-run 5/5.
- W4 (commit `282bfce`): typecheck 0; lint 0/0; themes 140/140 (incl. new
  health accent); unit 2143/2143; journey-label-parity OK (5-label rail);
  chromium: todos+workout+calories 24 passed, habits+pomodoro+overview+
  boundary+theming 44 passed; visual-audit 5/5 with new Health captures.
- W5 (full local gate): typecheck 0; lint 0/0; chromium overview+theming+
  boundary 27 passed; visual-audit 5/5 with re-inspected Today captures
  (390 populated/dark/first-run, 768, 1280, breakpoints); npm test 2546/2546;
  defect ledger +5 VERIFIED-FIXED (W5).
- W5 hosted (exact-head): run 37528351498 at b7c6885 — install, typecheck,
  Deno/Supabase, lint, themes, OpenSpec, parity, ExecPlans, unit+integration
  (252 files / 2545 tests passed, 3 skipped) all PASS; audit red only on the
  documented braces + node-forge. Scheduled run 37533751566 confirmed the
  same SHA. W5 tasks 5.1–5.3 verified against source and re-render evidence
  and checked in `tasks.md`.
- W6 (full local gate): typecheck 0; lint 0/0; themes 140/140; openspec 73/73;
  plans PASS; npm test 2554 passed / 2 skipped (0 failures); chromium todos+
  theming+boundary 34, command+chain-reactions 16 (+1 skip), fat-fingers 13
  (helper geometry-selector replaced with the semantic checkbox contract
  after one PRODUCT_BUG-class test breakage), three-months-in HEAVY 7/7 with
  D14 ceilings recorded (max switch 558/800ms at 200+ todos); visual-audit
  6/6 incl. new W6 states; completed-toggle geometry pixel-verified post-fix.
- W5 security lane: node scripts/audit-runtime-deps.mjs — undocumented
  count reduced 4 → 2 (braces + node-forge remain; gate exit 1 unchanged
  for those known blockers); installed shell-quote 1.12.0 and
  source-map-js 1.2.2 verified out of vulnerable ranges.
- W4.5 (full local gate, post-corrections): typecheck 0 errors; lint 0/0;
  validate:themes 140/140; openspec:validate 73/73; agent:plan:validate:all
  120 PASS / 0 FAIL (frontend-v3-calm-momentum PASS); npm test (unit +
  integration) 2546/2546 across 252 files; chromium suites todos/workout/
  calories/habits/pomodoro/overview/theming/boundary 77 passed; visual-audit
  5/5 with re-inspected captures (1280 rail groups, 390 Health without Focus,
  768 24px gutter); new touch-target contract suite 6/6.

## Changed Files / Areas

W6.5 delivered areas (Git history establishes changes; closure diff is docs only):

- `features/todos/TodoItem.tsx` — compact variable-height row; full targets.
- `features/todos/TodosScreen.tsx` — windowed query/selection/history;
  screen-owned selection, full-order drag guards; existing data APIs only.
- `features/quick-capture/QuickCaptureOverlay.tsx` — planning theme accent.
- `tests/todos.listContract.test.ts` — narrow architecture/target contracts.
- `e2e/helpers/todoHeavy.ts`, `e2e/todos-convergence.spec.ts` — volume, scroll,
  geometry, recycling and durable mutation regression.
- `e2e/journeys/three-months-in.spec.ts` — scroll to windowed history oracle.
- `e2e/journeys/fat-fingers.spec.ts` — await completion-settle removal before
  swiping history (same one-row/no-duplicate assertions).
- `e2e/visual-audit.spec.ts`, `docs/ui-ux/v3-audit/w6.5/` — fresh evidence
  routing and expanded HEAVY/capture coverage. Earlier images preserved.
- `e2e/helpers/a11yAudit.ts`, `e2e/a11y-audit-contract.spec.ts` — measure
  actual solid sibling paint and guard both contrast false positives/negatives.
- `e2e/planning-hub.spec.ts`, `e2e/weekly-review.spec.ts`,
  `e2e/workout-gym-v2.spec.ts`, `e2e/journeys/the-commute.spec.ts`,
  `simulation/runner/actions.ts` — baseline-reproduced harness drift repair;
  modal scope/stability and semantic todo controls, unchanged strict oracles.
- `public/sw.js`, `CLAUDE.md`, `.cursor/commands/pre-pr.md` — main-deploy
  cache-generation bump and its existing source-truth guidance pins only.

W11 delivered areas (merged to main as `ffb02f2`, PR #73, branch
`frontend-v3-w11-planning`, final head `e669385`):

- `features/planning-hub/PlanningSummaryRow.tsx` (new) — one
  objective/status/context/progress row grammar shared by Goals and
  Projects; full-card press target including percent and bar.
- `features/goals/GoalListView.tsx`, `features/projects/ProjectListView.tsx`
  — collapsed `Filters & sort` disclosure with persisted selection and an
  honest active-filter signal; manual project order preserved.
- `features/goals/GoalDetailView.tsx`, `features/projects/ProjectDetailView.tsx`
  — objective/progress first; description, target date, horizon, status,
  color and associations behind labeled disclosures; visible failure
  surfaces for delete; project lifecycle persists before refresh.
- `features/daily-plan/DailyPlanView.tsx` — intention/priorities/Save first;
  picker, planning options, reflection/energy and history behind
  disclosures; draft-owner guarantees untouched; rejected saves surface
  visibly and keep the draft.
- `features/planning-hub/PlanningHubScreen.tsx` — Today briefing behind one
  accessible disclosure.
- `e2e/planning-w11.spec.ts`, `e2e/planning-w11-audit.spec.ts`
  (opt-in `VISUAL_AUDIT=1`) — disclosure/fidelity/persistence journeys and
  the rendered-evidence instrument.
- `docs/ui-ux/v3-audit/w11/` — 82 inspected before/after captures with
  defect register and evidence-to-acceptance map.
- `docs/testing/known-gaps.md` — registered the opt-in planning visual
  gate (no behavioral assertion skipped in the standard lane).
- `openspec/changes/frontend-v3-w11-planning/` — spec slice, design lock
  (things/Todoist/Structured/Asana adopt/reject), tasks and this
  ExecPlan, marked COMPLETED.
- No data-layer, schema, migration, sync/outbox, dependency or
  security-policy change; no `data-testid` added to production code.

W7 delivered areas (merged as `f679a26`):

- `features/habits/habitCheckIn.domain.ts` — pure selected-date check-in
  view-model and semantic tone mapping; no DB, no React.
- `features/habits/HabitCheckInRow.tsx`, `HabitDayStrip.tsx`,
  `HabitsScreen.tsx`, `habitsScreen.derivations.ts` — flat check-in rows,
  secondary day strip, one filter sheet, date-scoped summary.
- `features/habits/HabitEditorChoice.tsx` — accessible 44pt editor choices;
  global edit mode removed.
- `features/habits/HabitDetailModal.tsx`,
  `HabitProgressInsightsModal.tsx` — detail consolidation; progress insights
  folded in, rhythm analytics behind one Trends entry.
- `features/habits/useHabitCheckboxKeyboard.ts` — web-only Space key.
- `core/ui/SegmentedControl.tsx` — explicit web selected state for detail
  tabs.
- `e2e/habits-w7.spec.ts`, `e2e/habits-w7-audit.spec.ts`,
  `e2e/helpers/habitsW7.ts`, `e2e/helpers/a11yAudit.ts`,
  `e2e/a11y-audit-contract.spec.ts` — real-DB regressions and the opt-in
  rendered-truth instrument; strengthened contrast oracles.
- `tests/habitCheckIn.domain.test.ts`,
  `tests/habitsScreenDerivations.test.ts` — check-in and derivation units.
- `e2e/`, `.maestro/flows/`, `simulation/` — semantic-selector and
  quantitative-fixture retargets; no persistence, schedule, XP,
  linked-action or timing oracle weakened.
- `docs/ui-ux/v3-audit/w7/`, `docs/ui-ux/14-v3-reference-ledger.md`,
  `docs/ui-ux/15-v3-defect-ledger.md` — 46 inspected images, W7 research and
  defect dispositions.
- `docs/testing/known-gaps.md` — W7 host-load addendum on gap 15.
- `openspec/changes/frontend-v3-w7-habits/` — W7 spec slice (all 27 tasks
  checked).
- `public/sw.js` — v9 deploy-generation literal only; cache strategy
  unchanged.
- `docs/ui-ux/15-v3-defect-ledger.md` — bounded convergence verification note.
- `openspec/changes/frontend-v3-calm-momentum/tasks.md`,
  `openspec/changes/frontend-v3-calm-momentum/execplan.md` — living scope,
  decisions, truthful validation and next milestone.
- Preserved foreign state: `.tmp-ios36423379932/` and existing stash. They
  are not campaign changes and must not be staged, cleaned or quarantined.

## Recovery / Resume Instructions

- Fresh session: run `npm run agent:resume -- --plan
openspec/changes/frontend-v3-calm-momentum/execplan.md`, then
  `git status --short` / `git log --oneline -5` and reconcile against the
  checkpoint above before editing anything. W5 tasks (5.1–5.3) are verified
  and checked in `tasks.md`; do not reopen them without contrary evidence.
- If hosted CI fails at "Validate versioned ExecPlans": run
  `npm run agent:plan:validate:all` locally, fix the named plan sections
  against `scripts/agent-execplan.mjs` aliases, re-run until PASS.
- Local render/audit lanes: `npm run build:e2e` then
  `E2E_PORT=8083 VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w6.5
npx playwright test e2e/visual-audit.spec.ts`. Inspect port owners first;
  never kill historical PID42924 or any unrelated process.
- Final documentation-only publication: use normal hooks, then inspect
  `gh run list --commit $(git rev-parse HEAD) --workflow CI` and exact run
  metadata/logs; do not substitute product-head evidence for a newer HEAD.
  Exact-main CI capture for the merge commit and the final documentation
  head lives at `w65-main/final-ci*.json`/`final-ci*-failed.log`; compare
  each `headSha` with Git before relying on it.
- Resume point: W12 Weekly Review / Progress / Activity. Read `openspec/changes/frontend-v3-calm-momentum/execplan.md` (this file) for the wave status; the parent tracks wave closure while each wave's living implementation state is its own slice plan. W5 tasks (5.1–5.3), W7 tasks (7.1–7.3), W9 tasks (9.1–9.3) and W11 tasks (11.1–11.2) are verified and checked in `tasks.md`; do not reopen them without contrary evidence.
- Wave rendered-evidence lanes: each wave owns its opt-in audit spec
  (`e2e/workout-w95-audit.spec.ts` writes `docs/ui-ux/v3-audit/w9.5/`);
  earlier waves' captures are preserved untouched.

## Outcomes & Retrospective

- W6.5 COMPLETE and merged in PR58 at final main `d29c67b`; W7 is active.
  Compact expanding rows and windowed HEAVY states preserve order/persistence;
  baseline12 stale harness failures were repaired, not quarantined/relaxed.
  Broad local checks and23 deterministic scenarios PASS; hosted quality passes
  through unit/integration then audit-only red. Native coverage remains
  blocked/deferred; no campaign or cross-platform certification claimed.
- Campaign remains mid-flight (W7–W17). Outcome so far: the
  rendered product no longer shows slab headers, FAB-over-content
  collisions, the desktop wash arc, cramped six-tab navigation, the Today
  hierarchy problems, or the To Do dashboard-in-front-of-tasks pattern —
  verification is screenshot-backed at every wave instead of assertion-only.
- What worked: rendered-truth-first auditing (W1) before any redesign; a
  single-owner foundation wave; committing per wave with green gates.
- What to keep doing: inspect screenshots visually at every wave; record
  defects with evidence; never loosen a gate to pass.
