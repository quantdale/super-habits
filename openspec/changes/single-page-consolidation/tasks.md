# Tasks for single-page-consolidation

## 1. Planning

- [x] **1.1** Audit every `router.push`, `router.navigate`, `router.replace`, `<Link>`, `Href`, `useFocusEffect`, `useSegments`, and `useRouter` usage that references tab routes, `/command`, `/settings`, or depends on route focus.
- [x] **1.2** Confirm all six `*Screen` components can render together inside one parent and identify which ones refresh on focus.
- [x] **1.3** Design `NavigationContext` API: `activeSection`, `setActiveSection`, `openSettings`, `closeSettings`, `openCommand`, `closeCommand`.
- [x] **1.4** Decide command overlay behavior on section switch (auto-close vs. keep open with stale context).

## 2. Implementation

- [x] **2.1** Create `NavigationContext` and provider in `core/providers/` or `app/index.tsx`.
- [x] **2.2** Create `app/index.tsx` as the single root screen with `activeSection` state, top tab rail using plain `Pressable` components, and settings modal state.
- [x] **2.3** Implement lazy section mount: render a section only after it has been activated for the first time, then keep it mounted.
- [x] **2.4** Render all activated feature screens (`OverviewScreen`, `TodosScreen`, `HabitsScreen`, `PomodoroScreen`, `WorkoutScreen`, `CaloriesScreen`) in a shared container, stacked absolutely.
- [x] **2.5** Implement cross-platform visibility: active section uses `opacity: 1`, `pointerEvents: 'auto'`, higher `zIndex`; inactive sections use `opacity: 0`, `pointerEvents: 'none'`, lower `zIndex`.
- [x] **2.6** Add `isActive` prop or `NavigationContext` read to each screen and replace `useFocusEffect`-based refreshes with `isActive` transition effects.
- [x] **2.7** Update `useForegroundRefresh` consumers to rely on `isActive` for section-switch refresh while keeping app-state/visibility refresh.
- [x] **2.8** Re-implement horizontal pan/swipe navigation between adjacent sections, updating local state instead of routing, preserving 40px left/right edge dead zones.
- [x] **2.9** Add a settings launcher to the root screen and implement a modal overlay controlled by `isSettingsOpen` state.
- [x] **2.10** Update `SettingsScreen` to accept modal `visible` prop and load data on open instead of `useFocusEffect`; replace back link with modal close.
- [x] **2.11** Replace Settings `/command` link with `openCommand(...)` from `NavigationContext`.
- [x] **2.12** Update `CommandCenterProvider` to derive launch context from `NavigationContext.activeSection` instead of `useSegments()`.
- [x] **2.13** Delete `app/(tabs)/` and all tab route wrappers.
- [x] **2.14** Delete `app/command.tsx` and ensure command invocation uses only the global overlay.
- [x] **2.15** Update `app/_layout.tsx` to remove `(tabs)` and `command` stack screen entries.
- [x] **2.16** Update all internal references that pointed to tab routes, `/command`, or `/settings`:
  - [x] **2.16.1** OverviewScreen section shortcuts (Start Focus → pomodoro, Add entry → calories, settings icon → openSettings).
  - [x] **2.16.2** CommandScreen back/close action.
  - [x] **2.16.3** Any other remaining `Href`/router usage.

## 3. Verification

- [x] **3.1** Run `npm run typecheck` and fix all type errors.
- [x] **3.2** Run `npm test` and fix failing unit tests.
- [x] **3.3** Run `npm run build:web` and verify the static export builds successfully.
- [x] **3.4** Rewrite E2E navigation helpers in `e2e/helpers/` to use in-page interactions instead of `page.goto('/(tabs)/...')` or `page.goto('/settings')`.
- [x] **3.5** Run Playwright E2E specs and update selectors/route navigation to match the single-page model.
- [x] **3.6** Smoke test on web: tab switching, swipe gestures, Pomodoro timer state across switches, settings modal, and command overlay.
- [ ] **3.7** Smoke test on at least one native target to confirm gesture dead zones and modal behavior.
