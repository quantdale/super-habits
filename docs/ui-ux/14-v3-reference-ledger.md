# Frontend V3 — Reference Decision Ledger

Campaign-mandated record of external reference research (Refero) and what
SuperHabits adopts or rejects from each. Maintained throughout the campaign;
append per major UI area. Research method: Refero styles (visual language) +
screens (product patterns) + flows (multi-step journeys), synthesized rather
than copied.

---

## R1. Visual foundation — calm productivity styles

**Queried:** "calm minimal productivity app neutral canvas typography
hierarchy" (styles).

| Reference           | Learned                                                                                                                    | Adopt                                                                                                 | Reject                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Perplexity AI (web) | Warm ivory neutrals, black/graphite text, sparse accents, flat surfaces separated by tone; "clinical calm"                 | Neutral canvas as the default; discipline of one accent per view; flat surfaces with hairline borders | Full monochrome austerity (SuperHabits keeps section identity) |
| Todoist (web style) | Soft off-white, charcoal text, one vivid red-orange accent used sparingly on primaries; "neatly arranged desk in daylight" | Single-accent discipline per screen; warm neutral base; rounded-but-not-inflated geometry (8–16)      | Red-orange as brand (we keep per-section hues)                 |
| ChatGPT (web style) | Fog sidebar vs white canvas; spare monochrome nav; black filled primary vs outlined secondary                              | Two-level surface split (rail vs canvas); high-contrast primary/secondary button pairing              | Emptiness as a feature (our screens are content-dense)         |
| Doo (web style)     | One vivid violet reserved for the single primary button; everything else typographic                                       | "Color = the one action you should take"                                                              | Oversized device-mockup presentation                           |

**Synthesis:** Calm Momentum's canvas hierarchy (§3 of design system) and the
four-level action hierarchy (§7) come from this group.

## R2. Task throughput screens

**Queried:** "task list todo app with checkboxes" (iOS screens).

| Reference        | Screen evidence                                                                                                   | Adopt                                                                             | Reject                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| Todoist (iOS)    | Flat single-column list; collapsible groups; red FAB; tasks = checkbox + title + tiny metadata; dates inline      | Flat row anatomy; group headers as small text, not cards; FAB as single clear add | Saturated red header bars               |
| Superlist (iOS)  | Searchable checklist; completed = checked circle + muted strikethrough; metadata (dates/tags/avatars) second-line | Completed-state treatment (muted + strikethrough); metadata as quiet second line  | Heavy dark chrome per row               |
| Amie (iOS)       | Section headers with counts; date/time badges right-aligned; keyboard-first add                                   | Right-aligned metadata column discipline; badges only when true status            | —                                       |
| Structured (iOS) | Category icon + duration + bold title cards; bottom-sheet inbox                                                   | Category icon as the only hue carrier on a row                                    | Card-per-task when list density matters |
| Craft (iOS)      | Date-heading list with completed collapse; bottom entry bar fixed                                                 | Fixed bottom quick-add bar as capture pattern                                     | —                                       |

**Synthesis for To Do (W6):** flat rows (48–56pt), checkbox + title + one
metadata line, group headers as text, quick-add always reachable, completed
muted. No card-per-task default. View modes (Cards/List/Grid) become
List-first with Cards as optional.

## R3. Habit tracking screens

**Queried:** "habit tracker daily check-in streak" (iOS screens).

| Reference               | Screen evidence                                                                                                                      | Adopt                                                                                          | Reject                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| Atoms (iOS)             | Habit detail = goal statement + frequency + one calendar-heatmap card; stats collapsed into the card footer; motivational line short | Detail screen separates _daily action_ from _reflection_; heatmap as the analytics centerpiece | Avatar header row bulk                 |
| Not Boring Habits (iOS) | Ultra-minimal list: icon + name + count; + NEW HABIT row; hidden-section divider; checkmark right                                    | List-first daily screen; unmistakable completion state; restrained metadata                    | All-caps display type everywhere       |
| Roots (iOS)             | Streak = big number + milestone list with locked/active states                                                                       | Milestone ladder for streaks (gamification surface, not daily screen)                          | —                                      |
| Haptic (iOS)            | Monthly bar chart + 3×2 stats grid + journal card                                                                                    | Stats grid pattern for the analytics sheet                                                     | Analytics on the daily check-in screen |

**Synthesis for Habits (W7):** daily screen = flat check-in list with
unmistakable state; progress ring per habit (small, hue-coded); group headers
quiet; analytics moved to a per-habit detail/progress sheet. The current
"0/99 red circle" misuse (danger color on a neutral value) is corrected per
§4.

