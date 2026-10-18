# SuperHabits — Project Pause Handoff

> Owner-directed development freeze. This document is the authoritative
> resumption entry point. Read it first when SuperHabits work is reactivated.
> Paused: **2026-10-18**.

## A. Project status

| Key                      | Value                                   |
| ------------------------ | --------------------------------------- |
| `DEVELOPMENT_STATUS`     | `PAUSED_BY_OWNER`                       |
| `ENGINEERING_STATUS`     | `COMPLETED_FOR_APPROVED_SCOPE`          |
| `INDEPENDENT_REVIEW`     | `PASS_WITH_NONBLOCKING_FINDINGS`        |
| `PRODUCT_RELEASE_STATUS` | `BLOCKED`                               |
| `RESUMPTION`             | `REQUIRES_EXPLICIT_OWNER_AUTHORIZATION` |

Pause date: **2026-10-18**. This is a voluntary owner-directed pause — not an
engineering failure, not abandonment, and not archiving. The repository, PRs,
branches, worktrees, and evidence remain live and intact.

## B. Approved product direction

The owner approves the current **Frontend V3 Calm Momentum** visual design as
the established design foundation. When development resumes, Calm Momentum must
be preserved and continued — not redesigned.

Scope of the approval: the visual direction and design system as delivered by
the completed Frontend V3 campaign. It is **not** a per-screenshot sign-off of
every individual screen capture; unreviewed screenshots carry no separate
approval.

## C. Git state (verified 2026-10-18)

- Repository: https://github.com/quantdale/super-habits
- `main`: `fb10d6ccfe66b54613c6fd22cb82da7dd7626e4f`
  (`docs(v3-audit): record the PR #78 merge SHA`) — protected baseline, unchanged
  by this pause.
- PR #79 — https://github.com/quantdale/super-habits/pull/79
  - Branch: `frontend-v3-post-w17-overnight-successor`
  - Revision: `120ab19a9de2de76d502bfd2876e30a46648f788`
  - Base: `main` · State: **OPEN, UNMERGED**
