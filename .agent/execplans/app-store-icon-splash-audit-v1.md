# ExecPlan: app-store-icon-splash-audit-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the highest-value remaining locally-actionable store gap: `app.json` registers the launch/store icon set but no in-repo evidence proves the registered binaries exist at their required pixel sizes. Deliver a read-only PNG-IHDR audit (`docs/release/icon-splash-asset-audit.md`) that asserts every `app.json`/`public/manifest.json`-registered icon, splash, and notification asset exists at its configured size, plus a focused PNG-header guard test that reads existing binaries without fabricating any. Visual content checks (notification white-on-transparent artwork, themed-icon legibility, splash safe-area) stay `[OWNER ACTION]`.

## Context

- Prior store increments are COMPLETED and uncommitted (commit left to release-time per loop intent): privacy-artifacts, privacy-hosting, release-notes, age-rating/DSA, and store-assets-checklist (just closed 2026-09-19 after re-verify: plan valid, prettier PASS, focused 16/16 PASS).
- `app.json` registers: `icon` → `./assets/icon.png`; `splash.image` + `splash.dark.image` → `./assets/splash-icon.png`; `android.adaptiveIcon` foreground/background/monochrome → `./assets/android-icon-*.png`; `expo-notifications` icon → `./assets/notification-icon.png`; `web.favicon` → `./assets/favicon.png`. `public/manifest.json` registers PWA `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.
- Measured 2026-09-19 via PNG IHDR parse (no image libraries, no fabrication):
  - `assets/icon.png` 1024×1024, colorType 2 (truecolor, no alpha — correct for store/iOS, no transparency).
  - `assets/splash-icon.png` 1024×1024, colorType 3 (indexed).
  - `assets/android-icon-foreground.png` 512×512 RGBA; `assets/android-icon-background.png` 512×512 RGBA; `assets/android-icon-monochrome.png` 432×432 RGBA.
  - `assets/notification-icon.png` 96×96 RGBA (colorType 6 — alpha channel present; white-artwork visual check stays owner).
  - `assets/favicon.png` 48×48 RGBA.
  - `public/icon-192.png` 192×192; `public/icon-512.png` 512×512; `public/icon-maskable-512.png` 512×512 (all colorType 2).
- Readiness already claims these sizes (`docs/release/app-store-readiness.md` "Store metadata registered in `app.json`"); this pass adds measured evidence + guard, not new sizes.
- Constraints: docs + static guard-test change only; no product code, schema, migration, sync, or UI changes; no `git tag`; no EAS credentials; no invented emails/URLs/owner identity — `[OWNER ACTION]` only; do NOT fabricate, regenerate, or re-encode PNG binaries; read-only IHDR audit of existing assets.

## Scope

- Add `docs/release/icon-splash-asset-audit.md`: app.json → file mapping table, measured IHDR width/height + colorType/alpha table with method note (bytes 0–28, big-endian width at 16, height at 20), PASS/OWNER-ACTION disposition per asset, visual-content owner checks (notification white artwork, monochrome legibility, splash safe-area, maskable padding), re-verify note.
- Add `tests/icon-splash-asset-audit.test.ts`: PNG-header helper (signature + IHDR width/height parse, no image deps) asserting required paths exist and match expected width/height; asserts notification PNG carries an alpha channel; asserts PWA manifest sizes match files; keeps visual-content checks owner-bound (no pixel-artwork claims).
- Wire `docs/release/app-store-readiness.md` "Store metadata registered" bullets + snapshot line to reference the audit as delivered 2026-09-19.
- Validate: `agent:plan:validate`, `format:check`, focused new test (+ prior store guards), `qa:affected` → cheapest sufficient gate + hygiene.

## Non-Goals

- No product code, schema, migration, sync, or UI changes.
- No PNG creation, regeneration, re-encoding, resizing, or screenshot/feature-graphic capture.
- No App Store Connect / Play Console submission or credential configuration.
- No `git tag v1.0.0`, no EAS submit credentials.
- No invented contact email, URL, owner identity, or store-locale claims.
- No legal advice.

## Current Checkpoint

- Current milestone: Done — task complete. Icon/splash/notification PNG-header audit ships with guard test and readiness wiring; DoD re-verified 2026-09-19 before close.
- Completed: startup (AGENTS.md + PLANS.md read, agent:plans listed, git inspected: HEAD e311634 on main, uncommitted COMPLETED privacy/release-notes/age-rating/store-assets increments); store-assets plan re-verified and marked COMPLETED (plan valid, prettier PASS, focused 16/16 PASS); PNG IHDR measurements captured for all 10 binaries (assets ×7 + public ×3) with colorType/alpha noted; `docs/release/icon-splash-asset-audit.md` drafted (mapping + measured 1024/512/432/96/48 + 192/512/512 table, byte-offset method, owner visual checks, no fabricated PNGs); `tests/icon-splash-asset-audit.test.ts` added (header-parse guard, 4/4 PASS); `docs/release/app-store-readiness.md` icons/notification/splash bullets + snapshot wired as delivered 2026-09-19; `agent:plan:validate` PASS; `prettier --write` + `--check` PASS; `qa:affected` consulted → gate qa:fast; `qa:fast` typecheck PASS + lint PASS (after Array-type fix) + unit 1779 passed / 1 pre-existing ENVIRONMENT failure + parity OK; focused joint 20/20 PASS (icon-audit + store-assets + age-rating + release-notes + privacy-hosting); `web:hygiene` PASS (8081/8082 free).
- In progress: none — iteration increment done, uncommitted in working tree (plus the five COMPLETED prior increments, also uncommitted).
- Important modified files: this plan (new); prior plan `.agent/execplans/app-store-store-assets-checklist-v1.md` (ACTIVE → COMPLETED); `docs/release/icon-splash-asset-audit.md` (new); `tests/icon-splash-asset-audit.test.ts` (new); `docs/release/app-store-readiness.md` (icons/notification/splash + snapshot wiring).
- Last successful validation: 2026-09-19 — plan valid; prettier PASS; icon-audit 4/4 PASS (20/20 focused joint PASS); qa:fast typecheck + lint PASS, unit 1779/1780 (1 pre-existing env failure), parity OK; hygiene PASS.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Done — all items complete: audit doc ships with mapping + measured sizes + method + owner visual checks (no fabricated PNGs); guard test asserts paths + IHDR sizes + alpha/manifest consistency and passes (4/4, re-verified 2026-09-19); readiness bullets + snapshot reference the audit as delivered 2026-09-19; `agent:plan:validate` PASS; `format:check` PASS; focused guard green on re-verify; checkpoint current.

## Progress

- [x] 2026-09-19 — Startup + prior-plan COMPLETED close-out + IHDR measurement sweep.
- [x] 2026-09-19 — Draft `docs/release/icon-splash-asset-audit.md`.
- [x] 2026-09-19 — Add `tests/icon-splash-asset-audit.test.ts` (whitespace-robust doc assertions, T[] lint fix).
- [x] 2026-09-19 — Wire readiness + validation round: plan valid, prettier PASS, icon-audit 4/4 PASS, qa:affected consulted, qa:fast green except 1 pre-existing ENVIRONMENT failure (classified), focused 20/20 PASS, hygiene PASS.
- [x] 2026-09-19 — Close-out re-verify: `agent:plan:validate` PASS, `prettier --check` PASS (4 files), focused `tests/icon-splash-asset-audit.test.ts` 4/4 PASS; then marked COMPLETED with Done-wording Remaining-DoD.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-19 — Chose the app.json icon/splash/notification PNG-header audit as this loop's one gap: it is the highest-value local gap per the store-assets plan's Exact next action, fully verifiable read-only from existing binaries, while screenshot capture, credentials, trader filing, and tagging stay owner/release-time only.
- 2026-09-19 — Separate `icon-splash-asset-audit.md` (not a checklist §) so the screenshot-spec checklist stays stable and the binary audit has its own guard + method note.

## Validation Ledger

- 2026-09-19 — Startup + `agent:plans` + git inspection — store-assets ACTIVE with met DoD; four prior store plans COMPLETED.
- 2026-09-19 — Store-assets close-out re-verify: `agent:plan:validate` PASS, `prettier --check` PASS (4 files), focused 16/16 PASS; then marked COMPLETED and re-validated PASS (after fixing Remaining-DoD to Done-wording).
- 2026-09-19 — New plan `agent:plan:validate` PASS on creation (ACTIVE).
- 2026-09-19 — Focused `tests/icon-splash-asset-audit.test.ts` 4/4 PASS after fixing a prettier line-wrap fragile assertion (normalized whitespace) and an eslint `Array<T>` → `T[]` fix; `prettier --write` applied, then `--check` PASS.
- 2026-09-19 — `qa:affected` → gate qa:fast (rule agent-workflow-and-documentation), focused tests/agent-execplan.test.ts, no broad regression.
- 2026-09-19 — `qa:fast`: typecheck PASS, lint (`--max-warnings 0`) PASS, test:unit 1779 passed / 1 failed / 138 files (failure = `tests/web-lifecycle.test.ts › terminateOwnedTree` exitCode null — same pre-existing ENVIRONMENT failure recorded in all prior store plans with clean-tree evidence; unrelated to this docs-only change), journey-label-parity OK. Focused joint 20/20 PASS (icon-audit + store-assets + age-rating + release-notes + privacy-hosting). `web:hygiene` PASS (8081/8082 free).
- 2026-09-19 — Close-out re-verify (next loop pass): `agent:plan:validate` PASS (ACTIVE at check time), `prettier --check` PASS on the 4 task files, focused icon-audit guard 4/4 PASS; no working-tree changes since the iteration increment, so prior `qa:fast` evidence stands without rerun. Then marked COMPLETED.

## Changed Files / Areas

- `.agent/execplans/app-store-icon-splash-audit-v1.md` — this plan.
- `.agent/execplans/app-store-store-assets-checklist-v1.md` — marked COMPLETED with close-out evidence (sibling increment).
- `docs/release/icon-splash-asset-audit.md` — new (app.json/manifest mapping, measured IHDR table for 10 binaries, byte-offset method, owner visual checks).
- `tests/icon-splash-asset-audit.test.ts` — new guard (paths + IHDR sizes + alpha/manifest consistency, no artwork claims).
- `docs/release/app-store-readiness.md` — icons/notification/splash bullets + snapshot wiring as delivered 2026-09-19.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`.
2. Read this plan file completely.
3. Run `git status --short` and `git diff --stat`; Git wins over narrative.
4. Run `npm run agent:resume -- --plan .agent/execplans/app-store-icon-splash-audit-v1.md`.
5. Continue from `Exact next action` above; keep this checkpoint current.

## Outcomes & Retrospective

- Status: Complete — iteration increment delivered and DoD re-verified 2026-09-19 before close (plan valid, prettier PASS, focused 4/4 PASS); working tree holds this increment plus the five COMPLETED prior increments (all uncommitted; commit left to release-time per loop intent).
- Summary: delivered the app.json icon/splash/notification PNG-header audit (all 10 binaries PASS at configured sizes: icon 1024, splash 1024, adaptive 512/512/432, notification 96 + alpha, favicon 48, PWA 192/512/maskable) with a 4-case header-parse guard test, wired readiness icons/notification/splash + snapshot.
- Follow-up: commit at release-time discretion; next loop pass = version/build-number consistency audit (package.json / app.json / eas.json / readiness + release-notes) with a guard test; screenshot capture, EAS submit credentials, trader filing, and v1.0.0 tag stay owner/release-time only.
