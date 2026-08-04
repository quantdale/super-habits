## ADDED Requirements

### Requirement: Declarative persona model

The platform SHALL provide typed persona definitions in `simulation/personas/` via a `definePersona()` builder. A persona SHALL declare: name, description, behavior parameters (think-time distribution, mistake rate, session-length profile, feature affinity), and the goals it pursues. Personas SHALL be consumable unchanged by every execution lane (scenario runner, AI exploratory lane, repro replay).

#### Scenario: A persona is defined once and referenced by name

- **WHEN** a scenario, an AI mission, and a repro replay all reference the persona `power-user`
- **THEN** all three resolve the same definition from `simulation/personas/`, and changing the definition changes every lane's behavior without editing lane code.

#### Scenario: Persona definitions are type-checked and validated

- **WHEN** a persona declares an unknown feature name, an out-of-range behavior parameter, or omits a required field
- **THEN** `validateSimulationModel()` reports the specific violation, and any lane invocation with an invalid model exits non-zero before touching a browser.

#### Scenario: Initial persona library

- **WHEN** the change is complete
- **THEN** the library contains at least the six personas named by the parent change (Daily Driver, Weekend Returner, Power User, Error-Prone User, Commuter, New Device Migrator), each carrying the behavior parameters needed to reproduce that persona's parent-change journey through the scenario runner.

### Requirement: Declarative scenario and workflow model

The platform SHALL provide typed scenario definitions (`defineScenario()`) composed from reusable workflow fragments (`defineWorkflow()`). A scenario SHALL bind: one persona, one goal, a starting fixture, an ordered graph of semantic steps, and the risks it covers. A workflow fragment SHALL be a named, parameterized sequence of semantic steps reusable across scenarios. Semantic steps SHALL express user intent (`createTodo`, `tickHabit`, `switchSection`, `abandonForm`, `goOffline`) and SHALL NOT contain CSS selectors or Playwright locators — selector knowledge remains in the shared `e2e/helpers/` layer.

#### Scenario: Workflow fragments are shared across scenarios

- **WHEN** two scenarios both include the workflow fragment `logBreakfast`
- **THEN** the fragment is defined once in `simulation/workflows/`, parameterized (e.g., meal, macros), and both scenarios execute the same steps through it.

#### Scenario: A scenario reads as a user journey, not a feature checklist

- **WHEN** a scenario file is reviewed
- **THEN** its steps form a sequence a real person would perform toward the declared goal, it declares persona/goal/fixture/covered-risk IDs in its definition, and it contains no raw selectors.

#### Scenario: Scenarios cover complete business processes

- **WHEN** the scenario library is complete
- **THEN** it includes end-to-end processes that span features and sessions — at minimum: a first-run onboarding process, a multi-day habit-tracking week (via clock control), an offline-commute-and-reconnect process, a new-device migration process, and a settings-ripple process — each composable from workflow fragments rather than written monolithically.

### Requirement: Every step carries its own oracles

Each semantic step in a scenario SHALL declare its verification: what changed, what MUST NOT have changed (negative oracle), and — for mutating steps — at least one second-surface or persisted-row check, using the parent change's oracle helpers (`expectRows`, `expectAcrossSurfaces`, `expectUnchanged`). A scenario whose mutating step declares no oracle SHALL fail model validation.

#### Scenario: Mutating steps verify from an independent surface

- **WHEN** a scenario step creates a calorie entry
- **THEN** the step's oracles assert the entry from at least one surface independent of the one it was created on (e.g., Overview aggregation or the persisted `calorie_entries` row), and a bare toast or list re-render is never the only evidence.

#### Scenario: Model validation rejects oracle-less mutations

- **WHEN** `validateSimulationModel()` encounters a mutating step with an empty oracle set
- **THEN** validation fails, naming the scenario and step.

### Requirement: Seeded behavior realism with a deterministic default

