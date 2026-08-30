## Purpose

Momentum Garden makes useful effort from Super Habits visibly accumulate into one calm, understandable living-progress artifact without introducing a score, punishment mechanic, duplicate event ledger, or new persistence system.

## ADDED Requirements

### Requirement: Garden state is derived from authoritative activity

The Garden MUST be reconstructed deterministically from existing authoritative feature state and MUST NOT require a duplicate momentum-event ledger, a new synced entity, or a second analytics source of truth.

#### Scenario: Identical source state reconstructs identically

- **WHEN** the same bounded SQLite source state is read twice with the same local date and timezone
- **THEN** the resulting Today and recent Garden models contain the same dates, source contributions, levels, milestones, and explanatory text

#### Scenario: Viewing the Garden is read-only

- **WHEN** a user opens the compact or detailed Garden view
- **THEN** the app performs no user-data write, sync enqueue, backup mutation, activity insertion, or feature-state mutation

#### Scenario: Offline source data is available

- **WHEN** the device is offline but its local SQLite data is available
- **THEN** the Garden renders from that local data without requiring Supabase, network access, or a remote Garden record

### Requirement: Contributions remain separate and attributable

The Garden MUST represent meaningful contributions as separately understandable source areas rather than collapsing them into an unexplained score. Every visible growth state MUST be attributable to one or more explicit source facts in the explanation UI.

#### Scenario: A one-domain user receives useful progress

- **WHEN** a user has meaningful activity from only one supported source area
- **THEN** that source area grows visibly and the Garden does not present unused source areas as failures

#### Scenario: Multiple domains are represented independently

- **WHEN** a bounded period contains meaningful activity from tasks, habits, focus, workout, nutrition tracking, or planning/review
- **THEN** each contributing area is represented independently and the explanation identifies the contributing areas and factual counts or dates

#### Scenario: No activity is present

- **WHEN** there are no meaningful contributions for the current day
- **THEN** the Garden shows a neutral ready-state such as “Your garden is ready for today” and does not show warning red, failure language, a zero score, or dead/wilted plants

### Requirement: Contribution semantics use canonical completion facts and explicit caps

The Garden MUST use canonical completion and tracking facts from existing feature semantics. It MUST apply explicit, bounded mapping constants so repeated raw actions cannot create unbounded visual growth.

#### Scenario: Completed tasks contribute

- **WHEN** active todos have canonical completion facts within a Garden day
- **THEN** the Tasks area contributes according to the documented daily cap and ignores deleted, incomplete, or invalid records

#### Scenario: Habit schedule and lifecycle semantics are honored

- **WHEN** habit completions and habit rules are read for a Garden day
- **THEN** only eligible scheduled completions count, off-days are neutral, lifecycle-masked dates do not count as failures, and quantitative targets do not create extra growth from arbitrary repeated increments

#### Scenario: Focus requires a completed session

- **WHEN** focus sessions are present
- **THEN** only completed focus sessions with meaningful recorded duration contribute, while started, abandoned, break, or zero-duration sessions do not contribute

#### Scenario: Workout rewards completed sessions rather than set spam

- **WHEN** workout history contains completed and incomplete session data
- **THEN** a completed workout session can contribute within its explicit daily cap, while individual sets or draft activity cannot create unlimited growth

#### Scenario: Nutrition is neutral tracking behavior

- **WHEN** one or more valid calorie entries are logged for a local day
- **THEN** Nutrition tracking can contribute at most the documented day-level amount regardless of calorie target adherence, and exceeding a target never damages or reddens the Garden

#### Scenario: Planning and review use meaningful completion

- **WHEN** a Daily Plan is completed or a Weekly Review is completed within the bounded period
- **THEN** the corresponding planning/review area contributes at most its explicit day-level amount and incomplete or merely opened records do not contribute

#### Scenario: Goal and project milestones are factual

- **WHEN** an active supported Goal or Project has a canonical completed status and completion timestamp in the bounded period
- **THEN** the Garden may show a rare, attributable milestone without inventing progress, randomizing rewards, or adding a currency

### Requirement: Today and recent history are bounded temporal views

The Garden MUST provide a local-calendar Today view and a bounded recent history view, using the repository’s sanctioned local-date utilities and preserving prior history without turning inactivity into failure.

#### Scenario: Today uses the local calendar day

- **WHEN** a contribution timestamp falls within the current local calendar day under the active timezone
- **THEN** it appears in Today, and a timestamp on the adjacent local day does not

#### Scenario: Seven-day history has a clear boundary

