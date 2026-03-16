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
- Tabs layout: app/(tabs)/_layout.tsx — defines 5 tab items
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
  FlashList requires estimatedItemSize prop
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
3. DB init (getDatabase() called once on mount)
4. Service worker registration (web only)
5. Guest profile creation (core/auth/guestProfile.ts)

Do NOT add DB calls before AppProviders initializes. Any component that
calls a *.data.ts function must be a descendant of AppProviders.

## Guest profile (core/auth/guestProfile.ts)
- Creates a guest user row in app_meta table on first launch
- Returns existing profile on subsequent launches
- Used as the user identity until Supabase auth is implemented
- Do not replace this with a real auth system without a migration plan

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
- Current count: 6 tests passing

## Metro / build config
- metro.config.js: WASM support, COOP/COEP headers (required for web)
- babel.config.js: expo preset + nativewind + reanimated (order matters)
- Do not change babel plugin order — reanimated must be last

## Known dead/unused code
- App.tsx — legacy, not used by expo-router
- index.ts — legacy registerRootComponent, not used
- nextPomodoroState() in pomodoro.domain.ts — dead code
- lib/supabase.ts — placeholder, REMOTE_MODE = false, not used
