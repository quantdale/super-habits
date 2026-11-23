# local-reward-ledger Specification

## Purpose

Define the reward ledger and require prior-day reconcile before streak-freeze spend so notification and command writes cannot look like a missed day.

## Requirements

### Requirement: Reward writes stay in the SQLite ledger

The reward ledger records XP events, consumed freezes, completed quests, and
unlocked badges. An award or freeze change MUST dirty the next snapshot and
MUST NOT enqueue individual reward rows. Portable format 3 and cloud scope 10
back up the ledger. Reward-only history counts as local content for account
ownership and restore eligibility.

#### Scenario: Awarding XP does not grow the outbox

- **WHEN** a habit check-in is awarded
- **THEN** a `gamification_events` row exists
- **AND** `sync_outbox` gains no row for that award

#### Scenario: Restore preserves reward progress

- **WHEN** an eligible empty device restores a format 3 file or scope 10 cloud backup
- **THEN** all four reward tables are restored in the same transaction as feature data
- **AND** the original award receipts prevent replay and duplicate XP

#### Scenario: A legacy restore has no reward history

- **WHEN** an eligible empty device restores a backup from before rewards were included
- **THEN** the ledger starts empty and imported activity does not earn XP during reconciliation

### Requirement: Awards are idempotent per action and day

An action identified by kind and source key MUST award at most once. Repeating the same habit check-in, todo completion, or reconcile pass MUST NOT create a second XP event for that source key.

#### Scenario: Undo and re-check the same habit today

- **WHEN** a habit is incremented, awarded, decremented, and incremented again on the same local date
- **THEN** exactly one XP event exists for that habit and date

#### Scenario: Reconcile after a screen already awarded

- **WHEN** a todo completion was awarded via the screen path and housekeeping later reconciles
- **THEN** reconcile reports zero new awards for that todo

### Requirement: Unreported prior-day activity is awarded before a freeze is spent

Housekeeping that runs on foreground, mount, or local-day rollover MUST look up unrewarded feature activity for today and for the previous local calendar day, award matching ledger rows against each action's own date key, and only then decide whether a banked freeze should cover a remaining gap. A day that has real feature activity MUST NOT be treated as a miss. Backfilled awards MUST NOT show the celebration overlay. Lookback MUST stay bounded (today plus the immediately previous local day); months of historical backfill MUST NOT rewrite old streaks.

#### Scenario: Overnight reminder completion does not burn a freeze

- **WHEN** a habit reminder Mark complete action writes a `habit_completions` row for yesterday, the app is not opened until the next local calendar day, and a banked freeze is available
- **THEN** housekeeping awards yesterday's habit action against yesterday's date key
- **AND** that day is active in the streak
- **AND** no freeze is consumed for that day

#### Scenario: Genuine missed day still spends a freeze

- **WHEN** yesterday has no feature activity and no ledger row, the run before yesterday is still alive, and a banked freeze is available
- **THEN** housekeeping spends one freeze on yesterday
- **AND** the streak remains unbroken

#### Scenario: Same-day reminder completion is still backfilled

- **WHEN** a todo reminder Mark done action completes a todo today without calling the screen award path
- **THEN** the next housekeeping pass awards that todo against today
- **AND** no celebration overlay appears for the backfill

### Requirement: Screen awards remain a latency optimization

Feature screens MAY call the award path immediately after a successful write. Missing that call MUST degrade only to a later silent reconcile, never to a permanently lost award for today or yesterday.

#### Scenario: Command-center habit log is eventually awarded

- **WHEN** the Command Center logs a habit without going through a gamification-aware screen
- **THEN** housekeeping awards that action for the local date of the completion
- **AND** the ledger unique key prevents a later screen visit from paying it twice