- PR #80 — https://github.com/quantdale/super-habits/pull/80
  - Branch: `superhabits-reliability-recovery-successor`
  - Revision at freeze: `1050a7326d9013863ee9288187526987d9feb520`
    (this pause document is a single docs-only commit on top of it)
  - Base: `frontend-v3-post-w17-overnight-successor` (stacked on PR #79) ·
    State: **OPEN, UNMERGED**
- Dependency order: `main` ← PR #79 ← PR #80. Neither PR may merge while the
  mandatory security gate is red.
- Also open (preserved, untouched): PR #57 `[Snyk] Security upgrade react-native
from 0.83.10 to 0.85.0` — pre-existing third-party remediation proposal; not
  merged, not closed, not evaluated during this freeze.
- Worktrees (all preserved):

  | Path                                                      | Branch / state                                            |
  | --------------------------------------------------------- | --------------------------------------------------------- |
  | `D:\Documents\tryPython\superhabits`                      | `main` @ `fb10d6c`                                        |
  | `D:\Documents\tryPython\superhabits-overnight`            | `frontend-v3-post-w17-overnight-successor` @ `120ab19`    |
  | `D:\Documents\tryPython\superhabits-reliability-recovery` | `superhabits-reliability-recovery-successor`              |
  | `D:\Documents\tryPython\superhabits-post-w17-correction`  | `frontend-v3-post-w17-adversarial-correction` @ `f61a31f` |
  | `D:\Documents\tryPython\superhabits-android-cert`         | detached HEAD @ `5e62038`                                 |

- Preserved stash: `stash@{0}: On main: pre-recovery-local-changes`.
- Preserved tags: `audit/pre-recovery-f242787`, `bugbot-fixes`,
  `design-system-complete`, `e2e-green`, `phase5-complete`, `phase6-complete`,
  `phase7a-complete`, `phase7b-complete`, `phase7d-complete`, `phase7e-complete`,
  `ui-polish-complete`.
- No history was rewritten. No rebase, squash, cherry-pick, or force-push was
  performed.

Authoritative engineering reports (on the successor branches):

- `docs/ui-ux/v3-audit/post-w17-overnight/WINDOWS-FIRST-SUCCESSOR-REPORT.md`
- `docs/ui-ux/v3-audit/post-w17-overnight/SECURITY-DISPOSITION.md`
- `docs/ui-ux/v3-audit/post-w17-overnight/NATIVE-CERTIFICATION.md`
- `docs/ui-ux/v3-audit/reliability-recovery/RELIABILITY-RECOVERY-REPORT.md`
  (includes the 2026-10-18 final independent-review verification addendum)
- `.agent/execplans/windows-first-successor-campaign-v1.md` (`Status: COMPLETED`)
- `.agent/execplans/superhabits-reliability-recovery-successor.md`
  (`Status: COMPLETED`)

## D. Completed engineering (summary)

Full detail lives in the reports above; this is the index only.

**Frontend V3 (Calm Momentum)** — completed and merged through PR #78:
UI implementation, approved visual direction, major workflow/navigation
coverage, accessibility and responsive-layout work, and visual-regression
evidence.

**Windows-first successor (PR #79)** — workout input reliability, draft
persistence, snapshot sequencing, atomic workout operations, local-first write
integrity, failure visibility, and browser qualification.

**Reliability & Recovery successor (PR #80)** — durable linked-action dispatch
handoff, multi-rule crash-recovery correction, historical rule eligibility,
exactly-once execution safeguards, settings backup consistency, outbox
revision-floor recovery, silent UI mutation-error handling, historical reward
reconciliation (C1, bounded 7-day backfill), and screen-level sequencing
regression coverage (C2).

**Final independent review (2026-10-18)** — adversarial review of the PR #80
diff at `33593b8`: `PASS_WITH_NONBLOCKING_FINDINGS`, no P0/P1/P2 defects.

## E. Validation evidence

Qualification of record — closure round 2026-10-18, application source
`631b005` with docs-only commits `33593b8` and `1050a73` on top (the review and
this pause document introduce no application-source change):

- `npm run typecheck` — 0 errors
- `npm run lint` — 0 errors / 0 warnings
- `npm run qa:fast` — 182 unit files / 2,309 tests + parity guards PASS
- `npx vitest run tests/integration` — 89 files / 449 passed (2 pre-existing
  skips)
- Linked-action suites at closure — 30/30 (5 files); **independently re-run**
  at the final head — **41/41** (6 suites: `linkedActionsMultiRuleCrashRecovery`
  11, `linkedActions` 10, `linkedActionsCrashRecovery` 4,
  `linkedActionEffectsExactlyOnce` 4, `linkedActionLogTargets` 3,
  `linkedActions.engine` 9)
- Hermetic `npm run build:e2e` — PASS (0 Supabase hosts in `dist/`)
- Full Playwright (`npm run e2e`) — **376 passed / 0 failed / 0 flaky / 87
  skipped (39.1 min)** — chromium 254, journeys 80, **visual 34/34**, pwa 5,
  simulation 3; `retries: 0`; skips are the pre-existing `@sync` / `@account` /
  `@portable` / native runtime gates
- Deterministic simulation — 23/23 scenarios
- `npm run openspec:validate` — 88 items / 0 failed; `npm run agent:plan:validate`
  — PASS

Evidence reuse distinction: the 376-test full-suite run and the 34/34 visual
lane are **exact-source evidence reused** from the closure round (source
unchanged since `631b005`); only the six linked-action suites (41/41) were
independently re-executed during the final review. The historical first full
run (367 passed / 9 failed, W15 golden drift from the C1 reward truth) is kept
in the record and is superseded by the golden refresh plus the clean closure
run.

Known exclusions: the 87 skipped tests are labeled runtime gates that were
never exercised on Windows (`@sync`, `@account`, `@portable`, native); native
lanes did not run (see §F). No new certification claims are made by this
document.

## F. Unresolved release blockers

1. **Security — `SECURITY_UNREMEDIATED`.** The mandatory runtime-dependency
   audit gate is red and stays red by design:
   - `braces` 3.0.3 — `GHSA-vfj7-8cjw-p6xm` (HIGH, CVE-2026-93687),
     `first_patched_version: null`; chain `tailwindcss → chokidar/micromatch →
braces`.
   - `node-forge` 1.4.0 — `GHSA-86w9-cpqp-85rv` (HIGH, CVE-2026-85393),
     `first_patched_version: null`; chain `expo → @expo/cli →
@expo/code-signing-certificates → node-forge`.
   - Both are build-time only, affect no shipped runtime code, and have no safe
     executable remediation (registry re-checked 2026-10-17). No waiver,
     allowlist entry, severity change, or CI bypass is authorized. Neither PR
     may merge while this gate is red. See
     `docs/ui-ux/v3-audit/post-w17-overnight/SECURITY-DISPOSITION.md` and
     `openspec/changes/resolve-braces-security-blocker/`.
2. **iOS — `IOS_QUALIFICATION_DEFERRED_BY_OWNER`.** Owner-deferred; last
   device-qualified evidence is historical. No iOS certification claim exists.
3. **Android — `ENVIRONMENT_BLOCKED`.** Blocked on a foreign emulator
   (`emulator-5594`) and unavailable qualification environment. No Android
   certification claim exists for the successor source.
4. **Formal visual review.** The Calm Momentum direction is owner-approved as
   the design foundation; a formal per-screen visual sign-off of every screen
   is not part of the recorded approvals and remains available as a release-time
   requirement if the owner wants it.

**A paused project does not imply these blockers are resolved.**

## G. Known non-blocking limitations

Do not reclassify these as new critical defects.

- **P3 — rule pause/re-enable retroactivity edge.** A rule paused at event time
  and re-enabled later fires on the historical event at a subsequent startup
  sweep (eligibility is "existed-then AND active-now"; no status-transition
  history exists). Reproduced deterministically; impact is one late but
  rule-consistent effect inside the 7-day horizon; no double-apply, no
  corruption; identical behavior existed in the A1 baseline. Disposition:
  **DOCUMENTED, no code change** — the alternatives would break documented
  live-configuration semantics. Pause-AFTER-event (never fires) is test-covered.
- Residual risks recorded in the reliability report (lease retry timing,
  read-only re-scans inside the event window, current-config replay, event-window
  scan cost) — all bounded and documented, none a confirmed defect.
- Historical Windows-CRLF `agentDocConsistency` environment residual and the
  Focus notification-scheduling timestamp residual remain recorded historical
  gaps, unchanged by the freeze.

## H. Preservation requirements

Leave intact: all branches (local and remote), all pull requests (including
#57), all historical commits, all Git tags, all five worktrees, the stash
`stash@{0}: pre-recovery-local-changes`, the untracked foreign evidence
directories `.tmp-ios36423379932/` (present in both `superhabits` and
`superhabits-overnight` worktrees), `features_tsx_list.txt`, historical native
test evidence, all review reports and ExecPlans, existing test artifacts/logs,
local development configuration, and existing Supabase configuration and data.

Prefer preservation over cleanup. Untracked preserved evidence is **not**
disposable build debris and must not be deleted to produce a clean
`git status`. No destructive operations are authorized.

## I. Safe resumption instructions

Only when the owner explicitly authorizes reactivation:

```bash
# 1. Orient (read-only)
cd D:\Documents\tryPython\superhabits-reliability-recovery
git fetch origin --prune
git log --oneline -5
git status --short
gh pr view 79   # confirm still open / unmerged state
gh pr view 80

# 2. Read the record
#    docs/PROJECT-PAUSE-HANDOFF.md (this file)
#    docs/ui-ux/v3-audit/post-w17-overnight/WINDOWS-FIRST-SUCCESSOR-REPORT.md
#    docs/ui-ux/v3-audit/reliability-recovery/RELIABILITY-RECOVERY-REPORT.md
#    AGENTS.md, .agent/PLANS.md

# 3. Re-check the release blockers before any release work
npm view braces version
npm view node-forge version
# + https://api.github.com/advisories/GHSA-vfj7-8cjw-p6xm
# + https://api.github.com/advisories/GHSA-86w9-cpqp-85rv

# 4. Reassess native qualification availability (emulator / iOS tooling)
```

Minimum resumption steps: verify branch/PR state (§C) → re-check security
blockers (§F) → reassess native qualification → preserve Calm Momentum (§B) →
review backlog and §G limitations → establish a new owner-authorized scope →
create a new ExecPlan (`.agent/PLANS.md` conventions) before substantial work →
continue from the accepted baseline in §D. Do not restart Frontend V3.

## J. Reactivation policy

**No further SuperHabits engineering work is authorized until the project owner
explicitly requests it.** Do not auto-resume because a dependency release
becomes available, a scheduled date passes, or a CI lane turns green. New
features, refactors, architecture changes, audits, dependency remediation,
native qualification runs, merges of PR #79/#80, and successor campaigns are
all out of scope until explicit owner reactivation.

Autonomous-development shutdown record (2026-10-18): no running local
development agents, dev servers, emulators, or build processes were found; no
in-flight CI runs were found. The Windows scheduled tasks `SuperHabitsEmu` and
`SuperHabitsEmuATD` are dormant one-shot emulator-launch helpers (last run
2026-08-05, no future trigger) — left intact per preservation policy. The
GitHub Actions `ci.yml` `schedule:` (nightly, report-only) remains configured
in the repository; it produces no development commits and CI configuration was
deliberately not modified during the freeze. If the owner wants it stopped, the
manual action is: GitHub → Actions → CI → "..." → Disable workflow (or remove
the `schedule:` block at reactivation). `.eas/workflows/native-e2e.yml`,
`supabase-deploy.yml`, and `web-e2e-validation.yml` are manual/label/event
triggered only and will not run without new activity.
