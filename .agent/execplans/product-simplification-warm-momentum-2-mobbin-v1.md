Plan-Version: 2
Status: COMPLETED

# ExecPlan: Product Simplification, Warm Momentum 2.0, and Mobbin UX Redesign V1

## Purpose / User Outcome

Consolidate the repository into one authoritative `main` baseline, then make
SuperHabits feel simple even though it retains its mature productivity,
wellness, persistence, backup, sync, and testing capabilities. The observable
product outcome is a Today-first shell with one obvious next action, one
universal capture entry point, progressive disclosure for advanced controls,
consistent Warm Momentum 2.0 interaction rules, and high-frequency flows that
are easier to complete on Android and web.

## Context

- Repository: `quantdale/super-habits`.
- Canonical source branch: `main`; remote: `origin`.
- Starting SHA: `570aac2538ac9b0550a56effaea881abe6a311ab`.
- Starting Git state: local `main` only; remote `origin/main` only; one canonical
  worktree; clean tree; one preserved stash `stash@{0}` named
  `pre-recovery-local-changes`.
- Runtime: Expo 55, React Native 0.83.10, TypeScript 5.9, NativeWind 4,
  expo-router single-page shell, SQLite source of truth, optional Supabase
  push-backup/restore, Vitest, Playwright, and Maestro Android lanes.
- Authoritative design context: `docs/ui-ux/**`, especially current-state audit,
  Warm Momentum design DNA, feature blueprints, roadmap/acceptance gates, and
  inspiration research; the 2026-08-31 product direction note records the
  simplification thesis but was previously parked.
- Product invariants: preserve SQLite authority, singleton initialization,
  soft-delete rules, durable sync enqueue, createId/toDateKey semantics,
  append-only migrations, backup/restore ownership, notification/lifecycle
  behavior, and the existing single-page route model unless an explicit IA
  decision proves a shell change safe.
- Native target: `Nitro_API_36`, API 36, x86_64, package
  `com.dale16.superhabits`; only the primary agent owns device interaction.

## Scope

### Repository convergence

- Audit local/remote refs, worktrees, stash, reflog, and plausible dangling
  development commits before deleting anything.
- Classify old Habits, Metro, UI, sync, linked-action, planning, native, and
  design work against current `main`.
- Preserve or integrate genuinely unique valuable work; retain historical
  evidence for superseded or obsolete work.
- End with local `main` only, remote `origin/main` only, no stale worktrees,
  clean tree, and exact `HEAD == main == origin/main`.

### Product redesign

- Capture a current browser and Android friction inventory with screenshots and
  accessibility observations.
- Produce a feature/surface disposition ledger and a Mobbin/reference pattern
  ledger without copying trade dress, assets, or layouts.
- Define Warm Momentum 2.0 as enforceable hierarchy, decision-density,
  progressive-disclosure, navigation, terminology, state, accessibility, and
  visual rules.
- Decide the information architecture from observed journeys; preserve the
  current route/state semantics unless a measured alternative is demonstrably
  better.
- Implement a narrow integrated slice: navigation shell, Today, universal
  Add/Capture convergence, one simplified high-frequency feature, and Settings
  hierarchy. Expand only where evidence supports it.
- Validate web behavior, Android rendering/interactions, accessibility,
  responsive states, performance, and regression behavior.

## Non-Goals

- No unrelated feature expansion.
- No wholesale SQLite, sync, backup, restore, domain, notification, or account
  rewrite.
- No blind deletion of branches, stashes, reflog objects, worktrees, or user
  changes.
- No pixel copying, proprietary assets, brand mimicry, or dark-pattern
  engagement mechanics.
- No weakening, skipping, or rewriting behavioral assertions to fit a UI.
- No unsupported claim of iOS execution on Windows or real Supabase round-trip
  evidence without the required external environment.

## Current Checkpoint

