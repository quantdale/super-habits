## Why

SuperHabits already has a strong deterministic journey and seeded simulation platform, but an autonomous coding agent still has to rediscover how to interpret a failure, which checks a change affects, and where browser evidence is stored. A small operational layer can make the existing system easier to trust without replacing its Playwright, SQLite, journey, or simulation architecture.

## What Changes

- Add a shared Playwright fixture that records actionable console, page-error, and failed-network evidence on unexpected test failures.
- Retain Playwright traces on failures, and replace selected fixed sleeps with observable conditions while documenting waits that intentionally model elapsed time.
- Add a structured failure-classification contract and triage guidance covering product bugs, test bugs, flakes, environment failures, known gaps, and specification ambiguity.
- Add a machine-readable changed-file-to-test impact map and memorable QA gate commands for fast, affected, journey, simulation, timezone, and full validation.
- Add a deterministic timezone-matrix command for date-sensitive unit and integration coverage.
- Update the authoritative agent/testing guidance with the escalation loop, evidence rules, and forbidden ways to hide failures.

## Capabilities

### New Capabilities

- `autonomous-qa-foundation`: Shared failure observability, formal triage representation, deterministic synchronization guidance, QA gates, impact mapping, and timezone validation for agent-driven development.

### Modified Capabilities

- None.

## Impact

- Playwright configuration, E2E fixtures/helpers, selected E2E synchronization points, simulation report types, and focused Vitest coverage.
- `package.json`, `scripts/`, and a new `qa/impact-map.json` for agent-facing commands and scope selection.
- `docs/testing/` and `AGENTS.md`; no application product behavior, database schema, sync semantics, or external dependencies change.
