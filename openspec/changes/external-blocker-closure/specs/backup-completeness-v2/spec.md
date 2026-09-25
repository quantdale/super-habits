## ADDED Requirements

### Requirement: Manifest-window behavior stays fail-closed pending an owner decision

Until the owner records a decision, restore MUST keep failing closed when remote rows or settings outrun the published manifest. The campaign MUST NOT invent a degraded-restore or best-effort import policy for that window. The decision record MUST ask the owner to choose among keeping fail-closed behavior, adding manifest generation history, or defining an explicit degraded mode. The campaign MUST NOT implement full bidirectional sync. It MUST preserve local SQLite authority, one-way remote backup, Restore V2, portable backup, and account recovery. It MUST NOT lower the J8 section-switch ceiling or the D14 diary-search ceiling. A dependency upgrade that needs a breaking override MUST NOT be applied from a stale audit without a fresh review.

#### Scenario: Remote data outruns the manifest

- **WHEN** remote data is a strict superset of the published manifest and no owner decision exists
- **THEN** restore returns an invalid result and leaves local data unchanged

#### Scenario: Bidirectional sync is proposed

- **WHEN** a change would accept remote edits as a second source of truth
- **THEN** this closure does not implement that sync

#### Scenario: A ceiling fails under host load

- **WHEN** a J8 or D14 ceiling fails and no product defect in the measured path is demonstrated
- **THEN** the ceiling value stays unchanged
