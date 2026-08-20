# HARDENING HANDOFF — Complete Product Roadmap Parallel Wave V2

This file is the input contract for the NEXT dedicated hardening campaign.
It is updated continuously during the wave. Status markers: `ADDED`,
`RISK`, `SCHEMA_REQUEST`, `INTEGRATION_NEED`, `UNTESTED`, `DEFERRED`.

## Campaign summary

- Wave type: massively parallel implementation (10 delegated packets).
- Schema: frozen at v15 — no migrations this wave.
- Sync/backup/portable scope: unchanged by design; any accidental drift must
  be flagged below.

## Durable data classification

No new persistent entity tables or columns were introduced this wave (schema
freeze). New locally persisted preferences use AsyncStorage keys documented by
each worker below. If any worker introduces a durable record outside this
policy it MUST be listed here with owner semantics, sync/backup/portable/
restore/migration status, and remaining hardening work.

## Per-worker findings

(appended as workers return)

## Known risks to verify in hardening

- Interleaved worker commits on local main: verify no commit touched paths
  outside its ownership before relying on history bisectability.
- Concurrent `tsc --noEmit` runs during the wave are advisory only; the
  post-integration gate run is authoritative.
- New UI surfaces have unit-level coverage for domain logic only; component
  rendering and E2E journeys are UNTESTED this wave by policy.

## Deferred to hardening campaign

- Full Vitest suite, Playwright E2E, journeys, simulation lanes.
- Native Android/iOS QA for any notification/PWA behavior added here.
- Any approved SCHEMA_REQUEST migration (next block would be version 16).
- Performance passes on new bounded queries if profiles regress.