The platform SHALL provide a behavior engine driven by a single seeded RNG offering: per-persona think-time sampling (clamped log-normal), action pacing, and injectors for realistic imperfection — double-taps, typos with correction, mid-form abandonment, offline toggling, and tab-hide during running timers. The engine SHALL support three modes: `deterministic` (injectors off, fixed seed — mandatory in any gating lane), `seeded` (seed chosen per run and recorded in the run report), and `exploratory` (AI lane). A failure in `seeded` mode SHALL be exactly replayable via the recorded seed.

#### Scenario: Deterministic mode is reproducible

- **WHEN** the same scenario runs twice in `deterministic` mode against the same build
- **THEN** both runs execute the identical semantic action sequence, and step-level outcomes match.

#### Scenario: A seeded failure replays exactly

- **WHEN** a `seeded`-mode run fails and its run report records seed `S`
- **THEN** re-running the same scenario with `--seed S` executes the identical action sequence, including the same injected mistakes and think-time pattern.

#### Scenario: Injected mistakes are realistic and bounded

- **WHEN** the Error-Prone User persona runs in `seeded` mode
- **THEN** injected mistakes are drawn only from the defined injector set at the persona's configured rate, every injection is recorded in the step log, and no injector alters application state outside a user-reachable action.

### Requirement: Scenario runner with UI and API legs

The platform SHALL provide a runner (`simulation/runner/`, exposed as `npm run sim:run`) that executes scenario definitions against the web export through Playwright, reusing the parent change's harness (`reset`, `seed`, `clock`, `failure`, `oracles`) rather than duplicating browser mechanics. Scenarios MAY interleave UI steps with headless **API legs** that call real feature data-layer functions (`*.data.ts` via `page.evaluate`) or the Supabase client (disposable-backend lane only) for setup, teardown, and backend-state oracles. API legs SHALL NOT contain hand-written SQL inserts.

#### Scenario: UI and API legs interleave in one scenario

- **WHEN** a scenario seeds three months of history via an API leg, performs UI steps, then asserts backend state via an API leg
- **THEN** all three execute in declared order within one runner invocation, sharing one browser context and one persistence state.

#### Scenario: Runner respects the single-writer constraint

- **WHEN** the runner executes locally
- **THEN** it runs one browser context per origin (`workers: 1` semantics), and any parallelism uses distinct origins/ports so OPFS locks never collide.

#### Scenario: Setup code paths match user code paths

- **WHEN** an API leg creates fixture data
- **THEN** it calls the same `*.data.ts` functions the UI calls (inheriting ID, date-key, soft-delete, and sync-enqueue behavior), and no fixture is produced by raw SQL.

### Requirement: Bug-reproduction packages

The platform SHALL capture and replay self-contained repro bundles. A bundle SHALL contain: `bundle.json` metadata (app version/commit, scenario reference or ad-hoc action source, behavior seed, timezone, browser, timestamps), a SQLite export, an AsyncStorage dump, a semantic action log (`actions.jsonl`) sufficient to replay, a Playwright trace, console and network logs, and a human-readable `narrative.md` (user intent, expected vs. observed). Capture SHALL be invocable both from a runner failure and on demand during a manual session. Replay SHALL restore persisted state into a fresh context and re-execute the action log against a chosen build, reporting step-level divergence.

#### Scenario: Capture on runner failure

- **WHEN** a scenario step fails in any lane
- **THEN** a complete repro bundle is written automatically, and the failure digest references its path.

#### Scenario: Replay reproduces a state-dependent bug

- **WHEN** `sim:repro:replay` runs a bundle captured on build `A` against build `A`
- **THEN** the restored context reaches the same persisted state and the replay exhibits the same failure at the same step.

#### Scenario: Replay confirms a fix

- **WHEN** the same bundle replays against a build containing the fix
- **THEN** the replay reports divergence at the formerly failing step, and the report is attachable to the defect change as verification evidence.

#### Scenario: Bundles contain no real user data

- **WHEN** any bundle is captured
- **THEN** its persisted state originates from synthetic fixtures or a developer's local throwaway data, bundle output paths are gitignored, and CI artifact retention for bundles is 7 days unless attached to a filed defect outside the repo.

### Requirement: Unified observability and failure digests

