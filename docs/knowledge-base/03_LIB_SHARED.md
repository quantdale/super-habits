# 03_LIB_SHARED.md

## Scope

`lib/id.ts`, `lib/time.ts`, `lib/notifications.ts`, `lib/supabase.ts` — cross-cutting utilities (no React).

---

## `lib/id.ts`

### `createId(prefix: string): string`

**Implementation (exact):**

```ts
const random = Math.random().toString(36).slice(2, 10);
return `${prefix}_${Date.now()}_${random}`;
```

**Algorithm:** `{prefix}_{Date.now() as ms}_{8 chars from base36 random}`.

**Properties:**

- **Not cryptographically strong** — `Math.random()` is predictable; acceptable for local-only row IDs and sync keys in MVP.
- **Collision risk:** Extremely low for single-device ms + 8 chars; not formally guaranteed unique across distributed writers without extra checks.

**Callers:** `features/*/*.data.ts`, `core/auth/guestProfile.ts`.

**Callees:** None.

**Errors:** Does not throw.

**Documented prefixes (comment in file):** `todo`, `habit`, `hcmp`, `cal`, `wrk`, `pom`, `guest`.

---

## `lib/time.ts`

### `nowIso(): string`

- Returns `new Date().toISOString()` — UTC ISO 8601.

**Callers:** All `*.data.ts` files for `created_at` / `updated_at` / log timestamps.

### `toDateKey(date = new Date()): string`

- Returns **local** calendar `YYYY-MM-DD` via `getFullYear()`, `getMonth() + 1`, `getDate()` (padded).
- **Cutover (migration 5):** `app_meta` keys `date_key_format` = `local` and `date_key_cutover` (ISO UTC time when the migration ran) mark when keys switched from the old behavior to local dates.

**Historical behavior (before migration 5):** `toDateKey` used `date.toISOString().slice(0, 10)` — **UTC** calendar date. **Existing rows** written before the cutover still store those UTC-based keys; new writes use local keys. **No backfill** — original local timezone at write time was not stored, so backfill would be guesswork.

**Blast radius (fixed for new writes):**

| Area | Column | Notes |
|------|--------|--------|
| Habits | `habit_completions.date_key` | New completions use local day; pre-cutover rows keep UTC-based keys |
| Calories | `calorie_entries.consumed_on` | Same |
| Defaults | `listCalorieEntries()` / habit APIs | Default `toDateKey()` matches local “today” |

**Call sites:** See [00_INDEX.md](./00_INDEX.md) cross-feature map.

---

## `lib/notifications.ts`

### Import-time side effect

`Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) })` — runs when module loads.

### `ensureNotificationPermission(): Promise<boolean>`

1. `getPermissionsAsync()` — if `granted`, return `true`.
2. `requestPermissionsAsync()`.
3. On Android: `setNotificationChannelAsync("default", { name: "default", importance: HIGH })`.
4. Return `request.status === "granted"`.

**Throws:** Delegates to expo-notifications (network/storage errors possible).

### `scheduleTimerEndNotification(seconds: number, title: string, body: string)`

1. `ensureNotificationPermission()`.
2. If not allowed → return `null`.
3. Else `scheduleNotificationAsync` with `trigger: { type: TIME_INTERVAL, seconds }`.

**Returns:** `Promise` of notification id or `null`.

**Callers:** `PomodoroScreen` on timer start.

---

## `lib/supabase.ts`

### Types and state

- `export type RemoteMode = "disabled" | "enabled"`
- `let remoteMode: RemoteMode = "disabled"`

### `setRemoteMode(mode: RemoteMode): void`

- Assigns module-level `remoteMode`.

### `isRemoteEnabled(): boolean`

- Returns `remoteMode === "enabled"`.

**Callers:** `AppProviders` (gates sync flush listeners).

**Post-MVP:** Comment in file references future Supabase client — **no** Supabase imports in app source at KB time.

---

## Architecture

Flat utilities consumed as `@/lib/*`. **No** HTTP surface.
