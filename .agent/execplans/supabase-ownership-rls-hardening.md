# ExecPlan: Supabase ownership and RLS hardening

Plan-Version: 2
Status: COMPLETED

## Purpose

Close the cross-user backup-data vulnerability in the repository-owned
Supabase contract. Synchronized backup rows must be durably owned by a
Supabase Auth identity, protected by owner-scoped RLS, and reached by the
client only through a trusted current session identity.

## User Outcome

The four synchronized backup entities (`todos`, `habits`,
`calorie_entries`, and `workout_routines`) are isolated per authenticated
Supabase user. Unauthenticated requests have no backup CRUD access, signed-in
anonymous users are owner-scoped `authenticated` users, restore is scoped to
the current owner, and offline local writes continue to work while remote auth
or network access is unavailable. The repository, tests, migration contract,
and final `main` branch are pushed and verifiably green.

## Context

SuperHabits is local-first: SQLite is authoritative and the durable local
`sync_outbox` records remote backup intent. The production sync adapter pushes
selected local rows to Supabase; restore v1 reads only `todos`, `habits`, and
`calorie_entries`. The previous hardening change added the repository-owned
Supabase baseline and AI quota security, but explicitly deferred user-id
ownership. This follow-up is linked to
`openspec/changes/correctness-durability-security-hardening/` and is itself
specified by `openspec/changes/secure-supabase-backup-row-ownership/`.

The user-mandated main-only policy overrides the generic branch-per-task
guidance: all work stays on local `main`, no temporary branch is pushed, and
the final local `main` SHA must equal `origin/main`.

## Scope

- Read-only discovery of the linked Supabase project, current documentation,
  CLI capabilities, schema, policies, grants, auth model, functions, and data
  ownership state.
- Additive repository migration and reproducible validator updates.
- Trusted owner identity handling in sync, durable outbox boundaries, and
  owner-scoped restore.
- Adversarial two-user/anon security tests, AI security regression, advisors,
  headless QA, and available serialized native regression.
- OpenSpec, project docs, coherent commits, push, and GitHub CI verification.

## Non-Goals

- Full symmetric multi-device synchronization or conflict resolution.
- Arbitrary legacy-row claiming or speculative production backfill.
- Destructive remote reset, force-push, production truncation, or unrelated
  product work.

## Current Checkpoint

- Current Milestone: Campaign complete; repository work is pushed on `main`, the first delivery SHA's required GitHub CI is green, and the final closure commit records the completed plan and residual blockers.
- Completed: Main-only baseline; required repository and skill guidance; official Supabase documentation/changelog and pinned CLI capability review; authenticated read-only discovery of project `kruubbynsmxzxfdunaal`; focused OpenSpec artifacts; append-only remote ownership migration; SQLite outbox owner binding; trusted auth-scoped sync/restore; schema validator; disposable-policy repository harness; focused and full tests; web/sync E2E; deterministic simulation; Expo health; live read-only advisors; serialized native attempt with exact blocker recorded.
- In Progress: None. The final closure commit records this completed state; its GitHub CI run is the final transport verification.
- Important Modified Files: `supabase/migrations/20260814160000_secure_sync_row_ownership.sql`; `core/sync/`; `lib/supabase.ts`; `core/db/client.ts`; `scripts/validate-supabase-schema.mjs`; `simulation/backend/`; focused OpenSpec artifacts; security tests.
- Last Successful Validation: `npm test` passed with 79 files and 793 tests; `npm run typecheck`, `npm run lint`, schema/OpenSpec/plan validators, all required headless QA, and the focused 46-test ownership boundary rerun passed. `npm run e2e:sync` passed 15 with 4 intentional restore skips; `npm run e2e:full` passed 153 with 17 intentional skips; deterministic simulation passed 17/17; Expo Doctor passed 19/19.
- Current Failures: Android Maestro smoke failed because the current debug APK displayed React Native's `Unable to load script` redbox after cold launch; a current-source release build exceeded the 20-minute environment timeout. Direct `supabase` is not on PATH; pinned `npx --no-install supabase` is `2.113.0`. Docker/Podman is unavailable, so real disposable Postgres RLS execution is not available. Live deployed Edge Functions/quota objects remain stale/absent relative to the repository.
- Relevant Quarantines: No live write occurred. Discovery found 126/126 live sync rows owned and mapped to 9 existing anonymous Auth users, so no backfill was performed. Future NULL rows remain inaccessible/quarantined by the repository migration. Production adversarial writes remain prohibited.
- Blockers: Remote migration history is inconsistent with the repository (only `20260810130000` is recorded remotely while the repository baseline/quota migrations are absent); the linked schema was provisioned separately. No supported disposable SQL target is available. These facts block a safe live apply in this session. Native QA depends on current emulator/build tooling; GitHub CI access must be verified after push.
- Condition Required to Unblock: A reviewed migration path compatible with the live schema/history, an approved authenticated apply/recovery path, and disposable or dedicated Postgres RLS execution evidence. Live AI security requires deploying/verifying the current repository Edge Functions and quota objects separately.
- Exact Resume Action After Unblock: Re-run the serialized Android campaign only after a current-source bundle can be attached to the emulator; no repository change is indicated by the current redbox artifact.
- Exact Next Action: None — task complete; only the normal post-push transport verification is being recorded for this closure commit.
- Remaining Definition of Done: Complete; the ownership implementation, OpenSpec tasks, migration classification, first delivery push, and required CI result are recorded.

