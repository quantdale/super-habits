import { describe, expect, it } from "vitest";
import {
  resolveThemePreference,
  sanitizeThemePreference,
} from "@/core/theme";

describe("theme preference helpers", () => {
  it("keeps explicit light preference", () => {
    expect(resolveThemePreference("light", "dark")).toBe("light");
  });

  it("keeps explicit dark preference", () => {
    expect(resolveThemePreference("dark", "light")).toBe("dark");
  });

  it("resolves system preference from the device theme", () => {
    expect(resolveThemePreference("system", "dark")).toBe("dark");
    expect(resolveThemePreference("system", "light")).toBe("light");
  });

  it("falls back invalid stored values to system", () => {
    expect(sanitizeThemePreference("unexpected")).toBe("system");
    expect(sanitizeThemePreference(null)).toBe("system");
  });
});
