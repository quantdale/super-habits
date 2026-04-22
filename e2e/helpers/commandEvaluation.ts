import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Page } from "@playwright/test";

export type EvalOutcomeClass = "ready" | "needs_input" | "unsupported" | "unavailable";
export type EvalDraftKind = "create_todo" | "create_habit";
export type EvalEffectivePath = "mock" | "remote" | "remote_with_fallback";
export type EvalParserKind = "mock_rules" | "model_proxy" | "model_proxy_fallback";
export type EvalPriority = "urgent" | "normal" | "low";
export type EvalCategory = "anytime" | "morning" | "afternoon" | "evening";
export type EvalWarningCode =
  | "todo_time_not_supported"
  | "unsupported_recurrence"
  | "ambiguous_date"
  | "defaulted_field"
  | "partial_parse";
export type EvalUnavailableReason =
  | "remote_not_configured"
  | "auth_session_unavailable"
  | "request_timed_out"
  | "request_failed"
  | "http_error"
  | "malformed_json"
  | "response_validation_failed";
export type EvalExpectedDate = "today" | "tomorrow" | string | null;

export type CommandEvalExpectation = {
  outcomeClass: EvalOutcomeClass;
  draftKind?: EvalDraftKind;
  parserKind?: EvalParserKind;
  effectivePath?: EvalEffectivePath;
  title?: string | null;
  name?: string | null;
  dueDate?: EvalExpectedDate;
  priority?: EvalPriority;
  targetPerDay?: number;
  category?: EvalCategory;
  warningCodes?: EvalWarningCode[];
  missingFields?: string[];
};

export type CommandEvalCase = {
  label: string;
  rawCommand: string;
  expectedModeContext: string;
  evaluationKind: "classification" | "semantic";
  expectation: CommandEvalExpectation;
  note?: string;
  forceFetchFailureOnce?: boolean;
};

export type CommandEvalDateContext = {
  todayDateKey: string;
  tomorrowDateKey: string;
};

export type CommandEvalCaseResult = {
  label: string;
  rawCommand: string;
  expectedModeContext: string;
  evaluationKind: "classification" | "semantic";
  note: string | null;
  expectation: CommandEvalExpectation;
  metadataVisible: boolean;
  parseOutcome: "draft" | "unsupported" | "unavailable";
  outcomeClass: EvalOutcomeClass;
  status: "ready" | "needs_input" | null;
  effectivePath: EvalEffectivePath | null;
  parserKind: EvalParserKind | null;
  draftKind: EvalDraftKind | null;
  title: string | null;
  name: string | null;
  dueDate: string | null;
  priority: EvalPriority | null;
  targetPerDay: number | null;
  category: EvalCategory | null;
  warningCodes: EvalWarningCode[];
  missingFields: string[];
  fallback: boolean;
  unavailableReason: EvalUnavailableReason | null;
  mismatches: string[];
};

export type CommandEvalArtifact = {
  suiteName: string;
  timestamp: string;
  configMode: string;
  totalCases: number;
  classificationCaseCount: number;
  semanticCaseCount: number;
  mismatchCount: number;
  outcomeCounts: Record<EvalOutcomeClass, number>;
  parseOutcomeCounts: Record<CommandEvalCaseResult["parseOutcome"], number>;
  effectivePathCounts: Record<string, number>;
  parserKindCounts: Record<string, number>;
  fallbackCount: number;
  unavailableCount: number;
  metadataVisibleCount: number;
  warningFrequencyCounts: Record<string, number>;
  perCaseResults: CommandEvalCaseResult[];
};

const TODO_WARNING_MESSAGE_TO_CODE: Array<{ message: string; code: EvalWarningCode }> = [
  {
    message: "Time will not be saved in this version.",
    code: "todo_time_not_supported",
  },
  {
    message: "Target per day defaulted to 1 in this version.",
    code: "defaulted_field",
  },
];

const PRIORITY_OPTIONS: Array<{ label: string; value: EvalPriority }> = [
  { label: "Urgent", value: "urgent" },
  { label: "Normal", value: "normal" },
  { label: "Low", value: "low" },
];

const CATEGORY_OPTIONS: Array<{ label: string; value: EvalCategory }> = [
  { label: "Anytime", value: "anytime" },
  { label: "Morning", value: "morning" },
  { label: "Afternoon", value: "afternoon" },
  { label: "Evening", value: "evening" },
];

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function isTextVisible(page: Page, text: string) {
  return page.getByText(text, { exact: true }).first().isVisible().catch(() => false);
}