- **WHEN** the recent view is requested for seven days
- **THEN** it contains exactly the current local day and the six preceding local days in chronological order, with no unbounded historical query

#### Scenario: Returning after inactivity

- **WHEN** a user returns after one or more days without contributions
- **THEN** prior Garden history remains visible, the current day is a fresh neutral opportunity, and the UI uses supportive language without broken-streak, dead-plant, warning, or guilt framing

### Requirement: Overview provides a compact Today Garden

The day-oriented Overview MUST include a compact Garden surface at an appropriate hierarchy level while preserving Next Best Action, Today progress, customization, existing metrics, Quick Capture, and Planning/Weekly Review access.

#### Scenario: Overview displays current contribution context

- **WHEN** the Overview loads successfully
- **THEN** the compact Garden shows the Today visual, a factual contributing-area summary or neutral ready-state, and an accessible affordance to open the deeper Garden view

#### Scenario: Overview remains useful with no Garden activity

- **WHEN** the rest of Overview has loaded but Today has no meaningful Garden contribution
- **THEN** the compact Garden occupies a restrained card-sized surface and does not replace or dominate the existing day hierarchy

### Requirement: Progress provides bounded Garden history and explanations

The existing Progress/Planning surface MUST provide a deeper Garden view without adding a seventh primary navigation destination or duplicating the existing numeric Progress charts.

#### Scenario: User opens the deeper Garden view

- **WHEN** the user selects the compact Garden’s view action or opens the existing Progress area
- **THEN** the app presents Today context, recent Garden history, source explanations, and current-week context within the existing Progress/Planning architecture

#### Scenario: Detailed history remains bounded

- **WHEN** the detailed Garden view is opened
- **THEN** it loads a modest bounded history such as the current seven days and an optional 28-day view, rather than an unbounded full-history scan

### Requirement: Garden visuals are accessible and motion-safe

The Garden MUST remain understandable in light and dark themes, with reduced motion enabled, on web keyboard input, and through assistive technology. Graphical shapes MUST NOT be the only carrier of status.

#### Scenario: Screen reader receives a textual equivalent

- **WHEN** assistive technology focuses the Garden summary
- **THEN** it receives a concise label describing the temporal range and contributing areas with factual counts or days, while decorative SVG children remain hidden from the accessibility tree

#### Scenario: Reduced motion is enabled

- **WHEN** the user or operating system enables reduced motion
- **THEN** the Garden uses static or brief opacity-only feedback, disables ambient/bouncing/parallax motion, and exposes the same contribution information

#### Scenario: Web keyboard user opens details

- **WHEN** a keyboard user tabs to the Garden view action and activates it
- **THEN** the control has a visible focus state, an accessible name, and opens the same detailed view as pointer/touch activation

#### Scenario: Theme changes

- **WHEN** the app switches between light and dark themes
- **THEN** Garden geometry, labels, and source distinctions remain legible with semantic theme colors and no color-only meaning

### Requirement: Garden reads are bounded and do not alter synchronization

The Garden read model MUST use bounded source queries and bulk reads appropriate for Overview performance. It MUST not add Garden rows to sync, backup, restore, portable export/import, or account ownership inventories.

#### Scenario: Overview requests Today data

- **WHEN** the compact Overview card requests Garden data
- **THEN** the read model uses a bounded local window and bulk source reads without an N+1 query per habit or source record

#### Scenario: Backup and restore remain source-driven

- **WHEN** a backup is created or a supported dataset is restored
- **THEN** no Garden-specific entity is included and the Garden can be reconstructed from the restored authoritative source data

#### Scenario: Source viewing does not create sync work

- **WHEN** the Garden read model is evaluated before and after opening a view
- **THEN** the durable sync outbox contains the same rows and no remote mutation is requested

### Requirement: Garden feedback is restrained and deterministic

The Garden MAY provide lightweight feedback after meaningful completions, but it MUST remain causal, short, and non-manipulative. It MUST NOT add login rewards, streak punishment, mystery unlocks, loot boxes, leaderboards, social competition, or infinite currencies.

#### Scenario: Ordinary completion feedback

- **WHEN** a supported meaningful action completes and the Garden is visible or refreshed
- **THEN** any feedback is a brief causal growth acknowledgment using the existing feedback motion class and does not interrupt the user with a full-screen celebration

#### Scenario: Rare milestone feedback

- **WHEN** a factual supported Goal, Project, or other deterministic milestone completes
- **THEN** the Garden may show a restrained milestone flourish that is explainable from source data and has no random or economic reward
