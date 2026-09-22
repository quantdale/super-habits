# SUPERHABITS — OVERNIGHT AUTONOMOUS PRODUCTION-CLOSURE & SUCCESSOR-CAMPAIGN DIRECTIVE

Status: ACTIVE
Received: 2026-09-22 (supersedes the prior Phases 0–11 campaign prompt; predecessor survives in Git history)

The controlling rule:

> **DO NOT STOP BECAUSE THE CURRENT CAMPAIGN IS COMPLETE. STOP ONLY WHEN ALL MATERIAL EXECUTABLE WORK HAS BEEN EXHAUSTED, THE REMAINDER IS EXTERNALLY BLOCKED, OR FURTHER CHANGE WOULD BE SPECULATIVE OR HARMFUL.**

## Standing authorization

Ordinary reversible engineering work to inspect, fix, harden, test, document, certify, and prepare SuperHabits for release is pre-approved: repository inspection, source changes, bug fixes, tests, E2E, CI/CD, migrations, Supabase work, docs, OpenSpec/ExecPlan work, release artifacts, runtime/browser/emulator inspection, commits, normal pushes, and other reversible operations. Do not repeatedly ask to continue — the standing answer is YES. Never force-push, never `git reset --hard`, never weaken tests, never touch `stash@{0}`, never kill processes not owned by this campaign.

## Overnight execution pattern

```text
DISCOVER → PRIORITIZE → DEFINE CAMPAIGN → IMPLEMENT → TEST → VALIDATE → INSPECT REAL BEHAVIOR → REVIEW DIFF → RECORD → COMMIT → REASSESS → SELECT SUCCESSOR CAMPAIGN → EXECUTE AGAIN
```

Do not invent work to consume time (no renames, formatting churn, gratuitous abstractions, speculative migrations, random upgrades, duplicate docs, vacuous tests, micro-optimizations, cosmetic cleanup).

## Primary mission order (Campaigns 1–11+)

1. Restore CI truth.
2. Reconcile repository/governance truth.
3. Exact-HEAD certification of one pinned candidate SHA (static/contracts, unit+integration, qa:fast, timezones, web build/verify/hygiene, full E2E across the real lane matrix, PWA, sim:validate + deterministic run, build:sync + e2e:sync where supported; classify every result PASS / PRODUCT_BUG / TEST_BUG / FLAKY_TEST / ENVIRONMENT / EXPECTED_KNOWN_GAP / SPEC_AMBIGUITY / SKIPPED_WITH_REASON; never hide skipped coverage).
4. Android exact-build certification on the available environment (APK from the exact certified SHA; smoke, persistence, lifecycle; record SHA-256, package, device/AVD/API/ABI).
5. Supabase/cloud/account closure — validate backup≠sync boundary, Restore V2, RLS, owner model, outbox, manifests, checksums, empty-device guard, portable integrity, recovery/OTP boundaries, edge functions; live round-trip only if authorized credentials exist, else classify BLOCKED_EXTERNAL with exact runbook.
6. iOS/release-platform readiness — static config/doctor checks; runtime classified BLOCKED_EXTERNAL without macOS/EAS/Apple credentials; never claim iOS certification without runtime evidence.
7. Store-release closure — complete every REPOSITORY_EXECUTABLE artifact; separate OWNER_ACTION / EXTERNAL_CREDENTIAL / LEGAL_CONFIRMATION / STORE_CONSOLE_ACTION / FINAL_RELEASE_AUTHORIZATION; no fabricated screenshots, no store submission, no release tag without explicit authorization.
8. Dependency/security posture — `npm audit`, `npm audit --omit=dev`, `npx expo-doctor`; classify advisories; no `audit fix --force`; preserve Expo compatibility; document unfixable chains.
9. Performance/reliability residuals — evidence-backed only; reproduce before changing; preserve J8 ceilings/floors; no threshold relaxation.
10. Final adversarial release review (§32) — attempt to reject the candidate across data safety, backup, restore, ownership, portable backup, todos/habits, workout, calories, focus, gamification, linked actions, web, native, cloud, CI, release docs, dependencies, documentation, git. Actionable findings become successor campaigns.
    11+ Successor campaigns — after 1.0 release line is exhausted, select the highest-value justified direction (true multi-device sync, production AI Command Center, reliability, UX, architecture, tests, performance) using `user value × technical leverage × architectural fit × evidence × testability ÷ implementation risk`. No speculative v2 implementation while genuine 1.0 repository-executable blockers remain; large scope needing product/business decisions gets architecture/spec + intentional deferral.

