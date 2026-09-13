**Lifecycle status:** BLOCKED for the two optional external lanes (AI
exploration requires an LLM-capable agent runtime; backend round trips require
a disposable authenticated Supabase project). The deterministic local runner,
model, and validation remain implemented and usable.

## Why

`add-real-world-user-simulation-testing` gives SuperHabits a deterministic, persona-driven journey suite — but every journey is a hand-written Playwright file with its persona, fixture, and steps frozen in code. That suite answers "does the app still work" but not the broader questions developers actually face day to day: _How would a specific kind of user exercise this new feature? Can I re-run the exact state and actions that produced this bug report? What does the app do under realistic, varied, imperfect use that nobody scripted? Does the sync/restore contract hold against a real backend?_ Today each of those requires repetitive manual work: hand-seeding data, clicking through flows, reconstructing bug state, and eyeballing screenshots.

This change adds the missing **platform layer**: declarative, reusable personas, scenarios, workflows, and test data that any developer (or CI lane, or AI agent) can execute; realistic behavior simulation with seeded variability; a bug-reproduction package format; a first-class observability layer (logs, screenshots, recordings, traces, failure reports); an opt-in AI-driven exploratory lane; and a disposable-backend lane that validates sync, restore, and API contracts against a real — but throwaway — Supabase project. It builds on the harness the parent change defines (`e2e/helpers/{seed,clock,failure,oracles,journey,reset}.ts`) and does not alter the deterministic suite's role as the PR gate.

## What Changes

- **Add a declarative simulation model** (`simulation/`): personas, scenarios (ordered workflows of user actions with decision points), reusable workflow fragments, and fixture/test-data builders — defined as typed TypeScript modules consumed by every execution lane, never duplicated per runner.
- **Add a scenario runner**: executes scenario definitions through Playwright against the web export, with a seeded behavior model (think-time distributions, action pacing, configurable mistake/interruption injection). A fixed seed replays a run exactly; the CI gating lane always runs with variability disabled.
- **Add bug-reproduction packages**: a single command captures a self-contained repro bundle (SQLite dump, AsyncStorage dump, Playwright trace, console/network logs, scenario reference, environment metadata, and human-readable narrative) and can re-execute a bundle later against a new build to confirm a fix.
- **Add an observability layer**: every run produces structured artifacts — per-step logs with timing, screenshots at assertions, video, trace, a machine-readable run report (JSON), and a human-readable failure digest — with documented retention and gitignore rules.
- **Add an AI-driven exploratory lane**: an agent given a persona mission explores the app through the browser (Playwright MCP tooling), looks for broken workflows, unexpected states, and usability problems, and files structured anomaly reports. Opt-in, on-demand/nightly only, never gating; findings are triaged into defects or new deterministic scenarios.
- **Add a disposable-backend lane**: scripts + CI job that provision (or reset) a throwaway Supabase project — schema for the four synced tables plus RLS — and run sync/restore/API round-trip scenarios against it on `main`/nightly only. No real credentials are ever compiled into any bundle or accepted from the environment; PR lanes keep network-boundary fakes.
- **Add API-level orchestration legs**: scenarios may include headless steps that drive feature data-layer functions or the Supabase API directly (setup, teardown, backend-state oracles) interleaved with UI steps.
- **Define the environment matrix**: local dev, PR CI, `main`/nightly CI, and disposable-backend lanes — what runs where, with what variability, against what backend, with what artifact retention.
- **Record new capability gaps** in `docs/testing/known-gaps.md` (owned by the parent change): persistent staging, native-device AI exploration, and AI-lane non-determinism, each with reason and closing path.

Deliberately **not** changed: application source, the existing Vitest/Playwright suites, the parent change's journey suite or its CI gating role, and the two named companion fixes (`fix-day-rollover-refresh`, `fix-restore-emptiness-counts-deleted-rows`). Defects surfaced by any lane are filed, not silently patched; no assertion is ever weakened to match current behavior.

## Capabilities

### New Capabilities

- `user-simulation-platform`: A reusable, configurable platform for realistically simulating how different users use the entire application — declarative personas/scenarios/workflows/test data, a seeded behavior-realistic runner, bug-reproduction packages, structured observability artifacts, an AI-driven exploratory lane, and a disposable-backend lane for real sync/restore/API round trips — executable across local, PR-CI, nightly, and disposable-backend environments with strict production-data isolation.

### Modified Capabilities

- None. No specs of record exist yet (`openspec/specs/` is empty), and this change extends — without altering any requirement of — the parent change `add-real-world-user-simulation-testing`, whose `user-simulation-testing` spec remains the contract for the deterministic journey suite.

## Impact

- **New files/directories**: `simulation/` (`personas/`, `scenarios/`, `workflows/`, `fixtures/`, `runner/`, `behavior/`, `repro/`, `observe/`, `ai/`, `backend/`, `README.md`), CI lane additions in `.github/workflows/ci.yml` (or a second workflow), `package.json` scripts (`sim:*`).
- **Depends on (does not modify)**: the parent change's harness helpers and journeys (`e2e/helpers/*`, `e2e/journeys/*`), the single-page navigation model (`app/index.tsx`, `NavigationProvider`), and the command-center surfaces from `add-ai-ask-feature` (Ask mode flag, `superhabits.command.last-used-mode` reset key).
- **New dev dependencies**: none required beyond what the parent change introduces (`better-sqlite3` for SQLite dumps in repro packages). The AI lane uses the already-installed Playwright plus an MCP-capable agent runtime supplied by the operator's environment (e.g., an AI coding CLI); no LLM SDK is added to the repo. Supabase provisioning uses the `supabase` CLI in CI only (ephemeral runner install, not a repo dependency).
- **Runtime/CI cost**: the PR lane is unchanged (parent's P0 journeys still gate). New cost lands in opt-in lanes: scenario-library runs and AI exploration on `main`/nightly/on-demand, disposable-backend round trips on `main`/nightly. Local runs are developer-invoked.
- **Security/privacy posture**: all simulated data is synthetic and generated; repro bundles and run artifacts are gitignored with retention limits; the disposable backend holds no real user data and is wiped per run or per night. A hard isolation rule (enforced in code and CI): the platform refuses to run when real Supabase credentials are detected in its environment. Server-side RLS correctness on the _production_ project remains out of repo and is validated only against the disposable project's schema, which is treated as a reference copy to keep in sync manually (recorded as a known gap).
- **Follow-up changes this proposal may create**: defect fixes filed from AI-lane or disposable-backend findings; a possible future change promoting the disposable-project schema into version-controlled Supabase migrations (`supabase/migrations/`), which would close the dashboard-only-schema gap (audit SEC-003).
