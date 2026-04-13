/**
 * Per-section accent colors — based on color psychology
 * for productivity applications.
 *
 * Todos:    Calm Blue   — focus, clarity, orderly thinking
 * Habits:   Fresh Green — growth, consistency, balance
 * Focus:    Deep Purple — concentration, calm, introspection
 * Workout:  Red-Orange  — physical energy, drive, power
 * Calories: Warm Amber  — warmth, nutrition, appetite awareness
 *
 * Naming boundary:
 * - "pomodoro" remains the canonical internal feature/module key
 * - "focus" remains the user-facing section label and accent namespace
 */
export const SECTION_COLORS = {
  todos: "#3B82F6", // Calm Blue
  habits: "#10B981", // Fresh Green
  focus: "#8B5CF6", // Deep Purple
  workout: "#F97316", // Red-Orange
  calories: "#F59E0B", // Warm Amber
} as const;

export type SectionKey = keyof typeof SECTION_COLORS;

/** User-facing section token used by the pomodoro feature/tab. */
export const POMODORO_SECTION_KEY = "focus" as const satisfies SectionKey;

/**
 * Light tinted background for each section — used for
 * card accent backgrounds and pill chips.
 * 15% opacity version of each section color on white.
 */
export const SECTION_COLORS_LIGHT = {
  todos: "#EFF6FF", // blue-50
  habits: "#ECFDF5", // emerald-50
  focus: "#F5F3FF", // violet-50
  workout: "#FFF7ED", // orange-50
  calories: "#FFFBEB", // amber-50
} as const;

/**
 * Darker same-family hues for text and icons on white, `SECTION_COLORS_LIGHT`,
 * or app surface (#f8f7ff). Keeps `SECTION_COLORS` for fills, borders, and
 * solid headers. Target ~4.5:1 contrast on light backgrounds.
 */
export const SECTION_TEXT_COLORS = {
  todos: "#1D4ED8", // blue-700
  habits: "#047857", // emerald-700
  focus: "#6D28D9", // violet-700
  workout: "#C2410C", // orange-700
  calories: "#92400E", // amber-800 (deeper for yellow-50 / warm surface)
} as const;
