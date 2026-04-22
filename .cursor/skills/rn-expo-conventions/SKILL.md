---
name: rn-expo-conventions
description: React Native and Expo conventions for SuperHabits. Use when writing UI, screens, navigation, styling, or platform-specific code.
---

# REACT NATIVE + EXPO CONVENTIONS — SuperHabits

Apply this when writing any UI, navigation, or platform-specific code.

## Routing (expo-router v55)
- File-based routing: app/ directory mirrors URL structure
- Tab routes: app/(tabs)/{name}.tsx
- Root layout: app/_layout.tsx — wraps everything in AppProviders
- Tabs layout: app/(tabs)/_layout.tsx — defines 6 tab items including Overview
- Non-tab utility routes: app/command.tsx and app/settings.tsx
- Navigation: use expo-router's <Link> or router.push(), never React Navigation directly
- Tab names and hrefs defined in (tabs)/_layout.tsx

## Styling (NativeWind v4 + Tailwind v3)
- Use className prop with Tailwind utility classes everywhere
- Brand colors defined in tailwind.config.js:
  primary: (check tailwind.config.js for actual values)
- Global CSS: global.css (Tailwind entry)
- NEVER use StyleSheet.create() for new code — use className
- NEVER use inline style objects except for dynamic values that Tailwind can't express

## React Native specifics
- List rendering: use @shopify/flash-list (FlashList), not FlatList
  This project uses **FlashList v2** (`@shopify/flash-list@2.x`): `estimatedItemSize` is **not** required in TypeScript props (differs from v1 docs). **TodosScreen** uses `data`, `renderItem`, and `keyExtractor` only.
- Animations: use react-native-reanimated (not Animated from RN core)
- SVG: react-native-svg (react-native-svg components, not <svg> HTML)
- Safe area: use <Screen> from core/ui/Screen.tsx (wraps SafeAreaView)
- Keyboard avoiding: use KeyboardAvoidingView if input forms need it

## Platform detection
- Platform.OS === 'web' | 'ios' | 'android'
- Service worker registration only on web (core/pwa/registerServiceWorker.ts)
- Notifications only on ios/android (not web)

## State management
- Local UI state: useState (only pattern currently in use)
- Persistent state: SQLite via *.data.ts functions
- Global state: zustand is installed but UNUSED — do not wire up without discussion
- Server cache: React Query is installed but UNUSED — do not add hooks without discussion
- Refresh pattern: after any mutation, re-call the list function and setState

## Notifications (lib/notifications.ts)
- expo-notifications
- Request permissions before scheduling
- Not available on web (check platform before calling)
- Currently used for: Pomodoro timer completion alerts

## AppProviders (core/providers/AppProviders.tsx)
The following are initialized here in order:
1. QueryClient (React Query — dormant)
2. GestureHandlerRootView (required for @shopify/flash-list + gestures)
3. DB init (initializeDatabase / getDatabase on mount)
4. Service worker registration (web only)
5. Guest profile creation (core/auth/guestProfile.ts)
6. **`ensureAnonymousSession()`** (`lib/supabase.ts`) when Supabase env is configured

When **`isRemoteEnabled()`** is true (`lib/supabase.ts` — **`remoteMode` defaults to `"enabled"`**), a separate effect registers **`syncEngine.flush()`** on a **30s** interval, on web visibility (hidden), and on NetInfo reconnect — **not** when `setRemoteMode("disabled")` is used.

Do NOT add DB calls before AppProviders initializes. Any component that
calls a *.data.ts function must be a descendant of AppProviders.

## Guest profile (core/auth/guestProfile.ts)
- Creates a guest user row in app_meta table on first launch
- Returns existing profile on subsequent launches
- Local **`app_meta`** identity for the app; **remote** backup uses **Supabase anonymous auth** + `SupabaseSyncAdapter` (separate from guest JSON)
- Do not remove guest profile without considering onboarding / local-only flows