## Current Git State

- Initial inspection: clean worktree on `main`.
- Local branches: `main` only.
- Remote-tracking branches: `origin/main` plus symbolic `origin/HEAD`.
- Worktree: `C:/Users/Michael Roy/Documents/super-habits` on `main`.
- Initial `HEAD`, `main`, and `origin/main`: `bf4fb43290fefe64ebc42772dc94cb75df47b22d`.
- `git ls-remote --heads origin`: `refs/heads/main` only.
- `git fetch origin --prune`: completed without changing the observed state.

## Live Backend Discovery

- Status: completed read-only; no remote write has occurred.
- Project reference: `kruubbynsmxzxfdunaal` (`superhabits`), region
  `ap-northeast-1`, status `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.104`.
- CLI/auth state: direct `supabase` is not installed on PATH; pinned
  `npx --no-install supabase` is `2.113.0` and exposes `db query`,
  `db advisors`, `migration new/list/up`, and linked-project commands. The
  Supabase connector has authenticated read access. Local `supabase status`
  cannot run because Docker/Podman is unavailable.
- Migration history: linked project reports only
  `20260810130000 add_habits_rule_history`; repository migrations
  `20260814140000_sync_schema_baseline.sql` and
  `20260814150000_ai_request_quota.sql` are not recorded remotely.
- Tables/ownership: `public.todos` 92 rows, `public.habits` 13,
  `public.calorie_entries` 21, and `public.workout_routines` 0 at discovery.
  Each has `id TEXT PRIMARY KEY`, `user_id UUID NOT NULL DEFAULT auth.uid()`;
  there are no owner indexes or foreign keys in the inspected constraint/index
  result. All 126 observed rows have non-null owners and each owner maps to an
  existing `auth.users` record; the union has 9 distinct owners, all 634
  observed Auth users are anonymous users.
- RLS/policies: RLS is enabled and `FORCE ROW LEVEL SECURITY` is false on all
  four tables. Each table has one permissive `FOR ALL TO {public}` policy with
  an owner qualifier equivalent to `(auth.uid() = user_id)` and no explicit
  `WITH CHECK`; there are no separate operation policies.
- Grants/ACL: every sync table ACL grants `arwdDxtm` to `anon`,
  `authenticated`, and `service_role`; information-schema grants include
  full CRUD plus non-DML privileges for `anon`. Public default ACLs also grant
  table privileges to `anon`, `authenticated`, and `service_role`.
- Auth/Edge Functions: anonymous sign-ins are proven active by 634 existing
  anonymous Auth users. Deployed `parse-ai-command` (v2) and `user-ai-ask`
  (v5) have `verify_jwt: true`, but their deployed source does not contain the
  repository’s explicit bearer validation/quota calls; the live project has no
  `public.ai_request_quota` table or `consume_ai_request_quota` function.
- Remote modification: none performed. All discovery used metadata or
  read-only SQL.

## Existing Schema

- Repository baseline migration `supabase/migrations/20260814140000_sync_schema_baseline.sql`
  owns the four backup tables and currently models rows without `user_id`.
