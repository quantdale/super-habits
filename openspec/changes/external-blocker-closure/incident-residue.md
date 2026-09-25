# Production incident residue: read-only investigation and cleanup proposal

Status: `OWNER_APPROVAL_REQUIRED` for every production deletion. This document is an investigation, not deletion authority.

## Boundary and evidence

The only queried production project was `superhabits` (`kruubbynsmxzxfdunaal`). Supabase project metadata confirmed that name and ID before SQL. Every production SQL call in this investigation was a `SELECT`. The production-drain incident is documented in the completed live-cloud ExecPlan and [known gap 15](../../../docs/testing/known-gaps.md): a local `build:web` export embedded live Supabase configuration, and the J8 journey observed an empty outbox where it expected 24 new recurring To Dos. The hermetic build fix was committed at 2026-09-24 10:29:49 UTC; that commit time is a containment marker, not proof of the last remote write.

The J8 fixture and recurrence path give a specific fingerprint: exactly the 24 titles `Task 7, 19, 25, 31, 37, 49, 55, 61, 67, 85, 91, 97, 109, 115, 121, 127, 139, 145, 151, 169, 175, 181, 187, 199`, each `urgent`, `daily`, incomplete, and due 2026-09-24. The new rows have canonical decimal-millisecond `todo_` IDs and point through `recurrence_id` to the fixture's base-36 ID style. Each complete 24-row set landed within 110 milliseconds under one newly created anonymous owner. The first owner also has the source-backed `Soak hydration` habit and `Soak task 1` To Do. The possible historical HEAVY backfill is broader than these 24 rows, so the investigation checked _all_ backup tables for each candidate owner, including rows with backdated `created_at`.

The read-only snapshot at 2026-09-25 02:02:27 UTC found five complete J8 cohorts:

| Cohort | First/last 24-row arrival (UTC) | Owned remote rows at snapshot                    |
| ------ | ------------------------------- | ------------------------------------------------ |
| J8-A   | 06:56:53.229–06:56:53.326       | 25 To Dos, 1 habit, 1 settings row, 0 manifests  |
| J8-B   | 08:51:12.557–08:51:12.666       | 24 To Dos, 0 habits, 1 settings row, 0 manifests |
| J8-C   | 08:55:33.203–08:55:33.251       | 24 To Dos, 0 habits, 1 settings row, 1 manifest  |
| J8-D   | 08:59:19.485–08:59:19.530       | 24 To Dos, 0 habits, 1 settings row, 1 manifest  |
| J8-E   | 08:59:58.847–08:59:58.896       | 24 To Dos, 0 habits, 1 settings row, 1 manifest  |

All five owners are anonymous, have null email, zero `auth.identities` and MFA factors, and one `auth.sessions` row each. Their auth creation preceded the row cluster by seconds. No other public backup entity rows belong to these five owners. The exact primary keys, owner IDs, row timestamps, marker codes, relationships, classification, confidence, and incident correlation are in the **gitignored local evidence snapshot** `simulation-output/incident-residue-2026-09-25.json` (SHA-256 `22E543A860A0CF75A686A73663242538D290AF6F062783FD91B4EDD0F9D52207`). This avoids publishing production identifiers in the public repository. The owner reviewing deletion must have this snapshot or rerun the query and compare its exact IDs before approval.

## Candidate classification

The candidate query covered every `auth.users` account created on 2026-09-24 UTC and all its rows in the 17 then-existing recoverable public tables, plus `user_backup_settings` and `backup_manifest`. A separate table/day count confirmed that this cohort also covered all public rows with `created_at` on that day. There were 180 auth accounts, 206 recoverable entity rows, and 96 synthetic settings/manifest rows: 482 candidate records total. Each has an individual classification in the private snapshot.

