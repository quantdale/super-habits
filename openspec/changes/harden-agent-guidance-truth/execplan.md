# ExecPlan: Harden agent-guidance truth

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Apply the [harden-agent-guidance-truth OpenSpec change](proposal.md) and its
[tasks](tasks.md): every agent-facing guidance document states only facts
derivable from repository source, and the doc-drift guard
(`tests/agentDocConsistency.test.ts`) mechanically pins the values a wrong
reading could turn into an unsafe command (a `build:web` before a Playwright
lane that inlines live Supabase credentials into `dist/`) or a false product
claim (Ask/Auto "currently `true`").

## Context

- Starting HEAD `c1bc380ce330cda1e089fd79b49a12029defbb72` on `main`; the tree
  carries only the untracked, gitignored iOS extract plus untracked change
  directories. No tracked product file is modified at baseline.
- `tests/agentDocConsistency.test.ts` already derives the schema version, the
  runtime dependency pins, the service-worker cache generation, and the backup
  entity count from source — but asserts them only against
  `.github/copilot-instructions.md`, `AGENTS.md`, the unified knowledge base,
  `docs/PROJECT_STRUCTURE_MAP.md`'s schema line, `CLAUDE.md`'s service-worker
  string, and `.cursor/commands/pre-pr.md`'s service-worker string.
- Ground truth collected before editing, all verified against source:
  - Provider bootstrap order (`core/providers/AppProviders.tsx:105-243`):
    service worker (web) → `initializeDatabase()` → `syncEngine.hydrate()` →
    `migrateLegacySessionMeta()` → `accountCoordinator.bootstrap()` (anonymous
    session only for an empty/unbound dataset, and only with Supabase env) →
    `accountCoordinator.refresh()` (ownership reconciliation) → restore preview.
  - `features/command/types.ts:4`: `AI_ASK_EXPERIMENT_ENABLED` is
    `process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT === 'true'`.
  - `features/command/commandConfig.ts` accepts parse modes
    `mock | remote_with_fallback` and backend hosts `supabase_edge | custom_url`.
    `.env.example` shipped `local` + `default` — both invalid, both silently
    coerced to `mock` + `supabase_edge`.
  - `npm run lint` is pinned at `--max-warnings 0` in `package.json`.
  - `scripts/web-verify.mjs:86` builds with `npm run build:e2e`; the E2E lanes
    are fed by the same hermetic export.
- A scripted survey of the eight guidance documents found exactly five
  `npm run build:web`-before-E2E instruction sites (`CLAUDE.md:36,45`,
  `ONBOARDING.md:72`, `docs/codex-workflow.md:35,69,70`) and five legitimate
  deploy/finite-path sites that must stay green (`README.md:171`,
  `CLAUDE.md:89`, `AGENTS.md:114,304,411,430`,
  `.cursor/rules/superhabits-rules.mdc:14`).

## Scope

The four task groups in tasks.md: documentation corrections (1.1-1.10), AI
rollout default truth (2.1-2.3), the extended guidance-truth guard (3.1-3.7),
and validation (4.1-4.5). Documentation-only plus one test file.

## Non-Goals

No `app/`, `core/`, `features/`, `lib/`, or `supabase/` product change. No
schema migration. No rewrite of the superseded knowledge base — it is demoted,
not repaired, and its existing pins stay in place. No structural rewrite of
`docs/master-context.md`; only the stale lint number task 1.7 names. No archive
or sync into `openspec/specs/` — that is a separate, user-invoked step.

## Current Checkpoint

- Current milestone: COMPLETE — all 25 tasks in tasks.md are checked and each is
  backed by a corrected document or a new guard assertion, with the validation
  gate recorded from the final tree.
- Completed: every documentation correction (1.1-1.10), the AI rollout
  default-truth edits (2.1-2.3), the extended guard (3.1-3.7), and the
  validation and diff review (4.1-4.5). The guard is proven non-vacuous: replayed
  against `HEAD`, it reports all six instruction violations
  (`CLAUDE.md:36,45`, `ONBOARDING.md:72`, `docs/codex-workflow.md:35,69,70`),
  the stale `core/db/schema.sql` version 24, the README Ask claim
  ("currently `true`", "enabled 2026-08-05"), the stale lint caps
  (`CLAUDE.md` 25, `docs/master-context.md` 81), the knowledge base listed under
  `AGENTS.md` "Authoritative Docs", and the gap-15 status contradiction — and it
  is green on the corrected tree.