## Starting leads (verify everything; real behavior wins over documentation)

Expected repo `quantdale/super-habits`, prior tip `691d2a2`; suspected CI blocker `.agent/execplans/workout-history-quick-log-badge.md` COMPLETED with unchecked `- [ ] Single commit` despite `ac60e78` implementing the badge — verify before touching any plan.

## Repository instructions

Read before significant work: `AGENTS.md`, `.agent/PLANS.md`, `.agent/EXECUTION_PROMPT.md`, `.agent/EXECPLAN_TEMPLATE.md`, `README.md`, `docs/testing/autonomous-qa.md`, `docs/testing/known-gaps.md`, `docs/release/app-store-readiness.md`, `docs/PROJECT_STRUCTURE_MAP.md`, `qa/impact-map.json`, `openspec/`, `.github/`, `.eas/`. Use Version-2 ExecPlan/OpenSpec mechanisms; no competing task manager.

## Git safety (non-negotiable)

Before mutation: `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git rev-parse origin/main`, `git log --oneline -25`, `git worktree list`, `git stash list`, `git remote -v`, `git fetch --all --prune`. Never `git reset --hard` or `git push --force`. Never delete/overwrite unknown or concurrent work. Coherent milestone commits (`fix/feat/test/refactor/docs/chore`); no secret/debug/generated-artifact commits; inspect `git diff` before every material commit. Push normally when safe.

## Subagent strategy

Parallelize independent read-only investigation (git/governance, CI, certification matrix, Android/native, Supabase/cloud, release/store, dependencies, UI/UX). Mutating agents need explicit non-overlapping ownership. Primary agent integrates findings.

## Durable state

Do not depend on chat memory. Live in `.agent/execplans/production-closure-exact-head-cert-v1.md` (Plan-Version 2): objective, start/current HEAD, milestone, completed/active campaign, discoveries, backlog, decisions, validation evidence, blockers, external-only items, exact next action, remaining DoD. Checkpoint after every meaningful event, before long suites/builds/delegation, after failures/fixes/commits, before final validation.

## Failure policy

A failing gate is not a stop condition: preserve evidence → reproduce → root-cause → classify → sibling search → smallest fix → regression protection → targeted rerun → broader rerun → update state → continue. Never endlessly rerun an identical failing command. Never obtain green by deleting/weakening/skipping meaningful tests or raising limits uninvestigated.

## Campaign completion ≠ overall completion

After every campaign ask: "Did I finish SuperHabits, or merely finish this campaign?" Apply the Master Successor Rule: the highest-value material work still executable now becomes an execution instruction, not a recommendation. Overlap read-only archaeology with long-running validation; checkpoint often; keep momentum.

## Terminal conditions (§34)

- A — strong executable completion (all material work completed/verified/deliberately rejected with documented technical reason; strongest practical validation green; no responsible successor remains).
- B — external exhaustion (remaining work needs unavailable credentials/hardware/store access/legal; all independent executable work exhausted).
- C — further change would be speculative/harmful (justified, not abused).

Legitimate blockers: record exact blocker, required condition, exact resume action, classification; continue with the next independent executable campaign. Ordinary ambiguity is resolved by inspecting code/tests/docs/history, inferring intent, choosing the safest reversible interpretation, and recording assumptions — never manufactured as a stop excuse.

## Final validation matrix (§33)

Run the strongest practical subset of: `npm ci`, typecheck, lint, validate:themes, openspec:validate, agent:plan:validate:all, qa:impact:validate, qa:fast, npm test, qa:timezones, build:web, web:verify, web:hygiene, e2e, sim:validate, sim:run --mode deterministic, build:sync, e2e:sync, qa:native:android, qa:native:targeted, qa:native:lifecycle, npm audit (+ --omit=dev), expo-doctor. Record exact results; fix defects and rerun affected evidence.

## Final git state check (§35)

`git status --short`, branch, HEAD, origin/main, `git log --oneline -25`, `git diff --check`, `git worktree list`; campaign background processes stopped; temp artifacts removed; plan truthful; unrelated user work preserved.

## Required final report (§36)

Evidence-heavy report with the 22 prescribed sections (verdict, start/final state, campaigns, CI repair, defects fixed, test/certification results, web/PWA, Android, Supabase, iOS, store, dependencies, performance, governance, external-only remainder with WHY/CLASSIFICATION/WHAT/EXACT resume action, deliberate boundaries, v2 work, commits, exact final SHA, origin/main, worktree status). Success claims must match exact evidence scope (§37) — never "production ready / all tests pass / secure / fully verified" beyond proven scope.
