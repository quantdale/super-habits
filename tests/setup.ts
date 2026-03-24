import { vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: (obj: Record<string, unknown>) => obj["ios"] ?? obj["default"] },
}));

vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: "denied" }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: "denied" }),
  setNotificationChannelAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn().mockResolvedValue("notif-id"),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  AndroidImportance: { HIGH: 5 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
}));

vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: vi.fn().mockResolvedValue({
    execAsync: vi.fn().mockResolvedValue(undefined),
    runAsync: vi.fn().mockResolvedValue(undefined),
    getAllAsync: vi.fn().mockResolvedValue([]),
    getFirstAsync: vi.fn().mockResolvedValue(null),
    closeAsync: vi.fn().mockResolvedValue(undefined),
  }),
}));
