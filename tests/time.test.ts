import { describe, it, expect } from "vitest";
import { buildDateRange, buildDateRangeOldestFirst, toDateKey } from "@/lib/time";

describe("buildDateRange", () => {
  it("returns today first then older days", () => {
    const today = toDateKey();
    const range = buildDateRange(3);
    expect(range).toHaveLength(3);
    expect(range[0]).toBe(today);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    expect(range[1]).toBe(toDateKey(y));
  });
});

describe("buildDateRangeOldestFirst", () => {
  it("returns oldest day first and today last", () => {
    const range = buildDateRangeOldestFirst(3);
    expect(range).toHaveLength(3);
    const oldest = new Date();
    oldest.setDate(oldest.getDate() - 2);
    expect(range[0]).toBe(toDateKey(oldest));
    expect(range[2]).toBe(toDateKey());
  });
});
