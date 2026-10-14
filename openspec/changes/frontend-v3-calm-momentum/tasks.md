## 1. W0/W1 — Truth and audit (done during campaign opening)

- [x] 1.1 Verify repository baseline (HEAD `3a37637` = `origin/main`), preserve stash + untracked evidence
- [x] 1.2 Build hermetic `dist/` via `npm run build:e2e` (no ambient EXPO_PUBLIC_*)
- [x] 1.3 Create visual-audit harness `e2e/visual-audit.spec.ts` (VISUAL_AUDIT=1 gated)
- [x] 1.4 Capture 47-image current-state matrix into `docs/ui-ux/v3-audit/`
- [x] 1.5 Visually inspect 12+ key captures; write defect ledger `docs/ui-ux/15-v3-defect-ledger.md`

## 2. W2 — Research and design lock (done during campaign opening)

- [x] 2.1 Refero style research (calm productivity) → R1
- [x] 2.2 Refero screen research (tasks R2, habits R3, workout R4, nutrition R5, capture R6)
- [x] 2.3 Reference Decision Ledger `docs/ui-ux/14-v3-reference-ledger.md` + reference lock
- [x] 2.4 Design system `docs/ui-ux/13-calm-momentum-design-system.md`

## 3. W3 — Foundation (single owner)

- [x] 3.1 `designTokens.ts`: V3 radii/typography/springs/size values; remove Pop-era one-offs
- [x] 3.2 `createTheme` derivation: kill `canvasTint`; dark-hero ink inversion; keep 14 themes valid (`npm run validate:themes`)
- [x] 3.3 `Text`: implement V3 role scale; verify weight-family mapping unchanged
- [x] 3.4 `Button`: primary/secondary/tertiary/danger + celebrate; retire default lip; absorb TactileButton as deprecated wrapper
- [x] 3.5 `Card`: variants standard/inset/hero/stat; remove header bands; radius 16
- [x] 3.6 `PageHeader`: compact (22/700, no doc subtitle); deprecate `subtitle`
- [x] 3.7 `Screen`: gutters 16/24/32; remove wash; keep safe-area/centering (W4.5: gutters made real — `pageGutterForWidth` 16/24/32 applied to scroll content, padded fills, and pinned heroes; verified at 360/768/1280)
- [x] 3.8 `Modal`: standardize anatomy; sheets keep handle; single primary action (W4.5 audit: existing primitive already satisfies the V3 anatomy — scrim, 48pt close, 24pt body padding, safe-area/keyboard handling, reduced motion, level-3 elevation; stale Pop wording replaced, design doc §10 padding corrected to match; no code churn required)
- [x] 3.9 New `SectionLabel`; restyle `StatBlock`, `EmptyStateCard`, `PillChip`, `SegmentedControl` (compact 36)
- [x] 3.10 Validate: typecheck, lint, `npm test` (unit+integration), theming spec, `qa:fast`

## 4. W4 — Shell and navigation

- [x] 4.1 Introduce `AppSection` 'health' + parent surface with Workout/Nutrition entries
- [x] 4.2 Phone bar: five destinations + center capture slot; tonal active capsule; ≥11px labels; keep `journey-label-parity` green (update rail + parity test in one commit if labels change)
- [x] 4.3 Rail (≥900): primary group + Health group with direct Workout/Calories destinations and exact active highlight (W4.5 Fix C — the original W4 commit shipped the same 5 items on both layouts; the richer two-group rail is the correction); wash artifact removed in W3 (SYS-15)
- [x] 4.4 FAB policy: capture slot replaces floating FAB on phone; rail keeps header action; no FAB over forms (SUR-07)
- [x] 4.5 Update e2e tab navigation helpers; run full chromium battery

## 5. W5 — Today

- [x] 5.1 Orientation-first layout: date/context → next action hero → critical/overdue → compact glance → secondary modules
- [x] 5.2 One hero (UP NEXT) with single status model (SYS-11); glance strip neutralized (SYS-03)
- [x] 5.3 Momentum Garden card sized to content, demoted (SUR-01); desktop two-column glance (SUR-02)

## 6. W6 — To Do + Quick Capture

- [x] 6.1 Flat list anatomy (48–56 rows, checkbox/title/metadata); List-first view modes
- [x] 6.2 Collapse triple count duplication (SYS-05); flat search row (SUR-03); single quick-add row (SUR-04)
- [x] 6.3 Quick-capture sheet: focused input, section-hue type chips (SUR-10), single primary + X (SYS-13)
- [x] 6.4 Long-title/metadata/bulk/completed/empty states pass; 100+ item perf check (HEAVY fixture)

## 6a. W6.5 — Bounded To Do convergence (W6 remains complete)

