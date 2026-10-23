# Campaign B — participating SQLite writer serialization candidate

Base `02d43088`; parent recovered this work after worker timeout. This is an
**unreviewed candidate**, not accepted main source or native qualification.

## Changed contract

`core/db/sqliteWriter.ts` supplies one FIFO per root database for
`withSQLiteTransaction` and standalone `setAppMetaText`/`setAppMetaJson`/
`deleteAppMetaKey`. A distinct method-bound, expiring transaction capability lets
metadata helpers called with the callback handle join that unit of work rather
than queue behind themselves. Native exclusive connections remain method-bound;
web's reused connection no longer conflates unrelated metadata with nested work.
Nested transactions and transaction lifecycle operations on this capability fail
immediately. Rejected work drains the tail; storage rejection remains classified.

This is **not** a universal adapter single-writer boundary. Raw `runAsync` and
`execAsync`, direct adapter transactions, maintenance and reads do not join this
FIFO automatically. The migration runner uses direct adapter transactions before
DB bootstrap is published, not this callback capability. Existing call sites must
pass the callback handle to dependent helpers and await work before returning;
a captured root handle inside a queued transaction can deadlock. Independent
call-site review remains a merge prerequisite.

## Evidence

`tests/integration/transactionsConcurrency.test.ts`: 14 controlled tests over
real better-sqlite3, with both reused web-style and distinct native-style adapter
handles. They prove FIFO read/modify/write, rollback isolation from concurrent
metadata, queued deletion, dependent quota rollback, tail recovery, nested and
expired-capability rejection, method binding, file reopen/retry and no duplicate
intent. Native-style adapters are synthetic, not Expo-device evidence. Thrown
interruption is not OS process-kill/power-loss certification.

The initial affected suite reported 262 passing / one failure: an existing test
awaited a queued metadata write **inside a spy at the already-admitted adapter
entry**, causing self-wait. The test-only injection now writes its competing
commit directly at that raw seam. All conflict/replacement assertions remain.
No production queue bypass or timeout increase was added.

Parent recovery replay:

```
npx vitest run --maxWorkers=1 --no-file-parallelism --cache=false tests/integration/transactionsConcurrency.test.ts tests/integration/generationClientRecovery.test.ts tests/transactions.test.ts
```

**46 passed / 2 files / zero failed.** The `tests/transactions.test.ts` name did
not match an existing file, so it supplies no coverage; actual transaction tests
must be included in aggregate qualification. Logs: `/tmp/campaign-b-transactions/`
(initial worker evidence) and `/tmp/campaign-b-transactions-recovery.log`.

## Next gate

Review exact effective diff and callback inventory, run complete unit/integration
and web backup/restore/multi-tab gates, then fresh native SQLite evidence when
resources permit. No merge or completion claim follows from these focused tests.
