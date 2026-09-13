## 1. Failure observability

- [x] 1.1 Add the shared Playwright fixture that captures bounded console, page-error, and failed-network diagnostics on unexpected failures.
- [x] 1.2 Migrate root E2E specs and the journey registration helper to the shared fixture without weakening assertions.
- [x] 1.3 Retain Playwright traces on failure, isolate local E2E server reuse/ports, and add focused fixture/report tests or validation for the artifact contract.

## 2. Determinism and triage

- [x] 2.1 Replace the reusable app/database readiness sleeps with readiness-marker or observable-state waits; document intentional elapsed-time waits that remain.
- [x] 2.2 Add the six-value failure-classification contract, validation helpers, and Vitest coverage.
- [x] 2.3 Include triage guidance and replay/evidence requirements in the failure digest or agent-facing testing documentation.

## 3. Agent-facing QA selection

- [x] 3.1 Add and validate the machine-readable changed-file impact map plus a read-only resolver command.
- [x] 3.2 Add concise package QA gate commands for fast, integration, journeys, deterministic simulation, timezone matrix, impact inspection, and full regression.
- [x] 3.3 Implement the representative timezone matrix command and verify the required zones run sequentially.

## 4. Documentation and validation

- [x] 4.1 Update authoritative agent/testing instructions with the escalation workflow, failure classification, evidence rules, and forbidden shortcuts.
- [x] 4.2 Add documentation for remaining intentional waits, quarantined gaps, and the distinction between verification and exploration.
- [x] 4.3 Run typecheck, lint, unit/integration tests, OpenSpec validation, impact validation, timezone matrix, deterministic E2E, and deterministic simulation; record external lanes as blocked rather than fabricated.