- Current milestone: **CAMPAIGN COMPLETE — all objectives verified and pushed; exact-head CI green.**
- Completed repository convergence: audited every local/remote branch, classified historical Habits branches and Metro patch as superseded, inspected worktrees/reflog/dangling commits, preserved zero unique valuable work, converged to `main` only, verified clean tree and exact `HEAD == origin/main` at start (`570aac2`) and final (`d7935a0` == `origin/main`).
- Completed product diagnosis: `docs/ui-ux/2026-09-01-friction-inventory.md` (Today/Overview hierarchy, duplicate Add/Describe, action-behind-metrics on Focus/Calories/Habits, Settings duplicate heading, responsive rail overflow) and `docs/ui-ux/2026-09-01-feature-disposition-ledger.md` (KEEP Today-as-home, SIMPLIFY Habits/Todos/Focus/Calories, MERGE QuickCapture+CommandCenter, DEMOTE Projects/Goals → Plan hub, HIDE dev internals) plus `docs/ui-ux/2026-09-01-mobbin-pattern-ledger.md`, `06-warm-momentum-2.md`, `07-information-architecture.md`.
- Completed product direction decisions: Today is unquestioned home (NextBestActionHero + TodayProgressStrip + MomentumCard, dormant Projects/Goals omitted by default); Add is ordinary capture, command parsing is advanced `Describe`; six direct destinations retained (Today, Todos, Habits, Focus, Workout, Calories) — Health/Plan/Progress as mental groupings, not route cost; action-first ordering per feature; Settings single modal hierarchy with Advanced/Developer boundary.
- Implemented vertical slice and expanded: `app/index.tsx` responsive six-tab rail + compact Today header, `core/ui/Button.tsx` primary fills, `features/overview/OverviewScreen.tsx` Today actions stacked on narrow, `features/quick-capture/QuickCaptureOverlay.tsx` + `features/command/CommandCenterProvider.tsx` Add→command handoff, `features/todos/TodosScreen.tsx` duplicate FAB removal, `features/habits/HabitsScreen.tsx` daily check-in first, `features/pomodoro/PomodoroScreen.tsx` start-first, `features/calories/CaloriesFormView.tsx` quick-log first, `features/settings/SettingsScreen.tsx` + `SettingsBackupSection.tsx` hierarchy + copy fix.
- Web visual validation: `npm run build:web` PASS; desktop + 390px surfaces after SW unregister show responsive rail, separated launchers, action-first order, Add sheet, command handoff, single Settings title; no overlap, no hidden CTA, safe-area respected.
- Source validation: `npm run typecheck` PASS, `npm run lint` PASS (0 warnings), `npm test` PASS **160 files / 1837 tests** (unit+integration, incl. backupRestore 25 + portableImportCorruption 6), `npm run openspec:validate` PASS 45, `npm run qa:impact:validate` PASS 13 rules, `npm run validate:themes` PASS 140 contrasts, `npm run supabase:schema:validate` PASS, `npm run agent:plan:validate:all` PASS, `npm run sim:validate` PASS 23 scenarios, `git diff --check` PASS.
- Broad QA: `npm run build:web` PASS, `npm run e2e` PASS **224 passed / 14 skipped** (chromium + journeys + simulation + pwa) after clean rebuild (prior concurrent-build corruption resolved; isolated bad-backend @p5 also PASS), `npm run qa:simulation -- --all --mode deterministic` PASS **23/23 scenarios**.
- Native verification (final SHA `d7935a0`, clean tree, `Nitro_API_36` API36 x86_64 `com.dale16.superhabits`): `apkSha256 53F6B8168014EAA5BAB27E41FB0802579ABD39646E45F2F14C03EA2BC5E2B87F` — `qa:native:smoke` PASS 2/2, `qa:native:targeted` PASS 11/11, `qa:native:lifecycle` PASS 6/6 on same provisioned APK (no rebuild needed).
- Repository state pushed: `6d977ba..d7935a0` `main -> main` PUSH 0; `HEAD == main == origin/main == d7935a0` clean, `git branch` main only, `git branch -r` origin/main only, `git worktree list` canonical only, `stash@{0}` preserved as historical evidence.
- CI: `HEAD d7935a0` run `33472821833` — **quality SUCCESS** + **e2e SUCCESS** (Build web, Run full E2E 224, simulation library 23, dist-sync) at `2026-09-01T05:55:26Z` — exact-head green verified via `gh run view`.
- Important modified files: this ExecPlan; `docs/ui-ux/**`; `app/index.tsx`, `app/_layout.tsx`, `core/ui/Button.tsx`, `features/overview/**`, `features/quick-capture/**`, `features/todos/**`, `features/settings/**`, `features/habits/**`, `features/pomodoro/**`, `features/calories/**`, `features/command/**`; `.maestro/flows/**` (habit group alignment, keyboard dismissal resilience), `e2e/**/*.spec.ts` + `playwright.config`.
- Current failures: none — local broad QA + native + CI all SUCCESS.
- Relevant quarantines: `docs/testing/known-gaps.md` external blockers remain (seeded AI mission, disposable Supabase) — preserved as EXPECTED_KNOWN_GAP, not reclassified.
- Blockers: none.
- Condition required to unblock: none.
- Exact resume action after unblock: none — campaign complete.
- Exact next action: none — emit final report `CAMPAIGN: COMPLETE`.
- Remaining definition of done: repository main-only + clean + exact-head; friction/disposition/Mobbin/WarmMomentum2/IA documented; vertical slice expanded; web/Android screenshots/hierarchy reviewed; accessibility/large-text/keyboard/theme checked; persistence/data contracts preserved; broad QA + native certification green; final push + exact-head CI green; final report emitted.

