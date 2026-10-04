## Purpose

Keeps agent-facing repository guidance and reference snapshots truthful by deriving every pin they assert from executing source, so a stale instruction can never silently steer an automated session into an unsafe command or a false product claim.

## ADDED Requirements

### Requirement: Playwright lanes are only served from a hermetic export

Every agent-facing document that instructs a Playwright run SHALL name `npm run build:e2e` as the export step that produces the served `dist/`. No agent-facing document SHALL instruct `npm run build:web` before a Playwright lane, because that export inlines ambient `EXPO_PUBLIC_*` values from the developer environment, including live Supabase credentials.

#### Scenario: A document instructs the unsafe export

- **WHEN** any agent-facing guidance file instructs `build:web` before a Playwright or E2E command
- **THEN** the guidance-truth guard fails and the drift is visible in `qa:fast`

#### Scenario: The hermetic export is named

- **WHEN** guidance describes how to produce `dist/` for E2E
- **THEN** it names `build:e2e` and does not offer `build:web` as an equivalent

### Requirement: The AI rollout default is stated only as implemented

Guidance that describes the Command Center Ask/Auto surfaces SHALL state that they are hidden by default and revealed only when `EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT` is set at build time. Guidance SHALL NOT assert that the experiment is currently enabled, and SHALL NOT assert an enablement date or a deployed-rollout fact that the code and its tests do not support. The flag SHALL appear in every environment-variable list that documents the Command Center remote-parser path.

#### Scenario: Guidance claims an enabled experiment

- **WHEN** guidance asserts the Ask/Auto experiment is currently enabled
- **THEN** the guidance-truth guard fails, because the implementation constant is false by default and locked by a unit test

#### Scenario: The gating flag is documented

- **WHEN** an operator reads the Command Center env-var list
- **THEN** `EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT` is listed with its default-off effect

### Requirement: The reference schema snapshot declares the runtime schema version

The hand-maintained `core/db/schema.sql` header SHALL declare the same maximum schema version that the runtime migration chain in `core/db/client.ts` reaches. The header SHALL also state plainly that the snapshot's own version can lag the runtime, so a reader does not mistake the file for an authority.

#### Scenario: The snapshot lags the runtime

- **WHEN** the runtime migration chain reaches a version higher than the snapshot header declares
- **THEN** the guidance-truth guard fails

### Requirement: Bootstrap order is described as implemented

Guidance that describes the provider bootstrap sequence SHALL state that the durable sync outbox is hydrated before account ownership is reconciled, and SHALL NOT state that anonymous session creation is unconditional when Supabase environment values are present.

#### Scenario: Guidance inverts the order

- **WHEN** guidance claims ownership reconciliation precedes outbox hydration
- **THEN** the guidance-truth guard fails

#### Scenario: Anonymous session creation is conditional

- **WHEN** guidance describes when an anonymous Supabase session is created
- **THEN** it states the empty-or-unbound-dataset precondition

### Requirement: Lint warning tolerance is stated as configured

Every agent-facing document that describes `npm run lint` SHALL state the `--max-warnings` value that `package.json` actually configures, and SHALL NOT describe warnings as tolerated when the configured cap is zero.

#### Scenario: A document claims a nonzero cap

- **WHEN** a document states a warning cap different from `package.json`
- **THEN** the guidance-truth guard fails

### Requirement: Superseded reference documents are not listed as authoritative

The "Authoritative Docs" list in `AGENTS.md` SHALL NOT include a document whose own header declares it superseded. A superseded document MAY be referenced, but only from a section that names it historical.

#### Scenario: A superseded document is authoritative

- **WHEN** `AGENTS.md` lists a self-declared-superseded document as authoritative
- **THEN** the guidance-truth guard fails

### Requirement: A known-gap register's status label matches its own evidence

The known-gap register SHALL label a gap closed, resolved, or otherwise no longer open when that entry's own most recent note records a root-cause fix that leaves the assertion unchanged and green. A gap whose remaining content is a host-variance note SHALL NOT carry an open performance-miss claim that a later note in the same entry has resolved. A guard SHALL fail when an entry's status label contradicts a later resolution or closure note inside that entry.

#### Scenario: An entry records a root-cause fix after its open label

- **WHEN** a register entry is labelled open and a later note in the same entry records that the root cause was fixed and the assertion held unchanged
- **THEN** the entry's status label is corrected to match, and the guard fails while the label still contradicts the note

#### Scenario: An entry is genuinely still open

- **WHEN** a register entry's most recent note records an unresolved condition with a stated closing path
- **THEN** the entry remains labelled open and the guard passes

### Requirement: Every pinned value is enforced by a guard

The runtime-derived values that the guidance-truth guard pins SHALL cover every agent-facing document that states them, including the README, the Cursor rule set, the onboarding document, the Codex workflow document, and the reference schema snapshot. A value that appears in more than one document SHALL be checked in all of them.

#### Scenario: A newly added document is unpinned

- **WHEN** a new agent-facing document asserts a schema version, runtime pin, or export command
- **THEN** the guard's document inventory includes it and the assertion applies
