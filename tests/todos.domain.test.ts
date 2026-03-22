import { describe, it, expect } from "vitest";
import {
  getTodayDateKey,
  getTomorrowDateKey,
  findMissingRecurrenceIds,
  isRecurring,
} from "@/features/todos/todos.domain";

describe("getTodayDateKey", () => {
  it("returns YYYY-MM-DD format", () => {
    expect(getTodayDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches local date not UTC", () => {
    const local = new Date();
    const expected = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
    expect(getTodayDateKey()).toBe(expected);
  });
});

describe("getTomorrowDateKey", () => {
  it("returns a date one day after today", () => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const expected = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    expect(getTomorrowDateKey()).toBe(expected);
  });
});

describe("findMissingRecurrenceIds", () => {
  it("returns empty when no recurring todos", () => {
    const todos = [{ recurrence_id: null, recurrence: null, due_date: null, deleted_at: null }];
    expect(findMissingRecurrenceIds(todos, "2025-01-01")).toHaveLength(0);
  });

  it("returns recurrence_id when no instance exists for today", () => {
    const todos = [
      { recurrence_id: "rec_001", recurrence: "daily", due_date: "2025-01-01", deleted_at: null }, // yesterday
    ];
    const missing = findMissingRecurrenceIds(todos, "2025-01-02");
    expect(missing).toContain("rec_001");
  });

  it("does not return recurrence_id when today already covered", () => {
    const todos = [
      { recurrence_id: "rec_001", recurrence: "daily", due_date: "2025-01-02", deleted_at: null }, // today
    ];
    const missing = findMissingRecurrenceIds(todos, "2025-01-02");
    expect(missing).toHaveLength(0);
  });

  it("handles multiple series independently", () => {
    const todos = [
      { recurrence_id: "rec_001", recurrence: "daily", due_date: "2025-01-02", deleted_at: null }, // covered
      { recurrence_id: "rec_002", recurrence: "daily", due_date: "2025-01-01", deleted_at: null }, // not covered
    ];
    const missing = findMissingRecurrenceIds(todos, "2025-01-02");
    expect(missing).toHaveLength(1);
    expect(missing).toContain("rec_002");
  });
});

describe("isRecurring", () => {
  it("returns true for daily recurrence", () => {
    expect(isRecurring({ recurrence: "daily" })).toBe(true);
  });

  it("returns false for null recurrence", () => {
    expect(isRecurring({ recurrence: null })).toBe(false);
  });
});
