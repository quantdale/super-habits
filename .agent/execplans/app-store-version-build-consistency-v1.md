# ExecPlan: app-store-version-build-consistency-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the next highest-value locally-actionable store gap: version and
build-number truth is currently spread across `package.json`, `app.json`,
`eas.json`, `docs/release/app-store-readiness.md`, and
`docs/release/release-notes-1.0.0.md` with only partial guard coverage
(`tests/release-notes.test.ts` pins package/app versions but nothing
asserts the `eas.json` production posture or the readiness ↔ release-notes
checklist-string agreement). Deliver a read-only consistency audit
(`docs/release/version-build-consistency.md`) plus a focused guard test
(`tests/version-build-consistency.test.ts`) proving the five sources agree
on `1.0.0` / `buildNumber 1` / `versionCode 1` / `autoIncrement true` /
`appVersionSource remote` / empty `submit.production`. No tag, no submit,
no release-intent change.

## Context

- Prior store increments are COMPLETED and uncommitted (commit left to
  release-time per loop intent): privacy-artifacts, privacy-hosting,
  release-notes, age-rating/DSA, store-assets-checklist, and now
  icon-splash-audit (just closed 2026-09-19 after re-verify: plan valid,
  prettier PASS, focused 4/4 PASS).
- Measured 2026-09-19 from the working tree (all values current, no edits):
  - `package.json` `version` is `1.0.0`.
  - `app.json` `expo.version` is `1.0.0`, `expo.ios.buildNumber` is `"1"`,
    `expo.android.versionCode` is `1`.
  - `eas.json` `cli.appVersionSource` is `"remote"`,
    `build.production.autoIncrement` is `true`, `submit.production` is `{}`.
  - Readiness "Store metadata registered" pins `1.0.0` / `buildNumber: 1` /
    `versionCode: 1` + `autoIncrement: true`; item 5 points at
    `release-notes-1.0.0.md` and lists the `v1.0.0` tag as a release-time
    owner action.
  - `release-notes-1.0.0.md` "Version + tag checklist" names `package.json`,
    `app.json` version/buildNumber/versionCode, `eas.json`
    `production.autoIncrement`, empty `submit.production`, and the exact
    `git tag -a v1.0.0` command as `[OWNER ACTION]` / do-not-run-yet.
  - `tests/release-notes.test.ts` (4 tests) already pins
    package.json/app.json versions; it does NOT cover `eas.json` posture or
    readiness ↔ release-notes string agreement — that is this gap.
- `qa:affected` on the current tree resolves docs/test-only changes to rule
  `agent-workflow-and-documentation` → gate `qa:fast`, focused
  `tests/agent-execplan.test.ts`, no broad regression.
- Constraints: docs + static guard-test change only; no product code,
  schema, migration, sync, or UI changes; no `git tag`; no EAS submit
  credentials; no invented emails/URLs/owner identity — `[OWNER ACTION]`
  only; do not change release intent or any version value.

## Scope

- Add `docs/release/version-build-consistency.md`: source-of-truth value
  table (package.json / app.json / eas.json), consistency rules (equality +
  first-release `1`s + autoIncrement posture + empty submit), checklist
  cross-reference (readiness item 5 ↔ release-notes tag checklist ↔ this
  doc), no-tag evidence (`git tag -l v1.0.0` empty), re-verify note.
- Add `tests/version-build-consistency.test.ts`: asserts package.json
  version equals app.json expo.version (`1.0.0`); buildNumber `"1"` +
  versionCode `1`; eas.json appVersionSource `remote` + production
  autoIncrement `true` + submit.production deep-equals `{}` (no committed
  credentials); release-notes checklist names the pinned files/values/tag
  command; readiness item 5 references the release-notes file and pins the
  same values; audit doc exists and marks tag/submit `[OWNER ACTION]`.
- Wire `docs/release/app-store-readiness.md` item 5 + snapshot line to
  reference the audit as delivered 2026-09-19.
- Validate: `agent:plan:validate`, `format:check`, focused new test (+ prior
  store guards), `qa:affected` → cheapest sufficient gate + hygiene.

## Non-Goals

- No product code, schema, migration, sync, or UI changes.
- No version bumps, no build-number increments, no release-intent change.
- No `git tag v1.0.0`, no EAS submit credential configuration.
- No store submission, screenshot capture, trader filing, or locale claims.
- No invented contact email, URL, owner identity, or EAS-behaviour claims
  beyond what the config files and existing docs already state.
- No legal advice.

## Current Checkpoint

- Current milestone: Done — task complete. Version/build consistency audit ships with guard test and readiness wiring; DoD re-verified 2026-09-19 before close.
- Completed: startup (AGENTS.md + PLANS.md read, agent:plans listed, git
  inspected: HEAD e311634 on main, uncommitted COMPLETED store increments
  including icon-splash); icon-splash plan re-verified and marked COMPLETED
  (plan valid, prettier PASS, focused 4/4 PASS); current version values
  measured from the working tree (all `1.0.0` / `1` / `1`, autoIncrement
  true, appVersionSource remote, submit.production `{}`); impact map
  consulted (`qa:affected` → qa:fast for docs/test-only changes).
