# ExecPlan: app-store-privacy-hosting-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Make the approved privacy-policy draft hostable so store submission has a
paste-ready URL: ship `public/privacy.html` (copied verbatim into `dist/` by
`npx expo export -p web` and served at `/privacy.html` on Vercel) with content
faithful to `docs/release/privacy-policy.md`, plus a drift guard test. This
closes the highest-value remaining repo-side piece of readiness item 3 after
the prior `app-store-privacy-artifacts-v1` pass delivered the markdown drafts.

## Context

- Prior pass (`app-store-privacy-artifacts-v1.md`, still ACTIVE, uncommitted)
  delivered `docs/release/privacy-policy.md`,
  `docs/release/store-data-declarations.md`, and corrected
  `docs/release/app-store-readiness.md` item 3. Its Exact next action points
  at screenshot/feature-graphic capture or release-notes + `v1.0.0` tagging.
- Per loop intent, product/code/QA gaps outrank pure marketing assets.
  Screenshots/feature-graphic are device-bound capture work; release-notes
  draft already exists. The hostable policy URL (`[OWNER ACTION]` in both new
  artifacts) is the remaining repo-side blocker: both stores hard-require a
  policy URL, and today the repo ships no deployable file for it.
- Architecture facts: single-page shell (`app/` only `_layout.tsx` +
  `index.tsx`); no new Expo Router route allowed for this (would violate the
  route-free invariant). `public/*` is copied verbatim into `dist/` (proven by
  `e2e/infrastructure.spec.ts` `dist/sw.js` freshness check) and
  `scripts/serve-e2e.js` serves any existing `dist/` file with COOP/COEP,
  falling back to `index.html` only on miss — so `public/privacy.html` is
  served at `/privacy.html` locally and (static precedence over the SPA
  rewrite) on Vercel.
- Constraints: static page must have zero external requests (COEP
  `require-corp` + offline), inline `<style>` only, no invented contact
  details, `[OWNER ACTION]` placeholders preserved, effective date + 12
  sections faithful to the markdown source.

## Scope

- Add `public/privacy.html`: standalone hostable rendering of the policy
  (effective date, short version, §§1–12, owner-action placeholders, link
  back to `/`).
- Add `tests/privacy-hosting.test.ts`: drift guard asserting the HTML exists,
  carries key disclosures, preserves placeholders, and stays in sync with the
  markdown source (headings/effective-date parity).
- Update `docs/release/store-data-declarations.md` privacy-URL lines to name
  the concrete deploy path (`/privacy.html`).
- Update `docs/release/app-store-readiness.md` item 3 snapshot line to note
  the hostable artifact.
- Validate: `agent:plan:validate`, `format:check`, `qa:affected` →
  `qa:fast` (typecheck, lint, test:unit, journey-label-parity) + focused new
  test + `build:web` artifact check (`dist/privacy.html` exists) + hygiene.

## Non-Goals

- No product code, schema, migration, sync, or UI changes.
- No `v1.0.0` tag, no EAS submit credentials, no age-rating/DSA submissions.
- No screenshot / feature-graphic image capture (device-bound).
- No legal advice; policy stays a good-faith draft marked for owner review.
- No service-worker precache change (`CORE_SHELL_URLS` untouched; page is
  runtime-cached on first fetch).
- No `vercel.json` rewrite change (static precedence already serves the file).

## Current Checkpoint

- Current milestone: implementation + validation complete for this loop iteration. Hostable policy ships and is proven in `dist/` and over HTTP.
- Completed: startup + gap selection + evidence sweep; `public/privacy.html` (new, standalone, zero external requests, placeholders intact, prettier-clean); `tests/privacy-hosting.test.ts` (new, 4/4 PASS); `store-data-declarations.md` privacy-URL pointers → `/privacy.html` (prettier-clean); `app-store-readiness.md` item 3 notes the deployable rendering; plan valid; qa:fast chain green except 1 pre-existing ENVIRONMENT failure (classified below); `build:web` proves `dist/privacy.html` byte-identical; serve-e2e probe HTTP 200 + COOP/COEP + body checks; hygiene PASS (8081/8082 free).
- In progress: none — iteration increment done, uncommitted in working tree (plus the prior privacy-artifacts increment, also uncommitted).
- Important modified files: this plan (new); `public/privacy.html` (new);
  `tests/privacy-hosting.test.ts` (new);
  `docs/release/store-data-declarations.md`;
  `docs/release/app-store-readiness.md`.
- Last successful validation: 2026-09-19 — plan valid; prettier PASS (5 files); focused privacy-hosting 4/4 PASS; qa:fast typecheck PASS + lint PASS + unit 1762 passed / 1 pre-existing ENVIRONMENT failure + parity OK; build:web PASS with dist/privacy.html byte-identical (11615 bytes); /privacy.html probe HTTP 200 with require-corp/same-origin; hygiene PASS.
- Current failures: 1 pre-existing ENVIRONMENT failure — `tests/web-lifecycle.test.ts › terminateOwnedTree` (exitCode null after terminate). Same failure recorded in the prior plan with clean-tree evidence; unrelated to this static-HTML + docs change.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Done — all items complete: public/privacy.html ships with placeholders intact; privacy-hosting guard passes; declarations + readiness point at /privacy.html; plan valid; format clean; qa:fast green except 1 pre-existing ENVIRONMENT failure classified; build:web proves dist/privacy.html ships; hygiene PASS.

