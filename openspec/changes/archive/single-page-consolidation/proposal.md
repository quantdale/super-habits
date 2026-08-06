# Redesign primary navigation as a single-page experience

## Summary

Rebuild the app's primary navigation from scratch around a single root route (`/`). All six feature surfaces — Overview, Todos, Habits, Pomodoro, Workout, and Calories — will coexist in one screen, with only the active section visible. Sections remain mounted when inactive so their React state (timers, scroll position, form input, list state) is preserved, but they are rendered lazily on first activation to limit startup cost. Section switching is driven by local React state, not URL changes. Settings becomes a modal overlay launched from the root screen. Command relies entirely on the existing global command overlay and no longer has a standalone `/command` route. The `app/(tabs)` directory and `app/command.tsx` will be removed. No deep-link backward compatibility is required.

## Motivation

The current navigation uses Expo Router's tab API, which gives every section its own URL (`/habits`, `/todos`, etc.) and unmounts screens when the user switches away. This is unnecessarily complex for an offline-first personal app, breaks the single-page-app feel on the web/PWA, and causes state loss for surfaces like the Pomodoro timer, todo forms, and scrolled lists. A single-page model is simpler, keeps every section alive in the same React tree, and removes routing as a source of bugs.

## Proposed Solution

1. **Single root entry point**
   - Replace the existing `app/index.tsx` redirect with a real root screen.
   - It owns a local `activeSection` state: `'overview' | 'todos' | 'habits' | 'pomodoro' | 'workout' | 'calories'`.
   - It renders a top tab rail and a shared content container.

2. **Navigation context for cross-section coordination**
   - Create a `NavigationContext` (or extend an existing top-level context) exposed from `core/providers/` or `app/index.tsx`.
   - Expose at minimum:
     - `activeSection`
     - `setActiveSection(section)`
     - `openSettings()` / `closeSettings()`
     - `openCommand(context)` / `closeCommand()`
   - All child screens that need to switch sections or open overlays will consume this context instead of using `useRouter`.

3. **Preserve state by keeping all sections mounted (lazy-first)**
   - Render all six `*Screen` components inside the content container, but create each screen on first activation rather than at app startup.
   - Once a section has been activated once, keep it mounted forever (or until app restart).
   - Stack sections absolutely so they occupy the same layout space.
   - Show the active section with `opacity: 1`, `pointerEvents: 'auto'`, and a higher `zIndex`.
   - Hide inactive sections with `opacity: 0`, `pointerEvents: 'none'`, and a lower `zIndex`.
   - This is the most reliable cross-platform way to keep React state alive while showing only one section at a time.
   - Avoid `display: 'none'` because it removes the element from the layout tree and can reset native scroll/list state on some platforms.
   - Avoid unmounting inactive sections because that would destroy their local state.

4. **Replace `useFocusEffect` refresh semantics with `isActive`-based effects**
   - `useFocusEffect` from `expo-router` no longer fires on section switch because the route never changes.
   - Each screen that currently refreshes on focus (Overview, Workout, Settings) will instead receive an `isActive` flag or read `activeSection` from `NavigationContext`.
   - Use a `useEffect` that runs the refresh only when `isActive` transitions from `false` to `true`.
   - Keep the existing `useForegroundRefresh` behavior for app-state/visibility changes.
   - For the settings modal, trigger data loads via a `visible` prop/`useEffect` when the modal opens.

5. **Rebuild the tab rail from scratch**
   - Replace the current `Tabs`/`TabTrigger`/`TabSlot` from `expo-router/ui` with a plain React Native implementation.
   - Use simple `Pressable` tab items backed by `setActiveSection`.
   - Preserve the current visual design (theme-aware colors, top rail, active indicator) but simplify the implementation.

6. **Preserve swipe navigation with edge dead zones**
   - Keep the horizontal pan/swipe gesture for moving between adjacent sections.
   - Adapt the gesture worklet to call `setActiveSection` directly instead of `router.navigate`.
   - Preserve the existing 40px left/right edge dead zones so the gesture does not conflict with system back gestures.

7. **Settings as modal overlay**
   - Remove `app/settings.tsx` as a separate route.
   - Add a settings launcher to the root screen that opens a full-screen or near-full-screen modal rendering the existing `SettingsScreen` content.
   - The modal is controlled by local `isSettingsOpen` state in the root screen and exposed via `NavigationContext`.
   - Replace the Settings "Back to overview" button with a simple modal close action.
   - Replace the Settings `/command` link with a call to `openCommand(...)` from `NavigationContext`.
   - Load settings data when the modal opens, not via `useFocusEffect`.

8. **Command as global overlay only**
   - Remove `app/command.tsx` as a standalone route.
   - Keep and rely on the existing `GlobalCommandCenterHost` and `CommandCenterProvider` for command invocation.
   - Update `CommandCenterProvider` to derive the current launch context from `NavigationContext.activeSection` instead of `useSegments()` and `(tabs)`.
   - Remove any internal links or routes that point to `/command`.
   - Decide and document whether the command overlay auto-closes when the active section changes.

9. **Update internal navigation links**
   - OverviewScreen: "Start Focus" → `setActiveSection('pomodoro')`; "Add entry" → `setActiveSection('calories')`; settings icon → `openSettings()`.
   - CommandScreen: back/close action → `onRequestClose` instead of `router.push('/(tabs)/overview')`.
   - Any other `router.push`/`router.navigate`/`Href` references to tab routes must be replaced with context calls.

10. **Remove routed tab infrastructure**
    - Delete the entire `app/(tabs)/` directory, including `_layout.tsx` and all six tab wrappers.
    - Update `app/_layout.tsx` to remove `(tabs)` and `command` stack screen entries.
    - Keep `app/+not-found.tsx` for invalid URLs.

11. **Update tests**
    - Rewrite Playwright E2E helpers that navigate via `page.goto('/(tabs)/overview')`, `/settings`, or `/command` to use the new in-page interactions.
    - Update selectors in E2E specs to target the new root screen and modal.
    - Update any unit tests that reference tab routes or routing helpers.

## Non-goals

- No deep-link redirects from old routes (`/habits`, `/todos`, etc.).
- No changes to feature data layers, domain logic, entity types, or sync behavior.
- No new animation library or navigation dependency.
- No redesign of the visual theme; only the navigation mechanics change.
- No section-level animations in the first iteration; fade transitions can be added later if desired.
- No lazy data loading for inactive sections beyond lazy first mount; data refresh happens when a section becomes active.

## Impact

- **Breaking changes:** Old tab URLs and `/command`/`/settings` routes will no longer exist. Browser back/forward will not navigate between sections. Android system back will exit the app instead of moving between tabs.
- **Dependencies:** No new dependencies. The `expo-router` tab APIs (`Tabs`, `TabTrigger`, `TabSlot`) will be removed from primary navigation use.
- **Data/domain layers:** Unchanged.
- **State preservation:** Timers, scroll positions, form inputs, and list state survive section switches because inactive sections stay mounted.
- **Startup cost:** Inactive sections are created lazily on first activation, so initial app startup is not penalized by rendering all six screens at once.
- **Memory/performance:** All six primary screens remain in the React tree after they have been visited once. This is acceptable for a personal productivity app with six sections but should be monitored on low-end devices.
- **Tests:** E2E helpers and route-aware unit tests require substantial updates, not just selector tweaks.
