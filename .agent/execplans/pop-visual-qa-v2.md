# ExecPlan: Pop Visual QA V2 — Post-Closure Regression Sweep

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

The Pop Visual QA V1 campaign closed (commit `4223afa`) claiming all identified
defects fixed. A fresh user request asks for another exhaustive,
application-wide visual regression and pixel-level QA pass with vision as
primary truth. Observable success: every major surface rendered at
representative viewports, screenshots vision-inspected, each defect traced to a
root cause and fixed structurally, re-rendered and re-verified, with no
meaningful defect remaining and the Pop direction preserved.

## Context

- Baseline: `HEAD == origin/main == 4223afa`, tree clean, no ACTIVE planner
  prompt (`.agent/EXECUTION_PROMPT.md` COMPLETED 2026-09-05; `pop-visual-qa-v1`
  COMPLETED 2026-09-12; `agent:plan:validate:all` PASS). This plan is the
  campaign driver via native continuation (same precedent as V1).
- Design contract: `docs/ui-ux/12-pop-design-system.md`; tokens
  `core/theme/designTokens.ts`; primitives `core/ui/*`; shell `app/index.tsx`.
- QA harness: Playwright against static `dist/` via `scripts/serve-e2e.js`;
  seed helpers `e2e/helpers/seed.ts`, `e2e/helpers/dbHarness.ts`. Port 8081 is
  owned by an unrelated Metro → audits run on `E2E_PORT=8083`.
- Repo rules: no weakened assertions, no `data-testid`, NativeWind
  `className` + tokens, root-cause fixes over concealment, finite
  `build:web` + `web:verify`/`web:hygiene` only.
- V1 inventory (21 items, ~19 FIXED, 3 ACCEPTED) is the regression baseline;
  V2 must confirm none regressed and find what V1 missed.

## Scope

1. Fresh `build:web`, temporary screenshot harness (`e2e/zz-*`, never
   committed) covering six sections, Settings, Plan hub (5 views), Weekly
   Review, Achievements, Quick Capture, Command Center, all entity modals,
   empty/loading/error/stress states at 360/390/412/768/1024/1280/1440/1920
   plus breakpoint edges.
2. Vision-inspect every screenshot; record defects with screen/cause/fix.
3. Shared-component fixes first, then per-screen; verify all consumers.
4. Re-run harness after each batch until clean.
5. Gates: typecheck, lint, affected Chromium specs, visual harness, native
   smoke (user-visible UI changes), `web:verify` + `web:hygiene`.
6. Coherent commits + push.

## Non-Goals

- No redesign, navigation change, or new features.
- No domain/data/schema changes unless a defect proves a data bug.
- No dependency additions; no test weakening; no `data-testid`; no cosmetic
  masking of layout bugs.

## Current Checkpoint

- Current milestone: W5 — final re-verification after shared-component fixes,
  resuming from uncommitted V2 fixes on top of `4223afa`.
- Completed: V2 rounds 1+2 + P1–P4/P6 sweeps; shared fixes landed in working
  tree (V2-8 raw-Text→`core/ui/Text`, V2-9 stacked backup identity card,
  V2-10 full-width SettingsRow descriptions, V2-11 `—` empty habits stat);
  V2-1–V2-5/V2-7/V2-12–V2-13 triaged (see inventory).
- In progress: W8 — final tree validated (see Validation Ledger); next
  delete temp harness, commit/push, native smoke on clean tree.
- Important modified files: `features/overview/TodayProgressStrip.tsx`,
  `features/settings/SettingsBackupSection.tsx`,
  `features/settings/SettingsSharedUi.tsx` (all uncommitted V2 fixes); temp
  harness `e2e/zz-probe.spec.ts`, `e2e/zz-visual-qa-v2*.spec.ts` (never commit).
- Last successful validation: V1 ladder (see pop-visual-qa-v1.md Outcomes).
- Current failures: None (V2-6 OPEN tooling only — re-capture with
  inner-ScrollView scrolling via v2c-01/v2d-01).
- Relevant quarantines: known-gap 15 (J8 under load), 16 (habits flake), 17
  (native persistence selectors).
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: delete `e2e/zz-*` temp harness → commit/push the three
  feature fixes + this plan → `npm run qa:native:smoke` on clean tree → close plan.
