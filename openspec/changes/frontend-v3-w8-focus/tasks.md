## 1. Campaign bookkeeping

- [x] 1.1 Author `openspec/changes/frontend-v3-w8-focus/execplan.md` as the only living W8 plan, and point the parent checkpoint at it instead of creating `.agent/execplans/frontend-v3-w8-focus-v1.md`
- [x] 1.2 Check parent tasks 7.1–7.3 only if the W7 slice, defect ledger, and Habits source still support them; record exact-head CI `37825722260` and scheduled run `37848841434` without calling hosted E2E passed
- [x] 1.3 Add the W8 Refero adopt/reject entry to `docs/ui-ux/14-v3-reference-ledger.md` without copying one app wholesale

## 2. Timer hierarchies

- [x] 2.1 Rebuild idle Focus: compact "Focus" heading, no documentation subtitle, selected duration, one start action, compact preset and duration entry, optional task link, and no placeholder dots
- [x] 2.2 Rebuild running, paused, and break hierarchies so the countdown dominates, pause/resume/end are the only session controls, and presets, duration editing, history, garden, and heatmap are absent
- [x] 2.3 Make paused state explicit and frozen, and distinguish short and long breaks from focus without a saturated slab
- [x] 2.4 Hold a completion frame on the finished duration until dismiss or the existing auto-start beat, without delaying the mode commit `start()` already depends on

## 3. Session safety

- [x] 3.1 Confirm end for a running or paused focus or break through `useConfirmationDialog`; cancel preserves deadline, notification, and durable intent
- [x] 3.2 Confirmed end clears intent and notifications and does not log; idle untouched reset stays immediate
- [x] 3.3 Remove silent discards: mode changes, preset application, and duration saves must not alter or abandon an in-flight session; command start remains a conflict
- [x] 3.4 Keep completion logging, pause accounting, reload reconciliation, linked-task attachment, note entry, and preset auto-start behavior equivalent

## 4. Progress, motion, and recovery copy

- [x] 4.1 Replace session dots with one accessible cycle sentence only when it changes the next step
- [x] 4.2 Remove per-tick sprout growth from the active clock; keep garden identity on the history path and honor Reduced Motion
- [x] 4.3 Rewrite background, interrupted, recovered-complete, and storage-failure copy so each is distinct and a real save failure stays visible
- [x] 4.4 Expose timer status on request and announce phase changes only, not every second

## 5. History and tick cost

- [x] 5.1 Move recent sessions, garden, heatmap, and detailed stats behind one secondary History entry that preserves metadata editing
- [x] 5.2 Stop the one-second tick from recomputing or mounting historical models

## 6. Regression coverage

- [x] 6.1 Update strict E2E, Maestro, and simulation selectors for End, confirmation, and the Focus timer region, including the three-months-in section marker
- [x] 6.2 Add tests for idle/running/paused/break/completed hierarchies, confirm cancel, confirmed abandon, single completion log, auto-start once, and paused reload
- [x] 6.3 Add coverage that end labels do not clip at 360px, running hides configuration, cycle text is meaningful, and dark, large-text, and Reduced Motion states hold

## 7. Evidence and gates

- [x] 7.1 Capture the required states under `docs/ui-ux/v3-audit/w8/` and inspect countdown, end controls, confirmation, cycle text, and break labels before closing defects
- [x] 7.2 Mark SYS-08, SYS-09, and SUR-09 verified-fixed only from those renders; leave future-wave defects open
- [x] 7.3 Run typecheck, lint, theme validation, OpenSpec validation, ExecPlan validation, unit and integration tests, Focus E2E, and the visual audit without weakening D14 thresholds
