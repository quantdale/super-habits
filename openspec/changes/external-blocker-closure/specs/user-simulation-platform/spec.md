## ADDED Requirements

### Requirement: Disposable certification is write-gated and unpaid

Before any write-capable disposable-backend step, the campaign MUST prove the resolved project is disposable and is not production project `kruubbynsmxzxfdunaal`. A failed isolation check MUST abort schema apply, function deploy, and data tests. The campaign MUST NOT create a paid project, enable billable branching, or purchase network services without prior cost approval. It MUST report only whether `SUPABASE_ACCESS_TOKEN` is configured and MUST NOT print or log the token. Reuse of an existing project MUST re-check that project's name for the disposable marker before writes. The campaign MUST NOT invent a hostname or silently replace the target project. Mock-backed or static-test success MUST NOT be reported as disposable-backend certification. When no safe authorized route exists, the campaign MUST leave a credential-setup runbook and MUST continue the other workstreams.

#### Scenario: A reused project lacks the disposable marker

- **WHEN** a reused project name does not contain the disposable marker
- **THEN** schema apply and later writes abort

#### Scenario: Isolation fails

- **WHEN** the target host matches the production host or ambient production client credentials are present
- **THEN** the write-capable lane aborts
- **AND** no disposable certification pass is recorded

#### Scenario: Only local tests passed

- **WHEN** repository unit tests pass and the disposable project received no write
- **THEN** the disposable workstream is not certified

#### Scenario: Token presence is checked

- **WHEN** the operator checks `SUPABASE_ACCESS_TOKEN`
- **THEN** the report states only whether it is present