- Live tables already contain `user_id UUID NOT NULL DEFAULT auth.uid()` but
  are not represented by the repository baseline migration; this is schema
  drift, not evidence that the baseline was safely applied.
- Live tables retain global `id` primary keys, have no observed owner indexes
  or FKs, and contain no NULL-owner legacy rows at discovery.
- The durable SQLite outbox is local schema version 14; any local ownership
  boundary must be appended as migration 15 if required by the final design.

## Existing RLS

- Repository baseline still contains permissive global `anon` and
  `authenticated` policies; the final repository contract must remove that
  unsafe effective state through the reviewed migration/baseline strategy.
- Live policy names are `Manage own calorie entries`, `Manage own habits`,
  `Manage own todos`, and `Manage own workout routines`; each is `FOR ALL` to
  `public` with `(auth.uid() = user_id)` and implicit check behavior.
- The final contract must remove all public/anon policies and retain RLS with
  explicit `TO authenticated` SELECT/INSERT/UPDATE/DELETE policies using
  `((select auth.uid()) = user_id)`, including explicit UPDATE `WITH CHECK`.

## Existing Grants

- Repository baseline currently grants backup CRUD to `anon` and
  `authenticated`; live ACL/default ACL inspection confirms the same broad
  grant shape. Final intent: `authenticated` gets only required table
  privileges for the Data API; `anon` gets no backup table CRUD; `service_role`
  remains an explicit server-side owner/bypass role; AI quota remains
  service-role-only in the repository contract.

## Existing User/Auth Situation

- The client calls anonymous Supabase sign-in when public Supabase variables
  are configured; signed-in anonymous sessions use the `authenticated`
  database role and must be owner-scoped by `auth.uid()`.
- Anonymous Auth is demonstrably enabled in the linked project: 634 Auth
  users exist and all observed users have `is_anonymous = true`, spanning
  2026-04-06 through 2026-08-12. This is multi-user usage, not a single-user
  backup dataset.

## Existing Data Ownership Situation

- Repository baseline has no ownership column on synced rows.
- Live ownership is already present and fully mapped at discovery: 92 todos,
  13 habits, 21 calorie entries, and 0 workout routines have no NULL owners;
  all owner UUIDs join to existing Auth users, with 9 distinct owners. No
  backfill was performed or is currently required. Any future/unseen NULL
  rows remain inaccessible under owner-scoped RLS and are not claimable by a
  normal client.

## Migration Strategy

1. Complete documentation/CLI/live discovery and record evidence here.
2. Use the current Supabase CLI migration-creation workflow for a new additive
   migration; do not edit the existing baseline or invent a timestamp.
3. Add durable UUID ownership to all four sync tables, preserving the global
   `id` primary key unless evidence proves a safer compatible conflict change.
4. Add owner indexes (and only query-supported compound indexes), remove old
   permissive policies, enable/retain RLS, and create explicit owner-scoped
   SELECT/INSERT/UPDATE/DELETE policies.
5. Grant only the roles required by the authenticated Data API; revoke backup
   CRUD from `anon`; preserve AI quota function/table restrictions.
6. Apply remotely only if the documented safety gate is fully satisfied;
   otherwise ship the repository contract and classify live deployment as
   blocked/credential-required without claiming production verification.

## Legacy Data Strategy

- Never blanket-backfill all NULL owners to the current session.
- If every row has an evidence-backed owner mapping, document and apply only
  that mapping through an explicitly reviewed operator migration.
- If ownership is ambiguous, leave rows unowned and inaccessible through
  normal client RLS. Do not add an IDOR-style public claim RPC.
- Enforce `NOT NULL` only after all rows are provably owned; otherwise retain a
  nullable quarantine state and make the unresolved deployment condition
  visible.

## Client Sync Changes

- Obtain the current authenticated user through the supported Supabase session
  API and fail closed when no valid UID is available.
- Derive `user_id` in the adapter from trusted auth state; sanitize/ignore any
  caller/local-row override.
- Preserve soft-delete tombstone pushes, revision ordering, partial failure,
  enqueue-during-flush, and retry semantics.
- Decide from current outbox/auth semantics whether owner UID must be persisted
  with each durable sync intent; if so append local migration 15 and reject
  cross-session flushes rather than reassigning pending local data.