- Remaining definition of done: harness rounds green; all vision defects fixed
  or accepted with rationale; color/type/spacing/dark-parity/a11y sweeps done;
  typecheck/lint/Vitest/Chromium green (minus documented flakes); native smoke
  PASS; web:verify PASS; final side-by-side review clean; commits pushed;
  plan COMPLETED.

## Progress

- [x] W0 — reconcile Git/prompts, open ExecPlan (2026-09-12)
- [x] W1 — fresh export + visual harness rounds 1+2 (sections, overlays, widths) (2026-09-12)
- [x] W2 — defect inventory round 1 from rendered output (2026-09-12)
- [x] W3 — shared-component fixes (`SettingsRow`, account card, strip glyph) (2026-09-12)
- [x] W4 — per-screen fixes (same — no per-screen-only defects survived) (2026-09-12)
- [x] P1 — color audit: 14 justified hardcodes, zero arbitrary surface colors (2026-09-12)
- [x] P2 — typography: raw-`Text` violation fixed; Nunito via primitive everywhere (2026-09-12)
- [x] P3 — dark parity: overview/todos/habits/workout/calories/settings/pomodoro-desktop (2026-09-12)
- [x] P4 — a11y spot: 48px tab targets, themed focus rings, spoken labels kept (2026-09-12)
- [x] P6 — dev artifacts: no lorem/TODO UI; one gated `console.debug` kept (2026-09-12)
- [x] W5 — edge content + breakpoint stress pass (2026-09-12: 767/769 identical, stress 151-pending + big-number strips clean, ≤3-image batches)
- [x] W6 — interactive/layering checks (2026-09-12: quick-capture, plan-progress settled, weekly-review modal, todo-add modal — no overlap)
- [x] P1 — color system + palette audit (tokens, hardcodes, gradients, status)
- [x] P2 — typography + spacing + geometry systematization
- [x] P3 — dark-mode parity sweep (every section + overlays)
- [x] P4 — accessibility (contrast, focus, touch targets, text scaling)
- [x] P5 — forms/keyboard/safe-area/mobile-quality checks (2026-09-12: todo/quick-capture forms, tab-bar/FAB clearance in every shot)
- [x] P6 — App Store presentation + dev-artifact/copy sweep
- [ ] W7 — regression gates + native smoke
- [ ] W8 — final side-by-side review, commit/push, close plan

## Defect Inventory (v2 — rounds 1+2, 2026-09-12)

| #     | Surface                                                                                    | Observation                                                                                   | Verdict                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V2-1  | Plan drawer tabs (390)                                                                     | `Timeline` looked clipped in screenshot                                                       | VERIFIED not a defect — probe: tablist x25 w340, Timeline right=360<390, no text overflow                                                              |
| V2-2  | Calories frequent-food chips                                                               | `Chicken b…` cut at card edge                                                                 | ACCEPTED pattern — horizontal `ScrollView` peek affordance, consistent with mobile scroll rows                                                         |
| V2-3  | Todos list at rest (390)                                                                   | Only a sliver of first row visible                                                            | VERIFIED not a defect — fold position; rows render fully with wrapping (412 proof)                                                                     |
| V2-4  | Overview empty stat strip                                                                  | `—` dashes for Tasks/Workout                                                                  | ACCEPTED — deliberate no-data glyph with spoken-label semantics (`TodayProgressStrip`)                                                                 |
| V2-5  | Quick-capture Title input                                                                  | Purple focus ring on open                                                                     | VERIFIED intentional — themed `:focus` ring (V1 D8), auto-focus on open                                                                                |
| V2-6  | Settings drawer scroll                                                                     | mid/bottom shots identical to top — harness scrolled wrong element                            | CLOSED (tooling) — `scrollDialog` TreeWalker finds inner scroller; mid=theme grid, bottom=backup rows, identity card captured via scrollIntoView probe |
| V2-7  | Color hardcodes                                                                            | 14 hex hits in features: token fallbacks, illustration art, settings accents, `#FFFFFF` check | ACCEPTED — all justified; zero arbitrary surface colors                                                                                                |
| V2-8  | Raw RN `Text`                                                                              | zero imports in features — all via `core/ui/Text`                                             | VERIFIED clean (one violator found+fixed: `SettingsBackupSection` now uses `core/ui/Text`)                                                             |
| V2-9  | Settings Backup identity card (390)                                                        | 200px `RECOVERY REQUIRED` pill squeezed message to 48px one-word lines                        | FIXED — stacked header (title/pill/description full-width); visually verified                                                                          |
| V2-10 | All `SettingsRow` descriptions (23 usages)                                                 | 120–140px columns from wide pills (`NOT READY`/`UNAVAILABLE`)                                 | FIXED shared row: header line + full-width description; verified backup/appearance sections                                                            |
| V2-11 | First-run Habits stat                                                                      | `0/0` reads like a bug                                                                        | FIXED — `—` + `nothing scheduled today` spoken label, mirroring Tasks pattern                                                                          |
| V2-12 | Plan Progress indicator                                                                    | Pill overlaps `Timeline` in screenshot                                                        | VERIFIED motion overshoot — settled alignment within 1.6px (probe); not a defect                                                                       |
| V2-13 | Diary entries, habit detail, achievements, weekly review, quick capture, all dark sections | Full sweep                                                                                    | VERIFIED clean — no defects                                                                                                                            |

