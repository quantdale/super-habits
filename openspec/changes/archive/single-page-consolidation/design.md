# Design: single-page consolidation

## Context

The app's primary navigation used Expo Router's tab API: every section (`/overview`, `/todos`, `/habits`, `/pomodoro`, `/workout`, `/calories`) was a separate route with thin screen wrappers, plus `/settings` and `/command` utility routes. Each route unmounted its screen when the user navigated away, which destroyed local state for stateful surfaces (the Pomodoro timer, todo forms, scrolled lists) and made the PWA feel like a multi-page site rather than a single app. Routes were also a recurring source of bugs (stale `Href` references, `useFocusEffect` timing, accidental navigation).

## Goals / Non-Goals

**Goals:**
- Replace route-based tab navigation with a single root screen that renders all six feature screens, showing only the active section.
- Preserve each section's React state across switches (timers, scroll position, form input, list state).
- Keep sections lazy-mounted on first activation so startup cost is not penalized by all six screens.
- Keep Settings as a full-screen modal and Command as the existing global overlay, removing `/settings` and `/command` routes.
- Preserve the top tab rail and the horizontal swipe gesture (including the 40px edge dead zones) as in-page mechanics.

**Non-Goals:**
- No deep-link redirects from old routes (`/habits`, `/todos`, `/settings`, `/command`).
- No changes to feature data layers, domain logic, entity types, or sync behavior.
- No new animation or navigation dependency.
- No visual redesign of the theme; only navigation mechanics change.
- No lazy data loading beyond lazy first mount; data refresh happens when a section becomes active.

## Decisions

**Single root screen owns section state.** `app/index.tsx` holds `activeSection: 'overview' | 'todos' | 'habits' | 'pomodoro' | 'workout' | 'calories'` in local state. The top tab rail is a plain row of `Pressable` items (no `Tabs`/`TabTrigger`/`TabSlot` from `expo-router/ui`). All six `*Screen` components render inside a shared content container.

**NavigationContext for cross-section coordination.** `core/providers/NavigationProvider.tsx` exposes `activeSection`, `setActiveSection(section)`, `openSettings()`/`closeSettings()`, and `openCommand(context)`/`closeCommand()`. Screens that need to switch sections or open overlays consume this context instead of using `useRouter`. `CommandCenterProvider` derives its launch context from `NavigationContext.activeSection` instead of `useSegments()`.

**Keep sections mounted; show/hide with opacity/pointerEvents/zIndex.** Each section mounts on first activation and stays mounted for the app session. The active section is `opacity: 1`, `pointerEvents: 'auto'`, higher `zIndex`; inactive sections are `opacity: 0`, `pointerEvents: 'none'`, lower `zIndex`. This is the most reliable cross-platform way to keep React state alive while showing one section at a time. `display: 'none'` is avoided because it removes the element from the layout tree and can reset native scroll/list state; unmounting inactive sections is avoided because it destroys their local state.

**Replace `useFocusEffect` with `isActive`-based refresh.** Because the route never changes, focus effects no longer fire on section switch. `lib/useForegroundRefresh.ts` provides `useActiveForegroundRefresh(isActive, onRefresh)`, which runs the refresh when `isActive` transitions to true, plus `useForegroundRefresh` for app-state/visibility changes. All six screens and the settings modal use these. The settings modal loads its data when opened (via its `visible` prop), not via `useFocusEffect`.

**Swipe navigation becomes local state.** The existing horizontal pan/swipe gesture moves to adjacent sections by calling `setActiveSection` instead of `router.navigate`, preserving the 40px left/right edge dead zones so the gesture does not conflict with system back gestures.

**Settings and Command are overlays, not routes.** Settings is a full-screen (or near-full-screen) modal controlled by `isSettingsOpen` state in the root screen. Command remains the existing `GlobalCommandCenterHost` overlay mounted in `app/_layout.tsx`; `app/command.tsx` is deleted. The overlay does not auto-close on section switch because the section switch is now an in-page mechanic instead of a navigation event; the modal's close action (`onRequestClose`) is wired instead of `router.push('/(tabs)/overview')`.

## Impact

- **Breaking changes:** old tab URLs and `/command`/`/settings` routes no longer exist; browser back/forward does not navigate between sections; Android system back exits the app instead of moving between tabs.
- **Dependencies:** none new; `expo-router` tab APIs are no longer used for primary navigation.
- **Data/domain layers:** unchanged.
- **State preservation:** timers, scroll positions, form inputs, and list state survive section switches because inactive sections stay mounted.
- **Startup cost:** inactive sections are created lazily on first activation.
- **Memory/performance:** all six primary screens remain in the React tree after being visited once — acceptable for a personal productivity app with six sections, but should be monitored on low-end devices.
- **Tests:** E2E helpers were rewritten to click the tab rail in-page instead of navigating by URL; route-aware unit tests were updated.

## Verification

- `npm run typecheck` — 0 errors.
- `npm test` — 427 tests across 41 files, all passing.
- `npm run build:web` — static export builds successfully.
- Playwright E2E (14 specs, 90 tests) rewritten to in-page interactions.
- Native smoke test of gesture dead zones and modal behavior remains an open item pending a native device/emulator (task 3.7).
