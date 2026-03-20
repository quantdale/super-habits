# 02_CORE_INFRA.md

## Scope

`core/`: SQLite client (`core/db/client.ts`, `types.ts`, `schema.sql`, `migrations/`), sync (`core/sync/sync.engine.ts`), guest profile (`core/auth/guestProfile.ts`), `core/providers/AppProviders.tsx`, PWA (`core/pwa/registerServiceWorker.ts`), shared UI (`core/ui/*`).

---

## `core/db/client.ts`

### Module-level state

| Name | Type | Role |
|------|------|------|
| `dbPromise` | `Promise<SQLite.SQLiteDatabase> \| null` | Lazy singleton; reset to `null` on failed open |

### `bootstrapStatements` (exact DDL)

Executed in order via `openAndBootstrap()` → `for (const statement of bootstrapStatements) await database.execAsync(statement)`.

1. **WAL (native only):** If `Platform.OS !== "web"`, prepend `"PRAGMA journal_mode = WAL;"`. **Web:** no WAL pragma in array (empty spread branch).

2. **`todos`**

```sql
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

3. **`habits`**

```sql
CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  target_per_day INTEGER NOT NULL DEFAULT 1,
  reminder_time TEXT,
  category TEXT NOT NULL DEFAULT 'anytime',
  icon TEXT NOT NULL DEFAULT 'check-circle',
  color TEXT NOT NULL DEFAULT '#64748b',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

4. **`habit_completions`**

```sql
CREATE TABLE IF NOT EXISTS habit_completions (
  id TEXT PRIMARY KEY NOT NULL,
  habit_id TEXT NOT NULL,
  date_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(habit_id, date_key)
);
```

5. **`pomodoro_sessions`**