| Classification            | Records | Basis and cleanup treatment                                                                                                                                                                                               |
| ------------------------- | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONFIRMED_SYNTHETIC`     |     135 | Five exact J8 owners, 121 To Dos, one Soak habit, five settings rows, and three manifests. The code-derived 24-title/shape cohort, timing, and incident outbox observation agree. Only these may be proposed for cleanup. |
| `PROBABLE_SYNTHETIC`      |      96 | Repository or Maestro literal and same-owner rows without an exact incident-run trace. Preserve pending stronger correlation.                                                                                             |
| `AMBIGUOUS`               |     251 | Date, anonymity, emptiness, or generic content alone cannot distinguish a test from a real account. Preserve.                                                                                                             |
| `LEGITIMATE_OR_UNRELATED` |       0 | No selected candidate has affirmative evidence for this classification. This does not describe the rest of production.                                                                                                    |

The snapshot does not assume that every anonymous account from the day is disposable. Five complete J8 cohorts are the deletion boundary. The other 347 records remain untouched, even where their names resemble test fixtures. A base-36 fixture ID alone is not J8-specific; other journeys use the same seed helper.

## Reproduction and change detection

Run this read-only cohort query only after independently confirming project ID and name:

```sql
SELECT user_id, count(*) AS rows, count(DISTINCT title) AS titles,
       min(created_at) AS first_created, max(created_at) AS last_created
FROM public.todos
WHERE left(created_at, 10) = '2026-09-24'
  AND title ~ '^Task (7|19|25|31|37|49|55|61|67|85|91|97|109|115|121|127|139|145|151|169|175|181|187|199)$'
  AND priority = 'urgent' AND recurrence = 'daily'
  AND completed = 0 AND due_date = '2026-09-24'
GROUP BY user_id
HAVING count(*) = 24 AND count(DISTINCT title) = 24
ORDER BY first_created;
```

The full classification snapshot is an observation, not a durable lock on the live database. Before any cleanup, requery every owner and table, compare the exact primary-key sets with the private snapshot, and stop if any owner is no longer anonymous, has an email/identity, or owns an extra row. Also inspect fresh authentication and access logs for a later legitimate sign-in.

## Cleanup proposal — not executed

**Exact targets:** the five owner UUIDs and 135 record IDs marked `CONFIRMED_SYNTHETIC` in the private snapshot only. No date-wide, anonymity-wide, or title-only deletion is proposed. The five `auth.users` rows are part of the 135; their five sessions are additional cascade effects. A fresh enumeration must confirm the same 121 To Dos, one habit, five settings rows, and three backup manifests, with no other owned public rows. All 17 existing public backup tables use `user_id → auth.users` foreign keys with `ON DELETE CASCADE`; intra-public parent/child constraints also exist, so execution should explicitly remove children before parents, then remove the five auth accounts. `auth.sessions` cascades; `auth.identities` and MFA factors currently have zero matching rows and must be rechecked. Deleted auth access tokens may remain valid until expiry; row FKs prevent new owned backup rows after user removal, but the owner must still account for session revocation.

**Transaction procedure for owner review:**

1. Obtain an owner-controlled, restorable client-side export or provider backup of every approved public/auth row and its relationship, and prove the recovery path. Do not run server-side file operations through SQL. If the backup cannot restore anonymous identity state, disclose that limit before approval.
2. Obtain explicit approval of the five exact owner UUIDs, the 135-record snapshot, the auth/session effects, and the proposed execution time. Status remains `OWNER_APPROVAL_REQUIRED` until then.
3. In one production transaction, lock the five `auth.users` rows `FOR UPDATE`, check `is_anonymous`, null email, zero linked identities/MFA, and exact current primary-key sets/counts across every public table against the approved snapshot. Any mismatch triggers `ROLLBACK` and a new classification. The lock prevents new foreign-key children from being admitted during the check.
4. Delete only approved children in dependency order (none for the currently empty workout/planning tables; settings and manifests are explicit), then the approved To Dos and habit, then the five approved auth users. Auth sessions cascade. Check affected row counts inside the transaction, including that probable/ambiguous owners remain present. `ROLLBACK` on any mismatch; `COMMIT` only after the owner-approved checklist agrees exactly.
5. Read back the five owner IDs and each target PK for absence, and read back the untouched candidate counts. Preserve the exported snapshot and transaction audit. If a post-commit recovery is needed, use the proven backup/PITR path; a normal SQL rollback is impossible after commit.

No cleanup SQL, Admin API deletion, auth deletion, or production drain has been executed by this campaign.
