---
schema: spec-driven
created: 2026-10-14
---

## Why

W14 verified the integrated W12+W13 product and found one real defect, but the
campaign's visual truth still rests on ad-hoc `page.screenshot()` evidence that
nothing protects. Frontend V3 tasks §15 require a durable regression system:
`15.1` `e2e/visual-regression.spec.ts` with curated baselines using fixture,
viewport, reduced motion and a stable clock; `15.2` prove baseline stability
over two runs and integrate it into the standard battery. Design D5 fixes the
rules: curated baselines, not every state; baseline changes require a ledger
note; thresholds are never loosened to pass.

## What Changes

- A curated Playwright `toHaveScreenshot` suite
  (`e2e/visual-regression.spec.ts`) with deterministic capture engineering:
  hermetic `build:e2e`, cleared/ seeded OPFS state, pinned clock, explicit font
  readiness, reduced-motion emulation, animation disabling, fixed viewport and
  device scale, and no network dependencies.
- Goldens live under `e2e/__screenshots__/` with a structured manifest
  (`docs/ui-ux/v3-audit/w15/golden-manifest.md`) recording surface, fixture,
  viewport, theme and rationale per snapshot.
- A dedicated developer command to (re)generate baselines without changing CI
  behaviour, and CI registration that cannot silently skip.
- Two independent fresh-state runs proving stability, plus a negative
  sensitivity check proving a perturbed style actually fails.

## Capabilities

### New Capabilities

- `visual-regression-baselines`: the deterministic-snapshot contract — what is
  snapshotted, how determinism is achieved, how a baseline change is approved,
  and the stability/sensitivity evidence required.

### Modified Capabilities

None. The suite asserts the rendered appearance of existing behaviour; it
changes no product contract and replaces no functional test.

## Impact

- `e2e/visual-regression.spec.ts` (new), `e2e/__screenshots__/` (new baselines),
  a baseline-generation script entry, `playwright.config.ts` (project
  registration only), `.github/workflows/ci.yml` (visual lane).
- `docs/ui-ux/v3-audit/w15/*`, `docs/testing/known-gaps.md` (register entry).
- No `core/*`, schema, migration, dependency or security-policy change.