## Progress

- [x] 2026-09-19 — Startup + gap selection (hostable policy URL over screenshots/release-notes polish) + evidence sweep.
- [x] 2026-09-19 — Add `public/privacy.html`.
- [x] 2026-09-19 — Add `tests/privacy-hosting.test.ts`.
- [x] 2026-09-19 — Update store declarations + readiness pointers.
- [x] 2026-09-19 — Validation round: plan valid, prettier PASS (after --write on 2 files), qa:affected consulted (gate qa:fast), focused test 4/4 PASS, qa:fast green except 1 pre-existing ENVIRONMENT failure, build:web artifact + live probe + hygiene PASS.

## Surprises & Discoveries

- serve-e2e.js serves any existing `dist/` file with COOP/COEP before falling back to `index.html`, and Vercel static precedence serves `/privacy.html` ahead of the SPA rewrite — confirmed by code read + live HTTP 200 probe with both headers present.
- `dist/` is gitignored, so the `build:web` proof leaves no tracked artifact; the shippable source is `public/privacy.html` only.

## Decision Log

- 2026-09-19 — Chose hostable policy file over screenshot tooling or
  release-notes polish: both stores hard-block without a policy URL, the
  file is generatable locally with verification, and screenshots remain
  device-bound. Highest local leverage per loop intent.
- 2026-09-19 — Chose `public/privacy.html` over an Expo Router route:
  preserves the route-free single-page invariant (`app/` stays two files)
  and uses the proven public→dist verbatim path.
- 2026-09-19 — Static page keeps `[OWNER ACTION]` placeholders and zero
  external requests: no secrets invented, COEP/offline safe.

## Validation Ledger

- 2026-09-19 — Startup + `agent:plans` + `agent:resume` orientation — evidence collected, no code changed yet.
- 2026-09-19 — `agent:plan:validate` PASS; `prettier --check` PASS after `--write` (5 files); `qa:affected` → gate qa:fast (plus conservative qa:full default for the unmapped static file; broad regression not required).
- 2026-09-19 — Focused `tests/privacy-hosting.test.ts` 4/4 PASS.
- 2026-09-19 — `qa:fast`: typecheck PASS, lint (`--max-warnings 0`) PASS, test:unit 1762 passed / 1 failed / 1 skipped (failure = `tests/web-lifecycle.test.ts › terminateOwnedTree` exitCode null — same pre-existing ENVIRONMENT failure recorded in the prior plan with clean-tree evidence; unrelated to this static-HTML + docs change), journey-label-parity OK.
- 2026-09-19 — `build:web` PASS; `dist/privacy.html` exists (11615 bytes, byte-identical via `cmp`); `dist/` confirmed gitignored.
- 2026-09-19 — Owned serve-e2e probe: `GET /privacy.html` HTTP 200, `text/html`, COEP `require-corp`, COOP `same-origin`, body contains title + effective date; server terminated, `web:hygiene` PASS (8081/8082 free).
- 2026-09-19 — Closure re-verification in successor pass: `tests/privacy-hosting.test.ts` 4/4 PASS, `prettier --check` PASS, `agent:plan:validate` PASS, `agent:resume` PASS with only cross-plan working-tree warnings (expected: artifacts increment lives in the sibling plan). DoD confirmed complete; plan COMPLETED.

## Changed Files / Areas

- `.agent/execplans/app-store-privacy-hosting-v1.md` — this plan.
- `public/privacy.html` — new (planned).
- `tests/privacy-hosting.test.ts` — new (planned).
- `docs/release/store-data-declarations.md` — pointer update (planned).
- `docs/release/app-store-readiness.md` — pointer update (planned).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`.
2. Read this plan file completely.
3. Run `git status --short` and `git diff --stat`; Git wins over narrative.
4. Run `npm run agent:resume -- --plan .agent/execplans/app-store-privacy-hosting-v1.md`.
5. Continue from `Exact next action` above; keep this checkpoint current.

## Outcomes & Retrospective

- Status: Completed 2026-09-19 — all DoD conditions validated, including successor-pass re-verification (focused test 4/4, prettier, plan valid).
- Summary: delivered the hostable privacy-policy web artifact (`public/privacy.html` → `/privacy.html`) with a 4-case drift guard, pointed both store declaration URL lines and the readiness item at the concrete deploy path, and proved it end-to-end (unit, build artifact, live headers/body, hygiene) with one pre-existing ENVIRONMENT failure classified.
- Follow-up: commit at release-time discretion; successor gap is release-notes polish + `v1.0.0` tag prep (see `app-store-release-notes-v1.md`); owner must fill placeholders, host the URL, and confirm store answers.
