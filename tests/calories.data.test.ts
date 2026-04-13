import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/db/client", () => ({
  getDatabase: vi.fn(),
}));

vi.mock("@/core/sync/sync.engine", () => ({
  syncEngine: {
    enqueue: vi.fn(),
  },
}));

vi.mock("@/lib/id", () => ({
  createId: vi.fn(),
}));

vi.mock("@/lib/time", () => ({
  nowIso: vi.fn(),
  toDateKey: vi.fn(),
}));

import { getDatabase } from "@/core/db/client";
import { syncEngine } from "@/core/sync/sync.engine";
import { createId } from "@/lib/id";
import { nowIso, toDateKey } from "@/lib/time";
import {
  addCalorieEntry,
  deleteCalorieEntry,
  getCalorieGoal,
  setCalorieGoal,
  updateCalorieEntry,
  upsertSavedMeal,
} from "@/features/calories/calories.data";

const db = {
  runAsync: vi.fn(),
  getFirstAsync: vi.fn(),
  getAllAsync: vi.fn(),
};

describe("calories.data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDatabase).mockResolvedValue(db as never);
    vi.mocked(nowIso).mockReturnValue("2026-04-06T10:00:00.000Z");
    vi.mocked(toDateKey).mockReturnValue("2026-04-06");
  });

  it("addCalorieEntry inserts the entry, saves the meal, and enqueues create", async () => {
    vi.mocked(createId)
      .mockReturnValueOnce("cal_1")
      .mockReturnValueOnce("smeal_1");
    db.getFirstAsync.mockResolvedValueOnce(null);

    await addCalorieEntry({
      foodName: "Chicken breast",
      calories: 220,
      protein: 40,
      carbs: 0,
      fats: 5,
      fiber: 0,
      mealType: "lunch",
    });

    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("INSERT INTO calorie_entries"),
      [
        "cal_1",
        "Chicken breast",
        220,
        40,
        0,
        5,
        0,
        "lunch",
        "2026-04-06",
        "2026-04-06T10:00:00.000Z",
        "2026-04-06T10:00:00.000Z",
      ],
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO saved_meals"),
      [
        "smeal_1",
        "Chicken breast",
        220,
        40,
        0,
        5,
        0,
        "lunch",
        "2026-04-06T10:00:00.000Z",
        "2026-04-06T10:00:00.000Z",
      ],
    );
    expect(syncEngine.enqueue).toHaveBeenCalledWith({
      entity: "calorie_entries",
      id: "cal_1",
      updatedAt: "2026-04-06T10:00:00.000Z",
      operation: "create",
    });
  });

  it("updateCalorieEntry recalculates calories, updates saved meals, and enqueues update", async () => {
    vi.mocked(createId).mockReturnValueOnce("smeal_2");
    db.getFirstAsync.mockResolvedValueOnce(null);

    await updateCalorieEntry("cal_1", {
      foodName: "Protein oats",
      protein: 30,
      carbs: 40,
      fats: 10,
      fiber: 5,
      mealType: "breakfast",
    });

    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("UPDATE calorie_entries SET"),
      [
        "Protein oats",
        360,
        30,
        40,
        10,
        5,
        "breakfast",
        "2026-04-06T10:00:00.000Z",
        "cal_1",
      ],
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO saved_meals"),
      [
        "smeal_2",
        "Protein oats",
        360,
        30,
        40,
        10,
        5,
        "breakfast",
        "2026-04-06T10:00:00.000Z",
        "2026-04-06T10:00:00.000Z",
      ],
    );
    expect(syncEngine.enqueue).toHaveBeenCalledWith({
      entity: "calorie_entries",
      id: "cal_1",
      updatedAt: "2026-04-06T10:00:00.000Z",
      operation: "update",
    });
  });

  it("deleteCalorieEntry soft-deletes the row and enqueues delete", async () => {
    await deleteCalorieEntry("cal_9");

    expect(db.runAsync).toHaveBeenCalledWith(
      "UPDATE calorie_entries SET deleted_at = ?, updated_at = ? WHERE id = ?",
      ["2026-04-06T10:00:00.000Z", "2026-04-06T10:00:00.000Z", "cal_9"],
    );
    expect(syncEngine.enqueue).toHaveBeenCalledWith({
      entity: "calorie_entries",
      id: "cal_9",
      updatedAt: "2026-04-06T10:00:00.000Z",
      operation: "delete",
    });
  });

  it("upsertSavedMeal updates an existing meal and increments use_count", async () => {
    db.getFirstAsync.mockResolvedValueOnce({
      id: "smeal_existing",
      food_name: "Protein oats",
      calories: 320,
      protein: 20,
      carbs: 40,
      fats: 5,
      fiber: 4,
      meal_type: "breakfast",
      use_count: 3,
      last_used_at: "2026-04-05T10:00:00.000Z",
      created_at: "2026-04-01T10:00:00.000Z",
    });

    await upsertSavedMeal({
      foodName: "Protein oats",
      calories: 360,
      protein: 30,
      carbs: 40,
      fats: 10,
      fiber: 5,
      mealType: "breakfast",
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE saved_meals SET"),
      [
        360,
        30,
        40,
        10,
        5,
        "breakfast",
        "2026-04-06T10:00:00.000Z",
        "smeal_existing",
      ],
    );
    expect(createId).not.toHaveBeenCalled();
  });

  it("upsertSavedMeal returns early for blank names", async () => {
    await upsertSavedMeal({
      foodName: "   ",
      calories: 100,
      protein: 0,
      carbs: 0,
      fats: 0,
      fiber: 0,
      mealType: "snack",
    });

    expect(getDatabase).not.toHaveBeenCalled();
    expect(db.getFirstAsync).not.toHaveBeenCalled();
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it("getCalorieGoal falls back to the default goal when the row is missing or invalid", async () => {
    db.getFirstAsync.mockResolvedValueOnce(null).mockResolvedValueOnce({
      value: "{not valid json}",
    });

    await expect(getCalorieGoal()).resolves.toEqual({
      calories: 2000,
      protein: 150,
      carbs: 200,
      fats: 65,
    });
    await expect(getCalorieGoal()).resolves.toEqual({
      calories: 2000,
      protein: 150,
      carbs: 200,
      fats: 65,
    });
  });

  it("setCalorieGoal stores the goal through app_meta JSON serialization", async () => {
    await setCalorieGoal({
      calories: 2300,
      protein: 180,
      carbs: 240,
      fats: 70,
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
      [
        "calorie_goal",
        JSON.stringify({
          calories: 2300,
          protein: 180,
          carbs: 240,
          fats: 70,
        }),
      ],
    );
  });
});
