# Reference pattern ledger — 2026-09-01

This is a transfer ledger, not a visual-copy board. References inform interaction
principles and information hierarchy; SuperHabits keeps its own tokens, colors,
icons, copy, data model, and Warm Momentum Garden.

## Sources

- [Mobbin About](https://mobbin.com/about) — Mobbin describes a curated,
  searchable library intended to make design ideas easier to access.
- [Mobbin mobile bottom-sheet references](https://mobbin.com/explore/mobile/ui-elements/bottom-sheet)
  — the reference collection groups bottom sheets with card, tab bar, accordion,
  guided tour, progress, search/filter, adding/creating, settings/preferences,
  and logging/tracking patterns.
- [Material 3 bottom sheets](https://m3.material.io/components/bottom-sheets/overview)
  — bottom sheets show secondary content anchored to the bottom; modal and
  standard sheets are distinct patterns.
- [Material 3 navigation bar overview](https://m3.material.io/components/navigation-bar/overview)
  — compact navigation is intended to let people switch between views on
  handheld devices.
- [Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/apps)
  — recommends at least 48dp touch targets, adequate contrast, purpose-based
  descriptions, and non-redundant labels.

## Transferable patterns

| Product problem                            | Reference principle                                                                                     | Why it transfers                                                                            | SuperHabits adaptation                                                                                                            | Deliberately not copied                                                    | Metric / acceptance                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Six labels truncate at Android text scale  | Compact navigation should preserve recognizable destinations and touchable targets.                     | The shell is a handheld view-switching task, not a decorative rail.                         | Keep six existing sections and state keys, but use a compact-width multi-row rail with full labels; desktop stays one row.        | No copied brand rail, icon set, colors, or exact spacing.                  | All six labels readable in Mobile Next hierarchy/screenshot at target text scale; each target remains ≥48dp.   |
| Quick capture and command actions overlap  | Adding/creating references commonly use a single clear action surface, often a sheet.                   | The user wants to record an item, not select an internal parser.                            | One primary Add/Capture FAB opens the existing sheet; destination chips and natural language are advanced choices inside it.      | No copied bottom-sheet chrome, illustrations, or branded action menus.     | One primary global add target; no overlap; Task can be captured in one focused flow.                           |
| Advanced options compete with first action | Accordions and progressive disclosure keep secondary content available without leading.                 | Settings, filters, stats, and parser modes are legitimate but not every visit.              | Retain components and semantics; move/reduce top-level competition and activate advanced controls after the core action.          | No copied disclosure animations or proprietary card compositions.          | First viewport exposes one primary action on Today, Focus, Form Calories; secondary controls remain reachable. |
| Modal context is unclear                   | Bottom sheets are anchored secondary content; modal sheets should have one clear title/action boundary. | Quick Capture is a short task and should feel temporary; Settings is a full utility drawer. | Keep existing `Modal` primitive and layouts; rename capture heading to Add and eliminate duplicate inner titles where safe.       | No exact sheet heights, scrims, handle treatment, or layout cloning.       | Accessibility tree has one meaningful title and close action per modal; keyboard/native dismissal still works. |
| Stats delay action                         | Reference dashboards prioritize a primary content block then supporting data.                           | Habit check-in, focus start, workout resume, and food log are action-first jobs.            | Reorder existing read-only cards behind today’s action; no aggregate or persistence rewrite.                                      | No copied dashboard templates or gamification.                             | Primary action visible without scrolling on Nitro API 36; aggregate oracles unchanged.                         |
| Controls need reliable semantics           | Android guidance favors 48dp targets and purpose/result descriptions.                                   | Large text and TalkBack-like hierarchy exposed real baseline defects.                       | Preserve accessibility labels; ensure new compact nav and Add affordances use explicit role/labels and avoid redundant icon text. | No reliance on coordinates or color alone.                                 | Mobile Next labels are unique/purposeful; hit targets ≥48dp; contrast remains acceptable.                      |
| Warm Momentum should not become pressure   | The existing Garden copy and gentle progress patterns favor supportive feedback.                        | Productivity surfaces can accidentally turn progress into a score chase.                    | Use “next useful action”, “today”, and “done” language; keep garden as reflection/orientation, not streak pressure.               | No streak gambling, badges, confetti, urgency timers, or engagement loops. | Empty states reassure and offer one next step; no new score/notification mechanism.                            |

## Design guardrails

1. Transfer behavior, not trade dress. A reference can justify a sheet or an
   accordion; it cannot justify copying its visual identity.
2. Keep the app's existing token system (`core/theme`, `core/ui`, section
   accents) as the only styling authority.
3. Treat accessibility and Android large-text screenshots as first-class design
   evidence, not after-the-fact QA.
4. Every simplification must leave a path to the mature capability and preserve
   the existing data contract.
