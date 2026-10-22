# Full-Spectrum Pre-Production Campaign v1

Plan-Version: 2
Status: ACTIVE

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

- Current Milestone: PASS A reconnaissance complete; executing PASS B
  (minimum meaningful progress in every workstream).
- Completed: Repository truth established (branch/PR/ruleset/advisory/
  emulator/cloud-access state verified). Baseline `typecheck` and `lint` green.
- In Progress: WS-02 production-tree scope reduction for `braces`; WS-01
  PR #85 ExecPlan schema repair.
- Modified files: `.agent/execplans/full-spectrum-preproduction-campaign-v1.md`
  (this plan). Production source files are added as workstreams land.
- Last validation: `npm run typecheck` → 0 errors; `npm run lint` → clean,
  both on `0259c2a7` (2026-10-22).
- Current failures: `node scripts/audit-runtime-deps.mjs` exits 1 with two
  undocumented HIGH advisories (`braces`, `node-forge`); PR #85 `quality` fails
  on ExecPlan schema validation.
- Relevant quarantines: No new quarantine added or removed by this campaign. The
  existing `docs/testing/known-gaps.md` register is unchanged so far.
- Blockers: Hosted Supabase certification — no Supabase CLI/credentials in
  this environment (EXTERNAL). Vercel project inspection — no Vercel CLI/token
  (EXTERNAL). iOS certification — no Apple hardware (EXTERNAL, owner-deferred).
  GitHub ruleset enablement — administrator authorization (EXTERNAL).
- Exact next action: Prove empirically whether `tailwindcss`/`nativewind` are
  build-time-only (grep the production web export and the Metro bundle for
  runtime `braces`/`tailwindcss` code); if proven, relocate them to
  `devDependencies` so `braces` leaves the `npm audit --omit=dev` production
  tree, and verify with `npm ci` + `audit-runtime-deps` + `build:web`.
- Remaining definition of done: Six workstream reports written; every workstream advanced
  past investigation; safe corrections committed on owned branches; draft PRs
  opened or updated; validation ledger with exact commands/SHAs/outcomes;
  independent adversarial review recorded; correction backlog (Campaigns A–D)
  written; campaign report at
  `docs/reports/full-spectrum-preproduction-campaign-report.md`; no unauthorized
  production or destructive action taken.

## Progress

- [x] PASS A — repository truth established for all six workstreams
- [ ] PASS B — one meaningful increment per workstream
- [ ] PASS C — targeted expansion on highest-value unblocked work
- [ ] PASS D — integration, adversarial review, campaign report

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

Completed at the end of the campaign.
