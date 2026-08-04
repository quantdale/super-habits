# AI Exploratory Lane — Runbook

`add-user-simulation-platform` task 7.3. How to execute an AI mission with an
external Playwright-MCP-capable agent runtime, what build it runs against,
where reports land, and how findings are triaged.

## What this lane is

The AI exploratory lane (design D7) runs **mission files** —
`simulation/ai/missions/*.md`, each pairing a persona with an open objective, a
budget, a starting fixture, and an anomaly rubric. A mission is an objective,
**never a script**: the agent explores like the persona and stops at the
budget; there are no prescribed steps. The executor is an **external agent
runtime** (this CLI or any Playwright-MCP-capable agent), not a build in this
repo — no LLM SDK or runtime dependency is added here.

The lane **never gates anything** (D7): PR feedback is untouched, and the
deterministic suite remains the gate. Missions are on-demand or nightly at
most, and their cost, latency, and non-determinism are quarantined to that
schedule.

## Prerequisites

- Node + this repo installed (`npm install`).
- A Playwright-MCP-capable agent runtime outside the repo (e.g. this CLI with
  browser tooling, or an equivalent that can drive Chromium and evaluate in the
  page).
- The Chrome/Chromium browser Playwright uses (`npx playwright install
  chromium` if not already present).

## Running a mission

### 1. Build the standard web export

```bash
npm run build:web        # npx expo export -p web → dist/
```

Missions always run against the **standard `dist/` export** (fake-backed,
Supabase-optional) — the same build the E2E suite uses. The disposable-backend
`dist-live/` build exists for the backend lane only and is never used here.

### 2. Serve `dist/` with the E2E static server

```bash
node scripts/serve-e2e.js   # http://localhost:8081 (COOP/COEP for SQLite WASM)
```

The OPFS single-writer constraint applies: **one browser context per origin at
a time** — run one mission at a time, never parallel contexts against the same
serve.

### 3. Open the app and prepare the fixture

Point the agent runtime's browser at `http://localhost:8081`. Load the app once
so the real schema bootstraps, then reset/seed per the mission's **Fixture**
line. Fixture prep is the operator's job, using the repo harness
(`e2e/helpers/reset.ts` → `resetAll(page)`, `e2e/helpers/seed.ts` →
`seedFixture(page, 'TYPICAL')`) — for example via a temporary seeding spec
under `e2e/` that both loads and seeds and then idles. Missions that start from
a **fresh origin** (e.g. `new-device-migrator-restore`) need only the reset.

The mission's **Interaction vocabulary** names the sanctioned way to drive the
app: the single-page shell has **no URLs** — drive it through tab taps, the
Settings modal, and the Command Center overlay, interacting with visible labels
as a human would. Do not use `data-testid` selectors, and do not call
data-layer functions directly unless the mission says so.

### 4. Hand the mission to the agent and let it explore

Give the agent the mission file's **Objective, Fixture, Budget, and rubric**
(nothing more — the mission itself is the prompt). The agent:

- behaves as the persona within the time budget,
- stops at the budget (a mission that runs out of time is stopped, not rushed),
- **records what it actually observed — never fabricates**: no invented
  console errors, screenshots, or state; a run that finds nothing is a
  "no-findings" run, not a padded report,
- writes one `anomaly-report.json` per anomaly plus a `narrative.md`.

### 5. Validate the reports

Every written `anomaly-report.json` must pass
`validateAnomalyReport` / `parseAnomalyReport` from
`simulation/ai/anomaly-report.ts` (unit-tested in
`tests/simulation.anomaly.test.ts`). Example, with the repo's test runner:

```bash
npx vitest run --project unit tests/simulation.anomaly.test.ts
```

A report that fails validation is rejected before triage — the writer fixes it.

## Where reports land

All lane output lives under `simulation-output/` (gitignored — the gitignore
entry lands with the platform's artifact tasks 4.2 / 5.4; until then, never
commit these files):

```
simulation-output/ai/
  <mission-id>/<YYYY-MM-DD>_<run-tag>/
    anomaly-report.json     # 0..N, one file per anomaly (schema: anomaly-report.ts)
    no-findings.md          # one, when nothing was reportable (a valid result)
    narrative.md            # the agent's free-form narrative
    trace.zip               # optional — repro evidence
    screenshots/            # optional — repro evidence
    console.log             # optional — repro evidence
```

`anomaly-report.json` carries the repro evidence (trace + persisted state
paths) the triage rule needs; the paths are relative to that run's directory.
Naming the run directory `YYYY-MM-DD_<run-tag>` keeps a mission's history
comparable across dates.

## The triage rule

Every anomaly is decided into **exactly one** of three outcomes, and the
decision is written back into the report's `triage` object (rule inherited
from the parent's findings convention, D7). An anomaly never evaporates.

1. **`defect-change`** — a reproducible defect. File it as a separate change
   (the platform never fixes defects in-repo), set `triage.outcome =
   'defect-change'`, `triage.reference` = the change id, attach the run's
   repro evidence.
2. **`deterministic-scenario`** — new deterministic behaviour worth locking
   in, or an anomaly that reproduces cleanly. Add it to the scenario library /
   journey suite as a **deterministic** scenario and reference its id.
   (Reproducibility rule from the design: before filing a defect from a real
   anomaly, the behaviour must reproduce deterministically at least once on a
   fresh reset.)
3. **`documented-non-issue`** — investigated and judged a non-issue. Document
   it (in the known-gap register or the run's narrative), `triage.reference` =
   the entry, with a note on why.

Special case — **known gaps**: an anomaly that matches a decided contract gap
(CG-1 `fix-day-rollover-refresh`, CG-2 `fix-restore-emptiness-counts-deleted-
rows`) or an already-filed finding is referenced, not re-filed: put the gap/
change id in `triage.reference` and triage accordingly.

A "no-findings" run is still recorded (`no-findings.md`) so the area is
provably explored. A mission that chronically finds nothing is **retired, not
kept as ceremony** (design risk section).

## CI wiring — open question (task 7.5)

Automating missions in CI is **deliberately not wired in this change**:

- **Runtime**: which agent runtime CI would invoke — this CLI pinned at a
  version, or a dedicated GitHub Action driving Playwright-MCP — is
  undecided. This repo adds no LLM SDK (D7), so the runtime lives outside the
  repo and ships separately.
- **Credentials**: an agent runtime may need API credentials; nothing may be
  stored in `EXPO_PUBLIC_*` (build-time, public by design) and no real secrets
  belong in this repo's CI config. How CI would supply scoped credentials to
  the external runtime is part of the same open question.
- **Schedule**: once resolved, the lane may run **nightly or on-demand only** —
  it **never gates** on PRs (D7: non-determinism, cost, latency are
  quarantined to that schedule; the deterministic suite stays the gate).

Until then, missions run locally/on-demand per this runbook. The v1 deliverable
is the mission set + the report schema; CI wiring follows in a later change.

## Checklist for one mission

1. `npm run build:web`; `node scripts/serve-e2e.js`.
2. Open one browser context on `http://localhost:8081`; reset and seed per the
   mission's fixture.
3. Give the agent the mission file; it explores within the budget.
4. Validate every `anomaly-report.json` (validator, not eyeballs).
5. Triage every anomaly into one of the three outcomes, writing `triage` back;
   record `no-findings.md` when applicable.
