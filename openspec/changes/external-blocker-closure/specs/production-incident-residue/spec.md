## Purpose

Defines read-only classification and owner-gated cleanup of incident residue in the one authorized production Supabase project.

## ADDED Requirements

### Requirement: Production residue cleanup stays read-only until approved

Investigation MUST be limited to project name `superhabits` and project id `kruubbynsmxzxfdunaal`. It MUST start read-only and MUST classify every candidate as `CONFIRMED_SYNTHETIC`, `PROBABLE_SYNTHETIC`, `AMBIGUOUS`, or `LEGITIMATE_OR_UNRELATED`, recording table, primary key, owning user id, timestamps, synthetic fingerprints, incident-log correlation, relationships, and confidence. A cleanup proposal MUST include only `CONFIRMED_SYNTHETIC` incident records and MUST state foreign-key, backup-manifest, authentication, and ownership effects. The campaign MUST NOT delete a row only because it is recent, anonymous, empty, or has a testing-looking email. Production deletion MUST remain `OWNER_APPROVAL_REQUIRED` until the owner approves the specific targets and procedure. The campaign MUST re-run the hermetic E2E build guard, embedded-host rejection, credential-leak detection, runtime static-server protection, and dummy-host separation. A demonstrated bypass MUST be fixed with a regression test. The campaign MUST NOT repeat the production-drain experiment against the live project.

#### Scenario: A creation date is not proof

- **WHEN** an account was created on 2026-09-24 and has no incident fingerprint
- **THEN** it is not classified `CONFIRMED_SYNTHETIC` from the date alone

#### Scenario: Another Supabase project is in scope

- **WHEN** a query would target a project other than `kruubbynsmxzxfdunaal`
- **THEN** the campaign does not run that query

#### Scenario: The owner has not approved deletion

- **WHEN** the read-only investigation is finished and the owner has not approved the exact targets and procedure
- **THEN** deletion stays `OWNER_APPROVAL_REQUIRED`
- **AND** no production delete is executed

#### Scenario: A hermetic bypass is demonstrated

- **WHEN** a test export or static server is shown to embed a live Supabase host
- **THEN** the bypass is fixed with a regression test
- **AND** the fix is not validated by draining the production project
