# Design: Account Recovery Dist-Sync Closure Audit Remediation

## 1. Root defect

`AccountCoordinator.getRemoteFingerprint(userId)` uses Supabase/PostgREST in the form:

`select('user_id', { count: 'exact', head: true }).eq('user_id', userId)`

The shared E2E boundary correctly recognizes all backup endpoints, but currently special-cases `select=user_id` and always returns `content-range: 0-0/0`. Because that branch runs before generic `HEAD` handling, `BackupEntityMockState.count` cannot influence the request shape production actually uses for safety checks.

That is sufficient for the happy-path empty-footprint journeys, but not for the required negative safety scenario where a temporary anonymous account already owns remote backup data.

## 2. Required helper semantics

Keep one shared helper. Do not reintroduce journey-local table regexes.

The helper must resolve a deterministic count for the current request before fulfilling a footprint probe.

Recommended shape:

```ts
type BackupEntityMockState = {
  count?: number;
  countByOwnerUserId?: Record<string, number>;
  rows?: unknown[];
};
```

Equivalent typed designs are acceptable if they make owner scoping explicit and deterministic.

For a request with `user_id=eq.<uid>`:

1. Parse the owner UID from the query.
2. Prefer an owner-specific configured count when supplied.
3. Otherwise use the entity-level `count`.
4. Otherwise default to zero.
5. For the production footprint shape (`HEAD` + `select=user_id`), return the resolved count in the exposed `content-range` header rather than hardcoding zero.
6. Preserve `POST` capture/echo and configured read-row behavior.
7. Unknown `/rest/v1/<table>` endpoints remain unhandled so the journey layer can fail loudly.

The helper must not infer ownership from arbitrary request bodies or silently accept malformed owner filters.

## 3. Focused contract tests

Extend `tests/accountSupabaseMock.drift.test.ts` or split a dedicated helper test if cleaner.

Required focused cases:

- default `select=user_id` footprint returns zero;
- configured entity count N returns N for the exact production footprint request;
- owner-specific count for T does not leak to another UID A;
- `weekly_reviews` supports configured non-zero footprint state;
- synthetic entities remain recognized;
- unknown tables remain `not-handled`;
- POST capture remains intact.

Tests should inspect the actual `content-range` response header because that is the contract Supabase uses to expose exact count.

## 4. Journey-level negative safety proof

Add a deterministic `journeys-sync` scenario to `e2e/journeys/portable-owner-recovery.spec.ts` (or a tightly related account journey if repository evidence strongly favors it).

Preferred scenario:

1. Create/export an owner-backed portable file for source account A.
2. Reset destination to temporary anonymous account T.
3. Import A's portable file so the dataset is locally usable but unbound and carries A's source fingerprint.
4. Configure the shared remote boundary so T has a non-zero count in `weekly_reviews` (one row is enough); unrelated owners remain empty.
5. User attempts the explicit imported-owner recovery flow.
6. Before replacing T with A, production remote-footprint safety sees T's remote row and blocks the transition.
7. Assert no successful owner bind to A occurred, imported local rows remain unchanged, source-owner fingerprint/recovery state remains available, and the unsafe account switch did not proceed.
8. Assert the failure is caused by the real production safety result/state, not by a mocked 404 or arbitrary UI interception.

Using `weekly_reviews` is intentional: it proves that a post-V1 backup entity participates in the same account replacement safety boundary.

Do not weaken the existing matching-account or wrong-account portable scenarios.

## 5. Production code boundary

Expected production source change: none.

Before touching `core/auth/accountCoordinator.ts`, prove a real product bug. The audited defect is the test model. Existing production behavior should continue to fail closed when remote evidence is unavailable or when a temporary account has remote data.

Run existing account coordinator/domain and portable owner-recovery integration tests to guard this boundary.

## 6. QA reconciliation

The previous closure task file has unchecked required gates while its ExecPlan says the groups are complete. This remediation must resolve the discrepancy with actual evidence, not prose.

Preferred approach: execute the named missing commands directly:

- `npm ci`
- `npm run qa:fast`
- `npm run qa:integration`
- `npm run qa:timezones`
- `npm run e2e:full`
- `npm run qa:simulation -- --all --mode deterministic` (or current equivalent)
- `npx expo-doctor`
- `git diff --check`

Also rerun the focused/required account path:

- helper/drift tests
- account coordinator/domain tests
- portable owner recovery integration tests
- `npm run build:sync`
- `npm run e2e:sync`
- OpenSpec and ExecPlan validators
- QA impact validation

If a named wrapper is truly unavailable because scripts changed, record the exact replacement and why it is equivalent. Do not simply check a box because another command probably covered it.

## 7. Durable state reconciliation

Update the old closure records as historical evidence, not as a second active plan:

- `openspec/changes/fix-account-recovery-dist-sync-determinism/tasks.md` — make checked state match commands and requirements actually satisfied after this remediation.
- `.agent/execplans/account-recovery-dist-sync-determinism.md` — preserve the successful 404/full-scope fix at `8b1a1e3...`, but add an audit follow-up noting the non-zero footprint modeling gap and that the later remediation supersedes its original completion claim.

The active execution state for this remediation is this change's `execplan.md` only.

## 8. Exact-final-SHA completion protocol

CI triggers on every push, including documentation-only commits. Avoid the prior ambiguity by following this sequence:

1. Implement and validate locally while this ExecPlan is ACTIVE.
2. Commit/push coherent implementation and reconciliation work.
3. Wait for exact-SHA GitHub Actions; fix any red result.
4. Prepare the final completion commit that marks this ExecPlan/tasks complete. Do not create another bookkeeping commit after it merely to write its run ID.
5. Wait for CI on that exact completion commit. The session is not allowed to report READY until `quality` and `e2e` are green for that SHA.
6. If that final run is red, immediately reopen/update the plan in a corrective commit and continue.
7. The final session report records the exact final SHA and workflow run ID. GitHub Actions is authoritative external evidence; the repository file need not create an infinite chain of post-green run-ID commits.

This preserves a true final-SHA gate without a self-referential documentation loop.

## 9. Git constraints

- Work ultimately lands on `main`.
- No force push.
- Temporary local branches/worktrees are allowed; no temporary remote development branches remain.
- Final working tree clean.
- Local `main == origin/main`.
- Only remote `main` remains.