Every lane execution SHALL emit a machine-readable `run-report.json` (run id, lane, environment, seed, scenario/persona references, per-step entries with durations and evaluated oracles, artifact pointers, outcome) and, on failure, a short Markdown **failure digest** (first failing step, expected vs. actual, state summary, seed, artifact links) formatted to paste into a defect issue. Step-level screenshots SHALL be captured at every oracle evaluation, and video/trace SHALL be retained on failure.

#### Scenario: One report schema across lanes

- **WHEN** a scenario-library run, a seeded-mode run, and a repro replay all complete
- **THEN** each emits a `run-report.json` validating against the same schema, so tooling can consume any lane's output uniformly.

#### Scenario: Failure digest is actionable without rerunning

- **WHEN** a developer opens a failure digest
- **THEN** it states the persona, scenario, step, seed, expected vs. actual, and links the trace, screenshot, and repro bundle — enough to file a defect without local reproduction.

### Requirement: AI-driven exploratory lane

The platform SHALL provide an opt-in exploratory lane driven by an external AI agent runtime: mission files in `simulation/ai/missions/` pairing a persona with an open objective, a starting fixture, a time/step budget, and an anomaly rubric (workflow breaks, unexpected states, usability friction, console errors, cross-surface data inconsistencies). Each mission execution SHALL produce a structured `anomaly-report.json` plus narrative, including repro evidence (trace + persisted state) per anomaly. The lane SHALL NOT gate any pipeline. Every reported anomaly SHALL be triaged into exactly one of: a filed defect change, a new deterministic scenario, or a documented non-issue.

#### Scenario: Mission files define scope without scripting steps

- **WHEN** a mission file is authored
- **THEN** it names persona, objective, fixture, budget, and rubric, and prescribes no step-by-step interactions — exploration strategy belongs to the agent.

#### Scenario: Anomalies carry reproduction evidence

- **WHEN** the agent reports an anomaly
- **THEN** the report includes what was attempted, what was expected vs. observed, the trace, the persisted state at the time, and the environment — sufficient for a human to confirm or dismiss it without rerunning the mission.

#### Scenario: The lane never gates

- **WHEN** CI workflows are inspected
- **THEN** no PR or `main` job depends on the AI lane's outcome; it runs on-demand or on a schedule and reports only.

#### Scenario: Findings do not evaporate

- **WHEN** a mission produces anomaly reports
- **THEN** each anomaly is resolved as a filed defect, a new deterministic scenario in the library, or a documented non-issue with rationale, and the resolution is recorded alongside the report.

### Requirement: Disposable-backend lane with hard production isolation

The platform SHALL validate sync, restore, and edge-function contracts against a real but disposable Supabase project. `simulation/backend/` SHALL contain a reference `schema.sql` (the four synced tables — `todos`, `habits`, `calorie_entries`, `workout_routines` — plus RLS policies, maintained as a documented copy of the dashboard configuration) and provisioning scripts that create or wipe the throwaway project and emit short-lived env for a dedicated `dist-live/` build. A guard SHALL abort the lane — before any network use — if the target host matches the production Supabase URL, if production credentials are present in the environment, or if the target project is not marked disposable. The lane SHALL run only on `main`/nightly/on-demand, SHALL contain only synthetic data, and SHALL NOT gate pull requests.

#### Scenario: Round-trip validation against a real backend

- **WHEN** the lane executes its scenario set
- **THEN** sync upsert, per-`(entity,id)` dedupe, backoff/requeue, partial-failure handling, and the restore lifecycle (preview, eligibility, import, non-restored entities) are exercised against the disposable project and verified from both the local SQLite rows and the remote table contents.

#### Scenario: The guard refuses production

- **WHEN** the lane is invoked with the production Supabase URL or with ambient production credentials
- **THEN** it aborts before any build or network call, and the abort reason names which guard rule fired.

#### Scenario: No PR cost and no standing secrets

- **WHEN** a pull request runs CI
- **THEN** no disposable-backend job executes, no Supabase credential (real or disposable) is present in the PR lane, and PR feedback time is unchanged from the parent change's budget.

#### Scenario: Reference schema drift is visible

