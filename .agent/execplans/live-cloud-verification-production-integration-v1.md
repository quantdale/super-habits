# ExecPlan: live-cloud-verification-production-integration-v1

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Execute the overnight directive in `.agent/EXECUTION_PROMPT.md` (received
2026-09-24): establish true repository state, keep CI trustworthy, reconcile
governance, certify the exact release-candidate SHA, close every safely
executable release/platform gap against the RESTORED Supabase project and EAS,
harden evidence-backed defects, complete repository-side release preparation,
investigate remaining production risks, then choose and execute the next
justified successor campaign — repeating until no material executable work
remains in this environment.

## Context

- Supersedes (does not restart) the completed 24-commit production-closure
  campaign `691d2a2..2f742fe` (`.agent/execplans/production-closure-exact-head-cert-v1.md`,
  COMPLETED). Foreign `stash@{0}` preserved; never touch.
- Successor plan `.agent/execplans/ai-command-center-production-v1.md` (ACTIVE):
  phase 1 corpus landed at `7bc8a64`; phases 2-6 were credential-gated — this
  campaign re-tests those gates against the restored project (attempt-first).
- Standing rules live in `.agent/EXECUTION_PROMPT.md`; six-value failure
  classification; never print secret values (presence/length only).
- PATH prefix for gates: `export PATH="$LOCALAPPDATA\tools\node-v22.23.2-win-x64;$PATH"`.

## Scope

Directives 1-12 of the overnight message, in order, looping 9→10 per
directive 11 until directive 12's exhaustion condition holds.

## Non-Goals

- No force-push, no `git reset --hard`, no test weakening, no touching
  `stash@{0}`, no killing foreign processes, no printing secret values.
- No store submission, no release tag, no billing/subscription change without
  explicit authorization.
- No production Supabase data mutation outside sanctioned verification reads
  and the guarded disposable-backend lane; no speculative feature work.

## Current Checkpoint

- Current milestone: **J8 wave landed, pushed, CI-GREEN; Campaign 4 Android
  COMPLETE** — commits `8d9db26` (fix) + `8f8c79e` (docs); CI `35987777309`
  quality+e2e SUCCESS at certified SHA `8f8c79e` (weeks-long gap-15 straddle
  closed on ubuntu too); Android exact-build cert at `8f8c79e`: **19/19
  flows** (smoke 2/2, persistence 11/11, lifecycle 6/6), APK
  `A95C9BC81B537BEAFDB73C5F21EE27146444089681FA98AE47F1B3D67262FB93`,
  provenance `simulation-output/native/native-android-build.json`, owned
  emulators stopped each lane.
- Completed: Directives 1-3 (true state; CI trustworthy; governance landed
  `3858cb9`); Directive 4 = certified at `8f8c79e` (full local ladder incl.
  qa:full exit 0 + CI green at that SHA) — final doc-wave SHA still needs its
  own CI per DoD; Directive 6 waves 1+2 (`3858cb9`, `ea2e36d`, `8d9db26`);
  Campaign 4 (above); gap-15/W8-1 root-caused + resolved without threshold
  changes; hermetic `build:e2e` (leak guard verified 0 hosts); 6-scout
  swarm integrated; ladder evidence at `ea2e36d`/`8f8c79e`: qa:fast 1,897 |
  integration 373 | journeys @p0 25 | qa:full exit 0 (incl. e2e:full +
  deterministic 23/23) | plans 93/0 | themes 140 | openspec 59 | timezones
  5/5 | web:verify+hygiene PASS | audit 0C/0H/14M | expo-doctor 20/20 |
  e2e:sync 40/6.
- Completed: Directives 1-3 (true state; CI trustworthy at `2f742fe`;
  governance landed `3858cb9`); Directive 6 wave 1 (`3858cb9` + `ea2e36d`,
  pushed); battery at `ea2e36d` under engines Node 22.23.2 (PATH must be
  `/c/Users/palac/AppData/Local/tools/node-v22.23.2-win-x64` — backslash form
  silently falls to node24): typecheck/lint PASS 0/0, themes 140, openspec
  59, plans 93, impact 13 rules, qa:fast 1,897, npm test 2,270 (227 files),
  timezones 5/5 (94), integration 373 (node24 run), journeys @p0 25,
  simulation deterministic 23 + sim:validate 23, build:web, build:sync,
  e2e:sync 40/6 skip exit 0, web:verify PASS, web:hygiene PASS,
  audit 0C/0H/14M, expo-doctor 20/20, e2e:full 259 pass/1 fail (J8)/13 skip
  registered; 6-scout swarm integrated; `nul` removed; stash preserved.
