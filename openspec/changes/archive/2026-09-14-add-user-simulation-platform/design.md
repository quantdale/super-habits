## Context

### What exists today (verified in the tree)

SuperHabits is a single-user, offline-first Expo/React Native app shipping as a PWA (`dist/` static export) and native apps. Local SQLite (OPFS on web, one lock per origin) is the source of truth; the entire "backend" is an optional Supabase project holding four synced tables (`todos`, `habits`, `calorie_entries`, `workout_routines`) with push-only backup, a one-shot restore, and one functional edge function (`parse-ai-command`). Auth is anonymous-only; the remote schema and RLS live **only in the Supabase dashboard**, not in this repo. There is no staging environment: Vercel preview vs. production is the only distinction, and EAS profiles are device-side.

The test pyramid today: 427 Vitest unit tests (41 files, all `expo-sqlite` calls mocked), 90 Playwright E2E tests (14 specs, every one starting from `clearDatabase()`), both green. The parent change `add-real-world-user-simulation-testing` (designed, ~6/57 tasks landed) adds on top: a persona-driven journey suite (`e2e/journeys/`), harness helpers (`seed`, `clock`, `failure`, `oracles`, `journey`, `reset`), a real-SQLite integration level, CI lane split (P0 on PR, full set on main/nightly, dummy-env `dist-sync/` build), and a known-gap register. Its personas (Daily Driver, Weekend Returner, Power User, Error-Prone User, Commuter, New Device Migrator) and journeys (J1–J10) are **hand-written Playwright files** — deliberately deterministic, deliberately scoped to web, deliberately excluding live backends, authz, and AI-driven exploration (recorded in its seven capability gaps).

### The gap this design fills

The parent's journeys are _fixed scripts_. Nothing in the tree lets a developer:

- define "a power user with three months of data who makes occasional mistakes" once and reuse that definition across features, lanes, and tools;
- run a complete business process (e.g., "migrate to a new phone", "a week of habit tracking with a commute") as a composable, configurable unit rather than a bespoke spec file;
- capture and re-run the exact state + action sequence that produced a bug;
- get realistic _variability_ (timing, decision, mistake diversity) without losing reproducibility;
- have an agent explore the app the way a curious human would, and report what surprised it;
- verify the sync/restore contract against a real Supabase project instead of injected fakes.

### Constraints inherited from the system

- **OPFS single-writer lock**: one browser context per origin at a time — all UI lanes run `workers: 1` locally; parallel lanes need separate origins/ports.
- **`EXPO_PUBLIC_*` is build-time**: different backends require separate `dist/` exports (the parent already establishes a `dist-sync/` dummy-env lane; the disposable-backend lane adds a `dist-live/` export pointed at the throwaway project).
- **Single-page shell**: all six sections live in one React tree behind `NavigationContext.activeSection`; there are no URLs to drive — UI automation must interact through tabs, gestures, modals, and overlays, using the parent's rewritten helpers.
- **No client-side authorization model**: single-user anonymous auth means "validate authentication" reduces to session bootstrap + behavior with Supabase unconfigured (parent spec §25). This design must not invent an authz surface.
- **The deterministic suite remains the PR gate.** Nothing here may slow or destabilize PR feedback.
- **Contract-gap protocol (D13 of parent)**: decided-but-unimplemented behavior gets quarantined tests naming a companion change; assertions are never weakened. Platform lanes inherit this rule.

## Goals / Non-Goals

**Goals:**

- A single, typed, declarative model for **personas, scenarios, workflows, and test data** that every execution lane (Playwright runner, AI agent, API orchestration, repro replay) consumes — write once, run anywhere.
- A **seeded behavior model**: realistic think times, action pacing, and optional mistake/interruption injection; a fixed seed replays a run bit-for-bit at the action level; CI gating runs always use variability-off.
- **Bug-reproduction packages**: capture state + actions + environment into a portable bundle; replay a bundle against a newer build to confirm a fix or re-characterize a regression.
- **First-class observability**: per-step structured logs, screenshots, video, Playwright traces, machine-readable run reports, and human failure digests for every lane.
- An **AI-driven exploratory lane** that finds what nobody scripted — broken workflows, unexpected states, usability problems — and files structured anomaly reports; non-gating by design.
- A **disposable-backend lane** validating sync, restore, and edge-function contracts against a real (throwaway) Supabase project on `main`/nightly.
- An explicit **environment matrix** (local / PR CI / nightly / disposable-backend) and **hard production-isolation guarantees** enforced in code, not by convention.

