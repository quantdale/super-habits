# W11 — Planning / Goals / Projects / Daily Plan

## 1. Baseline and plan

- [x] 1.1 Verify final W10.5 main SHA and unrelated residuals; create isolated branch.
- [x] 1.2 Research Things, Todoist, Structured, Asana patterns and lock existing V3 direction.
- [x] 1.3 Author W11 slice / ExecPlan before source edits.
- [x] 1.4 Capture/inspect baseline widths and states where runtime is available; register honest limitations.

## 2. Coherent planning grammar

- [x] 2.1 Shared read-only objective/status/context/progress row used by Goal and Project lists.
- [x] 2.2 List-first header with filtering/sorting behind accessible disclosure; preserve filtering and manual order.
- [x] 2.3 Responsive, wrap-safe row typography and >=44pt touch targets.

## 3. Details and Daily Plan

- [x] 3.1 Goal detail foregrounds next action / progress; secondary details behind disclosure.
- [x] 3.2 Project detail foregrounds next up/progress; color/status/date/associations progressive.
- [x] 3.3 Daily Plan prioritizes intention, selected priorities and Save; reveal candidate todo picker and optional fields on demand.
- [x] 3.4 End-of-day reflection/energy and plan history behind disclosures, without data loss.
- [x] 3.5 Maintain guided plan/briefing handoffs, accessibility and unchanged data semantics.

## 4. Testing and evidence

- [x] 4.1 Focused E2E for disclosure, filter fidelity and 4 surface journeys.
- [x] 4.2 Typecheck, lint, themes, OpenSpec/plans/parity and unit/integration.
- [x] 4.3 Runtime visual matrix/adversarial review (must distinguish not-run).
- [x] 4.4 Host E2E independently if inherited dependency audit blocks standard CI; leave policy untouched.

## 5. Publication

- [x] 5.1 Reviewed PR on isolated branch with exact-head gates and explicit limits.
- [x] 5.2 Update parent W11 milestone only after verified publication; hand off W12.

### W11 evidence / exit constraints

- Rendered truth: 82 checked-in images (39 W10.5 baseline; 43 rebuilt W11)
  covering phone/tablet/desktop, themes and representative creation/detail
  states. Newest after screenshots were recaptured after the W11 Goal-progress
  text synchronization and Today briefing-disclosure fixes. Some states are
  outside the first viewport but remain scrollable. The full W14/W15 visual
  sweep and native qualification are **not** inferred from this wave.
- Independent hosted `e2e/planning-w11.spec.ts` (three new flows) plus
  `e2e/planning-hub.spec.ts` (four legacy journeys) ran 7/7 green on both
  `38285465187` and `38287180079` branch source revisions. Production audit
  still blocks the ordinary E2E job through inherited braces/node-forge;
  no security gate was weakened.
