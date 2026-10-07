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
  and campaign reconciliation. W7.1 is the next feature checkpoint, not
  started. Preserve W6's flat anatomy/reference lock and domain semantics.

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

- Current milestone: W6.5 COMPLETE; W7.1 Habits is next, not started.
- Completed: W0–W6 unchanged; W6.5 density/windowing/selection/order/capture
  and rendered evidence closed. Standard55 / checkbox48 / More44; long/scaled
  text expands; HEAVY query129ms, completed window23.60 fresh captures/16
  visually inspected. No data/dependency/security policy or Habits changes.
  Product/evidence commit `f0e02910aae56fe2902fae4ec1574e3aa7c502f8` published
  normally on `fix/ui-v3-w6.5-convergence`, [PR58](https://github.com/quantdale/super-habits/pull/58)
  OPEN (not merged).79 files; normal hooks ran. Stash, foreign iOS evidence
  and historical captures preserved; owned baseline worktree removed.
- In progress: campaign W7–W17 remain, with W7.1 not started. Closure is
  documentation-only; normal publication and exact final-head CI are required
  before handoff. Terminal evidence uses `w65-publication/final-ci.json` and
  `final-ci-failed.log` (compare headSha with Git before relying on it).
  Campaign Status stays ACTIVE, not overall certification.
- Important modified files: committed TodoItem/TodosScreen/QuickCaptureOverlay,
  list contracts/convergence/HEAVY helpers, fresh audit, bounded a11y/semantic
  toggle/modal harness repairs. Closure records: this plan, tasks, defect ledger.
- Last successful validation: qa:full local2559 PASS/2 existing skips,
  browser243 PASS/56 existing gated skips/0 fail/0 flaky, deterministic23/23.
  qa:fast unit2162, integration397 +2 skips, P0 25/25, themes140/140,
  plans120/120, OpenSpec73/73 PASS. Exact product-head push CI37635421767
  and PR CI37635650147 pass install/typecheck/Deno/lint/themes/OpenSpec/
  parity/plans/unit+integration (hosted2558 PASS/3 existing skips), then
  fail only the two known HIGH advisories. Local reports and hosted logs in
  `.cursor/playwright-output/w65-final-full/`, `w65-final-impact-rerun/`,
  `w65-publication/`; full scenario reports in simulation-output.
- Current failures: hosted dependency audit remains red: braces
  GHSA-vfj7-8cjw-p6xm and node-forge GHSA-86w9-cpqp-85rv, known in repository
  records but UNDOCUMENTED TO THE AUDIT GATE. No local failures. Hosted E2E
  is skipped behind quality/audit, not passed. No security waiver or bypass.
- Relevant quarantines: existing opt-in/internal/remote-boundary gates only;
  none added. Full browser56 existing skips; visual audit ran separately7/7.
- Blockers: no W6.5 product blocker. Native smoke/targeted ENVIRONMENT:
  preflight emulator-5554 API35/x86_64 versus required36; no device mutation.
  Native/current-source largest-font qualification remains unverified; Android
  full qualification W16, iOS owner-deferred. Require supported target plus
  clean same-commit checkout; never delete preserved foreign evidence.
- Exact next action: W7.1 — after normal fresh-session Git/CI reconciliation,
  read HabitsScreen plus domain/data and the locked V3 rules, then rebuild
  daily habit rows around one clear completion anatomy. Handoff only here:
  do not implement Habits in this session.
- Remaining definition of done: W6.5 behavior/evidence/local gates/product
  publication/exact-product-head review verified; final documentation-head
  publication/CI evidence must also be captured before handoff. No further
  To Do implementation remains. Campaign W7–W17 stay unchecked.

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

## Validation Ledger

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
- Resume point after W6.5 handoff: W7.1 — read `features/habits/HabitsScreen.tsx`
  plus domain/data and the locked V3 rules, then rebuild daily habit rows around
  one clear completion anatomy. This wave stops before implementing Habits.

## Outcomes & Retrospective

- W6.5 COMPLETE and published for review in PR58; W7.1 next, not started.
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
