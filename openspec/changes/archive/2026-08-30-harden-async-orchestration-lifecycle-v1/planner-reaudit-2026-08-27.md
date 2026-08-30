# Planner Re-Audit — 2026-08-27

## Verdict

Do **not** open a new overlapping implementation campaign yet.

`harden-async-orchestration-lifecycle-v1` is still the authoritative ACTIVE
change on `main`, and exact-HEAD CI proves it is not closed. The next campaign
is therefore a closure-first continuation of this OpenSpec change. Only after
all closure gates are proven may the executor archive it and propose a successor.

Planner baseline:

- Repository: `quantdale/super-habits`
- Audited HEAD: `79bf46821714094d8767a1fff5c7c43227da66f4`
- Last known fully green push CI: `7a496479fcf3831ba635c687c8b9247267900cfd`,
  workflow run #491.
- Current HEAD push CI: workflow run #495, **FAILED**.
- Current recursive GitHub tree: 1,233 tracked blobs/files. The active ExecPlan
  ledger says 1,226, so the coverage ledger is stale by seven files after the
  implementation commit and must be regenerated from local `git ls-files`.
- The active `tasks.md` is still entirely unchecked even though the ExecPlan
  narrates many milestones as done. Task state and execution evidence must be
  reconciled before completion.

## Exact-HEAD CI evidence

Workflow run #495 (`33004834079`) on `79bf468`:

- `quality`: PASS.
- main full browser E2E: PASS.
- main full deterministic scenario library: PASS.
- `dist-sync` build: PASS.
- `journeys-sync` remote-boundary lane: **FAIL**.
- Vercel statuses: PASS.

Two tests failed on all retries in the remote-boundary lane:

1. **P5 partial failure / durable outbox**
   - File: `e2e/journeys/bad-backend.spec.ts`, assertion around line 318.
   - Contract: after a mixed partial push, the successful entity is removed
     from the outbox and only the failed entity remains.
   - Expected entities: `['habits']`.
   - Actual entities: `['habits', 'todos']`.
   - This is a correctness boundary: a successful write is being retained or
     re-enqueued, so repeated pushes can duplicate work and failure accounting.

2. **Recoverable Account V1**
   - File: `e2e/journeys/recoverable-account-v1.spec.ts`, assertion around
     line 270.
   - Contract: after recovering the existing owner on an empty device,
     restore eligibility is surfaced as `Allowed`.
   - Actual: the `Allowed` state never appears within the existing 15-second
     state-based timeout, on all retries.
   - Do not increase this timeout. Determine which account/restore state is
     actually adopted and why.

The same two dist-sync failures are present in push run #493 at planner commit
`356c04c`. Run #492 at `5e4757d` failed earlier in the ordinary full E2E
lane on a Focus-stat visibility assertion, while run #491 at `7a49647` passed
the full browser, deterministic scenario, dist-sync build, and remote-boundary
journey lanes. Therefore there is a proven green-to-red regression window;
bisect it rather than classifying #495 as environment noise.

## High-priority audit findings

### PA-01 — Critical closure blocker: authoritative CI is red

The active ExecPlan says the environment-gated lanes should be released on CI
before completion. That has now happened and CI failed. The previous
`ENVIRONMENT` classification is no longer sufficient for the two #495
failures because GitHub-hosted main CI reproduced them.

**Required resolution:** reproduce or bisect, fix the product/harness root
cause, add deterministic narrow regressions, and obtain an exact-SHA green main
CI run. If an external outage is claimed, prove it independently and show why
run #491's same lane passed.

### PA-02 — High: remote partial-success semantics are not holding

The P5 oracle demonstrates that per-entity success removal from the durable
outbox is no longer reliable under the dist-sync failure injector.

Audit end to end:

- `core/sync/sync.engine.ts`
- `core/sync/supabase.adapter.ts`
- owner-binding/preflight behavior
- outbox acknowledgement/deletion transaction
- retry/backoff bookkeeping
- reconnect/visibility flush fan-in in `AppProviders`
- E2E failure injector/interceptor ordering
- any backup-maintenance work triggered after a shared flush

A fix is unacceptable if it simply empties the queue, weakens the assertion,
serializes unrelated work, or changes the mock to hide a product bug.

### PA-03 — High: recovered-owner state/restore eligibility can fail to converge

