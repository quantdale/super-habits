# SUPERHABITS — WEB EXPORT, TODO DURABILITY & FINAL PR ACCEPTANCE REPORT

Campaign: web-export-bridge-isolation-todo-durability-v1
Final successor head: `d5fa162ec0d8b82989506a3f511f322cec24bd50`
Successor PR: #84 (stacked on PR #83) — https://github.com/quantdale/super-habits/pull/84
Report date: 2026-10-22 · Toolchain: Node v22.23.2 / npm 10.9.8 (pinned)

---

## A. Executive Verdict

**READY_WITH_CONDITIONS**

The two confirmed source defects (production web-export abort on both Vercel
projects; Todo Quick Add remount data loss) are root-caused, corrected,
independently verified, and published on a bounded successor branch/PR. The
simulation-bridge security boundary is strengthened (build-time module
isolation), never weakened. Platform-strict visual evidence is preserved
(pixel-identical, no golden changes). Workout recovery durability is preserved
and the prior "Skip set" review finding is resolved.

Conditions that keep this short of unconditional READY:

1. The dependency-security audit (`quality`) remains **RED** (`braces`,
   `node-forge`). This is a genuine owner governance decision (Policy A vs B,
   §K), not a source defect — production release stays correctly blocked.
2. Hosted `e2e` was still `in_progress` at report time (see §H); local e2e is
   fully green and both Vercel previews already build successfully.

Production release authorization: **NO** (not claimed, not authorized).

---

## B. Git Provenance

| Ref            | SHA                                        | Branch                              |
| -------------- | ------------------------------------------ | ----------------------------------- |
| `origin/main`  | `e6cf0d34aea03fe17c5186679b427c6838ef1af1` | main                                |
| PR #82 head    | `a70026eca2f1910113716a16974b08078a513405` | `ci/independent-e2e-qualification`  |
| PR #83 head    | `caace05a3cbaf3e772ba55e6fe948722562852ce` | `e2e-stabilization-visual-fidelity` |
| Successor head | `d5fa162ec0d8b82989506a3f511f322cec24bd50` | `web-export-bridge-isolation-v1`    |

