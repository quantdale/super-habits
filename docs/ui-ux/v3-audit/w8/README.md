# W8 Focus rendered audit

Captured with `VISUAL_AUDIT=1` against the static web export (390×844 unless
noted). States: idle, history disclosure, running, paused, end confirmation,
completed frame, idle with cycle text, and a running short break.

- `390-focus-idle` — compact heading, selected duration, one start action, no dots (SYS-08)
- `390-focus-history` — secondary disclosure: recent sessions, garden, heatmap, stats
- `390-focus-running` — countdown dominates; Pause/End only (SYS-08)
- `390-focus-paused` — frozen clock, explicit paused label, resume dominant
- `390-focus-end-confirmation` — safe action first, destructive action danger (SYS-09)
- `390-focus-completed` — finished duration dominant; no next-duration digits
- `390-focus-idle-cycle-text` — one meaningful cycle sentence (SUR-09)
- `390-focus-break-running` — break label distinct without a saturated slab
