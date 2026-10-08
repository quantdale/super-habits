## 1. Check-in view-model

- [x] 1.1 Add a pure selected-date check-in model: date-specific target, actionable reason, binary vs quantitative, completion state, current-streak labeling, and date-scoped summary
- [x] 1.2 Add semantic tone mapping so not-started and in-progress counts are never danger, including a 0/99 identity-red habit
- [x] 1.3 Unit-test schedule, historical target, lifecycle mask, creation boundary, summary date mismatch, streak labeling, and tone

## 2. Daily list

- [x] 2.1 Replace the circular grid with flat check-in rows and quiet time-of-day labels, omitting empty groups
- [x] 2.2 Wire binary check/undo and quantitative increment/decrement through the existing completion APIs, including accessible names and roles
- [x] 2.3 Collapse status and sort into one filter sheet and keep the day strip secondary
- [x] 2.4 Label the summary for the selected date and stop mixing today's counts into a historical day

## 3. Detail, trends, and editor reachability

- [x] 3.1 Fold progress insights into the existing habit detail surface and remove the per-row Progress pill
- [x] 3.2 Move aggregate rhythm analytics behind one Trends entry and remove the screen-wide wall
- [x] 3.3 Remove global edit mode; keep edit, pause, archive, restore, and delete on the habit detail surface

## 4. Regression coverage and evidence

- [x] 4.1 Update affected E2E, Maestro, and simulation selectors without weakening persistence, schedule, linked-action, reminder, or XP oracles
- [x] 4.2 Record W7 reference decisions and close SUR-05, SYS-16, and SYS-12 only after rendered inspection
- [x] 4.3 Capture the required W7 screenshots, run the Habits validation gates, and reconcile the parent campaign checkpoint
