# ExecPlan: app-store-privacy-artifacts-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the highest-value locally-actionable App Store / Play Store readiness
gap: the repo ships **no privacy policy** and **no store data-declaration
answers**, yet both stores hard-require them at submission (Apple requires a
privacy policy URL for every app; Google Play requires a Data safety form for
every app plus a privacy policy when personal data is handled). Deliver
hostable, code-accurate artifacts so a submission pass can proceed without a
re-discovery loop.

## Context

- `docs/release/app-store-readiness.md` (refreshed 2026-09-14) lists remaining
  metadata items 1–7. Items 1 (screenshots), 6 (age rating / DSA), and the
  credentialed parts of 5 (EAS submit credentials, `v1.0.0` tag at release
  time) are external or device-bound — not actionable locally.
- Item 3 (privacy nutrition labels / Data safety) currently claims
  "Data Not Collected" / "No data collected / No data shared" with zero
  repo-side artifact backing it, and the claim is **conditional**: with the
  optional backup enabled, user content is pushed to the developer's Supabase
  project (`core/sync/supabase.adapter.ts` upserts per-entity tables plus
  `backup_manifest` / `user_backup_settings`).
- Evidence gathered 2026-09-19 (HEAD `e311634`, clean tree, `main`):
  - No analytics/tracking SDKs in `package.json` and no tracking calls in
    product code (indexed grep for posthog/sentry/amplitude/mixpanel/
    analytics.track: only a design-doc prose match).
  - Local SQLite is the source of truth; backup is optional one-way push
    (Backup Completeness V2 / Restore V2 + Portable Backup V1), never
    two-way sync.
  - Auth is anonymous Supabase sign-in; email is optional and used only for
    Recoverable Account V1 (verified-email protection + no-create OTP
    recovery of an existing account on an empty device).
  - Gamification ledger is local-only: never synced, backed up, or
    account-owned (`docs/knowledge-base/gamification.md`, schema 25).
  - Notifications are on-device scheduled reminders (5 runtime channels);
    no remote push service receives user data.
  - No ads, no third-party data recipients.
- All `.agent/execplans/*` are COMPLETED except
  `repository-completion-and-truth-v1.md` (BLOCKED on external GitHub billing
  — not locally actionable). `openspec/changes/` holds only `archive/`.
  No ACTIVE plan conflicts with this task.

## Scope

- Add `docs/release/privacy-policy.md`: full hostable privacy-policy text
  (effective-date stamped, versioned) describing local-first storage, the
  optional backup path (what is transmitted, where, encryption in transit,
  user control/deletion), anonymous auth + optional email, local-only
  rewards, on-device notifications, portable export, children/minors note,
  contact + change history.
- Add `docs/release/store-data-declarations.md`: Apple privacy-label answers,
  Play Data safety answers (with the backup-enabled conditional stated
  explicitly), Play short/full description drafts, and the remaining asset
  checklist (screenshots, feature graphic) with acceptance criteria.
- Update `docs/release/app-store-readiness.md` item 3 (and the header
  snapshot line) to point at the new artifacts and state the backup
  conditional accurately.
- Validate: `npm run agent:plan:validate`, `npm run format:check` on touched
  files, `npm run qa:affected`.

## Non-Goals

- No product code, schema, migration, sync, or UI changes.
- No `v1.0.0` git tag (release-time action, needs explicit release intent).
- No EAS submit credentials, no age-rating/DSA questionnaire submissions.
- No screenshot/feature-graphic image capture (device-bound; checklist only).
- No legal advice: policy is a good-faith disclosure draft marked for owner
  review before submission, with contact placeholders the owner must fill.

## Current Checkpoint

- Current milestone: implementation + validation complete for this loop iteration. Artifacts delivered and verified to the extent locally possible.
- Completed: 2026-09-19 startup + evidence sweep; `docs/release/privacy-policy.md` (new); `docs/release/store-data-declarations.md` (new); `docs/release/app-store-readiness.md` item 3 + snapshot corrected; `agent:plan:validate` PASS; prettier `--check` PASS (4 files); `qa:affected` consulted → gate qa:fast; `npm install --ignore-scripts` (1147 pkgs; full install blocked by better-sqlite3 node-gyp build in this container — ENVIRONMENT, recorded below); typecheck PASS; lint PASS; test:unit 1758 passed / 1 pre-existing ENVIRONMENT failure; focused tests/agent-execplan.test.ts 9/9 PASS; journey-label-parity OK; web:hygiene PASS (8081/8082 free).
- In progress: none — iteration increment done, uncommitted in working tree.
- Important modified files: `docs/release/privacy-policy.md` (new), `docs/release/store-data-declarations.md` (new), `docs/release/app-store-readiness.md` (item 3 + snapshot), this plan.
- Last successful validation: typecheck + lint PASS; unit 1758/1759 (1 pre-existing env failure); agent-execplan 9/9; label parity OK; hygiene PASS (2026-09-19).
- Current failures: 1 pre-existing ENVIRONMENT failure — tests/web-lifecycle.test.ts › terminateOwnedTree › cleans up after a failing probe (exitCode null after terminate). Fails identically on the clean tree (verified via `git stash -u` + rerun + `git stash pop`), so unrelated to this docs-only change. Full `npm install` (with scripts) also fails in this container at the better-sqlite3 node-gyp build; `--ignore-scripts` install used instead — integration project not runnable here, unit project unaffected.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Done — all items complete: privacy-policy.md written with placeholders and effective date; store-data-declarations.md written (Apple labels, Play Data safety, listing drafts, asset checklist); app-store-readiness.md item 3 + snapshot updated; plan valid; format clean; qa:fast green except 1 pre-existing ENVIRONMENT failure classified with clean-tree evidence.

