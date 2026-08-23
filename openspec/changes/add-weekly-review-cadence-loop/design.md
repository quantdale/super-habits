# Design — Weekly Review Cadence Loop

## Approach

Follow the proven `dailyPlanReminderScheduler` shape end-to-end:

1. **Domain (`weeklyReviewReminder.domain.ts`)** — pure helpers:
   - `nextWeeklyOccurrence(now: Date, weekday: number, minutesOfDay: number): Date` — computes the next local-calendar occurrence strictly after `now`; handles same-day past-time rollover and DST shifts by recomputing wall-clock parts rather than adding 7×24h.
   - Preference codec: `{ enabled, weekday, hour, minute }` ↔ AsyncStorage JSON under `superhabits.notifications.weekly-review-reminder`.
2. **Bridge (`core/notifications/weeklyReviewReminderScheduler.ts`)** — single repeating identifier `weekly-review-reminder:weekly`; on enable/change cancel-then-schedule via `setNotificationHandler`-safe calendar trigger; disable cancels. Mirrors `dailyPlanReminderScheduler` incl. native-only guard.
3. **Entry** — notification data carries `{kind:'weekly-review-reminder'}`; response dispatcher routes to opening the Planning Hub's Review surface (same routing style as habit reminders opening their section).
4. **Settings UI** — Notifications bucket gains "Weekly review" row: toggle + weekday chips + time picker; on web renders with the established native-only availability note while still persisting preference.
5. **Backup** — append `{weeklyReviewReminder}` last to the V3 canonical settings text; validators updated; restore/portable tests assert round-trip and version compatibility.

## Risks / mitigations

- Duplicate notifications on preference churn → single fixed identifier + cancel-before-schedule.
- Settings version drift → append-only rule keeps V3; canonical checksum covers new tail automatically.
- Web promise-breaking → explicit copy + no scheduling call.

## Validation

Unit (occurrence math incl. DST cases, codec round-trip, canonicalization), integration (settings snapshot round-trip), focused e2e where deterministic; `qa:affected` gate selection.
