# Design: Warm Momentum 2.4 — Reliability, Heavy-State Performance, Completion

## Context

- WM2.3 closed data-entry determinism (commit `7a0983b`) and left three
  artifacts this campaign builds on: the workbox `waiting` crash evidence
  (diagnostic trace), the P2 journey now green (704ms/800ms ceiling), and
  the retrospective note "main/nightly-only lanes rot silently".
- `core/pwa/registerServiceWorker.ts` uses workbox-window 7.3.0 with a
  `registered` module flag, `applyServiceWorkerUpdate`, and
  `messageSkipWaiting`; the crash is inside workbox's
  `register()` promise chain (`this._registration.waiting` after
  `navigator.serviceWorker.register()` resolves `undefined` during a
  reload race).
- Journey helpers define their own tab-label map
  (`e2e/journeys/three-months-in.spec.ts` TAB_LABELS_NAMES); the app rail
  lives in `app/index.tsx`.

## Goals / Non-Goals

- Goals: no unhandled SW-registration crash; label-parity guard wired
  into a PR-lane gate; headroom reporting on the P2 journey; cheap
  completion items closed.
- Non-Goals: replacing workbox, PWA update-UX redesign, new perf
  instrumentation frameworks, native lanes.

## Decisions

### D1 — Defensive registration, not workbox replacement

Wrap the `wb.register()` promise: if it resolves a falsy registration,
log-and-return (retryable noop on next load); add
`.catch()` at the call boundary so no workbox-internal rejection escapes
as unhandled. Do NOT patch workbox internals (patch-package) — the race
is environmental, and our boundary guard is sufficient. Keep
`applyServiceWorkerUpdate` semantics unchanged.

### D2 — Label parity as a static script, not a runtime test

`scripts/journey-label-parity.mjs`: extract the rail labels from
`app/index.tsx` (single source) and every journey/helper label map, fail
with a diff on mismatch. Wire into `qa:fast` (cheap, deterministic, PR
lane). A runtime E2E would duplicate what the P0 journeys already cover.

### D3 — Headroom report inside the existing P2 journey

Extend the journey's step metadata with `ceiling`/`measured`/`headroomPct`
and assert `headroomPct < 85` per budgeted step (cold start, max switch,
diary search). No new harness — same JSON metadata path the sim platform
already consumes.

### D4 — Completion sweep is triage-first

Each known-gap item gets one of: CLOSED (fix in this campaign, with
evidence), DEFERRED (explicit rationale + owner lane), or EXTERNAL
(environment-bound). No silent shrinking of the gaps list.

## Risks / Trade-offs

- [SW guard masks real registration failures] → Mitigation: log the
  specific failure path; the pwa-update E2E still asserts the update
  flow end-to-end.
- [Parity script brittleness] → Mitigation: parse only the rail-label
  literal block in `app/index.tsx`; unit-test the parser.
- [Headroom 85% flake risk] → Mitigation: assert on the max of N
  measured switches (existing pattern), and the 85% threshold sits
  below the current 88% worst case (704/800) only after the WM2.3
  repairs — verified by three consecutive journey runs before wiring.

## Migration Plan

SW guard first (small, isolated), parity script + gate wiring, headroom
report, completion sweep last. Each step keeps the full gate set green.

## Open Questions

- None blocking.
