# ExecPlan: app-store-age-rating-dsa-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close readiness item 6 (the highest-value remaining locally-actionable
store gap after privacy + release-notes): there are no repo-side draft
answers for the Apple Age Rating questionnaire, the Google Play content
rating / Families answers, or the EU DSA trader declaration. Deliver a
code-grounded draft (`docs/release/age-rating-and-trader.md`) with
`[OWNER ACTION]` placeholders for legal confirmation and trader identity,
wire it into `docs/release/app-store-readiness.md`, and guard it with
`tests/age-rating-dsa.test.ts` — so the submission pass proceeds without
re-discovery and without inventing owner PII.

## Context

- All three prior store plans are COMPLETED 2026-09-19 and re-verified
  this pass (`app-store-privacy-artifacts-v1`,
  `app-store-privacy-hosting-v1`, `app-store-release-notes-v1`).
  Working tree still holds those increments uncommitted (commit left to
  release-time per loop intent).
- `docs/release/app-store-readiness.md` item 6 reads only
  "**Age rating questionnaires** (iOS 4+, Play "Everyone") and the EU DSA
  trader declaration." — no draft answers exist anywhere in the repo
  (verified by grep for `age rating|DSA|trader` outside that line).
- `docs/release/store-data-declarations.md` covers Apple labels + Play
  Data safety + listing copy + asset checklist (§§1–5) but explicitly
  excludes age-rating/DSA submissions (non-goal in both privacy plans).
