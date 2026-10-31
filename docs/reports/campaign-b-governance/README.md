# Campaign B governance proposals — NOT APPLIED

Observed 2026-10-23 UTC, repository `quantdale/super-habits`, base
`02d43088e10170d03f9db44c887227a9705f8dff`.

These are **two choices for later owner approval**, not current protections,
waivers, release authority, or administrator-change instructions for this run.
No GitHub/Vercel setting or CI workflow was changed. The JSON's `active` value
is the _desired future enforcement_, not a remotely applied state. It is inert
in this documentation directory and must not be submitted without new authority.

## Observed gap

GET ruleset `15001092`: `enforcement: disabled`, no bypass actors, zero required
approvals, and no required checks. GET effective rules for `main`: `[]`.
GET classic branch protection: HTTP 404, `Branch not protected`. Thus the
nonforce/deletion/PR rules in the disabled object do not protect main today.
Observed checks are `quality` and `e2e`, produced by GitHub Actions app `15368`.
Their existence does not establish protection. Evidence is under
`.agent/evidence/campaign-b-security/` (ignored, preserved locally).

## A. Strict source and release gate

[Proposed ruleset payload](strict-main-ruleset.proposed.json) targets exact
`refs/heads/main`, prevents deletion/non-fast-forward, requires linear history,
a PR, one approving review, dismissal of stale approvals, approval of the most
recent push by someone other than its pusher, resolved threads, and up-to-date
`quality` + `e2e` from GitHub Actions. Only squash/rebase merges are allowed.
No actor, bot, organization role, repository role, integration, or administrator
is placed in the bypass list. No code-owner requirement is asserted because
there is no CODEOWNERS assignment in this proposal; one real independent reviewer
must be available before activation. Repository administrators can still edit
rulesets: administrative access/audit ownership requires separate owner review.

**Consequence:** existing `quality` includes the unchanged dependency audit.
With two unwaived highs, it fails and blocks **SOURCE integration as well as
release**. This is enforceable and fail-closed, but is not an interpretation that
Campaign B's authorized engineering integration has already been enabled.
Do not silently select A or bypass its red check to merge source.

## B. Engineering integration separated from mandatory release security

This option respects the distinction between authorized SOURCE integration and
blocked production, but **does not exist in the current workflow**. It needs a
separate owner-approved governance/code change before activation:

1. Retain all A restrictions on PRs, review freshness, threads, nonforce,
   deletion, linear history and empty bypass list.
2. Implement a separately named engineering-quality check containing every
   non-audit quality step currently in `ci.yml`, plus require existing `e2e`.
   Bind actual emitted names and GitHub Actions app ID only after exact-head
   PR tests prove the new checks. No invented check name is deployable today.
3. Preserve `scripts/audit-runtime-deps.mjs`, its empty allowlist and fail-closed
   semantics. Keep the dependency audit mandatory, visible, and independently
   failing on these findings. Do not make it report-only, `continue-on-error`,
   skipped, or bypassable. Do not claim its failure is a green overall CI run.
4. Implement an explicit release gate aggregating engineering, E2E and dependency
   security results for the **same candidate SHA**, plus required platform/cloud
   prerequisites. Any failed/missing/skipped security result denies release.
5. Keep `vercel.json` main deployment hold (`main: false`). Before any later
   production authority, prove BOTH Vercel project settings and every production
   path (Git integration, dashboard/manual CLI/API, aliases, deploy hooks) cannot
   evade the release gate and independent owner approval. Protect production
   credentials and require a separate owner-controlled production approval;
   do not assume GitHub environments govern external Vercel Git integration.
   Preview qualification is isolated non-production work, not a production alias
   or permission to change the hold. No preview is deployed by this worker.
6. Keep store uploads, signing issuance, production SQL and release tags outside
   source integration authority. Document exact-SHA evidence and operator audit
   trail. A source merge under this option is neither an advisory waiver nor a
   production-risk acceptance.

No B payload requiring a nonexistent check is supplied. Activation requires
implemented/tested workflow names, release enforcement on all production routes,
verified owner/reviewer assignments, provider access, and explicit new owner
approval of the split. Until then B is a design choice, not protection.

## Read-only verification and later activation acceptance

Replay GETs (no PUT/PATCH/POST settings calls in this task):

```bash
gh api repos/quantdale/super-habits/rulesets/15001092
gh api repos/quantdale/super-habits/rules/branches/main
gh api repos/quantdale/super-habits/branches/main/protection
gh api repos/quantdale/super-habits/commits/<candidate-sha>/check-runs
```

After separately authorized activation, an administrator must verify the exact
main ref/effective rules, empty bypass list and required-check app binding;
prove unapproved/stale-review/failed-check PRs and direct/force/deletion pushes
are denied using an isolated test repository first (never destructive main
experiments). Preserve denial and successful reviewed-PR evidence. A may not
merge until quality is green. B additionally needs exact-SHA negative release
tests proving a red audit cannot deploy through either Vercel project, while
a correctly reviewed source-only PR can integrate. Keep production blocked
until every release prerequisite and explicit owner approval is satisfied.