## Progress

- [x] 2026-09-19 — Startup + gap selection (privacy artifacts = highest-value
      local gap) + evidence sweep.
- [x] 2026-09-19 — Write privacy-policy.md.
- [x] 2026-09-19 — Write store-data-declarations.md.
- [x] 2026-09-19 — Update app-store-readiness.md.
- [x] 2026-09-19 — Validation round 1: plan valid, prettier clean,
      qa:affected consulted (gate: qa:fast). `npm install` running in background
      to enable the gates.
- [x] 2026-09-19 — Validation round 2: typecheck PASS, lint PASS, unit 1758 passed + 1 pre-existing ENVIRONMENT failure (clean-tree reproduced), agent-execplan 9/9 PASS, label-parity OK, hygiene PASS. Full-install node-gyp failure recorded as ENVIRONMENT.

## Surprises & Discoveries

- The readiness doc's "Data Not Collected / No data collected" claim is only
  true with backup disabled; with user-enabled backup, user content is
  stored in the developer's Supabase project. The new declarations file
  states the conditional explicitly so the submission answers are accurate.

## Decision Log

- 2026-09-19 — Chose privacy artifacts over screenshot/listing-asset tooling:
  both stores hard-block submission without a policy + Data safety form,
  while screenshots are device-bound capture work. Highest local leverage.
- 2026-09-19 — Docs-only change: no product code touched, so layering
  invariants (soft delete, sync enqueue, singleton, createId, toDateKey,
  append-only migrations) are unaffected.
- 2026-09-19 — Policy carries `[OWNER ACTION]` placeholders (contact email,
  hosting URL, effective date confirmation) rather than invented details;
  no secrets or fake identities introduced.

## Validation Ledger

- 2026-09-19 — `agent:plan:validate` PASS; prettier `--check` PASS (all 4
  files, repo-pinned prettier 3.9.x line); `qa:affected` → required gate
  qa:fast, focused tests/agent-execplan.test.ts, no broad regression.
  `npm install` needed first (node_modules was empty).
- 2026-09-19 — qa:fast: typecheck PASS, lint (`--max-warnings 0`) PASS, test:unit 1758 passed / 1 failed (web-lifecycle terminateOwnedTree — ENVIRONMENT, fails identically on clean tree via stash test), journey-label-parity OK, web:hygiene PASS (ports free). Focused tests/agent-execplan.test.ts 9/9 PASS.
- 2026-09-19 — ENVIRONMENT: full `npm install` fails at better-sqlite3 node-gyp build in this container; `--ignore-scripts` install (1147 pkgs) used; integration project not runnable here, unit project unaffected.
- 2026-09-19 — Closure re-verification in successor pass: `tests/privacy-hosting.test.ts` 4/4 PASS, `prettier --check` PASS on all 6 release/privacy files, `agent:plan:validate` PASS, `agent:resume` PASS with only cross-plan working-tree warnings (expected: hosting increment lives in the sibling plan). DoD confirmed complete; plan COMPLETED.

## Changed Files / Areas

- `.agent/execplans/app-store-privacy-artifacts-v1.md` — this plan.
- `docs/release/privacy-policy.md` — new (planned).
- `docs/release/store-data-declarations.md` — new (planned).
- `docs/release/app-store-readiness.md` — item 3 + snapshot (planned).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`.
2. Read this plan file completely.
3. Run `git status --short` and `git diff --stat`; Git wins over narrative.
4. Run `npm run agent:resume -- --plan .agent/execplans/app-store-privacy-artifacts-v1.md`.
5. Continue from `Exact next action` above; keep this checkpoint current.

## Outcomes & Retrospective

- Status: Completed 2026-09-19 — all DoD conditions validated, including successor-pass re-verification (privacy-hosting 4/4, prettier, plan valid).
- Summary: delivered the missing store-submission privacy artifacts (policy + declarations + readiness correction) with code-accurate conditionals and full local validation; one pre-existing environment failure classified with clean-tree evidence.
- Follow-up: commit at release-time discretion; successor gap is release-notes polish + `v1.0.0` tag prep (see `app-store-release-notes-v1.md`); owner must still fill `[OWNER ACTION]` placeholders and confirm store answers.
