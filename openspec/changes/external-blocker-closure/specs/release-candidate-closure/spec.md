## ADDED Requirements

### Requirement: Store submission waits for authorization and a fresh inventory

The campaign MUST re-audit the current release documents and MUST NOT copy a historical placeholder count forward as the inventory. It MUST close repository-executable documentation and guard drift. It MUST list each remaining owner action with the source document and the information required, covering support email, hosted privacy-policy URL, real screenshots, feature graphics, store descriptions, release notes, DSA or trader declarations, privacy disclosures, platform signing, EAS submission credentials, store-console configuration, version and build consistency, and final release authorization. A screenshot MUST come from a genuine build. The campaign MUST NOT create a `v1.0.0` tag and MUST NOT submit to either store until release authorization is explicit. When owner inputs are absent, the result MUST be a ready-to-complete package whose residuals are owner actions, not a shipped release.

#### Scenario: An older placeholder count is stale

- **WHEN** the current release files do not match an older count of unresolved placeholders
- **THEN** the owner-action list is rebuilt from the current files

#### Scenario: An image is not from a device build

- **WHEN** an image was not captured from a genuine build
- **THEN** it is not presented as store screenshot evidence

#### Scenario: Release authorization is absent

- **WHEN** release authorization has not been given
- **THEN** no `v1.0.0` tag is created and neither store receives a submission
