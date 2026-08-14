## MODIFIED Requirements

### Requirement: Authentication and authorization scope statement

Because the application uses anonymous Supabase authentication, the testing
model SHALL distinguish the unauthenticated PostgreSQL `anon` role from a
signed-in anonymous Auth user evaluated as `authenticated`. It SHALL cover
client session bootstrap and the server-side owner-isolation contract for
Supabase backup tables rather than treating authorization as out of scope.

#### Scenario: Anonymous session bootstrap is covered

- **WHEN** the app bootstraps with Supabase configured
- **THEN** an anonymous session is established or the failure is handled
  without blocking local-first use, and the app remains fully functional when
  Supabase is unconfigured.

#### Scenario: Unauthenticated role has no backup access

- **WHEN** the security harness evaluates backup-table CRUD as PostgreSQL role
  `anon` without a signed-in Auth session
- **THEN** SELECT, INSERT, UPDATE, and DELETE are denied for every synchronized
  backup table.

#### Scenario: Authorization is documented as out of scope, not skipped

- **WHEN** the testing model is reviewed for auth coverage
- **THEN** it documents the client session bootstrap plus the server-side RLS
  and grant boundary, and points to the two-user/anonymous-role security
  harness rather than treating authorization as an untestable out-of-repo
  concern.

#### Scenario: Two-user owner isolation is covered

- **WHEN** the security harness evaluates two signed-in anonymous Auth users
  against each other's todos, habits, calorie entries, and workout routines
- **THEN** each user can CRUD its own rows but cannot read, mutate, claim, or
  upsert over the other user's rows, and changing `user_id` is rejected.

#### Scenario: Client owner/session boundaries are covered

- **WHEN** the client has a pending outbox record, no valid session, a refreshed
  session, or a different authenticated session
- **THEN** ownership is derived from the trusted current identity, missing or
  mismatched identity fails closed, the durable outbox remains pending, and
  local-first writes are not blocked by remote availability.
