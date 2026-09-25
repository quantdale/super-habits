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
- Existing assets: Edge Functions (`parse-ai-command`, `user-ai-ask`,
  `_shared/aiSecurity.js` — auth-before-parse, 32KB/280/20-turn/24KB bounds,
  quota pre-consume, allowlist); dual-mode client with `remote_with_fallback`; confirm
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

- Current milestone: Phase 1 corpus complete; 2026-09-25 external-blocker-closure
  AI readiness (tasks 4.1–4.4) is in progress before provider-backed phases.
- Completed: Phase 1 corpus and its 2026-09-23 battery (see ledger). Fresh source
  review found content-bearing upstream/error logs and default-visible Ask/Auto.
  Scoped source fixes now remove provider bodies/model-derived errors from logs,
  and make Ask/Auto an explicit internal build flag, with a dummy-host sync
  test opt-in. An adversarial review found direct authenticated Edge calls
  could bypass that UI flag; both functions now require a server-side flag
  and exact authenticated UID allowlist before body/quota/provider work.
  Log and direct-call regressions pass; the prior `npx tsc --noEmit` passed.
- In progress: broad affected QA, authenticated provider and deployed-state
  gates, and owner review of the completed phase-5 privacy/rollout draft.
- Important modified files: the two Edge `index.js` files, `features/command/types.ts`,
  `scripts/build-dist-sync.mjs`, focused unit/E2E tests and shared A11y helper.
- Last successful validation: pinned Node v22.23.2, AI-focused Vitest 685/685,
  direct Edge log/rollout/security tests 15/15, exact dummy-host Ask journey
  9/9, and hermetic web build. Broad affected QA still pending.
- Current failures: None after source fixes. The three red log tests were
  expected reproductions of a product privacy defect.
- Relevant quarantines: None.
- Blockers: read-only production secret inventory on 2026-09-25 reports parse
  `OPENAI_API_KEY` absent and `AI_COMMAND_MODEL` absent; Ask `DEEPSEEK_API_KEY`
  present but unverified. No authorization for billable provider evaluation or
  default-on rollout; `SUPABASE_ACCESS_TOKEN` absent locally. Provider presence
  is neither validity nor authenticated-evaluation proof.
- Condition required to unblock provider phases: owner supplies valid parse
  credentials and authorizes bounded provider spend/evaluation; supplies CI
  Management API token for the guarded disposable lane; approves disclosure
  and default-on only after measured gates pass.
- Exact resume action after external unblock: rerun the read-only secret presence
  check, then execute the existing authenticated eval and observation lanes on
  a proven disposable target under the approved budget; record separate parse
  and Ask metrics before any flag change.
- Exact next action: run pinned-Node affected broad QA, verify ordinary-build
  Ask/Auto absence in the standard browser lane, and record final local
  security review; retain separate provider/deployment authorization gates.
- Remaining definition of done: local QA and draft proof; authenticated parse
  and Ask gates with quality, latency, failure, isolation, and cost numbers;
  owner-approved disclosure/default-on, monitored window, and rollback proof.

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
- 2026-09-25 — Fresh source review found both functions logged a truncated raw
  provider error body. Ask also logged exception messages that could include
  model output. The prior "no-PII logging" checkpoint was inaccurate. A
  focused regression now probes those paths with synthetic sentinel data.
- 2026-09-25 — `AI_ASK_EXPERIMENT_ENABLED` had been hard-coded true, so ordinary
  builds exposed Ask/Auto despite missing current rollout approval. An exact
  internal build flag now defaults them off; the dummy-host sync export opts in.
- 2026-09-25 — Production Edge secret inventory (names only): parse pair absent,
  Ask key present. The historical claim that both providers were absent must
  not be carried forward. Secret validity and deployed runtime state remain
  unproven without authorized evaluation.
- 2026-09-25 — A client-only Ask flag did not prevent direct authenticated
  calls to the deployed-function URL. Source now fails closed unless the
  per-function server flag and `AI_INTERNAL_USER_IDS` include the authenticated
  owner; direct-call tests prove no quota or provider request on rejection.

## Decision Log

- 2026-09-23 — Selected as Master Successor of the production-closure campaign
  via the Phase 11 scored audit (value × leverage × fit × evidence × testability
  ÷ risk); sync held at spec-only because product decisions are not inferable.
- 2026-09-25 — Default Ask/Auto off in ordinary source builds; only the guarded
  dummy-host sync export explicitly opts in for non-provider UI tests. No
  provider call, deployed flag flip, or default-on authorization is inferred.
- 2026-09-25 — Both Edge Functions are source-gated for an explicit internal
  owner allowlist before quota/provider. Deployment and secret configuration
  remain separate external owner actions; source checks are not live proof.

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
- 2026-09-25 — pinned Node `v22.23.2`; `npx vitest run
tests/aiEdgeLogPrivacy.test.ts --project unit` — RED 3/3 before fix (raw
  provider bodies and model-derived invalid intent in logs); GREEN 3/3 after.
- 2026-09-25 — `npx vitest run tests/aiEdgeLogPrivacy.test.ts
tests/aiAskRolloutFlag.test.ts --project unit` — PASS 5/5;
  `npx tsc --noEmit` — PASS.
- 2026-09-25 — `npx supabase secrets list --project-ref
kruubbynsmxzxfdunaal --output json` parsed locally to name-presence booleans
  only — parse pair absent, Ask key present; no secret value printed.
- 2026-09-25 — `npx vitest run command ask ai --project unit` — PASS 685/685;
  `npx vitest run tests/aiEdgeLogPrivacy.test.ts tests/aiSecurity.test.ts
--project unit` — PASS 15/15 including four direct-call gate cases;
  `journeys-sync` Ask spec with explicit `E2E_DIST_DIR=dist-sync` — PASS 9/9.

## Changed Files / Areas

- Edge function operational logs, Ask/Auto build gate, dummy-host test export,
  and affected focused/unit/browser tests; see Git diff for authoritative list.

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