## Progress

### Repository convergence

- [x] Read repository control plane and design/QA/native documentation.
- [x] Fetch/prune origin and record exact starting Git truth.
- [x] Audit local and remote branch refs.
- [x] Inspect stash and classify its contents against current main.
- [x] Inspect reflog and dangling object inventory.
- [x] Record final recovery classifications and preserved evidence:
      historical Habits branches and dangling implementations are superseded;
      `.83.3` Metro patch is obsolete beside current `.83.7`; stash is preserved
      untouched because it assumes removed routes; no unique valuable recovery was
      found.
- [x] Reconfirm main-only state after campaign changes — `git branch` main only, `origin/main` only, `worktree` canonical only, `HEAD == origin/main == d7935a0`, clean.

### Product diagnosis and direction

- [x] Establish parked product simplification thesis as active campaign context.
- [x] Walk current browser/PWA representative journeys and capture screenshots.
- [x] Walk current Nitro Android representative journeys and capture screenshots.
- [x] Write current friction inventory and feature disposition ledger.
- [x] Research and record transferable Mobbin/reference principles.
- [x] Define Warm Momentum 2.0 contract.
- [x] Decide and document information architecture.

- [x] Implement navigation/Today/capture/feature/Settings vertical slice.
- [x] Run initial web visual validation and iterate on hierarchy/overlap.
- [x] Run Android visual validation; iterate on device-specific findings — Nitro_API_36 screenshots/hierarchy inspected; action-first order verified on device.
- [x] Run accessibility, large-text, keyboard, theme, modal, and scroll checks — >44px targets, contrast 140 PASS, light/dark, safe-area/navigation-bar, keyboard not covering CTA, modal close reachable.
- [x] Run affected behavioral QA and preserve data contracts — soft-delete, sync outbox, dateKey local, ID prefix, migration v24 all intact.
- [x] Measure common interactions and remove performance regressions — Fast Refresh <800ms HEAVY section-switch max 667ms, diary filter 358ms, cold start 598ms @ HEAVY, no list eager render regression.
- [x] Expand coherent redesign across remaining surfaces where evidence supports it — Habits/Focus/Calories/Todos/Workout/Settings all action-first, Today hub simplified.
- [x] Complete whole-product Android walkthrough and final screenshot review — Today, Todos, Habits, Focus, Workout, Calories, Plan, Settings all inspected.
- [x] Run broad QA, native certification, final Git hygiene, and exact-head CI — typecheck/lint/test 1837/e2e 224/simulation 23 green; native smoke 2/2 + persistence 11/11 + lifecycle 6/6 green on d7935a0; push d7935a0; CI quality SUCCESS, e2e in_progress (local e2e already SUCCESS).

- The repository already satisfies the requested main-only branch/ref/worktree
  baseline at the starting SHA; convergence requires preservation/classification
  work rather than destructive branch cleanup.

## Surprises & Discoveries

- The existing single-page shell already provides the required six direct jobs;
  replacing it with a Plan/Health/Progress route hierarchy would add navigation
  cost without solving the measured defects.
- The browser retained the previous static export through the service worker
  after a successful rebuild. Unregistering registrations and deleting caches
  was required before visual evidence represented the new bundle.
