import { expect, test, type Page } from "@playwright/test";
import { clearDatabase } from "./helpers/db";
import {
  clickLabeledAction,
  expectDraftOutcome,
  expectInternalMetadataHidden,
  expectInternalMetadataRowContains,
  expectInternalMetadataVisible,
  expectPreviewRowContains,
  expectUnsupportedOutcome,
  expectWarningVisible,
  openCommandScreen,
  openSettingsScreen,
  parseCommand,
} from "./helpers/commandObservation";

function readEnvFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

const INTERNAL_OBSERVATION_ENABLED = readEnvFlag(process.env.E2E_COMMAND_INTERNAL_OBSERVATION);
const INTERNAL_ROLLOUT_BUILD_ENABLED =
  process.env.EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT === "true" &&
  process.env.EXPO_PUBLIC_AI_COMMAND_PARSE_MODE === "remote_with_fallback";
const INTERNAL_REMOTE_BACKEND_CONFIGURED =
  process.env.EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST === "custom_url"
    ? Boolean(process.env.EXPO_PUBLIC_AI_COMMAND_PROXY_URL)
    : Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const INTERNAL_SUITE_SKIP_REASON = !INTERNAL_OBSERVATION_ENABLED
  ? "Set E2E_COMMAND_INTERNAL_OBSERVATION=true to run internal command observation tests."
  : !INTERNAL_ROLLOUT_BUILD_ENABLED
    ? "Internal command rollout build flags are not enabled (EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT=true and EXPO_PUBLIC_AI_COMMAND_PARSE_MODE=remote_with_fallback)."
    : !INTERNAL_REMOTE_BACKEND_CONFIGURED
      ? "Internal command remote backend is not configured (set EXPO_PUBLIC_AI_COMMAND_PROXY_URL or Supabase env vars)."
      : null;

async function setModelParserEnabled(page: Page, enabled: boolean) {
  await openSettingsScreen(page);
  await expect(page.getByText("Command parser rollout", { exact: true })).toBeVisible();
  await clickLabeledAction(page, enabled ? "Enable model parser" : "Use mock parser only");
  await expect(page.getByText("Command parser rollout", { exact: true })).toBeVisible();
}

test.describe("Command observation (internal real-parser path)", () => {
  test.skip(Boolean(INTERNAL_SUITE_SKIP_REASON), INTERNAL_SUITE_SKIP_REASON ?? "");

  test.beforeEach(async ({ page }) => {
    await page.goto("/(tabs)/overview", { waitUntil: "domcontentloaded" });
    await clearDatabase(page);
    await setModelParserEnabled(page, false);
  });

  test("shows internal toggle and only reveals metadata when opted in on the device", async ({
    page,
  }) => {
    await openSettingsScreen(page);
    await expect(page.getByText("Command parser rollout", { exact: true })).toBeVisible();

    await openCommandScreen(page);
    await parseCommand(page, "Add a todo to call mom tomorrow");
    await expectDraftOutcome(page, "ready");
    await expectPreviewRowContains(page, "Parser", /mock_rules/);
    await expectInternalMetadataHidden(page);

    await setModelParserEnabled(page, true);
    await openCommandScreen(page);
    await parseCommand(page, "Add a todo to call mom tomorrow");
    await expectDraftOutcome(page, "ready");
    await expectInternalMetadataVisible(page);
    await expectInternalMetadataRowContains(page, "Effective path", /remote|remote_with_fallback/);
  });

  test("observes representative todo and habit outcomes under internal mode", async ({ page }) => {
    await setModelParserEnabled(page, true);
    await openCommandScreen(page);

    const representativeCases: Array<{
      command: string;
      expected: "ready" | "unsupported";
      warningVisible?: boolean;
    }> = [
      { command: "Add a todo to call mom tomorrow", expected: "ready" },
      { command: "Create a task to send the email today", expected: "ready" },
      { command: "I need to pay rent tomorrow", expected: "ready" },
      { command: "Create a habit to drink water every morning", expected: "ready" },
      { command: "Create a habit to meditate twice a day", expected: "ready" },
      { command: "Create a habit to walk once a day", expected: "ready" },
      {
        command: "Add a todo to submit report today at 9am",
        expected: "ready",
        warningVisible: true,
      },
      { command: "Create a habit and a todo", expected: "unsupported" },
    ];

    for (const observationCase of representativeCases) {
      await test.step(observationCase.command, async () => {
        await parseCommand(page, observationCase.command);

        if (observationCase.expected === "unsupported") {
          await expectUnsupportedOutcome(page);
          await expectInternalMetadataVisible(page);
          await expectInternalMetadataRowContains(page, "Outcome", "unsupported");
          return;
        }

        await expectDraftOutcome(page, "ready");
        if (observationCase.warningVisible) {
          await expectWarningVisible(page);
        }
        await expectInternalMetadataVisible(page);
        await expectInternalMetadataRowContains(page, "Effective path", /remote|remote_with_fallback/);
      });
    }
  });

  test("preserves parse -> preview -> confirm flow in internal mode", async ({ page }) => {
    await setModelParserEnabled(page, true);
    await openCommandScreen(page);

    await parseCommand(page, "Add a todo to call mom tomorrow");
    await expectDraftOutcome(page, "ready");
    await expectInternalMetadataVisible(page);
    await clickLabeledAction(page, "Confirm and save");
    await expect(page.getByText("Todo saved.", { exact: true })).toBeVisible();

    await clickLabeledAction(page, "New command");
    await parseCommand(page, "Create a habit to drink water every morning");
    await expectDraftOutcome(page, "ready");
    await expectInternalMetadataVisible(page);
    await clickLabeledAction(page, "Confirm and save");
    await expect(page.getByText("Habit saved.", { exact: true })).toBeVisible();
  });

  test("records fallback metadata when remote parsing is unavailable", async ({ page }) => {
    await setModelParserEnabled(page, true);
    await openCommandScreen(page);

    await page.evaluate(() => {
      const originalFetch = window.fetch.bind(window);
      let forced = false;
      window.fetch = (input, init) => {
        if (!forced && typeof init?.body === "string" && init.body.includes("call mom tomorrow")) {
          forced = true;
          return Promise.reject(new Error("forced-command-parser-failure"));
        }
        return originalFetch(input, init);
      };
    });

    await parseCommand(page, "Add a todo to call mom tomorrow");
    await expectDraftOutcome(page, "ready");
    await expectInternalMetadataVisible(page);
    await expectInternalMetadataRowContains(page, "Effective path", "remote_with_fallback");
    await expectPreviewRowContains(page, "Parser", /model_proxy_fallback/);
  });
});