- **WHEN** `simulation/backend/schema.sql` no longer matches the behavior of the live dashboard schema (discovered via a round-trip failure or manual audit)
- **THEN** the discrepancy is recorded as a finding, since the authoritative remote schema lives outside the repo; closing that gap permanently (version-controlled Supabase migrations) is a named follow-up change, not part of this one.

### Requirement: Environment matrix and lane taxonomy

The platform SHALL define and document an explicit matrix of execution environments — local development, PR CI, `main`/nightly CI, and disposable-backend — declaring for each lane: backend target, behavior mode, trigger, artifact retention, and whether it gates. Gating lanes SHALL be deterministic, fake-backed, and time-budgeted (scenario subset on PR ≤ 10 minutes); non-deterministic, slow, or live-backend lanes SHALL be report-only until promoted by an explicit later change.

#### Scenario: The matrix is enforced by configuration, not convention

- **WHEN** a lane is invoked
- **THEN** its backend target, behavior mode, and retention come from the matrix configuration, and invoking a lane with a forbidden combination (e.g., `seeded` mode in the PR gate) fails fast with a clear message.

#### Scenario: New lanes do not slow PR feedback

- **WHEN** the scenario-library PR subset runs in CI
- **THEN** its wall-clock contribution stays within the documented budget, measured and recorded in the change's verification tasks.

### Requirement: Reuse of the parent change's harness and discipline

The platform SHALL import the parent change's harness helpers (`e2e/helpers/{reset,seed,clock,failure,oracles,journey}.ts`), fixtures, and reset semantics (OPFS + AsyncStorage) rather than duplicating them, and SHALL NOT modify the parent's journey suite, integration level, CI gating role, or quarantined contract-gap tests (CG-1, CG-2). Platform findings SHALL follow the parent's protocol: defects are filed as separate changes, quarantined contract tests name their companion change, assertions are never weakened, and every skip/quarantine is registered in `docs/testing/known-gaps.md`.

#### Scenario: No duplicated browser mechanics

- **WHEN** the platform's runner needs reset, seeding, clock control, failure injection, or oracle behavior
- **THEN** it imports the parent's helper, and a search of `simulation/` finds no reimplementation of those mechanics.

#### Scenario: Parent suite untouched

- **WHEN** this change is complete
- **THEN** the parent's journeys and integration tests pass unmodified, its P0 PR gate is unchanged, and CG-1/CG-2 remain quarantined under their original companion-change names.

#### Scenario: Platform-discovered defects follow the filing protocol

- **WHEN** any platform lane discovers an application defect
- **THEN** it is filed as a separate change (with repro bundle attached) or registered in the known-gap register, and this change does not patch application source to make a lane green.

### Requirement: Compatibility with active OpenSpec changes

The platform SHALL remain compatible with the single-page navigation model (section switching through `NavigationContext`, settings as modal, command center as global overlay, no URL-addressable routes) and with `add-ai-ask-feature` (Ask-mode surfaces behind `AI_ASK_EXPERIMENT_ENABLED`, the `superhabits.command.last-used-mode` reset key). Simulation reset SHALL clear every persisted preference key the application can write, including keys added by active changes.

#### Scenario: Interaction vocabulary matches the single-page shell

- **WHEN** scenarios, missions, or repro action logs express navigation
- **THEN** they use section/tab/modal/overlay semantics (no URL routes), matching the `navigation` capability spec from `single-page-consolidation`.

#### Scenario: Reset covers keys from active changes

- **WHEN** a scenario run begins
- **THEN** reset clears OPFS SQLite files and all `superhabits.*` AsyncStorage keys — theme, calories view mode, command mode preference, and internal-rollout toggle — so no preference leaks between runs.

### Requirement: Known-gap register additions

The platform SHALL register its own capability gaps in `docs/testing/known-gaps.md` (owned by the parent change), each with reason and closing path: native-device exploration, AI-lane non-determinism and cost, the manually-maintained reference schema for the disposable backend, and the absence of a persistent staging environment.

#### Scenario: Gaps are named with closing paths

- **WHEN** the change is complete
- **THEN** each platform capability gap appears in the known-gap register with its reason and the change or condition that would close it, and no platform lane silently skips a documented gap area without an entry.
