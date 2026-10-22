# Canonical naming: `super-habits`

**Status: Phase 1 staged; full legacy-name retirement is not complete.**

The canonical repository, public display brand, Expo project slug and display name, PWA name, and npm package name are `super-habits`. This first phase is a review-only source change. Production deployment remains on hold through `vercel.json` and is not authorized.

## Verified naming footprint

A case-insensitive GitHub search at the starting main SHA indexed **467 files** containing `superhabits`, including current source, tests, legacy documentation, historical release evidence, and API/data identifiers. Search index coverage is not an exhaustive proof of all binary or external occurrences.

## Phase 1 implementation

- Canonical metadata: `package.json`, `package-lock.json`, `app.json` Expo name/slug, and `public/manifest.json`.
- Visible UI: boot splash and page title.
- Current user-facing documentation: root README headline/introduction, web privacy page, privacy-policy source, store release notes, with corresponding contract assertions.
- A brand-identity test enforces the canonical presentation while protecting existing native application IDs and URI scheme.

## Mandatory compatibility decisions before complete rebrand

1. **Native identity:** `com.dale16.superhabits` appears in the iOS bundle ID, Android application ID, native tooling, release certificates and tests. The literal `super-habits` is not a valid Android Java package component. Replacing a native ID creates a different installed app and may strand existing local SQLite data. Decide whether the product has real installed clients; if migration is needed, use a valid identifier and document data/signing/store continuity. This phase deliberately preserves the old IDs.
2. **Deep links:** `superhabits` is the existing Expo URI scheme. Existing links need fallback/redirect compatibility before this can change.
3. **Local storage and PWA:** keys `superhabits.*`, cache names `superhabits-shell-*`, database names and OPFS state must be migrated idempotently, with conflicts, legacy reads, rollback, and cross-origin domain effects tested.
4. **Serialized backup formats:** `superhabits-portable-backup`, fingerprint domain separators and old JSON backups are persistent protocol values. Never break signature/hash validation or the ability to import backups created before rebranding. Introduce a versioned new format and legacy import compatibility, or retain the protocol token as a documented legacy exception.
5. **Supabase:** `supabase/config.toml` has local project ID `superhabits`. The connected project named `superhabits` was reported **INACTIVE** at the audit date. Confirm cloud data/retention and rename availability independently before modifying it or linked keys/URLs.
6. **Vercel:** two live project records exist: canonical `super-habits` and additional `superhabits`. Their domains, aliases, build histories and current serving deployments are independent. Do not delete the extra project until its traffic and data/retention responsibilities are verified and the canonical destination is qualified. The repo's `git.deploymentEnabled.main=false` must remain unchanged.
7. **Historical records:** immutable Git commits, PR comments, old artifacts, caches, links and signed evidence cannot be truthfully rewritten into having a different past. The goal is no unapproved current-use legacy labels and a documented compatibility exception list, not falsifying historical provenance.

## Completion criteria

- Review and pass relevant application, package-lock, Expo, native-configuration, E2E, visual, legal-copy and release guard tests for Phase 1 before merging.
- Inventory every current source and CI use of the legacy token; assign an owner, migration, exception or verified obsolete status.
- Close runtime migration through tested old-client and old-backup scenarios before switching storage/protocol identifiers.
- Consolidate providers, domains, references, credentials and naming only after non-destructive verification and explicit owner confirmation for irreversible retirement.
- Re-scan tracked current files and separately report historical/external exceptions; never claim zero traces while compatibility requires legacy identities.

## Unchanged release blockers

`braces` and `node-forge` advisories; hosted Supabase Auth/RLS and backup-provenance certification; old-client compatibility; Android/iOS device certification; native SH-11; cloud-artifact SH-21; production release authorization.
