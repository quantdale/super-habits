import { useMemo, useState } from "react";
import { Link, type Href, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { PageHeader } from "@/core/ui/PageHeader";
import { Screen } from "@/core/ui/Screen";
import { ScreenSection } from "@/core/ui/ScreenSection";
import { Card } from "@/core/ui/Card";
import { Button } from "@/core/ui/Button";
import { PillChip } from "@/core/ui/PillChip";
import { TextField } from "@/core/ui/TextField";
import { ValidationError } from "@/core/ui/ValidationError";
import { useAppTheme } from "@/core/providers/ThemeProvider";
import { toDateKey } from "@/lib/time";
import { executeDraftAction } from "./command.executor";
import { commandParser } from "./commandParser";
import type {
  CommandExecutionResult,
  DraftAiAction,
  DraftCreateHabit,
  DraftCreateTodo,
  DraftMissingField,
  ParseCommandResult,
} from "./types";
import { COMMAND_EXPERIMENT_ENABLED } from "./types";

const OVERVIEW_HREF = "/(tabs)/overview" as Href;
const TODOS_HREF = "/(tabs)/todos" as Href;
const HABITS_HREF = "/(tabs)/habits" as Href;
const COMMAND_ACCENT = "#475569";
const TODO_PRIORITIES: Array<{ value: DraftCreateTodo["fields"]["priority"]; label: string }> = [
  { value: "urgent", label: "Urgent" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];
const HABIT_CATEGORIES: Array<{ value: DraftCreateHabit["fields"]["category"]; label: string }> = [
  { value: "anytime", label: "Anytime" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

function getParserContext() {
  if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat !== "function") {
    return { locale: "en-US", timeZone: "UTC" };
  }

  const options = Intl.DateTimeFormat().resolvedOptions();
  return {
    locale: options.locale ?? "en-US",
    timeZone: options.timeZone ?? "UTC",
  };
}

function PreviewSectionTitle({ children }: { children: string }) {
  return <Text className="text-sm font-semibold text-slate-900">{children}</Text>;
}

function PreviewInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <Text className="text-sm font-medium text-slate-500">{label}</Text>
      <Text className="flex-1 text-right text-sm text-slate-900">{value}</Text>
    </View>
  );
}

function PreviewWarning({ message }: { message: string }) {
  return (
    <View className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
      <Text className="text-sm text-amber-800">{message}</Text>
    </View>
  );
}

function PreviewMissingField({ message }: { message: string }) {
  return (
    <View className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <Text className="text-sm text-slate-600">{message}</Text>
    </View>
  );
}

function getTomorrowDateKey(base = new Date()): string {
  const nextDay = new Date(base);
  nextDay.setDate(nextDay.getDate() + 1);
  return toDateKey(nextDay);
}

function cloneDraft(draft: DraftAiAction): DraftAiAction {
  return draft.kind === "create_todo"
    ? { ...draft, fields: { ...draft.fields } }
    : { ...draft, fields: { ...draft.fields } };
}

function getInlineRequiredMissingFields(draft: DraftAiAction): DraftMissingField[] {
  if (draft.kind === "create_todo") {
    return draft.fields.title?.trim()
      ? []
      : [{ field: "title", message: "Add the task title before saving." }];
  }

  return draft.fields.name?.trim()
    ? []
    : [{ field: "name", message: "Add the habit name before saving." }];
}

function isFieldStillMissing(draft: DraftAiAction, field: string): boolean {
  if (draft.kind === "create_todo" && field === "title") {
    return !draft.fields.title?.trim();
  }

  if (draft.kind === "create_habit" && field === "name") {
    return !draft.fields.name?.trim();
  }

  return false;
}

function DraftPreview({
  parsedDraft,
  editableDraft,
  visibleMissingFields,
  canConfirm,
  busy,
  executionError,
  successResult,
  onEditTodoTitle,
  onEditTodoNotes,
  onEditTodoDueDate,
  onSetTodoDueDateToday,
  onSetTodoDueDateTomorrow,
  onClearTodoDueDate,
  onEditTodoPriority,
  onEditHabitName,
  onEditHabitTargetPerDay,
  onEditHabitCategory,
  onConfirm,
  onReset,
}: {
  parsedDraft: DraftAiAction;
  editableDraft: DraftAiAction;
  visibleMissingFields: DraftMissingField[];
  canConfirm: boolean;
  busy: boolean;
  executionError: string | null;
  successResult: Extract<CommandExecutionResult, { outcome: "success" }> | null;
  onEditTodoTitle: (value: string) => void;
  onEditTodoNotes: (value: string) => void;
  onEditTodoDueDate: (value: string) => void;
  onSetTodoDueDateToday: () => void;
  onSetTodoDueDateTomorrow: () => void;
  onClearTodoDueDate: () => void;
  onEditTodoPriority: (value: DraftCreateTodo["fields"]["priority"]) => void;
  onEditHabitName: (value: string) => void;
  onEditHabitTargetPerDay: (value: string) => void;
  onEditHabitCategory: (value: DraftCreateHabit["fields"]["category"]) => void;
  onConfirm: () => void;
  onReset: () => void;
}) {
  const router = useRouter();
  const destinationHref = editableDraft.kind === "create_todo" ? TODOS_HREF : HABITS_HREF;
  const destinationLabel = editableDraft.kind === "create_todo" ? "Go to Todos" : "Go to Habits";

  return (
    <Card
      variant="header"
      accentColor={COMMAND_ACCENT}
      headerTitle="Review before saving"
      headerSubtitle="Nothing has been saved yet."
      className="mb-0"
    >
      <View className="gap-3">
        <PreviewInfoRow
          label="Intent"
          value={editableDraft.kind === "create_todo" ? "Create todo" : "Create habit"}
        />
        <PreviewInfoRow label="Parser status" value={parsedDraft.status} />
        <PreviewInfoRow label="Ready to save" value={canConfirm ? "yes" : "no"} />
        <PreviewInfoRow
          label="Parser"
          value={`${parsedDraft.parserKind} ${parsedDraft.parserVersion}`}
        />

        {editableDraft.kind === "create_todo" ? (
          <>
            <PreviewSectionTitle>Todo fields</PreviewSectionTitle>
            <TextField
              label="Title"
              value={editableDraft.fields.title ?? ""}
              onChangeText={onEditTodoTitle}
              placeholder="Task title"
              nativeID="command-edit-todo-title"
            />
            <TextField
              label="Notes"
              value={editableDraft.fields.notes ?? ""}
              onChangeText={onEditTodoNotes}
              placeholder="Optional notes"
              nativeID="command-edit-todo-notes"
            />
            <TextField
              label="Due date (YYYY-MM-DD)"
              value={editableDraft.fields.dueDate ?? ""}
              onChangeText={onEditTodoDueDate}
              placeholder="YYYY-MM-DD"
              nativeID="command-edit-todo-due-date"
            />
            <View className="-mt-2 flex-row flex-wrap gap-2">
              <View>
                <Button label="Today" variant="ghost" onPress={onSetTodoDueDateToday} />
              </View>
              <View>
                <Button label="Tomorrow" variant="ghost" onPress={onSetTodoDueDateTomorrow} />
              </View>
              <View>
                <Button label="Clear" variant="ghost" onPress={onClearTodoDueDate} />
              </View>
            </View>
            <PreviewSectionTitle>Priority</PreviewSectionTitle>
            <View className="flex-row flex-wrap">
              {TODO_PRIORITIES.map((priority) => (
                <PillChip
                  key={priority.value}
                  label={priority.label}
                  active={editableDraft.fields.priority === priority.value}
                  color={COMMAND_ACCENT}
                  onPress={() => onEditTodoPriority(priority.value)}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <PreviewSectionTitle>Habit fields</PreviewSectionTitle>
            <TextField
              label="Name"
              value={editableDraft.fields.name ?? ""}
              onChangeText={onEditHabitName}
              placeholder="Habit name"
              nativeID="command-edit-habit-name"
            />
            <TextField
              label="Target per day"
              value={
                Number.isFinite(editableDraft.fields.targetPerDay)
                  ? String(editableDraft.fields.targetPerDay)
                  : ""
              }
              onChangeText={onEditHabitTargetPerDay}
              placeholder="1"
              unsignedInteger
              nativeID="command-edit-habit-target"
            />
            <PreviewSectionTitle>Category</PreviewSectionTitle>
            <View className="flex-row flex-wrap">
              {HABIT_CATEGORIES.map((category) => (
                <PillChip
                  key={category.value}
                  label={category.label}
                  active={editableDraft.fields.category === category.value}
                  color={COMMAND_ACCENT}
                  onPress={() => onEditHabitCategory(category.value)}
                />
              ))}
            </View>
            <PreviewInfoRow
              label="Defaults on save"
              value={`${editableDraft.fields.icon ?? "default icon"}, ${editableDraft.fields.color ?? "default color"}`}
            />
          </>
        )}

        {parsedDraft.warnings.length > 0 ? (
          <>
            <PreviewSectionTitle>Warnings</PreviewSectionTitle>
            {parsedDraft.warnings.map((warning) => (
              <PreviewWarning key={`${warning.code}:${warning.message}`} message={warning.message} />
            ))}
          </>
        ) : null}

        {visibleMissingFields.length > 0 ? (
          <>
            <PreviewSectionTitle>Needs input</PreviewSectionTitle>
            {visibleMissingFields.map((missing) => (
              <PreviewMissingField
                key={`${missing.field}:${missing.message}`}
                message={missing.message}
              />
            ))}
            {!canConfirm ? (
              <Text className="text-sm text-slate-500">
                Fill required fields before saving.
              </Text>
            ) : null}
          </>
        ) : null}

        <ValidationError message={executionError} />

        {successResult ? (
          <View className="gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
            <Text className="text-sm font-semibold text-emerald-800">{successResult.message}</Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  label={destinationLabel}
                  onPress={() => router.push(destinationHref)}
                  color={COMMAND_ACCENT}
                />
              </View>
              <View className="flex-1">
                <Button label="New command" variant="ghost" onPress={onReset} />
              </View>
            </View>
          </View>
        ) : canConfirm ? (
          <Button
            label={busy ? "Saving..." : "Confirm and save"}
            onPress={onConfirm}
            color={COMMAND_ACCENT}
            disabled={busy}
          />
        ) : (
          <Text className="text-sm text-slate-500">
            Fill required fields before saving.
          </Text>
        )}
      </View>
    </Card>
  );
}

export function CommandScreen() {
  const { tokens } = useAppTheme();
  const [rawText, setRawText] = useState("");
  const [parseResult, setParseResult] = useState<ParseCommandResult | null>(null);
  const [editableDraft, setEditableDraft] = useState<DraftAiAction | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [successResult, setSuccessResult] = useState<
    Extract<CommandExecutionResult, { outcome: "success" }> | null
  >(null);

  const parsedDraft = useMemo(
    () => (parseResult?.outcome === "draft" ? parseResult.draft : null),
    [parseResult],
  );
  const visibleMissingFields = useMemo(() => {
    if (!editableDraft || !parsedDraft) return [];

    const unresolvedParseMissing = parsedDraft.missingFields.filter((missing) =>
      isFieldStillMissing(editableDraft, missing.field),
    );
    const inlineRequiredMissing = getInlineRequiredMissingFields(editableDraft).filter(
      (missing) => !unresolvedParseMissing.some((existing) => existing.field === missing.field),
    );

    return [...unresolvedParseMissing, ...inlineRequiredMissing];
  }, [editableDraft, parsedDraft]);
  const canConfirm = useMemo(
    () => (editableDraft ? getInlineRequiredMissingFields(editableDraft).length === 0 : false),
    [editableDraft],
  );

  const handleReset = () => {
    setRawText("");
    setParseResult(null);
    setEditableDraft(null);
    setExecutionError(null);
    setIsExecuting(false);
    setIsParsing(false);
    setSuccessResult(null);
  };

  const handleParseCommand = async () => {
    setExecutionError(null);
    setSuccessResult(null);
    setIsParsing(true);

    const parserContext = getParserContext();
    const now = new Date();
    try {
      const nextResult = await commandParser.parse({
        rawText,
        now,
        locale: parserContext.locale,
        timeZone: parserContext.timeZone,
        todayDateKey: toDateKey(now),
        tomorrowDateKey: getTomorrowDateKey(now),
      });
      setParseResult(nextResult);
      setEditableDraft(nextResult.outcome === "draft" ? cloneDraft(nextResult.draft) : null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!editableDraft || !canConfirm) return;

    setIsExecuting(true);
    setExecutionError(null);

    const result = await executeDraftAction(editableDraft);
    if (result.outcome === "success") {
      setSuccessResult(result);
    } else {
      setSuccessResult(null);
      setExecutionError(result.message);
    }

    setIsExecuting(false);
  };

  const hasCommandText = rawText.trim().length > 0;

  if (!COMMAND_EXPERIMENT_ENABLED) {
    return (
      <Screen scroll>
        <ScreenSection>
          <PageHeader
            title="Quick command"
            subtitle="This experimental screen is currently disabled."
            actions={
              <Link href={OVERVIEW_HREF} asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to overview"
                  className="rounded-xl border px-3.5 py-2.5"
                  style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
                >
                  <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                    Back
                  </Text>
                </Pressable>
              </Link>
            }
          />
        </ScreenSection>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenSection>
        <PageHeader
          title="Quick command"
          subtitle="Parse a single create-todo or create-habit command, review it, then confirm."
          actions={
            <Link href={OVERVIEW_HREF} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to overview"
                className="rounded-xl border px-3.5 py-2.5"
                style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
              >
                <MaterialIcons name="arrow-back" size={18} color={tokens.text} />
              </Pressable>
            </Link>
          }
        />
      </ScreenSection>

      <ScreenSection>
        <Card
          variant="header"
          accentColor={COMMAND_ACCENT}
          headerTitle="Command input"
          headerSubtitle="Nothing has been saved yet."
          className="mb-0"
        >
          <View className="gap-3">
            <TextField
              label="Command"
              value={rawText}
              onChangeText={(nextText) => {
                setRawText(nextText);
                setParseResult(null);
                setEditableDraft(null);
                setExecutionError(null);
                setIsParsing(false);
                setSuccessResult(null);
              }}
              placeholder="Add a todo to call mom tomorrow"
              nativeID="command-input"
            />

            <View className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <Text className="text-sm font-semibold text-slate-900">Supported examples</Text>
              <Text className="mt-1 text-sm text-slate-600">
                Create a habit to drink water every morning
              </Text>
              <Text className="mt-1 text-sm text-slate-600">
                Add a todo to call mom tomorrow at 7pm
              </Text>
            </View>

            <Button
              label={isParsing ? "Parsing..." : "Parse command"}
              onPress={handleParseCommand}
              color={COMMAND_ACCENT}
              disabled={!hasCommandText || isParsing}
            />
          </View>
        </Card>
      </ScreenSection>

      {parseResult?.outcome === "unsupported" ? (
        <ScreenSection className="mb-0">
          <Card
            variant="header"
            accentColor={COMMAND_ACCENT}
            headerTitle="Try rewording your command"
            headerSubtitle="Nothing has been saved yet."
            className="mb-0"
          >
            <Text className="text-sm text-slate-600">{parseResult.reason}</Text>
          </Card>
        </ScreenSection>
      ) : null}

      {parseResult?.outcome === "unavailable" ? (
        <ScreenSection className="mb-0">
          <Card
            variant="header"
            accentColor={COMMAND_ACCENT}
            headerTitle="Parse unavailable"
            headerSubtitle="Nothing has been saved yet."
            className="mb-0"
          >
            <View className="gap-3">
              <Text className="text-sm text-slate-600">{parseResult.message}</Text>
              <Button
                label="Try again"
                onPress={handleParseCommand}
                color={COMMAND_ACCENT}
                disabled={!hasCommandText || isParsing}
              />
            </View>
          </Card>
        </ScreenSection>
      ) : null}

      {parsedDraft && editableDraft ? (
        <ScreenSection className="mb-0">
          <DraftPreview
            parsedDraft={parsedDraft}
            editableDraft={editableDraft}
            visibleMissingFields={visibleMissingFields}
            canConfirm={canConfirm}
            busy={isExecuting}
            executionError={executionError}
            successResult={successResult}
            onEditTodoTitle={(value) => {
              setEditableDraft((current) =>
                current?.kind === "create_todo"
                  ? { ...current, fields: { ...current.fields, title: value } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onEditTodoNotes={(value) => {
              setEditableDraft((current) =>
                current?.kind === "create_todo"
                  ? { ...current, fields: { ...current.fields, notes: value } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onEditTodoDueDate={(value) => {
              const trimmed = value.trim();
              setEditableDraft((current) =>
                current?.kind === "create_todo"
                  ? { ...current, fields: { ...current.fields, dueDate: trimmed.length > 0 ? trimmed : null } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onSetTodoDueDateToday={() => {
              setEditableDraft((current) =>
                current?.kind === "create_todo"
                  ? { ...current, fields: { ...current.fields, dueDate: toDateKey(new Date()) } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onSetTodoDueDateTomorrow={() => {
              setEditableDraft((current) =>
                current?.kind === "create_todo"
                  ? { ...current, fields: { ...current.fields, dueDate: getTomorrowDateKey() } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onClearTodoDueDate={() => {
              setEditableDraft((current) =>
                current?.kind === "create_todo"
                  ? { ...current, fields: { ...current.fields, dueDate: null } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onEditTodoPriority={(value) => {
              setEditableDraft((current) =>
                current?.kind === "create_todo"
                  ? { ...current, fields: { ...current.fields, priority: value } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onEditHabitName={(value) => {
              setEditableDraft((current) =>
                current?.kind === "create_habit"
                  ? { ...current, fields: { ...current.fields, name: value } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onEditHabitTargetPerDay={(value) => {
              const nextValue = value.trim();
              const parsedValue = nextValue.length > 0 ? Number(nextValue) : Number.NaN;
              setEditableDraft((current) =>
                current?.kind === "create_habit"
                  ? { ...current, fields: { ...current.fields, targetPerDay: parsedValue } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onEditHabitCategory={(value) => {
              setEditableDraft((current) =>
                current?.kind === "create_habit"
                  ? { ...current, fields: { ...current.fields, category: value } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onConfirm={handleConfirm}
            onReset={handleReset}
          />
        </ScreenSection>
      ) : null}
    </Screen>
  );
}
