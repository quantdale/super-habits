import { describe, expect, it, vi } from "vitest";
import { createId } from "@/lib/id";

describe("lib/id", () => {
  it("produces IDs with the canonical {prefix}_{timestamp}_{8_random_chars} format", () => {
    const id = createId("todo");
    expect(id).toMatch(/^todo_\d{13}_[a-z0-9]{8}$/);
  });

  it("honours different prefixes", () => {
    expect(createId("habit")).toMatch(/^habit_/);
    expect(createId("cal")).toMatch(/^cal_/);
    expect(createId("guest")).toMatch(/^guest_/);
  });

  it("does not fall back to Math.random()", () => {
    const spy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used for ID generation");
    });

    try {
      const id = createId("todo");
      expect(id).toMatch(/^todo_\d{13}_[a-z0-9]{8}$/);
    } finally {
      spy.mockRestore();
    }
  });
});
