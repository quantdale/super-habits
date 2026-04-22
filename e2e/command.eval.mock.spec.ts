import { expect, test } from "@playwright/test";
import { clearDatabase } from "./helpers/db";
import {
  buildCommandEvalArtifact,
  buildCommandEvalFailureSummary,
  buildDateContext,
  captureCommandEvaluationResult,
  type CommandEvalCase,
  type CommandEvalCaseResult,
  writeCommandEvalArtifact,
} from "./helpers/commandEvaluation";
import { openCommandScreen, parseCommand } from "./helpers/commandObservation";

const MOCK_ARTIFACT_PATH = "test-results/command-eval-mock.json";

const MOCK_EVAL_CASES: CommandEvalCase[] = [
  {
    label: "todo-tomorrow-semantic",
    rawCommand: "Add a todo to call mom tomorrow",
    expectedModeContext: "public_mock_default",
    evaluationKind: "semantic",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_todo",
      parserKind: "mock_rules",
      effectivePath: "mock",
      title: "call mom",
      dueDate: "tomorrow",
      priority: "normal",
      warningCodes: [],
      missingFields: [],
    },
  },
  {
    label: "todo-today-semantic",
    rawCommand: "Create a task to send the email today",
    expectedModeContext: "public_mock_default",
    evaluationKind: "semantic",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_todo",
      parserKind: "mock_rules",
      effectivePath: "mock",
      title: "send the email",
      dueDate: "today",
      priority: "normal",
      warningCodes: [],
      missingFields: [],
    },
  },
  {
    label: "todo-i-need-to",
    rawCommand: "I need to pay rent tomorrow",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_todo",
      effectivePath: "mock",
    },
  },
  {
    label: "todo-remind-me",
    rawCommand: "Remind me to buy milk today",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_todo",
      effectivePath: "mock",
    },
  },
  {
    label: "todo-explicit-date-semantic",
    rawCommand: "Add a todo to call mom 2026-04-25",
    expectedModeContext: "public_mock_default",
    evaluationKind: "semantic",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_todo",
      parserKind: "mock_rules",
      effectivePath: "mock",
      title: "call mom",
      dueDate: "2026-04-25",
      priority: "normal",
      warningCodes: [],
      missingFields: [],
    },
  },
  {
    label: "todo-time-warning-semantic",
    rawCommand: "Add a todo to call mom tomorrow at 7pm",
    expectedModeContext: "public_mock_default",
    evaluationKind: "semantic",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_todo",
      parserKind: "mock_rules",
      effectivePath: "mock",
      title: "call mom",
      dueDate: "tomorrow",
      priority: "normal",
      warningCodes: ["todo_time_not_supported"],
      missingFields: [],
    },
  },
  {
    label: "todo-needs-input-semantic",
    rawCommand: "Add a todo tomorrow",
    expectedModeContext: "public_mock_default",
    evaluationKind: "semantic",
    expectation: {
      outcomeClass: "needs_input",
      draftKind: "create_todo",
      parserKind: "mock_rules",
      effectivePath: "mock",
      title: null,
      dueDate: "tomorrow",
      priority: "normal",
      warningCodes: [],
      missingFields: ["title"],
    },
  },
  {
    label: "habit-morning-semantic",
    rawCommand: "Create a habit to drink water every morning",
    expectedModeContext: "public_mock_default",
    evaluationKind: "semantic",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_habit",
      parserKind: "mock_rules",
      effectivePath: "mock",
      name: "drink water",
      targetPerDay: 1,
      category: "morning",
      warningCodes: ["defaulted_field"],
      missingFields: [],
    },
  },
  {
    label: "habit-evening",
    rawCommand: "Create a habit to stretch every evening",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_habit",
      effectivePath: "mock",
    },
  },
  {
    label: "habit-twice-semantic",
    rawCommand: "Create a habit to meditate twice a day",
    expectedModeContext: "public_mock_default",
    evaluationKind: "semantic",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_habit",
      parserKind: "mock_rules",
      effectivePath: "mock",
      name: "meditate",
      targetPerDay: 2,
      category: "anytime",
      warningCodes: [],
      missingFields: [],
    },
  },
  {
    label: "habit-3x-semantic",
    rawCommand: "Create a habit to read 3x",
    expectedModeContext: "public_mock_default",
    evaluationKind: "semantic",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_habit",
      parserKind: "mock_rules",
      effectivePath: "mock",
      name: "read",
      targetPerDay: 3,
      category: "anytime",
      warningCodes: [],
      missingFields: [],
    },
  },
  {
    label: "habit-once-a-day",
    rawCommand: "Create a habit to walk once a day",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: {
      outcomeClass: "ready",
      draftKind: "create_habit",
      effectivePath: "mock",
    },
  },
  {
    label: "habit-missing-name-semantic",
    rawCommand: "Create a habit",
    expectedModeContext: "public_mock_default",
    evaluationKind: "semantic",
    note: "A habit draft with no actual habit name should remain needs_input under confirm-before-write trust flow.",
    expectation: {
      outcomeClass: "needs_input",
      draftKind: "create_habit",
      parserKind: "mock_rules",
      effectivePath: "mock",
      name: null,
      targetPerDay: 1,
      category: "anytime",
      warningCodes: ["defaulted_field"],
      missingFields: ["name"],
    },
  },
  {
    label: "todo-remind-me-needs-input-semantic",
    rawCommand: "Remind me to tomorrow",
    expectedModeContext: "public_mock_default",
    evaluationKind: "semantic",
    expectation: {
      outcomeClass: "needs_input",
      draftKind: "create_todo",
      parserKind: "mock_rules",
      effectivePath: "mock",
      title: null,
      dueDate: "tomorrow",
      priority: "normal",
      warningCodes: [],
      missingFields: ["title"],
    },
  },
  {
    label: "unsupported-habitlike-i-need-to",
    rawCommand: "I need to drink water every morning",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-remind-habitlike",
    rawCommand: "Remind me to drink water every morning",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-mixed-create",
    rawCommand: "Create a habit and a todo",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-mixed-sequenced",
    rawCommand: "Add a task and then create a habit",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-implicit-habit-or-todo",
    rawCommand: "Drink water tomorrow",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-delete",
    rawCommand: "Delete my todo",
    expectedModeContext: "public_mock_default",
    evaluationKind: "semantic",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-remove",
    rawCommand: "Remove my habit",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-complete",
    rawCommand: "Complete my task",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-update",
    rawCommand: "Update my habit target",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-weekday-recurrence",
    rawCommand: "Add a todo every weekday to stretch",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-friday-recurrence",
    rawCommand: "Add a recurring todo to call mom every Friday",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-every-monday",
    rawCommand: "Remind me every Monday to study",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-every-weekend",
    rawCommand: "Create a task every weekend",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-vague-later",
    rawCommand: "Add a todo later",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-vague-someday",
    rawCommand: "Add a todo someday",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-next-friday",
    rawCommand: "Add a todo next Friday",
    expectedModeContext: "public_mock_default",
    evaluationKind: "semantic",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
  {
    label: "unsupported-this-weekend",
    rawCommand: "Add a todo this weekend",
    expectedModeContext: "public_mock_default",
    evaluationKind: "classification",
    expectation: { outcomeClass: "unsupported", effectivePath: "mock" },
  },
];

