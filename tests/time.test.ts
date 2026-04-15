import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDateRange,
  buildDateRangeOldestFirst,
  buildDateRangeTodayFirst,
  getUtcIsoRangeForLocalDateKeys,
  timestampToLocalDateKey,
  toDateKey,
} from "@/lib/time";

describe("buildDateRange / buildDateRangeTodayFirst", () => {
  it("returns today first then older days", () => {
    const today = toDateKey();
    const range = buildDateRange(3);
    expect(range).toHaveLength(3);
    expect(range[0]).toBe(today);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    expect(range[1]).toBe(toDateKey(y));
  });

  it("buildDateRange matches buildDateRangeTodayFirst", () => {
    expect(buildDateRangeTodayFirst(5)).toEqual(buildDateRange(5));
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

describe("local day UTC range helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 2, 12, 0, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips a just-after-midnight local timestamp into the same date key window", () => {
    const justAfterMidnight = new Date(2026, 0, 2, 0, 30, 0, 0);
    const timestamp = justAfterMidnight.toISOString();
    const dateKey = timestampToLocalDateKey(timestamp);
    const { startUtcIso, endUtcExclusiveIso } = getUtcIsoRangeForLocalDateKeys(dateKey, dateKey);

    expect(dateKey).toBe("2026-01-02");
    expect(startUtcIso <= timestamp).toBe(true);
    expect(timestamp < endUtcExclusiveIso).toBe(true);
  });

  it("uses the next local midnight as the exclusive upper bound", () => {
    const { startUtcIso, endUtcExclusiveIso } = getUtcIsoRangeForLocalDateKeys(
      "2026-01-02",
      "2026-01-02",
    );

    expect(startUtcIso).toBe(new Date(2026, 0, 2, 0, 0, 0, 0).toISOString());
    expect(endUtcExclusiveIso).toBe(new Date(2026, 0, 3, 0, 0, 0, 0).toISOString());
    expect(new Date(2026, 0, 2, 23, 59, 59, 999).toISOString() < endUtcExclusiveIso).toBe(true);
    expect(new Date(2026, 0, 3, 0, 0, 0, 0).toISOString() < endUtcExclusiveIso).toBe(false);
  });
});
