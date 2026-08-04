# AI Lane — Execution Status

`add-user-simulation-platform` task 7.4.

## Status: NOT EXECUTED — externally blocked

Missions **have not been executed** in this change. No `anomaly-report.json`
exists, and no anomaly has been triaged. Nothing below implies a run happened.

The blocker is environmental (design D7): executing a mission requires an
**LLM-capable browser-agent runtime** — a Playwright-MCP-capable agent that can
drive Chromium against the served `dist/` build and act on the mission's open
objective. No such runtime is available in this environment. The repo itself
deliberately contains none (D7 rejects embedding an LLM SDK or agent loop; the
lane is driven from outside). Faking a run — inventing console errors,
screenshots, or state — is forbidden and was not done.

## What was delivered instead

- The mission set (task 7.2): `simulation/ai/missions/*.md` — four open
  objectives (error-prone user in Todos+Calories, new-device restore attempt,
  power-user linked actions, daily driver across simulated midnight), each with
  persona, fixture, budget, and rubric and **no prescribed steps**.
- The report schema + validator (task 7.1): `simulation/ai/anomaly-report.ts`,
  unit-tested in `tests/simulation.anomaly.test.ts`.
- The runbook (task 7.3): `simulation/ai/RUNBOOK.md` — how to execute, against
  which build, where reports land, the triage rule, and the CI-wiring open
  question (task 7.5).

## How a maintainer would execute them

1. `npm run build:web` and serve `node scripts/serve-e2e.js` (runs `dist/` on
   `http://localhost:8081` with COOP/COEP).
2. Provide a Playwright-MCP-capable agent runtime (this CLI or equivalent).
3. For each mission: open one browser context (OPFS single-writer), reset/seed
   the fixture, hand the agent the mission file, and let it explore within its
   budget.
4. Validate every produced `anomaly-report.json` with `parseAnomalyReport`
   from `simulation/ai/anomaly-report.ts`.
5. Triage every anomaly per the rule: `defect-change` /
   `deterministic-scenario` / `documented-non-issue` (write the `triage` block;
   re-map known gaps CG-1/CG-2 to their companion changes). Record
   `no-findings.md` for clean runs.

Full detail: `simulation/ai/RUNBOOK.md`.

## Why the lane still lands without a run

The lane is **non-gating by design** (D7, D10): missions are on-demand/nightly,
never gate PRs, and the deterministic suite stays the gate. The deliverables
that gate — the schemas, validator, and tests — are verified in-repo
(`npm run typecheck`, `npm run test:unit`). The execution itself is exactly
the part D7 keeps external. When an agent runtime is available, findings flow
through the same triage rule and are recorded here.

## File/recorded on

- Artificial reports: none exist.
- Triage decisions: none exist.