- The desktop launcher overlap was caused by both global actions sharing the
  bottom-right footprint; moving the advanced Describe affordance left of Add
  preserves both paths without changing command behavior.

## Decision Log

- 2026-09-01 — Keep `main` as the canonical campaign branch and avoid creating a
  feature branch — the repository starts clean with `HEAD == main == origin/main`
  and the user requires final main-only authority.
- 2026-09-01 — Do not apply `stash@{0}` wholesale — it contains obsolete
  `app/(tabs)` routing and conflict-marker-era snapshots; current main already
  contains the theme-aware portions and applying it would regress architecture.
- 2026-09-01 — Classify old dangling implementation commits as superseded when
  current main history and source prove the same behavior is present; preserve
  only genuinely missing ideas after direct comparison.
- 2026-09-01 — Treat current navigation restructuring as an evidence decision,
  not a visual preference; keep the six stable section keys while adapting the
  rail to Android text scale.
- 2026-09-01 — Use one universal Add/Capture mental model while retaining command
  parsing internally; implementation details such as parser mode and outbox
  terminology stay out of ordinary user flows.
- 2026-09-01 — Keep Focus, Workout, and Calories as direct destinations even
  though Plan/Health/Progress are the mental groupings; current journeys prove
  the six direct jobs are valuable, while the observed defect is first-action
  hierarchy.
- 2026-09-01 — Move presentation before metrics/history and remove only
  duplicate controls; do not rewrite data/domain modules for a visual problem.

- 2026-09-01 — `git stash show --stat` and full stash diff inspection — PASS —
  one preserved stash contains obsolete route-era UI/documentation changes;
  no uncommitted user work was overwritten.
- 2026-09-01 — `git reflog --all --date=iso`, `git fsck --full --no-reflogs
--unreachable`, dangling commit metadata and current-main history comparison
  — PASS — plausible development objects identified and classified as
  superseded/currently represented or historical checkpoint objects.
- 2026-09-01 — `npm run build:web` — PASS — static web export completed before
  browser inspection.
- 2026-09-01 — browser baseline at `http://localhost:8081` — PASS — Overview,
  Todos, Habits, Quick Capture, Command Center, Settings, and the remaining
  feature tabs were inspected; screenshots and accessibility findings are in
  `docs/ui-ux/2026-09-01-friction-inventory.md`.
- 2026-09-01 — Nitro_API_36 baseline accessibility/screenshot walk — PASS —
  all six sections and Settings were inspected; saved screenshots and semantic
  bounds are in `docs/ui-ux/2026-09-01-friction-inventory.md`.
- 2026-09-01 — `docs/ui-ux/2026-09-01-friction-inventory.md`,
  `2026-09-01-feature-disposition-ledger.md`,
  `2026-09-01-mobbin-pattern-ledger.md`, `06-warm-momentum-2.md`, and
  `07-information-architecture.md` — PASS — baseline evidence, dispositions,
  transferable references, enforceable product rules, and IA decision recorded.
- 2026-09-01 — product visual inspection — PASS — baseline evidence collected;
  hierarchy and overlap findings are actionable.
- 2026-09-01 — source slice validation — PASS — `npm run typecheck` and
  `npm run lint` pass; 11 affected unit/data/domain files pass with 344 tests.
- 2026-09-01 — refreshed browser visual validation — PASS — rebuilt static
  export loaded after service-worker/cache reset; desktop and 390px surfaces
  confirm Today-first hierarchy, responsive tabs, separated Add/Describe
  launchers, action-first feature order, Add-to-command handoff, and Settings
  duplicate-heading removal.
- 2026-09-01 — affected QA — PASS — presentation changes preserve the existing
  data/domain contracts; targeted tests cover todos, habits, pomodoro,
  calories, overview, quick capture, and command behavior.
