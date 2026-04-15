import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/db/client", () => ({
  getDatabase: vi.fn(),
}));

import { getDatabase } from "@/core/db/client";
import { listWorkoutLogsForRange } from "@/features/workout/workout.data";

const db = {
  getAllAsync: vi.fn(),
};

describe("workout.data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDatabase).mockResolvedValue(db as never);
    db.getAllAsync.mockResolvedValue([]);
  });

  it("queries UTC timestamp bounds derived from local day keys", async () => {
    await listWorkoutLogsForRange("2026-01-02", "2026-01-03");

    const [query, params] = db.getAllAsync.mock.calls[0];
    expect(query).toContain("completed_at >= ?");
    expect(query).toContain("completed_at < ?");
    expect(params).toEqual([
      new Date(2026, 0, 2, 0, 0, 0, 0).toISOString(),
      new Date(2026, 0, 4, 0, 0, 0, 0).toISOString(),
    ]);
  });
});
