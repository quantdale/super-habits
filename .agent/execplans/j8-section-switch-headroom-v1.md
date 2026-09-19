# ExecPlan: J8 Section-Switch Headroom V1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Investigate J8 (`e2e/journeys/three-months-in.spec.ts`, HEAVY fixture) section-switch
latency on this Linux host and, only if a safe product-side win exists, land a
narrow optimization that moves the worst mounted-section switch toward ≤680ms
(~15% headroom vs the 800ms D14 ceiling) without weakening the ceiling, shrinking
the fixture, retrying-to-pass, breaking recurrence/visibility oracles, or using
display:none. If only host noise remains, close evidence-only (BLOCKED/COMPLETED)
with measurements — no fake wins.

## Context

- Repo `/home/box/Desktop/super-habits`, branch `main`, clean tree, ahead of
  origin/main by 3 commits (2778a1b docs release, 2447787 + 84a5877 web-lifecycle
  test/docs). Do NOT reset/rebase/push/tag/submit per mission.
- Contract: HEAVY fixture unchanged; switch ceiling 800ms unchanged; recurrence +
  visibility oracles unchanged; `display:none` rejected historically (breaks oracles).
- Prior art: CG-4 closed via mounted-screen memoization + a11y-tree suppression +
  stable list callbacks (overview→Todos 573–644ms focused, 733–761ms continuity);
  CG-5 closed via Calories refresh-order. Wave-8 W8-1: six file-level runs
  745/781/774/751/910/775ms, worst-switch varies by run → host jitter suspected;
  known-gaps gap 15 documents the 15% headroom-floor flake class
  (692/697ms battery vs 646ms standalone, no mounted-section diff).
- Switch path: `app/index.tsx` — `SECTION_SCREENS` memoized, all mounted sections
  stay in DOM inside `SectionContainer` (StyleSheet.absoluteFill + Animated
  opacity 200ms / translate 240ms, `inert` + aria-hidden when inactive).
  Measure boundary (`measureSwitch`): click tab → poll rAF until the marker's
  absolute ancestor has computed opacity > 0.5 (so the 200ms fade is inside the
  measurement). Each screen takes `isActive` and refreshes via
  `useActiveForegroundRefresh(isActive, refresh, dayGeneration)`.
- Key files: `e2e/journeys/three-months-in.spec.ts` (steps + measureSwitch +
  assertHeadroom 15%), `app/index.tsx`, `core/providers/NavigationProvider.tsx`,
  `features/*/ *Screen.tsx`, `lib/useForegroundRefresh.ts` (presumed hook impl),
  `docs/testing/known-gaps.md` (CG-4, gap 15).

## Scope

- Create this ACTIVE plan; validate with `agent:plan:validate`.
- Fresh `npm run build:web` → focused HEAVY J8 runs (isolated port, host noted).
- Profile/attribute residual cost (product render path vs host jitter).
- Land at most one narrow oracle-preserving optimization if measured evidence
  supports it; re-measure; commit locally (no push).
- If no safe win: record evidence, close BLOCKED/COMPLETED evidence-only.

## Non-Goals

- No ceiling raise (800ms), no fixture shrink, no retry-to-pass, no display:none,
  no oracle weakening, no full-battery gating claims, no push/tag/EAS, no PII,
  no unrelated product refactors, no CI/matrix changes.

## Current Checkpoint

- Current milestone: COMPLETE — evidence-only close, no product win on measured signal.
- Completed: Plan validated; fresh `build:web`; 4 focused HEAVY J8 runs
  (767 / 691 / 662-FULL-PASS-7/7 / 697 worst-switch); per-switch ordering stable
  (overview→todos slowest, workout→calories second, rest 334–407); temporary
  CDP Profiler probe attributed slowest switch as harness ~31% / browser ~53% /
  app-JS ~16% with no app fn >2.3% (probe + diag log both reverted, `git diff`
  clean for spec); gap-15 annotation added; qa:fast PASS; plan validated;
  committed locally, no push.
- In progress: None — task complete.
- Important modified files: `.agent/execplans/j8-section-switch-headroom-v1.md`
  (this plan), `docs/testing/known-gaps.md` (gap-15 Run-1 annotation).
- Last successful validation: `npm run qa:fast` PASS (typecheck 0, lint 0,
  1791 unit, label parity OK) + focused J8 run 3 FULL PASS 7/7 on final tree
  state (worst 662, 17.3% headroom).
- Current failures: J8 headroom floor misses in runs 1/2/4 (767/691/697 vs 15%
  floor; ceiling 800 held 4/4) — classified EXPECTED_KNOWN_GAP (gap-15 class),
  not a product regression.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — every condition is complete (validated plan, measurements, attribution, gates, local commit, no push).

## Progress

- [x] Startup reads + host/git baseline.
- [x] Plan validated (`agent:plan:validate`).
- [x] Fresh `build:web` on current tree.
- [x] Focused HEAVY J8 measurement ×4 (767 / 691 / 662-pass / 697).
- [x] Attribution: diffuse browser+harness, no app hotspot (CDP probe).
- [x] No safe narrow win — evidence-only close (no fake wins, no threshold/fixture/oracle changes).
- [x] qa:affected → qa:fast PASS.
- [x] Local commit (plan + gap-15 note); no push.
- [x] Plan closed COMPLETED (evidence-only).

