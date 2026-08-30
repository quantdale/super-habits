# SuperHabits — Canonical Next-Campaign Execution Prompt

**Status:** ACTIVE
**Current campaign:** `.agent/execplans/production-gym-convergence-and-real-world-certification-v1.md`
**Planned-from:** `2a13a3181aafe87689ebe291f9e34b549745f22f`
**Target branch:** `main`

The previously referenced async/lifecycle campaign is completed in this
checkout. Its final state is recorded in
`openspec/changes/harden-async-orchestration-lifecycle-v1/execplan.md` and its
historical artifacts; do not resume it as an active campaign.

The current campaign reconciles the clean-room OpenGym design record with the
production Gym V2 Workout implementation. Read the campaign ExecPlan and
`AGENTS.md` before acting. Its completion gates are evidence-led:

- one canonical real-data Gym and no discoverable fake prototype route;
- accurate current-facing documentation and OpenSpec lifecycle state;
- focused and broad repository QA, browser/P0/simulation/recovery evidence;
- Android evidence when a repository-valid API-36 x86_64 target exists, with
  unavailable lanes classified honestly;
- clean exact pushed `main` and recorded remote/CI result.

Do not copy OpenGym AGPL source, assets, or datasets. Preserve SQLite,
soft-delete, sync/outbox, owner-binding, backup/restore, ID, date-key, and
single-page shell invariants. Do not create a second Gym state or persistence
stack. External Supabase, iOS, or CI access limitations must remain explicit.
