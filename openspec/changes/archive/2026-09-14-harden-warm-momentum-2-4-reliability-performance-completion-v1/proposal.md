# Proposal: Warm Momentum 2.4 — Reliability, Performance Under Heavy State, and Product Completion

**Status:** Proposed
**Author:** Verboo Code
**Date:** 2026-09-03
**Predecessors:** WM2.0 (`0ef426c` line) · WM2.1 (`9d23016`) · WM2.2 (dc3be75) · WM2.3 (`7a0983b`)

## Why

The polish arc (2.0–2.3) simplified the product, unified the visual system,
normalized selection/density/a11y, and made data entry deterministic. What
remains is **reliability and performance under real weight**, plus finishing
the product-completion items the arc surfaced:

- **Service-worker registration race (reproduced):** when a reload lands
  during registration, `navigator.serviceWorker.register()` can resolve
  `undefined` and workbox-window's `this._registration.waiting` throws
  `TypeError: Cannot read properties of undefined (reading 'waiting')` —
  captured in the WM2.3 diagnostic trace. Unhandled rejection; app
  survives, but it is exactly the class of latent web-instability this
  campaign exists to close.
- **Main/nightly-only test lanes rot silently:** the P2 heavy journey
  clicked a tab label 30 days stale ('Overview' → 'Today') because
  journeys skip PR lanes (fixed in WM2.3, but the _class_ remains:
  label-parity between app constants and journey helpers is unguarded).
- **Heavy-state ceilings are green but thin:** the P2 journey passes at
  704ms max switch (≤ 800 ceiling) — close to the ceiling with no
  headroom budget tracking, and aggregate/heatmap boundaries (364/52) are
  only exercised in that one journey.
- **Product completion:** small contract gaps remain (documented
  known-gaps list) that are cheap now and expensive later.

## What Changes

### 1. Service-worker registration hardening (`core/pwa/registerServiceWorker.ts`)

Guard the workbox registration chain: treat a resolved-`undefined`
registration as retryable-noop (not a crash), wrap the
`statechange`/`waiting` window in defensive access, and keep the update
flow intact. Covered by a focused web E2E that reloads during
registration.

### 2. Journey-label parity guard (`e2e/helpers/`)

A cheap static check (node script, wired into `qa:fast`-adjacent gates)
that validates every tab label used by journey helpers against the app's
section-rail constants — preventing the 'Overview'/'Today' rot class.

### 3. Heavy-state performance budget tracking

Add a headroom report to the P2 journey output (measured vs ceiling per
step: cold start, section switch, diary search) and fail on >85% sustained
ceiling use, so drift toward the ceiling is visible before it becomes a
failure.

### 4. Product completion backlog (sweep)

Triage `docs/testing/known-gaps.md` + WM2.3 retrospective notes; close the
cheap, presentation-layer items; file the expensive ones as explicit
EXTERNAL/DEFERRED entries with rationale.

## Out of Scope

- No domain/data/sync/Gym V2 semantic changes, no new product surfaces,
  no native-module additions, no theme-catalog changes.

## Capabilities

### New: `reliability-heavy-state-completion`

- SW registration robustness contract (no unhandled crash on
  registration races; update flow preserved).
- Journey-label parity guard contract.
- Heavy-state performance headroom reporting contract.

## Impact

- `core/pwa/registerServiceWorker.ts`, `e2e/helpers/`, new
  `scripts/journey-label-parity.mjs`, `e2e/journeys/three-months-in.spec.ts`
  (headroom report), selected completion items, docs
  `docs/ui-ux/11-warm-momentum-2-4.md`.
- Tests: SW-race E2E, parity-guard unit test, headroom assertions.