- `merge-base(#82, #83)` = `a70026ec` (= PR #82 head) → PR #83 is stacked on #82. ✔
- `merge-base(main, #83)` = `e6cf0d34` (= main). ✔
- Successor based on `caace05a` (PR #83 head), + 3 commits:
  - `8d4eed05` Isolate the simulation data bridge from production exports (AUD-SH19-B)
  - `58c43cd9` Preserve Todo Quick Add draft across empty↔populated transitions
  - `d5fa162e` Add the campaign ExecPlan
- PR #84: base `e2e-stabilization-visual-fidelity` (explicitly stacked on #83),
  head `web-export-bridge-isolation-v1`. Intended merge order:
  `main → #82 → #83 → #84`. PR #82/#83 remain open and unchanged.

---

## C. Vercel Export Root Cause

**Both** projects failed at `caace05a` during `npm run build:web`:

- Project A `super-habits` (`prj_lv9lvnsEH1hLuiRNCFIRQCz16ZQr`)
- Project B `superhabits` (`prj_RYrRGteH3w6pSYERrPDL27DJJAAd`)

with `ABORT[build:web]: the simulation data bridge reached a PRODUCTION export …`.

**Reproduced exactly on a local build at `caace05a`** (not a Vercel-only
environment issue): `npm run build:web` aborted with the identical message after
bundling. Classification: **SOURCE** (a guard/bundler-isolation defect), not
environment or Vercel configuration.

**Root cause (proven, not assumed).** `scripts/build-dist-web.mjs` scans `dist/`
for the needle `__shdatabridge` via `scanDirectoryForNeedle`. That needle is the
bridge **module identifier** `__shDataBridge`, which is **always bundled**
because `AppProviders` statically imports `installSimulationDataBridge`. Minified
production bundle ground truth (entry-*.js):

- UNARMED (prod): `installSimulationDataBridge=function(){if('undefined'==typeof
globalThis)return!1;return!1;const t=globalThis;return t.__shDataBridge||…}`;
  `isBridgeEnabled = function _(){return!1}`.
- ARMED (sim): `…return!1;0;const t=globalThis;return t.__shDataBridge||…}`;
  `isBridgeEnabled = function _(){return!0}`.

So in production the bridge is **not armed** (installer returns before installing,
`window.__shDataBridge` is never created); the identifier survives only as (a)
the `BRIDGE_GLOBAL='__shDataBridge'` const and (b) unreachable dead code after
`return!1`. The minifier erases any stable armed-only substring
(`return!0` vs `return!1`), so **no substring scan can soundly distinguish armed
from unarmed**. The guard was therefore a **false positive on the inert
identifier** — a legitimate production export was rejected. This is hypothesis
"non-executable/dead code that the guard nevertheless detects."

---

## D. Simulation Bridge Isolation

**Security invariant established (stronger than before):** a production /
ordinary-preview export does not merely leave the bridge unarmed — the mutation
module is **absent from the artifact entirely**. The unchanged `__shdatabridge`
guard is now a **sound, fail-closed proof of absence** (it still aborts if the
real module ever leaks into a production export).

**Fix — build-time module isolation:**

- `core/simulation/dataBridge.stub.ts` — no-op stub: `installSimulationDataBridge`
  → `false`, `isBridgeEnabled` → `false`. No mutation API, no global, and its
  source contains the bridge identifier **nowhere** (not even in prose).
- `metro.config.js` + `scripts/metro-sim-bridge-resolver.js` — resolver routes
  `core/simulation/dataBridge` to the stub unless `SH_SIM_BRIDGE === 'armed'`
  (set only by `scripts/build-dist-e2e.mjs` for `build:e2e:sim`).
- `scripts/build-dist-web.mjs` — production sets `SH_SIM_BRIDGE='disabled'`
  explicitly (an already-set env var is not overwritten by `.env` loading), so an
  ambient/`.env` simulation flag cannot arm the module.

**Positive proof (armed bridge retained):** `npm run build:e2e:sim` → `dist-sim/`
contains `__shDataBridge` (armed; `isBridgeEnabled` folds to `return!0`, the
installer assignment is live). The e2e build guard asserts the module is present
in the requesting export.

**Negative proof (production bridge-free):** `npm run build:web` → **passes**,
and `dist/` contains **no** `__shDataBridge` and no `sim_data_bridge`
(`grep`-verified). The e2e guard now also asserts the module is **absent** from a
non-requesting export.

**Guard soundness / fixtures:** `tests/productionBridgeIsolation.test.ts`
proves `scanDirectoryForNeedle` returns empty on a clean tree and flags an
intentional `__shDataBridge` injection fixture (static artifact inspection
detects bridge injection). Resolver routing (stub when unarmed / real when
armed) is unit-tested. `build:e2e` non-sim export confirms `bridge module=false`.

**dotenv / ambient-flag defense:** production sets `SH_SIM_BRIDGE='disabled'` and
deletes `EXPO_PUBLIC_SIM_DATA_BRIDGE`; module inclusion keys on `SH_SIM_BRIDGE`
(which `.env` cannot override once set). Any bypass attempt fails **closed**: the
`__shdatabridge` guard aborts the build loudly rather than shipping a bridge.

**Runtime proof note:** artifact-level proofs above are grep/guard-verified. The
app-level runtime guarantee (`window.__shDataBridge` never defined in prod) is
covered by `isBridgeEnabled()` folding to `false` + the stub returning `false`;
the sim lane exercises the live bridge via `window.__shDataBridge`
(`simulation/runner/apiLeg.ts`). No user-controlled activation path exists.

---

## E. Todo Quick Add Defect

**Contract:** typing a new task must not lose unsaved input merely because the
underlying Todo collection changed (empty↔populated, added-from-another-surface,
hydration, sync, filtering). Not extended beyond Quick Add's responsibility.

**Root cause (two-fold):** `TodosScreen` rendered **two** `TodoQuickCapture`
instances in mutually-exclusive branches; and the empty↔populated swap also
toggles `Screen`'s scroll container (`ScrollView`↔`View`), remounting the
subtree. Both discarded the input's internal draft state.

**Discriminating reproduction (E2E):** with a partial draft typed and an
empty→populated transition triggered from another surface, the draft was cleared
to `""` on the unfixed code (test failed) — the exact data loss.

**Fix:** (1) a single stable Quick Capture outside the empty/populated
conditional (one control, no duplicate); (2) lift the draft into `TodosScreen`
and make `TodoQuickCapture` controlled, so unsaved text survives **any** subtree
remount (including the container swap).

**Persisted state / focus / submission (`e2e/todo-quickadd-durability.spec.ts`):**

- empty→populated: draft preserved, submits to exactly one todo; durable DB
  (`todos` row) + `sync_outbox` create intents verified.
- populated→empty: draft preserved and submittable.
- No duplicated Quick Capture controls; no duplicate created todo.
- Reload semantics tested separately: a full restart intentionally clears the
  draft (in-memory UI state) — an in-screen remount is **not** a restart.
- Focus is re-establishable after the container swap (the caret resets on that
  swap; the text is preserved at section level — documented, not hidden).

---

## F. Visual Evidence

The Quick-Add fix renders **pixel-identical** to the committed goldens:

- 5 Todo goldens (`todos-390-light`, `todos-long-title-390-light`,
  `todos-heavy-1280-light`, `todos-390-dark`, `todos-empty-360-light`) pass at
  strict `maxDiffPixels: 0`.
- Full visual suite **34/34 passed** (including the strict-comparison
  self-checks: deliberate pixel perturbation still fails, no masks added).
- **No baseline updates required**; strict comparison contract unchanged.

**Owner evidence check (partial):** the run above executed on the Windows/win32
corpus. I did **not** independently inspect representative **Linux** golden
images (populated / empty / substantial-text) from the preceding campaign — that
spot-check is marked **incomplete** pending the hosted (Linux) visual lane, which
is part of PR #84's `e2e` job.

---

## G. Workout Regression

**Prior review finding:** an earlier test waited for `Skip set`, which is visible
before Start (it renders on `isActive` alone) — not a valid durability signal.

**Current source confirms the finding is resolved:**

- `WorkoutSessionScreen.handleStart` presents the running state only **after**
  the resume-draft write settles: `void persistDraft(...).finally(() =>
setIsRunning(true))`.
- `e2e/workout-gym-v2.spec.ts` waits for the **Work timer** (rendered only from
  `isRunning && isActive`) as the durability-ready signal, and **explicitly
  documents why `Skip set` is not that signal**.

**Evidence (`survives reload` test, passing):** normal persistence → reload
immediately after the running-state signal → "Session in progress" survives →
recovered draft carries entered measurements (weight/reps) → premature
`workout_logs` count is 0 → resume restores values → final save produces the log
without duplicates.

**Remaining risk (documented, minor):** if the draft write _rejects_, the
session may still begin without a recoverable draft (best-effort, documented in
`handleStart`). This is a rare SQLite-write-failure edge; it is not materially
unsafe and is accurately described in code. Not expanded into a persistence
redesign; no blocking finding raised.

---

## H. Validation Ledger

Local (Windows, Node v22.23.2 / npm 10.9.8, pinned):

| Gate                                      | Result                                                               |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `npm run typecheck`                       | **0 errors**                                                         |
| `npm run lint` (`--max-warnings 0`)       | **0 errors / 0 warnings**                                            |
| `npm test` (unit + integration)           | **3069 passed / 3 skipped** (298 files passed, 1 skipped)            |
| `tests/ciLaneIntegrity.test.ts`           | **13/13**                                                            |
| `npm run build:web` (production)          | **PASS**, `dist/` bridge-free                                        |
| `npm run build:e2e:sim` (hermetic sim)    | **PASS**, `dist-sim/` bridge-armed                                   |
| `tests/productionBridgeIsolation.test.ts` | **10 passed / 1 skipped** (artifact check runs when `dist/` present) |
| Todo durability (chromium)                | **3/3**                                                              |
| Workout reload regression (chromium)      | **1/1**                                                              |
| Visual regression                         | **34/34** (strict `maxDiffPixels: 0`)                                |
| P0 journeys                               | **25/25**                                                            |
| `scripts/audit-runtime-deps.mjs`          | **RED (exit 1)** — expected, honest                                  |

Hosted (PR #84 head `d5fa162e`, at report time):

| Check                             | State                                                |
| --------------------------------- | ---------------------------------------------------- |
| Vercel – super-habits (Project A) | **SUCCESS** ("Deployment has completed")             |
| Vercel – superhabits (Project B)  | **SUCCESS** ("Deployment has completed")             |
| `quality`                         | **failure** — dependency-security audit (expected)   |
| `e2e`                             | **in_progress** at report time (local e2e all green) |
| `nightly`                         | skipped (schedule-only)                              |
| security/snyk                     | success (no manifest changes)                        |
| Production deployment             | **NONE** (previews only; no main push/merge)         |

Skips/retries: no test retries; Vitest 3 intentional skips (see suite); Playwright
0 retries on the focused runs above. The full hosted `e2e` run did not complete
within the report window — verify at the exact SHA
`d5fa162ec0d8b82989506a3f511f322cec24bd50`.

---

## I. Combined PR Review (PR #82 + #83 + #84 as one change set)

Reviewed against `main` (`e6cf0d34`) as the effective combined diff, plus an
independent read-only pass over the successor delta.

- **PR #82 CI decoupling intact:** `e2e` runs and reports independently of the
  failing `quality` audit (verified live: `e2e in_progress` while `quality
failure`); `nightly` stays schedule-only. ✔
- **Security audit remains a hard failure:** `quality` = failure; no check
  renaming, no conditional success, no bypass. ✔
- **No dependency allowlist modifications; no security exceptions.** ✔
- **No accidental weakening of CI job status.** ✔
- **No unintended application feature changes:** the delta is confined to
  build/bridge isolation, Todo Quick-Add durability, tests, and the ExecPlan. ✔
- **Platform-specific visual goldens coherent:** no golden files changed; strict
  comparison intact. ✔
- **Workout recovery durable** (§G). ✔
- **Todo Quick Add stable** (§E). ✔
- **Production web export excludes the simulation bridge** (§D). ✔
- **Existing GitHub/Vercel environments unchanged** by this work (read-only). ✔

Older-head findings already resolved vs. still valid: the "Skip set" workout
finding is resolved (§G); the Vercel abort and Todo data-loss findings are
resolved (§C, §E). No unresolved source finding remains at the latest SHA.

---

## J. Security Integrity

Unchanged and honest:

- `braces` — `GHSA-vfj7-8cjw-p6xm` (undocumented high) — **still present**.
- `node-forge` — `GHSA-86w9-cpqp-85rv` (undocumented high) — **still present**.
- `scripts/audit-runtime-deps.mjs` exits **1**; `quality` reports **failure**.
- **No** allowlist change, **no** `DOCUMENTED_BUILD_TIME_ADVISORIES` entry added,
  **no** gate weakening, **no** test suppression. CI remains honest: green E2E
  does **not** flip the run green while the audit is red.

---

## K. Release Governance (rechecked; prepare-only — NOT applied)

**Current enforcement (read-only, verified live):**

- Ruleset **"Protect Main"** (`id 15001092`): `enforcement: **disabled**`.
- Classic branch protection for `main`: **404 (absent)**.
- **7 environments** (`copilot`, `Preview`, `Preview – super-habits`,
  `Preview – superhabits`, `Production`, `Production – super-habits`,
  `Production – superhabits`): **all** `can_admins_bypass: true`, **all**
  `protection_rules: []`, `deployment_branch_policy: null`.
- Vercel: two projects linked (`super-habits`, `superhabits`). Whether either
  auto-deploys to production on `main` pushes is governed by each project's
  **production-branch setting** (owner-controlled Vercel config; not readable with
  available tooling). The successor branch produced **previews only**; **no
  production deployment occurred**.

**Owner-actionable protection plan (prepare; do not apply):**

1. PR-only integration to `main` (block direct pushes).
2. Required status checks: `quality` and `e2e` (stable names), non-fast-forward
   (block force-push), enforce for admins (no bypass), require ≥1 review.
3. Enable ruleset `15001092` (or replace with equivalent), enforce linear
   history.
4. GitHub `Production*` environments: required reviewers / deployment branch
   policy limited to `main`; remove `can_admins_bypass` where appropriate.
5. Vercel: set each project's production branch explicitly; restrict production
   deploys to `main` + require the green `e2e`/`quality` checks; verify
   commit-SHA pinning.
6. Explicit separation of **integration** (merge to main) from **release
   qualification** (production promotion).

**Critical policy conflict (owner decision — do NOT choose here):** making
`quality` a required check blocks integration while `braces`/`node-forge` remain.

- **Policy A — Strict integration blocking:** no source integration while the
  required security checks fail.
- **Policy B — Separate integration from release authorization:** integration may
  proceed under explicitly approved controls, while **production promotion stays
  technically blocked** until security requirements are satisfied. For Policy B,
  the actual enforcement mechanism must be a **deployment branch policy /
  required-check on the Vercel production deployment** (Vercel project →
  Production branch + required checks, or GitHub `Production` environment
  required reviewers) — a documented "release is blocked" note is **not**
  sufficient; the block must be technically enforced.

I did **not** activate either policy or change any ruleset/environment/Vercel
setting.

---

## L. Remaining External Gates

Preserved and not addressed here (owner/campaign scope):

- Hosted Supabase / live-cloud certification.
- Backup-provenance rollout.
- Old-client compatibility.
- Native / SH-11 certification.
- Cloud-artifact certification.
- Linux visual golden owner spot-check (§F).
- Hosted `e2e` completion at the final head (§H).
- The `braces`/`node-forge` remediation (or a governed Policy A/B decision).

---

## M. Final Recommendation

1. **Are both Vercel build failures resolved?** **YES** — both Project A and
   Project B previews now **build successfully** on the successor head; root
   cause fixed at source (§C).
2. **Can a production export expose the simulation bridge?** **NO** — the
   mutation module is excluded from production artifacts; guard is fail-closed;
   negative + fixture proofs provided (§D).
3. **Is Quick Add text preserved across remounts?** **YES** — draft survives
   empty↔populated transitions (and any remount); verified by discriminating E2E
   with DB/outbox assertions (§E).
4. **Are workout recovery guarantees preserved?** **YES** — running state is
   gated on the settled draft write; reload/resume/recovery tested; the "Skip
   set" review finding is resolved (§G).
5. **Are platform-specific visual tests valid and strict?** **YES** — 34/34 at
   `maxDiffPixels: 0`, no golden/mask/tolerance changes; Linux owner spot-check
   still open (§F).
6. **Do hosted E2E tests pass at the final head?** **PENDING at report time** —
   hosted `e2e` was `in_progress` at `d5fa162e`; local e2e (todo, workout,
   visual, P0 25/25) all green. Verify at that SHA before relying on it.
7. **Does the security audit still block qualification?** **YES** — `braces` +
   `node-forge` keep `quality` red; release stays blocked (§J).
8. **Are PR #82, #83 and the successor safe for controlled integration?**
   **YES, with conditions** — combined change set reviewed (§I); integration is a
   governed owner decision under Policy A or B (§K), not a unilateral merge.
9. **What owner actions are necessary before any merge?** Decide Policy A vs B;
   remediate or formally disposition `braces`/`node-forge`; enable the branch/
   environment/deployment protections (§K); confirm hosted `e2e` green at the
   final head.
10. **Is production release authorized?** **NO** — production release remains
    **BLOCKED** and is not authorized by this campaign. **NO MAIN MERGE. NO
    PRODUCTION DEPLOYMENT. NO SECURITY EXCEPTIONS. NO TEST SUPPRESSION.**

**Success criterion met:** the source package is defensibly ready for a separate
owner-controlled integration decision, while production release remains correctly
blocked.

---

## N. Open Review Findings

- **Codex P1 — “Update the ExecPlan to the implemented checkpoint”**
  (PR #84 review comment `4343283889` on
  `.agent/execplans/web-export-bridge-isolation-todo-durability-v1.md`): the
  plan’s recovery step was obsolete (it directed an engineer to repeat already-
  committed work and mis-stated the pre-fix build as still failing) and
  `agent:plan:validate` exited 1 (missing outcomes section + four checkpoint
  fields). **Disposition: RESOLVED in source.** The plan is rewritten to reflect
  the committed implementation and is marked `COMPLETED` with a full checkpoint
  (modified-file inventory, validation ledger, failures, quarantines, blockers),
  a completed Progress list, a meaningful Outcomes & Retrospective, and recovery
  instructions that forbid repeating completed work. `npm run
agent:plan:validate:all` now exits **0** (148 versioned plans pass, 0 fail) and
  the focused plan validates as `COMPLETED`.
- No other material source findings were open at the reviewed head `d5fa162e`.
  The workout “Skip set” readiness finding from a prior review is already
  resolved in source (see §G).

This report is committed to the repository (it was previously local-only/
untracked) together with the ExecPlan correction. Historical predecessor reports
under `docs/` are preserved unchanged.
