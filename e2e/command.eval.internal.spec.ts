import { expect, test, type Page } from "@playwright/test";
import { clearDatabase } from "./helpers/db";
import {
  buildCommandEvalArtifact,
  buildCommandEvalFailureSummary,
  buildDateContext,
  captureCommandEvaluationResult,
  forceNextCommandFetchFailure,
  readEnvFlag,
  type CommandEvalCase,
  type CommandEvalCaseResult,
  writeCommandEvalArtifact,
} from "./helpers/commandEvaluation";
import {
  clickLabeledAction,
  openCommandScreen,
  openSettingsScreen,
  parseCommand,
} from "./helpers/commandObservation";

const INTERNAL_ARTIFACT_PATH = "test-results/command-eval-internal.json";

const INTERNAL_EVAL_ENABLED = readEnvFlag(process.env.E2E_COMMAND_INTERNAL_EVAL);
const INTERNAL_ROLLOUT_BUILD_ENABLED =
  process.env.EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT === "true" &&
  process.env.EXPO_PUBLIC_AI_COMMAND_PARSE_MODE === "remote_with_fallback";
const INTERNAL_REMOTE_BACKEND_CONFIGURED =
  process.env.EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST === "custom_url"
    ? Boolean(process.env.EXPO_PUBLIC_AI_COMMAND_PROXY_URL)
    : Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const INTERNAL_SUITE_SKIP_REASON = !INTERNAL_EVAL_ENABLED
  ? "Set E2E_COMMAND_INTERNAL_EVAL=true to run internal command evaluation tests."
  : !INTERNAL_ROLLOUT_BUILD_ENABLED
    ? "Internal command rollout build flags are not enabled (EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT=true and EXPO_PUBLIC_AI_COMMAND_PARSE_MODE=remote_with_fallback)."
    : !INTERNAL_REMOTE_BACKEND_CONFIGURED
      ? "Internal command remote backend is not configured (set EXPO_PUBLIC_AI_COMMAND_PROXY_URL or Supabase env vars)."
      : null;

const INTERNAL_EVAL_CASES: CommandEvalCase[] = [
  {
    label: "remote-todo-tomorrow",
    rawCommand: "Add a todo to call mom tomorrow",
    expectedModeContext: "internal_remote_opt_in",
    evaluationKind: "semantic",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_todo",
      parserKind: "model_proxy",
      effectivePath: "remote",
      title: "call mom",
      dueDate: "tomorrow",
      priority: "normal",
      warningCodes: [],
      missingFields: [],
    },
  },
  {
    label: "remote-todo-today",
    rawCommand: "Create a task to send the email today",
    expectedModeContext: "internal_remote_opt_in",
    evaluationKind: "semantic",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_todo",
      parserKind: "model_proxy",
      effectivePath: "remote",
      title: "send the email",
      dueDate: "today",
      priority: "normal",
      warningCodes: [],
      missingFields: [],
    },
  },
  {
    label: "remote-warning-time",
    rawCommand: "Add a todo to submit report today at 9am",
    expectedModeContext: "internal_remote_opt_in",
    evaluationKind: "semantic",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_todo",
      parserKind: "model_proxy",
      effectivePath: "remote",
      title: "submit report",
      dueDate: "today",
      priority: "normal",
      warningCodes: ["todo_time_not_supported"],
      missingFields: [],
    },
  },
  {
    label: "remote-habit-morning",
    rawCommand: "Create a habit to drink water every morning",
    expectedModeContext: "internal_remote_opt_in",
    evaluationKind: "semantic",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_habit",
      parserKind: "model_proxy",
      effectivePath: "remote",
      name: "drink water",
      targetPerDay: 1,
      category: "morning",
      warningCodes: ["defaulted_field"],
      missingFields: [],
    },
  },
  {
    label: "remote-habit-twice",
    rawCommand: "Create a habit to meditate twice a day",
    expectedModeContext: "internal_remote_opt_in",
    evaluationKind: "semantic",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_habit",
      parserKind: "model_proxy",
      effectivePath: "remote",
      name: "meditate",
      targetPerDay: 2,
      category: "anytime",
      warningCodes: [],
      missingFields: [],
    },
  },
  {
    label: "remote-habit-missing-name",
    rawCommand: "Create a habit",
    expectedModeContext: "internal_remote_opt_in",
    evaluationKind: "semantic",
    note: "A nameless habit should remain needs_input even in internal parser mode.",
    expectation: {
      outcomeClass: "needs_input",
      draftKind: "create_habit",
      parserKind: "model_proxy",
      effectivePath: "remote",
      name: null,
      targetPerDay: 1,
      category: "anytime",
      warningCodes: ["defaulted_field"],
      missingFields: ["name"],
    },
  },
  {
    label: "remote-unsupported-mixed",
    rawCommand: "Create a habit and a todo",
    expectedModeContext: "internal_remote_opt_in",
    evaluationKind: "classification",
    expectation: {
      outcomeClass: "unsupported",
      effectivePath: "remote",
    },
  },
  {
    label: "forced-fallback-todo",
    rawCommand: "Add a todo to call mom 2026-04-25",
    expectedModeContext: "internal_forced_fallback",
    evaluationKind: "semantic",
    forceFetchFailureOnce: true,
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_todo",
      parserKind: "model_proxy_fallback",
      effectivePath: "remote_with_fallback",
      title: "call mom",
      dueDate: "2026-04-25",
      priority: "normal",
      warningCodes: [],
      missingFields: [],
    },
  },
];

