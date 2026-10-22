# Canonical super-habits naming migration

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Establish the exact canonical brand `super-habits` across publicly visible product metadata and current first-party copy while preserving installed-client identity, persistent local user data, export formats, and the existing Vercel production deployment hold. This is Phase 1 of a multi-phase rename, not a claim that historical and external traces have been erased.

## Context

- Starting `origin/main`: `f9cebe652309d6616504e189e93234ae87b3e981`.
- GitHub indexed 467 files containing the old token, spanning active runtime code, tests, protocol identifiers, old evidence and docs.
- The Android/iOS ID `com.dale16.superhabits` is not mechanically replaceable with a hyphenated Java package identifier; legacy client compatibility needs a separate decision.
- Supabase and Vercel include active or inactive resources still named `superhabits`; no deletion or release is authorized.
- The Vercel `main` auto-deployment hold is deliberately unchanged.

## Scope

- Phase 1: update app display/slug, web/PWA name, npm package metadata, brand splash, current privacy/release text and associated tests; keep an evidence ledger.
- Phase 2: reconcile old-client protocol and state identifiers with tested migrations and fallback reads.
- Phase 3: complete current docs/CI/service references and provider retirement with separate human authorization for irreversible actions.

## Non-Goals

- No force push, no production deployment/promotion, no Supabase/Vercel deletion, no rewriting archived evidence, no untested changes to native IDs, URL schemes, local key prefixes or backup formats.
- No security-audit exemption or release readiness claim.

## Current Checkpoint

- Current Milestone: Phase 1 staged on isolated review branch; hosted `quality`
  failed on this plan's own schema, now corrected.
- Completed: canonicalized npm + lockfile metadata, app Expo name/slug, PWA
  manifest, boot/web title, current privacy and store-copy branding; added
  compatibility inventory and a brand identity test.
- In Progress: hosted CI re-validation after this schema correction, then
  independent review of the branch.
- Important modified files: package.json; package-lock.json; app.json;
  public/manifest.json; app/_layout.tsx; core/ui/BootSplash.tsx; README.md;
  public/privacy.html; docs/release/privacy-policy.md;
  docs/release/release-notes-1.0.0.md; tests/release-notes.test.ts;
  tests/privacy-hosting.test.ts; tests/canonicalBrandIdentity.test.ts;
  docs/branding/canonical-name-migration.md;
  .agent/execplans/canonical-super-habits-identity-v1.md.
- Last successful validation: local `canonicalBrandIdentity.test.ts` and the two
  updated copy-assertion suites pass; hosted `quality` previously failed only on
  `agent:plan:validate:all` (this file's checkpoint labels).
- Current failures: hosted `quality` red at `880b692d` —
  `Validate versioned ExecPlans` rejected this plan for
  `Current Checkpoint missing field: modifiedFiles / lastValidation / remainingDod`,
  because the labels were written in camelCase instead of the human-readable
  forms the validator canonicalizes.
- Relevant quarantines: None introduced.
- Blockers: Full name purge requires migration of native package/bundle IDs,
  local storage keys, backup format IDs and cloud resources; immutable historical
  evidence cannot be erased safely. Provider retirement and native identity
  changes remain owner-gated.
- Exact next action: push this checkpoint-schema correction to the PR #85 branch,
  confirm hosted `quality` advances past `Validate versioned ExecPlans`, and
  resolve whatever the next real failure is.
- Remaining definition of done: hosted typecheck/lint/ExecPlan/unit/integration/
  web/PWA/visual results; verified Expo/EAS linkage; full case-insensitive
  current-file inventory; explicit owner approvals before provider retirement and
  native ID changes.

## Progress

- [x] Inspect exact repository version and canonical entrypoint metadata.
- [x] Find durable legacy protocol/storage identifiers and externally connected projects.
- [x] Stage low-risk display and package metadata changes on feature branch.
- [x] Record compatibility and cloud-resource constraints.
- [ ] Validate branch CI and targeted tests.
- [ ] Independently review the exact diff.
- [ ] Decide and test complete legacy client migration.
- [ ] Reconcile current naming across all active source, docs and tools.
- [ ] Safely retire or rename external duplicates with owner's explicit approval.
- [ ] Certify complete naming migration and release readiness separately.

## Surprises & Discoveries

- A superficially simple spelling change affects installation identities, user storage, browser-origin data, export compatibility and cloud resources.
- Neither an old commit nor an existing distributed backup can be erased simply by changing the repository's current branch.

## Decision Log

- Use staged compatibility-oriented rename rather than unsafe global replacement.
- Do not modify Vercel production hold, old client identifiers, storage prefixes, backup envelope tokens or live cloud project configuration during Phase 1.
- Keep historical source facts intact and mark remaining exceptional uses explicitly in `docs/branding/canonical-name-migration.md`.

## Validation Ledger

- Source edits made to isolated feature branch. No local toolchain was available to execute project tests in this environment; hosted CI will provide independent validation after PR publication.

## Changed Files / Areas

- Canonical package, Expo/PWA and visible UI metadata.
- Current web privacy/store release copy and regression assertions.
- Brand compatibility inventory and this checkpoint.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, the exact feature-branch HEAD, and this ExecPlan.
2. Inspect the feature branch and PR checks.
3. If CI fails, fix the identified breakage on this branch, not on `main`.
4. Continue full naming migration only with explicit compatible transition plans and non-destructive validation.

## Outcomes & Retrospective

Phase 1 implementation staged, but not integrated; pending hosted qualification. No production release and no claim of complete erasure. Remaining project security and native/cloud certification gates are unchanged.
