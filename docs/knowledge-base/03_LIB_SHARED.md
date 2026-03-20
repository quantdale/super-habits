# 03_LIB_SHARED.md

## Scope

This document covers the **`lib/`** directory: cross-cutting utilities for **IDs**, **timestamps and date keys**, **local notifications**, and a **remote-mode stub** for future cloud work.

---

## Purpose

**What it does:** Centralizes small, reusable helpers so feature `*.data.ts` and a few other modules do not duplicate ID/time logic or notification setup.

**Problem it solves:** Consistent ID shape for SQLite rows, ISO timestamps for `created_at`/`updated_at`, a single place to configure `expo-notifications` behavior, and a placeholder for future Supabase/remote toggles.

---

## Tech stack

| File | Dependencies / APIs |
|------|---------------------|
| `id.ts` | Pure TypeScript (uses `Math.random`, `Date.now`) |
| `time.ts` | Pure TypeScript (`Date`) |
| `notifications.ts` | `expo-notifications`, `react-native` `Platform` |
| `supabase.ts` | Pure TypeScript (module state only) |

**Not used in `lib/`:** `uuid` npm package (listed in root `package.json` but **no** `import` from `"uuid"` in source files searched).

---

## Architecture pattern

**Shared utility library** (flat folder, no package boundary) consumed via path alias `@/lib/*`. **Not** a standalone npm package or microservice.

---

## Entry points

| Exporting module | Exported symbols |
|------------------|------------------|
| `lib/id.ts` | `createId(prefix: string): string` |
| `lib/time.ts` | `nowIso(): string`, `toDateKey(date?: Date): string` |
| `lib/notifications.ts` | Side effect: `Notifications.setNotificationHandler` at import time; `ensureNotificationPermission()`, `scheduleTimerEndNotification(seconds, title, body)` |
| `lib/supabase.ts` | `RemoteMode`, `setRemoteMode(mode)`, `isRemoteEnabled()` |

---

## Folder structure

| Path | Role |
|------|------|
| `lib/id.ts` | ID factory with documented prefix convention (comment table). |
| `lib/time.ts` | ISO “now” and YYYY-MM-DD date key. |
| `lib/notifications.ts` | Permission + Android channel + scheduled timer notification. |
| `lib/supabase.ts` | In-memory `remoteMode` flag; comment references future Supabase client. |

---

## API surface (HTTP / REST)

**Not found** — `lib/` exposes no HTTP endpoints.

### Public functions (library API)

| Function | Inputs | Output / behavior |
|----------|--------|-------------------|
| `createId` | `prefix: string` | String `{prefix}_{Date.now()}_{8 base36 chars}` (see implementation). |
| `nowIso` | — | `new Date().toISOString()`. |
| `toDateKey` | Optional `Date` (default `new Date()`) | First 10 chars of `toISOString()` → `YYYY-MM-DD` in **UTC**. |
| `ensureNotificationPermission` | — | `Promise<boolean>` — reads permission, may request, sets Android `"default"` channel on Android. |
| `scheduleTimerEndNotification` | `seconds`, `title`, `body` | Returns `null` if permission denied; else `scheduleNotificationAsync` with `TIME_INTERVAL` trigger. |
| `setRemoteMode` | `"disabled" \| "enabled"` | Sets module-level `remoteMode`. |
| `isRemoteEnabled` | — | `true` iff `remoteMode === "enabled"`. |

---

## Data models

**Not found** — no interfaces/types exported except `RemoteMode` in `supabase.ts` (and implicit notification handler return shape inside `expo-notifications`).

---

## Config & environment variables

**Not found** in `lib/` — no `.env` reads or config files.

---

## Inter-service communication

| Item | Details |
|------|---------|
| **Remote / Supabase** | **Stub only** — `isRemoteEnabled` / `setRemoteMode` are **not** imported elsewhere in the repo (grep); no HTTP or SDK calls. |
| **Notifications** | Uses **local** `expo-notifications` scheduling only. |

---

## Auth & authorization

**Not found** — `lib/` does not implement user auth. `createId("guest")` is used from `core/auth/guestProfile.ts` for local guest profile IDs.

---

## Key business logic

| Unit | Behavior |
|------|----------|
| **`createId`** | Builds unique string IDs from prefix + millisecond timestamp + pseudo-random alphanumeric segment (`Math.random().toString(36).slice(2, 10)`). |
| **`toDateKey`** | Derives calendar date string from **UTC** ISO string slice — **not** local timezone (see Quirks). |
| **`notifications` module load** | Registers global handler: sound on, banner/list on, badge off. |
| **`scheduleTimerEndNotification`** | Ensures permission, then schedules a one-shot interval notification. |

---

## Background jobs / scheduled tasks

**Not found** as cron/background-fetch. **`scheduleTimerEndNotification`** schedules a **local notification** after N seconds via Expo (not a server push).

---

## Error handling

| Location | Behavior |
|----------|----------|
| `ensureNotificationPermission` / `scheduleTimerEndNotification` | No try/catch in file — errors propagate to callers. |
| `scheduleTimerEndNotification` | Returns **`null`** when permission not granted (no throw). |

---

## Testing

| Item | Finding |
|------|---------|
| Tests importing `@/lib/` | **Not found** under `tests/` at time of writing. |
| Indirect coverage | Domain tests may exercise logic that **does not** import `lib/` directly. |

---

## Deployment

**Not found** — `lib/` has no deploy artifacts.

---

## Quirks

1. **`toDateKey` and UTC:** Uses `date.toISOString().slice(0, 10)`, so the “date” reflects **UTC**, not the device’s local calendar. Workspace rules flag this as a **known issue** if date handling is changed without coordination.
2. **`createId` randomness:** Uses **`Math.random()`**, not `crypto` or `uuid` package — matches small helper style but is weaker than cryptographically strong IDs (acceptable for local-only IDs; project rules still mandate this helper over ad-hoc IDs).
3. **`lib/supabase.ts` name:** File suggests Supabase; implementation is only **remote mode toggles** — **no** Supabase client.
4. **`notifications.ts` side effects:** Importing the module runs **`setNotificationHandler`** immediately — any import path pulls in notification configuration.
5. **`uuid` dependency:** Declared in `package.json` but **unused** in application source (per grep).

---

## Consumers (observed import graph)

| Importer | Imports from `lib/` |
|----------|---------------------|
| `core/auth/guestProfile.ts` | `createId` |
| `features/todos/todos.data.ts` | `createId`, `nowIso` |
| `features/habits/habits.data.ts` | `createId`, `nowIso`, `toDateKey` |
| `features/pomodoro/pomodoro.data.ts` | `createId`, `nowIso` |
| `features/workout/workout.data.ts` | `createId`, `nowIso` |
| `features/calories/calories.data.ts` | `createId`, `nowIso`, `toDateKey` |
| `features/pomodoro/PomodoroScreen.tsx` | `scheduleTimerEndNotification` |

**No importers found** for `setRemoteMode` / `isRemoteEnabled` outside `lib/supabase.ts`.

---

## Open questions

1. Whether **`uuid`** will replace or complement **`createId`** — **not decided in code** (package present, unused).
2. Whether **`remoteMode`** will be wired to settings UI or sync — **no** references yet.
