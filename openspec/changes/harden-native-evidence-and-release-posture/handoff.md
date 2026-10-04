# HANDOFF — "perform openspec apply" (continued session)

> **Resolution note (2026-10-01):** this handoff is preserved inside the change it
> documents. Its `commit`-state section is now historical: the seven-change wave was
> committed as `194c626`, `8bb3fdc`, `af29d43`, `9ba91a7`, `f5de4bb`, `b899a87`, `68db684`
> (each verified typecheck- and lint-clean in its own worktree), and the device leg was
> subsequently executed on `68db684` from a clean worktree of that commit. The "nothing is
> committed" statements below describe the state at the time of writing, not the current
> tree. See `.agent/execplans/apply-closure-resolution.md` for the live record.

**Goal: APPLY COMPLETE.** All seven pending OpenSpec changes in `openspec/changes/`
are applied. Six are COMPLETE; one is 24/26 with its device leg blocked on two external
conditions recorded below.

**Nothing is committed.** The whole wave lives in the working tree. Committing, archiving
into `openspec/specs/`, and pushing are separate, user-invoked steps — none were taken.

## 1. Board (verified 2026-10-01, pinned Node v22.23.2)

| #   | Change                                       | Tasks | Status                                  |
| --- | -------------------------------------------- | ----- | --------------------------------------- |
| 1   | `harden-agent-guidance-truth`                | 25/25 | ✅ COMPLETE, validated                  |
| 2   | `fix-local-calendar-day-windows`             | 16/16 | ✅ COMPLETE, validated                  |
| 3   | `harden-interaction-idempotency`             | 18/18 | ✅ COMPLETE, validated                  |
| 4   | `reduce-section-activation-render-work`      | 16/16 | ✅ COMPLETE, validated                  |
| 5   | `harden-ci-lane-integrity`                   | 26/26 | ✅ COMPLETE, validated                  |
| 6   | `harden-native-evidence-and-release-posture` | 24/26 | ⚠️ BLOCKED on the device leg (5.3, 5.4) |
| 7   | `harden-silent-failure-certification`        | 35/35 | ✅ COMPLETE, validated                  |

Each has `openspec/changes/<slug>/execplan.md`, `Plan-Version: 2`, validated by
`npm run agent:plan:validate:all` (6 COMPLETED, 1 BLOCKED — BLOCKED is the honest
lifecycle state for a plan whose only remaining work needs external input).

`final-certification-closure` (13/22) and `external-blocker-closure` remain as they were:
pre-existing, credential/device gated, out of scope for this goal.

## 2. What changed in this session (changes 5, 6, 7)

### Change 5 — `harden-ci-lane-integrity` (26/26)

CI wiring + the guards that make CI honest. Retry-report gate wired after every Playwright
invocation in `ci.yml` (one gate per invocation, because each run rewrites the single JSON
report); disposable lane reads the `secrets` context; `npm audit` became a real gate via
`scripts/audit-runtime-deps.mjs`; nightly report-only steps marked; dist-sync removed from
the gating job; `ios-native-e2e.yml` got a concurrency group; `playwright.config.ts` pins
`timezoneId`/`locale`; the quarantine register now requires a structured `**Gate site:**`
entry and fails on stale entries. New `tests/ciLaneIntegrity.test.ts` (10) pins the wiring;
non-vacuity proven by mutating `ci.yml` (3 mutations → 3 targeted failures).

### Change 6 — `harden-native-evidence-and-release-posture` (24/26)

Native evidence honesty. Shared hermetic envelope (`scripts/hermetic-build.mjs`) now used
by BOTH the web export and the native APK build; the APK's JS bundle is scanned before
install (`scripts/native-apk-scan.mjs`); the provenance sidecar records the resolved
endpoint + anon-key fingerprint; the runner proves flow coverage from Maestro's own
per-flow debug output and records `provisioned` / `installedApkSha256`; `allowBackup:false`

- blocked overlay permission in `app.json`; store declarations now state the REAL
  built-manifest permission set; release-profile guard rejects the native test seam outside
  `e2e-test`; Ask/Auto default-off enforced at the render boundary and at the provider.

**Two real defects found by the new guards:**

- The 2026-09-24 "credential-free" APK carried `kruubbynsmxzxfdunaal.supabase.co` inlined
  from the developer's `.env` (the old build had no `EXPO_NO_DOTENV`). A fresh hermetic
  build scanned clean.
