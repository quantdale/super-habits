# Design: Account Recovery Dist-Sync Determinism Closure

## 1. Context

Super Habits' account coordinator intentionally derives temporary-account remote-footprint evidence from the complete backup contract:

```ts
const ACCOUNT_REMOTE_BACKUP_ENTITIES = [...BACKUP_ENTITIES, ...BACKUP_SYNTHETIC_ENTITIES] as const;
```

For each entity it performs an owner-scoped count/head query. This is a safety gate: when a temporary anonymous identity already owns meaningful recoverable state, Super Habits must not silently abandon that identity while authenticating another account.

The current dist-sync E2E mocks predate that design. Both `recoverable-account-v1.spec.ts` and `portable-owner-recovery.spec.ts` independently match only:

```text
todos
habits
calorie_entries
workout_routines
```

Everything else under `/rest/v1/` becomes a 404. Once the production coordinator expanded to the complete backup surface, those 404s became legitimate remote-evidence failures. Production correctly fails closed; the test harness incorrectly interprets its own missing endpoint support as a product failure.

Weekly Review V1 added `weekly_reviews` to `BACKUP_ENTITIES`, increasing the visible drift further. The current production surface is 13 table-backed entities plus 2 synthetic remote records.

## 2. Root Cause

This is a **contract drift defect in deterministic E2E infrastructure**, not a timing defect.

The bad dependency direction is:

```text
production backup scope evolves
        ↓
account coordinator correctly follows production scope
        ↓
journey-local mock keeps old hand-written subset
        ↓
new valid endpoint appears unknown to mock
        ↓
mock returns 404
        ↓
coordinator fails closed
        ↓
UI never reaches expected account state
```

Retries can make different assertions fail at different points, but they cannot make a missing mock endpoint correct.

## 3. Design Principles

### 3.1 Production contract is authoritative

The test boundary must not maintain an unguarded, manually copied subset of backup entities.

Preferred implementation:

```ts
import { BACKUP_ENTITIES, BACKUP_SYNTHETIC_ENTITIES } from '@/core/backup/backup.types';
```

If path alias/module compatibility makes direct import from E2E helpers undesirable, create one explicit E2E constant and a drift-guard test that asserts exact equality with production constants. The drift guard is mandatory in that fallback design.

### 3.2 Shared helper, journey-specific policy

Create a helper in an appropriate location such as:

```text
e2e/helpers/accountSupabaseMock.ts
```

Exact filename may change if repository conventions suggest a better name.

The helper owns generic backup REST handling. Individual journeys continue to own:

- current mocked user/session identity;
- OTP behavior;
- `shouldCreateUser` assertions;
- source/destination/wrong-account identities;
- custom remote rows needed by a scenario;
- pushed-row capture needed for ownership assertions;
- scenario-specific auth errors.

Do not create one monolithic global mock with mutable cross-test state that obscures journey intent.

### 3.3 Strict known-surface handling

The helper should distinguish:

```text
known backup table request
known auth request handled by caller
unknown Supabase REST request
```

For known backup tables it may return deterministic data according to configuration.

For unknown REST tables it should fail loudly, ideally with a descriptive error/response that names the unmodeled table. This protects the suite from silently swallowing future backend dependencies.

### 3.4 Correct Supabase count semantics

The account coordinator uses Supabase JS count/head queries. The helper must model the actual request shape emitted by the installed Supabase client.

Support the relevant combination of:

- `HEAD` requests if emitted;
- `GET` requests with `Prefer: count=exact` if emitted;
- `select=user_id`;
- `user_id=eq.<uid>`;
- `content-range` headers expected by PostgREST/Supabase JS;
- empty count = 0;
- non-empty configured count = N.

Do not assume request method from memory. Inspect the actual captured request or current client behavior and encode tests around it.

### 3.5 Synthetic backup records are first-class

`user_backup_settings` and `backup_manifest` are not local domain tables, but they are meaningful owner-scoped recovery state and are part of `BACKUP_SYNTHETIC_ENTITIES`. The account footprint helper must recognize both.

### 3.6 No product weakening

Do not modify the Account Coordinator to ignore errors simply because tests are failing.

The following production behavior must remain:

```text
remote evidence unavailable
→ fail closed
→ no account switch / no unsafe binding
```

The correct fix is to make deterministic tests accurately model the backend surface.

## 4. Proposed Test Helper Contract

A possible shape:

```ts
type BackupEntityMockState = {
  count?: number;
  rows?: unknown[];
};

type BackupRestMockOptions = {
  entities?: Partial<Record<BackupRemoteEntity, BackupEntityMockState>>;
  onPostRows?: (entity: BackupRemoteEntity, rows: unknown[]) => void;
};

function isBackupRemoteEntity(name: string): name is BackupRemoteEntity;

async function handleBackupRestRequest(
  route: Route,
  options: BackupRestMockOptions,
): Promise<'handled' | 'not-handled'>;
```

This is illustrative, not mandatory. Use repository conventions and preserve type safety.

Desired behavior:

- no override → known entity behaves as empty remote backup state;
- `{ count: N }` → footprint probe reports N;
- `{ rows: [...] }` → restore/read query returns those rows when appropriate;
- POST → capture/echo semantics configurable by journey;
- unknown entity → not silently handled.

If generic read behavior differs materially by entity shape, keep the helper focused on the account-footprint request patterns and let journey code handle specialized restore rows.

