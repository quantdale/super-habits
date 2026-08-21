# Proposal — Harden Massive Parallel Completion Wave V2

## Why

The parallel completion wave delivered roughly 45 commits across more than one hundred files and materially deepened nearly every product area. The wave intentionally deferred broad QA and durable-data convergence so implementation throughput could remain high.

The resulting code is valuable but not yet production-ready. The prior handoff records untested UI/native/PWA surfaces, three schema requests, two missing integrations, sequential multi-record operations, shared-tree/stash hazards, and cross-feature consistency risks.

Independent review also found a durable-state documentation error: the wave says the schema is frozen at v15 and suggests v16 next, while `core/db/client.ts` already contains migrations 16–19. Hardening must use the actual migration head, not the stale narrative.

## Goals

1. Make every accepted wave feature correct under realistic local, browser, backup/restore, and remote-boundary behavior.
2. Promote user-domain state that should survive reinstall/restore from device-only AsyncStorage into authoritative durable storage.
3. Preserve historical Backup/Portable compatibility while evolving the current contract safely.
4. Close remote Command Center and notification-action integration gaps.
5. Make multi-record user actions transactional or explicitly failure-safe and idempotent.
6. Prove new UI flows in browser E2E and deterministic simulation; run native validation when an environment exists.
7. Remove parallel-wave residue such as conflict markers/stale stashes and establish a safer parallel-commit workflow.
8. Finish only on a clean main-only repository whose exact final SHA has green GitHub quality and e2e jobs.

## Required durable-data decisions

The hardening agent must classify every new device-local store from the prior handoff.

Default decisions unless source evidence proves otherwise:

- Habit pause/archive state is domain data and must become durable/recoverable.
- Pomodoro session notes and task associations are session history and must become durable/recoverable.
- Workout load/repetition/duration inputs required by PR/volume features must have an authoritative data source or the UI must stop claiming metrics it cannot substantiate.
- Calorie targets, Pomodoro presets, workout rest defaults, and notification preferences are recoverable user settings candidates and should use the existing allowlisted settings/versioning mechanism when appropriate.
- Overview layout is a recoverable preference candidate but may remain device-local if explicitly documented as presentation-only.
- Command history may remain local for privacy unless product requirements explicitly choose recovery; do not silently upload it.

## Non-goals

- No unrelated new product feature families.
- No destructive migration rewrite.
- No weakening account ownership, RLS, Backup integrity, Portable integrity, restore emptiness checks, or exactly-once Linked Action semantics.
- No history rewrite/force push to improve mixed swarm attribution.
- No fake completion of native or live gates that were not actually run.

## Success

The campaign is complete when audited defects are fixed, durable state is coherent across SQLite/Supabase/Backup/Portable, remote parser and notification actions are integrated, full required QA passes, live migrations/deployments are verified where access exists, the hardening plan is COMPLETED with evidence, and the exact final pushed SHA has GitHub `quality` and `e2e` success.
