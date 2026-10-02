## Why

Current `main` (`891ed228`) fails exact-head CI on high `node-forge` advisory `GHSA-86w9-cpqp-85rv`, reproduced locally on the pinned toolchain. A bounded security follow-up must restore legitimate green CI or prove a precise upstream blocker without weakening security policy or reopening the completed product/native campaign.

## What Changes

- Re-verify current refs, installed/locked dependency paths, audit/advisory metadata, upstream releases and exact-head CI before selecting a repair. Preserve foreign state and historical evidence.
- Establish source- and artifact-backed exposure for both Expo CLI paths, separating npm production metadata, build/development-tool execution and shipped runtime. The affected verification API is used by tooling; a build-only label is not a waiver.
- Select the smallest proven compatible parent update, forge update/override, dependency-family adjustment or supported path removal/substitution. Reconstruct with `npm ci`, retain before/after evidence and avoid forced fixes or framework downgrades.
- Keep the new-high/critical gate strict. An exception requires every predicate in the brief, exact advisory/package/paths, date, rationale and removal condition; current evidence fails the affected-API-unused predicate, so no forge exception is proposed.
- Repair the separately demonstrated audit fail-open on parseable npm error/empty failed output, using a validated command-result boundary and behavioral tests. This hardens the gate and does not resolve the forge advisory by itself.
- Add non-vacuous semantic regression protection for the selected dependency resolution and audit decision paths; validate actual bundles and affected QA, not lockfile-text snapshots or historical passes.
- On a proven repair, publish logical commits by normal fast-forward to `main`, require quality/audit/E2E success at the final exact SHA, understand expected nightly skips, and reconcile only necessary canonical records.
- If no safe repair exists, keep the audit red and report `PRECISELY BLOCKED` with options rejected, exposure, exact upstream condition and resume action. A successful branch reports `WINDOWS SECURITY FOLLOW-UP COMPLETE`, never overall certification.

Exploration found latest forge **1.4.0 already vulnerable**, no published patch, unchanged forge dependencies in inspected parents, and open/unmerged upstream PR 1152. The design therefore fixes the decision process and acceptance evidence, not an invented upgrade target. All implementation tasks remain unchecked; this is planning, not application of the campaign.

## Capabilities

### New Capabilities

- `dependency-security-closure`: Evidence-backed security triage/remediation, fail-closed audit execution, non-vacuous regression gates, exact-head publication, conservative closure reconciliation and precise blocked outcomes.

### Modified Capabilities

None. Existing release/native certification predicates stay unchanged; this successor adds the narrow dependency-security contract rather than rewriting prior requirements or the canonical 22-task ledger.

## Impact

Conditional apply targets: `package.json`, `package-lock.json`, `scripts/audit-runtime-deps.mjs`, behavioral coverage in `tests/auditRuntimeDeps.test.ts` and any narrowly scoped semantic dependency guard, security-audit documentation, this change's execution/evidence files, and `final-certification-closure/{closure-report,execplan}.md` once actual outcomes exist. A supported substitution or build change requires explicit compatibility and affected-validation proof; broad modernization is excluded.

Package/lockfile and unmapped audit/test changes resolve to broad regression in the current impact map; later apply must run required full QA and artifact checks. Android is requalified only if actual impact warrants it; iOS remains owner-deferred. Existing Android results, J8 history/budgets, full-QA chronology, canonical **17/22**, production catalog/recovery blockers, stopped DDL, default-off AI, account/restore invariants and overall **NOT CERTIFIED** remain intact. No Supabase mutation, signing/release action, destructive Git operation, foreign-state cleanup or archive is authorized. Planning modifies only this new change on `docs/windows-dependency-security-proposal`, with no commit/push.
