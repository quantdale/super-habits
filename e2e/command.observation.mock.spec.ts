import { expect, test } from "@playwright/test";
import { clearDatabase } from "./helpers/db";
import {
  clickLabeledAction,
  expectDraftOutcome,
  expectInternalMetadataHidden,
  expectPreviewRowContains,
  expectUnsupportedOutcome,
  expectWarningVisible,
  fillById,
  openCommandScreen,
  parseCommand,
} from "./helpers/commandObservation";

type ObservationOutcome = "ready" | "needs_input" | "unsupported";

type CommandObservationCase = {
  bucket: string;
  command: string;
  expectedOutcome: ObservationOutcome;
  warningVisible?: boolean;
};

const MOCK_OBSERVATION_CASES: CommandObservationCase[] = [
  { bucket: "A", command: "Add a todo to call mom tomorrow", expectedOutcome: "ready" },
  { bucket: "A", command: "Create a task to send the email today", expectedOutcome: "ready" },
  { bucket: "A", command: "I need to pay rent tomorrow", expectedOutcome: "ready" },
  { bucket: "A", command: "Remind me to buy milk today", expectedOutcome: "ready" },
  { bucket: "A", command: "Add a todo to call mom 2026-04-25", expectedOutcome: "ready" },
  {
    bucket: "B",
    command: "Create a habit to drink water every morning",
    expectedOutcome: "ready",
  },
  { bucket: "B", command: "Create a habit to stretch every evening", expectedOutcome: "ready" },
  {
    bucket: "B",
    command: "Create a habit to meditate twice a day",
    expectedOutcome: "ready",
  },
  { bucket: "B", command: "Create a habit to read 3x", expectedOutcome: "ready" },
  { bucket: "B", command: "Create a habit to walk once a day", expectedOutcome: "ready" },
  {
    bucket: "C",
    command: "Add a todo to call mom tomorrow at 7pm",
    expectedOutcome: "ready",
    warningVisible: true,
  },
  {
    bucket: "C",
    command: "Add a todo to submit report today at 9am",
    expectedOutcome: "ready",
    warningVisible: true,
  },
  { bucket: "D", command: "Add a todo tomorrow", expectedOutcome: "needs_input" },
  { bucket: "D", command: "Create a habit", expectedOutcome: "ready" },
  { bucket: "D", command: "Remind me to tomorrow", expectedOutcome: "needs_input" },
  {
    bucket: "E",
    command: "I need to drink water every morning",
    expectedOutcome: "unsupported",
  },
  {
    bucket: "E",
    command: "Remind me to drink water every morning",
    expectedOutcome: "unsupported",
  },
  { bucket: "E", command: "Create a habit and a todo", expectedOutcome: "unsupported" },
  { bucket: "E", command: "Add a task and then create a habit", expectedOutcome: "unsupported" },
  { bucket: "E", command: "Drink water tomorrow", expectedOutcome: "unsupported" },
  { bucket: "F", command: "Delete my todo", expectedOutcome: "unsupported" },
  { bucket: "F", command: "Remove my habit", expectedOutcome: "unsupported" },
  { bucket: "F", command: "Complete my task", expectedOutcome: "unsupported" },
  { bucket: "F", command: "Update my habit target", expectedOutcome: "unsupported" },
  {
    bucket: "G",
    command: "Add a todo every weekday to stretch",
    expectedOutcome: "unsupported",
  },
  {
    bucket: "G",
    command: "Add a recurring todo to call mom every Friday",
    expectedOutcome: "unsupported",
  },
  { bucket: "G", command: "Remind me every Monday to study", expectedOutcome: "unsupported" },
  { bucket: "G", command: "Create a task every weekend", expectedOutcome: "unsupported" },
  { bucket: "H", command: "Add a todo later", expectedOutcome: "unsupported" },
  { bucket: "H", command: "Add a todo someday", expectedOutcome: "unsupported" },
  { bucket: "H", command: "Add a todo next Friday", expectedOutcome: "unsupported" },
  { bucket: "H", command: "Add a todo this weekend", expectedOutcome: "unsupported" },
];

test.describe("Command observation (mock/default path)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/(tabs)/overview", { waitUntil: "domcontentloaded" });
    await clearDatabase(page);
  });

  test("table-driven parser outcomes stay within supported public classes", async ({ page }) => {
    test.setTimeout(180_000);

    await openCommandScreen(page);

    for (const observationCase of MOCK_OBSERVATION_CASES) {
      await test.step(`[${observationCase.bucket}] ${observationCase.command}`, async () => {
        await parseCommand(page, observationCase.command);

        if (observationCase.expectedOutcome === "unsupported") {
          await expectUnsupportedOutcome(page);
        } else {
          await expectDraftOutcome(page, observationCase.expectedOutcome);
          if (observationCase.warningVisible) {
            await expectWarningVisible(page);
          }
        }

        await expectInternalMetadataHidden(page);
      });
    }
  });

  test("keeps confirm-before-write for parsed commands", async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, "Add a todo to call mom tomorrow");
    await expectDraftOutcome(page, "ready");

    await page.goto("/(tabs)/todos", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Todos", { exact: true })).toBeVisible();
    await expect(page.getByText("call mom", { exact: true })).toHaveCount(0);
  });

  test("confirms and saves one todo and one habit draft", async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, "Add a todo to call mom tomorrow");
    await expectDraftOutcome(page, "ready");

    await clickLabeledAction(page, "Confirm and save");
    await expect(page.getByText("Todo saved.", { exact: true })).toBeVisible();

    await clickLabeledAction(page, "New command");
    await parseCommand(page, "Create a habit to drink water every morning");
    await expectDraftOutcome(page, "ready");

    await clickLabeledAction(page, "Confirm and save");
    await expect(page.getByText("Habit saved.", { exact: true })).toBeVisible();
  });

  test("supports inline correction for a needs_input command before confirm", async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, "Add a todo tomorrow");
    await expectDraftOutcome(page, "needs_input");

    await fillById(page, "command-edit-todo-title", "call mom");
    await clickLabeledAction(page, "Confirm and save");
    await expect(page.getByText("Todo saved.", { exact: true })).toBeVisible();
  });

  test("stays coherent on public fallback identity", async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, "Add a todo to call mom tomorrow");

    await expectDraftOutcome(page, "ready");
    await expectPreviewRowContains(page, "Parser", /mock_rules/);
    await expectInternalMetadataHidden(page);
  });
});
