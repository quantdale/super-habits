# ExecPlan: Bootstrap Nitro Workstation

## Purpose / User Outcome

Reconstruct and verify a fresh Nitro workstation for SuperHabits development
from the repository and lockfile. The web/QA stack must be executable locally;
Android/native readiness must be measured honestly and improved where the host
supports it. No product or feature development is in scope.

## Context

- Repository: `C:\Users\Michael Roy\Documents\super-habits`.
- Canonical setup guide: `docs/development/workstation-bootstrap.md`.
- Repository behavior and QA rules are defined by `AGENTS.md`, `.agent/PLANS.md`,
  `docs/testing/autonomous-qa.md`, and `docs/testing/native-e2e.md`.
- Expected migrated main commit: `6c358bce9fd59a273a78d1b8941264f81a7ec76f`.
- Local web development is Node/npm + Expo web + SQLite WASM/OPFS; Playwright
  uses the static export and COOP/COEP headers. Native E2E requires a built
  `e2e-test` app, a booted Android target, and Maestro.
- Secrets must never be printed, committed, or copied from the old machine.

## Scope

- Inspect Git, OpenSpec, repository agent configuration, environment templates,
  and Nitro’s OS/toolchain.
- Install only repository-supported/local prerequisites, using `npm ci` and
  repository-local CLIs where possible.
- Run the required web, autonomous-QA, Playwright inventory/representative E2E,
  sync/build, and native preflight checks that the environment permits.
- Fix only genuine, portable repository bootstrap defects discovered by evidence.
- Keep this plan current so a zero-context agent can resume or audit the work.

## Non-Goals

- No product or feature behavior changes.
- No copying of credentials, caches, emulator images, `node_modules`, generated
  builds, or user-global Codex state.
- No merge/reset/history rewrite or deletion of backup branches/worktrees.
- No claim of native or cloud readiness without actual execution evidence.

## Current Checkpoint

- Milestone: Nitro reconstruction, validation, and repository handoff complete.
- Completed: Read all required repository instructions and canonical
  workstation, autonomous-QA, native-E2E, Codex workflow, structure, and rule
  documents; verified the migrated Git state and fetched all preserved refs and
  tags; installed Node 22, Python for the native dependency build, OpenJDK 17,
  Android Studio, the Android command-line tools, SDK 36/build tools, emulator,
  platform-tools, EAS CLI and Supabase CLI via repository-local `npx`; installed
  Playwright Chromium; and validated web, QA, simulation, OpenSpec, and sync
  lanes.
- Last successful validation: `main`/`origin/main` remain at
  `6c358bce9fd59a273a78d1b8941264f81a7ec76f`; `npm ci` added 1111 packages,
  applied both checked-in patches, and installed the pre-commit hook; doctor
  passes Node/npm/Git/dependencies/Expo/TypeScript/Vitest/Playwright/OpenSpec,
  Chromium, JDK 17, adb, emulator, and both web ports. Full deterministic
  simulation passed all 16 scenarios; full standard E2E passed 137/162 with
  25 documented skips and 0 failures; sync E2E passed 18/19 with one CG-2
  quarantine skip; journeys passed 12/16 with four CG-1 quarantine skips;
  unit, integration, timezone, impact-map, and OpenSpec gates pass. Live web
  validation reached HTTP 200 with `crossOriginIsolated=true` and
  `document.documentElement.dataset.dbReady=true`.
- Native status: JDK 17, Android SDK 36, Build Tools 36.0.0, platform-tools
  37.0.1, emulator 37.1.11, and user-level Android/JDK environment variables
  are configured. No AVD/device exists; the Google APIs x86_64 system-image
  download stalled and was stopped. Maestro CLI installation was attempted
  from the official release but its 300 MB archive transfer reset before a
  valid file was produced. `qa:native:android` and `qa:native:ios` therefore
  report `ENVIRONMENT` at the Maestro check.
- Portable fixes made: `eslint.config.mjs` ignores generated `expo-env.d.ts`,
  and `docs/development/workstation-bootstrap.md` documents the Windows
  `better-sqlite3`/Python/MSVC prerequisite. No product behavior was changed.
- Exact next action: Hand off the verified local and remote repository state;
  no further repository action is required for the workstation bootstrap.
- Remaining definition of done: Final plan contains exact evidence, known
  skips, failed invocation classification, native manual steps, final Git SHA,
  and the requested 16-part handoff with no secret values.

