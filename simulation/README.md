# SuperHabits User-Simulation Platform

The user-simulation platform is a **model + multiple runners** layered over the
parent change `add-real-world-user-simulation-testing`'s harness. The parent
change ships a fixed, hand-written Playwright journey suite (`e2e/journeys/`)
plus the harness helpers it is built on (`e2e/helpers/{journey,reset,clock,
failure,seed,oracles}.ts`). This platform lets you define **personas,
scenarios, and workflows once** as typed, declarative TypeScript and run them
through whatever lane fits the job — a deterministic Playwright runner, a
seeded local/nightly run, an API-leg orchestration, a repro replay, or an
AI exploratory mission.

The platform is **tool-agnostic** and **dependency-free** (design D1): it lives
in `simulation/` (not `e2e/`), imports the parent's harness helpers rather than
duplicating browser mechanics, and adds **no runtime dependency and no LLM SDK**
to the repo. The model is authored in TypeScript via typed builders (design D2)
and validated at load by `validateSimulationModel()`.

## Layout

```
simulation/
  model/       # types, builders, validator, semantic-step catalog   (this task, tasks 1.1–1.6)
  personas/    # typed persona definitions (later task 6.1)
  workflows/   # reusable workflow fragments (later task 6.2)
  scenarios/   # scenario definitions (later task 6.3–6.4)
  fixtures/    # test-data builders composing the parent's SMALL/TYPICAL/HEAVY (6.5)
  behavior/    # seeded RNG, think-time model, mistake injectors (task 2)
  runner/      # Playwright scenario executor + API-leg orchestration (task 3)
  observe/     # run report, artifact writers, failure digest (task 4)
  repro/       # bundle capture/replay (task 5)
  ai/          # exploratory-lane missions, anomaly reports (task 7)
  backend/     # disposable Supabase provisioning + reference schema (task 8)
  README.md
```

The deterministic fixture seeders include a compact Gym V2 slice: a catalog-backed
routine prescription, a custom exercise, a weekly-plan row, and a body-weight
measurement. This keeps the simulation/introspection lane exercising the new
recoverable Workout entities without importing a large external exercise dataset.

## Lane matrix (authoritative: `simulation/matrix.ts`)

The execution lanes as configured in `simulation/matrix.ts` (task 9.1) — this
table is a documented mirror of that module, and `.github/workflows/ci.yml` is
written lane-for-lane against it. `validateMatrix()` runs inside `sim:validate`
and `sim:run`, so a forbidden combination fails fast with a named rule.