async function readInputValue(page: Page, id: string): Promise<string | null> {
  const locator = page.locator(`#${id}`).first();
  const visible = await locator.isVisible().catch(() => false);
  if (!visible) return null;
  return normalizeText(await locator.inputValue());
}

async function readInfoRowValue(page: Page, label: string): Promise<string | null> {
  const row = page
    .getByText(label, { exact: true })
    .locator("xpath=ancestor::*[contains(@class,'justify-between')][1]")
    .first();
  const visible = await row.isVisible().catch(() => false);
  if (!visible) return null;

  const text = normalizeText(await row.textContent());
  if (!text) return null;
  return normalizeText(text.replace(new RegExp(`^${escapeRegex(label)}`), ""));
}

async function readActiveChipValue<T extends string>(
  page: Page,
  options: Array<{ label: string; value: T }>,
): Promise<T | null> {
  for (const option of options) {
    const matches = page.getByText(option.label, { exact: true });
    const count = await matches.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = matches.nth(index);
      const visible = await candidate.isVisible().catch(() => false);
      if (!visible) continue;

      const isActive = await candidate.evaluate((element) => {
        const color = window.getComputedStyle(element as HTMLElement).color;
        return color === "rgb(255, 255, 255)";
      });
      if (isActive) {
        return option.value;
      }
    }
  }

  return null;
}

function inferWarningCodesFromMessages(messages: string[]): EvalWarningCode[] {
  const inferred = new Set<EvalWarningCode>();

  for (const message of messages) {
    const normalizedMessage = normalizeText(message);
    if (!normalizedMessage) continue;
    const match = TODO_WARNING_MESSAGE_TO_CODE.find((entry) => entry.message === normalizedMessage);
    if (match) {
      inferred.add(match.code);
    }
  }

  return [...inferred];
}

async function collectVisibleWarningMessages(page: Page): Promise<string[]> {
  const messages: string[] = [];

  for (const entry of TODO_WARNING_MESSAGE_TO_CODE) {
    if (await isTextVisible(page, entry.message)) {
      messages.push(entry.message);
    }
  }

  return messages;
}

