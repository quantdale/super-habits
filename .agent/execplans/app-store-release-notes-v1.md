# ExecPlan: app-store-release-notes-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the highest-value remaining locally-actionable App Store / Play Store
readiness gap after the privacy passes: readiness item 5
(version tagging + release notes) is still a draft with no store-ready copy
and no tag checklist. Deliver paste-ready store release notes within copy
limits plus a version-bump/tag checklist so the `v1.0.0` release pass can
proceed without re-discovery, leaving only credentialed EAS submit + actual
`git tag` (both release-time owner actions) outstanding.

## Context

- Both privacy plans (`app-store-privacy-artifacts-v1.md`,
  `app-store-privacy-hosting-v1.md`) are COMPLETED 2026-09-19 and
  re-verified this pass (`tests/privacy-hosting.test.ts` 4/4 PASS,
  `prettier --check` PASS). Working tree still holds those increments
  uncommitted (commit decision left to release-time per loop intent).
- `docs/release/release-notes-1.0.0.md` exists as a 2769-char full draft
  (59 lines): accurate product summary, backup conditional, known
  limitations, upgrade notes. It has no store-length variants and no
  tag/version checklist.
- `docs/release/app-store-readiness.md` item 5 reads "write the store
  release notes ... and confirm the EAS `submit.production` profile has
  credentials. Tag `v1.0.0` at release time." — still open.
- Source versions: `package.json` `1.0.0`, `app.json` `version 1.0.0` /
  `buildNumber 1` / `versionCode 1`, `eas.json` `production.autoIncrement`
  true + empty `submit.production` (credentials are owner-side).
- Store copy limits (standard, non-negotiable): Play release notes ≤ 500
  chars per release; Apple What's New ≤ 4000 chars. The full draft already
  fits Apple but exceeds Play, so a ≤ 500-char Play variant is required.
- Constraints: docs-only change; no product code, schema, migration, sync,
  or UI changes; no `git tag` in this pass (release-time action); no EAS
  credentials; no invented emails/URLs — use `[OWNER ACTION]` only for the
  submit-credentials step, never for contact copy.

## Scope

- Rewrite `docs/release/release-notes-1.0.0.md`: keep the full draft as the
  source of truth; add a store-ready "What's New" section with an Apple
  variant (≤ 4000 chars) and a Play variant (≤ 500 chars); add a
  version/tag checklist (version sources, tag command, EAS submit note
  with `[OWNER ACTION]`, pre-tag verification commands).
- Update `docs/release/app-store-readiness.md` item 5 + snapshot line to
  reference the polished notes and checklist.
- Add `tests/release-notes.test.ts`: guard that the file exists, the Play
  block is ≤ 500 chars, the Apple block is ≤ 4000 chars, the heading
  names `1.0.0`, and versions agree (`package.json` vs `app.json`
  version/buildNumber/versionCode).
- Validate: `agent:plan:validate`, `format:check`, `qa:affected` →
  `qa:fast` (typecheck, lint, test:unit) + focused new test + hygiene.

## Non-Goals

- No product code, schema, migration, sync, or UI changes.
- No `git tag v1.0.0` creation (release-time; needs explicit release
  intent).
- No EAS submit credentials, no age-rating/DSA submissions.
- No screenshot / feature-graphic image capture (device-bound).
- No legal advice; release notes are product copy, not policy.

## Current Checkpoint

- Current milestone: Done — release-notes store-readiness closed and re-verified; plan COMPLETED.
- Completed: startup + privacy-plan closure; `release-notes-1.0.0.md` rewritten with Apple (521 chars) + Play (195 chars) paste-ready blocks + version/tag checklist; `app-store-readiness.md` item 5 + snapshot wired; `tests/release-notes.test.ts` added (4/4 PASS); `agent:plan:validate` PASS; `prettier --check` PASS (4 files); `qa:affected` consulted → gate qa:fast; `qa:fast` typecheck PASS + lint PASS + unit 1767 passed / 1 pre-existing ENVIRONMENT failure (classified below) + parity OK; `web:hygiene` PASS (8081/8082 free); successor-pass closure re-verification 2026-09-19 (`agent:plan:validate` PASS, `prettier --check` PASS on 3 files, `tests/release-notes.test.ts` + `tests/privacy-hosting.test.ts` 8/8 PASS).
- In progress: none — task complete.
- Important modified files: this plan (closed); `docs/release/release-notes-1.0.0.md`; `docs/release/app-store-readiness.md`; `tests/release-notes.test.ts`.
- Last successful validation: 2026-09-19 — closure re-verification: plan valid; prettier PASS; release-notes 4/4 PASS (8/8 with privacy-hosting); hygiene state preserved.
- Current failures: 1 pre-existing ENVIRONMENT failure — `tests/web-lifecycle.test.ts › terminateOwnedTree` (exitCode null after terminate). Same failure recorded in both prior privacy plans with clean-tree evidence (`git stash -u` + rerun); unrelated to this docs-only + static-test change.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Done — all items complete: paste-ready Apple (≤ 4000) + Play (≤ 500) What’s New blocks plus a version/tag checklist; readiness item 5 + snapshot point at the polished notes; `tests/release-notes.test.ts` guards limits + version agreement and passes; `agent:plan:validate` PASS; `format:check` PASS; `qa:affected` consulted; `qa:fast` green except 1 pre-existing ENVIRONMENT failure classified with prior clean-tree evidence; hygiene PASS.