| Lane id                                   | Backend                            | Mode            | Trigger                                | Gates?           | CI retention |
| ----------------------------------------- | ---------------------------------- | --------------- | -------------------------------------- | ---------------- | ------------ |
| `journeys` (parent's deterministic suite) | none (fakes)                       | off             | PR (P0 subset) / main / nightly (full) | **yes**          | 7 days       |
| `scenarios-pr`                            | none (fakes)                       | `deterministic` | PR (subset ≤ 10 min budget)            | **yes** (subset) | 7 days       |
| `scenarios-main`                          | none (fakes)                       | `deterministic` | main                                   | no (report)      | 7 days       |
| `scenarios-seeded`                        | none (fakes)                       | `seeded`        | nightly, local                         | no               | 7 days       |
| `dist-sync`                               | dummy Supabase (non-routable host) | `deterministic` | main / nightly                         | no               | 7 days       |
| `repro-replay`                            | none or disposable                 | n/a (replay)    | on-demand                              | no               | 7 days       |
| `ai-exploratory`                          | none (fakes)                       | `exploratory`   | on-demand, nightly                     | no               | 7 days       |
| `disposable-backend`                      | disposable Supabase                | `deterministic` | main / nightly                         | no (report-only) | 7 days       |

Forbidden combinations (each is a named rule in `matrix.ts`): `seeded` and
`exploratory` never appear in the PR lane; the disposable backend and the
`dist-sync` dummy build never appear in the PR lane nor the quality job; gating
lanes are always deterministic and fake-backed; remote-backed lanes are
report-only until explicitly promoted.

Gating lanes are deterministic, fast, and fake-backed. Everything
realistic-but-slow or non-deterministic is report-only until an explicit later
change promotes it.

For the autonomous QA loop, use `docs/testing/autonomous-qa.md` as the
agent-facing escalation guide. `npm run qa:simulation` builds a fresh static
export, serves it on the configured E2E port, validates the model, and runs the
deterministic `@p0` scenarios. Use `E2E_PORT=8092 npm run qa:simulation` when a
development server already owns :8081. Seeded discovery remains report-only;
preserve the printed seed and replay it with `npm run sim:repro:replay` or the
runner's recorded repro command.

Run modes (design D4): `deterministic` (fixed seed, all injectors off —
mandatory in gating lanes), `seeded` (seed chosen per run, recorded in the run
report; a failure replays exactly via `--seed S`), `exploratory` (AI lane, no
seed guarantee).

## Which tool for which job

Decide the tool by the question the work is asking, not by habit:

- **A deterministic journey (parent change)** — write a hand-written Playwright
  spec in `e2e/journeys/` when the behaviour is a fixed, sequential, gated
  regression you want on the PR gate, and when you have no need to reuse the
  script across lanes or parameterize it. The parent's suite keeps its gating
  role; it is never replaced.
- **A scenario (this platform)** — write a `defineScenario()` in
  `simulation/scenarios/` when you want to _reuse_ a persona or behaviour
  across features/lanes/tools, compose a complete business process from
  reusable workflow fragments, or get seeded variability / repro capability.
  Scenarios are semantic (no selectors); they resolve at runtime through the
  parent's helpers.
- **An AI mission (this platform)** — write a mission file in
  `simulation/ai/missions/` when you want an agent to _explore_ what nobody
  scripted (unexpected states, usability friction), beyond any fixed script.
  Missions are non-gating by design.

A scenario is not a "bigger journey" and a mission is not a "softer scenario":
deterministic journeys gate, scenarios parameterize and compose, AI missions
explore. When a scenario finds a defect, file it as a separate change (parent
protocol); when a mission finds something reportable, triage it into a filed
defect, a new deterministic scenario, or a documented non-issue.

## Model authoring guide

The model is typed TypeScript built with `definePersona()` / `defineWorkflow()`
/ `defineScenario()` from `simulation/model/builders.ts`. Scenarios live in
`simulation/scenarios/`, personas in `simulation/personas/`, workflows in
`simulation/workflows/` — the loader (`simulation/runner/library.ts`) merges
every compiled module from those directories plus the self-test model.

```ts
import { definePersona, defineScenario, defineWorkflow, defineModel } from '../model/builders';

const dailyDriver = definePersona({
  id: 'daily-driver',
  name: 'Maya, the Daily Driver',
  description: 'Opens the app 5–10×/day for 30s at a time.',
  goals: ['tick habits daily', 'log meals as they happen'],
  behavior: { thinkTime: { minMs: 150, maxMs: 800, sigma: 0.4 }, mistakeRate: 0.05 },
});

const logBreakfast = defineWorkflow({
  id: 'log-breakfast',
  description: 'Open Calories and log a meal with oracles.',
  steps: [
    { kind: 'switchSection', tab: 'calories' },
    {
      kind: 'logCalories',
      food: 'Oatmeal',
      calories: 320,
      mealType: 'breakfast',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT food_name FROM calorie_entries WHERE food_name = 'Oatmeal' AND deleted_at IS NULL",
          expected: [{ food_name: 'Oatmeal' }],
        },
      ],
    },
  ],
});

export const model = defineModel({
  personas: [dailyDriver],
  workflows: [logBreakfast],
  scenarios: [
    defineScenario({
      id: 'monday-morning',
      personaId: 'daily-driver',
      goal: 'A realistic Monday: habit ticks plus breakfast.',
      fixture: 'TYPICAL',
      mode: 'deterministic', // or 'seeded'
      risks: ['R1'],
      tags: ['@p0'], // tags select the PR subset via --scenario @p0
      workflows: [{ workflowId: 'log-breakfast' }],
      steps: [/* semantic steps; see simulation/model/steps.ts */],
    }),
  ],
});
```

Rules every author must follow:

- **Steps are semantic, not selector-level** — no selectors in scenario files;
  every step resolves through the parent helpers at runtime.
- **Every mutating step carries its own oracles** (validator rule 4): at least
  one persisted-row or second-surface check, never only a toast.
- **Fixtures call the real data layers** (design D9): `fixture: 'SMALL' |
'TYPICAL' | 'HEAVY'`, or `apiLeg` steps for headless writes — never raw SQL in
  the step graph (`assertApiLegSafe` guards it).
- **`deterministic` for anything gating**; `seeded` locally/nightly (the seed is
  recorded in `run-report.json` and replays exactly); `exploratory` only for AI
  missions.
- Validate with `npm run sim:validate` before writing much of anything; it
  checks required fields, unknown sections/features, out-of-range behavior
  params, oracle-less mutating steps, dangling references, and the lane matrix.

## Repro workflow (task 5 — capture/replay land with task 5.2/5.3)

A bug-repro bundle is a directory: `bundle.json` (commit, scenario ref, seed,
TZ, browser, timestamps), `db.sqlite` (OPFS export), `storage.json`
(AsyncStorage dump), `actions.jsonl` (semantic action log), `trace.zip`,
console/network logs, and a `narrative.md` template. Planned commands
(`sim:repro:capture`, `sim:repro:replay <bundle> [--build <dir>]`) will:

1. **Capture** automatically on runner failure (wired into the executor) or
   on demand for a manual session; the digest names the exact repro.
2. **Replay** by restoring db+storage into a fresh context and re-executing
   `actions.jsonl` against a chosen build, reporting step-level divergence —
   reproducing a bug on the same build, or confirming a fix on a newer build.

Bundles are synthetic-data-only and gitignored; CI keeps artifacts 7 days;
bundles persist beyond that only as attachments to filed defects.

## Isolation rules

- **One writer per origin**: OPFS SQLite holds one lock per origin, so all UI
  lanes run `workers: 1` — parallel lanes need separate origins/ports.
- **`EXPO_PUBLIC_*` is build-time**: different backends require separate
  exports — `dist/` (no Supabase env), `dist-sync/` (dummy env, main/nightly
  only, never PRs), `dist-live/` (disposable env, guarded job only). All three
  are gitignored. **Never real credentials in any build.**
- **Outputs are derived**: `simulation-output/` (run reports, screenshots,
  digests, traces, repro bundles), `simulation/.build/`, and
  `simulation/backend/state/` are gitignored. CI uploads `simulation-output/`
  with 7-day retention.
- **Hard production isolation** (disposable lane): `simulation/backend/guard.ts`
  aborts before any build/network call on production host, ambient production
  credentials, or a missing disposable marker; the `dist-live/` export is
  produced only inside the guarded job.
- **The harness serves one dist per server instance, on separate ports**:
  `scripts/serve-e2e.js` supports `--port`/`--dist` (defaults 8081, `dist/`).
  The dedicated **`journeys-sync` Playwright project** is registered in
  `playwright.config.ts` (grep `/@sync/` over `e2e/journeys/`) and serves
  `dist-sync/` on `:8082` via its own webServer. The lane is opt-in through
  `npm run e2e:sync` (main/nightly CI builds `dist-sync/` first, then runs it)
  and stays out of the default `npm run e2e` run, so PR feedback never waits on
  the dummy-env build. The sync journeys that need that build run against it
  there.

## Baselines and budgets (recorded local measurements — CI numbers pending)

The PR lane additions were timed on the authoring machine (local measurement,
labeled honestly; the CI-hardware numbers are filled in after the first CI
runs):

- `npm run e2e:journeys:p0` (J1, J2a, J2b): **~33–35 s** (12 passed, J2b's
  CG-1 steps skipped as `fixme`). One run flaked on J1 step 6's timer-parse
  assertion and passed on the immediate re-run — a parent-journey-spec flake
  (CI retries = 2 mask it), filed attention; not fixed here.
- `npm run sim:run -- --mode deterministic --scenario @p0`: **~37 s** (incl. the
  `tsc` compile). Today the `@p0` tag selects the `smoke` self-test only — the
  library's journey/composite scenarios use `journey` / `composite` tags and
  join the PR subset when they are tagged `@p0`.
- Combined PR-lane addition ≈ **70–75 s**, far under the 10-minute
  `scenarios-pr` budget (`matrix.ts` `budgetMs: 600_000`). A budget miss is
  triaged (subset trimmed or budget revisited), never silently absorbed
  (task 9.4).

Parent task 6.2 — J8 responsiveness baselines (recorded from the J8 journey
header, local measurements on the authoring machine; **CI-hardware baseline
still pending** — measurement on CI was not possible in this environment):

| D14 provisional ceiling     | Measured locally (J8, HEAVY)                  | Headroom |
| --------------------------- | --------------------------------------------- | -------- |
| cold Overview ≤ 5000 ms     | 219–547 ms                                    | ≥ 9×     |
| section switch ≤ 800 ms     | 436–518 ms (max over 6 switches; all mounted) | ≥ 1.5×   |
| diary search input ≤ 500 ms | 232–327 ms                                    | ≥ 1.5×   |
| saved-meal picker ≤ 500 ms  | 37–73 ms                                      | ≥ 7×     |

Every ceiling clears locally with ≥ 3× headroom (cold start aside). If CI turns
out slower, re-measure and file a performance defect per D14 — the ceiling is
not raised to make it pass.

## Model layer (this change, tasks 1.1–1.6)

- `simulation/model/types.ts` — `Persona`, `Scenario`, `Workflow`, `SemanticStep`
  (discriminated union keyed on `kind`), `Oracle`, `BehaviorParams`, `RunMode`,
  plus the section/surface/feature/sync-entity name unions.
- `simulation/model/builders.ts` — `definePersona()`, `defineWorkflow()`,
  `defineScenario()`, `defineModel()` with sensible defaults (deterministic,
  no-mistakes behavior; `SMALL` fixture; `deterministic` mode).
- `simulation/model/steps.ts` — the semantic-step catalog: every step kind's
  category, mutating flag, and the parent helper(s) it resolves to.
- `simulation/model/validate.ts` — `validateSimulationModel()`: pure,
  returns an array of `ValidationIssue`s (empty = valid).

### Validation rules implemented

1. **Required fields** — a persona needs `id`/`name`/`description`/`goals` and a
   behavior object; a scenario needs `id`/`personaId`/`goal`/`steps`; a workflow
   needs `id`/`steps`; every step must be a known kind; every oracle must be a
   known kind.
2. **Unknown feature/section names** — `behavior.featureAffinity` keys must be
   known feature names; `switchSection.tab` and `expectAcrossSurfaces.tabs`
   must be known sections.
3. **Out-of-range behavior params** — all rates must be in `[0, 1]`; think-time
   `minMs >= 0`, `maxMs >= minMs`, `sigma >= 0`; session-length
   `minMinutes >= 0`, `maxMinutes >= minMinutes`.
4. **Oracle-less mutating steps** — a mutating step must declare at least one
   oracle, and at least one of them must be a persisted-row or second-surface
   check (`rows` or `across-surfaces`). A bare toast or list re-render is never
   the only evidence.
5. **Dangling references** — `scenario.personaId` must resolve to a persona in
   the model; every `scenario.workflows[].workflowId` must resolve to a workflow
   in the model.

## Building and testing

The model layer is pure TypeScript with no runtime dependencies. It is covered
by `tests/simulation.model.test.ts` (Vitest, unit project):

```bash
npm run typecheck               # 0 errors
npm run test:unit               # includes tests/simulation.model.test.ts
```

## Runner + observability (tasks 3.1–3.5, 4.1–4.4)

The runner executes a scenario's step graph through Playwright against the
served `dist/` export, resolving every `SemanticStep` to a parent-harness
helper or a runner-owned interaction (the full mapping is documented in
`simulation/runner/execute.ts`). It is wired to the behavior engine
(`simulation/behavior/`, task 2): think times and injections come from
`buildRunPlan`, so a fixed seed replays a run bit-for-bit at the action level.
The executor blocks service workers in its private browser contexts. This lane
qualifies app behavior and SQLite persistence; PWA service-worker lifecycle is
covered by the dedicated infrastructure and `pwa` Playwright projects. Keeping
workers out of the repeated DB-harness round trips prevents Chromium renderer
retention during long-history runs.

```
simulation/runner/   execute.ts (scenario executor), actions.ts (step resolution),
                     apiLeg.ts (data-layer legs + raw-SQL guard), cli.ts (CLI),
                     library.ts (scenario-library loader), selfTest.ts (smoke model),
                     specs/selfTest.spec.ts (Playwright self-test, task 3.4)
simulation/observe/  report.ts (run-report.json schema + validator, task 4.1),
                     artifacts.ts (output layout + retention, task 4.2),
                     digest.ts (failure-digest Markdown, task 4.3)
```

### CLI

```bash
npm run sim:validate                       # model validation only (exit non-zero on issues)
npm run sim:run -- <args>                  # run the scenario library
npm run sim:run -- --self-test             # task 3.5/4.4 verification matrix
npm run sim:run -- --scenario smoke --mode seeded --seed 0x5e1f7e57
```

`sim:run` filters by `--scenario` (id substring or tag), overrides mode/seed
with `--mode`/`--seed`, and targets a custom origin with `--base-url`. The
runner needs the web export served at `http://localhost:8081` (`node
scripts/serve-e2e.js` or the Playwright `webServer`).

### Exported runner API

`executeScenario({ scenario, model, mode?, seed?, browser?, baseUrl?, lane?,
onStep? })` → `{ runId, report, reportPath, digestPath?, actionLog, mode, seed }`.
`expandScenarioSteps(model, scenario)` → ordered steps (workflows expanded,
`{{param}}` placeholders bound). `engineSeedFromString(seed)` → the numeric
engine seed for `buildRunPlan`.

### run-report.json schema (task 4.1)

`{ schemaVersion, runId, lane, mode, seed, environment, persona, scenario,
startedAt, finishedAt, outcome, durationMs, actionLog, steps[], artifacts,
failure? }` — validated by `validateRunReport(report)` (pure, unit-tested in
`tests/simulation.report.test.ts`). One schema across all lanes (scenario /
seeded / repro) per task 4.4.

### Artifacts (task 4.2) + digest (task 4.3)

Output lives under the gitignored `simulation-output/<runId>/`: per-step
screenshots always; video/trace/console.log retained only on failure; a
`digest.md` failure digest on failure (persona, scenario, step, seed, expected
vs actual, state summary, artifact links) formatted to paste into a defect
issue.

### apiLeg (task 3.2)

`apiLeg` steps perform real data-layer writes through the DB harness (the
parent's seeding mechanism — the web export exposes no data-layer bridge).
`assertApiLegSafe` rejects raw SQL strings in `functionName`/`args` (unit-tested
in `tests/simulation.apileg.test.ts`); the Supabase-client resolution is a
disposable-lane (task 8) seam.

### Self-test (tasks 3.5 / 4.4)

`simulation/runner/specs/selfTest.spec.ts` (Playwright `simulation` project)
and `npm run sim:run -- --self-test` both assert: the smoke scenario runs twice
in `deterministic` mode with identical action logs, and scenario/seeded/repro
reports all pass `validateRunReport`.