- The permission guard caught MY OWN transcription error: the committed list named two
  launcher permissions wrongly and missed four `com.android.launcher.permission.*` entries
  (34 vs the real 36). Corrected against the real merge.

**BLOCKED (5.3, 5.4) — exact resume action:**

1. Commit the applied changes (the certification path requires a clean Git tree:
   `requireCleanGitTree`), **and**
2. Boot a responsive API 36 x86_64 emulator. (The `emulator-5554` that pre-existed this
   session does not answer `adb shell` — `getprop` exits 124 — and a second `Nitro_API_36`
   refuses to boot while it holds the AVD. This session did not kill a process it did not
   start.)

Then: `npm run qa:native:provision -- --serial <serial>` → `node scripts/qa-native.mjs
--platform android --tag smoke` (read `remoteConfiguration`, `bundleScan`, `flowCoverage`,
`provisioned`, `installedApkSha256`), then repeat for `--tag persistence` and
`--tag lifecycle` and record the flow counts the report proves.

### Change 7 — `harden-silent-failure-certification` (35/35)

Unverified outcomes made visible. Three-valued V2 capability probe + an indeterminate
coverage state distinct from legacy; `missingEntities` disclosed; per-entity restored
counts; a durable outbox attempt ledger with a terminal `blocked` state (excluded from the
frozen checkpoint AND from the certified manifest scope, so integrity holds); post-push
read-back so a silent skip is a failure, not a certified row; owner-scoped uniqueness
generalized and `habit_completions` FIXED (new additive migration + fixture); distinct-owner
remote probe (the foreign-owner branch is reachable now); unprimed-owner-cache hole closed;
migration chain fails loudly on a corrupted version, guards block 6's ordering backfill, and
asserts its head; remote-DDL projection guard; restore-prompt copy and owner-scoped
pending-change count corrected.

**Two real defects found by the new guards:** the global `habit_completions` uniqueness
(real cross-owner collision, now remediated) and the self-answering remote-owner check.

## 3. Validation (this session, pinned Node v22.23.2)

| Gate                                                             | Result                                                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| `npm run typecheck`                                              | 0 errors                                                              |
| `npx eslint .` (explicit — the deferred runner times out at 30s) | 0 errors, 0 warnings                                                  |
| unit project                                                     | 169 files / 2052 tests                                                |
| `npm run test:integration` (real SQLite)                         | 80 files / 397 tests (1 file / 2 tests skipped, pre-existing)         |
| `npm run supabase:schema:validate`                               | PASS                                                                  |
| `npm run openspec:validate --all`                                | 68 / 68                                                               |
| `npm run agent:plan:validate:all`                                | all 7 plans valid                                                     |
| `npm run build:e2e`                                              | hermetic, 0 Supabase hosts                                            |
| affected E2E journeys (`new-phone`, `portable-owner-recovery`)   | 3 passed, 10 skipped — every skip a registered `@sync` lane attribute |
| `npm run web:hygiene`                                            | PASS, 8081/8082 free                                                  |

## 4. Environment notes (hard-won, unchanged)

- **Pinned Node:** `export PATH="/c/Users/palac/AppData/Local/tools/node-v22.23.2-win-x64:$PATH"`
- **Never `npm audit fix`** — it prunes dev deps and rewrites the lockfile badly.
- **Deferred eslint runner times out at 30s** — run `npx eslint .` explicitly for the real gate.
- **This host is loaded** (2–4 GB free, ~77 node processes). Three unit files charge a cold
  module import to their first test's 5s budget and flake under full-suite parallelism. The
  unit project is green at `--maxWorkers=4`. The three files whose first test imports code
  this wave touched were fixed at the source (load moved to collection time); the rest are
  pre-existing exposure, left alone rather than given longer timeouts.
- **`npx playwright test --list`** — **336 tests / 32 files**, up from 334 at `c1bc380`: the
  `harden-interaction-idempotency` fat-fingers journey gained exactly two steps (the inline
  quick-add row oracle and the identical-capture undo oracle). It does NOT "stay at 336" —
  the pre-wave tree was 334 and the inventory moved by those two steps. Verified 2026-10-01:
  `c1bc380` → 334 in 32 files, `68db684` → 336 in 32 files, and every other
  `e2e/journeys/*.spec.ts` step count is unchanged (102 → 104 journey steps total).
