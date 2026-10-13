---
schema: spec-driven
created: 2026-10-14
---

## Why

W12 and W13 are implemented on `frontend-v3-w12-w17-integration`
(`1d54b70`, `b1569f0`). Frontend V3 parent tasks §14 owns the whole-app
integrity sweep: re-run the audit harness across every wave, register new
defects, capture error/offline/HEAVY/large-text states, and re-inspect the full
dark + light matrix (`14.1`–`14.3`).

W14 is a convergence wave, not a redesign wave: it reconciles the actual
integrated product against Calm Momentum authority, makes bounded high-impact
repairs, and produces an honest evidence-led verdict. It must not reopen the
W0–W13 implementation campaigns.

## What Changes

- One W14 matrix instrument covering the six primary destinations plus the
  secondary surfaces across 360/390/412/768/1280, light/dark, and the
  FIRST_RUN / EMPTY / TYPICAL / HEAVY / LONG_TEXT / ERROR fixture classes.
- One authoritative W14 defect ledger with IDs, severity, source SHA,
  viewport/theme/state, repro, root cause, owner, fix and verification status.
- Bounded repairs for reproduced P0/P1 defects and coherent P2 defects that
  affect multiple surfaces. Shared-primitive fixes require explicit broad
  regression.
- An updated `docs/ui-ux/15-v3-defect-ledger.md` and
  `docs/ui-ux/v3-audit/w14/README.md`.

## Capabilities

### New Capabilities

- `whole-app-integrity`: the whole-app rendered-integrity contract — the
  covered surface/state matrix, the defect taxonomy and severity rules, and the
  convergence requirement that no untriaged P0/P1 remains.

### Modified Capabilities

None. W14 changes presentation defects only; no domain, persistence, sync or
backup contract is modified.

## Impact

- Any `features/*` or `core/ui/*` surface a reproduced defect traces to.
- `e2e/integrity-w14*.spec.ts` (new matrix instrument).
- `docs/ui-ux/v3-audit/w14/*`, `docs/ui-ux/15-v3-defect-ledger.md`.
- No `core/db`, `core/sync`, `core/backup`, `core/portable` semantics change;
  no schema, migration, dependency or security-policy change.
