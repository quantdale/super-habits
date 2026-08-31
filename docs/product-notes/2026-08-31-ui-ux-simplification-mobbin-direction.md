# Product Direction Note — UI/UX Simplification + Mobbin

**Discussion date:** 2026-08-31 (Philippines time)  
**Repository:** `quantdale/super-habits`  
**Baseline inspected:** `main` @ `56dad404b2e85c19e8821ad032a374d5e76d20bf`  
**Status:** PARKED / FUTURE WORK — this note records product direction and recommendations only. It is **not** approval to begin implementation.

---

## Why this note exists

This document preserves a product-direction discussion about the current state of Super Habits so the conclusions are not lost between development sessions.

The user is explicitly willing to consider a **major product/UI overhaul**, including hiding, combining, demoting, redesigning, or removing user-facing features if doing so reduces friction. Existing implementation effort is not a reason to preserve a poor experience. Avoid sunk-cost thinking.

At the same time, the current engineering foundation is strong enough that the default strategy should be **product-surface redesign rather than wholesale technical rewrite**.

The central goal for future work should be:

> **Make Super Habits feel simple even though it is powerful.**

---

# 1. Current repository state at the time of discussion

The inspected `main` branch was at:

`56dad404b2e85c19e8821ad032a374d5e76d20bf`

Repository observations at this baseline:

- only `main` existed;
- no open pull requests;
- no open issues;
- current GitHub CI was green on the exact baseline SHA;
- Vercel deployment/status checks were green;
- stack: Expo 55 + React Native 0.83 + TypeScript + NativeWind + Expo Router;
- offline-first SQLite is the primary source of truth;
- optional Supabase backup/recovery exists;
- web/PWA and native Android/iOS architecture are supported;
- approximately 1,256 tracked files were present;
- approximately 139 TSX files existed;
- approximately 37 significant screen/view/modal-like UI surfaces existed;
- approximately 18 feature modules existed;
- approximately 197 Vitest/Playwright test/spec files existed.

The latest CI on the inspected SHA passed the important repository-side gates, including:

- TypeScript typecheck;
- lint;
- theme-token validation;
- OpenSpec validation;
- versioned agent-plan validation;
- unit/integration tests;
- full browser journey testing;
- seeded scenario testing;
- remote-boundary/dist-sync testing.

The takeaway is important:

> **Super Habits is not primarily suffering from an engineering-health problem. It is suffering from a product-complexity and UX-governance problem.**

Do not casually throw away the mature domain/data/test infrastructure during a future redesign.

---

# 2. What Super Habits has become

Super Habits is no longer just a habit tracker.

Its current user-facing/product surface includes, among other things:

- Overview / Today-style dashboard;
- Todos;
- Habits;
- Focus / Pomodoro;
- Workout / Gym V2;
- Calories / nutrition;
- Planning Hub;
- Daily Plan;
- Projects;
- Goals;
- Progress;
- Activity timeline;
- Weekly Review;
- Quick Capture;
- Momentum Garden;
- Command Center / AI command flows;
- reminders and notifications;
- linked actions / automation-like behavior;
- appearance and accessibility settings;
- cloud backup/restore;
- portable backup/import;
- account recovery/protection;
- developer/internal controls.

The main shell currently gives six equal-weight primary destinations:

1. Overview
2. To Do
3. Habits
4. Focus
5. Workout
6. Calories

Secondary experiences include Settings, Weekly Review, Planning Hub, Quick Capture, and the experimental Command Center.

Planning Hub itself exposes:

- Today
- Projects
- Goals
- Progress
- Timeline

Quick Capture can create or start:

- Task
- Habit
- Calorie
- Project
- Goal
- Focus

This breadth means the product is effectively becoming a **personal operating system** rather than a narrow habit tracker.

That can be a strength, but only if the interface aggressively hides complexity and preserves a very clear everyday mental model.

---

# 3. Core product diagnosis

The user's current concern is valid:

> The app has become too technical and too feature-heavy. Individual capabilities may be useful, but the aggregate experience can create user friction.

The problem is not merely that the screens are "not pretty enough."

There are four deeper issues.

## 3.1 Too many concepts are visible at once

Many screens expose functionality that should be secondary, contextual, advanced, or hidden until requested.

Examples include:

- analytics before primary actions;
- filters/sorts/lifecycle controls on ordinary habit use;
- detailed backup-state concepts in consumer settings;
- parser/command implementation concepts;
- linked-action complexity;
- advanced scheduling metadata;
- multiple ways of creating the same underlying object;
- multiple overlapping mental models for capture and command entry.

## 3.2 Equal-weight navigation does not reflect everyday importance

Six phone-width primary tabs give Workout and Calories the same persistent navigation weight as everyday actions such as Tasks or Habits, regardless of what an individual user actually uses.

This creates:

- visual compression;
- discoverability competition;
- unnecessary cognitive load;
- poor large-text scaling;
- a feeling that every module must be understood.

## 3.3 Developer/system terminology leaks into product UI

Examples observed in current surfaces include concepts such as:

- Outbox sync
- Backup coverage
- Recoverable areas
- Current backup model
- Effective parser
- Internal parser rollout
- Use mock parser only
- Developer / Internal

These concepts are legitimate implementation details, but most ordinary users should not need to understand them.

A normal user wants to answer questions such as:

- "Is my data backed up?"
- "When was it last backed up?"
- "Can I restore it?"
- "What happens if I lose my phone?"

They do not need the synchronization architecture explained during routine use.

## 3.4 Product scope has expanded faster than the design system has governed it

Super Habits already has a serious design package under `docs/ui-ux/`, including:

- `01-current-state-audit.md`
- `02-design-dna.md`
- `03-feature-blueprints.md`
- `04-roadmap-and-acceptance.md`
- `05-inspiration-research.md`

The design DNA is called **Warm Momentum**.

Its existing principles are good, especially:

- calm first, delight second;
- one dominant action per state;
- progressive disclosure over visible complexity;
- feedback follows causality;
- reward behavior, not app opening;
- recovery is part of the product.

The problem is not that no design thinking exists.

The better diagnosis is:

> **The design system was introduced, but the product expanded faster than the design system could enforce a coherent experience.**

There were roughly 110 commits between the original design-DNA commit and the inspected baseline, including large additions such as Gym V2, deeper workout semantics/analytics, Momentum Garden, planning/productivity expansion, and hardening work.

Therefore the next redesign should treat the existing design DNA as a useful foundation, not as proof that the UX problem has already been solved.

---

# 4. Specific friction examples

## Focus / Pomodoro

The normal job is simple:

> Start focusing.

Yet the current Focus surface exposes significant statistics/history context such as long-term activity, streaks, Today statistics, weekly statistics, 30-day statistics, presets, associations, history, and timer configuration around the core action.

Future direction:

- timer / Start Focus should dominate;
- session state should become nearly distraction-free;
- history/statistics should be secondary;
- advanced duration/preset behavior should remain available without competing with the primary action.

## Habits

Current capabilities include combinations of:

- time-of-day grouping;
- schedule patterns;
- specific weekdays;
- quantitative target counts;
- reminders;
- lifecycle states;
- filters;
- sorting;
- history;
- progress insights;
- icons/colors;
- Linked Actions.

These are individually defensible, but collectively increase decision cost.

Future direction:

- create a habit with the minimum information necessary;
- move advanced schedule/reminder/automation/customization options into progressive disclosure;
- keep everyday check-in dramatically simpler than configuration.

## Todos

The task title should be overwhelmingly primary.

Metadata such as:

- priority;
- project;
- goal;
- due date;
- recurrence;
- notes;
- Linked Actions

should be visually and interactionally subordinate.

Capture must be faster than organization.

## Settings

Settings currently contains significant technical detail.

Future direction:

Normal settings should answer user-facing questions.

Technical diagnostics, parser controls, developer instrumentation, detailed backup internals, and similar concepts should be:

