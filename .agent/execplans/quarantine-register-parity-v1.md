# ExecPlan: quarantine-register-parity-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the docs/register drift around skipped and quarantined E2E tests so
reduced coverage is never silently presented as passing coverage: (1) register
the Ask-V2 deterministic-boundary lane gate that currently has no known-gaps
entry, (2) correct the stale `e2e/README.md` quarantine paragraph and journey
counts, and (3) add a parity guard so the register cannot rot silently again
(CG-8 precedent: `scripts/journey-label-parity.mjs`).

## Context

- Standing rule (`docs/testing/known-gaps.md`): "Any skipped or quarantined
  test is added to this register, with its reason. Weakening an assertion is
  never an acceptable resolution."
- All contract gaps CG-1..CG-9 are CLOSED; remaining `test.fixme`/`test.skip`
  sites are lane attributes (dist-sync, internal-eval opt-in, Sunday calendar).
- Survey 2026-09-19 found two drift instances:
  - `e2e/journeys/command-center-v2-ask.spec.ts` (P6 Ask V2 deterministic
    boundary, tagged `@sync`) gates both its reset step and every Ask question
    with `test.fixme(true, 'Ask boundary tests run against the
dummy-Supabase dist-sync export; standard dist/ is local-only.')`. No
    known-gaps entry names this file or lane. Mirror-image entry 13 covers the
    provider-unavailable skip on remote builds, not this gate.
  - `e2e/README.md` line 63 says "The remaining decided performance contracts
    run as `test.fixme()` ... (CG-4 recurring section-switch latency and CG-5
    HEAVY diary search)". Both closed 2026-08-10; `three-months-in.spec.ts`
    steps 3 and 6 carry no `test.fixme` and assert strict ceilings. The same
    README says "Six behavioural personas generate the ten journeys" but
    `e2e/journeys/` now holds 19 spec files (P6 Ask V2 added).
- Guard precedent: CG-8 added `scripts/journey-label-parity.mjs` (unit-tested,
  wired into `qa:fast`) for the same rot class.

## Scope

- `docs/testing/known-gaps.md`: add capability-gap entry 20 for the Ask-V2
  lane gate (reason, lane behavior, closing path: none needed, keep the gate).
- `e2e/README.md`: fix the quarantine paragraph (CG-4/CG-5 closed and
  unquarantined; point to gap 15 for the headroom-flake class) and the
  journey/persona counts.
- New guard `scripts/quarantine-register-parity.mjs`: every E2E spec file
  containing a real `test.fixme(`/`test.skip(` call must be referenced in
  `known-gaps.md` (by filename stem or explicit alias map); wire into
  `qa:fast`; unit test `tests/quarantineRegisterParity.test.ts`.
- Validation per `qa/impact-map.json` (`npm run qa:affected`).

## Non-Goals

- Overlay x theme Ask/Auto matrix fill (explicitly low-value, saturated lane).
- J8 product perf / section-switch threshold changes (evidence-only closed).
- Owner-only App Store console / screenshots / credentials / invented PII.
- GitHub Actions billing-blocked work; EAS submit; push; v1.0.0 tag.
- Redoing COMPLETED plans (tinypool E1, web-lifecycle, store guards, overlay a11y).
- Changing any test gate, assertion, threshold, or lane membership.
- Native lanes (no AVD/provisioning on this box for this task).

## Current Checkpoint

- Current milestone: COMPLETE — shipped, validated, validator PASS.
- Exact next action: None — task complete.
- Completed: startup survey + gap choice; known-gaps entry 20 + entries 8/9
  covered-files lines; e2e/README.md quarantine paragraph + journey counts;
  `scripts/quarantine-register-parity.mjs` (single-pass lexer after a
  the-commute `/*.supabase.co/` false-negative find); 6-case unit test;
  `qa:fast` wiring; prettier clean; guard positive (13/13) + negative checks.
- In progress: qa:fast (typecheck + lint + full unit + both parity guards).
- Important modified files: `docs/testing/known-gaps.md`, `e2e/README.md`,
  `scripts/quarantine-register-parity.mjs`,
  `tests/quarantineRegisterParity.test.ts`, `package.json`.
- Last successful validation: guard OK 13/13 + unit 6/6 + prettier clean.
- Current failures: None.
- Relevant quarantines: None (task adds no quarantines).
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: add known-gaps entry 20 + fix e2e/README.md, then write
  the parity guard script + unit test + qa:fast wiring.
