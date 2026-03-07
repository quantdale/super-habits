import { describe, expect, it } from "vitest";
import { caloriesTotal } from "@/features/calories/calories.domain";

describe("caloriesTotal", () => {
  it("sums entries correctly", () => {
    const total = caloriesTotal([
      {
        id: "1",
        food_name: "A",
        calories: 100,
        protein: 5,
        carbs: 10,
        fats: 3,
        meal_type: "breakfast",
        consumed_on: "2026-01-01",
        created_at: "",
        updated_at: "",
        deleted_at: null,
      },
      {
        id: "2",
        food_name: "B",
        calories: 250,
        protein: 10,
        carbs: 20,
        fats: 12,
        meal_type: "lunch",
        consumed_on: "2026-01-01",
        created_at: "",
        updated_at: "",
        deleted_at: null,
      },
    ]);

    expect(total).toBe(350);
  });
});