## 5. Journey Refactor

### 5.1 Recoverable Account V1

Retain existing auth-specific mock logic but replace the four-table REST regex.

The journey currently needs:

- anonymous account signup/session;
- email protection request;
- OTP verification preserving UUID;
- unknown-email recovery failure;
- existing-account recovery with `shouldCreateUser=false`;
- one owner-scoped Todo backup for restore behavior;
- pushed Todo ownership capture;
- empty footprint responses during protection checks.

The shared helper should cover generic backup queries while scenario code provides the Todo row override.

### 5.2 Portable Owner Recovery

Retain:

- source anonymous account A;
- protected A with email;
- destination temporary anonymous T;
- wrong account B;
- exported portable file carrying the source fingerprint;
- matching and mismatch OTP behavior;
- empty remote footprint for T in the successful matching flow.

Again, generic backup probes come from the helper, while identity transitions stay in the journey.

## 6. Drift Guard

A dedicated unit/test helper assertion should ensure the test boundary cannot lag the production contract.

Preferred invariant:

```ts
expect([...ACCOUNT_E2E_BACKUP_ENTITIES].sort()).toEqual(
  [...BACKUP_ENTITIES, ...BACKUP_SYNTHETIC_ENTITIES].sort(),
);
```

If the helper directly imports and iterates the production constants, add a test that enumerates every current entity and proves it is recognized. This protects against accidental filtering or table-pattern bugs.

The current expected set includes:

- todos
- habits
- habit_completions
- calorie_entries
- saved_meals
- workout_routines
- routine_exercises
- routine_exercise_sets
- workout_logs
- workout_session_exercises
- pomodoro_sessions
- linked_action_rules
- weekly_reviews
- user_backup_settings
- backup_manifest

The test should not require editing a copied list every time if direct derivation is feasible.

## 7. Failure Classification

The closure must distinguish:

### Product failure

Examples:

- matching verified owner cannot bind despite valid remote evidence;
- wrong owner can claim imported data;
- remote evidence error no longer fails closed;
- owner state is mutated before verification.

These require production fixes.

### Test-boundary failure

Examples:

- known backup endpoint gets 404 from stale mock;
- mock does not emit count headers expected by client;
- shared state leaks between journey steps/tests;
- mock identity is not reset deterministically.

These require harness fixes.

Do not label a deterministic test-boundary defect as a flake.

## 8. Retry Policy

Playwright retries may remain at repository defaults, but closure acceptance must not depend on retry success.

For the affected account flows, obtain clean first-attempt passes in focused/local runs. At minimum run the affected specs repeatedly enough to demonstrate deterministic state transitions. A useful closure target is 5 consecutive focused runs with zero retries/failures, if practical within the current harness runtime.

Do not solve with:

- timeout inflation alone;
- `test.fixme` for active paths;
- `test.skip`;
- quarantine tags;
- `expect.soft` on ownership-critical assertions.

## 9. Weekly Review ExecPlan Reconciliation

`weekly-review-planning-v1.md` currently marks:

```text
Final main push and exact-SHA GitHub CI green
```

as complete while the final exact SHA `36f01f8...` has GitHub Actions run `32024054019` = failure.

Correct the record without deleting useful implementation evidence.

Recommended wording:

- Weekly Review feature implementation complete;
- quality/main-lane E2E/deterministic scenarios passed;
- exact final repository CI was red because the inherited account/recovery dist-sync mock was stale;
- closure tracked by `fix-account-recovery-dist-sync-determinism`;
- once this closure's exact final SHA is green, note that repository closure is complete.

Whether the Weekly Review plan lifecycle remains `COMPLETED` or is temporarily set to `BLOCKED`/`ACTIVE` must follow `.agent/PLANS.md` and the ExecPlan validator semantics. Prefer truthful lifecycle semantics over preserving a cosmetic completed state.

## 10. Validation Strategy

### Focused

- new backup-boundary helper tests;
- drift guard;
- affected account E2E specs;
- account coordinator/domain unit tests;
- backup scope tests;
- portable owner recovery integration tests.

### Required local gates

```text
npm ci
npm run typecheck
npm run lint
npm test
npm run openspec:validate
npm run agent:plan:validate:all
npm run build:sync
npm run e2e:sync
npm run build:web
npm run e2e:full
npm run qa:simulation -- --all --mode deterministic
npm run qa:impact:validate
git diff --check
```

Use current repository equivalents if scripts have changed.

### Final GitHub gate

After all implementation/docs/plan changes are committed and pushed:

- exact final SHA must have `quality` PASS;
- exact final SHA must have `e2e` PASS;
- the remote-boundary journey step inside `e2e` must actually pass;
- a prior green implementation SHA is not enough;
- a final docs-only SHA with red/pending CI is not enough.

## 11. Git / Completion Model

Final repository state:

```text
branch: main
remote branches: main only
working tree: clean
local main == origin/main
force push: never
```

The closure ExecPlan stays ACTIVE during implementation. It becomes COMPLETED only after all required local validation and final exact-SHA GitHub CI are confirmed green.

## 12. Rollback

This change should primarily touch tests/helpers/docs/plan state. If production behavior changes are discovered to be necessary, keep them minimal and separately justified.

Rollback of the shared helper should not be needed once drift coverage proves it models the production contract. Never roll back the expanded production backup scope merely to restore old mock compatibility.
