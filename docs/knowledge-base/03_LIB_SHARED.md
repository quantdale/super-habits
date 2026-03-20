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

- Returns `date.toISOString().slice(0, 10)` — **UTC calendar date** `YYYY-MM-DD`.

**Known bug (do not fix silently — coordinate migration):**

| Symptom | User in UTC+8 at local 23:00 Monday | `toISOString()` date |
|---------|--------------------------------------|------------------------|
| “Today” vs key | Still Monday locally | May already be **Tuesday** UTC → `date_key` / `consumed_on` is Tuesday |

**Blast radius:**

| Area | Column | Effect |
|------|--------|--------|
| Habits | `habit_completions.date_key` | Completions bucketed to wrong calendar day vs user expectation |
| Calories | `calorie_entries.consumed_on` | “Today’s” list can show wrong day near midnight |
| `listCalorieEntries()` / habit defaults | Default `toDateKey()` | Same |

**Migration to local dates would require:**  
- Replace `toDateKey()` implementation to use local YYYY-MM-DD (e.g. `getFullYear`, `getMonth`, `getDate`).  
- **Existing rows:** historical `date_key` / `consumed_on` values are UTC-based — backfill or accept discontinuity; any report comparing “calendar days” would need one-time script or versioned interpretation.  
- **Tests / docs:** update any assumption of UTC keys.  
- **Coordination:** project rules flag silent fixes — must be explicit team decision.

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
