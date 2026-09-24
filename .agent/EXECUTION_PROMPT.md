# SUPERHABITS — LIVE CLOUD VERIFICATION & PRODUCTION INTEGRATION CAMPAIGN

Status: ACTIVE
Received: 2026-09-24 (supersedes the completed Overnight Production-Closure & Successor directive; predecessor survives in Git history and in `.agent/execplans/production-closure-exact-head-cert-v1.md`, Status COMPLETED)

## Mission

Resume SuperHabits from its completed production-closure campaign. The next
objective is to close the remaining external integration gaps, beginning with
the newly restored Supabase project, and then execute the justified successor
work for the AI Command Center, iOS certification and store readiness.

## Non-negotiable constraints (user directive, verbatim intent)

1. Do NOT restart the previous 24-commit campaign (`691d2a2..2f742fe`).
2. Do NOT repeat validated work without an impact-based reason
   (`npm run qa:affected` / `qa/impact-map.json` decides).
3. Do NOT stop simply because one external dependency is unavailable —
   every blocker gets an exact runbook + classification, and work moves to
   the next independent executable item.

## Continuity anchors (verified at handoff)

- HEAD == origin/main == `2f742fee63721f2182a28f6577fc1110648fe5ca`, branch
  `main`, tree clean, single worktree, foreign `stash@{0}` preserved.
- Prior campaign closed: verdict PASS; CI `35871287036` success; post-close
  nightly `35912837207` success; Android cert `7bc8a64` / APK
  `4D9A0EF9BACF82745AB74B8B94E48D0A5396CF21C370560B8AE01561F5FA46D5`
  (19/19); plans validate 92 PASS / 0 FAIL.
- Prior blockers now IN SCOPE for closure attempts (attempt first, classify
  only on evidence):
  - Supabase live: previously BLOCKED (project INACTIVE, no
    `SUPABASE_ACCESS_TOKEN`, CLI absent, configured host NXDOMAIN). Mission
    states the project is RESTORED — treat as ground truth and execute the
    recorded resume path.
  - EAS iOS runtime: previously BLOCKED ("No repository found for appId";
    Maestro jobs require a paid plan).
  - Store: repository scope closed; remaining = owner/console/legal actions.
- Successor plan `.agent/execplans/ai-command-center-production-v1.md`
  (ACTIVE): phase 1 corpus DONE; phases 2-6 credential-gated with exact
  resume `npx tsx simulation/backend/provision.ts run --with-parser
--no-teardown`, then authenticated eval/observation describes and measured
  gates recorded in its Validation Ledger.

## Execution rules (standing)

- Ordinary reversible engineering pre-approved; never force-push, never
  `git reset --hard`, never weaken tests, never touch `stash@{0}`, never
  kill foreign processes, never print secret values (presence/length only),
  no store submission or release tag without explicit authorization.
- Classify every red with the six-value contract AFTER reproducing.
- Durable state lives in `.agent/execplans/` — new mission plan +
  successor plan checkpoints; checkpoint at every phase boundary.
- PATH prefix for gates: `export PATH="$LOCALAPPDATA\tools\node-v22.23.2-win-x64;$PATH"`.
