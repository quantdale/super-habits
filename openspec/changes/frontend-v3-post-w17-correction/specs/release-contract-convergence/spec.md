## MODIFIED Requirements

### Requirement: Current runtime metadata is canonical

The release candidate SHALL describe local schema version 25 and next append-only migration slot 26, current Backup Scope 7, and the independently versioned backup schema consistently anywhere current behavior is documented or validated. Historical records of earlier schema versions SHALL remain historical and SHALL NOT be rewritten as if migration 25 had not shipped.

#### Scenario: Current contract is audited

- **WHEN** a release audit searches runtime maps, QA guidance, backup validators, and commonly-read documentation
- **THEN** current-runtime statements identify schema 25, migration 26 as the next slot, and Scope 7 without rewriting historical compatibility records

#### Scenario: A dated pre-migration note stays dated

- **WHEN** a document explicitly describes the schema that existed before migration 25
- **THEN** that historical statement may still name schema 24
- **AND** it is not presented as the current runtime contract
