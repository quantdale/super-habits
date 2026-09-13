## Why

Momentum Garden V1 shipped as a derived, read-only feature, but its final
release evidence recorded three material gaps: a repeatable long-run
simulation timeout while starting Focus, incomplete current-source Android
qualification, and deferred whole-application performance and regression
proof. This campaign closes those gaps without reopening the predecessor
feature or changing its product model.

## What Changes

- Audit every changed contract and caller introduced by Momentum Garden,
  especially bounded habit completion history, asynchronous Overview reads,
  and the simulation interaction helper.
- Reproduce and classify the long-run `Start focus` failure, preserve its
  evidence, and repair the repository-caused root cause with regression proof.
- Measure Overview and Planning Garden reads on empty, typical, and long
  histories, including repeated refreshes and 7/28-day toggles; repair any
  material regression or unbounded/N+1 work.
- Run fresh deterministic browser, integration, timezone, theme, sync/restore
  isolation, and P0/full E2E qualification selected by the impact map.
- Run the supported Android provisioning, smoke, persistence, targeted, and
  lifecycle lanes sequentially, preserving reports and classifying unavailable
  platform capabilities honestly.
- Update hardening documentation, known gaps, QA mapping, and a Version-2
  ExecPlan with exact commands, artifacts, classifications, and final Git
  delivery evidence.
- Preserve the existing derived/read-only Garden architecture: no event
  ledger, migration, sync/backup/export entity, remote service, opaque score,
  or durable preference.

## Capabilities

### New Capabilities

- `momentum-garden-hardening`: Release-quality correctness, boundedness,
  read-only isolation, long-run stability, accessibility, and qualification
  evidence for the shipped Momentum Garden and its supporting callers.

### Modified Capabilities

- None. The shipped `momentum-garden` product requirements remain unchanged;
  this change adds hardening and verification contracts around them.

## Impact

- `features/momentum/`, `features/habits/habits.domain.ts`, Overview and
  Planning Hub refresh callers, and the simulation runner may change only when
  the audit demonstrates a real defect or waste.
- Focused and broader Vitest, real-SQLite, Playwright, simulation, and native
  evidence will be added or updated without weakening existing assertions.
- `docs/testing/known-gaps.md`, `qa/impact-map.json`, and campaign artifacts
  may be updated to match proven behavior.
- No database schema, backup/sync contract, portable format, dependency, or
  primary navigation change is planned.
