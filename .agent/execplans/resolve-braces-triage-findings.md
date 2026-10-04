# ExecPlan: Resolve the braces-triage review findings and publish

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Resolve all six independent-review findings against the `braces` security
triage record, re-validate, and publish the corrected change to `origin/main`.
Publish the exact-head CI outcome truthfully: the documentation correction does
not change the dependency graph, so `quality` will still fail at the audit step
on the two upstream-blocked advisories.

## Context

- Repository: `D:/Documents/tryPython/superhabits`, branch `main`.
- Reviewed head: `16882523937ee39416034b2ab6619ee9fab3e9f2`; `origin/main`
  `82555461800bea2a0e5ba7cebd5c7db306691476`.
- Findings to resolve (from `simulation-output/security-braces-review/final-review.md`):
  - Standards P1: `tasks.md` claims complete tooling provenance without the traces.
  - Standards P2: `execplan.md` says ambient Node 24 "ran no gate" (false).
  - Standards P2: `final-report.md`/`execplan.md` omit the QA that actually ran.
  - Spec P1: reachability classification conflates dependency presence with
    vulnerable-API execution; missing `fast-glob` entry point.
  - Spec P1: substitution rejection asserted without a bounded assessment.
  - Spec P2: uniformly "pinned" toolchain labels contradict actual execution.
- Required behavior: original campaign request §§5–9, 13, 20, 25; the change's
  `specs/braces-security-triage/spec.md` tooling-provenance and remediation-
  ladder requirements; `docs/codex-workflow.md` reporting rules; `.agent/PLANS.md`
  waypoint/validation rules.
- Pinned toolchain: Node `v22.23.2`/npm `10.9.8` at
  `/c/Users/palac/AppData/Local/tools/node-v22.23.2-win-x64`.
- Evidence roots: `simulation-output/security-braces-triage/` (campaign; may be
  extended) and `simulation-output/security-braces-review/` (review; read-only
  source of provenance). Both are eslint-ignored/gitignored.
- Preserve stash, foreign untracked roots, iOS extract and worktrees. No
  dependency mutation, no audit-policy change, no native/Expo production work.

## Scope

Evidence completion/correction, committed-document correction, focused
re-validation, owned-path commit, fast-forward publish, exact-head CI record.
Only the six committed files under
`openspec/changes/resolve-braces-security-blocker/` (plus new campaign evidence)
are edited.

## Non-Goals

Re-running the upstream-refresh campaign; landing a dependency/override/
framework change; weakening `DOCUMENTED_BUILD_TIME_ADVISORIES`; fresh E2E/
native qualification; production/Supabase action; history rewrite; editing the
review harness or foreign untracked files.

## Current Checkpoint

- Current milestone: complete; all six findings resolved, published, and CI recorded.
- Completed: evidence regenerated; three documents corrected; gates passed;
  commits `868e199` (corrections) and `61b295a` (CI record) published; exact-head
  CI observed at both (`37176016696` at `868e199`, `37176255652` at `61b295a`)
  — `quality` failure exactly at the dependency audit, `e2e`/`nightly` skipped.
- In progress: None.
- Important modified files: the three corrected OpenSpec documents (published).
- Last successful validation: pinned `qa:fast`, six focused suites (121),
  OpenSpec 71/71, plan validators, `web:hygiene` — all PASS.
- Current failures: exact-head CI remains red by design on the two
  upstream-blocked advisories; not a corrective-pass failure.
- Relevant quarantines: none added or changed.
- Blockers: upstream releases (`braces > 3.0.3`, `node-forge > 1.4.0`) for green.
- Condition required to unblock: published fixed releases / supported parent fixes.
- Exact resume action after unblock: `final-report.md` §L commands.
- Exact next action: None — task complete. Future work requires a new instruction
  or the upstream unblock condition.
- Remaining definition of done: complete. Residual: CI green is impossible until
  upstream publishes fixes; no dependency/policy/native/production mutation was made.

## Progress

