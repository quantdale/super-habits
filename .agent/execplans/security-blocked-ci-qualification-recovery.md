# ExecPlan: security-blocked CI qualification recovery (independent hosted E2E)

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Hosted application E2E qualification continues while the dependency-security
gate stays truthfully red. The `e2e` job (and the schedule-only `nightly` job)
executes and reports its real result even though `braces`
(GHSA-vfj7-8cjw-p6xm) and `node-forge` (GHSA-86w9-cpqp-85rv) keep
`scripts/audit-runtime-deps.mjs` failing, without weakening the audit, the
release posture, or any test. A green E2E never converts the overall release
status to green: the run stays red while the security gate is red.

## Context

- `ci.yml` has three jobs: `quality` (typecheck, deno edge-function check,
  lint, theme/openspec/parity/ExecPlan guards, unit+integration tests, then the
  GATING `node scripts/audit-runtime-deps.mjs` as its last gate step), `e2e`
  (`needs: quality`; PR / main-push / dispatch), `nightly`
  (`needs: quality`; schedule-only, report-only).
- Verified hosted state at `e6cf0d34` (run 39529457743): every application
  check in `quality` passes; only `Audit runtime dependencies` fails (exit 1,
  two UNDOCUMENTED highs: braces, node-forge). `e2e` and `nightly` are
  **skipped** because of `needs: quality`. Scheduled runs (e.g. 39490330427)
  confirm the nightly lanes have been dead behind the same blocker.
- `e2e`/`nightly` consume NO `needs` outputs and NO artifacts from `quality`:
  both do their own checkout, `npm ci`, `build:e2e` / `build:e2e:sim` /
  `build:sync`. The `needs: quality` edge is pure coupling to the audit result.
- `tests/ciLaneIntegrity.test.ts` pins workflow contracts, including: the
  audit step exists EXACTLY ONCE in the `quality` job with
  `continue-on-error: false`. Splitting security into a separate job would
  require weakening that governance test — rejected.
- Release governance: `main` has no branch protection (API 404); ruleset
  "Protect Main" exists with `enforcement: disabled`. No workflow deploys on
  green CI (`supabase-deploy.yml` and `.eas/workflows/native-e2e.yml` are
  dispatch/label gated). Therefore the honest release blocker is the failing
  `quality` check + policy; platform enforcement of required checks is absent
  and is an owner-level recommendation, not a workflow change.
- `docs/ui-ux/v3-audit/post-w17-overnight/SECURITY-DISPOSITION.md` is the
  authoritative security disposition (SECURITY_UNREMEDIATED, gate correctly
  red); `openspec/changes/reconcile-security-record-upstream-watch` owns the
  event-driven upstream watch (no recurring polling).
- Fresh upstream recheck (2026-10-21): registry latest unchanged (braces 3.0.3,
  node-forge 1.4.0); GitHub advisory API reports `firstPatchedVersion: null`
  for both GHSA ids. No new fix. Audit exits 1 locally.

## Scope

- Decouple `e2e` (and schedule-only `nightly`) from `quality` in
  `.github/workflows/ci.yml` without touching the audit step, its policy, or
  any job's trigger/concurrency semantics.
- Add focused workflow-contract tests pinning the new independence property.
- Update CI documentation (AGENTS.md, superhabits-rules.mdc) to match reality.
- Local validation; feature branch + unmerged PR for hosted verification.
- Report + lightweight future advisory-recheck procedure.

## Non-Goals

- No dependency or lockfile changes; no allowlist/threshold changes; no new
  security exemptions; no advisory re-investigation beyond the one-shot
  upstream existence check.
- No test/assertion/quarantine/timeout changes; no job renames; no required-
  check churn; no branch-protection/ruleset changes; no deployment, merge,
  or push to main; no Supabase/EAS/production actions.
- No recurring CI polling/notifications for advisories.

## Current Checkpoint

- Current milestone: local validation complete; publishing to feature branch.
- Completed: full discovery (workflow graph, contract tests, governance
  surfaces, hosted run 39529457743 step-level evidence); upstream recheck
  (no fix for either advisory); design decision (remove the unnecessary
  `needs: quality` edge; keep the audit in `quality` untouched); ci.yml
  decoupling applied; 3 new contract tests added (mutation-checked: they fail
  when `needs: quality` is restored); AGENTS.md + superhabits-rules.mdc CI
  sections updated; local gates green.
- In progress: feature-branch commit + PR, then hosted verification.
- Important modified files: `.github/workflows/ci.yml`,
  `tests/ciLaneIntegrity.test.ts`, `AGENTS.md`,
  `.cursor/rules/superhabits-rules.mdc`, this plan.
- Last successful validation: full Vitest 3059 passed / 2 skipped; typecheck
  0 errors; lint 0/0; agent:plan:validate:all PASS; openspec:validate 89/89;
  validate:themes 140/140; journey-label + quarantine-register parity OK;
  release-profile-guard + cloud-native-isolation OK; ciLaneIntegrity 13/13
  (2026-10-21). Audit exits 1 with exactly the two known UNDOCUMENTED highs
  (expected red).