## Surprises & Discoveries

- The production-readiness prompt (2026-09-12) raises the bar to App Store
  ship-readiness: color/type/spacing/dark-parity/a11y/forms/motion/copy/
  dev-artifacts + final side-by-side review. Folded into this plan as waves
  P1–P6 rather than a competing plan (single-owner discipline).

## Decision Log

- 2026-09-12 — Proceed via native continuation with new ExecPlan V2 rather
  than requiring a planner or reopening V1: user prompt is a concrete bounded
  QA sweep on the closed tree; local rules require an ExecPlan.
- 2026-09-12 — Run audits on `E2E_PORT=8083` (8081 owned by unrelated Metro).

## Validation Ledger

- 2026-09-12 — `git status --short` — 3 modified feature files + temp harness (V2 fixes uncommitted); `HEAD == origin/main == 4223afa`.
- 2026-09-12 — `npm run build:web` — PASS (fresh export of V2 fixes).
- 2026-09-12 — harness final re-run on fresh dist — v2 10/10, v2b 7/7, v2c 5/5, v2d 3/3; vision review in ≤3-image batches across settings top/mid/bottom, backup identity, diary entries + entries-2, habit detail, achievements, 1024/1440/767/769/1920, stress, quick-capture, plan-progress, weekly-review, todo-add, dark settings.
- 2026-09-12 — `npm run typecheck` — PASS 0 errors.
- 2026-09-12 — `npm run lint` — PASS 0/0.
- 2026-09-12 — `npm run qa:fast` — PASS unit 1755/1755 (133 files) + label parity OK.
- 2026-09-12 — `npx vitest run --project=integration` — PASS 300/300 (63 files).
- 2026-09-12 — Chromium affected specs — overview+settings+portable 10/10; todos 9/9.
- 2026-09-12 — `e2e/habits.spec.ts` — 10 passed / 1 failed (`:222`) = known-gap 16; standalone re-run PASS 1/1.
- 2026-09-12 — `npx playwright test --project=journeys --grep "@p0"` — PASS 25/25.
- 2026-09-12 — `npm run qa:simulation` — PASS 1/1 deterministic scenario.
- 2026-09-12 — `npm run web:verify` — PASS (COOP/COEP present, crossOriginIsolated=true, port released).
- 2026-09-12 — `npm run agent:resume` — PASS structure; Git warnings were the expected uncommitted V2 files.

## Changed Files / Areas

- `.agent/execplans/pop-visual-qa-v2.md` — this plan.
- `features/overview/TodayProgressStrip.tsx` — V2-11 empty-habits `—` fix.
- `features/settings/SettingsBackupSection.tsx` — V2-8 `core/ui/Text` + V2-9 stacked identity card.
- `features/settings/SettingsSharedUi.tsx` — V2-10 full-width SettingsRow descriptions.
- `e2e/zz-probe.spec.ts`, `e2e/zz-visual-qa-v2*.spec.ts` — temp harness (never commit).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`; audit tooling is temporary (`e2e/zz-*`) and must not
   be committed.
3. Rebuild `dist/` (`npm run build:web`) and run the harness with
   `E2E_PORT=8083` (never 8081 while unrelated Metro owns it).
4. Continue from `Exact next action`; keep the defect inventory in this plan.

## Outcomes & Retrospective

- Status: Active.
- Summary: pending.
- Follow-up: pending.