**Non-Goals:**

- Replacing or restructuring the parent's deterministic journey suite, integration level, or its CI gating role.
- Native (iOS/Android) automation — remains a recorded capability gap (Maestro/Detox or manual missions).
- A persistent staging environment, load/stress testing, two-way sync, or any change to application source.
- Inventing an authorization model or testing production RLS from the client (out of repo by architecture).
- Adding an LLM SDK or runtime dependency to the repo; the AI lane is driven by an external agent runtime.
- Fixing any defect the platform discovers — findings are filed as separate changes, per the parent's protocol.

## Decisions

### D1 — A top-level `simulation/` package, tool-agnostic, layered over the parent's harness

The platform lives in `simulation/` (not `e2e/`) because it is not a Playwright spec suite: it is a model + multiple runners. It imports the parent's harness helpers (`e2e/helpers/*`) for browser mechanics and oracles rather than duplicating them.

```
simulation/
  personas/      # typed persona definitions (traits, goals, behavior params)
  scenarios/     # scenario definitions: persona × goal × workflow graph × fixture
  workflows/     # reusable workflow fragments (e.g. "log breakfast", "complete a pomodoro")
  fixtures/      # test-data builders (compose parent's SMALL/TYPICAL/HEAVY seeders)
  behavior/      # seeded RNG, think-time model, mistake/interruption injectors
  runner/        # Playwright scenario executor + API-leg orchestration
  repro/         # bundle capture/replay
  observe/       # run report, artifact writers, failure digest
  ai/            # exploratory-lane missions, prompts, anomaly report schema
  backend/       # disposable Supabase provisioning + reference schema
  README.md
```

**Alternatives considered:** (a) Extend `e2e/journeys/` with more hand-written specs — rejected: that is the fixed-script model this change exists to escape. (b) A separate package/repo — rejected: the platform must import feature data layers, domain functions, and e2e helpers with zero publish friction; monorepo tooling is not present.

### D2 — Declarative model in TypeScript, not YAML/JSON

Personas, scenarios, and workflows are typed TS modules (`definePersona(...)`, `defineScenario(...)`, `defineWorkflow(...)`) checked by `tsc` and importable by runners and by Vitest. Schemas are validated at load by a small `validateSimulationModel()` in `simulation/runner/` (pure function, unit-tested).

**Alternatives considered:** YAML/JSON + Zod — rejected: adds a parsing/dependency layer, loses type inference against app types (entity shapes, section names), and makes refactoring personas as brittle as the strings in the parent's spec files. JSON remains the interchange format only for _artifacts_ (run reports, repro bundles, anomaly reports), where portability matters.

### D3 — Scenario = persona × goal × workflow graph; steps are semantic, not selector-level

A scenario is an ordered graph of **semantic steps** (`createTodo`, `tickHabit`, `switchSection`, `expectAcrossSurfaces`, `waitThinkTime`, `maybeMakeMistake`, `injectFailure`, `apiLeg`), each resolving at runtime through the parent's helpers/oracles. Steps declare their own oracles (what changed / what must not have changed / second-surface check) so the multi-surface verification discipline is structural, not per-author habit. Decision points sample from the persona's behavior params via the seeded RNG.

**Alternatives considered:** (a) Record-and-replay (Playwright codegen output as the model) — rejected: selector-level scripts are unmaintainable and encode no intent, personas, or oracles. (b) Free-form AI-agent execution as the primary model — rejected (see D7): non-deterministic, ungateable, unreviewable.

### D4 — Seeded behavior realism: variability is a lane property, determinism is the default

`simulation/behavior/` provides: think-time sampling (log-normal per persona trait, clamped), action pacing, and injectors for realistic imperfection (double-taps, typos + correction, mid-form abandonment, offline toggling, tab-hide during timers) — all driven by one seeded RNG. Run modes: `deterministic` (seed fixed in the scenario, all injectors off — used in any gating context), `seeded` (seed recorded in the run report — used locally/nightly; a failure report includes the seed for exact replay), `exploratory` (AI lane, no seed guarantee).

