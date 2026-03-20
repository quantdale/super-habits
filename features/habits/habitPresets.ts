import type { HabitIcon } from "./types";

export const HABIT_ICONS: readonly HabitIcon[] = [
  "check-circle",
  "favorite",
  "local-drink",
  "menu-book",
  "fitness-center",
  "wb-sunny",
  "bedtime",
  "self-improvement",
  "water-drop",
  "coffee",
  "psychology",
  "spa",
] as const;

export const HABIT_COLORS: readonly string[] = [
  "#64748b",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#ec4899",
  "#6366f1",
] as const;

export const DEFAULT_HABIT_ICON: HabitIcon = "check-circle";
export const DEFAULT_HABIT_COLOR = "#64748b";
