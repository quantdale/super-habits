# Single-page navigation

## Purpose

Define the app's single-page navigation model: all six feature sections (Overview, Todos, Habits, Pomodoro, Workout, Calories) render from one root screen behind local `activeSection` state, sections stay mounted (lazily on first activation) so their state survives switching, Settings is a modal overlay, the Command Center is a global overlay, and routed tab/settings/command URLs no longer exist.

## Requirements

### Requirement: Single root entry point with section state

The app SHALL render all six primary sections (Overview, Todos, Habits, Pomodoro, Workout, Calories) from a single root screen, with exactly one section visible at a time driven by local `activeSection` state — not by URL changes. The root screen SHALL render a top tab rail and a shared content container.

#### Scenario: App boots to the Overview section

- **WHEN** the app starts
- **THEN** the root screen is the single entry point and the Overview section is the active, visible section.

#### Scenario: Tapping a tab switches the visible section

- **WHEN** the user taps the "Habits" tab in the top rail
- **THEN** `activeSection` becomes `habits` and only the Habits section is visible.

### Requirement: Section switching through NavigationContext

The app SHALL expose a `NavigationContext` (backed by `core/providers/NavigationProvider`) that provides `activeSection`, `setActiveSection(section)`, `openSettings()`/`closeSettings()`, and `openCommand(context)`/`closeCommand()`. Child screens SHALL use this context to switch sections or open overlays instead of using `useRouter` or URL navigation.

#### Scenario: Overview shortcut switches section

- **WHEN** the user taps "Start Focus" on the Overview section
- **THEN** `setActiveSection('pomodoro')` is called and the Pomodoro section becomes active, with no URL navigation.

#### Scenario: Settings launcher opens the modal

- **WHEN** the user taps the settings icon
- **THEN** `openSettings()` is called and the Settings modal overlay is shown.

### Requirement: State-preserving lazy section mounting

Each section SHALL be mounted on first activation and remain mounted for the app session. The active section SHALL use `opacity: 1`, `pointerEvents: 'auto'`, and a higher `zIndex`; inactive sections SHALL use `opacity: 0`, `pointerEvents: 'none'`, and a lower `zIndex`. Sections SHALL NOT be unmounted on switch, and `display: 'none'` SHALL NOT be used to hide inactive sections.

#### Scenario: Timer state survives a section switch

- **WHEN** the user starts the Pomodoro timer, switches to Todos, and switches back to Pomodoro
- **THEN** the timer is still running with its original remaining time or state, because the Pomodoro section stayed mounted.

#### Scenario: Sections mount lazily on first activation

- **WHEN** the app starts and the user has only visited Overview
- **THEN** only the Overview section is mounted; the other five sections are created on their first activation.

### Requirement: Refresh on activation instead of route focus

Screens rendered inside the root screen SHALL refresh their data when their `isActive` flag transitions from `false` to `true`, via `useActiveForegroundRefresh` (which combines app-state/visibility refresh with activation refresh). `useFocusEffect`-based refreshes SHALL NOT be used for section-switch refresh.

#### Scenario: Returning to a section refreshes its data

- **WHEN** the user switches to the Calories section, adds an entry, switches away, and switches back
- **THEN** the Calories section refreshes its list on the activation transition.

### Requirement: Swipe navigation with edge dead zones

Horizontal pan/swipe gestures SHALL switch between adjacent sections by updating local `activeSection` state. Swipes that start within the 40px left or right screen-edge dead zones SHALL NOT trigger a section switch.

#### Scenario: Swipe from the middle switches section

- **WHEN** the user swipes left from the middle of the screen on the Overview section
- **THEN** the Todos section becomes active.

#### Scenario: Swipe from the edge does not switch section

- **WHEN** the user starts a horizontal swipe within the 40px left or right edge of the screen
- **THEN** no section switch occurs, preserving system back-gesture compatibility.

### Requirement: Settings as a modal overlay

Settings SHALL be presented as a full-screen or near-full-screen modal overlay controlled by `isSettingsOpen` state in the root screen and exposed through `NavigationContext`. Settings data loads when the modal opens, not via `useFocusEffect`. There SHALL be no `/settings` route.

#### Scenario: Opening Settings loads its data

- **WHEN** the user opens the Settings modal
- **THEN** the modal renders `SettingsScreen` and its data loads on open.

#### Scenario: Closing Settings returns to the previous section

- **WHEN** the user closes the Settings modal
- **THEN** the modal is dismissed and the previously active section remains active, with no route change.

### Requirement: Command center as a global overlay only

The Command Center SHALL be invoked via the existing global overlay (`GlobalCommandCenterHost` mounted in `app/_layout.tsx`) and SHALL NOT have a standalone `/command` route. `CommandCenterProvider` SHALL derive its launch context from `NavigationContext.activeSection`.

#### Scenario: Command overlay derives context from the active section

- **WHEN** the user opens the command center while the Calories section is active
- **THEN** the overlay reports the launch context of the section it was opened from (`calories`).

#### Scenario: No command route remains

- **WHEN** the app's route tree is inspected
- **THEN** there is no `/command` route; the command surface is reachable only through the global overlay.

### Requirement: Removal of routed tab and utility routes

The `app/(tabs)/` directory (with `_layout.tsx` and all six tab route wrappers), `app/settings.tsx`, and `app/command.tsx` SHALL be removed. No deep-link backward compatibility is required from the removed routes.

#### Scenario: Old routes no longer navigate to sections

- **WHEN** a browser requests the old route `/habits`, `/settings`, or `/command`
- **THEN** the SPA rewrite serves the root screen and there is no dedicated route handler for the old path.
