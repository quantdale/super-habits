# Warm Momentum 2.4 — Reliability, Heavy-State Performance, Product Completion

Campaign: `openspec/changes/harden-warm-momentum-2-4-reliability-performance-completion-v1`
Predecessors: [WM2.1](08-warm-momentum-2-1.md) · [WM2.2](09-warm-momentum-2-2.md) · [WM2.3](10-warm-momentum-2-3.md)

WM2.4 is the reliability arc of the polish campaign: it hardens what WM2.0–2.3
built against the failure classes their campaigns _observed_ but did not gate.

## 1. Service-worker registration race (CG-7, CLOSED)

**Failure class (reproduced):** workbox-window 7.3.0 `register()` reads
`this._registration.waiting` immediately after
`navigator.serviceWorker.register()` resolves; when a reload lands during
registration, that promise can resolve `undefined`, producing
`TypeError: Cannot read properties of undefined (reading 'waiting')` as an
unhandled rejection (captured in the WM2.3 diagnostic trace).

**Contract now:** the registration boundary in
`core/pwa/registerServiceWorker.ts` handles its own promise chain — a falsy
registration logs a retryable-noop warning; any rejection is logged. The
update flow (`applyServiceWorkerUpdate`, skip-waiting messaging,
visibility-hourly update checks) is untouched.

**Gates:** `e2e/pwa-update.spec.ts` "reload during registration never
surfaces an unhandled rejection (WM2.4)" + the unchanged 4 update-lifecycle
specs (5/5, three consecutive runs).

## 2. Journey-label parity guard (CG-8, CLOSED)

**Failure class:** the P2 heavy journey clicked tab 'Overview' for ~30 days
after the WM2.0 rename to 'Today' because the journeys project skips PR
lanes — nothing compared labels.

**Contract now:** `scripts/journey-label-parity.mjs` treats the `NAV_ITEMS`
block in `app/index.tsx` as the single source of truth and fails with a
named diff on any e2e label map or inline tab click that disagrees. Wired
into `qa:fast` (PR lane). Negative check: renaming a rail label yields 8
named failures. Parser unit-tested (`tests/journeyLabelParity.test.ts`).

## 3. Heavy-state headroom reporting

The P2 heavy journey (J8) now reports measured-vs-ceiling headroom for every
budgeted step and **fails below a 15% sustained headroom floor**:

| Step                      | Ceiling | Fail when |
| ------------------------- | ------- | --------- |
| Cold Overview (HEAVY)     | 5000ms  | > 4250ms  |
| Section switch (max of 6) | 800ms   | > 680ms   |
| Diary search              | 500ms   | > 425ms   |
| Saved-meal picker search  | 500ms   | > 425ms   |

Baseline at adoption: coldOverview 554ms (88.9% headroom), maxSwitch 595ms
(25.6%), diarySearch 357ms (28.6%), pickerSearch 107ms (78.6%). The report
line (`[J8 baseline] …`) prints measured/ceiling/headroom per step.

## 4. Known-gaps triage

`docs/testing/known-gaps.md` gained CG-7 and CG-8 (both CLOSED above);
capability gaps 1–11 retain their honest DEFERRED/EXTERNAL rationale — no
silent shrinking.

## Validation summary

- `qa:fast` (typecheck + lint + unit + parity guard) — green.
- `npx playwright test e2e/pwa-update.spec.ts` — 5/5, three consecutive runs.
- P2 heavy journey — 7/7 with headroom reporting.
- Full Chromium suite, 3× P0, `web:verify`, `web:hygiene` — see ExecPlan
  Validation Ledger for closure numbers.