## R4. Workout logging screens

**Queried:** "workout log exercise sets reps rest timer" (iOS screens).

| Reference           | Screen evidence                                                                                                                                  | Adopt                                                                                    | Reject                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------- |
| Train Fitness (iOS) | Top timer bar persists; exercise cards with 4-column set tables (SET/REPS/WEIGHT/DONE); Add Set; floating Suggest/plus; progress bar under timer | Persistent timer dock + set-table anatomy + per-row completion checkmark; add-set inline | Social/action-button footers       |
| Dropset (iOS)       | Set rows horizontal; completed-state styling; bottom timer control bar with pause/stop; notes accessible per exercise                            | Bottom rest/control dock that never blocks set entry; "2 of 3 sets" progress microcopy   | Full-width dark sheet per exercise |

**Synthesis for Workout (W9):** active session = operational table, not
cards-in-cards: exercise header (name + completed count), compact set rows,
thumb-reach add/done, persistent rest dock. PR celebration brief. Analytics
out of the session path. Current rust "Today/Week" slab headers replaced with
quiet section labels.

## R5. Nutrition screens

**Queried:** "calorie tracking daily macros remaining" (iOS screens).

| Reference       | Screen evidence                                                                   | Adopt                                                                     | Reject                                              |
| --------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| FoodNoms (iOS)  | "Today" title + nutrient card grid + meal section with add link + FAB             | Meal-grouped diary; nutrient summary as compact cards; add always visible | Per-nutrient rainbow cards (we keep ≤2 accent hues) |
| Foodvisor (iOS) | Calorie circle top + macro bars + meal entries; day rating as feedback, not shame | Remaining-kcal as the hero number; macro bars single-hue with labels      | "Coach" rating copy (shame-adjacent framing)        |

**Synthesis for Calories (W10):** logging-first hierarchy: remaining state →
macro summary → meals → quick-add → history elsewhere. Remove doc-copy
("Keep the current macro form and reuse foods when they repeat…") from the
page; FAB must not overlap form fields.

## R6. Quick capture / task creation flows

**Queried:** "bottom sheet quick add task composer input focused" (iOS
screens).

| Reference        | Flow evidence                                                                                        | Adopt                                                                 | Reject                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| Asana (iOS)      | Bottom sheet: title input → one row of metadata (assignee/due) → attachments → Create above keyboard | Sheet anatomy; single metadata row; primary action docked at keyboard | Privacy/assignee machinery we don't have |
| Joi (iOS)        | Centered modal, one input, three small action icons, blue plus                                       | Minimal chrome: input + destination chip + save                       | Two stacked ghost buttons at the end     |
| Structured (iOS) | "New Task" sheet: input, AI suggestion card, Continue                                                | Optional enrichment _after_ capture, not before                       | Mandatory multi-field form before save   |

**Synthesis for Quick Capture (W6):** open instantly, input focused, one
destination/type control, save on primary; current sheet's triple-exit
(Capture / Done / X) collapses to X + primary. Type chips map to section hues
(Task=Todos hue, etc.) instead of arbitrary blue.

## R7. Command center (advanced capture)

Current rendered state (screenshot `390-command-center.png`) reads as a
technical form ("Parse command", doc copy about parsing/confirmation).
Treated as a power-user surface: keep capability, quiet the chrome, move
explanation to `caption` text beside the input, example chips instead of a
"Supported examples" card.

## R8. Settings

Current rendered state shows narration ("Current selection — LIGHT … Always
use the light theme… SuperHabits will stay in light mode until you change it
here" + "Current behavior — LIGHT … Using light mode across the app. Active
theme: Light.") — the same fact twice, as prose. Adopt grouped-row grammar
(label · description · value · control) from mainstream settings apps;
status pills only for genuinely exceptional states.

---

## Reference lock (campaign §11)

**Primary:** calm, information-first productivity UI (R1 synthesis).
**Preserve:** neutral canvas; excellent whitespace; clear type hierarchy;
precise geometry; modest radii (≤24); subtle tonal depth; selective elevation.
**Borrow:** tactile primary treatment (R1/R6 — one loud action per view);
section-level tint (hero ≤1 per screen); lightweight celebration (gamification
milestones only).
**Reject:** colored shadow on every card; gradients everywhere; pill-everything;
26–34pt radii on phone; huge title blocks on operational screens; card-in-card;
hero sections without a question to answer; decoration that costs density;
staggered entrances; section hue applied to everything a section owns.
