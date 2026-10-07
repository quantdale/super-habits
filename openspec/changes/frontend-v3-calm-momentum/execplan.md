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
  Workout/Calories) with the capture slot replacing the floating FAB. A
  non-campaign Expo dev server (the owner's `brain-training` project) occupies
  host port 8081, so local render/audit lanes use `E2E_PORT=8083`.

## Scope

- `core/theme/*` token values + derivation; `core/ui/*` shared primitives;
  `app/index.tsx` shell/navigation; one screen wave per feature area
  (W5–W13); persistent visual-regression suite (W15); Android qualification
  (W16); final regression (W17).
- W6 (current): To Do + Quick Capture reconstruction — flat list anatomy,
  one authoritative summary, flat search/filter, single quick-add path,
  focused quick-capture sheet with semantic type chips and one primary save,
  plus long-title/bulk/completed/empty/HEAVY validation.

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

- Current milestone: W7 — Habits.
- Completed: W6 — To Do + Quick Capture (flat 48–56pt list anatomy with
  priority-ordered metadata line and row-disclosure editor; single
  authoritative summary [SYS-05]; flat search + filter sheet [SUR-03]; one
  quick-add path with composer behind "Add task with details" [SUR-04]; Quick
  Capture input-first sheet with semantic section-hue type chips [SUR-10], one
  primary save + X close [SYS-13], neutral priority chips; bulk mode,
  completed group, empty/long-title/HEAVY states rendered and inspected;
  defects SYS-05/SYS-13/SUR-03/SUR-04/SUR-10 VERIFIED-FIXED with re-render
  evidence). W5 — Today reconstruction; W0–W4.5 complete as recorded below.
- In progress: 7.1 — daily check-in list reconstruction (one row anatomy:
  check ring, name, streak; kill the 5-treatment state pile [SUR-05]).
- Important modified files: `features/todos/*` (TodosScreen, TodoItem,
  TodoQuickCapture, TodoListToolbar, TodoBulkBar, todos.domain,
  badges retired), `features/quick-capture/QuickCaptureOverlay.tsx`,
  `tests/todos.domain.test.ts`, `e2e/` contract updates (todos, fat-fingers,
  chain-reaction, three-months-in, boundary, navigation helper, journey
  openers), `e2e/visual-audit.spec.ts` (W6 state captures),
  `docs/ui-ux/14`, `docs/ui-ux/15`, `openspec/.../tasks.md`, this plan.
- Last successful validation: W6 full local gate on the W6 tip — typecheck 0;
  lint 0/0; validate:themes 140/140; openspec:validate 73/73;
  agent:plan:validate:all PASS; npm test (unit + integration) 2554 passed /
  2 skipped across 252 files (0 failures); Chromium: todos+theming+boundary
  34 passed, command+chain-reaction×2 16 passed (+1 skipped), fat-fingers 13
  passed, three-months-in HEAVY journey 7 passed with D14 ceilings measured
  (cold start 641ms/5000ms, max switch 558ms/800ms at 200+ todos);
  visual-audit 6/6 with W6 states inspected (long-title, bulk, completed,
  HEAVY 390/1280, quick capture, dark, empty). Last exact-head hosted CI:
  run 37528351498 at b7c6885 (scheduled confirmation 37533751566) — W6 tip
  runs pending at publication.
- Important modified files: `openspec/changes/frontend-v3-calm-momentum/execplan.md`,
  `core/ui/Button.tsx`, `core/ui/Screen.tsx`, `core/theme/designTokens.ts`,
  `features/health/HealthScreen.tsx`, `app/index.tsx`,
  `openspec/changes/frontend-v3-calm-momentum/tasks.md`,
  `docs/ui-ux/15-v3-defect-ledger.md`, plus W4.5 regression tests.
- Last successful validation: exact-head hosted CI run 37528351498 at
  b7c6885 (scheduled confirmation run 37533751566 on the same SHA) — npm ci,
  typecheck, Deno/Supabase checks, lint, theme validation, OpenSpec,
  journey/quarantine parity, versioned ExecPlans, and unit + integration
  (252 files / 2545 tests passed, 1 file skipped, 3 tests skipped) all pass;
  the dependency audit is the only hosted failure.
- Current failures: hosted dependency audit reports exactly the two known,
  documented high advisories — braces GHSA-vfj7-8cjw-p6xm (HIGH) and
  node-forge GHSA-86w9-cpqp-85rv (HIGH); fix paths remain semver-major
  framework upgrades (tailwindcss 4.x / expo 44) — NO MATERIAL UPSTREAM
  CHANGE. shell-quote GHSA-pqg4-j6r4-53mv and source-map-js GHSA-68fv-2mgg-
  jv7q remain RESOLVED (W5 security lane, semver-compatible overrides;
  dev-tooling/build-time-only chains, no shipped bundle presence). The
  pre-existing brace-expansion advisories are documented policy entries and
  are not part of the undocumented count.
- Relevant quarantines: only the standing `VISUAL_AUDIT=1` opt-in lane for
  `e2e/visual-audit.spec.ts`, registered in `docs/testing/known-gaps.md`
  entry 24; no failure quarantines registered for this campaign.
- Blockers: none blocking W4.5 work; the braces/node-forge dependency-audit
  reds remain known upstream failures after the quality gate (accepted,
  campaign §36/§12 of this plan's proposal).
- Exact next action: W7.1 — rebuild daily habit rows around one clear
  completion anatomy (check ring + name + streak per row; kill the 5-treatment
  state pile [SUR-05]) in `features/habits/`, keeping habit completion
  semantics and `habit_completions` contracts untouched.
- Remaining definition of done: every W7 condition holds — daily check-in
  list is one row anatomy (SUR-05); quiet group headers with collapsed filter
  stack (SYS-16); neutral progress fixed (SYS-12); analytics moved to a
  per-habit progress sheet; rendered captures inspected; local validation
  green; exact-head hosted frontend gates green before the known audit reds.

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
- [ ] W7 — Habits
- [ ] W8 — Focus
- [ ] W9 — Workout
- [ ] W10 — Calories / Health validation gate
- [ ] W11 — Planning / Goals / Projects / Daily Plan
- [ ] W12 — Weekly Review / Progress / Activity
- [ ] W13 — Settings / secondary surfaces
- [ ] W14 — full visual integrity sweep
- [ ] W15 — persistent visual regression suite
- [ ] W16 — Android current-source qualification
- [ ] W17 — final regression + adversarial review

## Surprises & Discoveries

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
- The host port 8081 is occupied by the owner's unrelated Expo dev server
  (brain-training, PID 42924); audit lanes must use `E2E_PORT=8083` and must
  never kill that process.
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

## Validation Ledger

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

- `docs/ui-ux/13-calm-momentum-design-system.md` — V3 design authority (new)
- `docs/ui-ux/14-v3-reference-ledger.md` — Refero decisions + lock (new)
- `docs/ui-ux/15-v3-defect-ledger.md` — 33 defects with status tracking (new)
- `docs/ui-ux/v3-audit/` — 47+ audit captures (evidence, committed)
- `docs/testing/known-gaps.md` — entry 24 registers the VISUAL_AUDIT lane
- `e2e/visual-audit.spec.ts` — permanent rendered-truth harness (new)
- `core/theme/designTokens.ts`, `core/theme/tokens.ts`,
  `core/theme/createTheme.ts` — V3 values; canvasTint removed
- `core/ui/Screen.tsx`, `core/ui/Button.tsx`, `core/ui/Card.tsx`,
  `core/ui/PageHeader.tsx`, `core/ui/StatBlock.tsx`, `core/ui/PillChip.tsx`,
  `core/ui/SegmentedControl.tsx`, `core/ui/EmptyStateCard.tsx` — V3 rebuilds
- `core/ui/SectionLabel.tsx` — new primitive; `core/ui/TactileButton.tsx`
  deleted (absorbed by Button celebrate)
- `features/overview/OverviewScreen.tsx` — wash removal
- `features/gamification/RewardCelebrationOverlay.tsx` — Button celebrate
- `app/index.tsx` — five-destination shell + capture slot
- `features/health/HealthScreen.tsx` — new Health parent surface
- `core/providers/navigationContext.ts`, `core/providers/NavigationProvider.tsx`
  — `health` AppSection wiring
- `constants/sectionColors.ts` — health accent (all 14 themes derive)
- `features/command/commandCenterConfig.ts` — health launch context
- `e2e/helpers/navigation.ts`, `e2e/helpers/oracles.ts` — Health routing
- `tests/journeyLabelParity.test.ts` — 5-label rail pin
- `openspec/changes/frontend-v3-calm-momentum/*` — campaign plan artifacts

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
  `E2E_PORT=8083 VISUAL_AUDIT=1 npx playwright test e2e/visual-audit.spec.ts`
  (8081 is the owner's unrelated dev server — never kill PID-tree 42924).
- Resume point for W7: exact next action "W7.1 — rebuild daily habit rows
  around one clear completion anatomy" in `features/habits/`.

## Outcomes & Retrospective

- Campaign is mid-flight (W7 active; W6 complete). Outcome so far: the
  rendered product no longer shows slab headers, FAB-over-content
  collisions, the desktop wash arc, cramped six-tab navigation, the Today
  hierarchy problems, or the To Do dashboard-in-front-of-tasks pattern —
  verification is screenshot-backed at every wave instead of assertion-only.
- What worked: rendered-truth-first auditing (W1) before any redesign; a
  single-owner foundation wave; committing per wave with green gates.
- What to keep doing: inspect screenshots visually at every wave; record
  defects with evidence; never loosen a gate to pass.