- Remaining definition of done:
  - [ ] known-gaps entry 20 landed and accurate.
  - [ ] e2e/README.md quarantine paragraph + counts corrected.
  - [ ] parity guard script ships, fails on unregistered gate file (negative
        check), passes on current tree.
  - [ ] unit test for the guard passes; `qa:fast` (or impact-mapped gates)
        green under pinned Node 22.
  - [ ] plan validated (`agent:plan:validate`) and marked COMPLETED; local
        commit only, no push.

## Progress

- [x] 2026-09-19 — Startup + survey; gap chosen (register parity drift).
- [x] Docs: known-gaps entry 20 + entries 8/9 file refs + README corrections.
- [x] Guard script (lexer fix) + unit test + qa:fast wiring.
- [x] Validation: qa:fast + focused plan tests + plan validate.
- [ ] Local commit (no push).

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-19 — Gap chosen: register/docs parity drift over security-header
  speculation or native lanes. Why: all contract gaps are closed and remaining
  skips are lane attributes; the standing rule makes an unregistered gate a
  genuine compliance defect, and the stale README actively misdescribes closed
  contracts. Both are box-executable with a guard that prevents recurrence
  (CG-8 precedent). Headers/config speculation and device lanes rejected per
  mission prefer-order and box-executability.
- 2026-09-19 — Box-executable gaps are thinning: contract register fully
  closed, overlay a11y saturated, store repo-side guards done. Stated per
  mission; this increment is a verified guard + evidence-close, not a product
  behavior change.

## Validation Ledger

- 2026-09-19 — startup checks — PASS — Node v22.23.2, HEAD 4a64d39, ahead 14,
  no ACTIVE plans.
- 2026-09-19 — `node scripts/quarantine-register-parity.mjs` — PASS — 13/13
  gate files registered; negative check (redacted stem) flags correctly.
- 2026-09-19 — `npx vitest run --project unit
  tests/quarantineRegisterParity.test.ts` — PASS — 6/6 (incl. the-commute
  route-string and template-expression lexer cases).
- 2026-09-19 — `npm run qa:fast` — PASS — typecheck clean, lint clean
  (`--max-warnings 0`), unit 142 files / 1805 tests, journey-label-parity OK,
  quarantine-register-parity OK 13/13.
- 2026-09-19 — `npm run agent:plan:validate -- --plan <this plan>` — PASS.
- 2026-09-19 — broad-regression lanes (qa:full/journeys/simulation) NOT RUN —
  deliberate: no app, spec, fixture, or harness code changed (docs + node
  guard + unit test + qa:fast wiring only); cheapest sufficient gates per
  AGENTS.md. Full battery remains the CI/main-lane path.

## Changed Files / Areas

- `docs/testing/known-gaps.md` — reason (new entry 20).
- `e2e/README.md` — reason (quarantine paragraph + counts).
- `scripts/quarantine-register-parity.mjs` — reason (new guard).
- `tests/quarantineRegisterParity.test.ts` — reason (guard unit test).
- `package.json` — reason (`qa:fast` wiring only).

## Recovery / Resume Instructions

1. `export PATH="$HOME/.local/share/fnm/node-versions/v22.23.2/installation/bin:$PATH"; node --version` (must be v22.x).
2. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
3. `git status --short; git log --oneline -3`; HEAD should include 4a64d39.
4. Continue from `Exact next action` above; keep checkpoint current.
5. Validate with pinned Node: focused guard test, `npm run qa:affected`,
   `npm run agent:plan:validate -- --plan .agent/execplans/quarantine-register-parity-v1.md`.
6. Never push, tag, EAS-submit, or switch models.

## Outcomes & Retrospective

- Status: COMPLETED.
- Summary: register/docs parity drift closed. known-gaps entry 20 registers
  the four V2-era `@sync` lane files plus the Ask-V2 gate; entries 8/9 now
  name their spec files; e2e/README.md no longer misdescribes CG-4/CG-5 as
  quarantined and counts nineteen journeys. The new parity guard (wired into
  qa:fast, unit-tested incl. a real the-commute false-negative found during
  development) makes future drift fail the PR lane instead of rotting.
- Follow-up: none required. If a new skipped/quarantined test is added, name
  its file stem in known-gaps.md or qa:fast fails with the stem.
- Lessons: naive comment-stripping breaks on route-pattern strings that
  contain both `/*` and `*/` — the guard now uses a string-aware single-pass
  lexer; keep that invariant if the scanner is extended.
