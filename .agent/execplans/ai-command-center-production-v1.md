# ExecPlan: ai-command-center-production-v1

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Ship the production AI Command Center: remote `parse-ai-command` and `user-ai-ask`
live behind measured quality, latency, and cost gates; default-on only by owner
authorization; local token-parser fallback and confirm-before-write boundaries
intact; privacy disclosure updated truthfully before default-on.

## Context

- Inherited from `.agent/execplans/production-closure-exact-head-cert-v1.md`
  (§32 adversarial review + Phase 11 v2 direction audit): Candidate B ranked
  first on user value × leverage × fit × evidence × testability ÷ risk.
- Existing assets (all audited green, zero changes needed): Edge Functions
  (`parse-ai-command`, `user-ai-ask`, `_shared/aiSecurity.js` — auth-before-parse,
  32KB/280/20-turn/24KB bounds, quota pre-consume, allowlist, no-PII logging,
  CI `deno check` green); dual-mode client with `remote_with_fallback`; confirm
  boundary; env-gated eval (2 tests) / observation (4 tests) / rollout describes;
  mock-parser twins green in standard lanes; specs `command-center-v2` + `ai-ask`.
- External prerequisites at handoff: provider model credential (Functions
  secret) — STILL ABSENT after restoration (live probes 2026-09-24: parse
  502 / ask 500 on the restored project; local `OPENAI_API_KEY` answers 401
  `Incorrect API key provided` — placeholder/revoked, never printed),
  `SUPABASE_ACCESS_TOKEN` for token-gated CI lanes (UNSET; local CLI is
  authenticated by another mechanism), owner default-on authorization.
  Supabase project itself is NO LONGER a prerequisite: ref
  `kruubbynsmxzxfdunaal` is `ACTIVE_HEALTHY`, `linked: true`.

## Scope

1. **Eval corpus (executable without credentials):** labeled command ground truth
   — intents × phrasings × adversarial rows (prompt-injection text, ambiguity →
   `needs_input`, paused/archived habit → review guard, malformed/future dates →
   reject, unsupported/destructive → no-write); Ask set with safety negatives
   (no medical advice beyond self-tracking, no PII echo, no write claims);
   fallback-expectation rows; English-only boundary stated. Synthetic personas
   only; existing fixture patterns; lives beside current command fixtures.
2. **Authenticated lanes:** run the existing eval/observation describes against a
   real provider behind the disposable-lane guard pattern (`if: token`), nightly /
   manual dispatch; never in credential-free PR lanes.
3. **Measured gates:** parse accuracy, Ask answer-safety rubric pass rate, p95
   latency vs local-fallback threshold, fallback rate, quota math vs provider
   pricing → config tuning (allowlist/quota/bounds) with test evidence only.
4. **Red-team gate:** prompt-injection + output-polyglot classes executed through
   the five validation layers (Edge grammar → client re-validate → data-layer →
   SQLite → backup validators).
5. **Privacy delta:** user-text → provider disclosure into `privacy-policy.md` /
   `store-data-declarations.md` through the existing guard tests, filed before
   default-on.
6. **Owner gates:** provider credential provision, default-on flag authorization,
   post-flip monitoring window (fallback/latency/quota counters), flag-off
   rollback test.

## Non-Goals

- No two-way sync work (Candidate A = spec-only package, filed separately).
- No schema/migration, no boundary/invariant changes, no local-parser removal,
  no telemetry/PII logging, no tag, no store submission.
- No speculative architecture beyond the phased scope above.

## Current Checkpoint

- Current milestone: Phase 1 (eval corpus) COMPLETE — corpus landed, wired, and
  battery-green; phases 2-6 external-gated on credentials.
- Current checkpoint: 2026-09-23 — phase 1 executed and validated inside the
  parent production-closure campaign (single-campaign rule): corpus module
  `e2e/helpers/commandEvalCorpus.ts` (10 command ground-truth rows: ready ×
  needs_input × unsupported × unavailable incl. forced-failure, + 4 Ask safety
  negatives), wired into `e2e/command.eval.internal.spec.ts` via
  `[...INTERNAL_EVAL_CASES, ...COMMAND_EVAL_CORPUS]` (gate semantics unchanged),
  shape/contract tests `tests/commandEvalCorpus.test.ts` 5/5.
- Completed: **Eval corpus (phase 1 scope item 1)** — affected battery all green:
  qa:fast 1,893/1,893 + parity, full `npm test` 2,266/2,266, journeys @p0 25/25,
  recurring/linked 6/6, deterministic simulation aggregate **23/23** (22+1
  slices after a sanctioned `switchSection` 5s→30s identity-wait fix with
  sample-trace evidence — CPU-saturated host refresh-storm delay, semantics
  unchanged).
- In progress: nothing credential-free — remaining phases gated as below.
- Important modified files: (phase 1, landed) `e2e/helpers/commandEvalCorpus.ts` (corpus), `e2e/command.eval.internal.spec.ts` (loader wiring), `tests/commandEvalCorpus.test.ts` (shape/contract).
- Last successful validation: n/a.
- Current failures: None (repo-side). Live-lane probes failing externally:
  PARSE 502 `Command parsing is temporarily unavailable.`; ASK 500
  `The ask service could not classify your question.` — both traced to the
  absent provider secret, not project state.
