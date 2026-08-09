# ExecPlan: Migrate Predator to Nitro

## Purpose / User Outcome

Prepare the SuperHabits repository and Git state so a new Nitro workstation can
clone or fast-forward the repository, reconstruct the development toolchain,
use repository-native Codex/agent instructions, and verify the app without the
old Predator conversation. Preserve meaningful existing work and local-only
Git history while excluding secrets, caches, and machine-specific state.

## Context

- Repository: `D:\Documents\tryPython\superhabits`.
- Active branch at task start: `main`, at `ee2af96`, tracking `origin/main`.
- Remote: `origin` → `https://github.com/quantdale/super-habits.git`.
- The working tree contains a substantial uncommitted autonomous-QA/native-E2E
  and agent-enablement batch; it must be audited file by file before staging.
- Repository protocol is defined by `AGENTS.md`, `.agent/PLANS.md`,
  `docs/codex-workflow.md`, and the project structure/rules documents.
- OpenSpec has active, unarchived changes for durable ExecPlans, native real
  user E2E, user simulation, and several product fixes; migration work is not
  an OpenSpec change.

## Scope

- Audit and classify all current tracked modifications and untracked files.
- Audit secret exposure and ignore rules before staging.
- Add/update generic workstation bootstrap/doctor documentation as justified.
- Preserve meaningful local-only branches, stashes, and worktree commits on
  remote backup refs without merging stale work into `main`.
- Validate, commit task-owned legitimate changes, push, and verify remote state.
- Produce an exact Nitro clone/pull/bootstrap handoff.

## Non-Goals

- No unrelated product development or feature behavior changes.
- No deletion, reset, clean, force-push, history rewrite, or overwrite of user
  work.
- No transfer of `node_modules`, caches, build output, emulator images,
  credentials, Codex conversation state, or home-directory auth caches.
- No copying of Predator's user-level Codex home configuration wholesale.

## Current Checkpoint

- Milestone: Recovery, classification, reproducible setup, validation, and
  remote preservation complete.
- Completed: Read `AGENTS.md`, `.agent/PLANS.md`, `docs/codex-workflow.md`,
  `docs/PROJECT_STRUCTURE_MAP.md`, `.cursorrules`, and
  `.cursor/rules/superhabits-rules.mdc`; inspected active OpenSpec directories;
  recorded initial Git status, branches, remote, log, stash, tags, and worktrees.
- Completed: Added `docs/development/workstation-bootstrap.md` and the
  read-only `npm run dev:doctor`; made standard web/sync builds clear Metro
  state and documented the safe no-dotenv export path.
- Completed: Committed the reviewed batch as `dfed4cf` and pushed it to
  `origin/main`; preserved all reviewed local branches, stash work, meaningful
  unreachable worktree/WIP heads, and local tags on remote backup refs/tags.
- Important modified areas: `.github`, `.mcp.json`, `AGENTS.md`, `app.json`,
  QA/native E2E docs and scripts, E2E helpers/specs, Expo/EAS config,
  `package.json`, Playwright/simulation tooling, and selected feature files.
- Last successful validation: `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run qa:impact:validate`, `npm run openspec:validate`,
  `npm run qa:affected`, `npm run sim:validate`, `npx playwright test --list`,
  `npm run dev:doctor`, the safe web build, and `git diff --check` passed.
  The doctor reports all web/repository prerequisites present and native
  Android/Maestro as optional environment gaps on Predator.
- Current classified limitations: full Playwright execution timed out during
  runner/browser startup despite the static server returning HTTP 200;
  native Android/iOS lanes are `ENVIRONMENT`-blocked because Maestro, Java,
  and Android tooling are not installed on Predator. These are recorded as
  environment evidence, not product passes or failures.
- Relevant quarantines: None identified yet.
- Blockers: None yet.
- Exact next action: Commit this completed-plan state, push it fast-forward to
  `origin/main`, then verify the final HEAD and remote backup/tag counts.
- Remaining definition of done: Safe workstation bootstrap documentation,
  required agent configuration preserved, no secrets staged, meaningful local
  Git state preserved remotely, validation passed or explicitly classified,
  active and backup refs pushed, and final remote HEAD verified.

