import { describe, expect, it, vi } from "vitest";
import {
  appMetaKeys,
  getAppMetaJson,
  getAppMetaJsonOrDefault,
  getAppMetaText,
  setAppMetaJson,
  setAppMetaText,
} from "@/core/db/appMeta";

function buildDb() {
  return {
    getFirstAsync: vi.fn(),
    runAsync: vi.fn().mockResolvedValue(undefined),
  };
}

describe("core/db/appMeta", () => {
  it("reads text values using the shared key registry", async () => {
    const db = buildDb();
    db.getFirstAsync.mockResolvedValueOnce({ value: "9" });

    await expect(getAppMetaText(db as never, appMetaKeys.dbSchemaVersion)).resolves.toBe("9");
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      "SELECT value FROM app_meta WHERE key = ?",
      ["db_schema_version"],
    );
  });

  it("parses JSON values strictly for callers that need existing behavior", async () => {
    const db = buildDb();
    db.getFirstAsync.mockResolvedValueOnce({
      value: JSON.stringify({ id: "guest_1", createdAt: "2026-04-13T00:00:00.000Z" }),
    });

    await expect(getAppMetaJson<{ id: string; createdAt: string }>(
      db as never,
      appMetaKeys.guestProfile,
    )).resolves.toEqual({
      id: "guest_1",
      createdAt: "2026-04-13T00:00:00.000Z",
    });
  });

  it("returns the provided default when JSON is missing or invalid", async () => {
    const db = buildDb();
    db.getFirstAsync.mockResolvedValueOnce(null).mockResolvedValueOnce({
      value: "{broken json}",
    });

    await expect(
      getAppMetaJsonOrDefault(
        db as never,
        appMetaKeys.calorieGoal,
        { calories: 2000, protein: 150, carbs: 200, fats: 65 },
      ),
    ).resolves.toEqual({
      calories: 2000,
      protein: 150,
      carbs: 200,
      fats: 65,
    });

    await expect(
      getAppMetaJsonOrDefault(
        db as never,
        appMetaKeys.calorieGoal,
        { calories: 2000, protein: 150, carbs: 200, fats: 65 },
      ),
    ).resolves.toEqual({
      calories: 2000,
      protein: 150,
      carbs: 200,
      fats: 65,
    });
  });

  it("writes text and JSON values through the shared upsert path", async () => {
    const db = buildDb();

    await setAppMetaText(db as never, appMetaKeys.dbSchemaVersion, "9");
    await setAppMetaJson(db as never, appMetaKeys.pomodoroSettings, {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
    });

    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
      ["db_schema_version", "9"],
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
      [
        "pomodoro_settings",
        JSON.stringify({
          focusMinutes: 25,
          shortBreakMinutes: 5,
          longBreakMinutes: 15,
          sessionsBeforeLongBreak: 4,
        }),
      ],
    );
  });
});
