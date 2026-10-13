# W15 — Persistent visual regression system

## 1. Audit existing screenshot infrastructure

- [x] 1.1 Inspect `e2e/visual-audit.spec.ts`, `e2e/a11y.spec.ts`, `e2e/helpers/*`, `e2e/fixtures.ts`, `playwright.config.ts`, `package.json`, `.github/workflows/ci.yml`, `docs/ui-ux/*`
- [x] 1.2 Confirm there is no `toHaveScreenshot` suite and no `e2e/__screenshots__/` baseline directory yet
- [ ] 1.3 Author this slice + `execplan.md` before writing the suite

## 2. Curated coverage contract

- [ ] 2.1 Define the snapshot list (surface, fixture, viewport, theme, rationale)
- [ ] 2.2 Write `docs/ui-ux/v3-audit/w15/golden-manifest.md`

## 3. Deterministic capture engineering

- [ ] 3.1 Hermetic build; verify the Supabase leak guard
- [ ] 3.2 Fresh reset + seed per snapshot
- [ ] 3.3 Fixed clock installed before first render
- [ ] 3.4 Font readiness + bounded settle
- [ ] 3.5 Reduced motion emulated and animations disabled
- [ ] 3.6 Explicit viewport and device scale factor
- [ ] 3.7 Semantic state assertions before each capture
- [ ] 3.8 Limited, justified masking

## 4. Test authoring

- [ ] 4.1 `e2e/visual-regression.spec.ts` with `toHaveScreenshot`
- [ ] 4.2 Generate the curated baselines under `e2e/__screenshots__/`
- [ ] 4.3 Dedicated developer command (`npm run visual:update`) that does not change CI behaviour

## 5. Stability and sensitivity proof

- [ ] 5.1 Run 1: full curated suite on a clean build; record artifacts
- [ ] 5.2 Run 2: independent fresh-state repetition on the same SHA; zero diffs
- [ ] 5.3 One representative snapshot under a different worker order
- [ ] 5.4 Negative sensitivity: perturb a style, prove a failure, revert fully
- [ ] 5.5 Confirm no snapshot generator left a debug switch or stale server

## 6. CI integration

- [ ] 6.1 Register the visual lane in `playwright.config.ts` and the standard battery
- [ ] 6.2 Add the CI step without weakening the inherited dependency-audit gate
- [ ] 6.3 Register the lane in `docs/testing/known-gaps.md` conventions if it is opt-in anywhere

## 7. Evidence, review and closure

- [ ] 7.1 Write `docs/ui-ux/v3-audit/w15/README.md` with two-run stability numbers and the sensitivity result
- [ ] 7.2 Adversarial review of the suite (wrong fixture, clock edge, font not ready, masked content, duplicate names)
- [ ] 7.3 `npm run web:hygiene`; confirm no campaign-owned server remains
- [ ] 7.4 Commit and publish W15; advance the parent checkpoint to W16