## Progress

- [x] 2026-09-19 — Startup + orientation + privacy-plan closure.
- [x] 2026-09-19 — Rewrite release-notes-1.0.0.md.
- [x] 2026-09-19 — Update app-store-readiness.md item 5.
- [x] 2026-09-19 — Add tests/release-notes.test.ts.
- [x] 2026-09-19 — Validation round: plan valid, prettier PASS, qa:affected consulted, release-notes 4/4 PASS, qa:fast green except 1 pre-existing ENVIRONMENT failure (classified), hygiene PASS.
- [x] 2026-09-19 — Closure re-verification + COMPLETED (successor pass: plan valid, prettier PASS, release-notes 4/4 + privacy-hosting 4/4).

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-19 — Chose release-notes polish + tag prep over screenshot
  tooling or age-rating draft: screenshots are device-bound capture work
  (checklist already ships in `store-data-declarations.md` §4);
  release-notes + checklist is fully generatable and verifiable on this
  Linux box and closes the repo-side part of readiness item 5.
- 2026-09-19 — Docs-only change: layering invariants (soft delete, sync
  enqueue, singleton, createId, toDateKey, append-only migrations)
  unaffected.
- 2026-09-19 — Store limits treated as hard constraints (Play ≤ 500,
  Apple ≤ 4000); new test guards them so future edits cannot silently
  break submission copy.

## Validation Ledger

- 2026-09-19 — Startup + `agent:plans` + `agent:resume` orientation —
  evidence collected, both privacy plans PASS with only expected
  cross-plan warnings.
- 2026-09-19 — Closure re-verification: `tests/privacy-hosting.test.ts`
  4/4 PASS; `prettier --check` PASS (6 files) — DoD confirmed, both
  privacy plans marked COMPLETED.
- 2026-09-19 — New plan `agent:plan:validate` PASS on creation.
- 2026-09-19 — Focused `tests/release-notes.test.ts` 4/4 PASS (after fixing a curly-vs-straight apostrophe assertion; no product change). `prettier --write` applied to 3 files, then `--check` PASS (4 files).
- 2026-09-19 — `qa:affected` → gate qa:fast (rule agent-workflow-and-documentation), focused tests/agent-execplan.test.ts, no broad regression.
- 2026-09-19 — Closure re-verification in successor pass: `agent:plan:validate` PASS; `prettier --check` PASS (`release-notes-1.0.0.md`, `app-store-readiness.md`, `tests/release-notes.test.ts`); focused `tests/release-notes.test.ts` 4/4 PASS and `tests/privacy-hosting.test.ts` 4/4 PASS (8/8 joint); DoD confirmed complete; plan COMPLETED.

## Changed Files / Areas

- `.agent/execplans/app-store-release-notes-v1.md` — this plan.
- `docs/release/release-notes-1.0.0.md` — store-ready rewrite (Apple/Play blocks + checklist).
- `docs/release/app-store-readiness.md` — item 5 + snapshot wiring.
- `tests/release-notes.test.ts` — new guard (limits + version agreement).
- `.agent/execplans/app-store-privacy-artifacts-v1.md` — marked COMPLETED with closure evidence (sibling increment).
- `.agent/execplans/app-store-privacy-hosting-v1.md` — marked COMPLETED with closure evidence (sibling increment).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`.
2. Read this plan file completely.
3. Run `git status --short` and `git diff --stat`; Git wins over narrative.
4. Run `npm run agent:resume -- --plan .agent/execplans/app-store-release-notes-v1.md`.
5. Continue from `Exact next action` above; keep this checkpoint current.

## Outcomes & Retrospective

- Status: Completed 2026-09-19 — iteration increment verified and closed; working tree holds this increment plus the two COMPLETED privacy increments (all uncommitted; commit left to release-time per loop intent).
- Summary: made `release-notes-1.0.0.md` store-ready (Apple 521 chars, Play 195 chars, version/tag checklist) with a 4-case guard test, wired readiness item 5, and closed both privacy plans after re-verification; full local validation green except 1 pre-existing ENVIRONMENT failure classified with prior clean-tree evidence. Closure re-verified in the successor pass (plan valid, prettier PASS, 8/8 focused guards PASS).
- Follow-up: commit at release-time discretion; next loop pass = seeded-device screenshots/feature-graphic per `store-data-declarations.md` §4 or age-rating/DSA draft (see `app-store-age-rating-dsa-v1.md`); owner must configure EAS submit credentials, host `/privacy.html`, and tag `v1.0.0` only with explicit release intent.