**Alternatives considered:** always-on randomness (flake factory, rejected); wall-clock sleeps (slow and still fake, rejected — the parent's `clock.ts` controls app-visible time, while think time only delays the _driver_).

### D5 — Bug-repro bundle: directory format, replayable, synthetic-data-only

A repro bundle is a directory: `bundle.json` (metadata: app version/commit, scenario ref or ad-hoc action log, seed, TZ, browser, timestamps), `db.sqlite` (OPFS export), `storage.json` (AsyncStorage dump), `actions.jsonl` (semantic action log sufficient to replay), `trace.zip`, `console.log`, `network.har`, `narrative.md` (what the user was doing, what was expected vs. observed). `sim repro capture` produces one from a live session (manual or runner-driven); `sim repro replay <bundle>` restores db+storage into a fresh context and re-executes `actions.jsonl` against a chosen build, reporting divergence. All artifacts are synthetic-data-only and gitignored with retention limits.

**Alternatives considered:** trace-only repro (Playwright trace viewer) — rejected: a trace shows the UI but cannot restore DB/storage state, so it cannot reproduce data-dependent bugs; video-only — rejected for the same reason.

### D6 — Observability: one run report schema across all lanes

Every lane emits `run-report.json` per execution: run id, lane, environment, seed, scenario/persona refs, per-step entries (semantic step, started/duration, oracles evaluated, artifacts), outcome, and failure digest (first failure + state summary + artifact pointers). HTML rendering reuses the existing Playwright HTML report where applicable; the failure digest is a short Markdown file designed to paste into a defect issue. Retention: local artifacts unbounded-but-gitignored; CI artifacts 7 days (matches the existing `e2e-report` retention); repro bundles kept only when attached to a filed defect.

### D7 — AI exploratory lane: external agent runtime, mission-file driven, non-gating

The lane is a set of **mission files** (`simulation/ai/missions/*.md`) pairing a persona with an open objective, budget (time/steps), starting fixture, and an anomaly rubric (what counts as reportable: workflow breaks, unexpected states, usability friction, console errors, data inconsistencies across surfaces). Execution: an operator- or CI-invoked agent runtime (e.g., this CLI or any Playwright-MCP-capable agent) runs the mission against the local `dist/` build and writes a structured `anomaly-report.json` + narrative per mission. Triage rule (inherits the parent's findings convention): every anomaly becomes either a filed defect change, a new deterministic scenario in the library, or a documented non-issue — never a note that evaporates. The lane **never gates** anything; its cost, latency, and non-determinism are quarantined to on-demand/nightly.

**Alternatives considered:** embedding an LLM SDK and agent loop in the repo (`runner/ai-agent.ts`) — rejected: vendor lock-in, secret management, and dependency weight in the app repo for a lane that runs weekly; deterministic-only (parent's choice) — insufficient for the "usability issues / unexpected states" class the user explicitly wants covered.

### D8 — Disposable backend: provision-or-reset a throwaway Supabase project; reference schema checked into `simulation/backend/`

`simulation/backend/` contains `schema.sql` (the four synced tables + RLS policies, written as a **reference copy** of the dashboard config) and `provision.ts`: create a fresh project (Supabase CLI/API) or reset a standing throwaway one (wipe tables + rotate anon key usage), deploy `parse-ai-command` if the run covers the parser, and emit a short-lived env file consumed only by the `dist-live/` build. CI wiring: a nightly/`main` job builds `dist-live/` with the disposable project's URL/anon key, runs the backend round-trip scenario set (sync upsert/dedupe/backoff, restore lifecycle, edge-function contract), then tears down. **Hard isolation rule, enforced in `simulation/backend/guard.ts` and in CI:** the lane aborts if the target host matches the production Supabase URL, if `EXPO_PUBLIC_SUPABASE_*` real credentials are present in the shell, or if the project is not tagged disposable. The disposable project never contains real user data.

**Alternatives considered:** (a) Fakes-only forever (parent's stance) — rejected for this lane: the user explicitly wants backend/API validation, and fakes cannot catch SQLite↔Postgres drift or upsert/RLS surprises (parent capability gap #2, which this lane closes). (b) A persistent staging Supabase + Vercel staging env — rejected: standing infra, secrets, and cost for a single-user app; disposable-per-run gives stronger isolation. (c) Local Supabase (`supabase start` Docker stack) — seriously considered; rejected as v1 because the CI image and most dev machines lack Docker, but the reference `schema.sql` is written to be compatible with a future local-stack lane (recorded as an open question, not a blocker).

### D9 — API orchestration legs share the app's data layer, never hand-written SQL

Headless scenario legs (setup/teardown/backend oracles) call the real `*.data.ts` functions in the browser context (`page.evaluate`, the parent's seeding approach) or the Supabase JS client against the disposable project. No lane writes raw `INSERT`s — fixtures must exercise the same code paths as the UI (parent spec §22, inherited).

### D10 — Environment matrix and lane taxonomy

| Lane                              | Backend                  | Variability     | Trigger                           | Gates?                                                    |
| --------------------------------- | ------------------------ | --------------- | --------------------------------- | --------------------------------------------------------- |
| Deterministic journeys (parent's) | none (fakes via routing) | off             | PR + main                         | **yes**                                                   |
| Scenario library                  | none (fakes)             | `deterministic` | PR (subset ≤10 min) / main (full) | **yes** (subset)                                          |
| Scenario library, seeded          | none (fakes)             | `seeded`        | nightly, local                    | no                                                        |
| Repro replay                      | none or disposable       | n/a (replay)    | on-demand                         | no                                                        |
| AI exploratory                    | none (fakes)             | `exploratory`   | on-demand, nightly                | no                                                        |
| Disposable-backend round trips    | disposable Supabase      | `deterministic` | main/nightly                      | no (report-only; promotion to gating is a later decision) |

Gating lanes must be deterministic, fast, and fake-backed. Everything realistic-but-slow or non-deterministic is report-only until promoted by an explicit later change.

## Risks / Trade-offs

- **Production-data catastrophe via misconfigured backend lane** (the app has no client-side `user_id` scoping; safety rests on dashboard RLS and on never compiling real credentials) → D8's hard guard (refuse production host, refuse ambient real credentials, require disposable tag), code-reviewed once and unit-tested; the `dist-live/` build is produced only inside the guarded CI job; documentation forbids pointing any lane at production.
- **Repro bundles leak data or bloat the repo** → synthetic data only (fixtures are generated; the app is single-user with no real-user corpus); all bundle/artifact paths gitignored; CI retention 7 days; bundles persist only as defect attachments outside the repo.
- **AI-lane flakiness and cost** → non-gating by design (D7); missions time-boxed; anomaly reports require repro evidence (trace + state) to be actionable; chronic non-findings missions are retired, not kept as ceremony.
- **Seeded variability produces irreproducible failures** → every run report records the seed; `deterministic` mode exists for gating; a seeded-lane failure must be replayable via `sim run --seed <s>` before it may be filed as a defect.
- **Reference schema drifts from the real dashboard schema** → `simulation/backend/schema.sql` is documented as a manual reference copy; drift is itself a finding (it proves the out-of-repo schema problem, audit SEC-003) and strengthens the case for the follow-up change that moves Supabase schema into version control. Recorded in the known-gap register.
- **Platform becomes a second, divergent test framework** → D1/D9 force reuse of the parent's helpers, oracles, fixtures, and reset semantics; the parent's suite keeps its gating role; `simulation/README.md` documents when to write a deterministic journey (parent) vs. a scenario (this platform) vs. an AI mission.
- **CI time/cost creep** → matrix (D10) confines new cost to main/nightly/on-demand lanes; PR lane budget is explicit (≤10 min scenario subset) and measured in the verification tasks.
- **Single-page shell has no URLs, so external agent tooling flounders** → mission files and the AI lane's rubric include the section/tab model and the parent's helper APIs as the sanctioned interaction vocabulary; missions start from seeded fixtures, not a cold empty app.

## Open Questions

- **Local Supabase stack lane** (`supabase start`, Docker) as a cheaper, faster alternative to cloud-disposable projects — deferred; `schema.sql` is kept compatible so this can be added without redesign.
- **Promotion criteria** for moving disposable-backend round trips from report-only to gating on `main` — to be decided after the lane has a flake-free track record (suggested: 14 consecutive green nightly runs).
- **AI-lane runtime in CI** — which agent runtime (this CLI vs. a dedicated action) and how its credentials are managed; v1 ships missions + report schema and runs the lane locally/on-demand, CI wiring follows.
- **Repro bundle → deterministic scenario compiler** — converting a confirmed repro into a library scenario automatically; v1 does this by hand, automation is a follow-up if volume justifies it.