- In progress: **documentation-reconciliation wave** — store-readiness
  recert block refresh (guard counts + candidate/HEAD cites), ci.yml advisory
  snapshot refresh + Campaign-8 override-rejection rationale, then commit →
  push → CI watch at the new SHA; then §32 adversarial final review →
  Directive-9 successor selection (leading executable candidate:
  ai-command-center phase-5 privacy delta — credential-free guard/docs work;
  candidates A/B otherwise externally gated or spec-only per §25).
- Important modified files: (landed) `.agent/EXECUTION_PROMPT.md`, mission
  plan, `ai-command-center-production-v1.md` (`3858cb9`);
  `simulation/backend/provision.ts` + `tests/simulation.provisionHosts.test.ts`
  (`ea2e36d`, pushed). (staged, this wave) `e2e/journeys/three-months-in.spec.ts`
  (settle + label), `scripts/build-dist-e2e.mjs` (new hermetic export + leak
  guard), `package.json` (`build:e2e` + 2 rewires), `ci.yml` (2 E2E build
  steps), `scripts/{qa-simulation,web-verify,qa-repeat,web-lifecycle,serve-e2e}`,
  `e2e/{README.md,helpers/dbHarness.ts,infrastructure.spec.ts,journeys/bad-backend.spec.ts}`,
  `AGENTS.md`, `docs/testing/known-gaps.md` (gap-15 root-cause entry), this plan.
- Last successful validation: full battery rows above at `ea2e36d` /
  Node 22.23.2, 2026-09-24.
- Current failures: **None open.** (1) J8 step3 floor — RESOLVED: in-test
  per-switch `[761,403,635,481,657,425]`ms isolated switch1 as the
  warm-up-animation backlog (standalone settled 223-348 vs no-settle
  704-917, ≥3× both directions, idle host; CDP: no app hotspot —
  corroborates prior harness31/browser53/app16 attribution); fixed with
  `waitForSectionTransitionsSettled` (ceiling/floor/guard UNCHANGED), label
  corrected `overview→todos`→`calories→todos`; post-fix 7/7 with
  `calories→todos=619 … max 622`. Isolated single-step reruns were an
  INVALID METHOD (steps1/2 own the navigation) — recorded, not product.
  (2) J8 step7 oracle `0≠24` — RESOLVED: local `build:web` inlined real
  `.env` Supabase creds; restored project let the app drain `sync_outbox`
  mid-journey (CI hermetic only by accident of no `.env`); fixed by hermetic
  `build:e2e` (EXPO_NO_DOTENV + ambient strip + `supabase.co` leak guard,
  0 hosts verified in dist/). (3) step6 `diarySearch=533ms` single blip,
  green next two runs (396 final) — host variance recorded, ceiling kept.
  (4) CI e2e failure — root-caused as (1) on ubuntu (725/745) + registered
  fixme skips + workout:297 flaky-but-passed (green locally); fixed by this
  wave pending CI rerun.
- Relevant quarantines: None added; 13 registered gate files unchanged
  (parity guard green).
- Blockers: (b) disposable-lane schema —
  BLOCKED_EXTERNAL: `db.<ref>` IPv6-only (DoH AAAA yes/A no), no IPv6 route
  (ENETUNREACH), `*.pooler.supabase.co` NXDOMAIN all refs, no
  `SUPABASE_ACCESS_TOKEN`; resume: token → managementApi path (code-ready);
  (b2) E2E-drain residue cleanup — BLOCKED_EXTERNAL: local runs between
  restoration and the hermetic fix pushed UI-created test rows + synthetic
  settings/manifest under throwaway anonymous users on the LIVE project;
  owner must run SQL/Management-console cleanup (identify `auth.users`
  created 2026-09-24 by test sessions + their owned rows); (c) EAS Maestro
  jobs — paid plan (verbatim); (d) AI provider secrets — parse 502 / ask 500
  live probes. (J8 floor blocker RESOLVED this wave.)
- Condition required to unblock: (b) owner exports `SUPABASE_ACCESS_TOKEN`
  or IPv6-capable network; (b2) owner SQL/Management access; (c) paid Expo
  plan; (d) owner sets `OPENAI_API_KEY`+`AI_COMMAND_MODEL` /
  `DEEPSEEK_API_KEY`.