The Account V1 journey cannot observe `Allowed` after owner recovery. Audit
the entire state transition, not only the UI label:

- recovery verification and session adoption;
- local owner binding;
- `accountCoordinator.refresh()` and its remote/local reads;
- monotonic account-task sequencing in `AppProviders`;
- restore-preview generation/adoption;
- restore eligibility derivation and Settings presentation;
- auth-state callback and reconnect/flush interactions;
- test boundary injection and request ordering.

Explicitly test late older account tasks, auth callbacks, and restore previews
settling after a successful recovery. New user intent/verified owner state must
win.

### PA-04 — Medium: AsyncStorage precedence work is only partially deployed

The active ExecPlan's F-05 explicitly says the reusable preference guard exists
but per-surface adoption across 10+ AsyncStorage-backed UIs remains a follow-up.
Current indexed paths include command history/mode/rollout, Overview onboarding
and card layout, Workout rest preferences, theme/motion, Quick Capture,
Pomodoro presets/session metadata, notification preferences, guided planning,
habit lifecycle state, backup settings, and Calories.

For each caller, classify it as:

- pure storage helper with no competing user action;
- hydration where user action can race and therefore needs explicit
  user-choice precedence;
- authoritative restore/application path with a different documented rule.

Do not mechanically wrap every read. Add paired tests only where two sources
can actually compete.

### PA-05 — Medium: timer/listener runtime proof remains incomplete

The active ExecPlan marks M7 partial. Current interval owners include
`AppProviders`, Pomodoro, Settings backup/status, Workout session, and Settings.
Timeout/listener ownership additionally spans day rollover, remote phases, PWA,
notifications, theme/motion, connectivity, Quick Capture, and command parsing.

Add deterministic mount -> unmount -> remount and lifecycle-churn proofs for
the high-risk owners. Exactly one intended callback/subscription must survive.

### PA-06 — Medium: lint-zero is not enforced by the command contract

Current `npm run lint` uses `eslint . --max-warnings 25`, while the campaign
claims a zero-warning baseline. This allows up to 25 warnings to regress CI
without failing.

After confirming current zero-warning output, change the durable gate to
`--max-warnings 0` (or equivalent) and keep CI using that command. Do not
suppress rules to reach green.

### PA-07 — Medium/Low: suppression and skip inventory requires final ownership

Indexed audit found no `@ts-ignore`, no `eval`, and no
`dangerouslySetInnerHTML`. It did find targeted `eslint-disable` sites in
product UI and test/harness code, two Supabase function entrypoints with
`@ts-nocheck` (separately Deno-checked in CI), and current Playwright
`test.fixme`/`test.skip` sites.

Do not remove justified suppressions blindly. For each current suppression or
skip, record owner, reason, invariant, and closing path. Resolve the two
previously classified `UNKNOWN` E2E skips before calling the audit complete.

### PA-08 — Low but blocking for process integrity: plan state is inconsistent

`execplan.md` is ACTIVE and marks M7/M8/M10 partial and M11 incomplete, while
`tasks.md` has no checked tasks. The plan also records a 1,226-file audit
ledger while the current tree contains 1,233 blobs.

Regenerate the ledger from local Git, reconcile checkboxes from actual evidence,
and never mark a task done from prose alone.

## Residual known capability gaps worth carrying forward

These are not excuses for the current CI failures:

- no anonymized real historical SQLite corpus yet; synthetic migration fixtures
  are not a substitute;
- real pre-cutover UTC/local-date-key corpus remains absent;
- DevTools heap/memory-leak profiling and native sustained-load profiling remain
  open;
- iOS device/simulator validation remains macOS/EAS-dependent;
- real Supabase RLS/upsert/schema-drift proof should use an explicitly
  disposable authorized project.

## Audit coverage method

The planner reviewed repository inventory/architecture, current OpenSpec and
ExecPlan state, recent commit history, GitHub Actions history and logs,
CI configuration, QA impact mapping, known-gap register, package scripts,
largest/high-risk source surfaces, and repository-wide indexed sweeps for
async fan-out, AsyncStorage hydration, timers, delayed promises, skips,
suppressions, random/eval/unsafe HTML markers, and SQL broad reads.

The executor still owns the repository's stronger requirement: regenerate
`git ls-files` locally and account for **every path** as semantically reviewed
or inventoried non-source on the final tree. Planner connector limits are not a
substitute for that local proof.