- In progress: none.
- Important modified files: `CLAUDE.md`, `ONBOARDING.md`, `README.md`,
  `AGENTS.md`, `docs/codex-workflow.md`, `docs/PROJECT_STRUCTURE_MAP.md`,
  `docs/master-context.md`, `.cursor/commands/pre-pr.md`,
  `.cursor/commands/audit-performance.md`, `core/db/schema.sql`,
  `docs/testing/known-gaps.md`, `.env.example`, and
  `tests/agentDocConsistency.test.ts`.
- Last successful validation: pinned Node `v22.23.2` — `npm run qa:fast` green
  (typecheck 0 errors, lint 0/0, unit 157 files / 1936 tests,
  journey-label-parity OK, quarantine-register-parity OK; see the ledger).
  `openspec validate --all` 68 passed / 0 failed;
  `openspec validate harden-agent-guidance-truth --type change --strict` valid.
- Current failures: none attributable to this change. `npm run format:check`
  reports 128 pre-existing repo-wide failures, none of them a file this change
  touches (the count was 136 before this change's eight OpenSpec artifacts were
  formatted).
- Relevant quarantines: none — no test was weakened, skipped, or relaxed. The
  known-gaps 800 ms ceiling, the 15 % floor, and every recorded excursion number
  in gap 15 are byte-identical; only its status label changed.
- Blockers: none.
- Condition required to unblock: not applicable.
- Exact resume action after unblock: not applicable.
- Exact next action: none — the change is fully applied. Archiving into
  `openspec/specs/` is a separate, user-invoked OpenSpec step, as is committing
  the tree.
- Remaining definition of done: complete.

## Progress

- [x] Wave 0 — baseline survey, this plan, plan validation (`ExecPlan valid`).
- [x] Wave 1 — tasks 1.1-1.10 documentation corrections.
- [x] Wave 2 — tasks 2.1-2.3 AI rollout default truth.
- [x] Wave 3 — tasks 3.1-3.7 extend `tests/agentDocConsistency.test.ts`.
- [x] Wave 4 — tasks 4.1-4.5 validation and full-diff review.

## Surprises & Discoveries

- `.env.example` shipped `EXPO_PUBLIC_AI_COMMAND_PARSE_MODE=local`, not the
  `remote_with_fallback` the proposal names; `local` is equally invalid because
  `readParseMode` only recognises `remote_with_fallback` and otherwise coerces to
  `mock`. The task's intent (replace both placeholders with values
  `commandConfig.ts` accepts) is met with `mock`, and the backend host with
  `supabase_edge`.
- `AGENTS.md` already carries the corrected guidance (it instructs
  `npm run build:e2e` before its E2E block and explicitly warns that plain
  `build:web` inlines local `.env` Supabase credentials), so the guard's
  proximity rule must treat AGENTS.md's own warning comment as green.
- A naive "the word `closed` near a CLOSED label" register check false-positives
  on `fail-closed` (gap 21) and on `ERR_IPC_CHANNEL_CLOSED` (environment note
  E1); the guard therefore uses the register's own uppercase label vocabulary
  and is scoped to the capability-gap and contract-gap sections.

## Decision Log

- Extend the existing guard rather than adding `agentGuidanceTruth.test.ts`
  (design decision 1): one document inventory, one place to extend.
- The export-command rule is a two-tier proximity check — same-line prose
  pairing, or an E2E _command_ on either of the next two lines — so the deploy
  sites and AGENTS.md's warning comment stay green while all five defect sites
  fail.
- Correct gap 15's label to `CLOSED (TEST_BUG)` with the residual
  `ENVIRONMENT` ceiling excursions preserved verbatim: the entry's own
  2026-09-24 root-cause note records a measurement-start defect fixed by
  `waitForSectionTransitionsSettled`, and its addendum records a residual
  host-load excursion that is explicitly classified `ENVIRONMENT`. The ceiling,
  the floor, and every recorded number stay unchanged.
- Correct the stale `--max-warnings 81` in `docs/master-context.md` even though
  that document self-declares as superseded and is deliberately outside the
  guard inventory: task 1.7 names it, the number is simply wrong, and leaving it
  would keep teaching a session that warnings are tolerated.

## Adversarial Review and Dispositions

- Review pending after the edits land (review the diff as one set, per design
  decision 7).

## Validation Ledger