## Restore Changes

- Require a current authenticated UID before remote restore/preview.
- Add explicit `.eq('user_id', currentUser.id)` filters for every synced-table
  read, while relying on RLS as the authoritative defense.
- Keep restore v1 limited to its existing entity set and empty-device safety
  rules; malformed or failed remote data must not damage valid local state.
- Do not present an owner-scoped zero-row result as an unqualified successful
  restore when remote/auth context is unavailable.

## Security Test Matrix

- Static migration/validator checks for ownership columns, RLS, indexes,
  grants, exact owner predicates, update `WITH CHECK`, and absence of global
  `anon`/`USING (true)` policies.
- Disposable/local SQL harness where available: User A and User B CRUD and
  collision/upsert isolation on `todos`, plus cross-entity checks on all four
  tables; unauthenticated `anon` denied; signed-in anonymous `authenticated`
  user allowed only its own rows.
- Client adapter tests: trusted UID payload injection, override rejection,
  missing-auth durable retry, wrong-user fail-closed, session switching,
  logout, refresh, RLS rejection retry behavior, tombstones, and restore
  owner filters.
- Re-run AI auth/quota/provider-suppression and service-role grant/secret
  non-leak tests.

## Native QA Matrix

- Verify current AVD/SDK/tool availability before use; do not create a second
  emulator or run parallel Maestro sessions.
- If available, build/install current source once and serialize smoke,
  todo/habit/schedule/reminder persistence, reminder mark-complete replay,
  snooze, Pomodoro lifecycle/isolation, Habit Insights, and deterministic
  Settings backup/sync UI flows.
- If unavailable, record `ENVIRONMENT` or `CREDENTIAL_REQUIRED` precisely and
  keep Android status partial/blocked rather than fabricating a pass.

## Progress

- [x] Read repository guidance, Supabase/project skills, and completed
      hardening OpenSpec context.
- [x] Recover and baseline main-only Git topology.
- [x] Create focused OpenSpec change directory.
- [x] Complete current Supabase docs/changelog and CLI capability review.
- [x] Complete read-only linked-project discovery and ownership assessment.
- [x] Write/validate focused OpenSpec proposal/spec/design/tasks.
- [x] Implement additive migration, client owner boundary, restore scope, and
      repository validator/tests.
- [x] Run repository security harness and live read-only advisors; record the
      unavailable disposable Postgres environment.
- [x] Run full headless/native QA and final security sweep; native Android
      remains partial because the current debug bundle could not attach to
      Metro and the release build timed out.
- [x] Commit, push main, verify CI, and close this plan; the first delivery SHA `8f0fd3fe54eed8a00ce3e24a56ad91ae8d00a3cd` has a successful GitHub CI run.

## Surprises & Discoveries

- The previous hardening OpenSpec change is complete and explicitly lists
  user-id retrofit as a non-goal; ownership is therefore a focused follow-up.
- The repository’s local `supabase/config.toml` has anonymous sign-ins
  disabled by default even though the app bootstrap supports anonymous auth;
  the linked project must be checked rather than inferred from local config.

## Decision Log

- 2026-08-14 — Stay on `main` — User supplied a mandatory main-only policy that
  overrides the generic branch-per-task workflow.
- 2026-08-14 — Create `secure-supabase-backup-row-ownership` — The prior
  correctness/durability/security change is complete; reopening it would blur
  finished history and its design explicitly deferred ownership.
- 2026-08-14 — Preserve global `id` primary keys provisionally — This is the
  least disruptive conflict strategy until live constraints and client query
  semantics are verified; RLS remains the authorization boundary.
- 2026-08-14 — No legacy blanket backfill — Ownership cannot be inferred from
  a current session and ambiguous rows must be quarantined.
- 2026-08-14 — Preserve the global `id` primary key and keep `onConflict: id`
  — IDs are installation-generated and globally random; RLS blocks a known-ID
  cross-owner collision while avoiding a destructive primary-key transition.
- 2026-08-14 — Persist `owner_user_id` in the local outbox — A pending local
  mutation must not be rebound to a different Auth session after logout/login.
  Existing ownerless outbox rows fail closed rather than being silently
  assigned to the current user.
