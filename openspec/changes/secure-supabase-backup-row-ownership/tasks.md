## 1. Contract and migration

- [x] 1.1 Generate the append-only Supabase ownership migration with the pinned CLI and review it against repository and live schema evidence.
- [x] 1.2 Implement UUID owner columns/compatibility checks, owner indexes, legacy quarantine, explicit RLS policies, and safe grants for all four sync tables.
- [x] 1.3 Append SQLite migration 15 for nullable durable outbox owner bindings and update the reference schema snapshot/tests.
- [x] 1.4 Extend the Supabase schema validator to enforce owner columns, indexes, RLS predicates, update checks, grants, no anon backup CRUD, and preserved AI quota security.

## 2. Trusted client boundary

- [x] 2.1 Add current-session UID helpers with fail-closed remote semantics and preserve anonymous sign-in/local-first behavior.
- [x] 2.2 Capture enqueue-time owner bindings, prevent rebinding across sessions, and preserve outbox revision/partial-failure semantics.
- [x] 2.3 Add verified owner payload injection and mismatch/no-auth retry behavior to the Supabase sync adapter, including tombstones and caller override rejection.
- [x] 2.4 Add owner filters and session-change checks to restore metadata and row reads without weakening empty-device or transaction safety.

## 3. Security tests and documentation

- [x] 3.1 Add client sync/outbox adversarial tests for owner injection, missing auth, wrong owner, refresh, logout/session switching, and RLS retry behavior.
- [x] 3.2 Add restore owner-filter tests and migration/integration assertions for the durable owner boundary.
- [x] 3.3 Add repository SQL/static security checks and disposable/local two-user RLS coverage where the environment supports it; preserve an explicit environment result when it does not.
- [x] 3.4 Re-run AI auth/quota/provider-suppression tests and verify service-role credentials are absent from client source/bundles.
- [x] 3.5 Update Supabase/backup documentation and complete the OpenSpec delta validation.

## 4. Full validation and delivery

- [x] 4.1 Run affected, integration, timezone, web build, sync build, E2E, simulation, Expo, audit, and schema/OpenSpec/plan gates; classify failures.
- [x] 4.2 Inspect and run the available serialized Android/native regression campaign; record exact environment blockers if unavailable.
- [x] 4.3 Decide and document the live migration gate from fresh read-only evidence; apply only if all required safety conditions are met and re-verify.
- [x] 4.4 Commit coherent changes on main, reconcile origin/main, push without force, verify branch topology and SHA equality, and inspect final GitHub CI.
- [x] 4.5 Update the ExecPlan with final evidence, classification, remaining gaps, and COMPLETED status only after the definition of done is met.