- Exact resume action after unblock: (b) `npx tsx simulation/backend/
provision.ts run --with-parser --no-teardown --reuse=slvctfwphtpeymzghyoc
--org-id mnqrbiambekxvrtuufcn --production-hosts
kruubbynsmxzxfdunaal.supabase.co`; (d) re-probe parse/ask → successor
  phase 2.
- Exact next action: land the doc-reconciliation edits (store recert block,
  ci.yml snapshot + override rationale), prettier+plans-validate, commit,
  push, CI watch to terminal; then §32 adversarial review (delegate
  read-only reviewers on the final tree); then Directive 9 → 10 (execute the
  chosen successor or record exhaustion), §33 final matrix at the final SHA,
  §35 hygiene, §36 report, Outcomes.
- Remaining definition of done: 12 directives evidenced; J8 classified/
  resolved without threshold changes; CI green at final SHA; Campaigns
  4-10 executed or runbook-classified; doc reconciliations (KB:1010,
  AGENTS `user-ai-ask`, "anonymous only", store SHA cites) landed;
  successor chosen + executed; final matrix + adversarial review + report;
  Outcomes filled.

## Progress

- [x] Directive 1 — true repository state established
- [x] Directive 2 — CI verified trustworthy at HEAD
- [x] Directive 3 — governance reconciliation landed (`3858cb9`)
- [~] Directive 4 — exact-SHA battery at `ea2e36d` green except J8; pushed;
  CI `35969211668` watch open
- [~] Directive 5 — platform gaps: disposable lane progressed to schema
  (blocked: IPv6-only db host / no token — runbook recorded); AI parse/ask
  live-probed (provider-secret external); EAS paid-plan external
- [x] Directive 6 — first defect wave landed (`3858cb9` + `ea2e36d`)
- [~] Directive 7 — store artifacts classified (scout): doc SHA-refresh +
  guard-count line pending
- [~] Directive 8 — risks probed: 2 leaf advisories identified
  (decode-uri-component override candidate; uuid FRAMEWORK_OWNED)
- [ ] Directive 9 — successor campaign chosen with evidence
- [ ] Directive 10 — successor campaign executed
- [ ] Directive 11-12 — loop until exhaustion; no speculative residue

## Surprises & Discoveries

- 2026-09-24 — `npx expo export` inlines whatever `.env*` exists locally;
  the repo's own `bad-backend.spec.ts` comment asserted the opposite (true
  only in CI). With the project RESTORED, local test exports became live
  clients: anon bootstrap → outbox drain → J8 oracle `0≠24` AND test-row
  pollution of production under throwaway anonymous users. `build:sync`'s
  EXPO_NO_DOTENV precedent was the template for `build:e2e`.
- 2026-09-24 — the J8 floor straddle (documented across Windows + CI
  runners for weeks) reduced to ONE switch: measured round start inherits
  the warm-up's RN-Web animation backlog; settled product cost is
  223-348ms standalone. Measurement-start correction resolved it with all
  thresholds intact.

- 2026-09-24 — Supabase CLI is installed (2.111.0) AND authenticated
  (`supabase projects list` exit 0) despite `SUPABASE_ACCESS_TOKEN` being
  UNSET and `~/.supabase/config.json` absent in the git-bash `$HOME` —
  credential resolves by some other mechanism (likely Windows-native
  location); this unblocks Management-API-adjacent CLI work locally even
  though CI lanes remain token-gated.
- 2026-09-24 — restored project confirmed: ref `kruubbynsmxzxfdunaal`
  ("superhabits") `status: ACTIVE_HEALTHY`, `linked: true`; a second project
  in the org (`nsrfmpbvnjxywcizfyww`) is INACTIVE (left untouched).
- 2026-09-24 — both `.env` and `.env.local` carry the SAME anon key and URL
  after quote-stripping (earlier "stale key" reading was a quote-parsing
  artifact, not drift).
- 2026-09-24 — `provision.ts` precondition 1 (CLI present) false-negatived on
  win32: `execFile('supabase')` cannot spawn npm `.cmd` shims without a
  shell (ENOENT); fixed with `shell: process.platform === 'win32'`.
- 2026-09-24 — edge functions on the restored project enforce
  auth-before-parse (401 without header; 401 on anon-bearer at the function
  layer per `verify_jwt`; authenticated anon session passes gateway), and the
  real blocker behind parse/ask is the ABSENT PROVIDER SECRET (parse 502
  "temporarily unavailable", ask 500 "could not classify") — not project
  inactivity.