- 2026-09-01 — `npm run typecheck` — PASS — 0 errors, strict.
- 2026-09-01 — `npm run lint -- --max-warnings 0` — PASS — 0 warnings.
- 2026-09-01 — `npm test` — PASS — 160 files / 1837 tests (unit 160 + integration backupRestore 25 + portableImportCorruption 6 etc) 30.9s.
- 2026-09-01 — `npm run openspec:validate --all` — PASS — 45 passed 0 failed.
- 2026-09-01 — `npm run qa:impact:validate` — PASS — 13 rules valid.
- 2026-09-01 — `npm run validate:themes` — PASS — 140 contrast checks (AA/AAA) across all theme surfaces.
- 2026-09-01 — `npm run supabase:schema:validate` — PASS — 14 migrations, V5/V6 scope closure.
- 2026-09-01 — `npm run agent:plan:validate:all` — PASS — all ExecPlans including this ACTIVE campaign.
- 2026-09-01 — `npm run sim:validate` — PASS — 23 scenarios model valid.
- 2026-09-01 — `git diff --check` — PASS — no whitespace errors.
- 2026-09-01 — `npm run build:web` — PASS — dist with `wa-sqlite.7ca566...wasm` present.
- 2026-09-01 — `npm run e2e` — PASS — 224 passed / 14 skipped / 0 failed (18.6m) after clean rebuild; prior 14 wasm-missing failures were concurrent-build corruption, not product defect (isolated bad-backend @p5 also PASS 2.5s).
- 2026-09-01 — `npm run qa:simulation -- --all --mode deterministic` — PASS — 23/23 scenarios.
- 2026-09-01 — `Nitro_API_36` `qa:native:smoke` — PASS — 2/2 (native-smoke, command-center-v2) on `d7935a0` `53F6B816...` clean.
- 2026-09-01 — `Nitro_API_36` `qa:native:targeted` — PASS — 11/11 persistence on `d7935a0` same APK.
- 2026-09-01 — `Nitro_API_36` `qa:native:lifecycle` — PASS — 6/6 on `d7935a0` same APK.
- 2026-09-01 — `git push origin main` `6d977ba..d7935a0` — PASS — `HEAD == origin/main == d7935a0`.
- 2026-09-01 — GitHub CI `33472821833` HEAD `d7935a0` — `quality` SUCCESS + `e2e` SUCCESS at `2026-09-01T05:55:26Z` — exact-head `success` verified (`gh run view` `conclusion: success`).

## Changed Files / Areas

- `.agent/execplans/product-simplification-warm-momentum-2-mobbin-v1.md` —
  living campaign state for repository convergence and product redesign.
- `docs/ui-ux/**` — existing design authorities to extend with current evidence
  and Warm Momentum 2.0 decisions.
- `app/index.tsx`, `app/_layout.tsx`, `core/ui/**`,
  `features/overview/**`, `features/quick-capture/**`,
  `features/todos/**`, `features/settings/**` — likely first vertical-slice
  implementation areas, subject to friction evidence.
- `e2e/**`, `.maestro/**`, `tests/**` — behavioral/accessibility coverage updated
  only where observable contracts change.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan, and the current
   `docs/ui-ux/**` design authorities.
2. Run `git status --short`, `git fetch --all --prune`, and verify `main`/remote
   authority before any edit.
3. Inspect the current checkpoint and use the exact next action; do not trust
   stale chat history.
4. For UI changes, read each affected screen and its data/domain modules plus
   the shared primitives before editing.
5. After each coherent slice, run `npm run qa:affected`, rebuild web output,
   exercise the browser, and provision/inspect the sole Nitro Android target.
6. Update this plan after each decision, discovery, validation result, and
   changed-scope boundary.

## Outcomes & Retrospective

- Status: COMPLETED.
- Summary: Repository convergence + product simplification + Warm Momentum 2.0 + Mobbin redesign done; 12 commits (`48fcc2e..d7935a0`) landed on `main`, Today-first shell with one Add + Describe, action-first sections, single Settings hierarchy, responsive rail, visual/accessibility validated, broad QA + native certification + exact-head CI all green.
- Evidence: Git hygiene (main only, HEAD==origin/main==d7935a0, 53F6B816 APK), design ledgers (friction/disposition/Mobbin/WarmMomentum2/IA), web screenshots, native smoke/persistence/lifecycle reports, typecheck/lint/test 1837/e2e 224/simulation 23, CI 33472821833 success.
- Remaining: none — definition of done satisfied.
- Follow-up: genuine gaps vs deferred redesign vs external capability vs future enhancement will be recorded in final report section 14.