- Current failures: None local. Hosted `quality` is expected-red at the audit.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: commit the independent-review corrections
  (contract-test vacuity fix, web-e2e-validation.yml rationale) and push to
  the PR branch; observe the exact-head hosted run; then finalize the report.
- Remaining definition of done: hosted run at the FINAL head observed showing
  e2e EXECUTED with quality red at the audit; final report produced; this
  plan COMPLETED.

Environment-repair note (not repo changes): local `node_modules` was stale
(expo 55.0.28 vs ~55.0.31; expo-haptics/expo-audio missing) — repaired with
`npm ci` (lockfile untouched). A stale gitignored Gradle intermediate
(`android/app/build/intermediates/**/merged_manifest*`) pre-dating expo-audio
made `tests/store-declaration-drift.test.ts` fail locally; removing the
regenerable intermediates restored the documented fresh-clone behavior
(committed list used) and the test passes 17/17. CI at this SHA passed both.

## Progress

- [x] Discovery: workflow graph, contract tests, governance, hosted state
- [x] Upstream advisory recheck (one-shot; no new fix)
- [x] Design decision (smallest change: drop the unnecessary `needs` edge)
- [x] Implement ci.yml decoupling + contract tests + doc updates
- [x] Local validation gates
- [ ] Feature branch push + PR (unmerged)
- [ ] Hosted verification of exact-head run
- [ ] Adversarial review of the change
- [ ] Final report + this plan COMPLETED

## Surprises & Discoveries

- `main` is unprotected and the "Protect Main" ruleset is disabled: no
  required checks exist at platform level today. The release gate is the
  red `quality` status + policy, not platform enforcement.
- `web-e2e-validation.yml` already exists (dispatch-only, evidence-only) —
  created for this same blocker. It stays; the ci.yml `e2e` job remains the
  gating lane, so no capability is duplicated.
- The audit step runs only when every earlier `quality` step passed (default
  step `if: success()`), so "application green + audit red" is the ONLY way
  `quality` can fail while app checks pass — exactly the decoupling case.
- The `.cursor/rules/superhabits-rules.mdc` CI section is stale in one extra
  place (claims the main lane runs `npm run e2e:sync`; ci.yml deliberately
  keeps journeys-sync nightly-only). Corrected in the same doc pass.
- Local `node_modules` shows `expo@55.0.28 invalid` vs `~55.0.31` — a stale
  local install, not a repo defect (CI `npm ci` uses the lockfile). Not in
  scope; no dependency change made.

## Decision Log

- Keep the audit inside `quality` (not a split `security` job): the lane-
  integrity contract test pins it there with `continue-on-error: false`;
  splitting would weaken a governance test and could detach the audit from a
  check name consumers recognize. 2026-10-21.
- Decouple by removing `needs: quality` from `e2e`/`nightly` rather than a
  guarded `always()` + failure-classification condition: e2e consumes no
  quality outputs, so the dependency is unnecessary; removal is the smallest
  maintainable change and avoids fragile failure-classification plumbing.
  Cost trade-off accepted: E2E also runs when application checks genuinely
  fail (its own build is its genuine prerequisite; the run still stays red).
  2026-10-21.
- No aggregate `release-gate` job: with required checks absent at platform
  level it would enforce nothing (theatre) and would add a check name nothing
  consumes; the run-level status already stays red while `quality` is red.
  Document the enforcement gap + owner recommendation instead. 2026-10-21.
- `nightly` gets the same one-line decoupling: schedule-only (no per-push
  cost), report-only, currently a dead capability behind the blocker. 2026-10-21.
- Rejected alternatives: generic `always()` on e2e (cancellation/correctness
  risk), moving the audit to its own workflow (breaks the pinned contract and
  the mandatory-path requirement), allowlisting the advisories (forbidden).
- Independent review round (2026-10-21): accept and fix the reviewer's two
  SHOULD-FIX findings and the #10(a) blind spots before the final head —
  (1) the independence test now also rejects block-sequence `needs:` (a
  job-level `needs:` key in ANY form), (2) `web-e2e-validation.yml`'s stale
  pre-decoupling rationale rewritten, (3) the audit-gate test now rejects a
  step `if:`, job-level `continue-on-error`, and job-level `if:` on quality.
  All three mutations verified caught. Reviewer OBSERVATIONS (pre-existing,
  owner-level follow-ups, deliberately out of scope here): enforce required
  checks (enable the "Protect Main" ruleset with `quality` required); pin
  `permissions: contents: read` on ci.yml / web-e2e-validation.yml; zizmor
  unpinned-`uses:` hardening.

## Validation Ledger

- `node scripts/audit-runtime-deps.mjs` → exit 1, exactly braces + node-forge
  UNDOCUMENTED highs (expected red) — 2026-10-21.
- Registry/advisory recheck (npm view + GitHub advisory GraphQL) → no patched
  release for either GHSA id — 2026-10-21.