## Surprises & Discoveries

- 2026-09-19 — The measured switch window is dominated by NON-product work:
  ~31% Playwright harness (role-engine queries + the rAF `querySelectorAll('*')`
  gate polling inside the page) and ~53% browser pipeline (layout/paint over six
  mounted HEAVY sections during the cross-fade); app JS is ~16% with no function
  above 2.3%. Repeat-activation refresh is already near-minimal
  (`setItemsIfChanged` no-ops on identical rows, same-day expansion suppressed).
  A NavigationContext split would touch ~10 files to chase a fraction of the 16%
  app share — rejected as non-narrow/speculative.
- 2026-09-19 — Run 3 passed FULLY (7/7, worst 662) on the unchanged tree, so the
  15% floor is achievable on this host; misses at 691/697/767 are jitter across
  the floor boundary (band 662–767), exactly the gap-15 class.

## Decision Log

- 2026-09-19 — Evidence-only close is an acceptable success (mission: BLOCKED/
  COMPLETED evidence-only OK); no threshold/fixture/oracle weakening under any
  outcome.
- 2026-09-19 — Ahead commits verified docs/test-only (App Store artifacts +
  web-lifecycle assertion tolerance); no product drift to explain J8 numbers.
- 2026-09-19 — Evidence-only close: no product/spec/fixture/threshold change.
  Rationale: CDP profile shows no component bottleneck (app 16%, max fn 2.3%);
  candidate fixes are either UX-visible (shorter fade buys ~25ms, alters Pop
  motion), oracle-risky (content-visibility, freshness-skip caching), or
  non-narrow (context split, ~10 files for a fraction of 16%). Per mission,
  documented evidence and stopped — no fake wins.

## Validation Ledger

- 2026-09-19 — `npm run web:hygiene` — PASS (8081/8082 FREE, pre-run).
- 2026-09-19 — `npm run agent:plan:validate -- --plan .agent/execplans/j8-section-switch-headroom-v1.md` — PASS (ACTIVE).
- 2026-09-19 — `npm run build:web` — PASS (fresh dist from current tree).
- 2026-09-19 — focused J8 run 1 — ceiling HELD (worst 767 ≤ 800), floor MISSED (4.1%). Host: Linux, load ~3.9/1.8/1.4, 16GB RAM.
- 2026-09-19 — focused J8 run 2 (+temp diag) — 691/336/404/407/654/343, worst 691 overview→todos (13.6% miss).
- 2026-09-19 — focused J8 run 3 (+temp diag) — 662/369/334/340/507/372, FULL 7/7 PASS, worst 662 (17.3% headroom); diary 295ms, picker 145ms.
- 2026-09-19 — CDP Profiler probe (temp spec, reverted) — calories→todos 778ms: harness 31.3% / browser 52.9% / app 15.8%, top app fn 2.3%; habits→focus 540ms: 37.2%/37.6%/25.3%. No hotspot.
- 2026-09-19 — temp diag + probe reverted — `git status` clean except plan; spec byte-identical.
- 2026-09-19 — focused J8 run 4 (final tree) — worst 697 (12.9% miss), ceiling held. Band across runs: 662–767.
- 2026-09-19 — `npm run qa:affected` — agent-workflow-and-documentation → qa:fast, no broad regression.
- 2026-09-19 — `npm run qa:fast` — PASS (typecheck 0, lint 0, 1791/1791 unit, label parity OK).

## Changed Files / Areas

- `.agent/execplans/j8-section-switch-headroom-v1.md` — this plan.
- `docs/testing/known-gaps.md` — gap-15 Run-1 annotation (Linux numbers + probe attribution).

## Recovery / Resume Instructions

1. Read `AGENTS.md` then `.agent/PLANS.md` fully.
2. Read this plan fully.
3. Run `git status --short`, `git log --oneline -5`, `git diff --stat`; Git wins.
4. Run `npm run agent:resume -- --plan .agent/execplans/j8-section-switch-headroom-v1.md` (read-only orientation) and `npm run web:hygiene`.
5. Continue only from `Exact next action` above.

## Outcomes & Retrospective

- Status: Complete (evidence-only).
- Summary: Four focused HEAVY runs on a fresh build measured worst-switch
  767/691/662/697 (ceiling 800 held 4/4; 15% floor passed 1/4 with a full 7/7).
  Per-switch ordering is stable but the worst band (662–767) is jitter across the
  680 floor target. CDP profiling attributes the slowest switch to harness
  (~31%) + browser rendering (~53%) with app JS at ~16% and no hotspot, so no
  narrow oracle-preserving product win exists. Zero product/spec/fixture/
  threshold changes; docs-only diff (plan + gap-15 note) committed locally.
- Follow-up: successor runs should (a) re-measure on a quiet host/CI before any
  product change, (b) treat any future floor miss as gap-15 class unless a new
  hotspot appears, (c) only pursue the NavigationContext split if a profile ever
  shows app JS dominating with cascade stacks — not the case today.
- Lessons: temporary diag/probe with guaranteed revert gives per-switch +
  profile evidence without touching the contract; the rAF gate's own polling is
  a meaningful fraction of the measured window, so sub-ceiling jitter is
  expected, not regressed.