## Progress

- [x] Read repository-native startup, planning, workflow, and architecture rules.
- [x] Inspect current OpenSpec state and initial Git/worktree state.
- [x] Create file-by-file classification of tracked and untracked changes.
- [x] Audit secrets and `.gitignore` coverage.
- [x] Inventory Predator/Nitro toolchain requirements and actual Predator versions.
- [x] Add generic workstation bootstrap guidance and a read-only doctor.
- [x] Preserve meaningful local-only branches, stash contents, and worktree commits.
- [x] Run required validation and inspect failures/artifacts.
- [x] Commit logical task-owned changes without unrelated user work.
- [x] Push active branch and backup refs; verify remote visibility.
- [x] Complete this plan with outcomes and exact Nitro handoff.

## Surprises & Discoveries

- Initial repository state is not clean: the task-owned-looking QA/native-E2E
  batch is uncommitted on `main` even though `HEAD` matches `origin/main`.
- One stash exists (`pre-recovery-local-changes`) and several local branches
  track deleted remote refs; their content must be inspected before deciding
  which backup refs are warranted.
- The candidate changes are internally coherent with the completed OpenSpec
  changes `add-durable-agent-execplans`, `strengthen-autonomous-qa-loop`, and
  `add-native-real-user-e2e`; no unrelated product change was found in the
  working tree.
