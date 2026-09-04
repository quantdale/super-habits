# ExecPlan: Wave 1 — Multi-AVD Native Orchestration

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Replace manual multi-AVD shell choreography with a checked-in, finite,
process-owned sequential orchestration path so native certification is
reproducible across configured AVDs without manual emulator management.

## Context

- `scripts/qa-native.mjs` (runner: `--platform/--tag/--flow/--serial`,
  auto-provision), `scripts/qa-native-provision.mjs` (`--serial/--force`),
  `scripts/native-qa-utils.mjs` (`parseAdbDevices`, `selectAndroidDevice`
  throws on multiple targets without serial), `scripts/native-provenance.mjs`
  (git + build provenance), reports under `simulation-output/native/`.
- AVDs on this host: `CRBABot_API_36`, `Nitro_API_36`, `braintraining-qa36`,
  `braintraining36`. Maestro 2.8.0. `adb` present.
- Constraints: sequential default (no shared-emulator parallelism); ownership
  proof before any destructive emulator step; per-target provenance records;
  new parsing/orchestration logic ships with Vitest unit tests (precedent:
  `tests/journeyLabelParity.test.ts`); canonical vs TEST-ONLY provenance
  separation (Wave 2 builds on this record shape).

## Scope

- Audit emulator discovery/boot/readiness/provision/reset/run/artifact/stop
  gaps in current scripts.
- Extend `scripts/qa-native*.mjs` (no parallel runner): `--avd` selection,
  AVD discovery listing, deterministic boot + bounded readiness wait with
  exact failure reason, per-target labeled artifacts, stop-only-what-we-started.
- Unit tests for new pure logic (device/AVD parsing, target planning,
  record shaping).
- Certification: selected smoke/persistence lane across ≥2 configured AVDs
  (or single-target + ENVIRONMENT record if host allows only one).

## Non-Goals

Parallel AVD execution; new emulator technology; product-source changes;
rewriting provisioner provenance logic that already works.

## Current Checkpoint

- Current milestone: tooling implemented + unit-tested; live multi-AVD
  proof next.
- Completed: audit (`qa-native.mjs` single-target only; `selectAndroidDevice`
  throws on >1 target; no AVD discovery/boot/readiness/stop; ambiguous
  report names); new pure module `scripts/native-avd.mjs` (AVD-list parse,
  boot-readiness predicate, connected-AVD match, fail-fast sequence planner,
  owned-serial discovery, filename-safe labels, Wave 6 provenance record +
  collation); `tests/nativeAvd.test.ts` 8/8 green; `qa-native.mjs` extended
  (`--avd` repeatable, `--list-avds`, `--boot-timeout`, `--no-stop`,
  `--reset` opt-in, per-target labeled reports, sequential multi-AVD loop
  with owned-emulator stop + collated summary); `findEmulator` uses
  read-only `-list-avds` probe (`emulator --version` exits 1 by design);
  impact map `native-e2e-infrastructure` rule covers `scripts/native-*.mjs`
  - native tests; `--list-avds` verified (4 AVDs, none connected);
    unknown-AVD fail-fast verified with zero emulators started.
- Current milestone: COMPLETE — tooling landed + tested, ≥2-AVD
  proof green, PRODUCT_BUG + TEST_BUGs fixed and verified.
- Completed: all Wave 1 implementation + verification (see Progress
  and Validation Ledger). No product-tree drift beyond the one
  justified FAB-gesture product fix.
- In progress: none.
- Important modified files: `scripts/native-avd.mjs` (new),
  `scripts/qa-native.mjs`, `tests/nativeAvd.test.ts` (new),
  `qa/impact-map.json`.
- Last successful validation: Wave 0 battery (see master plan ledger).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Complete — orchestration landed +
  tested; Nitro + CRBABot smoke green @45dc256; fixes verified;
  ledger + commits pushed; plan validated.

## Progress

- [x] Workstream plan opened.
- [x] Script audit complete.
- [x] Multi-AVD orchestration implemented + unit-tested.
- [x] Live proof: owned boot + provision (BUILD SUCCESSFUL) + smoke +
      owned stop + labeled reports + collated record on Nitro (PASS 2/2).
