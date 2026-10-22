# SUPERHABITS — STACKED PR FINALIZATION & MAIN INTEGRATION REPORT

Campaign: stacked-PR finalization / controlled main integration
Reviewed source head: `fcfdb2e8f4d38b9cd95133d841106f7bef848794` (PR #84)
Date: 2026-10-22 · Toolchain: Node v22.23.2 / npm 10.9.8 (pinned)

---

## A. Executive Verdict

**READY_BUT_BLOCKED_ON_DEPLOYMENT_GOVERNANCE**

All source/engineering gates pass and the combined PR #82→#83→#84 stack is
accepted as correct. Integration into `main` is **deliberately withheld** because
a `main` push would trigger an **unqualified production deployment on both
connected Vercel projects**, and no verified, owner-approved production-deployment
hold is available to this agent (Phase 5 STOP condition). The source is READY;
the only thing blocking the main push is a deployment-safety boundary that only
the owner can establish/authorize.

Production release is **NOT** authorized. Security advisories remain open.

---

## B. Git Provenance

| Ref                        | SHA                                        |
| -------------------------- | ------------------------------------------ |
| `origin/main` (unchanged)  | `e6cf0d34aea03fe17c5186679b427c6838ef1af1` |
| PR #82 head                | `a70026eca2f1910113716a16974b08078a513405` |
| PR #83 head                | `caace05a3cbaf3e772ba55e6fe948722562852ce` |
| PR #84 head (final source) | `fcfdb2e8f4d38b9cd95133d841106f7bef848794` |

- Ancestry (git-verified): `main e6cf0d34` → PR#82 `a70026ec` → PR#83
  `caace05a` → PR#84 `fcfdb2e8`. 13 commits ahead of `main`; a single
  **non-fast-forward-free** (i.e. clean fast-forward) push of `fcfdb2e8` onto
  `e6cf0d34` would integrate the whole stack with no dropped/duplicated commits.
  `merge-base(main, fcfdb2e8) == e6cf0d34` → `fcfdb2e8` is a strict descendant.
- Integration method planned: one fast-forward `git push origin fcfdb2e8:main`
  (no `--force`, no history rewrite). **Not executed** — blocked by Phase 5.
- Final remote SHA: **N/A — main not modified** (see §I).

---

## C. ExecPlan Repair

Defect: `.agent/execplans/web-export-bridge-isolation-todo-durability-v1.md`
failed `agent:plan:validate` (missing `outcomes` section; missing Current
Checkpoint fields `modifiedFiles`, `failures`, `quarantines`, `blockers`) and was
historically stale (`Status: ACTIVE` while the work was implemented; recovery
directed repeating committed work). This is exactly Codex P1 (PR #84 comment
`4343283889`).

Correction (commit `fcfdb2e8`): rewritten to reflect the committed
implementation and marked `Status: COMPLETED` with a full checkpoint (modified-
file inventory, validation ledger, current failures, relevant quarantines,
blockers, no-action `Exact next action`, completed remaining DoD), a fully
checked Progress list, a real Validation Ledger, and a meaningful Outcomes &
Retrospective. External release blockers are recorded as blockers / external
gates — NOT fabricated as incomplete engineering. No release, hosted-Supabase, or
security-remediation work is claimed complete.

Validation results:

- `npm run agent:plan:validate:all` → **exit 0** (148 versioned plans pass, 0 fail).
- Focused `node scripts/agent-execplan.mjs validate --plan …` → **valid, COMPLETED**.
- Hosted CI `quality` job at `fcfdb2e8`: step **“Validate versioned ExecPlans =
  success”** (advanced past planning validation); the only failing step is
  **“Audit runtime dependencies”** (the security audit).

---

## D. Review Findings

- **Codex P1 — “Update the ExecPlan to the implemented checkpoint”** (comment
  `4343283889`): **RESOLVED in source** (`fcfdb2e8`). Replied with evidence and
  the review thread was resolved (GraphQL `resolveReviewThread`, `isResolved:
true`). Validator now exits 0 and hosted planning validation passes.
- The prior workout “Skip set” readiness finding is already resolved in source
  (see §E).
- No other material P0/P1 source findings at the reviewed head (confirmed by the
  independent reviewer — §E/§I).

---

## E. Source Acceptance (combined `origin/main..fcfdb2e8`)

Diff scope: 85 files / 13 commits, confined to CI (PR #82), workout durability +
visual platform-scoping (PR #83), and bridge isolation + To Do Quick-Add (PR #84)
plus tests/docs. No unintended feature changes.

- **CI decoupling (PR #82):** `e2e` consumes no `quality` outputs/artifacts and
  builds its own; `quality` runs `scripts/audit-runtime-deps.mjs` as a hard
  (`continue-on-error: false`) step; `nightly` is schedule-only. No failure→success
  conversion; no job authorizes production deploy. **PASS.**
- **Workout durability (PR #83):** `handleStart` presents running state only
  after `persistDraft` settles (`.finally(() => setIsRunning(true))`);
  `e2e/workout-gym-v2.spec.ts` waits on the Work timer (`isRunning && isActive`),
  explicitly not `Skip set`; reload preserves entered measurements and identity;
  exactly one completed log; no premature log. **PASS.**
- **Visual integrity:** `maxDiffPixels: 0` strict; goldens platform-scoped
  (`-win32` renamed, `-linux` added as a documented corpus split); this diff
  renames Windows goldens and adds Linux goldens but changes no comparison
  contract, tolerance, or mask. Full suite 34/34 strict. **PASS.** (Linux-golden
  owner spot-check against archived evidence remains a documented limitation.)
- **Production simulation-bridge isolation (PR #84):** the real mutation module
  is excluded from production via a Metro resolver stub
  (`core/simulation/dataBridge.stub.ts` exposes only `installSimulationDataBridge
→ false`, no global/mutation API); production sets `SH_SIM_BRIDGE='disabled'`
  so an ambient/`.env` flag cannot arm it (dotenv cannot overwrite a set var);
  the hermetic `build:e2e:sim` sets `SH_SIM_BRIDGE='armed'` and retains the real
  bridge. The `__shdatabridge` guard is unchanged and now a sound fail-closed
  proof of absence (still aborts on an injected forbidden artifact — fixture
  tested). Proven: production `dist/` has **no** `__shDataBridge`; `dist-sim/`
  retains the armed bridge. **PASS.**
- **To Do Quick-Add durability (PR #84):** one stable Quick Capture; draft lifted
  into the section (survives the Screen scroll-container remount across
  empty↔populated); discriminating E2E verifies exactly-one-todo + DB +
  `sync_outbox`. **PASS.**
- **Independent acceptance:** an independent read-only reviewer (separate
  context) re-verified the seven invariants with file:line evidence. Verdict:
  **`INDEPENDENT_VERDICT: SOURCE_ACCEPTED`, no P0/P1 findings.** One P2
  (report-only) — a stale SHA pin in the ExecPlan (named `d5fa162e` vs the
  reviewed head `fcfdb2e8`) — is corrected in this commit. **PASS.**

---

## F. Validation Ledger

Local (Windows, Node v22.23.2 / npm 10.9.8, on `fcfdb2e8`):

| Gate                                      | Result                                    |
| ----------------------------------------- | ----------------------------------------- |
| `npm run typecheck`                       | pass (0 errors)                           |
| `npm run lint` (`--max-warnings 0`)       | pass (0 errors, 0 warnings)               |
| `npm run agent:plan:validate:all`         | pass (148 plans, 0 fail)                  |
| `npm test` (unit + integration)           | pass (3069 passed / 3 skipped / 0 failed) |
| `tests/ciLaneIntegrity.test.ts`           | pass (13/13)                              |
| `npm run build:web` (production)          | pass (`dist/` bridge-free)                |
| `npm run build:e2e:sim` (hermetic sim)    | pass (`dist-sim/` bridge-armed)           |
| `tests/productionBridgeIsolation.test.ts` | pass                                      |
| To Do Quick-Add durability E2E            | pass (3/3)                                |
| Workout reload regression E2E             | pass                                      |
| Visual regression                         | pass (34/34, `maxDiffPixels: 0`)          |
| P0 journeys                               | pass (25/25)                              |
| `scripts/audit-runtime-deps.mjs`          | **RED (exit 1)** — braces + node-forge    |

Hosted (PR #84 head `fcfdb2e8`):

- `quality` = **failure**, but the failing step is **only** “Audit runtime
  dependencies”; “Validate versioned ExecPlans”, Typecheck, Lint, tests all pass.
- `e2e` = success at the prior head (`d5fa162e`); re-running on `fcfdb2e8`
  (docs/plan-only delta). Prior hosted record preserved: E2E SUCCESS, visual
  SUCCESS, P0 SUCCESS, simulation SUCCESS, and **one `failed → passed` retry** in
  the non-strict W11.5 planning write-failure Chromium test (accepted by the
  retry-report gate; no strict assertion depended on it). This is **not** a
  zero-retry suite — that evidence is preserved, not hidden.
- `nightly` = skipped (schedule-only).
- The dependency-security audit is the only remaining quality failure
  (verified against the actual CI logs, not assumed).

---

## G. Security Integrity

- `braces` — `GHSA-vfj7-8cjw-p6xm` (high) — **unresolved, undocumented**.
- `node-forge` — `GHSA-86w9-cpqp-85rv` (high) — **unresolved, undocumented**.
- `scripts/audit-runtime-deps.mjs` unchanged; exits 1. No allowlist entry, no
  `DOCUMENTED_BUILD_TIME_ADVISORIES` change, no gate disabling, no failure→warning
  reclassification. `quality` remains a hard failure; green E2E never flips the
  run green while the audit is red. **Source-integration readiness is NOT risk
  acceptance and NOT production-release approval.**

---

## H. Vercel Deployment Safety (CRITICAL)

Two Vercel projects are connected. Deployment records prove `main` pushes create
**production-target** deployments on **both**:

- `e6cf0d34` (main) → `Production – super-habits` (id 7215671913) +
  `Production – superhabits` (id 7215627335).
- `89eb3714`, `3477cdb1` (main) → `Production – super-habits` + `Production – superhabits`.
- Feature branches (e.g. `caace05a`, `d5fa162e`, `fcfdb2e8`) → `Preview – …` only.

Those historical production deployments currently show status **`failure`** —
precisely because the `build:web` abort blocked the build. **The PR #84 fix makes
`build:web` succeed**, so a new `main` push would now be expected to **actually
build and promote to production** on both projects (the production domain), i.e.
an unqualified production release.

Release-hold evaluation:

- GitHub `Production*` environments have **zero** protection rules and
  `can_admins_bypass: true`; GitHub deployment-environment gating would **not**
  gate Vercel’s own auto-deploy anyway.
- Vercel-side controls (Production branch config, Deployment Checks, Protected
  Deployments) could enforce a hold, but are **not verifiable or modifiable** by
  this agent (no Vercel API/CLI access; and the owner has **not** authorized
  cloud-settings changes).
- No verified, owner-approved production-deployment hold is therefore
  **operational**.

**Consequence (Phase 5.3 STOP):** because a `main` push could trigger an
unauthorized production release and no enforceable hold is available, the main
push is **withheld**. **DO NOT push main while this remains true.** The latest
deployments at report time are all `Preview`; **no production promotion
occurred**.

---

## I. Integration Outcome

- **The `main` push did NOT occur.** `origin/main` remains `e6cf0d34`. No commits
  were lost or duplicated; `fcfdb2e8` remains a clean descendant of `e6cf0d34`.
- Integration is **blocked solely on deployment governance** (Phase 5), not on
  source acceptance. The tested source is ready to integrate by a single
  fast-forward the moment an owner-approved production-deployment hold is active.
- Independent acceptance (Phase 9): an independent read-only reviewer
  (separate context) returned **`INDEPENDENT_VERDICT: SOURCE_ACCEPTED`** with
  **no P0/P1 findings**, confirming all seven invariants against PR-head source
  with file:line evidence (its coverage limits — no shell for byte-diffs / the
  validator — are covered by the author’s own runs: `agent:plan:validate:all`
  exit 0, `build:web` bridge-free, `npm test` 3069 pass, visual 34/34). Its one
  P2 (stale ExecPlan SHA pin) is fixed here. An outstanding P0/P1 or a missing
  deployment-safety boundary each independently block integration; there is no
  P0/P1, so the **deployment-safety boundary** is the sole blocker.

---

## J. PR Reconciliation

| PR  | State | Effective changes on `main`? | Note                                                                      |
| --- | ----- | ---------------------------- | ------------------------------------------------------------------------- |
| #82 | OPEN  | no                           | base `main`, head `a70026ec`; mergeState UNSTABLE (security audit)        |
| #83 | OPEN  | no                           | base `main`, head `caace05a`; stacked on #82                              |
| #84 | OPEN  | no                           | base `e2e-stabilization-visual-fidelity`, head `fcfdb2e8`; stacked on #83 |

None are merged; none were force-closed. Because `main` is unmodified, GitHub has
not marked any as merged. PR discussions/review evidence (incl. the resolved
Codex thread) are preserved. No administrative cleanup is required beyond the
owner’s integration decision. After integration these would normally be closed as
merged by the merge of the stack; until then they remain open.

---

## K. Remaining Release Gates (open; NOT complete)

- `braces` high-severity advisory (`GHSA-vfj7-8cjw-p6xm`).
- `node-forge` high-severity advisory (`GHSA-86w9-cpqp-85rv`).
- Hosted Supabase Auth / PostgREST / RLS qualification.
- Production backup-provenance migration rollout.
- Old-client compatibility.
- Native Android/iOS lifecycle qualification.
- SH-11 native scheduling rejection.
- SH-21 cloud-artifact inspection.
- Production release governance enablement (see §L).
- Linux visual-golden owner spot-check against archived evidence.

---

## L. Exact Next Actions (owner-controlled boundaries)

1. **Enable a verified production-deployment hold** on BOTH Vercel projects
   (`super-habits` `prj_lv9lvnsEH1hLuiRNCFIRQCz16ZQr`, `superhabits`
   `prj_RYrRGteH3w6pSYERrPDL27DJJAAd`) so a `main` push cannot auto-promote to
   production while release gates fail. Supported options to evaluate on the
   Vercel side (owner action): restrict the Production branch, add a required
   **Deployment Check** / **Protected Deployment** gate, or pause auto-deploy.
   This is the single blocker to integration.
2. **Protect `main`:** enable ruleset `15001092` (currently `enforcement:
disabled`) or equivalent; require PR + review + `quality` + `e2e` checks;
   block non-fast-forward / force-push; remove admin bypass where appropriate.
3. **Separate integration from promotion:** source integration (fast-forward of
   `fcfdb2e8` into `main`) may proceed once (1) is active; production promotion
   stays blocked until the security advisories are remediated or a governed
   Policy A/B decision is made.
4. **Security decision (Policy A vs B):** A = no source integration while the
   security checks fail; B = allow integration under approved controls while
   keeping production promotion technically blocked (enforced by (1), not by
   documentation). Owner chooses; this agent did not choose or activate either.
5. After the hold is active, rerun the preflight (§B ancestry, validation,
   rollback ref `e6cf0d34`) and integrate with a single non-force fast-forward,
   then re-verify GitHub/CI/PR/Vercel state (Phase 7).

---

## M. Rollback / Recovery Reference

- Current `main` = `e6cf0d34`. To roll back a future integration:
  `git push origin e6cf0d34:main` only under owner direction (never `--force`).
- Tested source preserved on `web-export-bridge-isolation-v1` @ `fcfdb2e8` and on
  PR #84. No history rewritten; no unrelated work discarded.

**Production release is NOT authorized. Source integration is prepared and tested
but withheld pending an owner-approved production-deployment hold. NO FORCE-PUSH,
NO SECURITY EXCEPTIONS, NO DEPLOYMENT/PROMOTION.**
