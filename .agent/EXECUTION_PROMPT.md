# Super Habits Overnight Reliability & Real-World Certification Program V1

**Status:** COMPLETED
**Planned-From:** `5ee35318dd3a932c6aa6cdaf2553080cd19fa3c2`
**Target branch:** `main`
**Campaign:** Super Habits Overnight Reliability & Real-World Certification Program V1
**Subtitle:** Native Stability → Soak & Chaos → Heavy-State Performance → Test/CI Determinism → Architecture Hardening → Whole-Product Certification

---

## 0. Planner baseline (authoritative, verified 2026-09-04)

- `HEAD == origin/main == 5ee35318dd3a932c6aa6cdaf2553080cd19fa3c2` (`5ee3531`), branch `main`, tree clean, single worktree, no other local/remote branches.
- `.agent/EXECUTION_PROMPT.md` before this plan was `Status: COMPLETED` (planned-from `2a13a31...`, gym-convergence campaign). `.agent/PLANNER_HANDOFF.md` is routing-only. `npm run agent:plans` shows all plans `COMPLETED`.
- Predecessor `openspec/changes/harden-production-persistence-recovery-v1/execplan.md` is `COMPLETED` with strong closing evidence: typecheck 0, lint 0, unit `1665/1665`, integration `241/241`, OpenSpec `50/50`, P0 `25/25`, full E2E `241`, `web:verify` PASS, native `11/11` (API-36 x86_64, `Nitro_API_36`, provision PASS ×5, smoke 2/2, persistence 11/11, lifecycle gym flow green, web workout-gym-v2 7/7).
- Do NOT replan or re-implement that hardening work as primary scope. Build on it. Long validation may be rerun as regression certification; implementation work is reopened only on new evidence.
- Known residual items inherited (do not assume fixed; verify, do not re-litigate without evidence):
  - 1-in-5 `portableExportImport` infra flake (`appMetaKeys` undefined in fresh client import), classified `FLAKY_TEST` infrastructure, mechanism unidentified, evidence in hardening tasks §8.2.
  - Auth-lane Maestro inputs share the tap-target ambiguity class (explicit labels or proven index taps; unverified lanes).
  - One-off >30s emulator cold starts (no action needed unless pattern changes).
  - Synthetic migration-fixture matrix is green; real-corpus legacy DB proof remains open (known-gaps #5/#6).
  - `format:check` has a known baseline gap in historical/agent files; changed files must still pass targeted checks plus `git diff --check`.

## 1. Objective

Run one chained overnight reliability program that takes the already-hardened tree and proves it under real-world conditions: repeatable native lanes, long soak and chaos repetition, heavy-state performance with measured evidence, full test/CI determinism, bounded architecture hardening for issues the evidence actually reveals, and whole-product certification across personas — ending in a clean pushed `main` with adversarial verification.

## 2. Scope (executor implements autonomously; planner does no implementation)

- Native lane stability first (auth, lifecycle, seeded repetition, multi-AVD triage, playbook automation), then long native soak, heavy-state native certification, long-horizon lifecycle, soak/chaos, heavy-state performance, test determinism, clean-env/build certification, CI hardening, architecture hardening, whole-product personas, a11y/input regression, security/data-safety review, docs/DX truth audit, final P0/P1 sweep.
- Open one task-specific ExecPlan per substantial workstream (`Plan-Version: 2`, `Status: ACTIVE` → `COMPLETED`/`BLOCKED`): OpenSpec-backed work at `openspec/changes/<slug>/execplan.md`, otherwise `.agent/execplans/<slug>.md`. Keep each `Current Checkpoint` current (HEAD, exact next action, discoveries, decisions, changed areas, validation, blockers, remaining DoD). Never use a global current-task file.
- Fix repository-owned P0/P1 defects found during the program with root-cause fixes plus regression coverage.

## 3. Non-goals

- No repeat of completed Production Hardening V1 implementation without new failure evidence.
- No second Gym state, no persistence-stack rewrite, no two-way-sync rewrite, no new top-level tab, no state-management framework swap.
- No production Supabase use, no real credentials in builds or commits, no destructive user-data reset, no migration-block edits (append-only `if (version < 25)` for any new schema change; `schema.sql` stays reference-only).
- No random unreproducible chaos, no retry-as-fix, no weakened assertions, no blind timeout increases, no skipped/renamed meaningful tests.
- No aesthetic CI redesign, no file splits by line count alone, no speculative indexes, no formal security certification claims.
- Do not rewrite historical campaign logs; reconcile current-facing docs only.

## 4. Authoritative read order (before new implementation)

`AGENTS.md` → `.agent/PLANS.md` → this prompt → `docs/PROJECT_STRUCTURE_MAP.md` → `.cursorrules` → `.cursor/rules/superhabits-rules.mdc` → `ONBOARDING.md` → `docs/codex-workflow.md` → `docs/testing/autonomous-qa.md` → `docs/testing/known-gaps.md` → `simulation/README.md` + `simulation/matrix.ts` → `.github/workflows/ci.yml` + `.eas/workflows/native-e2e.yml` → `qa/impact-map.json` → hardening ExecPlan + tasks/design (`openspec/changes/harden-production-persistence-recovery-v1/`) → `.agent/execplans/production-gym-convergence-and-real-world-certification-v1.md` → current OpenSpec changes and recent `git log`.

## 5. Invariants (non-negotiable)

Soft-delete only (documented `habit_completions`/`saved_meals` exceptions stay); every applicable write through `runSyncedMutation`/`runBackupMutation` + `syncEngine.enqueue`; `getDatabase()` singleton only; IDs via `createId(prefix)`; date keys via `toDateKey()`; migrations append-only; no `getDatabase` in screens/domain; no `syncEngine.enqueue` from UI; no feature import of `linkedActions.effects`/`linkedActionsTargetProviders` (core→features direction is load-bearing); single-page shell (`app/index.tsx` + `NavigationContext.activeSection`, Settings modal, command overlay only); COOP/COEP preserved for web WASM.

---

## WAVE 0 — Current-head recertification (do not blindly rerun everything)

1. Record `git status --short`, branch, `HEAD`, `origin/main`, `git log --oneline -15`, worktrees, `npm run agent:plans`, and this prompt's `Planned-From` reconciliation.
2. Run process hygiene (`npm run web:hygiene`; confirm 8081/8082 free or owners unrelated).
3. Run focused baseline: `git diff --check`, `typecheck`, `lint`, `qa:fast`, `qa:impact:validate`, `validate:themes`, `supabase:schema:validate`, `openspec:validate`, `agent:plan:validate:all`, `sim:validate`.
4. Check native tooling presence (doctor/preflight, AVD list, Maestro, EAS CLI presence) without booting anything expensive yet.
5. Inspect hardening evidence (ledger §8 + native 11/11 report) and confirm no tree drift invalidates it.
6. Reserve heavy suites (full Vitest repeats, full journeys, seeded library, sync lane, native lanes, heavy performance) for Waves 2/7/8 and final certification.

## WAVE 1 — Native lane stability V1 (first evidence-backed successor)

Audit and stabilize: `scripts/qa-native*.mjs`, `.maestro/config.yaml`, `.maestro/flows/` (27 flows), Android helpers, emulator provisioning, APK/source provenance, account/auth setup, data reset, lifecycle tags, reports under `simulation-output/native/`.

### 1A — Native auth stability

Exercise anonymous/local-only startup; configured-Supabase auth only where safe with test fixtures; owner binding, stale auth, lost session, restart, recovery paths where infrastructure permits. Remove nondeterministic dependence on prior emulator state, auth persistence, env vars, remote timing, old databases. Build deterministic setup. Never depend on real production state.

### 1B — Native lifecycle

Repeatedly exercise tagged scenarios: launch, background, foreground, terminate, restart, Android back, process death where tooling permits (orientation only if relevant). Verify Focus, Workout, Quick Capture, pending mutations, modal state, settings persistence.

### 1C — Seeded native repetition

Use deterministic seeds/personas where supported. Run multiple iterations. Record pass/fail counts with exact tag, emulator, APK SHA/provenance, seed, artifact path, classification. `passed on retry` is diagnostic data, never a fix.

### 1D — Multi-AVD stability

If the API-36 AVD set is still present and safe, run provisioning/tests across more than one AVD to separate app defect vs emulator-specific vs dirty-state vs infra flake. Do not parallelize device operations against one shared emulator or where device-ownership rules prohibit it.

### 1E — Triage-playbook automation

Use the hardening §7 evidence-first playbook (screenshot + logcat + hierarchy + diag-flow tap-order proof). Improve tooling only where recurring manual work is proven: exact classification, artifact bundle, APK SHA, source SHA, emulator identity, retry/replay command, seed, prior state. No redundant tooling for scope.

## WAVE 2 — Long-run native soak & lifecycle certification

After baseline stability, use the quiet window for bounded repetition: smoke ×N, persistence ×N, lifecycle ×N, critical journey × repeated seeds, terminate/relaunch loops, Add/Save/Restart cycles. Tune N to runtime/value (no hundreds of redundant runs). Watch for leaks, stale state, duplicate listeners, flaky selectors, keyboard timing, lifecycle races, emulator pollution, runtime growth.

## WAVE 3 — Native heavy-state certification

Reuse/create deterministic mature-user fixtures where supported. Exercise Todos, Habits, Workout history, Calories Diary, Planning, Today under realistic history. Verify scroll, virtualization, responsiveness, memory behavior, interaction latency, modal and keyboard behavior. Never assume web performance implies Android performance.

## WAVE 4 — Long-horizon lifecycle certification

Deepen (don't redo) the hardening persistence/recovery foundation with accelerated deterministic simulation (never literal real-time waits): repeated daily startup/shutdown, dozens/hundreds of launches, Focus sessions over simulated days, Workout/Habit history growth, recurrence, notification scheduling paths, date changes, month/year boundaries, timezone matrix (`npm run qa:timezones` for any time/date change).

## WAVE 5 — Soak / chaos reliability V1

Build bounded reproducible repeated-operation scenarios: create/edit/complete/reload loops, Add→save→reload, habit check-in loops, Focus start/stop, Workout log/resume, Calories log/edit/delete, tab switching, modal open/close, offline mutation loops. Every scenario preserves seed, operation sequence, evidence, replay capability. Hunt duplicated state, monotonic memory, leaked timers, stale listeners, focus corruption, queue growth, slowdowns. No unreproducible randomness.

## WAVE 6 — Heavy-state performance V2

Deeper than prior structural passes, on mature datasets (e.g. 6-month: 500–1500 todos, 20–30 habits + 6-month history, hundreds of Focus sessions, 50–100 workouts + thousands of sets, 6-month Calories; plus a bounded larger 2-year set). No absurd millions-row sets without a specific algorithmic question. Measure cold start, Today-ready, tab switching, Todos, Habits, Workout, history/progress, Calories Diary, Planning, search, filters — each claim with scenario + dataset + environment + baseline + post-change result.

### 6A — Query analysis

Use SQLite query plans, bounded-query evidence, index usage, N+1 inspection, repeated-aggregation checks on real hot paths. No intuition-only indexes.

### 6B — Render analysis

Inspect mounted-section costs, list virtualization, chart recalculation, provider rerenders, repeated fetches, large computed arrays. Optimize measured bottlenecks only.

### 6C — Memory/resource soak

Where tooling permits, run repeated navigation/use loops and check for monotonic non-stabilizing growth. Never claim a leak from high-but-stable usage.

## WAVE 7 — Test determinism & long-suite certification

Schedule the expensive lanes deliberately in the quiet window: full Vitest, integration, Chromium, full journeys, P0, PWA, simulation Playwright, deterministic library, timezone matrix, sync lane, native suites, heavy-data performance.

### 7A — Repeated Vitest

Several complete runs after any parallel/infra change. On instability investigate port races, timeout scaling, pollution, fake timers, process leakage, shared artifacts. No global retries.

### 7B — P0 battery

Target ~5 consecutive clean `e2e:journeys:p0` runs if runtime allows. Any failure preserves artifacts and gets classified/investigated.

### 7C — Full journeys overnight

Run the full journey lane (not P0-only) at least once in the quiet window; investigate historical-state, long-session, recurrence, data-heavy, failure flows.

### 7D — Sync/remote-boundary suite

Using safe dummy/test infrastructure only (`dist-sync/` on :8082; disposable lane only when configured and guarded): retry, reconnect, restore, ownership, dummy-backend failures. Never connect to production for certification.

### 7E — Simulation

Run deterministic library, seeded modes where useful, repeated selected scenarios, long-horizon personas (including `soak-sustained-use` acceptance: two clean fresh-state runs, oracles green, no late-sequence latency growth). Preserve seeds/repro artifacts; investigate divergence.

## WAVE 8 — Clean-environment / build-artifact certification

Verify resistance to stale output (the predecessor caught stale `dist/`): clean current-HEAD export, fresh static artifacts, fresh E2E on those artifacts, current-source native provenance. No casual dependency-cache destruction or user-config damage.

### 8A — Fresh-install reproducibility

Where valuable: verify Node/npm versions, clean install in an isolated location or safe mode, build, focused tests. No repeated reinstalls without engineering value.

## WAVE 9 — CI / automation hardening V1

Audit real CI vs local gates (quality/main-PR/nightly/native workflows, `simulation/matrix.ts` + `validateMatrix()`). Look for skipped lanes, redundant expensive work, stale artifacts, conditional bugs, hidden retries, missing failure artifacts, insufficient timeouts, unsafe concurrency. Fix evidence-backed issues only.

### 9A — Nightly strategy

Evaluate long-test placement (full journeys, seeded simulation, heavy sentinel, long native repetition, restore/migration matrix). Keep overnight-scale work out of every-PR waits; use lane separation.

## WAVE 10 — Architecture hardening V2 (evidence-led, not a rewrite)

Audit only architecture the campaign's evidence implicates: Habits↔Linked-Actions coupling, giant DB client/migration file, backup/restore ownership, provider side effects, test-infra duplication, native/web boundaries.

### 10A — Linked-Actions/Habits require cycle

Build the real runtime dependency graph. Determine whether the coupling is harmless type-level, an init hazard, maintenance smell, or bug source. Safe resolutions only (neutral contracts, type-only imports, dependency inversion, split event creation from effect execution). No gratuitous event framework. If no real risk, document evidence and leave code alone. Never let a feature import `linkedActions.effects`/`linkedActionsTargetProviders`.

### 10B — Side-effect ownership

Audit intervals, listeners, SW registration, NetInfo, AppState, notification subscriptions, module-scope clients, command global listeners. Prove cleanup with repeated mount/reload scenarios.

### 10C — Hot-module review

Split only modules where size/coupling causes demonstrated risk to correctness, testability, lifecycle ownership, reliability, or maintenance.

## WAVE 11 — Whole-product real-world certification V2 (personas)

- A: New user from empty state (first launch, Todo, Habit, Focus, Calories, Workout, planning, restart).
- B: Everyday returning user, normal seeded state, full realistic day.
- C: Mature power user on heavy history (filters, edits, history, plans, analytics, repeated entry).
- D: Offline commuter (online → offline work → offline restart → reconnect; verify durability).
- E: Recovery user on supported backup/recovery test paths (do not redo the disaster-recovery campaign; focus on journey + messaging).

## WAVE 12 — Accessibility / input / keyboard regression audit

Confirm WM2.3 input-primitive gains hold: screen-reader labels, selected/disabled/required states, inline errors, modal focus, hidden interactive content, large text, touch targets (44px practical minimum precedent), keyboard navigation, Android keyboard interaction, Back behavior.

## WAVE 13 — Security / data-safety review V2

Proportionate review of new/recent code: process helpers, native automation commands, shell invocation, argument validation, owner binding, backup/restore boundaries, client env exposure, test credentials, logs. Never commit credentials; never weaken ownership checks to simplify tests; no formal-certification claims.

## WAVE 14 — Documentation & DX truth audit

Reconcile current-facing docs after implementation stabilizes: SHA/campaign docs, schema version (24 unless a new migration lands), test commands, native provisioning, server lifecycle, Today terminology, Add/Command behavior, known gaps. Counts are point-in-time — verify with `npx vitest list` / `npx playwright test --list` before documenting. Never rewrite historical logs.

## WAVE 15 — Remaining P0/P1 sweep

Search again: TODO/FIXME/HACK, known gaps, failing/skipped tests, warnings, OpenSpec states, recent history, external-evidence items. Ask what high-value locally executable weakness remains unaddressed; if it exists, continue under additional OpenSpec/ExecPlan state as policy requires. Never stop just because the numbered waves are done.

---

## Operating rules

1. **Root-cause-first.** Every failure: invalid-state origin → why safeguards failed → sibling pathways → missing regression coverage → architectural cause. Then smallest correct fix. No symptom patches.
2. **No retry-as-fix.** No added retries, global timeout inflation, sleeps, weakened assertions, or skips as fixes. Retries are diagnostic evidence only.
3. **Process safety.** Classify every long command FINITE (build/test/benchmark/simulator/export — await normally) vs SERVICE (Metro/static server/emulator — needs owner, PID/provenance, readiness, bounded use, cleanup). Never await `npm run web`/`web:dev` as a gate; use `build:web`, Playwright-owned `serve-e2e.js`, or finite `web:verify`. Never `taskkill /IM node.exe` / `killall node`; terminate exact owned trees only. End with `web:hygiene` PASS (8081/8082 free or unrelated owners).
4. **Overnight scheduling.** Push costly validation into the quiet window, prioritized at historically unstable surfaces: native, lifecycle, P0, Vitest-parallel, full journeys, sync, migration/recovery, process lifecycle. No hours wasted on valueless repetition.
5. **Parallelism.** Parallelize read-only independent investigation. Never parallelize Git commits, conflicting central-file edits, one shared emulator, OPFS writers, or shared E2E origin without isolation. Primary executor owns integration.
6. **Durable state.** Update ExecPlan checkpoints at every milestone, decision, discovery, failure, delegation boundary, and before finishing. After compaction: reread authority, run `agent:resume -- --plan <path>`, inspect `git status --short` / `git diff --stat` / `git diff --name-only` + relevant diffs + QA evidence, reconcile, run `qa:affected`, resume from `Exact next action`. Chat summary is never authoritative; Git is (files), OpenSpec is (behavior), ExecPlan is (implementation state).
7. **Commit/push loop.** After substantial verified milestones: inspect diff, commit coherently, push normally, confirm remote, continue. No one giant end-of-campaign commit. Never force-push.
8. **Priority preemption.** Proven P0/P1 (data loss, corruption, native crash, owner breach, startup failure, major regression) preempts numbered waves.

## Final validation battery (adjust to changed scope; record ENVIRONMENT honestly)

`git diff --check`, typecheck, lint, unit, integration, full Vitest, OpenSpec, impact-map validation, themes, Supabase schema validation, plan validation, simulation validation, timezone matrix, fresh web build, `web:verify`, `web:hygiene`, Chromium, P0, full journeys, PWA, simulation Playwright, deterministic simulation (+ seeded where useful), sync lane where applicable, native smoke/persistence/lifecycle + seeded native repetitions, mature-data performance scenario, architecture regression tests.

Suggested overnight repetition (targets, not rigid mandates): Vitest 5–10 complete runs if parallel behavior changes; P0 ~5 consecutive clean; Chromium 2–3; critical native smoke/lifecycle several seeded iterations; critical persistence/restart journey several iterations; `web:verify` several times spread across the campaign.

## Certification standards

- **Performance:** every claim needs scenario + dataset + environment + baseline + post-change result. No "optimized" from inspection.
- **Native:** every PASS needs AVD/device identity + Android/API version + APK provenance/current SHA + suite/tag + test count + failures + artifact path. Never certify stale binaries.

## Adversarial independent verification (required before completion)

Use a separate verifier (subagent where supported). Instruction: assume the completion report is overstated; try to disprove every major claim. Independently verify Git, plan truth, OpenSpec, test/build freshness, native provenance, counts, performance evidence, server hygiene, remaining P0/P1. Any actionable failure is fixed and verification rerun. Never finish with a known local high-value verifier failure.

## Terminal conditions (stop only when)

- A: Strong local completion — all important locally executable P0/P1 findings fixed, verified, or deliberately rejected/deferred with documented evidence; OR
- B: Remaining meaningful work is externally blocked (unavailable macOS/hardware, inaccessible service, unavailable credential, unavailable target) and all other worthwhile local work is exhausted; OR
- C: Further changes are speculative/harmful with no demonstrated defect justifying change.

Invalid stops: native stability alone, one green suite, five green P0s, one closed OpenSpec, elapsed hours, or end of an initial checklist. Reassess and continue while valuable work remains.

## Final report (campaign COMPLETED 2026-09-04)

- Baseline `5ee3531` → closure HEAD (this commit): 8 commits, all
  `docs(agent)` / `fix(test)`; zero product-source changes
  (`app core features lib scripts supabase` untouched).
- Waves: Wave 0 recert green; Wave 1 native stability (provision/smoke
  2/2/persistence 11/11/lifecycle 6/6 canonical + auth 3/3 x3 mock with
  1-signup/same-UID proof; 2 TEST_BUG flow fixes); Wave 2 soak (no
  growth); Waves 5–6 soak scenario + J8 ceilings with margin;
  Wave 7 full batteries (Vitest 1906/1906, P0 25/25 x5, E2E 198/43/0,
  sim 23/23, seeded sample, sync 40/46); Waves 8–9 fresh builds +
  CI parity incl. deno; Wave 10 no-cycle proof, no change;
  Waves 11–15 personas/a11y/security/docs/sweep clean.
- Failures: 1 ENVIRONMENT (emulator contention vs J8 15% headroom
  floor; 701/691ms vs 642ms clean; 800ms ceiling always held) +
  auth-lane setup/test issues (fixed at test layer). No PRODUCT_BUG.
- Native cert: Nitro_API_36/API36/x86_64/emulator-5554; canonical APK
  0E20EB1F @c00d6eb; mock APK 44B632BE (TEST-ONLY, release config
  verified clean after); reports under `simulation-output/native/`.
- Perf: J8 cold 544/5000, maxSwitch 642/800, diary 318/500, picker
  108/500 (emulator off); portable-large 18k rows export 742ms.
- Residual/external: iOS (no Xcode), disposable-backend (no token),
  internal-parser lanes (opt-in), real-corpus DB fixtures (open),
  multi-AVD + `--auth-mock` automation (deferred follow-ups).
- Exact next action: None — campaign complete. Next executor: normal
  goal workflow or a newly planned prompt; do not resume this one.

## Final report structure (template, retained)

Baseline SHA → new commits/SHAs → waves completed with evidence → validation battery table (command/outcome/date) → native certification table (device/APK/tag/count/artifacts) → performance table (scenario/dataset/env/baseline/result) → failure classifications (`PRODUCT_BUG`/`TEST_BUG`/`FLAKY_TEST`/`ENVIRONMENT`/`EXPECTED_KNOWN_GAP`/`SPEC_AMBIGUITY`) with artifacts → OpenSpec/ExecPlan lifecycle states → docs/gaps updated → residual blockers/gaps → exact next action (normally: none — campaign complete; or named follow-up with plan path).
