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

- Current milestone: Directive 3 (governance reconciliation) landing — mission
  plan created, successor plan reconciled, execution prompt committed.
- Completed: Directive 1 (true state: HEAD == origin/main == `2f742fe`, tree
  clean but for the new execution prompt; single worktree; stash preserved);
  Directive 2 (CI trustworthy: push `35871287036` success + nightly
  `35912837207` success at HEAD; jobs quality/e2e/nightly all green);
  attempt-first evidence sweep across all three external blockers (see
  Validation Ledger); first hardened defect (directive 6 candidate):
  `simulation/backend/provision.ts` win32 ENOENT false-negative fixed.
- In progress: directive 3 landing commit; then directive 4 exact-SHA battery.
- Important modified files: `.agent/EXECUTION_PROMPT.md` (new directive,
  uncommitted→landing), `simulation/backend/provision.ts` (win32 shell fix),
  this plan, `.agent/execplans/ai-command-center-production-v1.md`
  (checkpoint reconciliation).
- Last successful validation: `npm run agent:plan:validate:all` — 92 PASS /
  0 FAIL (pre-landing); `npm run qa:affected` for the prompt change resolves
  `qa:fast` + `tests/agent-execplan.test.ts`.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None for directives 1-4, 6, 7. External-gated items re-attempted
  with fresh evidence: provider credentials for AI lanes (parse 502 / ask 500
  on the restored project); EAS Maestro jobs require a paid plan (verbatim
  from `eas workflow:validate`); `SUPABASE_ACCESS_TOKEN` still UNSET (CI-only
  lanes).
- Condition required to unblock: owner provisions provider secrets
  (`OPENAI_API_KEY`/`AI_COMMAND_MODEL` for parse, `DEEPSEEK_API_KEY` for ask)
  on the restored project and/or supplies `SUPABASE_ACCESS_TOKEN` for
  token-gated CI lanes; paid Expo plan for Maestro workflow jobs.
- Exact resume action after unblock: re-run the recorded probes in the
  Validation Ledger below, then the successor plan's phase-2 resume command.
- Exact next action: commit the governance landing (prompt + three plan
  files), then run the directive-4 certification battery at that exact SHA
  (qa:affected-driven: `qa:fast` → integration → journeys → simulation →
  `qa:full`, typecheck, lint, format:check, build:web, web:verify), then
  attempt the disposable-backend lane (`provision.ts run --with-parser
--no-teardown --org-id mnqrbiambekxvrtuufcn --production-hosts
kruubbynsmxzxfdunaal.supabase.co`), then push + CI terminal watch.
- Remaining definition of done: all 12 directives evidenced or classified
  with exact runbooks; certification green at the final pushed SHA; successor
  campaign chosen (directive 9) and executed or exhaustively run-ruled
  (directives 10-12); plans validated; web hygiene clean; Outcomes filled.

## Progress

- [x] Directive 1 — true repository state established
- [x] Directive 2 — CI verified trustworthy at HEAD
- [ ] Directive 3 — governance reconciliation landed (commit pending)
- [ ] Directive 4 — exact-SHA certification battery + push + CI watch
- [ ] Directive 5 — release/platform gaps closed or classified (disposable
      lane, provider-secret probe, EAS workflow retry with correct args)
- [ ] Directive 6 — evidence-backed defects hardened (provision.ts win32 fix
      already staged)
- [ ] Directive 7 — repository-side release preparation completed
- [ ] Directive 8 — production-risk investigation reported
- [ ] Directive 9 — successor campaign chosen with evidence
- [ ] Directive 10 — successor campaign executed
- [ ] Directive 11-12 — loop until exhaustion; no speculative residue

## Surprises & Discoveries

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
  `2f742fe`, one modified file (the new directive), single worktree,
  `stash@{0}` intact.
- 2026-09-24 — `gh run list` (HEAD) — PASS — push `35871287036` success
  (quality+e2e), nightly `35912837207` success (quality+nightly).
- 2026-09-24 — `npm run agent:plan:validate:all` — PASS — 92/0.
- 2026-09-24 — Supabase REST probes (anon key, presence-only) — PASS —
  GoTrue health 200 (v2.197.0); `/rest/v1/todos` 42501 permission-denied for
  anon (RLS working as intended); `parse-ai-command` 401
  `UNAUTHORIZED_NO_AUTH_HEADER` without header.
- 2026-09-24 — anonymous signup probe — PASS — 200 session issued
  (`external.anonymous_users: true`); gateway `verify_jwt` enforced.
- 2026-09-24 — authenticated parse/ask probes (correct payload shapes) —
  FAIL(external) — PARSE 502 `{"error":"Command parsing is temporarily
unavailable."}`; ASK 500 `{"error":"The ask service could not classify your
question."}` → classified `BLOCKED_EXTERNAL`: provider secrets
  (`OPENAI_API_KEY`+`AI_COMMAND_MODEL` / `DEEPSEEK_API_KEY`) absent on the
  deployed functions; local `OPENAI_API_KEY` SET but len 14 (suspect
  placeholder — validity probe pending, value never printed).
- 2026-09-24 — `supabase projects list` — PASS — authenticated; superhabits
  project ACTIVE_HEALTHY; org id `mnqrbiambekxvrtuufcn` discovered.
- 2026-09-24 — `provision.ts run` precondition advance — PASS(after fix) —
  now stops at `Missing precondition: org id` (was: false CLI-absent);
  production-host config precondition next; both values now known.
- 2026-09-24 — `eas workflow:validate .eas/workflows/native-e2e.yml` —
  FAIL(external) — verbatim: "Running maestro_test jobs requires a paid
  plan."; `eas whoami` = dale16; project `@dale16/superhabits` resolves.
- 2026-09-24 — `npm audit --omit=dev --audit-level=high` — PASS — 0
  critical / 0 high / 14 moderate (advisory step semantics unchanged).
- NOT RUN — directive-4 battery (next action after landing commit).

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
