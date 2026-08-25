## Context

The predecessor change `add-momentum-garden-v1` is complete at baseline
`0187b98`. It added a derived Momentum read model, a bounded habit-window
argument, asynchronous Overview integration, Progress detail, simulation
locator support, and focused evidence. Its completion record intentionally
left a long-run deterministic `Start focus` timeout, incomplete native
qualification, and broader performance/regression coverage for this campaign.

The repository is an offline-first Expo/React Native/PWA app. SQLite is the
source of truth, `getDatabase()` is the singleton entrypoint, local dates are
created through sanctioned time helpers, and the Garden must remain outside
all mutation, sync, backup, restore, account, and portable-export boundaries.

## Goals / Non-Goals

**Goals:**

- Reconcile the fetched `main` state and establish evidence from the exact
  predecessor baseline.
- Trace changed contracts into all callers, reproduce the late simulation
  failure, and repair repository-caused defects with regression tests.
- Measure bounded read behavior and repeated UI operations before deciding on
  optimization.
- Prove current web, simulation, persistence, timezone, theme, sync/restore,
  and sequential Android behavior, preserving classifications and artifacts.
- Leave a resumable Version-2 ExecPlan and an exact-SHA delivery report.

**Non-Goals:**

- Reimplementing or reopening Momentum Garden V1.
- Adding a momentum event ledger, migration, cache silo, sync/backup/export
  entity, remote service, durable preference, score, XP, punishment, or social
  mechanic.
- Broad cleanup of unrelated Medium/Low debt or duplicating the entire web
  matrix in native flows.

## Decisions

### 1. Treat current source and preserved failure evidence as authoritative

The campaign starts from the fetched remote tip and records the exact
predecessor baseline, incoming commits, changed files, and impact gates. The
predecessor artifacts remain historical. New findings and evidence live in
this change and its ExecPlan.

**Alternative considered:** reopening or editing the completed predecessor.
Rejected because it would erase the distinction between shipped feature work
and subsequent qualification.

### 2. Reproduce before classifying or changing synchronization

The long-run `Start focus` timeout is replayed from a fresh build with its
scenario, seed/action sequence, state snapshots, and runner artifacts. The
audit follows the semantic launcher, active section, timer state, database,
viewport, and accumulated asynchronous work. A retry alone cannot establish
`FLAKY_TEST`; a source-level defect is fixed at its origin, while a test or
environment issue receives a focused, evidence-backed correction or explicit
classification.

**Alternative considered:** increase the timeout or add a blind sleep. Rejected
because the QA rules require observable synchronization and that would hide
the cause.

### 3. Preserve default full-history behavior with an explicit bounded seam

The new habit range parameter remains optional. The full-history path is
verified against existing streak, insight, restore, command, and UI callers;
only Momentum supplies its local window start. Any hardening change keeps
canonical schedule/lifecycle resolution in the domain layer and uses local
calendar boundaries.

**Alternative considered:** make every caller bounded for speed. Rejected
because it would silently alter historical streak and progress semantics.

### 4. Measure the read path with a testable observation boundary

Performance evidence uses representative empty, typical, and long-history
fixtures, repeated samples, query counts where the harness permits them, and
the existing impact/performance scripts. Optimize only a proven regression or
material waste. Read-only integration tests compare source/outbox state before
and after Garden reads.

**Alternative considered:** add speculative memoization or persistent cache.
Rejected because it adds invalidation and recovery state without evidence of a
need and violates the derived-source boundary.

### 5. Run native commands serially on the documented target

Native prebuild/provision/install and Maestro lanes are separate sequential
commands. The verified API-36 x86_64 target and package provenance are
recorded. Missing tools or iOS-on-Windows remain `ENVIRONMENT`; a collision
created by concurrent local commands is not an acceptable final blocker.

### 6. Use the repository taxonomy and keep partial evidence visible

Every failure is assigned exactly one of `PRODUCT_BUG`, `TEST_BUG`,
`FLAKY_TEST`, `ENVIRONMENT`, `EXPECTED_KNOWN_GAP`, or `SPEC_AMBIGUITY` only
after reproduction. Reports, traces, repro bundles, screenshots, seeds, and
replay commands are retained. A gate is not called green from a narrow retry
when the required scope is broader.

## Risks / Trade-offs

- [Risk] The long simulation may expose a pre-existing unrelated timeout. →
  Mitigation: preserve the original sequence and compare a clean pre-Garden
  control where practical; classify rather than weakening the assertion.
- [Risk] Additional profiling fixtures may perturb OPFS or native locks. →
  Mitigation: run SQLite/browser workers serially and isolate temporary data;
  preserve the first failure artifacts.
- [Risk] Android build or device state may be unavailable. → Mitigation:
  preflight the documented target, record the exact environment blocker and
  replay command, and never report native PASS without executed evidence.
- [Risk] Async Garden loads could race day rollover or unmount. → Mitigation:
  use request/context guards, add focused lifecycle tests, and preserve the
  canonical Overview load path as independent.

## Migration Plan

No schema or data migration is planned. Product code changes, if required,
are backward-compatible repairs to existing read/UI/test boundaries. Rollback
is a normal commit revert; no user data transformation is needed.

## Open Questions

None. Any failure classification is evidence-driven within the fixed
taxonomy; it does not change the campaign's product scope.
