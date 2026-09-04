# ExecPlan: Wave 1 — Multi-AVD Native Orchestration

Plan-Version: 2
Status: ACTIVE

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
- In progress: triaging a CRBABot-only smoke failure the orchestrator
  surfaced (Nitro green 3×; CRBABot red 2× with varying steps).
  Runner now captures Maestro `--debug-output` per lane for evidence.
- Important modified files: `scripts/native-avd.mjs` (new),
  `scripts/qa-native.mjs`, `tests/nativeAvd.test.ts` (new),
  `qa/impact-map.json`.
- Last successful validation: Wave 0 battery (see master plan ledger).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Rerun the single command-center flow on CRBABot
  with debug artifacts, inspect screenshot/hierarchy, classify the
  failure (TEST_BUG vs ENVIRONMENT vs PRODUCT_BUG), fix at the root
  with regression coverage, and re-verify on both AVDs.
- Remaining definition of done: orchestration landed + tested; ≥2-AVD
  lane proof (or ENVIRONMENT record); docs updated; ledger + commit/push.

## Progress

- [x] Workstream plan opened.
- [x] Script audit complete.
- [x] Multi-AVD orchestration implemented + unit-tested.
- [x] Live proof: owned boot + provision (BUILD SUCCESSFUL) + smoke +
      owned stop + labeled reports + collated record on Nitro (PASS 2/2).
- [x] Sequential two-target run Nitro→CRBABot: Nitro PASS, CRBABot
      FAILED (command-center-v2 element-not-found), orchestration
      continued, stopped, collated 1/2 correctly.
- [ ] CRBABot-only failure triaged, fixed, re-verified on both AVDs.
- [ ] ≥2-AVD lane certification (or ENVIRONMENT record).
- [ ] Docs/provenance updated; plan validated; committed/pushed.

## Surprises & Discoveries

- 2026-09-04 — Second AVD pays off immediately: CRBABot_API_36
  (720×1280 @240dpi, GPU on) fails smoke while Nitro_API_36
  (1080×2400 @420dpi) passes the identical APK/source 3×. Failure
  step varies between runs ('Describe it' tap once; first-visible
  waits next) — points at timing/form-factor, not a deterministic
  product defect. Reproducing with debug artifacts before classifying.
- 2026-09-04 — Clean-tree gate verified live: uncommitted runner
  change produced a BLOCKED record (not a lane run), the owned
  emulator was still stopped, and the collated summary counted it.

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

## Changed Files / Areas

- `scripts/native-avd.mjs` — new pure orchestration helpers.
- `scripts/qa-native.mjs` — `--avd/--list-avds/--boot-timeout/
--no-stop/--reset`, labeled reports, sequential loop, owned stop.
- `tests/nativeAvd.test.ts` — 8 unit tests for the helpers.
- `qa/impact-map.json` — native infra rule covers new module/tests.

## Recovery / Resume Instructions

1. Read AGENTS.md, .agent/PLANS.md, ACTIVE prompt Waves 0–1, this plan.
2. Run `npm run agent:resume -- --plan .agent/execplans/multi-avd-orchestration.md`.
3. Inspect `git status -s`, `git diff --stat`, `git diff --name-only`.
4. Run `npm run web:hygiene`; confirm ports; `adb devices` must show no
   campaign-owned emulator unless this plan says one is booted.
5. Continue only from `Exact next action` in Current Checkpoint.

## Outcomes & Retrospective

- Status: Active.
- Summary: audit starting.
- Follow-up: none yet.