- [x] Sequential two-target run Nitro→CRBABot: Nitro PASS, CRBABot
      FAILED (command-center-v2 element-not-found), orchestration
      continued, stopped, collated 1/2 correctly.
- [x] CRBABot-only failure triaged (PRODUCT_BUG tap race +
      TEST_BUG below-fold assertions; see Surprises).
- [x] Product fix + flow fixes implemented (typecheck 0, lint 0,
      unit 8/8); rebuilt @65063a5; CRBABot smoke: FAB race FIXED
      (sheet opens), native-smoke PASSED (Anytime scroll works).
- [x] Second CRBABot finding (screenshot-proven): sheet autofocus
      pops the keyboard over `Describe it`; scroll cannot reveal
      it. Test-layer fix: `hideKeyboard` before scroll+tap.
- [x] Re-verified full smoke on CRBABot (2/2 @45dc256: ccv2 33s,
      native-smoke 36s) then Nitro regression (2/2 @45dc256, no
      regressions); plan COMPLETED.
- [x] ≥2-AVD lane certification (Nitro + CRBABot green).
- [x] Docs/provenance updated; plan validated; committed/pushed.

## Surprises & Discoveries

- 2026-09-04 — Second AVD pays off immediately: CRBABot_API_36
  (720×1280 @240dpi, GPU on) fails smoke while Nitro_API_36
  (1080×2400 @420dpi) passes the identical APK/source 3×.
- 2026-09-04 — Clean-tree gate verified live: uncommitted runner
  change produced a BLOCKED record (not a lane run), the owned
  emulator was still stopped, and the collated summary counted it.