## Progress

- [x] Read required repository guidance.
- [x] Create Nitro-specific durable ExecPlan.
- [x] Inspect initial Git, OpenSpec, environment names, and repository config.
- [x] Fetch preserved refs/tags and verify remote migration refs.
- [x] Verify OS and web/native toolchain inventory.
- [x] Install/reconstruct Node dependencies and Playwright Chromium.
- [x] Run QA, simulation, OpenSpec, and Playwright validation.
- [x] Run Android/Maestro preflight and native execution if actually available.
- [x] Audit/fix and validate any genuine portability defects.
- [x] Reconcile Git, update final plan state, and report exact verdicts.

## Surprises & Discoveries

- `npm ci` initially failed in the lockfile's `better-sqlite3` native build
  because Python was absent. Installing Python 3.13.15 and using the existing
  MSVC 14.44.35207 toolset resolved the environment failure; the repository's
  prior bootstrap text was corrected accordingly.
- Expo's build generates `expo-env.d.ts` with an explicit do-not-edit/gitignore
  notice, but ESLint did not ignore it. Adding that generated file to the
  existing ESLint ignore set was required for repeatable `qa:fast` after a web
  build.
- A direct low-level simulation runner invocation fails uniformly with
  `ERR_CONNECTION_REFUSED` when no static server is running. The repository
  wrapper owns build/server startup; its all-scenario rerun passed all 16.
- Android Studio installed without initializing the SDK. Official command-line
  tools were then installed and used to provision the core SDK packages. The
  optional system-image transfer stalled; no AVD was created.

## Decision Log

- 2026-08-09 — Treat this as non-OpenSpec operational work — The user
  explicitly requires `.agent/execplans/bootstrap-nitro-workstation.md` and no
  product development.
- 2026-08-09 — Prefer repository-local CLIs — The workstation guide explicitly
  prefers `npx` and lockfile-backed scripts over unnecessary global installs.
- 2026-08-09 — Install only native prerequisites supported by the guide — Used
  Winget's Microsoft OpenJDK 17 and Android Studio packages, official Android
  command-line tools, and `npx eas-cli@18.5.0`/`npx supabase`; did not install
  global Node/Expo/Playwright CLIs.
- 2026-08-09 — Keep native readiness honest — Do not create a synthetic AVD or
  claim native PASS without a booted target, installed E2E APK, and Maestro
  execution evidence.

## Validation Ledger

- 2026-08-09 — Required documentation reads — PASS — Completed before task
  actions.
- 2026-08-09 — Git/OpenSpec/machine inventory — PASS — Expected SHA present;
  `origin/main`, 32 Predator backup refs, preserved linked-actions ref, and
  relevant tags visible; no active stale Predator path found.
- 2026-08-09 — First `npm ci` — ENVIRONMENT — `better-sqlite3` node-gyp build
  had no Python; resolved by installing Python 3.13.15 and using MSVC 14.44.
- 2026-08-09 — Second `npm ci` — PASS — 1111 packages; patch-package applied
  two checked-in patches; simple-git-hooks installed the pre-commit hook.
- 2026-08-09 — `npx playwright install chromium` — PASS — Chromium/driver,
  FFmpeg, headless shell, and winldd installed in the user Playwright cache.
- 2026-08-09 — `npm run dev:doctor` — PASS — Core stack and JDK/adb/emulator
  verified; Maestro/EAS/Supabase remain optional PATH gaps; local-only env is
  supported.
- 2026-08-09 — `npm run typecheck`, `npm run lint`, `npm test` — PASS — zero
  type errors, zero lint errors/17 warnings within budget, 633 tests passing.
- 2026-08-09 — `npm run qa:fast` — PASS — 50 unit files and 589 unit tests;
  typecheck and lint pass.
- 2026-08-09 — `npm run qa:integration` — PASS — 7 files and 44 tests.
- 2026-08-09 — `npm run qa:timezones` — PASS — Asia/Manila, UTC,
  America/New_York, Pacific/Honolulu, Pacific/Kiritimati.
- 2026-08-09 — `npm run qa:impact:validate`, `npm run openspec:validate` —
  PASS — 11 impact rules and 14 OpenSpec items.
- 2026-08-09 — no-dotenv `npm run build:web` — PASS — `dist/` exported and
  contained no optional env names/placeholders.