- [x] 6.5.1 Measure and repair standard 48–56pt density, checkbox ≥48pt / More ≥44pt; long titles and scaled text expand without clipping
- [x] 6.5.2 Window HEAVY query/filter, bulk selection and expanded completed history; retain manual reorder and full-global-order safety; prove recycling and durable mutations
- [x] 6.5.3 Use theme accent for Project/Goal capture; preserve the W6 reference lock, fresh screenshots, and truthful campaign records
- [x] 6.5.4 Complete broad local gates, record native qualification limits, publish normally, inspect exact-head hosted CI, then hand off W7.1 without Habits changes (PR58 MERGED to main as f37539a; exact-main CI passes through tests, audit-only red; native BLOCKED/deferred, not certified)

## 7. W7 — Habits

- [x] 7.1 Daily check-in list: one row anatomy (check ring, name, streak); kill 5-treatment state pile (SUR-05)
- [x] 7.2 Quiet group headers; collapse filter stack (SYS-16)
- [x] 7.3 Fix neutral-progress red misuse (SYS-12); analytics → per-habit progress sheet

## 8. W8 — Focus

- [x] 8.1 Running state: timer-first, minimal chrome (SYS-08); one-line abandon confirm; fix Reset clip (SYS-09)
- [x] 8.2 Static/decor growth only on events; dots contextual (SUR-09)

## 9. W9 — Workout

- [x] 9.1 Quiet plan surfaces (SYS-02/SYS-20): compact training-state card, promoted quick-start, collapsed week — implemented and rendered in `docs/ui-ux/v3-audit/w9/`
- [x] 9.2 Active session: Dropset/Train-Fitness anatomy (exercise header + set rows + done check + add set + rest dock); no analytics in path — session-local Add set persists through draft/resume/log
- [x] 9.3 Brief PR celebration; rest timer never blocks entry — docked rest panel, truthful finish/cancel, accurate progress labels

## 9a. W9.5 — Workout convergence (bounded correction; W9 stays complete)

