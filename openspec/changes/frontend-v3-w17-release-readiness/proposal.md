---
schema: spec-driven
created: 2026-10-14
---

## Why

W12–W16 are integrated on `frontend-v3-w12-w17-integration` through
`d04793b`. Frontend V3's `16.2` requires the full validation ladder, residual
classification and a final report; the campaign brief §3 assigns W17 the
end-to-end integrity of the integrated application: reconciliation of the
exact source and release-candidate provenance, the complete verification
ladder, security/dependency audit reconciliation, bounded cross-wave
corrections, and a truthful release-candidate verdict with a correction
handoff.

W17 is an engineering and validation phase, not a summary. Its deliverable is a
verified integrated RC state, repairs for reproduced cross-wave regressions,
executable certification scripts, and an evidence-backed next-session packet.

## What Changes

- An exact RC source SHA and candidate manifest (tree hash, artifact identities,
  build commands, environment, CI status).
- Execution of the full seven-lane ladder: static/contract, unit + real-SQLite
  integration, web/PWA journeys, timezone/clock, deterministic simulation and
  performance, visual/accessibility, and native + security — each reported per
  project with real pass/fail/skip counts.
- Bounded corrective fixes for reproduced cross-wave defects, each with an
  executable regression and a rendered re-check.
- The current-head dependency audit re-read against the live lock graph, with
  the inherited advisories classified (reachability, safe-fix availability,
  exposure, owner) and **not** waived, allowlisted or weakened.
- `docs/ui-ux/v3-audit/w17/` deliverables including a prioritized, bounded
  correction handoff.

## Capabilities

### New Capabilities

- `release-candidate-readiness`: the RC contract — provenance, the executed
  ladder with honest counts, the rule that a lane is never reported as passing
  without its own result, the security-gate rules, and the handoff shape.

### Modified Capabilities

None. W17 fixes reproduced defects only; no behavioural capability contract is
changed.

## Impact

- Any surface a reproduced cross-wave defect traces to (narrow, tested fixes).
- `docs/ui-ux/v3-audit/w17/{README,rc-manifest,verification-matrix,defect-register,correction-handoff}.md`.
- `docs/testing/known-gaps.md` and the parent OpenSpec task records.
- No `core/db`, `core/sync`, `core/backup`, `core/portable` semantics change; no
  schema, migration or production-Supabase mutation.
