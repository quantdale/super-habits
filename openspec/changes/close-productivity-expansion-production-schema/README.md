# Production Schema Convergence Closure

This change closes the remaining production-deployment gap after Productivity Expansion Wave V1 hardening.

The repository/client contract is green at `2f49c0d5877ead3f419b2f5e8291b03d12871414` with GitHub Actions run `32362939192` successful, but live Supabase project `kruubbynsmxzxfdunaal` is still on the pre-planning schema.

Authoritative files:

- `proposal.md`
- `design.md`
- `specs/production-schema-convergence/spec.md`
- `tasks.md`
- `execplan.md`

The CLI session must read all of them before changing source.

This is a closure campaign, not a feature wave. The only goal is to make production Supabase match the already-shipped Backup Scope V4 / Portable V2 client contract safely and verifiably, while preserving all existing production rows and owner/RLS guarantees.

Live snapshot observed before this change was authored:

- `projects`: absent
- `goals`: absent
- `daily_plans`: absent
- `todos`: lacks `project_id`, `goal_id`, `completed_at`
- `habits`: lacks `project_id`, `goal_id` and also lacks `completed_at`
- `backup_manifest`: lacks `backup_scope_version`
- pending repository migration `20260820000000_backup_manifest_scope_version.sql` has not been applied live
- no migration versions >= `20260819000000` were present in the live migration ledger

Do not waive this gap as environment-only. If the CLI still lacks live credentials, it must at minimum implement and validate the complete additive migration and leave the change ACTIVE/BLOCKED for live apply rather than claiming production readiness.