- hidden by default;
- grouped under Advanced / Developer;
- or removed from normal consumer builds entirely when appropriate.

---

# 5. Strong product pieces worth preserving

A simplification campaign should not assume everything is wrong.

Several existing pieces point toward the right future direction.

## 5.1 Today / Overview architecture

The current Overview already contains useful concepts including:

- `NextBestActionHero`
- `TodayProgressStrip`
- `MomentumCard`
- customizable secondary cards
- first-run onboarding

This is much closer to the ideal everyday mental model.

Future Super Habits should become much more **Today-first**.

## 5.2 Momentum Garden

Momentum Garden is one of the strongest existing manifestations of the Warm Momentum design DNA.

It can potentially become the system-wide emotional/progress metaphor rather than allowing every module to invent unrelated gamification.

Prefer one shared progression metaphor over:

- separate habit gamification;
- separate focus gamification;
- separate workout gamification;
- separate task gamification;
- etc.

## 5.3 First-run onboarding

Current onboarding already asks what users want help with across areas such as:

- Habits
- Tasks
- Focus
- Workout
- Nutrition

and encourages a small first step.

Future redesign should make those choices materially affect the **ongoing product surface**.

Example:

If a user did not choose Nutrition, Calories does not need permanent first-class navigation presence from day one.

The system can progressively reveal modules as users activate them.

---

# 6. Proposed product simplification direction

The following is a recommendation for later exploration, not an implementation commitment.

| Current concept | Recommended direction |
| --- | --- |
| Overview | Reframe decisively as **Today**, the unquestioned home |
| Six equal primary tabs | Reduce to a smaller Today-first primary IA |
| Quick Capture | One fast capture entry; expose type only when needed |
| Command Center | Remove as a consumer-facing mental model; reuse useful intelligence behind capture |
| Planning Hub | Simplify/reframe as **Plan** |
| Workout + Calories | Consider a **Health** domain or user-activated modules |
| Habits | Keep core interaction simple; advanced controls progressively disclosed |
| Todos | Title-first capture; metadata secondary |
| Focus | Timer/start action first; history/analytics secondary |
| Settings | Everyday settings first; technical/system diagnostics hidden |
| Linked Actions | Consider reframing as optional **Automations** for power users |
| Backup | Show simple backup health/status first; hide implementation detail |
| Momentum Garden | Preserve and strengthen as common progress/emotional language |
| Onboarding selections | Use them to actually personalize/hide product modules |

A future primary-navigation prototype could explore something similar to:

- Today
- Plan
- Focus
- Health
- Progress

This is only a hypothesis. It must be validated against actual common journeys before adoption.

Do not choose a navigation scheme merely because it looks modern.

---

# 7. Quick Capture and Command Center should probably converge

This is a particularly important recommendation.

Super Habits currently risks exposing two overlapping concepts:

1. Quick Capture
2. Command Center / natural-language command flow

That is unnecessary cognitive overhead.

A cleaner user mental model is:

> There is one universal **Add / Capture** action.

A user can enter something like:

- "Buy groceries tomorrow"
- "Drink water every morning"
- "Ate 600 calories for lunch"
- "Focus for 45 minutes"

The application may internally use:

- deterministic parsing;
- AI/model parsing;
- structured forms;
- heuristics;
- domain routing;
- confirmation flows.

But none of those mechanisms need to become part of the user's mental model.

The implementation can remain sophisticated while the product surface remains simple.

---

# 8. Mobbin should be used as a design-research system

The user discovered **Mobbin** and wants to consider it as a solution for Super Habits UI/UX work.

Recommendation: yes, use Mobbin, but **do not use it as a pixel-copying tool**.

Bad workflow:

> Find an attractive app and make Super Habits look like it.

Better workflow:

> Identify a user problem in Super Habits, retrieve multiple proven production flows that solve the same problem, extract the interaction principles, and create an original Super Habits implementation consistent with Warm Momentum.

