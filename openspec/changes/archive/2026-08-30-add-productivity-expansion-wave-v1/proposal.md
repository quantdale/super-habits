# Proposal: Productivity Expansion Implementation Wave V1

## Summary

Ship a broad local-first product expansion in one overnight implementation run, then harden the entire wave in a dedicated follow-up campaign.

This change intentionally prioritizes implementation throughput over exhaustive validation. The current accepted baseline is `6f18cce75459e21d11c29a2b82330a402336d9f4`, whose GitHub Actions run `32269563521` independently verified `quality` and `e2e` green, including the dist-sync account/recovery lane.

The wave adds five connected product capabilities:

1. **Planning Hub** — one modal workspace with Today, Projects, Goals, Progress, and Timeline views.
2. **Projects & Goals V1** — organize Todos/Habits around longer-running outcomes.
3. **Daily Planning V1** — intention, top priorities, focus target, notes, and end-of-day reflection for a local calendar day.
4. **Quick Capture V1** — globally accessible fast creation for Todo, Habit, Calorie entry, Project, and Goal plus a shortcut into Focus.
5. **Activity Timeline + Progress Insights V1** — derived cross-domain history and 7-day vs prior-7-day summaries.

The six existing top-level tabs remain unchanged.

## Why now

Super Habits already tracks rich execution data and now has Weekly Review & Planning V1. The largest product gap is no longer basic tracking; it is the layer between long-term intent, daily planning, fast capture, and understandable progress.

This implementation wave should create that layer while the user is away, then a later hardening campaign will audit migrations, correctness, sync/backup/portable integration, native behavior, performance, accessibility, and comprehensive regression coverage.

## Implementation-mode policy

This is explicitly **not a hardening run**.

The implementation session SHALL:

- skip baseline QA;
- avoid broad test sweeps during implementation;
- prefer coding the next independent slice over spending long periods polishing one blocked slice;
- run only minimal end-of-wave sanity gates needed to avoid obviously uncompilable work;
- push the complete implementation wave to `main` once;
- not wait for or chase GitHub Actions unless an immediately visible failure proves the repository cannot compile at all;
- finish with the durable status **IMPLEMENTATION WAVE COMPLETE — HARDENING REQUIRED**, not production-ready language.

The following are intentionally deferred to the subsequent hardening campaign:

- full Vitest regression;
- full Playwright/E2E;
- deterministic simulations;
- Android/iOS runtime QA;
- production Supabase migrations;
- remote backup/sync integration for the new entities;
- Portable Backup integration for the new entities;
- migration upgrade/failure torture testing;
- extensive performance profiling;
- deep accessibility audit;
- adversarial data validation and corruption recovery;
- final production readiness judgment.

## Scope

### Projects V1

Introduce authoritative local `projects` state with:

- name;
- optional description;
- color;
- status: active / paused / completed / archived;
- optional target date;
- sort order;
- soft delete;
- created/updated timestamps.

Todos and Habits may optionally belong to a Project.

### Goals V1

Introduce authoritative local `goals` state with:

- optional parent Project;
- title;
- optional description;
- horizon: week / month / quarter / year / custom;
- optional target date;
- status: active / paused / completed / archived;
- manual progress percentage 0–100;
- soft delete;
- created/updated timestamps.

Todos and Habits may optionally link to a Goal. V1 goal progress remains explicit/manual; linked item counts are supporting context, not an automatic scoring engine.

### Daily Planning V1

Introduce one local plan per local calendar date.

The plan contains:

- local `date_key`;
- intention;
- up to three selected top Todo IDs;
- focus-minutes target;
- optional planning notes;
- optional end-of-day reflection;
- optional energy score 1–5;
- status: draft / committed / completed;
- timestamps and soft delete.

Missing/deleted referenced Todos are ignored safely when rendering historical plans.

### Planning Hub

Add a modal/drawer workspace reachable from Overview. Internal views:

- **Today** — daily plan and selected top priorities;
- **Projects** — project list/detail and associated Todos/Habits/Goals;
- **Goals** — goal list/detail/progress editing;
- **Progress** — cross-domain 7-day and prior-7-day summaries;
- **Timeline** — unified recent activity feed.

Do not add a seventh primary navigation tab.

### Quick Capture

Add a globally accessible quick-capture launcher/overlay.

V1 modes:

- Todo;
- Habit;
- Calorie entry;
- Project;
- Goal;
- Start Focus shortcut that navigates to the existing Focus section rather than inventing a second timer engine.

Quick Capture must call canonical existing feature data APIs for existing domains rather than bypassing their behavior.

### Activity Timeline

Build a derived read model. No new timeline persistence table.

Default window: recent 30 days, with a bounded 90-day option if straightforward.

Sources include:

- Todo completions;
- Habit completions;
- Focus sessions;
- Workout logs;
- Calorie entries, summarized appropriately rather than flooding the feed;
- Weekly Review completion;
- Daily Plan completion/reflection;
- Project/Goal creation/completion where timestamps allow deterministic representation.

Provide simple filters such as All / Productivity / Health / Planning.

### Progress Insights

Provide deterministic local cards for current 7 days versus previous 7 days:

- completed Todos;
- Habit completion/consistency facts using existing semantics;
- Focus minutes;
- Workout sessions;
- calorie-tracking days and configured goal context;
- Weekly Review completion;
- active Project/Goal counts and manual goal progress.

No AI-generated numbers or opaque composite score in V1.

## Local persistence and account safety

The implementation wave SHALL add the new authoritative local tables to the complete local user-data inventory used by account/recovery emptiness and ownership safety.

The agent must inspect the actual current local schema version and append the next migration rather than trusting stale documentation.

New local state must remain offline-first.

## Deliberate hardening debt: remote backup and portable data

During this implementation wave, `projects`, `goals`, and `daily_plans` SHALL remain local-only.

Do **not** add them to `BACKUP_ENTITIES`, Supabase remote migrations, Restore V2, or Portable Backup V1 tonight.

Reason: registering a client sync entity before a production Supabase table exists can break the existing backup queue. The follow-up hardening campaign will design, migrate, validate, and deploy remote support as one coherent operation.

The UI should not falsely claim these new entities are currently cloud-backed.

## Existing-domain association changes

Add optional `project_id` and `goal_id` associations to Todo/Habit storage where repository architecture supports the change cleanly.

Existing rows remain valid with null associations.

Existing Todo/Habit creation and editing flows should expose lightweight optional organization controls when practical; the Planning Hub may provide association editing even if every legacy form is not fully redesigned tonight.

## Non-goals

- no new Supabase production deployment;
- no full multi-device sync semantics;
- no new AI planner;
- no account model redesign;
- no notification expansion;
- no major tab/navigation redesign;
- no full calendar/time-blocking engine;
- no collaboration/team features;
- no recurring Projects/Goals engine;
- no automatic goal scoring based on inferred behavior;
- no hardening campaign inside this run.

## Minimal completion gate for this wave

The overnight implementation wave is complete when:

- the planned modules and UI surfaces are materially implemented;
- local migrations/types/data layers exist;
- new local user tables participate in account emptiness/ownership inspection;
- Planning Hub is reachable;
- Quick Capture is reachable;
- the app typechecks;
- lint has no new errors;
- OpenSpec and ExecPlan structure validate;
- `git diff --check` passes;
- all completed work is committed and pushed to `main`;
- working tree is clean;
- the final report clearly labels untested/deferred areas for hardening.

Full regression green is explicitly **not** a completion requirement for this implementation-only wave.