- Relevant quarantines: None.
- Blockers: Phases 2-6 blocked ONLY on the provider secret (Edge Functions:
  `OPENAI_API_KEY` + `AI_COMMAND_MODEL` for parse, `DEEPSEEK_API_KEY` for
  ask) + `SUPABASE_ACCESS_TOKEN` for token-gated CI lanes + owner default-on
  authorization. Project/CLI/function-reachability blockers from the prior
  campaign are RESOLVED (evidence in Validation Ledger).
- External conditions gating phases 2-6: provider model credential; restored
  Supabase project + `SUPABASE_ACCESS_TOKEN`; owner default-on authorization.
- Condition required to unblock phases 2-6: Owner provisions the provider secret
  in Edge Functions, restores the project and supplies the Management API token
  (repo secret + `SIMULATION_PRODUCTION_SUPABASE_HOSTS`), and states default-on
  intent after gates are green.
- Exact resume action for phases 2-6: `npx tsx simulation/backend/provision.ts
run --with-parser --no-teardown` (or the nightly lane once the token exists),
  then run the eval/observation describes against the real provider and record
  the measured gates in this plan's Validation Ledger.
- Exact next action: (parent-campaign items above all COMPLETED at
  `7bc8a64`/`2f742fe` — corpus committed, Android certified, CI green.) Live
  campaign `.agent/execplans/live-cloud-verification-production-integration-v1.md`
  owns current execution; this plan resumes phase 2 the moment the owner
  sets the provider secrets: re-probe parse/ask (probes recorded in the
  mission plan's Ledger), then `npx tsx simulation/backend/provision.ts run
--with-parser --no-teardown --org-id <org> --production-hosts
<prod-host>` or the nightly lane once `SUPABASE_ACCESS_TOKEN` exists.
- Remaining definition of done: (phases 2-6, external-gated) authenticated lanes green on
  nightly; measured gates documented with numbers; red-team items passed;
  privacy delta shipped through guards; owner default-on executed with monitoring
  evidence; every certification lane green at the resulting SHAs.

## Progress

- [x] Eval corpus fixtures + loader wiring
- [ ] Authenticated nightly lane (token-guarded)
- [ ] Measured gate report (accuracy/latency/fallback/cost)
- [ ] Red-team pass through the five layers
- [ ] Privacy disclosure delta through guards
- [ ] Owner credentials + default-on authorization
- [ ] Post-flip monitoring window + rollback test evidence

## Surprises & Discoveries

- 2026-09-24 — Restoration reclassified the gates: project ACTIVE_HEALTHY,
  CLI authenticated (`supabase projects list` exit 0 without
  `SUPABASE_ACCESS_TOKEN`), functions reachable + auth-enforcing. The ONLY
  surviving external for phases 2-3 is the provider secret; local
  `OPENAI_API_KEY` (len 67, `sk-…`) is rejected 401 by OpenAI — do not
  mistake presence for validity.
- 2026-09-24 — `parse-ai-command` gateway order verified live:
  no-header → 401 `UNAUTHORIZED_NO_AUTH_HEADER`; anon-bearer → function-level
  401; authenticated anon session → normalize (400 on missing fields, 502 on
  provider absence). Auth-before-parse holds on the restored deployment.

## Decision Log

- 2026-09-23 — Selected as Master Successor of the production-closure campaign
  via the Phase 11 scored audit (value × leverage × fit × evidence × testability
  ÷ risk); sync held at spec-only because product decisions are not inferable.

## Validation Ledger

- 2026-09-24 — REST probes against restored project (anon, presence-only) —
  PASS(gateway) / FAIL(external provider) — GoTrue health 200 v2.197.0;
  anonymous signup 200 (`external.anonymous_users: true`); `/rest/v1/todos`
  42501 anon-denied (RLS intact); PARSE 502 / ASK 500 = missing secret.
- 2026-09-24 — local `OPENAI_API_KEY` validity probe (value never printed) —
  FAIL(external) — OpenAI 401 `Incorrect API key provided` → key present but
  placeholder/revoked; owner must provision real credentials as Edge
  Function secrets.
- 2026-09-23 — corpus battery (phase 1) — PASS — qa:fast 1,893/1,893 +
  parity; full `npm test` 2,266/2,266; journeys @p0 25/25; deterministic sim
  23/23; `tests/commandEvalCorpus.test.ts` 5/5.

## Changed Files / Areas

- (none yet)

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan.
2. Read the predecessor `production-closure-exact-head-cert-v1.md` Phase 11 audit
   for the full scoring rationale and Candidate A dossier.
3. `git status --short`, `git stash list` (foreign stash — preserve), `git fetch`.
4. Prefix PATH: `export PATH="$LOCALAPPDATA\tools\node-v22.23.2-win-x64;$PATH"`
   and verify `node --version` = v22.23.2.
5. Continue only from `Exact next action`.

## Outcomes & Retrospective

- Status: Active (corpus scope executable now; phases 2-6 gated on external
  credentials).
- Summary: Pending.
- Follow-up: Pending.