Mobbin should provide **evidence and reference patterns**, not a replacement product identity.

---

# 9. Mobbin research targets for a future session

The future agent should research flows rather than isolated pretty screens.

Priority questions include:

## Onboarding

Research:

- how products ask for goals without demanding excessive setup;
- how they produce a meaningful first success quickly;
- how modules/preferences are progressively introduced.

## Today / Home

Research:

- how multi-domain apps tell users what matters now;
- how one next action is prioritized;
- how secondary statistics are visually demoted.

## Habit creation and completion

Research:

- minimum viable habit creation;
- progressive disclosure of advanced scheduling;
- streak/progress presentation;
- friendly recovery after missed days.

## Task capture

Research:

- extremely fast title-first capture;
- natural-language metadata;
- progressive disclosure;
- one-handed mobile operation.

## Focus

Research:

- distraction-free active-session layouts;
- emotional progress visualization;
- post-session feedback;
- history kept out of the way of starting.

## Workout

Research:

- routine selection;
- active-session logging;
- previous-performance context at the point of entry;
- rest timing;
- low-friction set completion.

## Nutrition

Research:

- daily summary hierarchy;
- fast food logging;
- recent/saved meals;
- progressive disclosure of macro detail.

## Planning / Progress

Research:

- daily vs long-term planning;
- guided review flows;
- narrative progress rather than dashboard overload.

## Settings

Research:

- hiding advanced settings;
- simple backup/recovery language;
- separating everyday preferences from diagnostics.

---

# 10. Recommended Mobbin pattern ledger

For every reference studied, record:

| Field | Meaning |
| --- | --- |
| Reference product | Where the pattern was observed |
| User problem | What problem it solves |
| Interaction principle | The transferable idea |
| Why it works | Usability reasoning |
| Super Habits adaptation | Original implementation direction |
| What not to copy | Brand/trade-dress/pixel-level elements to avoid |
| Validation metric | How we know it reduced friction |

The rule should remain:

> **Copy the principle, not the pixels.**

Potential reference categories/products include, where relevant:

- Duolingo / Brilliant — hierarchy, progression, onboarding, next-action emphasis, feedback;
- Todoist / TickTick — task capture, information density, multi-module productivity;
- Forest — focus-session emotional continuity;
- Hevy and similar fitness products — in-session workout logging;
- strong nutrition/logging products — rapid food capture and daily-state hierarchy.

Do not force one reference product across every Super Habits domain.

---

# 11. Future design-validation loop

A major weakness in agent-driven UI development is that successful compilation is often mistaken for successful design.

Future UI campaigns should explicitly include a visual validation loop:

1. identify user job/friction;
2. research relevant Mobbin flows;
3. document transferable interaction principles;
4. create a Super Habits-specific design proposal;
5. implement a narrow vertical slice;
6. run the app on web/emulator/device;
7. capture actual screenshots;
8. let the AI agent inspect those screenshots visually;
9. compare against:
   - Warm Momentum / future design DNA;
   - reference interaction principles;
   - accessibility;
   - information hierarchy;
   - action prominence;
   - cognitive load;
   - one-handed usability;
   - visual consistency;
10. run behavioral/regression tests;
11. iterate before expanding the redesign.

The agent should not declare a UI change complete merely because:

- tests pass;
- JSX renders;
- layout code appears reasonable;
- no runtime errors occur.

Visual inspection is part of the acceptance criteria.

---

# 12. Warm Momentum should evolve into a stronger product contract

The existing design DNA is valuable but should potentially evolve into a **Warm Momentum 2.0** contract.

It should govern not only:

- color;
- typography;
- spacing;
- radius;
- elevation;
- components;
- animation;

but also:

- maximum visible decision density;
- hierarchy rules;
- navigation prominence;
- progressive disclosure;
- terminology;
- feature activation;
- advanced-mode boundaries;
- empty states;
- recovery states;
- information density;
- what is allowed above the fold;
- number of simultaneous primary actions;
- analytics placement;
- user-facing vs developer-facing vocabulary.

