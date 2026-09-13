## Context

The repository has separate Vitest unit/integration projects, Playwright feature and journey projects, and a typed simulation runner with seeded repro bundles. Playwright's built-in screenshot/trace facilities already own the heavy browser artifacts, while the simulation runner already captures console/network data for scenario failures. The missing layer is mostly shared E2E failure context, operational triage, and agent-facing test selection.

## Goals / Non-Goals

**Goals:**

- Make unexpected standard E2E failures self-describing without exposing secrets.
- Keep deterministic verification separate from seeded/exploratory discovery.
- Provide a small, reviewable impact map and command surface.
- Strengthen synchronization at reusable helper boundaries and preserve intentional elapsed-time modeling.
- Validate local-calendar date behavior in representative timezones.

**Non-Goals:**

- Replacing the existing journeys or simulation platform.
- Adding a new browser dependency, AI runtime, live staging service, or native E2E framework.
- Changing product behavior, SQLite schema, sync contracts, known-gap semantics, or CI lane gating policy.
- Making visual snapshots or arbitrary retries part of correctness gates.

## Decisions

1. **Use a custom Playwright `page` fixture for standard E2E diagnostics.**
   All root E2E specs and the journey declaration helper can import one local fixture while retaining Playwright's built-in `page` behavior. The fixture attaches a bounded JSON artifact only for unexpected failures. The journey helper also attaches equivalent diagnostics for its manually managed continuity page, including persona/fixture/clock and ordered-step metadata. This is preferable to a large reporter-only solution because it can observe page console, page-error, response, and request-failure events while the page is alive. Local server reuse is opt-in and an explicit E2E port is supported so an unrelated Expo development server cannot silently become the system under test.

2. **Retain built-in Playwright artifacts on failure.**
   Change the shared trace policy to `retain-on-failure` and keep screenshots failure-only. Video remains off unless existing project policy changes; traces and focused diagnostics provide the useful signal without making every run expensive.

3. **Keep triage as a pure, serializable contract.**
   A small module defines the six allowed classifications, triage record validation, and an explicit untriaged state for reports that still need human/agent analysis. It does not guess that a retry proves flakiness. Simulation reports and digests can reference the same contract without embedding a classifier.

4. **Represent impact as data, not dependency analysis.**
   `qa/impact-map.json` contains ordered glob rules and gate labels. A Node script resolves the union of matching rules from `git diff --name-only` or explicit paths and prints JSON plus a concise human plan. Unknown files receive a conservative static/full-regression recommendation.

5. **Use existing tests for the timezone matrix.**
   A sequential Node script spawns the repository's existing targeted Vitest command under each required `TZ`, preserving the established assertions and real-SQLite harness. No timezone-specific expected values are changed.

6. **Refactor only observable helper waits in this change.**
   App readiness and service-worker cleanup can wait on explicit state. Real timer duration, network backoff, touch/gesture completion, and bounded polling remain with comments explaining the modeled contract; a broad mechanical sleep rewrite would make those tests less truthful.

7. **Isolate service-worker behavior from feature-test harness routing.**
   The standard feature project blocks service workers so a registered worker
   cannot bypass Playwright's same-origin OPFS harness route. The infrastructure
   spec opts into worker control and remains the explicit service-worker lane.

## Risks / Trade-offs

- [Risk] A custom fixture could miss tests that import Playwright directly. → Migrate all root E2E specs and the journey registration helper; simulation runner diagnostics remain its existing path and are covered separately.
- [Risk] Diagnostics can grow if pages emit noisy logs. → Bound event buffers and capture only error/warning, page-error, failed-request, and non-success response summaries; never capture bodies or headers.
- [Risk] The impact map can become stale. → Add a validation test for schema shape and document that new feature modules must add a rule; use conservative fallback behavior for unmatched paths.
- [Risk] Running five timezone subprocesses increases local validation time. → Keep it opt-in and targeted to date-key tests; do not add it to every PR's default fast gate.
- [Risk] Existing intentionally timed tests remain vulnerable. → Keep their comments and known-gap references visible; future changes can replace them when an observable oracle exists.

## Migration Plan

1. Add the fixture, classification contract, impact map/scripts, and tests.
2. Migrate E2E imports and update selected waits/configuration.
3. Add agent documentation and package commands.
4. Run the fast, unit/integration, timezone, deterministic E2E/simulation, and OpenSpec validations.
5. Rollback is file-level: remove the new fixture/scripts/docs and restore the trace policy; no persisted user data or schema migration is involved.