- [x] Accept findings, fix scope, recon evidence tooling and environment.
- [x] Generate corrected campaign evidence artifacts.
- [x] Correct the three committed documents.
- [x] Re-validate (focus, OpenSpec, plans, qa:affected→compulsory gates).
- [x] Commit owned paths; verify clean tree and fast-forward.
- [x] Push `main`; record exact-head CI and final state.
- [x] Record the exact-head CI outcome in the campaign record and publish it.

## Surprises & Discoveries

- The reviewed matcher APIs (`micromatch.matcher/some/any/main`) use picomatch;
  the genuine vulnerable-parser entry points are `micromatch.parse`/
  `micromatch.braces` (used by `fast-glob` for Tailwind content expansion) and
  `chokidar`'s `braces.expand`.
- Installed `brace-expansion` copies exist (ESLint/minimatch/glob chain), so
  candidate API shapes can be checked in-process without installing anything.

## Decision Log

- 2026-10-04 — "Resolve those all" is read as resolving the six review findings,
  not the upstream advisories; the latter remain `UPSTREAM_BLOCKED`.
- 2026-10-04 — Corrections preserve each document's history: corrected claims are
  marked with a short dated note where the prior text was wrong, not silently
  rewritten.
- 2026-10-04 — Publish on owner instruction; exact-head CI is recorded as
  observed (audit red), never as green.

## Validation Ledger

- 2026-10-04 — Recon (git refs/status, eslint ignores, `gh`, `.env`, installed
  `brace-expansion`) — PASS.
- 2026-10-04 — Corrective evidence: call-site enumeration, API interception
  (9 braces calls across real entry points), vendored-copy detection (rollup
  ×2 ratio 0.94, vite 0.783, prettier, resolve-workspace-root), substitution
  assessment (no API-compatible drop-in), toolchain attribution, dist/export
  marker retraction — PASS; artifacts under
  `simulation-output/security-braces-triage/`.
- 2026-10-04 — `npm run openspec:validate` 71/71; `agent:plan:validate:all`
  PASS; `qa:fast` PASS; six focused suites 121 PASS; `web:hygiene` PASS.
- 2026-10-04 — Publication: `8255546..868e199` then `868e199..61b295a`
  fast-forwarded to `origin/main`; exact-head runs `37176016696` (`868e199`)
  and `37176255652` (`61b295a`) both failed `quality` exactly at the dependency
  audit with `e2e`/`nightly` skipped — truthful red on the upstream-blocked
  advisories, not a corrective-pass failure.
- 2026-10-04 — `web:hygiene` re-run after publication — PASS, 8081/8082 free.

## Changed Files / Areas

- `openspec/changes/resolve-braces-security-blocker/final-report.md` — corrected
  reachability/substitution/toolchain/QA reporting.
- `.../execplan.md` — corrected context/toolchain, discoveries, validation ledger.
- `.../tasks.md` — corrected 4.7/5.3 text; new review-correction section.
- `simulation-output/security-braces-triage/**` — new corrected evidence.
- `.agent/execplans/resolve-braces-triage-findings.md` — this plan (local).

## Recovery / Resume Instructions

1. Reread `AGENTS.md`, `.agent/PLANS.md`, and this plan.
2. `npm run agent:resume -- --plan .agent/execplans/resolve-braces-triage-findings.md`.
3. Confirm `git status --short`, HEAD/origin refs, and that reviewed docs match
   the corrective pass state.
4. Continue from **Exact next action**; never resume the dependency campaign or
   claim CI green without new upstream evidence.

## Outcomes & Retrospective

- Status: Completed.
- Summary: all six independent-review findings resolved with regenerated,
  machine-verifiable evidence (executed call-site ledger, API-reachability
  proof, npm-invisible vendored-copy detection, bounded substitution
  assessment, toolchain attribution, byte-claim retraction); three committed
  documents corrected; validated on the pinned toolchain; published to
  `origin/main`; exact-head CI recorded truthfully as still red on the two
  upstream-blocked advisories. No dependency, policy, native, or production
  change.
- Follow-up: green CI requires published upstream fixes; otherwise resume from
  the campaign's §L matrix only on a new instruction.
- Lesson: package presence and package-graph accounting do not prove which
  APIs execute; documentation claims need their own red-capable evidence.