- 2026-09-04 — ROOT CAUSE (PRODUCT_BUG, P1-low): on CRBABot every
  FAB press (Maestro tap, adb instant tap, adb 500ms long-press —
  5/5) opens the Command center instead of the Quick-capture
  sheet; on Nitro the sheet opens (4/4). Only code path to the
  command center here is the sheet's `Describe it` button
  (`openAdvancedCapture` ← `openCommandCenter`; sole other caller
  is Settings, not in this flow). Maestro log proves the tap aims
  correctly at the FAB (bounds [626,1147][699,1220], tap
  (662,1183)); failure screenshot + hierarchy (8 nodes, CC-only)
  prove the sheet is skipped; after-Back probe proves no sheet sits
  underneath. Mechanism: the sheet Modal (fade, laid out from frame
  1. renders synchronously inside the opening press, and the
     gesture's release re-targets to the freshly laid-out `Describe
it` under the finger — a real small-screen tap race (fast human
     taps reproduce it; Back recovers, so no data loss). Fix: defer
     the sheet window creation past the opening gesture (setTimeout 0
     in the FAB press, matching `openAdvancedCapture` style).
- 2026-09-04 — Independent TEST_BUG (screenshot-proven): on
  CRBABot the Habits tab activates correctly but `Anytime` sits
  below the fold (groups render after the day strip; 1280px shows
  only down to the strip) while Nitro fits it on screen. Same
  class for run-1 `Describe it` (sheet end-content below fold).
  Fix at test layer: scroll-before-assert/tap (pattern already used
  later in ccv2); no assertion semantics change.

## Decision Log

- 2026-09-04 — Extend `qa-native*.mjs` in place; no parallel runner
  (prompt Wave 1 + Wave 5 constraint).

## Validation Ledger

- 2026-09-04 — `npx vitest run --project unit tests/nativeAvd.test.ts`
  — 8/8 PASS.
- 2026-09-04 — `node scripts/qa-native.mjs --list-avds` — 4 AVDs
  listed, 0 connected, exit 0.
- 2026-09-04 — unknown-AVD fail-fast (`--avd Missing_AVD`) — exit 1
  with exact reason; `adb devices` still empty (nothing booted).
- 2026-09-04 — `qa:impact:validate` — 13 rules valid after
  `native-e2e-infrastructure` extension.
- 2026-09-04 — CRBABot smoke @45dc256 — 2/2 PASS (ccv2 33s,
  native-smoke 36s); owned stop + collated record verified;
  `adb devices` empty after.
- 2026-09-04 — Nitro smoke @45dc256 — 2/2 PASS (ccv2 33s,
  native-smoke 43s); no regressions from FAB deferral or flow
  changes; `adb devices` empty after.
- 2026-09-04 — Live Wave 1 proof: owned boot + provision (BUILD
  SUCCESSFUL) + smoke + owned stop + labeled reports + collated
  record on Nitro PASS 2/2 (APK DE46ADA6 @3c1ddfe); sequential
  Nitro→CRBABot run: Nitro PASS, CRBABot ccv2 FAILED (element
  not found), orchestration continued/stopped/collated 1/2.
- 2026-09-04 — CRBABot repro series: smoke 0/2 (first-visible
  waits), ccv2DBG PASS 1/1 once, smoke 0/2 again — all with owned
  lifecycle + cleanup verified (`adb devices` empty after each).
- 2026-09-04 — ENVIRONMENT incidents handled with proof: (a) -1
  infrastructure kill mid-build stranded repo-attributed gradle
  tree + orphaned campaign nodes → exact-PID taskkill (35360/T)
  - natural exit; (b) prebuild EBUSY caused by (a), cleared after
    sweep; (c) ad-hoc log file tripped clean-tree gate (correct
    BLOCKED); lesson: ad-hoc logs stay out of the repo tree.

## Changed Files / Areas

- `scripts/native-avd.mjs` — new pure orchestration helpers.
- `scripts/qa-native.mjs` — `--avd/--list-avds/--boot-timeout/
--no-stop/--reset`, labeled reports, sequential loop, owned stop.
- `tests/nativeAvd.test.ts` — 8 unit tests for the helpers.
- `qa/impact-map.json` — native infra rule covers new module/tests.
- `app/index.tsx` — FAB opens the quick-capture sheet after the
  opening gesture (setTimeout 0); fixes the small-screen tap race.
- `.maestro/flows/command-center-v2.yaml` — scroll to `Describe it`
  before tapping (below fold on small screens).
- `.maestro/flows/native-smoke.yaml` — scroll to `Anytime` before
  asserting (below fold on small screens).

## Recovery / Resume Instructions

1. Read AGENTS.md, .agent/PLANS.md, ACTIVE prompt Waves 0–1, this plan.
2. Run `npm run agent:resume -- --plan .agent/execplans/multi-avd-orchestration.md`.
3. Inspect `git status -s`, `git diff --stat`, `git diff --name-only`.
4. Run `npm run web:hygiene`; confirm ports; `adb devices` must show no
   campaign-owned emulator unless this plan says one is booted.
5. Continue only from `Exact next action` in Current Checkpoint.

## Outcomes & Retrospective

- Status: Completed.
- Summary: sequential multi-AVD orchestration landed in
  `scripts/qa-native.mjs` on pure helpers in `scripts/native-avd.mjs`
  (8 unit tests), with labeled per-target reports, owned-emulator
  lifecycle, fail-fast planning, and collated Wave 6 records. Live
  proof on Nitro_API_36 + CRBABot_API_36 (API 36 x86_64) green 2/2
  each at `45dc256`. The second AVD found one PRODUCT_BUG (FAB tap
  race skipping the sheet on small screens; fixed by deferring the
  sheet window past the opening gesture) and two TEST_BUG flow gaps
  (below-fold `Anytime`/`Describe it`; fixed with scroll) plus one
  keyboard-coverage gap (fixed with `hideKeyboard`) — all verified
  on both AVDs with no regressions. Maestro `--debug-output` per
  lane is now standard (screenshots/hierarchies/logcat per failure).
- Follow-up: install-reuse across serials (avoid identical rebuilds
  per AVD switch; deferred to Wave 5); `--auth-mock` lane (Wave 2)
  reuses the per-target record shape and owned-lifecycle patterns.