| Date       | Command / source                                                          | Outcome                                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-29 | `git show HEAD:<doc>` replay of every new guard rule                      | FAIL on the pre-change tree — 6 instruction violations (`CLAUDE.md:36,45`, `ONBOARDING.md:72`, `docs/codex-workflow.md:35,69,70`), `schema.sql` version drift, README Ask claim, lint-cap drift (25, 81), KB listed as authoritative — proving the rules are not vacuous |
| 2026-09-29 | `npx vitest run tests/agentDocConsistency.test.ts` (pinned Node v22.23.2) | PASS — 11/11                                                                                                                                                                                                                                                             |
| 2026-09-29 | `npm run qa:fast` (pinned Node v22.23.2)                                  | PASS — typecheck 0 errors; lint 0 errors / 0 warnings; unit 157 files / 1936 tests passed; journey-label-parity OK; quarantine-register-parity OK (12 gate files registered)                                                                                             |
| 2026-09-29 | `npx prettier --check` on the 13 parseable changed files                  | PASS — all clean                                                                                                                                                                                                                                                         |
| 2026-09-29 | `npm run format:check`                                                    | 128 pre-existing repo-wide failures; none in a file this change touches (`.env.example` and `core/db/schema.sql` have no prettier parser; baseline was 136 before this change's 8 OpenSpec artifacts were formatted)                                                     |
| 2026-09-29 | `npm run openspec:validate` (`--all`)                                     | PASS — 68 passed / 0 failed                                                                                                                                                                                                                                              |
| 2026-09-29 | `openspec validate harden-agent-guidance-truth --type change --strict`    | PASS — change is valid                                                                                                                                                                                                                                                   |
| 2026-09-29 | `node scripts/agent-execplan.mjs validate --plan …`                       | PASS — ExecPlan valid                                                                                                                                                                                                                                                    |
| 2026-09-29 | Full-diff review                                                          | Documentation-only plus `tests/agentDocConsistency.test.ts`; no `app/`, `features/`, `lib/`, or `supabase/` file changed                                                                                                                                                 |

## Changed Files / Areas

- `CLAUDE.md` — lint cap, hermetic export instruction, E2E note + deploy-export warning, real provider bootstrap order, Ask/Auto env var.
- `ONBOARDING.md` — baseline verification uses `npm run build:e2e`.
- `docs/codex-workflow.md` — finite-web-validation, web/UI-change, and pre-PR validation commands use the hermetic export, plus a prohibition line naming plain `build:web`.
- `core/db/schema.sql` — reference-snapshot header now declares version 25 and states it can lag `core/db/client.ts`.
- `docs/PROJECT_STRUCTURE_MAP.md` — real `AppProviders` bootstrap order (sync hydration precedes ownership reconciliation).
- `README.md` — outbox hydration ordering; Ask/Auto hidden-by-default claim; the Ask/Auto env-var list.
- `AGENTS.md` — the unified knowledge base moved out of "Authoritative Docs" into a historical/superseded section; every existing link and pin retained.
- `.cursor/commands/pre-pr.md`, `.cursor/commands/audit-performance.md`, `docs/master-context.md` — lint cap pinned at `--max-warnings 0`.
- `docs/testing/known-gaps.md` — gap 15 status label corrected to `CLOSED (TEST_BUG; residual ENVIRONMENT ceiling excursions stay recorded)`; ceiling, floor, and every recorded number unchanged.
- `.env.example` — `EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT` added; the two invalid placeholders replaced with values `commandConfig.ts` accepts (`mock`, `supabase_edge`).
- `tests/agentDocConsistency.test.ts` — `GUIDANCE_DOCS` inventory plus the export-command, Ask/Auto, schema-snapshot, lint-cap, authoritative-doc, and register-status guards.
- `openspec/changes/harden-agent-guidance-truth/tasks.md` — all 25 tasks checked.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan, and the change's
   `proposal.md` / `specs/` / `tasks.md`.
2. `git status --short` and `git diff --stat`; reconcile this checkpoint
   against the real tree.
3. Re-run `npx vitest run tests/agentDocConsistency.test.ts` to confirm the
   guard is still green.
4. No implementation action remains. Archiving the change into
   `openspec/specs/` and committing the tree are separate, user-invoked steps.

## Outcomes & Retrospective

- Status: Completed.
- Summary: every agent-facing guidance document now states facts derivable from
  source, and the doc-drift guard enforces them. The change removed the last
  instruction that could re-attach a local Playwright lane to a live Supabase
  project (six sites across four documents), deleted the false "Ask/Auto
  currently enabled" product claim, corrected the schema snapshot, the provider
  bootstrap order in three documents, and four stale lint-cap claims, demoted the
  self-superseded knowledge base out of the authoritative list, and corrected the
  known-gaps register's only self-contradictory status label. The guard's
  inventory makes each of these mechanical: adding a guidance document is a
  one-line diff, and drift fails `qa:fast` rather than waiting for a review.
- Note for reviewers: `core/db/schema.sql` is the hand-maintained reference
  snapshot that task 1.3 mandates editing; it is documentation, never executed at
  runtime, so no product or schema code changed.
- Follow-up: archive this change into `openspec/specs/` when the user invokes the
  OpenSpec archive step; the remaining six pending changes in
  `openspec/changes/` still need their own apply pass.