async function setModelParserEnabled(page: Page, enabled: boolean) {
  await openSettingsScreen(page);
  await expect(page.getByText("Command parser rollout", { exact: true })).toBeVisible();
  await clickLabeledAction(page, enabled ? "Enable model parser" : "Use mock parser only");
  await expect(page.getByText("Command parser rollout", { exact: true })).toBeVisible();
}

test.describe("Command evaluation (internal real-parser path)", () => {
  test.skip(Boolean(INTERNAL_SUITE_SKIP_REASON), INTERNAL_SUITE_SKIP_REASON ?? "");

  test.beforeEach(async ({ page }) => {
    await page.goto("/(tabs)/overview", { waitUntil: "domcontentloaded" });
    await clearDatabase(page);
    await setModelParserEnabled(page, false);
  });

  test("shows metadata only after internal opt-in is enabled on the device", async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, "Add a todo to call mom tomorrow");
    await expect(page.getByText("Internal parser metadata", { exact: true })).toHaveCount(0);
    await expect(page.getByText("mock_rules v1", { exact: true })).toBeVisible();

    await setModelParserEnabled(page, true);
    await openCommandScreen(page);
    await parseCommand(page, "Add a todo to call mom tomorrow");
    await expect(page.getByText("Internal parser metadata", { exact: true })).toBeVisible();
  });

  test("captures parser matrix quality and semantic draft quality in internal mode", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const dateContext = buildDateContext();
    const results: CommandEvalCaseResult[] = [];

    await setModelParserEnabled(page, true);
    await openCommandScreen(page);

    for (const evalCase of INTERNAL_EVAL_CASES) {
      await test.step(`[${evalCase.label}] ${evalCase.rawCommand}`, async () => {
        if (evalCase.forceFetchFailureOnce) {
          await forceNextCommandFetchFailure(page, evalCase.rawCommand);
        }

        await parseCommand(page, evalCase.rawCommand);
        results.push(await captureCommandEvaluationResult(page, evalCase, dateContext));
      });
    }

    const artifact = buildCommandEvalArtifact(
      "command-eval-internal",
      "internal_remote_opt_in",
      results,
    );
    await writeCommandEvalArtifact(INTERNAL_ARTIFACT_PATH, artifact);

    console.log(
      "[command-eval-internal]",
      JSON.stringify(
        {
          artifactPath: INTERNAL_ARTIFACT_PATH,
          totalCases: artifact.totalCases,
          mismatchCount: artifact.mismatchCount,
          outcomeCounts: artifact.outcomeCounts,
          parserKindCounts: artifact.parserKindCounts,
          effectivePathCounts: artifact.effectivePathCounts,
          warningFrequencyCounts: artifact.warningFrequencyCounts,
        },
        null,
        2,
      ),
    );

    const remoteTodoSuccessCount = artifact.perCaseResults.filter(
      (result) =>
        result.draftKind === "create_todo" &&
        result.outcomeClass === "ready" &&
        result.parserKind === "model_proxy",
    ).length;
    const remoteHabitSuccessCount = artifact.perCaseResults.filter(
      (result) =>
        result.draftKind === "create_habit" &&
        result.outcomeClass === "ready" &&
        result.parserKind === "model_proxy",
    ).length;

    const summaryIssues: string[] = [];
    if (artifact.unavailableCount !== 0) {
      summaryIssues.push(`Unexpected unavailable outcomes observed in internal mode: ${artifact.unavailableCount}`);
    }
    if (artifact.metadataVisibleCount !== artifact.totalCases) {
      summaryIssues.push(
        `Internal metadata should be visible for every evaluated case after opt-in. Visible count: ${artifact.metadataVisibleCount}/${artifact.totalCases}.`,
      );
    }
    if (remoteTodoSuccessCount < 1) {
      summaryIssues.push("No remote todo success case was observed with parserKind=model_proxy.");
    }
    if (remoteHabitSuccessCount < 1) {
      summaryIssues.push("No remote habit success case was observed with parserKind=model_proxy.");
    }
    if (artifact.fallbackCount < 1) {
      summaryIssues.push("No fallback case was observed in internal mode.");
    }
    if ((artifact.effectivePathCounts.mock ?? 0) > 0) {
      summaryIssues.push("Internal opt-in evaluation unexpectedly observed mock effective path.");
    }
    if (artifact.mismatchCount !== 0) {
      summaryIssues.push(`Evaluation mismatches detected: ${artifact.mismatchCount}`);
    }

    if (summaryIssues.length > 0) {
      throw new Error(
        `${summaryIssues.join("\n")}\nArtifact: ${INTERNAL_ARTIFACT_PATH}\n\n${buildCommandEvalFailureSummary(artifact)}`,
      );
    }
  });
});
