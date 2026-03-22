/**
 * Per-section accent colors — based on color psychology
 * for productivity applications.
 *
 * Todos:    Calm Blue   — focus, clarity, orderly thinking
 * Habits:   Fresh Green — growth, consistency, balance
 * Focus:    Deep Purple — concentration, calm, introspection
 * Workout:  Red-Orange  — physical energy, drive, power
 * Calories: Warm Amber  — warmth, nutrition, appetite awareness
 */
export const SECTION_COLORS = {
  todos: "#3B82F6", // Calm Blue
  habits: "#10B981", // Fresh Green
  focus: "#8B5CF6", // Deep Purple
  workout: "#F97316", // Red-Orange
  calories: "#F59E0B", // Warm Amber
} as const;

export type SectionKey = keyof typeof SECTION_COLORS;

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
