## Purpose

This capability keeps the shipped Momentum Garden correct and predictable
under long-running use, bounded history, reloads, accessibility settings, and
current-source qualification without changing its derived product model.

## ADDED Requirements

### Requirement: Long-running interactions remain stable

The application and its deterministic verification lane MUST preserve the
semantic ability to start and reset a Focus session after the full supported
long-running scenario. A failure MUST be reproduced and classified before it
is treated as an environmental or test limitation.

#### Scenario: Long deterministic scenario reaches Focus

- **WHEN** the full deterministic scenario is run from a fresh build through
  the previously failing late sequence
- **THEN** the semantic `Start focus` action becomes available and completes
  without an arbitrary timeout or an unexplained late-sequence failure

#### Scenario: Repeated late-sequence replay is stable

- **WHEN** the preserved failing sequence is replayed repeatedly from fresh
  deterministic state
- **THEN** the result is stable and any failure has a recorded repository
  taxonomy classification, action log, and replay artifact

### Requirement: Existing habit semantics are preserved across bounded reads

The bounded Garden history input MUST NOT change callers that require full
habit history. Scheduled days, lifecycle masking, target completion, local
date boundaries, and omitted/default range behavior MUST remain equivalent to
the pre-Garden semantics.

#### Scenario: Full-history caller remains unchanged

- **WHEN** a streak, insight, restore, command, or Habit UI caller requests
  habit completion history without a bounded start date
- **THEN** it receives the same eligible scheduled-day results as before the
  bounded Garden parameter was introduced

#### Scenario: Garden window excludes older history only for Garden work

- **WHEN** a Garden query supplies a local window start and completion/rule
  history exists before and inside that window
- **THEN** the Garden calculation ignores only the older facts while other
  full-history callers continue to see them

### Requirement: Garden reads remain bounded and read-only

Momentum reads MUST use one local database boundary with bulk, date-bounded
queries, explicit limits for high-volume timestamp sources, and no per-habit
or per-record N+1 query. Viewing or refreshing Garden MUST NOT mutate source
rows, sync outbox rows, backup state, account ownership, or feature state.

#### Scenario: Long history does not create an unbounded read

- **WHEN** the user opens Today or the 7/28-day Garden detail on a dataset with
  history substantially older than the requested window
- **THEN** source queries remain bounded to the requested local-date range and
  documented row caps, and old rows cannot alter the current model

#### Scenario: Viewing leaves persistence unchanged

- **WHEN** the user opens, reloads, refreshes, and repeatedly toggles Garden
  detail views
- **THEN** authoritative source rows and the durable sync outbox are bytewise
  unchanged apart from unrelated application actions performed by the user

### Requirement: Overview and Progress remain responsive and race-safe

The canonical Overview content MUST render independently of Garden latency or
failure. Garden responses MUST be scoped to the current mounted/date context,
must not overwrite newer results after unmount or a later request, and must
preserve neutral/error states and existing Planning Hub Progress behavior.

#### Scenario: Slow Garden read does not block Overview

- **WHEN** canonical Overview facts are ready but the Garden read is delayed
  or fails
- **THEN** the existing Overview facts remain usable and Garden shows a
  bounded loading, neutral, or error state without corrupting them

#### Scenario: Stale response cannot replace a newer view

- **WHEN** the user switches sections, crosses a local day boundary, or opens
  and closes Progress while an earlier Garden read is pending
- **THEN** a stale response is ignored and the mounted view shows only the
  current request's model or an honest current-state fallback

### Requirement: Qualification evidence covers the supported surfaces

The campaign MUST produce reproducible evidence for the affected unit,
real-SQLite, browser, deterministic simulation, timezone, theme, and
current-source Android lanes selected by repository impact rules. Native build,
device, and iOS limitations MUST be classified explicitly rather than claimed
as passing.

#### Scenario: Web and simulation regression remains green

- **WHEN** the fresh static web export is exercised through the focused Garden
  journey, P0 journeys, and the required deterministic simulation library
- **THEN** the required assertions pass with no hidden late-sequence timeout,
  or each remaining failure has preserved evidence and one repository taxonomy
  classification

#### Scenario: Android lane is run sequentially

- **WHEN** the current source requires Android provisioning before native
  flows
- **THEN** provisioning, install, smoke, persistence, targeted, and lifecycle
  commands execute one at a time against the verified target, with reports and
  exact replay commands retained

### Requirement: Hardening does not expand persistence or product scope

The campaign MUST NOT introduce a Momentum event table, migration, sync,
backup, restore, portable-export, account-ownership, remote-service, opaque
score, or durable Garden-preference contract.

#### Scenario: Recovery boundaries remain source-driven

- **WHEN** backup, restore, account inspection, or portable export/import is
  run after Garden viewing
- **THEN** no Garden-specific row or boundary record exists and the Garden can
  be reconstructed from restored authoritative source data
