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

- [ ] 3.1 `designTokens.ts`: V3 radii/typography/springs/size values; remove Pop-era one-offs
- [ ] 3.2 `createTheme` derivation: kill `canvasTint`; dark-hero ink inversion; keep 14 themes valid (`npm run validate:themes`)
- [ ] 3.3 `Text`: implement V3 role scale; verify weight-family mapping unchanged
- [ ] 3.4 `Button`: primary/secondary/tertiary/danger + celebrate; retire default lip; absorb TactileButton as deprecated wrapper
- [ ] 3.5 `Card`: variants standard/inset/hero/stat; remove header bands; radius 16
- [ ] 3.6 `PageHeader`: compact (22/700, no doc subtitle); deprecate `subtitle`
- [ ] 3.7 `Screen`: gutters 16/24/32; remove wash; keep safe-area/centering
- [ ] 3.8 `Modal`: standardize anatomy; sheets keep handle; single primary action
- [ ] 3.9 New `SectionLabel`; restyle `StatBlock`, `EmptyStateCard`, `PillChip`, `SegmentedControl` (compact 36)
- [ ] 3.10 Validate: typecheck, lint, `npm test` (unit+integration), theming spec, `qa:fast`

## 4. W4 — Shell and navigation

- [ ] 4.1 Introduce `AppSection` 'health' + parent surface with Workout/Nutrition entries
- [ ] 4.2 Phone bar: five destinations + center capture slot; tonal active capsule; ≥11px labels; keep `journey-label-parity` green (update rail + parity test in one commit if labels change)
- [ ] 4.3 Rail (≥900): richer destinations; remove stray wash artifact (SYS-15)
- [ ] 4.4 FAB policy: capture slot replaces floating FAB on phone; rail keeps header action; no FAB over forms (SUR-07)
- [ ] 4.5 Update e2e tab navigation helpers; run full chromium battery

## 5. W5 — Today

- [ ] 5.1 Orientation-first layout: date/context → next action hero → critical/overdue → compact glance → secondary modules
- [ ] 5.2 One hero (UP NEXT) with single status model (SYS-11); glance strip neutralized (SYS-03)
- [ ] 5.3 Momentum Garden card sized to content, demoted (SUR-01); desktop two-column glance (SUR-02)

## 6. W6 — To Do + Quick Capture

- [ ] 6.1 Flat list anatomy (48–56 rows, checkbox/title/metadata); List-first view modes
- [ ] 6.2 Collapse triple count duplication (SYS-05); flat search row (SUR-03); single quick-add row (SUR-04)
- [ ] 6.3 Quick-capture sheet: focused input, section-hue type chips (SUR-10), single primary + X (SYS-13)
- [ ] 6.4 Long-title/metadata/bulk/completed/empty states pass; 100+ item perf check (HEAVY fixture)

## 7. W7 — Habits

- [ ] 7.1 Daily check-in list: one row anatomy (check ring, name, streak); kill 5-treatment state pile (SUR-05)
- [ ] 7.2 Quiet group headers; collapse filter stack (SYS-16)
- [ ] 7.3 Fix neutral-progress red misuse (SYS-12); analytics → per-habit progress sheet

## 8. W8 — Focus

- [ ] 8.1 Running state: timer-first, minimal chrome (SYS-08); one-line abandon confirm; fix Reset clip (SYS-09)
- [ ] 8.2 Static/decor growth only on events; dots contextual (SUR-09)

## 9. W9 — Workout

- [ ] 9.1 Quiet plan surfaces (SYS-02/SYS-20): compact Today card, promoted quick-start, collapsed week
- [ ] 9.2 Active session: Dropset/Train-Fitness anatomy (exercise header + set rows + done check + add set + rest dock); no analytics in path
- [ ] 9.3 Brief PR celebration; rest timer never blocks entry

## 10. W10 — Calories / Health validation

- [ ] 10.1 Logging-first hierarchy: remaining hero → macro summary → meals → quick-add → history
- [ ] 10.2 Remove doc-copy from form (SYS-06); FAB-free form (SUR-07); adaptive chips (SYS-18)
- [ ] 10.3 Execute D3 validation gate: measure health flows tap-depth vs six-tab; record decision + evidence

## 11. W11 — Planning / Goals / Projects / Daily Plan

- [ ] 11.1 Shared planning grammar (objective/status/next-action/date/progress rows)
- [ ] 11.2 Reduce exposed fields; detail via disclosure

## 12. W12 — Weekly Review / Progress / Activity

- [ ] 12.1 Narrative-first review; charts support the story (SUR-12)
- [ ] 12.2 Reduce analytics-wall presentation

## 13. W13 — Settings / secondary surfaces

- [ ] 13.1 Grouped-row grammar; kill narration duplicates (SUR-08); quiet Command Center (SYS-14, SUR-11)
- [ ] 13.2 Achievements milestone-first (SUR-13)

## 14. W14 — Full integrity sweep

- [ ] 14.1 Re-run audit harness on all waves; new defects → ledger
- [ ] 14.2 Error/offline/HEAVY/large-text states captured where feasible
- [ ] 14.3 Dark + light full matrix re-inspection

## 15. W15 — Persistent visual regression suite

- [ ] 15.1 `e2e/visual-regression.spec.ts` + curated baselines (deterministic: fixture, viewport, reduced motion, stable clock)
- [ ] 15.2 Verify baseline stability across two runs; wire into standard battery

## 16. W16/W17 — Native + final regression

- [ ] 16.1 Android current-source smoke on Nitro_API_36 (shell, nav, all sections, capture, one modal, one keyboard form)
- [ ] 16.2 Full validation ladder; classify residuals; final report

## 17. Continuous

- [ ] 17.1 Commit per wave (research/lock, foundation, shell, per-screen, regression infra, QA)
- [ ] 17.2 Update ExecPlan checkpoint at every milestone
- [ ] 17.3 Keep defect ledger statuses current (OPEN/FIXED/VERIFIED-FIXED)