- Code-grounded product facts (verified 2026-09-19 on `main`):
  - Offline-first habit/todo/focus/workout/calories app; local SQLite is
    the source of truth; backup is an optional one-way push to the
    developer's Supabase project; gamification ledger is local-only
    (`docs/release/privacy-policy.md` §§1–6, `docs/knowledge-base/gamification.md`).
  - No `WebView` / `expo-web-browser` / `Linking.openURL` in product code;
    no in-app-purchase / RevenueCat / AdMob / AppLovin dependencies;
    only `/ad/`-matching dependency is `expo-linear-gradient` (not ads).
  - No social feed, chat, comments, follows, or shared UGC in
    `features/` product code (only prose matches like "follows"/"feedback");
    no gambling/casino/betting/lootbox in product code.
  - English-only UI; notifications are on-device scheduled reminders
    (5 runtime channels, no remote push); permissions are
    `POST_NOTIFICATIONS`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED`,
    `WAKE_LOCK`; `ITSAppUsesNonExemptEncryption: false`.
  - `eas.json` `submit.production` is `{}` (credentials are owner-side);
    `package.json` / `app.json` are `1.0.0` / `buildNumber 1` /
    `versionCode 1`.
- Constraints: docs + static-test change only; no product code, schema,
  migration, sync, or UI changes; no `git tag`; no EAS credentials;
  no invented emails/URLs/owner identity — `[OWNER ACTION]` only.

## Scope

- Add `docs/release/age-rating-and-trader.md`: product-facts basis,
  Apple Age Rating draft (all-content-None → 4+), Play content-rating /
  Families / ads draft (Everyone, not designed for children, no ads),
  EU DSA trader-declaration draft (trader-status decision + identity
  fields as `[OWNER ACTION]`), and the owner confirmation checklist.
- Update `docs/release/app-store-readiness.md` item 6 + snapshot line to
  reference the new draft as **delivered 2026-09-19**.
- Add `tests/age-rating-dsa.test.ts`: guard that the draft exists, states
  the 4+ / Everyone posture, documents the no-UGC / no-gambling /
  no-unrestricted-web / English-only / optional-account facts, preserves
  `[OWNER ACTION]` placeholders, and contains no invented contact email
  or store/privacy URL.
- Validate: `agent:plan:validate`, `format:check`, `qa:affected` →
  `qa:fast` (typecheck, lint, test:unit) + focused new test + hygiene.

## Non-Goals

- No product code, schema, migration, sync, or UI changes.
- No actual questionnaire submission in App Store Connect / Play Console.
- No `git tag v1.0.0`, no EAS submit credentials.
- No screenshot / feature-graphic image capture (device-bound; checklist
  already ships in `store-data-declarations.md` §4).
- No legal advice; the draft is a good-faith disclosure marked for owner
  - counsel review before submission.

## Current Checkpoint

- Current milestone: Done — task complete. Age-rating + DSA trader drafts ship with guard test and readiness wiring; DoD re-verified 2026-09-19 before close.
- Completed: startup + prior-plan closure (release-notes COMPLETED after re-verification: plan valid, prettier PASS, 8/8 focused guards PASS); product-facts evidence sweep (no WebView/IAP/ads, no shared UGC/gambling, English-only, on-device notifications); `docs/release/age-rating-and-trader.md` drafted (Apple all-None → 4+, Play Everyone / not child-directed / no ads / no purchases, DSA trader fields as `[OWNER ACTION]`, owner checklist); `docs/release/app-store-readiness.md` item 6 + snapshot wired as delivered 2026-09-19; `tests/age-rating-dsa.test.ts` added (4/4 PASS); `agent:plan:validate` PASS; `prettier --check` PASS after `--write` (5 files); `qa:affected` consulted → gate qa:fast; `qa:fast` typecheck PASS + lint PASS + unit 1771 passed / 1 pre-existing ENVIRONMENT failure + parity OK; focused 21/21 PASS (age-rating + release-notes + privacy-hosting + execplan); `web:hygiene` PASS (8081/8082 free).
- In progress: none — iteration increment done, uncommitted in working tree (plus the three COMPLETED prior increments, also uncommitted).
- Important modified files: this plan (new); `docs/release/age-rating-and-trader.md` (new); `docs/release/app-store-readiness.md` (item 6 + snapshot); `tests/age-rating-dsa.test.ts` (new).
- Last successful validation: 2026-09-19 — plan valid; prettier PASS; age-rating 4/4 PASS (21/21 focused joint PASS); qa:fast typecheck + lint PASS, unit 1771/1772 (1 pre-existing env failure), parity OK; hygiene PASS.
- Current failures: 1 pre-existing ENVIRONMENT failure — `tests/web-lifecycle.test.ts › terminateOwnedTree` (exitCode null after terminate). Same failure recorded in all three prior store plans with clean-tree evidence (`git stash -u` + rerun); unrelated to this docs-only + static-test change.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Done — all items complete: age-rating + trader draft with [OWNER ACTION] only (no invented PII); readiness item 6 + snapshot point at the draft; tests/age-rating-dsa.test.ts guards posture + placeholders and passes; agent:plan:validate PASS; format:check PASS; qa:affected consulted; qa:fast green except 1 pre-existing ENVIRONMENT failure classified with prior clean-tree evidence; hygiene PASS.

## Progress

- [x] 2026-09-19 — Startup + prior-plan closure + product-facts sweep.
- [x] 2026-09-19 — Draft age-rating-and-trader.md.
- [x] 2026-09-19 — Update app-store-readiness.md item 6.
- [x] 2026-09-19 — Add tests/age-rating-dsa.test.ts.
- [x] 2026-09-19 — Validation round: plan valid, prettier PASS (after --write on 3 files), qa:affected consulted, age-rating 4/4 PASS, qa:fast green except 1 pre-existing ENVIRONMENT failure (classified), focused 21/21 PASS, hygiene PASS.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-19 — Chose age-rating + DSA trader draft over the §4
  screenshot/dimensions checklist: screenshots need a real
  seeded device/emulator and must not invent PNGs, while the
  questionnaire draft is fully generatable from verified product facts
  and closes the repo-side part of readiness item 6.

## Validation Ledger

- 2026-09-19 — Startup + `agent:plans` + `agent:resume` orientation —
  release-notes plan ACTIVE with complete DoD; privacy plans COMPLETED.
- 2026-09-19 — Closure re-verification: `agent:plan:validate` PASS; `prettier --check` PASS (3 files); `tests/release-notes.test.ts` 4/4 + `tests/privacy-hosting.test.ts` 4/4 PASS; release-notes plan marked COMPLETED.
- 2026-09-19 — New plan `agent:plan:validate` PASS on creation.
- 2026-09-19 — Focused `tests/age-rating-dsa.test.ts` 4/4 PASS; `prettier --write` applied to 3 files, then `--check` PASS (5 files).
- 2026-09-19 — `qa:affected` → gate qa:fast (rule agent-workflow-and-documentation), focused tests/agent-execplan.test.ts, no broad regression.
- 2026-09-19 — `qa:fast`: typecheck PASS, lint (`--max-warnings 0`) PASS, test:unit 1771 passed / 1 failed / 136 files (failure = `tests/web-lifecycle.test.ts › terminateOwnedTree` exitCode null — same pre-existing ENVIRONMENT failure recorded in all three prior store plans with clean-tree evidence; unrelated to this docs-only change), journey-label-parity OK. Focused joint 21/21 PASS (age-rating + release-notes + privacy-hosting + execplan). `web:hygiene` PASS (8081/8082 free).
- 2026-09-19 — Close-out re-verify before COMPLETED: `agent:plan:validate` PASS (Status ACTIVE at check), `prettier --check` PASS (3 files), `tests/age-rating-dsa.test.ts` 4/4 PASS; DoD still met, no product-code drift.

## Changed Files / Areas

- `.agent/execplans/app-store-age-rating-dsa-v1.md` — this plan.
- `.agent/execplans/app-store-release-notes-v1.md` — marked COMPLETED with closure evidence (sibling increment).
- `docs/release/age-rating-and-trader.md` — new (Apple 4+ / Play Everyone / DSA trader drafts + owner checklist).
- `docs/release/app-store-readiness.md` — item 6 + snapshot wiring.
- `tests/age-rating-dsa.test.ts` — new guard (posture + placeholders + no invented PII).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`.
2. Read this plan file completely.
3. Run `git status --short` and `git diff --stat`; Git wins over narrative.
4. Run `npm run agent:resume -- --plan .agent/execplans/app-store-age-rating-dsa-v1.md`.
5. Continue from `Exact next action` above; keep this checkpoint current.

## Outcomes & Retrospective

- Status: Completed 2026-09-19 — iteration increment complete and re-verified at close; working tree holds this increment plus the three COMPLETED prior increments (all uncommitted; commit left to release-time per loop intent).
- Summary: delivered the missing readiness-item-6 drafts (Apple all-None → 4+, Play Everyone / not child-directed / no ads / no purchases, DSA trader-status + identity as `[OWNER ACTION]`) with a 4-case guard test, wired readiness item 6, and closed the release-notes plan after re-verification; full local validation green except 1 pre-existing ENVIRONMENT failure classified with prior clean-tree evidence.
- Follow-up: commit at release-time discretion; next loop pass = §4 store-assets dimensions/spec checklist without fabricating PNGs (seeded-device capture stays device-bound); owner + counsel must confirm age-rating/DSA answers, fill trader identity, configure EAS submit credentials, host `/privacy.html`, and tag `v1.0.0` only with explicit release intent.
