# Full-Spectrum Pre-Production Campaign v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Advance SuperHabits toward production readiness across six independent
workstreams (branding, security, Supabase/backup, web/PWA, native, governance)
in one coordinated campaign, leaving every workstream with a defensible,
evidence-backed checkpoint and a prioritized correction backlog.

Production release is explicitly NOT authorized. Source implementation is.

## Context

- Starting `origin/main`: `0259c2a72bb71ba3f9459cd071b791feb2a4ff35`
  ("docs(agents): add shared UX, DX, and AX principles").
- Historical reference points (from the owner brief, verified against Git):
  previously reviewed main `f9cebe65`; canonical branding draft PR #85
  (`branding/canonical-super-habits`, head `880b692d`).
- Protocol: `AGENTS.md`, `.agent/PLANS.md`, `docs/PROJECT_STRUCTURE_MAP.md`,
  `docs/testing/autonomous-qa.md`.
- Single-page Expo app, SQLite local source of truth, one-way push backup to
  Supabase plus controlled restore, portable backups.

### Verified starting state (reconnaissance, 2026-10-22)

- `npm run typecheck` → 0 errors. `npm run lint` → clean (`--max-warnings 0`).
- `node scripts/audit-runtime-deps.mjs` → **exit 1**, two `[UNDOCUMENTED]`
  HIGH advisories: `braces` GHSA-vfj7-8cjw-p6xm (range `<= 3.0.3`,
  `first_patched_version: null`) and `node-forge` GHSA-86w9-cpqp-85rv
  (range `<= 1.4.0`, `first_patched_version: null`). Three dated
  `brace-expansion` entries remain allowlisted.
- GitHub ruleset `Protect Main` (id `15001092`): **`enforcement: "disabled"`**.
  Classic branch protection on `main`: **absent** (404).
- Open PRs: #85 (draft, branding), #81 + #57 (Snyk, unmerged), #80 (reliability
  successor, release-blocked).
- PR #85 `quality` failure is a REAL defect, not flake:
  `FAIL .agent/execplans/canonical-super-habits-identity-v1.md [ACTIVE]` —
  `Current Checkpoint missing field: modifiedFiles / lastValidation / remainingDod`.
- Local Android emulator `emulator-5554` (API 36, x86_64) is booted with
  `com.dale16.superhabits` installed, but the APK is STALE
  (`versionCode=1`, `lastUpdateTime=2026-08-25`) versus current source.
- No `supabase` CLI, no `vercel` CLI, no `EXPO_PUBLIC_*` / Supabase / Vercel
  tokens in the environment → hosted cloud qualification is externally blocked.

## Scope

WS-01 branding · WS-02 security · WS-03 Supabase/backup · WS-04 web/PWA ·
WS-05 native · WS-06 governance, plus WS-07 independent adversarial review.

## Non-Goals

- No production deployment, promotion, or Vercel-hold removal.
- No destructive cloud action (project deletion/rename, data migration).
- No native identity (Android package / iOS bundle / scheme) change.
- No security waiver, silent allowlist entry, or severity downgrade.
- No force-push, history rewrite, or mass merge into `main`.
- No break of portable-backup or local-storage compatibility.

## Current Checkpoint