function splitCommaSeparatedValue(value: string | null): string[] {
  if (!value || value === "none") return [];
  return value
    .split(",")
    .map((entry) => normalizeText(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function resolveExpectedDate(expectedDate: EvalExpectedDate | undefined, dateContext: CommandEvalDateContext) {
  if (expectedDate === undefined) return undefined;
  if (expectedDate === "today") return dateContext.todayDateKey;
  if (expectedDate === "tomorrow") return dateContext.tomorrowDateKey;
  return expectedDate;
}

function compareStringField(
  mismatches: string[],
  label: string,
  actual: string | null,
  expected: string | null | undefined,
) {
  if (expected === undefined) return;
  if (actual !== expected) {
    mismatches.push(`${label}: expected "${expected}", received "${actual ?? "null"}"`);
  }
}

function compareNumberField(
  mismatches: string[],
  label: string,
  actual: number | null,
  expected: number | undefined,
) {
  if (expected === undefined) return;
  if (actual !== expected) {
    mismatches.push(`${label}: expected ${expected}, received ${actual ?? "null"}`);
  }
}

function compareStringArrayField(
  mismatches: string[],
  label: string,
  actual: string[],
  expected: string[] | undefined,
) {
  if (!expected) return;
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) {
    mismatches.push(
      `${label}: expected [${sortedExpected.join(", ")}], received [${sortedActual.join(", ")}]`,
    );
  }
}

export function readEnvFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function buildDateContext(base = new Date()): CommandEvalDateContext {
  const today = new Date(base);
  const tomorrow = new Date(base);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    todayDateKey: toDateKey(today),
    tomorrowDateKey: toDateKey(tomorrow),
  };
}

export async function forceNextCommandFetchFailure(page: Page, rawCommand: string) {
  await page.evaluate((commandText) => {
    const currentFetch = window.fetch.bind(window);
    let forced = false;

    window.fetch = (input, init) => {
      if (!forced && typeof init?.body === "string" && init.body.includes(commandText)) {
        forced = true;
        return Promise.reject(new Error("forced-command-eval-fetch-failure"));
      }
      return currentFetch(input, init);
    };
  }, rawCommand);
}

export async function captureCommandEvaluationResult(
  page: Page,
  evalCase: CommandEvalCase,
  dateContext: CommandEvalDateContext,
  options?: { defaultEffectivePath?: EvalEffectivePath | null },
): Promise<CommandEvalCaseResult> {
  const reviewVisible = await isTextVisible(page, "Review before saving");
  const unsupportedVisible = await isTextVisible(page, "Try rewording your command");
  const unavailableVisible = await isTextVisible(page, "Parse unavailable");
  const metadataVisible = await isTextVisible(page, "Internal parser metadata");

  let parseOutcome: CommandEvalCaseResult["parseOutcome"] = "unsupported";
  let outcomeClass: EvalOutcomeClass = "unsupported";
  let status: CommandEvalCaseResult["status"] = null;
  let parserKind: EvalParserKind | null = null;
  let effectivePath: EvalEffectivePath | null = null;
  let draftKind: EvalDraftKind | null = null;
  let title: string | null = null;
  let name: string | null = null;
  let dueDate: string | null = null;
  let priority: EvalPriority | null = null;
  let targetPerDay: number | null = null;
  let category: EvalCategory | null = null;
  let warningCodes: EvalWarningCode[] = [];
  let missingFields: string[] = [];
  let unavailableReason: EvalUnavailableReason | null = null;

  if (reviewVisible) {
    parseOutcome = "draft";
    const statusValue = await readInfoRowValue(page, "Parser status");
    status = statusValue === "needs_input" ? "needs_input" : "ready";
    outcomeClass = status;

    const parserValue = await readInfoRowValue(page, "Parser");
    if (parserValue) {
      const parserToken = normalizeText(parserValue.split(" ")[0]);
      if (
        parserToken === "mock_rules" ||
        parserToken === "model_proxy" ||
        parserToken === "model_proxy_fallback"
      ) {
        parserKind = parserToken;
      }
    }

    const intentValue = await readInfoRowValue(page, "Intent");
    if (intentValue === "Create todo") {
      draftKind = "create_todo";
      title = await readInputValue(page, "command-edit-todo-title");
      dueDate = await readInputValue(page, "command-edit-todo-due-date");
      priority = await readActiveChipValue(page, PRIORITY_OPTIONS);
      if (!metadataVisible && !title) {
        missingFields.push("title");
      }
    } else if (intentValue === "Create habit") {
      draftKind = "create_habit";
      name = await readInputValue(page, "command-edit-habit-name");
      const rawTarget = await readInputValue(page, "command-edit-habit-target");
      targetPerDay = rawTarget ? Number(rawTarget) : null;
      category = await readActiveChipValue(page, CATEGORY_OPTIONS);
      if (!metadataVisible && !name) {
        missingFields.push("name");
      }
    }
  } else if (unavailableVisible) {
    parseOutcome = "unavailable";
    outcomeClass = "unavailable";
  } else if (unsupportedVisible) {
    parseOutcome = "unsupported";
    outcomeClass = "unsupported";
  }

  if (metadataVisible) {
    const effectivePathValue = await readInfoRowValue(page, "Effective path");
    if (
      effectivePathValue === "mock" ||
      effectivePathValue === "remote" ||
      effectivePathValue === "remote_with_fallback"
    ) {
      effectivePath = effectivePathValue;
    }

    const warningCodesValue = await readInfoRowValue(page, "Warning codes");
    warningCodes = splitCommaSeparatedValue(warningCodesValue).filter(
      (value): value is EvalWarningCode =>
        value === "todo_time_not_supported" ||
        value === "unsupported_recurrence" ||
        value === "ambiguous_date" ||
        value === "defaulted_field" ||
        value === "partial_parse",
    );

    const missingFieldsValue = await readInfoRowValue(page, "Missing fields");
    missingFields = splitCommaSeparatedValue(missingFieldsValue);

    const reasonCodeValue = await readInfoRowValue(page, "Reason code");
    if (
      reasonCodeValue === "remote_not_configured" ||
      reasonCodeValue === "auth_session_unavailable" ||
      reasonCodeValue === "request_timed_out" ||
      reasonCodeValue === "request_failed" ||
      reasonCodeValue === "http_error" ||
      reasonCodeValue === "malformed_json" ||
      reasonCodeValue === "response_validation_failed"
    ) {
      unavailableReason = reasonCodeValue;
    }
  } else {
    warningCodes = inferWarningCodesFromMessages(await collectVisibleWarningMessages(page));
  }

  if (!effectivePath) {
    if (parserKind === "mock_rules") effectivePath = "mock";
    if (parserKind === "model_proxy") effectivePath = "remote";
    if (parserKind === "model_proxy_fallback") effectivePath = "remote_with_fallback";
    if (!effectivePath) {
      effectivePath = options?.defaultEffectivePath ?? null;
    }
  }

  const mismatches: string[] = [];
  const expected = evalCase.expectation;

  if (outcomeClass !== expected.outcomeClass) {
    mismatches.push(
      `outcomeClass: expected "${expected.outcomeClass}", received "${outcomeClass}"`,
    );
  }

  if (expected.draftKind && draftKind !== expected.draftKind) {
    mismatches.push(`draftKind: expected "${expected.draftKind}", received "${draftKind ?? "null"}"`);
  }

  if (expected.parserKind && parserKind !== expected.parserKind) {
    mismatches.push(`parserKind: expected "${expected.parserKind}", received "${parserKind ?? "null"}"`);
  }

  if (expected.effectivePath && effectivePath !== expected.effectivePath) {
    mismatches.push(
      `effectivePath: expected "${expected.effectivePath}", received "${effectivePath ?? "null"}"`,
    );
  }

  compareStringField(mismatches, "title", title, expected.title);
  compareStringField(mismatches, "name", name, expected.name);
  compareStringField(
    mismatches,
    "dueDate",
    dueDate,
    resolveExpectedDate(expected.dueDate, dateContext),
  );
  compareStringField(mismatches, "priority", priority, expected.priority);
  compareNumberField(mismatches, "targetPerDay", targetPerDay, expected.targetPerDay);
  compareStringField(mismatches, "category", category, expected.category);
  compareStringArrayField(mismatches, "warningCodes", warningCodes, expected.warningCodes);
  compareStringArrayField(mismatches, "missingFields", missingFields, expected.missingFields);

  return {
    label: evalCase.label,
    rawCommand: evalCase.rawCommand,
    expectedModeContext: evalCase.expectedModeContext,
    evaluationKind: evalCase.evaluationKind,
    note: evalCase.note ?? null,
    expectation: evalCase.expectation,
    metadataVisible,
    parseOutcome,
    outcomeClass,
    status,
    effectivePath,
    parserKind,
    draftKind,
    title,
    name,
    dueDate,
    priority,
    targetPerDay,
    category,
    warningCodes,
    missingFields,
    fallback: parserKind === "model_proxy_fallback" || effectivePath === "remote_with_fallback",
    unavailableReason,
    mismatches,
  };
}

function incrementCounter(counter: Record<string, number>, key: string) {
  counter[key] = (counter[key] ?? 0) + 1;
}

export function buildCommandEvalArtifact(
  suiteName: string,
  configMode: string,
  results: CommandEvalCaseResult[],
): CommandEvalArtifact {
  const outcomeCounts: Record<EvalOutcomeClass, number> = {
    ready: 0,
    needs_input: 0,
    unsupported: 0,
    unavailable: 0,
  };
  const parseOutcomeCounts: Record<CommandEvalCaseResult["parseOutcome"], number> = {
    draft: 0,
    unsupported: 0,
    unavailable: 0,
  };
  const effectivePathCounts: Record<string, number> = {};
  const parserKindCounts: Record<string, number> = {};
  const warningFrequencyCounts: Record<string, number> = {};

  for (const result of results) {
    outcomeCounts[result.outcomeClass] += 1;
    parseOutcomeCounts[result.parseOutcome] += 1;
    incrementCounter(effectivePathCounts, result.effectivePath ?? "none");
    incrementCounter(parserKindCounts, result.parserKind ?? "none");
    for (const warningCode of result.warningCodes) {
      incrementCounter(warningFrequencyCounts, warningCode);
    }
  }

  return {
    suiteName,
    timestamp: new Date().toISOString(),
    configMode,
    totalCases: results.length,
    classificationCaseCount: results.filter((result) => result.evaluationKind === "classification")
      .length,
    semanticCaseCount: results.filter((result) => result.evaluationKind === "semantic").length,
    mismatchCount: results.reduce((total, result) => total + result.mismatches.length, 0),
    outcomeCounts,
    parseOutcomeCounts,
    effectivePathCounts,
    parserKindCounts,
    fallbackCount: results.filter((result) => result.fallback).length,
    unavailableCount: results.filter((result) => result.outcomeClass === "unavailable").length,
    metadataVisibleCount: results.filter((result) => result.metadataVisible).length,
    warningFrequencyCounts,
    perCaseResults: results,
  };
}

export async function writeCommandEvalArtifact(
  relativeOutputPath: string,
  artifact: CommandEvalArtifact,
) {
  const outputPath = join(process.cwd(), relativeOutputPath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
}

export function buildCommandEvalFailureSummary(artifact: CommandEvalArtifact) {
  const failedCases = artifact.perCaseResults.filter((result) => result.mismatches.length > 0);
  if (failedCases.length === 0) {
    return "";
  }

  return failedCases
    .map((result) => `[${result.label}] ${result.rawCommand}\n${result.mismatches.join("\n")}`)
    .join("\n\n");
}