- 2026-08-14 — Do not apply the live migration — all observed rows are owned,
  but remote migration history/schema provenance is inconsistent, disposable
  SQL execution is unavailable, and the live quota/Edge Function deployment
  does not match the repository security contract. A remote write would not
  meet the user’s safety gate.
- 2026-08-14 — Normalize the CLI-created migration filename to
  `20260814160000_secure_sync_row_ownership.sql` — `supabase migration new`
  was used as required, but its generated UTC name sorted before the existing
  future-dated repository migrations; the filename was placed at the next
  append-only lexical slot so fresh replay remains ordered. No old migration
  was edited.

## Validation Ledger

- 2026-08-14 — Git status/branches/worktrees/remotes/log/remote-head inspection — PASS; clean `main`, only `origin/main`, local and remote at the same initial SHA.
- 2026-08-14 — `git fetch origin --prune` — PASS; no unexpected remote changes.
- 2026-08-14 — `openspec status/instructions` for completed hardening change — PASS; 26/26 tasks complete.
- 2026-08-14 — `openspec new change secure-supabase-backup-row-ownership` — PASS; focused spec-driven change created.
- 2026-08-14 — `npm run qa:affected` — PASS; required impact gates identified as `qa:fast`, `qa:full`, `qa:integration`, journey/sync, and deterministic simulation lanes.
- 2026-08-14 — Read-only Supabase discovery — PASS; ref `kruubbynsmxzxfdunaal`, 126 owned sync rows across four tables, 9 owners, all 634 observed Auth users anonymous; unsafe public/anon grants and policies remain live; no remote write.
- 2026-08-14 — `npx --no-install supabase --version` and CLI help — PASS; version `2.113.0`; `db advisors` supports linked security/performance inspection; local status unavailable because Docker/Podman is absent.
- 2026-08-14 — Official Supabase RLS, anonymous Auth, API security, JWT, CLI, and breaking-change guidance — PASS; recorded in the discovery/decision sections and final report with official links.
- 2026-08-14 — `npm run supabase:schema:validate` — PASS; secure four-table ownership/RLS/grant/index contract and AI quota contract detected.
- 2026-08-14 — Focused sync/restore/migration/outbox Vitest run — PASS; 5 files, 46 tests after the final E2E harness change.
- 2026-08-14 — Disposable/local RLS execution — ENVIRONMENT; Docker/Podman/psql unavailable; repository policy harness added instead and does not claim live Postgres proof.
- 2026-08-14 — `npm ci` — PASS; 1,138 packages installed; audit baseline is 16 vulnerabilities (6 moderate, 10 high, 0 critical).
- 2026-08-14 — `npm run typecheck` — PASS; zero TypeScript errors.
- 2026-08-14 — `npm run lint` — PASS; zero errors and zero warnings after restoring the changed journey files' repository line endings.
- 2026-08-14 — `npm test` — PASS; 79 files, 793 tests.
- 2026-08-14 — `npm run qa:fast` — PASS; 62 files, 702 unit tests.
- 2026-08-14 — `npm run qa:integration` — PASS; 17 files, 91 tests.
- 2026-08-14 — `npm run qa:timezones` — PASS in five time zones; 42 tests per zone.
- 2026-08-14 — `npm run validate:themes` — PASS; 140 checks.
- 2026-08-14 — `npm run qa:impact:validate` and `npm run agent:plan:validate:all` — PASS; 12 impact rules and all plans validated.
- 2026-08-14 — `npm run build:web` and `npm run build:sync` — PASS; sync build used dummy Supabase values and contained no real credentials.
- 2026-08-14 — `npm run e2e:sync` — PASS; 15 passed, 4 intentional restore-data skips, 0 failures. The deterministic dummy Auth helper supplies a signed-in anonymous `authenticated` identity and the reconnect assertions verify payload owner IDs.
- 2026-08-14 — `npm run e2e:full` — PASS; 153 passed and 17 intentional skips after the web build.
- 2026-08-14 — `npm run qa:simulation -- --all --mode deterministic` — PASS; 17/17 scenarios.
- 2026-08-14 — `npx expo-doctor` — PASS; 19/19 checks.
- 2026-08-14 — `npm audit` and `npm audit --omit=dev` — EXPECTED ADVISORY EXIT; both report 0 low, 6 moderate, 10 high, 0 critical. No forced remediation was attempted.
- 2026-08-14 — Live Supabase security/performance advisors — PASS read-only collection; security warns on current live anonymous policies for all four sync tables and leaked-password protection; performance warns on existing live `auth.uid()` init-plan policies. These are expected evidence of the unmodified vulnerable live state and are not claimed resolved.
- 2026-08-14 — Android native preflight — PARTIAL/ENVIRONMENT; `Nitro_API_36` booted on `emulator-5554`, current debug APK installed, but `npm run qa:native:android` and a direct Maestro smoke both failed on the missing Metro bundle redbox. Current-source release build timed out after 1,204 seconds; persistence flows were not claimed.
- 2026-08-14 — First delivery commit `8f0fd3fe54eed8a00ce3e24a56ad91ae8d00a3cd` pushed to `origin/main` — PASS; local `main`, `origin/main`, and the only remote branch matched. GitHub CI run `31764346998` completed successfully: quality passed, main e2e passed, nightly skipped by event.