The design system must constrain product complexity, not merely style it.

---

# 13. Feature-removal / feature-demotion policy

Future redesign work has explicit permission to challenge existing user-facing features.

Possible outcomes for a feature should include:

- KEEP — important and appropriately exposed;
- SIMPLIFY — same capability, lower interaction cost;
- MERGE — overlaps another feature/mental model;
- DEMOTE — useful but should be secondary;
- HIDE — power-user capability behind Advanced;
- ACTIVATE ON DEMAND — not present until a user opts into the domain;
- REMOVE FROM PRODUCT UI — underlying implementation may remain;
- REMOVE ENTIRELY — only if its maintenance/product cost is not justified.

Do not preserve a surface solely because substantial time was spent implementing it.

However:

> Prefer preserving tested domain/data capabilities behind simpler UI when they remain useful.

The redesign should avoid needless technical destruction.

---

# 14. Recommendation on next major development phase

At the time of this note, the recommendation is:

## Do not prioritize another broad feature-expansion campaign.

Super Habits already has enough capability to validate a strong product.

The next major product campaign should instead be:

> **Product simplification + information-architecture redesign + UI/UX redesign**

with Mobbin used as a primary research/reference source.

The campaign should have permission to reorganize the product substantially while protecting the mature technical foundation.

A sensible future sequence would be:

1. freeze unnecessary feature expansion;
2. conduct Mobbin/reference research;
3. define core target users/jobs;
4. create a friction inventory of current journeys;
5. classify existing features: keep/simplify/merge/demote/hide/remove;
6. define Warm Momentum 2.0;
7. prototype competing navigation/information architectures;
8. validate the new Today-first shell;
9. redesign high-frequency flows first:
   - capture;
   - Todos;
   - Habits;
   - Focus;
10. then handle Workout/Health/Nutrition;
11. then Planning/Progress/Review;
12. finally simplify Settings and advanced functionality;
13. continuously run visual + behavioral regression evaluation.

---

# 15. Non-goals / cautions

When this work eventually starts:

- do not rewrite the entire application just to obtain a prettier UI;
- do not blindly imitate Mobbin screenshots;
- do not turn Super Habits into a Duolingo clone;
- do not optimize for maximum feature visibility;
- do not equate more customization with better UX;
- do not expose implementation terminology simply because it exists in code;
- do not keep six primary destinations just because they already exist;
- do not remove mature domain logic merely because its present UI is poor;
- do not let power-user needs dictate first-run experience;
- do not call the redesign finished without real rendered-screen inspection;
- do not add another major feature wave until the complexity problem has been addressed or deliberately deferred.

---

# 16. North-star questions for the next session

Before changing code, future work should answer:

1. Who is the primary Super Habits user?
2. What should they accomplish within 10 seconds of opening the app?
3. What are the 3–5 highest-frequency jobs?
4. Which current features materially help those jobs?
5. Which features create cognitive overhead without enough everyday value?
6. Which modules should be opt-in rather than permanently visible?
7. What belongs on Today?
8. What deserves primary navigation?
9. What can be expressed through one universal Capture interaction?
10. What technical concepts can disappear entirely from the consumer interface?
11. What should Momentum represent across the whole product?
12. How will we measure whether the redesign actually reduced friction?

---

# Final product thesis

Super Habits does not need to become less capable internally.

It needs to become **less complicated externally**.

The desired end state is a product where:

- a new user sees a small number of obvious actions;
- an ordinary user can ignore most advanced functionality indefinitely;
- a power user can still discover depth when needed;
- modules feel like one coherent product rather than adjacent mini-apps;
- Today provides orientation;
- Capture provides a universal entry point;
- Momentum provides shared emotional continuity;
- technical implementation details remain invisible;
- advanced features do not tax users who do not need them.

The guiding principle for future work is:

> **Power through progressive disclosure, not power through visible complexity.**

And the overarching goal remains:

> **Make Super Habits feel simple even though it is powerful.**