- In progress: none — iteration increment done, uncommitted in working tree (plus the six COMPLETED prior increments, also uncommitted).
- Important modified files: this plan (new); `docs/release/version-build-consistency.md` (new); `tests/version-build-consistency.test.ts` (new); `docs/release/app-store-readiness.md` (item 5 + snapshot wiring).
- Last successful validation: 2026-09-19 — plan valid; prettier PASS; new guard 6/6 PASS (14/14 focused joint with release-notes + icon-splash); qa:fast typecheck + lint PASS, unit 1785 passed / 1 pre-existing ENVIRONMENT failure (classified), parity OK; hygiene PASS.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Done — all items complete: audit doc ships with value table + consistency rules + checklist cross-reference + no-tag evidence (no version changes, no invented claims); guard test asserts cross-file version/build/eas-posture/checklist agreement and passes (6/6, 14/14 focused joint); readiness item 5 + snapshot reference the audit as delivered 2026-09-19; `agent:plan:validate` PASS; `format:check` PASS; cheapest QA gate green except 1 pre-existing ENVIRONMENT failure classified with prior clean-tree evidence; hygiene PASS; checkpoint current.

## Progress

- [x] 2026-09-19 — Startup + icon-splash COMPLETED close-out + version
      value measurement sweep.
- [x] 2026-09-19 — Draft `docs/release/version-build-consistency.md`.
- [x] 2026-09-19 — Add `tests/version-build-consistency.test.ts` (6/6 PASS first run).
- [x] 2026-09-19 — Wire readiness item 5 + snapshot; validation round: plan valid, prettier PASS (after --write on 3 files), focused 14/14 PASS, qa:fast green except 1 pre-existing ENVIRONMENT failure (classified), parity OK, hygiene PASS; then marked COMPLETED with Done-wording Remaining-DoD.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-19 — Chose the version/build-number consistency audit as this
  loop's one gap: it is the explicitly recommended next gap, fully
  verifiable read-only from committed config + docs, while tagging, submit
  credentials, screenshots, and trader filing stay owner/release-time only.
- 2026-09-19 — Separate `version-build-consistency.md` (not a release-notes
  §) so the store-ready release notes stay paste-stable and the
  cross-file consistency proof has its own guard.

## Validation Ledger

- 2026-09-19 — Startup + `agent:plans` + git inspection — icon-splash
  ACTIVE with met DoD; five prior store plans COMPLETED.
- 2026-09-19 — Icon-splash close-out re-verify: `agent:plan:validate`
  PASS, `prettier --check` PASS (4 files), focused 4/4 PASS; then marked
  COMPLETED with Done-wording Remaining-DoD and re-validated PASS.
- 2026-09-19 — New plan `agent:plan:validate` PASS on creation (ACTIVE).
- 2026-09-19 — Focused `tests/version-build-consistency.test.ts` 6/6 PASS first run; joint 14/14 PASS with release-notes (4) + icon-splash (4); `prettier --write` applied to 3 files, then `--check` PASS.
- 2026-09-19 — `qa:affected` → gate qa:fast (rule agent-workflow-and-documentation), focused tests/agent-execplan.test.ts, no broad regression.
- 2026-09-19 — `qa:fast`: typecheck PASS, lint (`--max-warnings 0`) PASS, test:unit 1785 passed / 1 failed / 139 files (failure = `tests/web-lifecycle.test.ts › terminateOwnedTree` exitCode null — same pre-existing ENVIRONMENT failure recorded in all prior store plans with clean-tree evidence; unrelated to this docs-only change), journey-label-parity OK. `web:hygiene` PASS (8081/8082 free).

## Changed Files / Areas

- `.agent/execplans/app-store-version-build-consistency-v1.md` — this plan.
- `.agent/execplans/app-store-icon-splash-audit-v1.md` — marked COMPLETED
  with close-out evidence (sibling increment).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`.
2. Read this plan file completely.
3. Run `git status --short` and `git diff --stat`; Git wins over narrative.
4. Run `npm run agent:resume -- --plan .agent/execplans/app-store-version-build-consistency-v1.md`.
5. Continue from `Exact next action` above; keep this checkpoint current.

## Outcomes & Retrospective

- Status: Complete — iteration increment delivered and DoD verified 2026-09-19 before close (plan valid, prettier PASS, focused 14/14 PASS, qa:fast green except 1 pre-existing ENVIRONMENT failure classified, hygiene PASS); working tree holds this increment plus the six COMPLETED prior increments (all uncommitted; commit left to release-time per loop intent).
- Summary: delivered the cross-file version/build consistency audit (package.json 1.0.0 == app.json expo.version 1.0.0, buildNumber "1", versionCode 1, eas.json appVersionSource remote + production autoIncrement true + empty submit.production, no v1.0.0 tag) with a 6-case guard test, wired readiness item 5 + snapshot; no version changed, no tag created, no credentials touched.
- Follow-up: commit at release-time discretion; suggested next local gap for the next pass is a Play listing-copy length guard (short ≤ 80 / full ≤ 4000 chars) if `store-data-declarations.md` drafts lack one, otherwise a `agent:plan:validate:all` re-verify sweep — screenshots, EAS submit credentials, trader filing, hosted-URL deploy, and the v1.0.0 tag stay [OWNER ACTION] / release-time only.
