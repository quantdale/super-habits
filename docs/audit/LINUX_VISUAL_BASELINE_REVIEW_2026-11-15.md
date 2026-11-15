# Linux visual-baseline review — 2026-11-15

## Provenance and unchanged contract

Agent per-image review of all30 original Linux / genuine Ubuntu actual / strict
diff triples, not a copy of Windows images or hosted-CI/native certification.
Authority: `docs/ui-ux/16-playful-momentum.md`. Original30 PNGs and SHA-256s are
preserved in external `visual-review-linux/original-linux/` and `inventory.json`.
All15 labeled boards were opened; desktop task/settings/timeline captures were
also inspected at full resolution. The seven font-affected subjects were
rechecked separately before selecting their final captures.

Environment: Ubuntu24.04.4 WSL, verified Node22.23.2, Chromium147.0.7727.15 /
Playwright revision1217, scale1, Asia/Manila/en-US, fixed2026-10-13T19:30:00,
reduced motion and unchanged font/section readiness. Browser executables and
profiles use private native-filesystem temporary storage; evidence stays under
`D:/Documents/tryPython/_AgentArtifacts/superhabits/sessions/20261114-pi-repository-remediation/`.

The initial host lacked CI's NotoColorEmoji. **Tofu and monochrome substitutes
were rejected**, not approved into goldens. Four Playwright CI font packages
were downloaded/extracted privately, with per-process Fontconfig; no global
fonts, system packages or user configuration were changed. Corrected captures
restore readable Japanese, color coffee/rocket and the original Habits image.
Focus also already compares exactly. Keep both original PNGs unchanged.

Captures use the prior qualified hermetic `sha-3d8184a2d1d3ac9c` shell; normal
comparison against rebuilt A33 `sha-15d364b4a1d6db79` must prove the final result.
No masks, tolerance/timeout changes, missing-glyph acceptance or snapshot-update
mode. All four negative controls remain active; adoption is not passing proof.

## Per-capture decisions

| Capture                                | Attribution and disposition                                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shell-today-first-run-390-light`      | Real44px reward targets shift the path/glance down; same zero state and hierarchy. Accept.                                                            |
| `shell-today-390-light`                | Same target geometry; task7/overdue and275XP remain exact. Accept.                                                                                    |
| `shell-today-390-dark`                 | Same geometry on charcoal; readable hero/path/rail. Accept.                                                                                           |
| `shell-today-768-light`                | Only expanded reward targets; wide content/rail fit. Accept.                                                                                          |
| `shell-today-1280-light`               | Full-size reviewed: larger header/footer reward faces; sidebar/content unchanged. Accept.                                                             |
| `todos-390-light`                      | Canonical recurrence fixture10open/2due and actual composer plus target; reject first missing-emoji capture, accept corrected coffee/Japanese/rocket. |
| `todos-long-title-390-light`           | A31 now captures the actual four-line title via real search, exactly1row/full viewport, not the old unrelated first rows. Accept.                     |
| `todos-heavy-1280-light`               | Canonical154open/57completed/37due, expanded plus/reward targets. Full-size corrected glyphs and labels reviewed. Accept.                             |
| `todos-390-dark`                       | Same canonical counts/plus target; corrected color emoji and readable dark rows. Accept.                                                              |
| `habits-390-light`                     | With CI font prerequisites the existing golden passes exactly. Keep original; reject missing-font candidate.                                          |
| `habits-quantitative-detail-390-light` | Larger segmented faces move sheet boundaries; same0/3/streaks, controls fit. Accept.                                                                  |
| `focus-idle-390-light`                 | Existing golden already passes exactly. Keep original.                                                                                                |
| `workout-landing-390-light`            | Actual44px Start/week targets, wrapping week gutter treatment; same rest/logged/routine facts. Accept.                                                |
| `calories-390-light`                   | Actual44px mode/edit/food controls expand cards;600/2000/macros unchanged, corrected coffee glyph. Accept.                                            |
| `calories-390-dark`                    | Same geometry and values on charcoal, corrected coffee. Accept.                                                                                       |
| `todos-empty-360-light`                | Only composer plus face; same narrow empty state/CTA. Accept.                                                                                         |
| `shell-today-first-run-360-light`      | Narrow reward targets shift path, no horizontal escape. Accept.                                                                                       |
| `quick-capture-390-light`              | Actual44px priorities alter sheet height; current header underlay; choices/actions readable. Accept.                                                  |
| `settings-top-390-light`               | Actual44px mode controls shift group/preview rows; unchanged selected appearance. Accept.                                                             |
| `settings-top-1280-dark`               | Full-size reviewed: same dark grouped dialog,44px mode faces and reward underlay. Accept.                                                             |
| `settings-backup-390-light`            | Actual sound controls/scroll offset and canonical brand wording; owner/outbox/coverage local-only facts unchanged. Accept.                            |
| `command-input-390-light`              | Expanded reward targets in visible underlay; input/privacy/parse/examples unchanged. Accept.                                                          |
| `achievements-390-light`               | Expanded reward targets in underlay;275XP/level3/93of233/streak7/freeze1 unchanged. Accept.                                                           |
| `review-step1-390-light`               | Underlay rewards only; same step1/date/summary/Next. Accept.                                                                                          |
| `review-step1-390-dark`                | Same underlay shift on charcoal; summary and controls unchanged. Accept.                                                                              |
| `progress-details-390-light`           | Actual44px ranges/segments shift tiles;2vs6/79vs0/3vs0 exact. Accept.                                                                                 |
| `timeline-filters-390-light`           | Actual44px groups/segments increase height; Source/Range/Day labels fit, remaining choices scroll. Accept.                                            |
| `timeline-1280-light`                  | Actual44px segments/rewards shift rows/underlay; full-size reviewed. Reject initial monochrome coffee; accept separately reviewed CI-font recapture.  |
| `plan-hub-today-390-light`             | Actual44px segments/disclosures shift form, same guided carry-over/unsaved state. Accept.                                                             |
| `plan-hub-projects-768-light`          | Actual44px segments/plus grow sheet; neutral empty card and current Today underlay remain correct. Accept.                                            |

## Validation

Exactly28 reviewed Linux candidates were adopted; Focus and Habits remain
byte-for-byte unchanged. Current-source normal comparisons
`a33-linux-visual-complete1` and `a33-linux-visual-complete2` each pass **34/34**,
zero skips/flaky cases/retries, including all four negative controls
(281.5s/278.0s). The earlier300s outer batch cap interrupted a later control's
navigation after all30 image comparisons passed; the420s batch envelope
completes both runs with per-test timeouts/assertions unchanged. Original logs
remain retained. Windows also passes twice on current A33 source; its review is
separate in `WINDOWS_VISUAL_BASELINE_REVIEW_2026-11-15.md`. Neither is Michael's
P22 sign-off or hosted-CI/native certification.