## Decision Log

- 2026-09-24 — Attempt-first over inherited BLOCKED labels: every externally
  blocked item from the predecessor got a fresh probe before classification;
  three of four gates moved (project alive, CLI authed, functions reachable).
- 2026-09-24 — Disposable lane authorized as sanctioned execution: the
  recorded resume command in the successor plan IS the attempt; the guard
  (production-host refusal, disposable marker) is the safety boundary.
- 2026-09-24 — Governance landing commits before certification so directive 4
  certifies one stable SHA; cloud lanes run before the long battery to avoid
  CPU-contention flakiness (prior campaign recorded CPU-saturation artifacts).

## Validation Ledger

- 2026-09-24 — `git status/fetch/rev-parse` — PASS — HEAD == origin/main ==
  `2f742fe` at start; single worktree; `stash@{0}` intact throughout.
- 2026-09-24 — governance landing commit `3858cb9` — PASS — prompt + 2 plans +
  win32 provision fix; lint-staged green.

- 2026-09-24 — five-defect lane fix commit `ea2e36d` — PASS — provisionHosts
  test 4/4, eslint 0, tsc 0; pushed → CI `35969211668` in_progress.
- 2026-09-24 — Supabase live probes — PASS(gateway)/FAIL(external) — GoTrue
  200 v2.197.0; anon signup 200; RLS anon-denied 42501; function auth order
  verified (401 no-header → 401 anon-bearer → 400 normalize → 502/500 =
  missing provider secret); project `kruubbynsmxzxfdunaal` ACTIVE_HEALTHY.
- 2026-09-24 — `supabase projects list` — PASS — CLI authenticated without
  `SUPABASE_ACCESS_TOKEN`; org `mnqrbiambekxvrtuufcn` discovered.
- 2026-09-24 — disposable-lane run series — PARTIAL — create/lookup/waitReady/
  guard green after 5 fixes; schema step BLOCKED (AAAA-only db host + no IPv6
  route + pooler NXDOMAIN + no token); project `slvctfwphtpeymzghyoc` left
  marker-named with password persisted in gitignored `state/`.
- 2026-09-24 — `eas workflow:validate .eas/workflows/native-e2e.yml` —
  FAIL(external) — "Running maestro_test jobs requires a paid plan";
  `eas whoami` dale16; project `@dale16/superhabits` resolves; `workflow:run
--ref main` → "No repository found for appId 2cfd0e33…".
- 2026-09-24 — certification battery at `ea2e36d` (Node 22.23.2) — PASS
  except J8 — see Current failures for the single red; every other row green
  (counts recorded in Current milestone).
- 2026-09-24 — J8 isolated reruns ×3 (plus 1 inside qa:full) — FAIL —
  deterministic 120s timeout; classification pending trace evidence.
- 2026-09-24 — `npm audit --omit=dev` / full — PASS — 0 critical / 0 high /
  14 moderate prod (2 leaf: decode-uri-component override candidate,
  uuid FRAMEWORK_OWNED); expo-doctor 20/20.
- 2026-09-24 — scout swarm (6 read-only) — PASS — integrated findings:
  workout-history plan verified consistent (lead disproven); store docs
  consistent (SHA-citation staleness only); cloud claims supported except
  KB:1010 adapter-throw + AGENTS supabase-dir + "anonymous only" wording;
  patches 8/8 applied; cert matrix enumerated.

## Changed Files / Areas

- `.agent/EXECUTION_PROMPT.md` — the new campaign directive (landing).
- `.agent/execplans/live-cloud-verification-production-integration-v1.md` —
  this mission plan (new).
- `.agent/execplans/ai-command-center-production-v1.md` — stale checkpoint
  claims reconciled (project state, CLI state, live-probe results).
- `simulation/backend/provision.ts` — win32 `execFile` shell fix so the
  CLI-present precondition stops false-negativing.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan, and
   `.agent/EXECUTION_PROMPT.md`.
2. `git status --short`, `git stash list` (foreign stash — preserve),
   `git fetch`.
3. Prefix PATH: `export PATH="$LOCALAPPDATA\tools\node-v22.23.2-win-x64;$PATH"`.
4. Run `npm run agent:resume -- --plan .agent/execplans/live-cloud-verification-production-integration-v1.md`.
5. Continue only from `Exact next action`; update the checkpoint first if
   Git disagrees.

## Outcomes & Retrospective

- Status: Active.
- Summary: Pending.
- Follow-up: Pending.
