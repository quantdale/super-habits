Plan-Version: 2
Status: ACTIVE

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

- Current milestone: repository archaeology, product direction, and the first
  integrated presentation slice are complete; native verification is next.
- Completed: read required repository/control-plane/design/QA/native docs;
  fetched/pruned origin; verified clean exact baseline; confirmed only local
  `main`, only remote `origin/main`, one canonical worktree, and no remote
  divergence; inspected stash contents, reflog, and fsck output; identified
  current main equivalents for historical development work; walked the live
  web export and Nitro Android through all six sections plus capture,
  command, and Settings.
- Completed product direction: Today is the home; Add is the ordinary capture
  path and command parsing is advanced; the six direct destinations remain;
  Focus/Calories actions lead their metrics; Habits daily check-in leads
  history; Settings has one modal hierarchy; Plan remains the planning hub.
- Implemented: responsive six-tab rail; compact Today header; default Today
  cards omit dormant Projects/Goals cards; separated Add and Describe launchers;
  added Add-sheet handoff to advanced command mode; removed the duplicate
  Todos floating add action while retaining Details; reordered Habits, Focus,
  and Calories action/summary blocks; removed duplicate Settings heading.
- Web visual validation: refreshed the static export after unregistering the
  stale service worker; desktop and 390px browser surfaces show the intended
  title, responsive rail, separated launchers, action-first feature order,
  Add sheet, command handoff, and single Settings title.
- Source validation: `npm run typecheck`, `npm run lint`, and 344 affected
  unit/data/domain tests pass.
- Last successful validation: `npm run typecheck`, `npm run lint`, affected
  Vitest, and refreshed browser visual inspection all pass; native verification
  is pending on the committed slice.
- In progress: commit the coherent slice, provision the canonical Android
  emulator from that commit, run smoke/persistence/lifecycle lanes, and
  inspect updated screenshots and accessibility bounds before expanding.
- Important modified files: this ExecPlan; the four dated
  `docs/ui-ux/2026-09-01-*` evidence/direction ledgers; and the responsive,
  Today, capture, feature-order, and Settings source files listed below.
- Current failures: none observed in source gates or refreshed browser
  inspection; native verification has not yet run against the new commit.
- Relevant quarantines: Existing repository known gaps remain governed by
  `docs/testing/known-gaps.md`; no new campaign quarantine exists.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: run the native implementation verification loop after
  committing the current slice, then update the validation ledger with native
  evidence and any Android-specific fixes.
- Remaining definition of done: recovery classifications recorded; friction
  inventory, disposition ledger, reference ledger, Warm Momentum 2.0, and IA
  decision documented; integrated vertical slice implemented and expanded
  where justified; web and Android screenshots/hierarchy reviewed; relevant
  QA and final native evidence recorded; final main-only exact-head repository
  state pushed and verified.

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
- [ ] Reconfirm main-only state after campaign changes.

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
- [ ] Run Android visual validation; iterate on device-specific findings.
- [ ] Run accessibility, large-text, keyboard, theme, modal, and scroll checks.
- [x] Run affected behavioral QA and preserve data contracts.
- [ ] Measure common interactions and remove performance regressions.
- [ ] Expand coherent redesign across remaining surfaces where evidence supports
      it.
- [ ] Complete whole-product Android walkthrough and final screenshot review.
- [ ] Run broad QA, native certification, final Git hygiene, and exact-head CI.

- The repository already satisfies the requested main-only branch/ref/worktree
  baseline at the starting SHA; convergence requires preservation/classification
  work rather than destructive branch cleanup.
- `stash@{0}` contains an old conflicted-era UI/theme/documentation patch. Its
  useful theme-token ideas are already represented in current `core/theme` and
  shared UI, while its `app/(tabs)` route assumptions contradict the current
  single-page shell. Keep the stash as historical evidence; do not apply it
  wholesale.
- Dangling fsck output is dominated by stash/index checkpoint objects and
  rebased history. The plausible April development commits have direct current
  main equivalents for sync failure retention, date helpers, linked actions,
  UI rhythm, restore, and design DNA. They are superseded rather than missing
  implementation. The August index/WIP objects correspond to already landed
  current-main commits.
- The old Habits branch families (`habits-redesign`, `habits-redesign-v2`) are
  superseded by current main's Habits screen and later hardening; no cherry-pick
  is justified.
- The historical `metro-file-map+0.83.3.patch` is obsolete: current dependency
  alignment uses `metro-file-map+0.83.7.patch`, which carries the needed
  EACCES handling against the installed Metro source.
- Existing Warm Momentum documentation is strong at visual/component rules but
  needs product-level enforcement for navigation prominence, terminology,
  decision density, progressive disclosure, and advanced-mode boundaries.
- The current product has already shipped a substantial UI wave and Momentum
  Garden; this campaign must simplify the resulting surface rather than
  re-run that historical implementation wave.
- Baseline evidence confirms the main problem is hierarchy and responsive
  presentation, not missing domain persistence: Android puts Focus Start below
  stats, Form logging below nutrition summaries, and duplicate global actions
  over content.

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

## Validation Ledger

- 2026-09-01 — `git status --short`, `git remote -v`, `git fetch --all --prune`,
  branch/ref/worktree/stash/log/remote/hash inspection — PASS — local and remote
  refs both contain only `main`; exact SHA is
  `570aac2538ac9b0550a56effaea881abe6a311ab`; working tree was clean.
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

- Status: Active.
- Summary: Campaign in progress; repository baseline is clean and authoritative,
  while product diagnosis and implementation remain.
- Evidence: Git baseline and recovery-audit evidence are recorded above; visual,
  behavioral, native, and CI evidence will be added as completed.
- Remaining: Complete both repository convergence and the evidence-backed
  redesign definition of done; do not mark complete on compilation alone.
- Follow-up: Record genuine product gaps separately from deferred redesign,
  external capability limits, and future enhancements at closure.