test.describe("Command evaluation (mock/default path)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/(tabs)/overview", { waitUntil: "domcontentloaded" });
    await clearDatabase(page);
  });

  test("captures parser matrix quality and semantic draft quality in mock mode", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const dateContext = buildDateContext();
    const results: CommandEvalCaseResult[] = [];

    await openCommandScreen(page);

    for (const evalCase of MOCK_EVAL_CASES) {
      await test.step(`[${evalCase.label}] ${evalCase.rawCommand}`, async () => {
        await parseCommand(page, evalCase.rawCommand);
        results.push(
          await captureCommandEvaluationResult(page, evalCase, dateContext, {
            defaultEffectivePath: "mock",
          }),
        );
      });
    }

    const artifact = buildCommandEvalArtifact(
      "command-eval-mock",
      "mock_default_public",
      results,
    );
    await writeCommandEvalArtifact(MOCK_ARTIFACT_PATH, artifact);

    console.log(
      "[command-eval-mock]",
      JSON.stringify(
        {
          artifactPath: MOCK_ARTIFACT_PATH,
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

    const summaryIssues: string[] = [];
    if (artifact.unavailableCount !== 0) {
      summaryIssues.push(`Unexpected unavailable outcomes observed in mock mode: ${artifact.unavailableCount}`);
    }
    if (artifact.metadataVisibleCount !== 0) {
      summaryIssues.push(`Internal metadata was visible in mock/public mode for ${artifact.metadataVisibleCount} cases.`);
    }
    if (artifact.mismatchCount !== 0) {
      summaryIssues.push(`Evaluation mismatches detected: ${artifact.mismatchCount}`);
    }

    if (summaryIssues.length > 0) {
      throw new Error(
        `${summaryIssues.join("\n")}\nArtifact: ${MOCK_ARTIFACT_PATH}\n\n${buildCommandEvalFailureSummary(artifact)}`,
      );
    }
  });

  test("keeps todo drafts non-persistent until confirm", async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, "Add a todo to call mom tomorrow");

    await page.goto("/(tabs)/todos", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Todos", { exact: true })).toBeVisible();
    await expect(page.getByText("call mom", { exact: true })).toHaveCount(0);
  });

  test("keeps habit drafts non-persistent until confirm", async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, "Create a habit to drink water every morning");

    await page.goto("/(tabs)/habits", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Enter habit edit mode")).toBeVisible();
    await expect(page.getByText("drink water", { exact: true })).toHaveCount(0);
  });
});