```sql
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  session_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

6. **`workout_routines`**

```sql
CREATE TABLE IF NOT EXISTS workout_routines (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

7. **`workout_logs`**

```sql
CREATE TABLE IF NOT EXISTS workout_logs (
  id TEXT PRIMARY KEY NOT NULL,
  routine_id TEXT NOT NULL,
  notes TEXT,
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

8. **`calorie_entries`**

```sql
CREATE TABLE IF NOT EXISTS calorie_entries (
  id TEXT PRIMARY KEY NOT NULL,
  food_name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  fats REAL NOT NULL DEFAULT 0,
  fiber REAL NOT NULL DEFAULT 0,
  meal_type TEXT NOT NULL,
  consumed_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

9. **`app_meta`**

```sql
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
```

### `runMigrations(db)` — full walkthrough

Reads version:  
`SELECT value FROM app_meta WHERE key = 'db_schema_version'` → `parseInt` → default `0`.

| Condition | SQL / actions | Version written | Idempotency |
|-----------|---------------|-----------------|-------------|
| `version < 2` | `ALTER TABLE habits ADD COLUMN category TEXT NOT NULL DEFAULT 'anytime'` inside **try/catch** (ignore if column exists) | `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('db_schema_version', '2')` | try/catch absorbs duplicate column |
| `version < 3` | Two try/catch blocks: `ADD COLUMN icon ...`, `ADD COLUMN color ...` | `'3'` | same |
| `version < 4` | try/catch: `ALTER TABLE calorie_entries ADD COLUMN fiber REAL NOT NULL DEFAULT 0` | `'4'` | same |

**Note:** Bootstrap `CREATE TABLE` already includes columns for new installs; migrations patch older DBs. **No** `version < 1` bootstrap inserts `db_schema_version` at install — version starts unset (`0`) until first migration runs.

### Exported functions

#### `getDatabase(): Promise<SQLite.SQLiteDatabase>`

1. If `dbPromise` is null, set `dbPromise = openAndBootstrap().catch((err) => { dbPromise = null; throw err; })`.
2. Return `dbPromise`.

**Error behavior:** Failed open clears singleton so retry possible.

#### `initializeDatabase(): Promise<void>`

- `await getDatabase()` — public “ensure ready” hook.

**Callers:** `AppProviders` (mount). **Callees:** `getDatabase` → `openAndBootstrap` → `runMigrations`.

---

## `core/db/types.ts` — type reference

| Type | Fields |
|------|--------|
| `BaseEntity` | `id`, `created_at`, `updated_at`, `deleted_at: string \| null` |
| `Todo` | BaseEntity + `title`, `notes`, `completed: 0 \| 1` |
| `HabitCategory` | `"anytime" \| "morning" \| "afternoon" \| "evening"` |
| `HabitIcon` | Union of Material icon name strings (see file) |
| `Habit` | BaseEntity + `name`, `target_per_day`, `reminder_time`, `category`, `icon`, `color` |
| `HabitCompletion` | `id`, `habit_id`, `date_key`, `count`, `created_at`, `updated_at` |
| `PomodoroSession` | `id`, `started_at`, `ended_at`, `duration_seconds`, `session_type: "focus" \| "break"`, `created_at` |
| `WorkoutRoutine` | BaseEntity + `name`, `description` |
| `WorkoutLog` | `id`, `routine_id`, `notes`, `completed_at`, `created_at` |
| `CalorieEntry` | BaseEntity + `food_name`, `calories`, `protein`, `carbs`, `fats`, `fiber`, `meal_type`, `consumed_on` |

**SQLite mapping:** Column names use `snake_case`; TS types mirror row shapes returned by `expo-sqlite`.

---

## `core/db/schema.sql`

Reference snapshot only — **not executed** at runtime. Header states it may lag; authoritative DDL is `bootstrapStatements` + migrations.

---

## `core/db/migrations/001_initial_supabase.sql`

Postgres-style `profiles` table — **not** run by `client.ts`. Reserved for post-MVP.

---

## `core/sync/sync.engine.ts`

### `SyncRecord`

```ts
type SyncRecord = {
  entity: string;
  id: string;
  updatedAt: string;
  operation: "create" | "update" | "delete";
};
```

### `SyncAdapter`

| Method | Contract |
|--------|----------|
| `push(records: SyncRecord[])` | `Promise<void>` |
| `pull(since: string \| null)` | `Promise<SyncRecord[]>` |

### `NoopSyncAdapter`

| Method | Behavior |
|--------|----------|
| `push` | No-op resolve |
| `pull` | Returns `[]` |

### `SyncEngine`

| Member | Detail |
|--------|--------|
| `private queue: SyncRecord[]` | In-memory FIFO list |
| `constructor(adapter = new NoopSyncAdapter())` | Injectable adapter (future cloud) |

#### `enqueue(record: SyncRecord): void`

- Pushes `record` onto `this.queue`.

#### `async flush(): Promise<void>`

1. If `queue.length === 0`, return.
2. `snapshot = [...queue]` (shallow copy of array; records are plain objects).
3. `await this.adapter.push(snapshot)`.
4. `this.queue = []`.

**If `adapter.push` throws:** `queue` is **not** cleared — snapshot was already taken but assignment step 4 not reached; **queued records remain** for a later flush attempt.

**Call sites for `flush`:** `core/providers/AppProviders.tsx` — only when `isRemoteEnabled()` is true (see below). Otherwise intervals/listeners not registered.

### Exported `syncEngine`

Singleton: `new SyncEngine()` — default noop adapter.

---

## `core/auth/guestProfile.ts`

### `ensureGuestProfile(): Promise<GuestProfile>`

`GuestProfile`: `{ id: string; createdAt: string }`.

**Steps:**

1. `getDatabase()`.
2. `SELECT value FROM app_meta WHERE key = ?` with `["guest_profile"]`.
3. If row exists → `JSON.parse` and return.
4. Else: `id = createId("guest")`, `createdAt = new Date().toISOString()`, `INSERT INTO app_meta (key, value) VALUES (?, ?)` with JSON string, return profile.

**Errors:** Uncaught if DB throws; caller `AppProviders` uses `.catch(() => undefined)` — **swallows** errors (silent guest failure).

**Callers:** `AppProviders`. **Callees:** `getDatabase`, `createId`.

---

## `core/providers/AppProviders.tsx`

### `queryClient`

`new QueryClient()` — default options; **no** global error/retry customization in source.

### Effect 1 — bootstrap (deps: `[]`)

| Order | Call | Error handling |
|-------|------|----------------|
| 1 | `initializeDatabase().catch((e) => console.error("[db] initializeDatabase failed", e))` | Log only — **does not rethrow** |
| 2 | `registerServiceWorker()` | Sync — no await; SW registration is fire-and-forget inside function |
| 3 | `ensureGuestProfile().catch(() => undefined)` | **Swallowed** |

**Note:** `registerServiceWorker` is not awaited; DB and guest are async with independent error paths.

### Effect 2 — sync flush (deps: `[]`)

1. If `!isRemoteEnabled()` → **return early** (no listeners).
2. Define `flush`: `void syncEngine.flush().catch((e) => console.error("[sync] flush failed", e))`.
3. `setInterval(flush, 30_000)`.
4. If web and `document` defined: `visibilitychange` → when `document.visibilityState === "hidden"`, call `flush`.
5. `NetInfo.addEventListener`: if `state.isConnected`, call `flush`.

**Cleanup:** `clearInterval`, remove visibility listener, `unsubscribeNetInfo()`.

**Remote default:** `lib/supabase.ts` initializes `remoteMode` to `"disabled"` — **flush machinery is off** unless `setRemoteMode("enabled")` is called (no UI in repo for this at KB time).

### Tree

`GestureHandlerRootView` → `QueryClientProvider` → `children`.

---

## `core/pwa/registerServiceWorker.ts`

### State

`let registered = false` — prevents double registration.

### `registerServiceWorker(): void`

1. If `registered` or `Platform.OS !== "web"` → return.
2. If no `serviceWorker` in `navigator` → return.
3. `new Workbox("/sw.js")`, `wb.register()`, `registered = true`.

**Errors:** Uncaught from `register()` (no try/catch).

---

## `core/ui` components

### `Screen.tsx`

| Prop | Type | Default | Effect |
|------|------|---------|--------|
| `children` | `ReactNode` | — | Content |
| `scroll` | `boolean` | `false` | If true, wraps inner content in `ScrollView` from `react-native-gesture-handler` with `keyboardShouldPersistTaps="always"`, `keyboardDismissMode="on-drag"` |
| `padded` | `boolean` | `true` | If true, inner `View` uses `px-4 py-3`; if false, `flex-1 bg-slate-50` only |

Outer: `SafeAreaView` with `flex-1 bg-slate-50`.

### `Button.tsx`

| Prop | Type | Default | Effect |
|------|------|---------|--------|
| `label` | `string` | — | Button text |
| `onPress` | `() => void` | — | Handler |
| `variant` | `"primary" \| "ghost" \| "danger"` | `"primary"` | See class table below |

**Variant → `Pressable` container `className` (concat after `rounded-xl px-4 py-3`):**

| Variant | Container classes |
|---------|-------------------|
| primary | `bg-brand-500` |
| danger | `bg-rose-500` |
| ghost | `bg-slate-200 dark:bg-slate-700` |

**Variant → label `Text` classes:**

| Variant | Label classes |
|---------|---------------|
| primary | `text-white` |
| danger | `text-white` |
| ghost | `text-slate-900 dark:text-slate-100` |

Shared: `text-center font-semibold`.

### `Card.tsx`

| Prop | Effect |
|------|--------|
| `children` | Wrapped in `View` with `mb-3 rounded-2xl bg-white p-4 shadow-sm` |

### `TextField.tsx`

| Prop | Type | Default | Effect |
|------|------|---------|--------|
| `label` | `string` | — | Label above input |
| `value` / `onChangeText` | Controlled | — | Passed to `TextInput` |
| `placeholder` | `string` | optional | |
| `keyboardType` | `"default" \| "numeric" \| "number-pad"` | `"default"` | Overridden when `unsignedInteger` |
| `unsignedInteger` | `boolean` | `false` | If true: `keyboardType` → `number-pad`; `onChangeText` receives `text.replace(/\D/g, "")` — **digits only** |

### `SectionTitle.tsx`

| Prop | Effect |
|------|--------|
| `title` | Large bold title |
| `subtitle` | Optional smaller text below; if absent, no subtitle margin |

### `NumberStepperField.tsx`

| Prop | Type | Default | Effect |
|------|------|---------|--------|
| `label` | `string` | — | |
| `value` / `onChange` | `string` / `(value: string) => void` | — | **String** contract — parent stores numeric as string |
| `min` | `number` | `1` | Clamp lower bound for ± buttons |
| `max` | `number` | `999` | Clamp upper bound |
| `placeholder` | `string` | `"1"` | |

**Clamp logic:** `num = Number(value)`; `validNum = Number.isFinite(num) ? num : min`. Minus: `Math.max(min, validNum - 1)`; Plus: `Math.min(max, validNum + 1)`. **Direct `TextInput` edits** call `onChange` with raw string — **no clamp** on manual typing until user taps ±.

**`onBlur`:** The `TextInput` has **no** `onBlur` prop — **no onBlur — raw string persists until ± tap** (or parent-driven `value` change).

**Direct-edit edge cases** (parent receives via `onChange` = `onChangeText` passthrough):

| User types | `Number(value)` | `validNum` on next ± press | Effect of **−** (default `min=1`) | Effect of **+** |
|------------|-----------------|----------------------------|-----------------------------------|-----------------|
| `""` | `0` | `0` | `Math.max(1, -1)` → **`"1"`** | `Math.min(999, 1)` → **`"1"`** |
| `"0"` | `0` | `0` | same → **`"1"`** | same → **`"1"`** |
| `"abc"` | `NaN` | `min` (`1`) | `Math.max(1, 0)` → **`"1"`** | `Math.min(999, 2)` → **`"2"`** |

Until ± is pressed, **`"0"`**, **`""`**, `"abc"` remain in parent state as typed (invalid numeric display allowed).

---

## SQL not in `client.ts`

All feature-layer SQL is documented in [04_FEATURES.md](./04_FEATURES.md).

---

## Known bugs / quirks

| Issue | Location | Detail |
|-------|----------|--------|
| **schema.sql lag** | `core/db/schema.sql` | Missing `category`, `icon`, `color` on habits vs bootstrap — reference only |
| **Guest failure silent** | `AppProviders` + `ensureGuestProfile` | Errors swallowed |
| **Sync queue growth** | `SyncEngine` + remote off | Enqueues still run; flush only when remote enabled |
