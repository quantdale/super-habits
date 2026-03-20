import { describe, expect, it } from "vitest";
import { caloriesTotal, kcalFromMacros } from "@/features/calories/calories.domain";

describe("caloriesTotal", () => {
  it("sums entries correctly", () => {
    const total = caloriesTotal([{ calories: 100 }, { calories: 250 }]);

    expect(total).toBe(350);
  });
});

describe("kcalFromMacros", () => {
  it("uses 4P + 4×max(0,C−F) + 2F + 9×fat", () => {
    expect(kcalFromMacros(0, 0, 0, 0)).toBe(0);
    expect(kcalFromMacros(10, 0, 0, 0)).toBe(40);
    expect(kcalFromMacros(0, 0, 10, 0)).toBe(90);
    expect(kcalFromMacros(0, 5, 0, 5)).toBe(10);
    expect(kcalFromMacros(0, 10, 0, 2)).toBe(36);
    expect(kcalFromMacros(10, 20, 5, 5)).toBe(155);
    expect(kcalFromMacros(0, 5, 0, 10)).toBe(20);
  });
});
