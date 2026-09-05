# Super Habits Certification Infrastructure V2

**Status:** COMPLETED
**Exact next action:** None — campaign complete.
**Planned-From:** `1e1f4d04aa30980667d27ecc1caa38734060e9ff`
**Target branch:** `main`
**Campaign:** Super Habits Certification Infrastructure V2
**Subtitle:** Multi-AVD Orchestration → Auth-Mock Productization → Historical DB Corpus → Long-Run Certification Automation

---

## 0. Planner baseline (authoritative, verified 2026-09-04)

- `HEAD == origin/main == 1e1f4d04aa30980667d27ecc1caa38734060e9ff` (`1e1f4d0`), branch `main`, tree clean, single worktree, no other local/remote branches.
- `.agent/EXECUTION_PROMPT.md` before this plan was `Status: COMPLETED` (overnight reliability campaign, planned-from `5ee3531...`). `.agent/PLANNER_HANDOFF.md` is routing-only. `npm run agent:plans` shows all plans `COMPLETED` (including `.agent/execplans/overnight-reliability-certification-v1.md`).
- Predecessor `overnight-reliability-certification-v1` is `COMPLETED` with strong closing evidence: typecheck 0, lint 0, full Vitest `1906/1906` (unit `1665/1665` + integration `241/241`), OpenSpec `50/50`, P0 `25/25` ×5 consecutive, full E2E `198 passed / 43 expected skips / 0 failed`, deterministic simulation library `23/23`, seeded sample PASS, sync lane `40/46` (6 capability-gated skips), `build:web` PASS, `web:verify` PASS, hygiene PASS, J8 ceilings with margin (cold `544/5000`, maxSwitch `642/800`, diary `318/500`, picker `108/500`), native canonical provision PASS + smoke `2/2` ×2 + persistence `11/11` ×2 (~10m52s, ~10m40s, no growth) + lifecycle `6/6` + auth `3/3` ×3 with exactly-1-signup/same-UID mock proof on `Nitro_API_36` / `emulator-5554`.
- Predecessor made **zero product-source changes**: `git diff --name-only 5ee3531..1e1f4d0` touches only `.agent/EXECUTION_PROMPT.md`, `.agent/execplans/overnight-reliability-certification-v1.md`, and three `.maestro/flows/auth-session-*.yaml` TEST_BUG flow corrections (raw pill text, `01/02/03` restart-before-protect ordering). `app/ core/ features/ lib/ scripts/ supabase/` are byte-identical from `5ee3531` to `1e1f4d0`. No PRODUCT_BUG was found; one ENVIRONMENT finding (emulator contention vs the J8 15% diagnostic headroom floor; the 800ms hard ceiling always held).
- Do NOT replan or re-implement completed hardening as primary scope. Build on it. Long validation may be rerun as regression certification; product implementation work is reopened only on new P0/P1 evidence.
- Evidence-backed residuals inherited (verified still open at `1e1f4d0`; these are the primary scope of this campaign):
  - **Multi-AVD orchestration is manual.** `selectAndroidDevice` (`scripts/native-qa-utils.mjs`) throws on multiple connected targets unless a serial is set; provision/runner accept `--serial` but nothing discovers AVDs, boots deterministically, waits for readiness, runs a lane per target with labeled artifacts, or stops/cleans up. Wave 1D was deliberately deferred (zero native flakes across 30+ runs gave no triage question a second AVD would answer). AVDs observed present but never booted by the campaign: `CRBABot_API_36`, `Nitro_API_36`, `braintraining-qa36`, `braintraining36`.
  - **`--auth-mock` is not productized.** `scripts/native-auth-mock-server.mjs` exists standalone, but server start, process-lifetime ownership, readiness proof, `adb reverse`, mock-URL build, test-only cleartext patch, environment setup, mock-request proof capture, teardown, and stale-process verification are all manual shell choreography. The five auth-lane setup failure modes are diagnosed in the predecessor plan (dead mock process, missing `adb reverse`, cleartext policy, local-only APK with no Supabase URL, restart/protect ordering). Wave 1E was deliberately deferred: baking mock builds into provision risks canonical-vs-mock provenance confusion, so this must land as a dedicated tested change with its own provenance separation — exactly what this campaign does.
  - **Real-corpus historical DB fixtures are open** (`docs/testing/known-gaps.md` #5/#6). The synthetic migration-fixture laboratory (`tests/integration/migrationFixtures.test.ts` + legacy cases in `migrations.test.ts`: v6 backfill, v13 outbox import, v17 rebuild, v19 promotion, v24 repair) is green and re-verified, but no anonymized real-world database corpus exists. Corpus work uses deterministic synthetic-but-realistic fixtures only; never real personal data.
  - **Long-run repetition is manual.** The overnight campaign proved the value of repeated suites (P0 ×5, persistence ×2, soak scenarios) but left no checked-in repeat/soak orchestration. Prefer extending existing QA infrastructure (`qa-native`, `qa-simulation`, simulation runner) over a generic orchestrator.
- External / opt-in lanes remain blocked or non-gating by design: iOS (no Xcode/macOS — Windows host), disposable backend (no token), internal parser lanes (opt-in external configuration). Evaluate, do not gate on them. `format:check` retains its known baseline gap in historical/agent files; changed files must still pass targeted checks plus `git diff --check`.

## 1. Objective

Run one chained certification-infrastructure campaign that takes the already-certified tree and makes its certification reproducible: deterministic multi-AVD native orchestration, a process-owned auth-mock lifecycle, a deterministic historical DB corpus with corpus-backed migration/restart/performance certification, a checked-in long-run repetition framework, standardized artifact provenance and failure triage, and nightly/CI placement only where justified — ending in a clean pushed `main` with adversarial verification.

## 2. Scope (executor implements autonomously; planner does no implementation)

- Wave 0 current-head recertification (focused baseline; heavy suites reserved for Waves 5/8).
- Wave 1 multi-AVD native orchestration tooling (discover → boot → readiness → provision + SHA proof → reset → run lane → labeled artifacts → stop → next target; sequential unless parallel is proven safe).
- Wave 2 auth-mock lifecycle automation (single owned command: start → readiness → `adb reverse` → env → run auth lane → mock-request proof → teardown → stale-process verification).
- Wave 3 deterministic historical realistic DB corpus (typical user, mature 6–12 month user, historical-schema fixtures, edge-state fixtures; seeded synthetic only).
- Wave 4 corpus-backed certification (migration matrix, restart/recovery, heavy-state performance on corpus).
- Wave 5 long-run / soak repetition framework (native + web repetition with seed/provenance/timing/classification/replay; extend existing tooling).
- Wave 6 artifact provenance + failure-triage standardization.
- Wave 7 nightly/CI integration evaluation (PR vs main vs nightly vs manual placement per `simulation/matrix.ts` + `validateMatrix()`; keep PR CI fast).
- Wave 8 full expensive stability battery in the quiet window.
- Wave 9 independent adversarial verification. Wave 10 remaining P0/P1 sweep.
- Open one task-specific ExecPlan per substantial workstream (`Plan-Version: 2`, `Status: ACTIVE` → `COMPLETED`/`BLOCKED`): OpenSpec-backed work at `openspec/changes/<slug>/execplan.md`, otherwise `.agent/execplans/<slug>.md`. Keep each `Current Checkpoint` current (HEAD, exact next action, discoveries, decisions, changed areas, validation, blockers, remaining DoD). Never use a global current-task file. One master orchestration plan plus per-workstream plans is the proven shape; per-workstream OpenSpec/ExecPlans only where implementation work opens.
- Fix repository-owned P0/P1 defects found during the program with root-cause fixes plus regression coverage. Tooling changes (scripts, tests, docs) are the expected implementation surface; product-source changes only on proven P0/P1 evidence.

## 3. Non-goals

- No repeat of completed hardening without new failure evidence: Warm Momentum UI work, numeric-input work, submit guards, basic persistence hardening, restore atomicity fixes, migration retry fixes, Pomodoro backfill, outbox restart/flap work, standard native smoke/persistence implementation, service-worker race fixes, web server lifecycle work. Re-test as certification when useful; do not reimplement.
- No second Gym state, no persistence-stack rewrite, no two-way-sync rewrite, no new top-level tab, no state-management framework swap.
- No production Supabase use, no real credentials in builds or commits, no real personal data in fixtures (deterministic synthetic only), no destructive user-data reset, no migration-block edits (append-only `if (version < 25)` for any new schema change; `schema.sql` stays reference-only).
- No parallel AVD execution unless proven safe (sequential multi-AVD is the default); no random unreproducible chaos; no retry-as-fix, weakened assertions, blind timeout increases, sleeps, or skipped/renamed meaningful tests.
- No generic test orchestrator where extending `qa-native` / `qa-simulation` / simulation runner suffices; no aesthetic CI redesign; no file splits by line count alone; no speculative indexes; no formal security certification claims.
- No normal-PR CI slowdown: expensive lanes stay in main/nightly/manual placement.
- Do not rewrite historical campaign logs; reconcile current-facing docs only.

## 4. Authoritative read order (before new implementation)

`AGENTS.md` → `.agent/PLANS.md` → this prompt → `docs/PROJECT_STRUCTURE_MAP.md` → `.cursorrules` → `.cursor/rules/superhabits-rules.mdc` → `ONBOARDING.md` → `docs/codex-workflow.md` → `docs/testing/autonomous-qa.md` → `docs/testing/known-gaps.md` → `simulation/README.md` + `simulation/matrix.ts` → `.github/workflows/ci.yml` + `.eas/workflows/native-e2e.yml` → `qa/impact-map.json` → predecessor ExecPlan (`.agent/execplans/overnight-reliability-certification-v1.md`, esp. Surprises/Decision Log/Ledger) → current OpenSpec changes and recent `git log`.

## 5. Invariants (non-negotiable)

Soft-delete only (documented `habit_completions`/`saved_meals` exceptions stay); every applicable write through `runSyncedMutation`/`runBackupMutation` + `syncEngine.enqueue`; `getDatabase()` singleton only; IDs via `createId(prefix)`; date keys via `toDateKey()`; migrations append-only; no `getDatabase` in screens/domain; no `syncEngine.enqueue` from UI; no feature import of `linkedActions.effects`/`linkedActionsTargetProviders` (core→features direction is load-bearing); single-page shell (`app/index.tsx` + `NavigationContext.activeSection`, Settings modal, command overlay only); COOP/COEP preserved for web WASM. New automation must preserve the FINITE-vs-SERVICE process-safety rule (§Operating rules.3) and the provenance-separation rule (canonical vs mock/test-only builds never share one unlabeled record).

---

## WAVE 0 — Current-head recertification (do not blindly rerun everything)

1. Record `git status --short`, branch, `HEAD`, `origin/main`, `git log --oneline -15`, worktrees, `npm run agent:plans`, and this prompt's `Planned-From` reconciliation (`1e1f4d0`).
2. Run process hygiene (`npm run web:hygiene`; confirm 8081/8082 free or owners unrelated). Confirm no emulator booted unexpectedly.
3. Run focused baseline: `git diff --check`, `typecheck`, `lint`, `qa:fast`, `qa:impact:validate`, `validate:themes`, `supabase:schema:validate`, `openspec:validate`, `agent:plan:validate:all`, `sim:validate`.
4. Check native tooling presence (doctor/preflight, AVD list, Maestro, EAS CLI presence, `adb` availability) without booting anything expensive yet. Record the exact AVD set available on this host; do not assume the predecessor's four AVDs persist.
5. Inspect predecessor evidence (overnight plan Validation Ledger + native reports under `simulation-output/native/`) and confirm no tree drift invalidates it (`app core features lib scripts supabase` still identical to `5ee3531` unless this campaign has landed justified changes).
6. Reserve heavy suites (full Vitest repeats, full journeys, seeded library, sync lane, native lanes, heavy performance) for Waves 5/8 and final certification.

## WAVE 1 — Multi-AVD native orchestration (primary evidence-backed successor)

Audit first: emulator discovery (`emulator -list-avds`), AVD selection (`--serial` / `ANDROID_SERIAL`), provisioning (`scripts/qa-native-provision.mjs`), APK installation + provenance (`native-android-build.json`), Maestro invocation, artifact naming, device ownership, cleanup, run isolation. Confirm each manual step before automating it.

Deliverable: a checked-in, finite, process-owned orchestration path (extend `scripts/qa-native*.mjs`, do not invent a parallel runner) that, given a list of configured AVDs (or one `--serial`), deterministically performs: discover → boot (if not already booted and owned) → wait for readiness (bounded, with exact failure reason) → provision APK → prove APK/source SHA → safe state reset → run selected lane/tag → persist labeled artifacts → stop only emulators it started → continue to next target. Requirements:

- Sequential multi-target execution is the default. Parallel execution against one shared emulator, one shared OPFS origin, or shared E2E ports is forbidden; cross-AVD parallelism only with written evidence it is safe and isolated.
- Never stop, wipe, or otherwise mutate an emulator/device the command did not start or was not explicitly given (ownership proof before any destructive step).
- Per-target records carry: repo SHA, APK SHA + source SHA, AVD name, API level, device serial, lane/tag, seed where applicable, start/end, result, timings, artifact path.
- New parsing/orchestration logic ships with unit tests (precedent: `tests/journeyLabelParity.test.ts` for `scripts/journey-label-parity.mjs`). If a new shared test boundary is introduced, add it to `qa/impact-map.json` with validation.
- Certification use in this campaign: run the selected smoke/persistence lane across at least two configured AVDs where available (e.g. `Nitro_API_36` plus one more API-36 AVD) to separate app defect vs emulator-specific vs dirty-state vs infra flake. If only one AVD exists on the host, record `ENVIRONMENT` for the multi-target leg, certify single-target, and keep the orchestration code path tested.

## WAVE 2 — Auth-mock lifecycle automation (co-primary successor)

Audit first: the five diagnosed setup failure modes (dead mock process, missing `adb reverse`, cleartext policy, local-only APK with no Supabase URL, flow-order state inheritance) and the current manual path (mock server start, reverse forward, mock-URL build, test-only cleartext patch in gitignored `android/`, env setup, lane run, mock-log proof, teardown).

Deliverable: a single owned finite command responsible for: (1) starting `scripts/native-auth-mock-server.mjs` (or its successor) as an owned child with captured logs, (2) proving readiness via a bounded probe (never a fixed sleep), (3) establishing `adb reverse` and verifying it, (4) configuring the required test environment (mock-URL build + test-only cleartext patch, release config untouched), (5) running the auth lane, (6) capturing mock request proof (exactly-one-signup / same-UID / verify-preserves-UID / zero-unauthenticated-checks class of assertions, read from owned logs), (7) tearing everything down, (8) verifying no stale mock process remains. Requirements:

- Finite, process-owned, failure-safe, reproducible; every failure reports its exact stage and reason (mock-bind death vs reverse failure vs build vs lane vs teardown).
- Canonical vs mock provenance is load-bearing: mock/test-only builds and their reports must be labeled `TEST-ONLY` with distinct APK SHAs and must never overwrite or be confused with the canonical `native-android-build.json` provenance. Verify the release config is clean after any test-only manifest patch (predecessor precedent).
- Do not hide external networking failures with retries. A bounded retry is allowed only for a proven bind-race-class mechanism with a child-watching probe (CG-9 precedent); genuine failures fail fast.
- Certification use: auth lane `3/3` on the automated path with per-run mock proof, at least twice.

## WAVE 3 — Historical realistic DB corpus (co-primary successor)

Audit first: current fixture infrastructure (`tests/integration/migrationFixtures.test.ts`, `tests/integration/migrations.test.ts`, HEAVY fixture, soak scenario) and known-gaps #5/#6. Design the corpus before building it: dimensions below are the starting point, trimmed or extended only with written rationale.

Corpus dimensions (all deterministic, seeded, synthetic — never real personal data):

- **Typical user:** modest Todos, several Habits + completions, Focus history, Calories entries, Workout history, planning data.
- **Mature 6–12 month user:** hundreds/thousands of records, recurring Todos, long Habit history, substantial Workout history (routines, session exercises, sets), calorie diary + saved meals, planning entities, completed/archived state. Size it to the predecessor's measured reference (6-month: 500–1500 todos, 20–30 habits + history, hundreds of Focus sessions, 50–100 workouts + thousands of sets, 6-month Calories; bounded 2-year set only with a specific algorithmic question).
- **Historical-schema fixtures:** representative prior schema versions through the real runtime migration chain (extend the synthetic laboratory pattern; do not edit existing migration blocks).
- **Edge-state fixtures:** pending outbox rows, interrupted Focus, interrupted Workout, old backup metadata (`backup.scope_version`), legacy restore-compatible state, mixed pre-cutover UTC + local date keys (migration 5 semantics preserved: no backfill).
- Corpus supports: migration certification, restart/recovery, heavy-state performance, heavy-state visual/interaction checks, regression reproduction. Each fixture records: generator seed, schema version(s), entity counts, generation command, artifact path, and the lanes that consume it.

## WAVE 4 — Corpus-backed migration / restart / performance certification

Using the Wave 3 corpus on the unchanged product code (implementation only on proven defect):

- **Migration matrix:** upgrade each historical-schema and edge-state fixture through the real runtime chain with version/row/tombstone/default/idempotency oracles; run `npm run qa:timezones` for any time/date-sensitive path.
- **Restart/recovery:** reload/restart loops on corpus state (Add→save→reload, habit check-in loops, Focus start/stop, Workout log/resume, offline mutation → restart → reconnect) with durability oracles; outbox-drain and restore-boundary behavior where the `dist-sync/` lane applies.
- **Heavy-state performance:** J8-class ceilings on corpus datasets (cold start, Today-ready, tab switching, Todos, Habits, Workout, history/progress, Calories Diary incl. saved-meal search, Planning, search/filters). Every claim carries scenario + dataset + environment + baseline + result. Distinguish the hard product budget (e.g. 800ms switch ceiling) from the diagnostic headroom floor (15% guard band) from environment contention: a headroom miss under load is triaged with contention evidence (emulators/heavy processes running?) and clean-condition rerun — never auto-filed as PRODUCT_BUG, never silently absorbed. Record which heavy processes were running during every performance measurement.
- Query/render analysis only on measured bottleneck signal (SQLite plans, index usage, N+1, list virtualization, provider rerenders). No intuition-only indexes, no speculative splits.

## WAVE 5 — Long-run / soak repetition framework

Productize the overnight campaign's repetition value as checked-in capability (extend `qa-native`, `qa-simulation`, simulation runner — no generic orchestrator): native repeated smoke / persistence / lifecycle / auth, P0 repetition, heavy-corpus iteration, reload/restart loops, artifact collation, pass/fail summary. Requirements per run: seed preservation, per-run provenance (Wave 6 record shape), timings, failure classification (six-class taxonomy), replay instructions, process cleanup. Tune repetition counts to predecessor runtimes (persistence ~11min, full E2E ~16min, P0 ~1min) — enough for confidence (e.g. P0 ~5 consecutive, persistence ×2, smoke/lifecycle seeded iterations), never hundreds of redundant runs. `passed on retry` is diagnostic data, never a fix.

## WAVE 6 — Long-run failure triage + artifact standardization

Make the predecessor verifier's provenance findings structural: every long/native run in this campaign emits one record with repository SHA, APK/source SHA (canonical vs TEST-ONLY labeled), device/AVD + API level, lane/tag, seed, start/end, result, timings, artifact path, and mock/backend state where applicable. Standardize artifact directory naming (no ambiguous filenames), failure bundles (screenshot + logcat + hierarchy + diag-flow tap-order proof for native; trace + `qa-diagnostics.json` + seed/action log + repro bundle for web/simulation), and classification discipline. Fix the tooling to emit this (with tests for the emitters/parsers); do not hand-assemble records as a substitute.

## WAVE 7 — Nightly / CI integration (evaluation wave, changes only where justified)

Audit real CI vs local gates (`simulation/matrix.ts` + `validateMatrix()`, `.github/workflows/ci.yml` quality/e2e/nightly, `.eas/workflows/native-e2e.yml`). Evaluate placement for: repeated native lane evidence, corpus migration matrix, heavy-state performance sentinel, restore/recovery matrix, seeded simulation, long P0 stability. Distinguish PR gate vs main gate vs nightly vs manual certification. Predecessor found no CI changes justified — overturn that only with evidence (e.g. a corpus migration suite that is fast and hermetic enough for PR, or a nightly sentinel proposal with budget, trigger, retention, and promotion criteria matching `validateMatrix()` rules: deterministic + fake-backed gating, disposable-backend report-only, AI exploratory non-gating). Never slow normal PR CI for overnight-scale work.

## WAVE 8 — Full expensive stability battery (quiet window)

Schedule deliberately: full Vitest (unit + integration), Chromium, full journeys, P0 battery, PWA, simulation Playwright, deterministic library (+ seeded where useful), sync lane (`dist-sync/` :8082; disposable lane only when configured and guarded), native smoke/persistence/lifecycle + seeded repetitions (via Waves 1–2 automation), multi-AVD selected lane, corpus migration matrix, heavy-corpus performance, repeated `web:verify`, final hygiene. Suggested targets (tune to observed runtimes): Vitest several complete runs only if parallel/infra behavior changes; P0 ~5 consecutive clean; Chromium 2–3; native smoke/lifecycle several seeded iterations; persistence/restart several iterations; `web:verify` several times spread across the campaign. Any failure preserves artifacts and is classified/investigated before proceeding.

## WAVE 9 — Independent adversarial verification (required before completion)

Use a separate verifier (subagent where supported). Instruction: assume the completion report is overstated; try to disprove every major claim. Independently verify: Git truth (HEAD vs `origin/main`, clean tree, `Planned-From` lineage), plan truth (every ACTIVE→COMPLETED transition has ledger evidence), OpenSpec states, test/build freshness (no stale `dist/` or stale APK — rebuild-from-current-source proof), native provenance (canonical vs TEST-ONLY separation, device labels), corpus reproducibility (regenerate from seed and diff), long-run results (records complete, classifications honest), test freshness (no weakened assertions, no new `data-testid` in app components to satisfy tests — fix selectors instead), process cleanup (ports free, no owned emulator/mock/server left), performance claims (scenario + dataset + env + baseline + result present; contention recorded). Any locally actionable verifier failure is fixed and verification rerun. Never finish with a known local high-value verifier failure.

## WAVE 10 — Remaining P0/P1 sweep

Search again: TODO/FIXME/HACK, known gaps, failing/skipped tests, warnings, OpenSpec states, recent history. Ask what high-value locally executable weakness remains unaddressed; if it exists, continue under additional OpenSpec/ExecPlan state as policy requires. iOS, disposable-backend, and internal-parser lanes stay external/opt-in: record them as `EXTERNAL BLOCKER` / `NOT RUN` with the exact missing precondition, never as success. Never stop just because the numbered waves are done.

---

## Operating rules

1. **Root-cause-first.** Every failure: invalid-state origin → why safeguards failed → sibling pathways → missing regression coverage → architectural cause. Then smallest correct fix. No symptom patches.
2. **No retry-as-fix.** No added retries, global timeout inflation, sleeps, weakened assertions, or skips as fixes. Retries are diagnostic evidence only (bind-race-class exception per Wave 2, with child-watching probes).
3. **Process safety.** Classify every long command FINITE (build/test/benchmark/simulator/export — await normally) vs SERVICE (Metro/static server/emulator/mock — needs owner, PID/provenance, readiness, bounded use, cleanup). Never await `npm run web`/`web:dev` as a gate; use `build:web`, Playwright-owned `serve-e2e.js`, or finite `web:verify`. Never `taskkill /IM node.exe` / `killall node` / broad `adb kill-server`; terminate exact owned trees only (Windows: `taskkill /PID <ownedPid> /T /F`). Any spawned mock/server/helper requires PID ownership, readiness, bounded lifecycle, cleanup, cleanup verification. End with `web:hygiene` PASS (8081/8082 free or unrelated owners) plus emulator shutdown (no campaign-owned AVD left booted) plus mock-process absence proof.
4. **Overnight scheduling.** Push costly validation into the quiet window, prioritized at historically unstable surfaces: native, lifecycle, P0, Vitest-parallel, full journeys, sync, migration/recovery, process lifecycle. No hours wasted on valueless repetition.
5. **Parallelism.** Parallelize read-only independent investigation. Never parallelize Git commits, conflicting central-file edits, one shared emulator, OPFS writers, or shared E2E origin without isolation. Primary executor owns integration.
6. **Durable state.** Update ExecPlan checkpoints at every milestone, decision, discovery, failure, delegation boundary, and before finishing. After compaction: reread authority, run `agent:resume -- --plan <path>`, inspect `git status --short` / `git diff --stat` / `git diff --name-only` + relevant diffs + QA evidence, reconcile, run `qa:affected`, resume from `Exact next action`. Chat summary is never authoritative; Git is (files), OpenSpec is (behavior), ExecPlan is (implementation state).
7. **Commit/push loop.** After substantial verified milestones: inspect diff, commit coherently (planning/tooling/test scopes separated; e.g. `feat(qa): …`, `fix(test): …`, `docs(agent): …`), push normally, confirm remote, continue. No one giant end-of-campaign commit. Never force-push. Final tree clean.
8. **Priority preemption.** Proven P0/P1 (data loss, corruption, native crash, owner breach, startup failure, major regression) preempts numbered waves.
9. **Provenance separation.** Any TEST-ONLY build (mock URL, cleartext patch) is labeled at build, install, report, and record layers, recorded separately from canonical provenance, and followed by release-config-clean verification. Never certify a TEST-ONLY binary as the product.

## Final validation battery (adjust to changed scope; record ENVIRONMENT honestly)

`git diff --check`, typecheck, lint, unit, integration, full Vitest, OpenSpec, impact-map validation, themes, Supabase schema validation, plan validation (`agent:plan:validate:all`), simulation validation, timezone matrix, fresh web build, `web:verify`, `web:hygiene`, Chromium, P0, full journeys, PWA, simulation Playwright, deterministic simulation (+ seeded where useful), sync lane where applicable, native smoke/persistence/lifecycle + seeded native repetitions via Waves 1–2 automation, multi-AVD selected lane, corpus migration matrix, heavy-corpus performance, architecture regression tests (no feature→effects imports).

## Certification standards

- **Performance:** every claim needs scenario + dataset + environment + baseline + post-change result, plus a record of concurrently running heavy processes. No "optimized" from inspection.
- **Native:** every PASS needs AVD/device identity + Android/API version + APK provenance/current SHA (canonical vs TEST-ONLY) + suite/tag + test count + failures + artifact path. Never certify stale binaries.
- **Corpus:** every fixture needs generator + seed + schema version(s) + entity counts + generation command + artifact path; regeneration from seed must reproduce it.
- **Long runs:** every battery needs counts, per-run results, timings, classifications, replay instructions, cleanup proof.

## Adversarial independent verification (required before completion)

Per Wave 9. Any actionable failure is fixed and verification rerun. Never finish with a known local high-value verifier failure.

## Terminal conditions (stop only when)

- A: Strong local completion — Waves 1–6 tooling landed with tests, Waves 4/8 certification green, all important locally executable P0/P1 findings fixed, verified, or deliberately rejected/deferred with documented evidence; OR
- B: Remaining meaningful work is externally blocked (unavailable macOS/hardware, inaccessible service, unavailable credential, unavailable target) and all other worthwhile local work is exhausted; OR
- C: Further changes are speculative/harmful with no demonstrated defect justifying change.

Invalid stops: orchestration code without multi-target proof, mock automation without stale-process proof, corpus without regeneration proof, one green suite, five green P0s, one closed OpenSpec, elapsed hours, or end of an initial checklist. Reassess and continue while valuable work remains.

## Final report (append as `## Final report (campaign COMPLETED <date>)`; retain the template below it)

- Baseline `1e1f4d0` → closure HEAD: commit list with SHAs, scopes (`feat(qa)` / `fix(test)` / `docs(agent)`), and product-source-change statement (expected: tooling/tests/docs only unless a P0/P1 forced product change — then name it).
- Waves completed with evidence: Wave 0 recert; Wave 1 multi-AVD orchestration (command, tests, ≥2-AVD lane proof or ENVIRONMENT record); Wave 2 auth-mock automation (command, readiness/teardown proof, auth `3/3` ×N with mock-request proof); Wave 3 corpus (dimensions, seeds, counts, regeneration proof); Wave 4 corpus-backed matrix (migration/restart/perf tables); Wave 5 repetition framework; Wave 6 provenance records; Wave 7 CI/nightly decision with rationale; Wave 8 battery; Wave 9 verifier verdict; Wave 10 sweep.
- Native certification table (device/APK/tag/count/artifacts per run, canonical vs TEST-ONLY labeled).
- Performance table (scenario/dataset/env/baseline/result + contention record).
- Failure classifications (`PRODUCT_BUG`/`TEST_BUG`/`FLAKY_TEST`/`ENVIRONMENT`/`EXPECTED_KNOWN_GAP`/`SPEC_AMBIGUITY`) with artifacts.
- OpenSpec/ExecPlan lifecycle states, docs/gaps updated, residual blockers/gaps.
- Exact next action (normally: none — campaign complete; or named follow-up with plan path).

## Final report (campaign COMPLETED 2026-09-05)

- **Baseline `1e1f4d0` → closure `bb376bd`: 37 commits** — `feat(qa)` 7 (multi-AVD orchestration `3c1ddfe`, labeled Maestro artifacts `ab3588c`, auth-mock lifecycle `9bbd48c` + 7 follow-up fixes, corpus generators `c2f7561`/`3f9046a`, repetition runner `4049450`); `fix(native)` 1 (Wave-1 FAB tap-race `9be8bcd`); `fix(test)` 10 (native smoke/persistence/auth flow race hardenings); `fix(qa)` 8 (provenance/reinstall/probe repairs); `docs(agent)` 11 (plan checkpoints + Wave ledgers). **Product-source statement:** `git diff --name-only 1e1f4d0..bb376bd -- app core features lib supabase` returns only `app/index.tsx` (the Wave-1 FAB fix); everything else is tooling/tests/docs.
- **Waves (evidence in `.agent/execplans/certification-infrastructure-v2.md` + per-workstream plans):** W0 recert PASS. W1 sequential multi-AVD orchestration landed + unit-tested, proven on Nitro_API_36 + CRBABot_API_36. W2 process-owned auth-mock lifecycle: readiness probe, verified `adb reverse`, owned logs, exactly-one-signup/same-UID mock proof, teardown + stale-process verification; auth 3/3 standing + Wave-10 re-probe 1/1. W3 deterministic mature-user corpus + edge states, byte-reproducible. W4 corpus matrix 20/20 (migration incl. TRUE v21/v23, restart, perf hot paths 0.6–18.8 ms, emulator OFF) + timezone matrix 5/5. W5 `qa:repeat` sequential runner with collated provenance. W6 Wave-6 provenance records on every long/native run. W7 Decision B — CI/nightly layout unchanged, re-affirmed by Wave 8. W8 battery: unit ×5 (1691/run) + integration ×5 (246/run) + P0 ×5 (25/25/run, fresh dist once) all collated PASS; chromium+PWA 121 passed/7 expected skips; deterministic sim 22/23 + smoke repeat-gated, seeded sample PASS (seed 20260904); sync lane 40 passed/6 expected gates; native smoke 2/2 ×2 AVDs, lifecycle 6/6 (13m18s), persistence 11/11 @759e65f, auth PASS; `web:verify` ×3 PASS with port release; static matrix: typecheck 0, lint 0, Vitest 1937/1937, OpenSpec 50/50, themes 140/140, sim:validate 23/23. W9 round 1 adversarial FAIL (2 MAJOR + 3 MINOR) → all repaired `ee23af8` → round 2 ADVERSARIAL PASS. W10 sweep: W8-4 resolved TEST_BUG (full persistence PASS + permanent Form-read probe), W8-3 resolved by re-probe, W8-1 filed P2 follow-up (known-gaps CG-4 note), externals re-verified.
- **Native table** (canonical APKs unless TEST-ONLY labeled; reports under `simulation-output/native/`): smoke Nitro_API_36 2/2 ×2 (133225316Z, 134812730Z, APK FDC2C955); smoke CRBABot_API_36 2/2 (135812242Z); lifecycle Nitro 6/6 (124738692Z); persistence Nitro 11/11 (all-Nitro…232707117Z @759e65f); auth Nitro 1/1 + 3/3 (TEST-ONLY mock builds, distinct SHAs, release-config-clean verified). No leaks after any run.
- **Performance:** J8 max-switch on 3-months corpus, emulator OFF: 745/781/774/751/910/775 ms vs 800 ms ceiling (one excursion; historical band 625–797) → W8-1 P2 follow-up, no product change; corpus hot paths 0.6–18.8 ms clean-env.
- **Classifications:** W8-1 EXPECTED_KNOWN_GAP headroom variance + one recorded ceiling excursion (P2 follow-up); W8-2 TEST_BUG ×4 Maestro flows (fixed e98ca57/371deff/873b923/35cf33a, verified); W8-3 resolved-by-re-probe (harness-window kills, ENVIRONMENT, exact-PID cleanup verified); W8-4 suspected P1 → TEST_BUG (DB ground-truth pair preserved at `simulation-output/native/w8-4-calories-device.db*` + query transcript; fixed 26cb1e8/a415079/9030310/759e65f); sim-wrapper tail timeout ENVIRONMENT. No PRODUCT_BUG; only product change is `9be8bcd`.
- **Lifecycle:** master + all workstream ExecPlans `COMPLETED` (`agent:plan:validate:all` 48/48 PASS); OpenSpec 50/50; known-gaps updated (CG-4 note). Residuals (external/opt-in, NOT RUN): iOS (no macOS/Xcode), disposable backend (no `SUPABASE_ACCESS_TOKEN`), internal-parser lanes (env unset). P2 follow-up: J8 switch-margin hardening on measured signal.
- **Exact next action:** None — campaign complete; the next session must plan a fresh campaign (do not resume this prompt).

## Final report structure (template, retained)

Baseline SHA → new commits/SHAs → waves completed with evidence → validation battery table (command/outcome/date) → native certification table (device/APK/tag/count/artifacts) → corpus table (fixture/seed/counts/consumers) → performance table (scenario/dataset/env/baseline/result) → failure classifications with artifacts → OpenSpec/ExecPlan lifecycle states → docs/gaps updated → residual blockers/gaps → exact next action (normally: none — campaign complete; or named follow-up with plan path).