- `npx vitest run tests/ciLaneIntegrity.test.ts` → 13/13 — 2026-10-21.
- Mutation battery (all CAUGHT, ci.yml restored byte-identical after each):
  scalar `needs: quality` on e2e; block-sequence `needs:` on e2e; job-level
  `continue-on-error: true` on quality; step `if:` on the audit step —
  2026-10-21.
- `npm run typecheck` → 0 errors; `npm run lint` → 0 errors/0 warnings;
  `npx prettier --check` on all changed files → clean — 2026-10-21.
- `npm run test` (unit + integration) → 3059 passed / 2 skipped / 0 failed
  (298 files) — 2026-10-21.
- `npm run agent:plan:validate -- --plan <this>` + `agent:plan:validate:all`
  → PASS — 2026-10-21.
- `npm run openspec:validate` → 89/89; `npm run validate:themes` → 140/140;
  journey-label-parity + quarantine-register-parity OK; release-profile-guard
  - cloud-native-isolation OK — 2026-10-21.
- `npm run qa:affected` → rule `agent-workflow-and-documentation`, gates
  `qa:fast → qa:full`; focused `tests/agent-execplan.test.ts` +
  `tests/ciLaneIntegrity.test.ts` → 22/22 — 2026-10-21.
- Local E2E smoke on the hermetic export: `e2e/infrastructure.spec.ts` →
  10/10 passed — 2026-10-21.
- Hosted run 39540003485 (PR #82, head 2963ce4d): quality FAILURE at the
  audit step only; e2e EXECUTING in parallel (decoupling verified live);
  nightly correctly skipped — 2026-10-21.
- Independent read-only adversarial review (reviewer subagent): workflow
  VERIFIED-OK on bypass/false-aggregate/cancellation/credentials/deploy/
  naming/resource findings; SHOULD-FIX #3 (block-form `needs:` vacuity), #4
  (stale web-e2e-validation.yml rationale) + #10(a) blind spots — all three
  corrected and mutation-verified — 2026-10-21.

## Changed Files / Areas

- `.github/workflows/ci.yml` — remove `needs: quality` from `e2e` + `nightly`;
  comments documenting the deliberate separation. Audit step untouched.
- `tests/ciLaneIntegrity.test.ts` — new contract assertions: e2e/nightly have
  no job-level `needs:` (any form); the audit stays in quality with no step
  `if:` and no job-level `continue-on-error`/`if:`; gating e2e stays off
  ordinary branch pushes. (Review-round hardening included.)
- `.github/workflows/web-e2e-validation.yml` — header rationale rewritten to
  post-decoupling reality (review finding #4). No functional change.
- `AGENTS.md`, `.cursor/rules/superhabits-rules.mdc` — CI wiring truth.
- `.agent/execplans/security-blocked-ci-qualification-recovery.md` — this plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`; `git diff --stat`; reconcile this checkpoint.
3. Run `npm run qa:affected` and the gates it resolves.
4. Resume from `Exact next action` in Current Checkpoint.

## Outcomes & Retrospective

Pending completion.

## Appendix: future advisory recheck procedure (lightweight, reproducible)

Operationalizes SECURITY-DISPOSITION.md §5 ("Exact upstream events that would
re-open this lane") and the event-driven watch in
`openspec/changes/reconcile-security-record-upstream-watch/design.md`. Run only
on an event (release need, advisory change, Expo/npm parent release) or as a
pre-release check — not on a schedule.

1. Registry: `npm view braces versions --json`, `npm view node-forge versions
--json`, `npm view <pkg> time.modified`. A published version outside the
   vulnerable range (braces > 3.0.3, node-forge > 1.4.0) is an event.
2. Advisory ranges: GitHub advisory API
   (`securityAdvisory(ghsaId: "GHSA-vfj7-8cjw-p6xm" | "GHSA-86w9-cpqp-85rv") {
vulnerabilities { nodes { vulnerableVersionRange firstPatchedVersion {
identifier } } } }`). A non-null `firstPatchedVersion` is an event.
3. Upstream fix status: braces — the advisory's patched range must also satisfy
   consumers (`chokidar ~3.0.2`, `micromatch ^3.0.3`/`^4.0.x`, and
   `metro-file-map`'s transitive micromatch). node-forge — a RELEASE (PR merge
   alone is insufficient) satisfying both `@expo/cli` and
   `@expo/code-signing-certificates` `^1.3.3` ranges, or an Expo CLI release
   removing both vulnerable paths.
4. Compatibility: `npm ls braces node-forge --omit=dev` on the real lockfile —
   record the actual production-graph resolution; a fix must dedupe into it
   without a major framework bump (a major bump is a separate deliberate task).
5. Truth check: `node scripts/audit-runtime-deps.mjs` must genuinely exit 0
   with coherent output (the gate itself fails closed on malformed results);
   then run `node --test tests/nodeForgeSecurityGuards.test.ts` via vitest
   (`npx vitest run tests/nodeForgeSecurityGuards.test.ts`) — the tripwire
   must flip RED on a fixed forge (it proves the forgery is accepted today).
6. If any event fires: STOP this recheck path and hand off to a dedicated
   narrow dependency-change campaign. Never patch versions, allowlist, or
   loosen thresholds from this procedure.