## TypeScript
- Strict mode enabled (tsconfig.json)
- Path alias: @/ maps to project root
- All DB entity types in core/db/types.ts
- No any types — use unknown and narrow, or add proper types

## Testing (Vitest v3)
- Config: vitest.config.ts (node environment, @/ alias)
- Test files: tests/ directory
- Run: npm test
- Only pure function tests (no DB, no component rendering yet)
- Every new domain function needs a test
- Current count: 322 tests passing — update whenever tests are added or removed

## Metro / build config
- metro.config.js: WASM support, COOP/COEP headers — **COEP** is `require-corp` (aligned with `app.json` for `crossOriginIsolated` on web)
- **vercel.json** (repo root): static web deploy — same COOP/COEP on all routes + SPA rewrite to `/index.html` (see knowledge base)
- babel.config.js: expo preset + nativewind + reanimated (order matters)
- Do not change babel plugin order — reanimated must be last

## Known dead/unused or legacy code
- App.tsx — legacy, not used by expo-router
- index.ts — legacy registerRootComponent, not used
- `nextPomodoroState()` in `pomodoro.domain.ts` — **used in Vitest**; PomodoroScreen does not import it yet (labels inline)
- lib/supabase.ts — optional Supabase client from `EXPO_PUBLIC_*`; **`remoteMode` defaults to `"enabled"`**; `ensureAnonymousSession` on bootstrap; `setRemoteMode` / `isRemoteEnabled` gate flush (not wired from product UI by default)

## MCP tools (development workflow)

Three MCP servers are commonly configured for this project in the user’s MCP config (e.g. `~/.cursor/mcp.json`):

| Server | Package | Key tools | Used for |
|--------|---------|-----------|----------|
| playwright | `@playwright/mcp@latest` | browser_navigate, browser_evaluate, browser_take_screenshot, browser_console_messages | Web inspection, pre-PR checks |
| lighthouse | `@danielsogl/lighthouse-mcp@latest` | Lighthouse audit tools | Performance, PWA, accessibility |
| fetch | mcp-server-fetch (uvx) | fetch | HTTP header verification |

Use **/inspect-web** and **/pre-pr** for browser-based checks. Use **/audit-performance** for Lighthouse scores.

## E2E Testing (Playwright)

E2E tests live in `e2e/` at the project root.

**Setup files:**
- `playwright.config.ts` — config (`headless: true`, Chromium only, `workers: 1` for OPFS/SQLite lock on web, HTML report paths)
- `e2e/global.setup.ts` — confirms `crossOriginIsolated` before the suite runs
- `e2e/helpers/navigation.ts` — `goToTab()`, `waitForDb()`, `hardReload()`
- `e2e/helpers/db.ts` — `clearDatabase()` via OPFS `removeEntry()`

**`clearDatabase()` pattern:** Called in `test.beforeEach` (not `afterEach`) so failures leave state intact for debugging. Deletes `superhabits.db`, `.db-wal`, `.db-shm` from OPFS then reloads the page.

**Selector conventions for React Native Web:** RN Web renders components differently from standard HTML. Prefer in this order:
1. `getByText('exact label')` for visible copy
2. `getByPlaceholderText(/hint/i)` or `getByPlaceholder(...)` for inputs
3. `getByRole('button', { name: /label/i })` when accessible names match
4. Label-scoped DOM (e.g. text label → sibling `input`) or helpers in `e2e/helpers/forms.ts` for controlled `TextInput` (often needs click + `type()` with delay, not `fill()` alone)
5. `locator('[data-testid="..."]')` — only if already present in a component

Do NOT add `data-testid` to components to make tests pass.

**Running after UI changes:**
  npx playwright test e2e/{feature}.spec.ts
If a UI change breaks a selector, fix the selector in the spec. Use `/e2e-fix` to auto-detect and repair selector mismatches.

**Output locations:**
- HTML report: `.cursor/playwright-output/e2e-report/`
- Failure screenshots / traces: `.cursor/playwright-output/e2e-failures/`
- Under `.cursor/playwright-output/` (gitignored as appropriate in `.gitignore`)