- [x] 9.5.1 Skipped-write handling: `handleFinish()` success requires `applied` AND a log id; a `skipped` result never clears the draft, earns XP, or shows "Workout saved" (reproduced pre-fix; `tests/workoutSessionSave.test.ts` + `tests/integration/workoutSaveIntegrity.data.test.ts`)
- [x] 9.5.2 Post-commit correctness: durable commit decides saved-vs-not-saved; draft cleanup/reward attribution are isolated bookkeeping that cannot rewrite a committed save or invite a duplicate insert; double Finish stays idempotent
- [x] 9.5.3 Draft retention and recovery: no clear on the error path; the debounced write/clear race is closed by a clear generation; unresumable deleted-routine limitation stated truthfully in the message
- [x] 9.5.4 Single Workout scroll authority: nested scroll-enabled `Screen` removed (exactly one page-level scroll container; 360/390/412/768/1280 scroll + keyboard verified in `e2e/workout-w95.spec.ts`; 9 inspected captures in `docs/ui-ux/v3-audit/w9.5/`)
- [x] 9.5.5 Full validation ladder, publication through the normal workflow, and exact-head hosted CI verification (PR #67 merged as `24b01b5`; exact-head run `38162706650` green through unit/integration at 2,665 passed / 3 skipped; audit red only on the two pre-existing braces/node-forge advisories; hosted e2e/nightly skipped)

## 10. W10 — Calories / Health validation

- [x] 10.1 Logging-first hierarchy: remaining hero → macro summary → meals → quick-add → history
      (one remaining/consumed/goal fact each; shared meal-grouped log; collapsed
      History & insights disclosure; SYS-06/SYS-18/SUR-07 verified fixed —
      `docs/ui-ux/v3-audit/w10/`)
- [x] 10.2 Remove doc-copy from form (SYS-06); FAB-free form (SUR-07); adaptive chips (SYS-18)
- [x] 10.3 Execute D3 validation gate: measure health flows tap-depth vs six-tab; record decision + evidence
      (five-destination 3/3/1 taps vs six-tab 2/2/1; six-tab shipped; `health` kept as a
      valid non-bar section — `docs/ui-ux/v3-audit/w10/d3-*.json`, `tests/healthNavigationW10.test.ts`)

## 11. W11 — Planning / Goals / Projects / Daily Plan

- [x] 11.1 Shared planning grammar (objective/status/next-action/date/progress rows)
- [x] 11.2 Reduce exposed fields; detail via disclosure

## 12. W12 — Weekly Review / Progress / Activity

- [x] 12.1 Narrative-first review; charts support the story (SUR-12) — W12: `Review → Decide → Plan → Reflect → Confirm` with the week's factual story first and every count behind one `All numbers` disclosure; SUR-12 VERIFIED-FIXED (`docs/ui-ux/v3-audit/w12/`; `e2e/planning-w12.spec.ts` 5/5, `e2e/weekly-review.spec.ts` 2/2, `tests/integration/weeklyReviewW12Persistence.test.ts` 3/3)
- [x] 12.2 Reduce analytics-wall presentation — W12: Progress leads with ≤3 headline rows and one `More details` disclosure; Activity replaces 25 always-visible chips with one `Filters` control and flat chronological rows (first event moved from below the fold to the first fold)

## 13. W13 — Settings / secondary surfaces

- [x] 13.1 Grouped-row grammar; kill narration duplicates (SUR-08); quiet Command Center (SYS-14, SUR-11) — W13: `SettingsRow` renders `label · value` + an optional disclosed explanation; the duplicated `Current selection`/`Active behavior` rows are gone; the `CURRENT SECTION` panel and `Command input` header are gone and examples render only while the field is empty; all four ledger ids VERIFIED-FIXED (`docs/ui-ux/v3-audit/w13/`; `e2e/secondary-surface-w13.spec.ts` 5/5)
- [x] 13.2 Achievements milestone-first (SUR-13) — W13: an earned milestone leads, one next target follows, earned tiers render inline and the collection sits behind one `All badges` disclosure; SUR-13 VERIFIED-FIXED (`e2e/gamification.spec.ts` 4/4)

## 14. W14 — Full integrity sweep

- [x] 14.1 Re-run audit harness on all waves; new defects → ledger — W14: 247 captures across 360/390/412/768/1024/1280/1440 light+dark; every per-wave audit re-run on the integrated build; W14 defect register in `docs/ui-ux/v3-audit/w14/README.md`
- [x] 14.2 Error/offline/HEAVY/large-text states captured where feasible — W14: HEAVY/LONG_TEXT/FIRST_RUN/EMPTY covered by the matrix; offline/rejected-write states are covered by their behavioural specs (recorded as such, not silently dropped)
- [x] 14.3 Dark + light full matrix re-inspection — W14: full dark/light representative matrix; found and fixed the P1 44pt disclosure touch-target defect (`tests/uiTouchTargetContract.test.ts` 8/8); full Chromium battery 245/245

## 15. W15 — Persistent visual regression suite

- [x] 15.1 `e2e/visual-regression.spec.ts` + curated baselines — W15: 30 curated goldens under `e2e/__screenshots__/` with a `visual` Playwright project, fixed clock, reduced motion + disabled animations, `document.fonts.ready`, no masking, `maxDiffPixels: 0` (manifest: `docs/ui-ux/v3-audit/w15/golden-manifest.md`)
- [x] 15.2 Verify baseline stability across two runs; wire into standard battery — W15: two independent fresh-state runs at 30/30 with an unchanged baseline hash (`0676368d…`); negative sensitivity proven (perturb → 18 failures, restore → 30/30); registered in `npm run e2e` and an explicit CI PR-lane step with its own retry-report gate

## 16. W16/W17 — Native + final regression

- [x] 16.1 Android current-source smoke on Nitro_API_36 — W16: exact-source (`b50034d`) credential-free APK (SHA-256 `AA89D9FE…`, 0 remote hosts) on API 36 / x86_64 / `Nitro_API_36`; smoke 2/2, persistence 11/11, lifecycle 6/6, reward 1/1, backup-v2 1/1, portable-backup 2/2 = **23/23 flows**; two product defects found and fixed (nav-label truncation; weekly-plan day/assignment a11y) and nine stale flow markers corrected (`docs/ui-ux/v3-audit/w16/`)
- [x] 16.2 Full validation ladder; classify residuals; final report — W17: seven-lane ladder at `3aaca2a`; **Vitest fully green for the first time** (2,691 passed / 0 failed) after proving the reported Windows-CRLF residual was a TEST_BUG; Chromium 245/245, visual 30/30, a11y 10/10, timezones 105, integration 419, simulation 1/1, P0 journeys 25/25; security audit re-read (2 inherited advisories, no upstream fix, not waived); verdict CONDITIONAL / NEAR-COMPLETE with a bounded handoff (`docs/ui-ux/v3-audit/w17/`)

## 17. Continuous

- [x] 17.1 Commit per wave — W12 `1d54b70`, W13 `b1569f0`, W14 `c6937b5`, W15 `42d1c20`, W16 `d04793b`, W17 `3aaca2a` on `frontend-v3-w12-w17-integration` (PR #76)
- [x] 17.2 Update ExecPlan checkpoint at every milestone — master + six wave plan statuses kept current
- [x] 17.3 Keep defect ledger statuses current — `SUR-12`, `SUR-08`, `SYS-14`, `SUR-11`, `SUR-13` all VERIFIED-FIXED with rendered evidence; W14/W16 ledgers record their own findings