- `.env` and `.env.local` are ignored. Predator's `.env.local` contains the
  names `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and
  `VERCEL_OIDC_TOKEN`; values were not printed or staged. `.env.example` is a
  safe placeholder template.
- Predator has no Java, Android SDK/adb/emulator, or Maestro on PATH. These
  remain explicit native environment prerequisites for Nitro, while web QA is
  healthy. EAS CLI `18.5.0` and Supabase CLI `2.111.0` are installed locally.
- A fresh-session bootstrap doc did not exist. `docs/development/workstation-bootstrap.md`
  and `scripts/dev-doctor.mjs` now provide the missing generic
  reconstruction/diagnostic path.

### Audit classification

- **PROJECT SOURCE:** modified E2E specs/helpers, new `e2e/fixtures.ts`, new
  failure-triage test/module, and the small accessibility labels required by
  native Maestro flows.
- **PROJECT CONFIG:** package QA scripts, `playwright.config.ts`, `app.json`,
  `eas.json`, `scripts/build-dist-sync.mjs`, `qa/impact-map.json`, native EAS
  workflow, Maestro flows/config, and the CI comment/config changes.
- **PROJECT DOCUMENTATION:** `AGENTS.md`, testing/autonomous-QA/native-E2E/
  known-gap docs, simulation guidance, OpenSpec artifacts, and the workstation
  bootstrap guide.
- **AGENT CONFIG:** `.agent/PLANS.md`, this plan, `.agents/` routing/skills,
  tracked `.codex/`/`.cursor/` repository configuration, and safe `.mcp.json`.
- **MACHINE-SPECIFIC / GENERATED / CACHE / DEPENDENCY:** `.env*`, `.expo/`,
  `android/`, `dist/`, `dist-sync/`, `node_modules/`, Playwright reports,
  `simulation-output/`, `test-results/`, `.vercel/`, and `.playwright-mcp/`;
  all are ignored or otherwise excluded and will not be staged.
- **SECRET / CREDENTIAL:** no candidate file contains a real credential after
  the scan; secret names and manual-transfer guidance are documented without
  values.
- **UNRELATED USER WORK:** none identified in the current worktree; the older
  stash and local-only branches are preserved separately as historical work,
  not mixed into the active branch.

## Decision Log

- 2026-08-09 — Treat migration as non-OpenSpec operational work — The request
  explicitly requires a non-OpenSpec `.agent/execplans/` plan.
- 2026-08-09 — Do not merge local-only branches into `main` — Preserve useful
  commits under explicit backup refs after inspection, keeping historical work
  recoverable without changing active product history.
- 2026-08-09 — Add a minimal read-only `dev:doctor` — The existing
  `expo-doctor` command does not report Git/dependency/browser/native/port/env
  readiness together; the new script diagnoses setup without installing,
  deleting, or mutating machine state.

## Validation Ledger

- 2026-08-09 — Repository instruction/Git recovery audit — PASS — Read-only
  startup documents and initial state commands completed.
- 2026-08-09 — Required QA/toolchain validation — NOT RUN — Pending audit and
  setup-document changes.
- 2026-08-09 — `node --check scripts/dev-doctor.mjs` — PASS.
- 2026-08-09 — `npm run dev:doctor` — PASS — Web/repository checks pass; JDK,
  Android SDK/adb/emulator, and Maestro are reported as optional missing
  native capabilities; ports 8081/8082 are available.
- 2026-08-09 — `git diff --check` — PASS — No whitespace errors in tracked
  modifications.
- 2026-08-09 — `npm run qa:impact:validate` — PASS — 11 impact rules.
- 2026-08-09 — `npm run openspec:validate` — PASS — 14/14 items.
- 2026-08-09 — `npm run qa:affected` — PASS — Resolver selected the required
  web, simulation, and native impact gates.
- 2026-08-09 — `npm run typecheck` — PASS — 0 errors.
- 2026-08-09 — `npm run lint` — PASS — 0 errors, 18 warnings, within the
  configured warning budget.
- 2026-08-09 — `npm test` — PASS — 57 files, 633 tests.
- 2026-08-09 — `npm run sim:validate` — PASS — 7 personas, 7 workflows, and
  16 scenarios.
- 2026-08-09 — `npx playwright test --list` — PASS — 181 tests across 19
  spec files; execution itself was environment-timeout blocked during startup.
- 2026-08-09 — `npm run qa:native:android` / `npm run qa:native:ios` —
  `ENVIRONMENT` — Maestro and native toolchains are absent on Predator.
- 2026-08-09 — safe `npm run build:web` — PASS — Built with dotenv loading
  disabled; direct output scan found no local env values.
- 2026-08-09 — `npm run format:check` — EXISTING BASELINE GAP — 95 existing
  files, chiefly agent/OpenSpec/docs artifacts, are not Prettier-formatted;
  focused formatting checks for migration files pass.
- 2026-08-09 — staged-file secret scan — PASS — No high-risk credential
  literals; no `.env` or `.env.local` tracked/staged.
- 2026-08-09 — `git commit` — PASS — `dfed4cf` contains 94 intended files;
  commit hooks completed successfully.
- 2026-08-09 — remote preservation — PASS — `origin/main` at `dfed4cf`, 31
  `backup/predator/*` heads, and 11 tags visible via `git ls-remote`.

## Changed Files / Areas

- `.agent/execplans/migrate-predator-to-nitro.md` — Durable migration state,
  decisions, evidence, and recovery instructions.
- `docs/development/workstation-bootstrap.md` — Planned generic workstation
  reconstruction guide, including secure transfer and native prerequisites.
- `scripts/dev-doctor.mjs` and `package.json` — Read-only cross-platform setup
  diagnostic exposed as `npm run dev:doctor`.
- Existing uncommitted QA/native/agent files — To be staged only after file-level
  inspection confirms they are legitimate SuperHabits work.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this ExecPlan.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`,
   `git branch -vv`, `git stash list`, and `git worktree list`.
3. Reconcile this checkpoint with Git; Git state wins over stale narrative.
4. Resume from `Exact next action`, updating this plan before continuing.
5. Before finishing, verify the pushed branch/commit with `git ls-remote` and
   record the exact Nitro bootstrap commands in the final report.

## Outcomes & Retrospective

- Status: Complete.
- Summary: Predator's legitimate SuperHabits QA/native/agent configuration and
  migration handoff are committed in `dfed4cf` and pushed to `origin/main`.
  Repository bootstrap instructions and `npm run dev:doctor` let Nitro
  reconstruct and verify the web toolchain; native prerequisites and secret
  transfer names are documented without copying machine state or credentials.
  Local-only branches, stash work, meaningful unreachable WIP/worktree heads,
  and tags are preserved remotely under explicit backup refs.
- Follow-up: Nitro must manually install native tooling if native E2E is needed
  and transfer only the documented secret values through a secure channel.