- 2026-08-09 — live `npm run web` probe — PASS — HTTP 200,
  `crossOriginIsolated=true`, DB-ready dataset true, six-section shell rendered.
- 2026-08-09 — exact `npm run web` invocation — PASS — after inheriting the
  verified Node PATH, Playwright observed HTTP 200,
  `crossOriginIsolated=true`, `data-db-ready="true"`, and the Overview shell.
- 2026-08-09 — `npx playwright test --list` — PASS — 181 tests in 19 files.
- 2026-08-09 — `npm run qa:journeys` — PASS — 12 P0 tests; 4 explicit CG-1
  quarantine skips.
- 2026-08-09 — `npm run qa:simulation` — PASS — validation plus deterministic
  P0 smoke; 24 steps passed.
- 2026-08-09 — `npm run qa:simulation -- --all --mode deterministic` — PASS —
  all 16 deterministic scenarios passed.
- 2026-08-09 — `npm run e2e` — PASS — 137 passed, 25 skipped, 0 failed out of
  162 standard tests; skips are documented credential gates, local-only remote
  boundaries, and known quarantines.
- 2026-08-09 — `npm run build:sync` — PASS — dummy-Supabase sync export built.
- 2026-08-09 — `npm run e2e:sync` — PASS — 18 passed, 1 CG-2 quarantine skip,
  0 failed out of 19.
- 2026-08-09 — JDK/SDK command checks — PASS/PARTIAL — Java 17, adb 37.0.1,
  emulator 37.1.11, SDK 36 and Build Tools 36.0.0 work; no AVD/device.
- 2026-08-09 — `maestro --version` and native preflight — ENVIRONMENT — Maestro
  archive transfer reset; Android and iOS runners report Maestro missing.
- 2026-08-09 — direct `sim:run --all` without wrapper — ENVIRONMENT/TEST
  INVOCATION — 16 setup failures from connection refused; preserved as evidence
  and superseded by the wrapper PASS above.
- 2026-08-09 — `npm run format:check` — FAIL — repository-wide check reports 84
  pre-existing files outside this task. The ExecPlan, workstation guide, and
  ESLint config touched here pass targeted Prettier checks; no unrelated files
  were reformatted.
- 2026-08-09 — commit hook and repository commit — PASS — `npx` was made
  available to the hook through the current Nitro process PATH; the bootstrap
  commit contains only this plan and the two portable bootstrap fixes.
- 2026-08-09 — `git push origin main` — ENVIRONMENT — HTTPS push hung twice
  without output (including with terminal prompts disabled); only the push
  process tree was stopped. The local commit and clean worktree remain intact.
- 2026-08-09 — authenticated `git push origin main` — PASS — `origin/main`
  advanced from `6c358bc` to `e32cc48` and matches the local bootstrap commit.

## Changed Files / Areas

- `.agent/execplans/bootstrap-nitro-workstation.md` — Durable Nitro bootstrap
  state and validation ledger.
- `docs/development/workstation-bootstrap.md` — Corrected Windows native
  dependency-build prerequisite documentation.
- `eslint.config.mjs` — Ignored generated `expo-env.d.ts` so post-build lint is
  repeatable.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this ExecPlan completely.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`,
   `git branch -vv`, `git remote -v`, and recent log; verify the expected SHA.
3. Inspect current OpenSpec changes, `.env.example`, `.mcp.json`, and active
   repository agent paths without printing secret values.
4. Reconcile this checkpoint with Git; update it before continuing if they
   disagree.
5. Resume from `Exact next action`, recording every meaningful validation,
   failure, blocker, and decision here.

## Outcomes & Retrospective

- Status: Complete after final local and remote verification.
- Summary: Web and autonomous Codex development are fully verified. Android
  development is partially ready: the JDK/SDK/adb/emulator executables and
  environment variables are configured, but no AVD/device or Maestro is ready.
  iOS native execution is cloud-only from Windows. The repository-only
  bootstrap commit is present on `origin/main`.
- Follow-up: Install the official Maestro CLI, download an API-34-or-supported
  Android system image/create an AVD, boot it, obtain/install the credential-free
  `e2e-test` APK, and rerun `npm run qa:native:android` before claiming native
  readiness. Use `.eas/workflows/native-e2e.yml` or macOS for iOS.