- Current Milestone: Complete. Six workstreams investigated; five committed
  increments plus the branding PR repair; five draft PRs published (#86-#90) and
  PR #85 unblocked; campaign report written.
- Completed: PASS A reconnaissance across all six workstreams (four parallel
  read-only scout lanes plus direct verification). PASS B/C implementation:
  WS-02 brace-expansion remediation + migration-6 data-loss fix; WS-01 classified
  legacy-name inventory + live brand copy + PR #85 ExecPlan repair; WS-04 bounded
  local DB bootstrap; WS-03 backup-generation schema guard; WS-05 upload-key
  provenance guard; WS-06 release-readiness verdict. PASS D integration, self
  adversarial review (L1-L8), campaign report and correction backlog.
- In Progress: Nothing. Remaining work is owner-gated or scheduled into the
  correction campaigns A-D.
- Modified files: core/db/client.ts; core/providers/AppProviders.tsx;
  core/providers/localDbPhase.ts; scripts/audit-runtime-deps.mjs;
  scripts/legacy-name-inventory.mjs; scripts/release-readiness.mjs;
  scripts/validate-supabase-schema.mjs; package.json; package-lock.json;
  .github/workflows/ci.yml; 8 live brand-copy files;
  docs/branding/canonical-name-migration.md;
  docs/release/release-signing-posture.md;
  docs/release/store-data-declarations.md;
  docs/reports/full-spectrum-preproduction-campaign-report.md;
  tests/auditRuntimeDeps.test.ts; tests/integration/migrations.test.ts;
  tests/localDbPhase.test.ts; tests/backupGenerationSchemaGuard.test.ts;
  tests/releaseReadiness.test.ts; tests/legacyNameInventory.test.ts;
  tests/releaseBuildPosture.test.ts; tests/play-listing-copy.test.ts;
  e2e/journeys/two-tabs.spec.ts; and this plan.
- Last successful validation: npm run typecheck 0 errors; npm run lint 0/0;
  npx vitest run 3074 passed / 3 skipped / 0 failed; npm ci PASS from the patched
  lockfile; hosted Linux CI confirms brace-expansion absent from the tree;
  hosted Validate versioned ExecPlans PASS on PR #85; npm run web:hygiene PASS
  (8081/8082 free).
- Current failures: The dependency-advisory gate is red on braces
  GHSA-vfj7-8cjw-p6xm and node-forge GHSA-86w9-cpqp-85rv. Both report
  first_patched_version null for every affected range, verified against the
  advisory API, and reach only build-time tooling. They stay red by design; no
  waiver was added.
- Relevant quarantines: None added or removed. docs/testing/known-gaps.md was not
  modified.
- Blockers: Hosted Supabase/Vercel access absent (EXTERNAL). GitHub ruleset
  enablement needs administrator authorization (EXTERNAL). Signing custody and
  store/legal actions are owner work (EXTERNAL). iOS has no Apple hardware
  (EXTERNAL, owner-deferred).
- Exact next action: None for this campaign. The next unit of work is
  Correction Campaign A, starting with CORR-A-02 (storage quota/eviction is
  entirely unhandled and can lose OPFS data silently), and is tracked in
  docs/reports/full-spectrum-preproduction-campaign-report.md section M.
- Remaining definition of done: None for this campaign. The six workstreams each
  carry a PARTIAL_* or INVESTIGATION_COMPLETE status in the report, with explicit
  next actions; no production readiness is claimed and main is not release-ready.

## Progress

- [x] PASS A — repository truth established for all six workstreams
- [x] PASS B — one meaningful increment per workstream (all six)
- [x] PASS C — targeted expansion on highest-value unblocked work
- [x] PASS D — integration, adversarial review, campaign report

## Surprises & Discoveries

- PR #85's red `quality` is not ambient flake: the branding branch's own
  ExecPlan is missing three required `Current Checkpoint` fields. A one-commit
  repair unblocks the branch's real CI signal.
- `braces` enters the **production** audit tree only through `tailwindcss`
  (a `dependencies` entry) → `chokidar`/`micromatch`. Tailwind/NativeWind are
  build-time transpilers, so the `dependencies` placement — not the advisory —
  is the actionable defect.
- The GitHub `Protect Main` ruleset exists but is disabled, and there is no
  classic branch protection. Governance is documentation-only today.
- The booted emulator carries an APK from 2026-08-25; any native claim must
  come from a fresh provisioned build, never from the installed one.

## Decision Log

- **Campaign branches, not `main`.** Every workstream lands on its own owned
  branch; nothing merges into `main` during this campaign.
- **No security allowlist additions.** `braces` remediation is scoped as a real
  dependency-scope correction with build evidence; `node-forge` stays visibly
  red until an upstream fix exists.
- **No native identity migration.** `com.dale16.superhabits` and the
  `superhabits` scheme are frozen this campaign; WS-01 documents the
  compatibility ledger instead.
- **Hosted cloud work is blocked, not simulated.** Local backup/RLS
  certification only; hosted status is reported as unverified.

## Validation Ledger

| Command                               | Outcome                                            | Date       |
| ------------------------------------- | -------------------------------------------------- | ---------- |
| `npm run typecheck`                   | PASS, 0 errors                                     | 2026-10-22 |
| `npm run lint`                        | PASS, 0 warnings (`--max-warnings 0`)              | 2026-10-22 |
| `node scripts/audit-runtime-deps.mjs` | FAIL, exit 1 — 2 undocumented HIGH                 | 2026-10-22 |
| `gh api repos/.../rulesets`           | `Protect Main` enforcement `disabled`              | 2026-10-22 |
| `adb devices`                         | `emulator-5554 device` (API 36, x86_64), stale APK | 2026-10-22 |

## Changed Files / Areas

Populated per workstream as changes land; Git remains authoritative.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`, `git log --oneline -5`, `git worktree list`.
3. `npm run agent:resume -- --plan .agent/execplans/full-spectrum-preproduction-campaign-v1.md`.
4. Re-verify the advisory state (`node scripts/audit-runtime-deps.mjs`) and the
   ruleset state (`gh api repos/quantdale/super-habits/rulesets`) — both drift.
5. Resume from **exactNextAction**.

## Outcomes & Retrospective

Delivered across six workstreams, nothing merged to `main`, no production action:

- **Two real defects corrected.** Migration 6 ran its `sort_order` ALTER outside
  `applyMigration`, so a crash in that window permanently collapsed a user's
  manual task ordering to `DEFAULT 0`; the new integration test fails against the
  old placement. And `initializeDatabase()` was the one unbounded bootstrap phase,
  so a stalled OPFS open (another tab holding the origin-wide lock) hung the
  startup gate forever with no retry affordance.
- **A false security premise corrected.** Three `brace-expansion` advisories were
  allowlisted for six weeks on the claim that no fix existed. Every affected range
  publishes a patched release. Fixed by overrides inside the caret ranges the
  parents already declare; the allowlist is now empty so a regression is visible.
- **Three previously unguarded surfaces now gated**: the backup-generation
  protocol (zero prior coverage), release-readiness as a computed verdict, and
  upload-key provenance. Four of the new guards are backed by tests that mutate
  real inputs and assert rejection, so they cannot pass vacuously.
- **PR #85 unblocked** — its `quality` failure was its own ExecPlan schema, now
  hosted-green.

Lessons worth carrying forward:

- A dependency allowlist that asserts "no fix exists" is a claim like any other
  and must be re-verified against `first_patched_version`, not trusted.
- Test suites that assert a policy's CONTENTS break when the policy correctly
  changes; they should assert the mechanism against a fixture.
- On Windows, `npm install` silently prunes other platforms' optional binaries
  from the lockfile. Always diff the resolved package set before committing.
- A detected emulator is not evidence: the installed APK predated current source.

Honest incompleteness: hosted Supabase/Vercel, all native runtime behavior, and
the E2E/visual/simulation lanes were never executed and are recorded as
UNEXECUTED, not passed. `main` is not release-ready.
