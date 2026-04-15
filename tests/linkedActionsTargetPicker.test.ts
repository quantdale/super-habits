import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLinkedActionTargetPickerProvider,
  getLinkedActionTargetPickerProviders,
} from "@/core/linked-actions/linkedActionsTargetProviders";
import {
  createLinkedActionTargetCreateNewSelection,
  createLinkedActionTargetExistingSelection,
} from "@/core/linked-actions/linkedActionsTargetPicker.types";

const { listTodos, listHabits, listRoutines } = vi.hoisted(() => ({
  listTodos: vi.fn(),
  listHabits: vi.fn(),
  listRoutines: vi.fn(),
}));

vi.mock("@/features/todos/todos.data", () => ({
  listTodos,
}));

vi.mock("@/features/habits/habits.data", () => ({
  listHabits,
}));

vi.mock("@/features/workout/workout.data", () => ({
  listRoutines,
}));

describe("linked actions target picker providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps pending todos into selectable existing candidates", async () => {
    listTodos.mockResolvedValue([
      {
        id: "todo_1",
        title: "Hydrate after workout",
        notes: null,
        completed: 0,
        due_date: "2026-04-14",
        priority: "urgent",
        sort_order: 1,
        recurrence: "daily",
        recurrence_id: "rec_1",
        created_at: "2026-04-14T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "todo_2",
        title: "Already done",
        notes: null,
        completed: 1,
        due_date: null,
        priority: "normal",
        sort_order: 2,
        recurrence: null,
        recurrence_id: null,
        created_at: "2026-04-14T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
        deleted_at: null,
      },
    ]);

    const provider = getLinkedActionTargetPickerProvider("todos");
    const candidates = await provider.existing.loadCandidates();

    expect(candidates).toEqual([
      {
        id: "todo_1",
        title: "Hydrate after workout",
        subtitle: "Urgent · Due 2026-04-14 · Repeats daily",
      },
    ]);
    expect(provider.createNew.buildHandoff()).toMatchObject({
      kind: "module_handoff",
      feature: "todos",
      entityType: "todo",
      ctaLabel: "Open Todos",
      destinationHref: "/(tabs)/todos",
    });
  });

  it("marks calories as create-new only in the current handoff flow", async () => {
    const provider = getLinkedActionTargetPickerProvider("calories");

    expect(provider.existing.supported).toBe(false);
    await expect(provider.existing.loadCandidates()).resolves.toEqual([]);
    expect(provider.createNew.buildHandoff()).toMatchObject({
      feature: "calories",
      entityType: "calorie_log",
      ctaLabel: "Open Calories",
      destinationHref: "/(tabs)/calories",
    });
  });

  it("creates explicit selection objects for existing and create-new branches", () => {
    const provider = getLinkedActionTargetPickerProvider("workout");
    const existingSelection = createLinkedActionTargetExistingSelection(provider, {
      id: "wrk_1",
      title: "Full Body A",
      subtitle: "No description yet",
    });
    const createNewSelection = createLinkedActionTargetCreateNewSelection(
      provider.createNew.buildHandoff(),
    );

    expect(existingSelection).toEqual({
      kind: "existing",
      feature: "workout",
      entityType: "workout_routine",
      candidate: {
        id: "wrk_1",
        title: "Full Body A",
        subtitle: "No description yet",
      },
    });
    expect(createNewSelection).toMatchObject({
      kind: "create_new",
      handoff: {
        feature: "workout",
        entityType: "workout_routine",
      },
    });
    expect(getLinkedActionTargetPickerProviders()).toHaveLength(5);
  });
});