## Changed Files / Areas

- `.agent/execplans/supabase-ownership-rls-hardening.md` — durable state for
  this campaign.
- `openspec/changes/secure-supabase-backup-row-ownership/` — focused normative
  proposal/spec/design/tasks.
- `AGENTS.md`, `docs/PROJECT_STRUCTURE_MAP.md`,
  `docs/knowledge-base/PROJECT_STRUCTURE_MAP.md`,
  `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`,
  `docs/master-context.md`, `docs/master-context/SUPERHABITS_PROJECT_CORE_CONTEXT.md`,
  and `docs/working-rules.md` — schema-version and ownership-boundary guidance.
- `supabase/migrations/20260814160000_secure_sync_row_ownership.sql` —
  append-only owner column/index/FK/RLS/grant migration.
- `core/sync/`, `lib/supabase.ts`, `core/db/` — trusted auth owner boundary,
  durable outbox owner binding, restore filters, and local schema v15.
- `e2e/helpers/supabaseAuth.ts`, `e2e/journeys/bad-backend.spec.ts`, and
  `e2e/journeys/the-commute.spec.ts` — deterministic signed-in anonymous test
  identity and owner-aware sync journey assertions.
- `scripts/validate-supabase-schema.mjs`, `simulation/backend/`, and security
  tests — reproducibility contract and adversarial repository/disposable
  policy model.
- `supabase/README.md`, `tests/db.client.test.ts`,
  `tests/integration/fixtures.test.ts`, `tests/integration/migrations.test.ts`,
  `tests/integration/restore.test.ts`, `tests/integration/syncOutbox.test.ts`,
  `tests/restore.coordinator.test.ts`, and `tests/supabaseOwnership.test.ts` —
  migration, restore, outbox, and adversarial security coverage.

## Blockers

- Live read access is available through the Supabase connector, but the direct
  CLI is not on PATH and the local CLI has no Docker/Podman target.
- The linked project’s migration history does not contain the repository
  baseline/quota migrations even though the live tables exist; no supported,
  non-destructive reconciliation/apply path was proven.
- Live deployed AI functions are stale and the live quota table/RPC are absent;
  repository AI security remains separately validated, but live AI security is
  not claimed.
- No remote migration is authorized until these conditions are resolved.

## Exact Next Action

Rerun the exact affected/full QA commands, inspect current native tooling and
read-only Supabase advisors, then update OpenSpec/tasks and this plan with
results before committing and pushing `main`.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan completely.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`, and
   `npm run agent:resume -- --plan .agent/execplans/supabase-ownership-rls-hardening.md`.
3. Reconcile the checkpoint with Git; Git wins over stale prose.
4. Read the focused OpenSpec artifacts and use their current Exact next action.
5. Do not apply a remote migration until discovery, legacy mapping, tests,
   advisors, and the remote safety gate are all recorded as satisfied.

## Outcomes

- Status: Completed; repository ownership hardening, tests, documentation,
  OpenSpec, and delivery are complete. No live migration has been claimed.
- Residual classifications: live ownership migration is blocked by schema /
  migration-history drift and stale deployed AI objects; Android coverage is
  partial because the current debug bundle could not attach to Metro and the
  release build timed out; the final closure SHA's CI run remains the last
  post-closure verification action.
