import { getDatabase } from "@/core/db/client";
import { assertDemoMode } from "@/lib/demo";
import { createId } from "@/lib/id";
import { nowIso, toDateKey } from "@/lib/time";

type DemoManifestTable =
  | "todos"
  | "habits"
  | "habit_completions"
  | "pomodoro_sessions"
  | "workout_routines"
  | "routine_exercises"
  | "routine_exercise_sets"
  | "workout_logs"
  | "workout_session_exercises"
  | "calorie_entries"
  | "saved_meals";

type DemoSeedManifest = Record<DemoManifestTable, string[]>;

type Database = Awaited<ReturnType<typeof getDatabase>>;
type SqlValue = string | number | null;

const MANIFEST_KEY = "demo_seed_manifest";
const LOCAL_ONLY_TABLES: DemoManifestTable[] = [
  "habit_completions",
  "pomodoro_sessions",
  "routine_exercise_sets",
  "routine_exercises",
  "workout_logs",
  "workout_session_exercises",
  "saved_meals",
];
const SYNCED_MAIN_TABLES: DemoManifestTable[] = [
  "todos",
  "habits",
  "workout_routines",
  "calorie_entries",
];

function createEmptyManifest(): DemoSeedManifest {
  return {
    todos: [],
    habits: [],
    habit_completions: [],
    pomodoro_sessions: [],
    workout_routines: [],
    routine_exercises: [],
    routine_exercise_sets: [],
    workout_logs: [],
    workout_session_exercises: [],
    calorie_entries: [],
    saved_meals: [],
  };
}

function trackId(manifest: DemoSeedManifest, table: DemoManifestTable, id: string): string {
  manifest[table].push(id);
  return id;
}

function buildDate(daysFromToday: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date;
}

function buildIso(daysFromToday: number, hour: number, minute = 0): string {
  return buildDate(daysFromToday, hour, minute).toISOString();
}

function buildDateKey(daysFromToday: number): string {
  return toDateKey(buildDate(daysFromToday, 12));
}

async function runInsert(db: Database, sql: string, values: SqlValue[]): Promise<void> {
  await db.runAsync(sql, values);
}

async function readManifest(db: Database): Promise<DemoSeedManifest> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ?`,
    [MANIFEST_KEY],
  );

  if (!row?.value) {
    return createEmptyManifest();
  }

  try {
    const parsed = JSON.parse(row.value) as Partial<DemoSeedManifest>;
    return {
      todos: parsed.todos ?? [],
      habits: parsed.habits ?? [],
      habit_completions: parsed.habit_completions ?? [],
      pomodoro_sessions: parsed.pomodoro_sessions ?? [],
      workout_routines: parsed.workout_routines ?? [],
      routine_exercises: parsed.routine_exercises ?? [],
      routine_exercise_sets: parsed.routine_exercise_sets ?? [],
      workout_logs: parsed.workout_logs ?? [],
      workout_session_exercises: parsed.workout_session_exercises ?? [],
      calorie_entries: parsed.calorie_entries ?? [],
      saved_meals: parsed.saved_meals ?? [],
    };
  } catch {
    return createEmptyManifest();
  }
}

async function writeManifest(db: Database, manifest: DemoSeedManifest): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
    [MANIFEST_KEY, JSON.stringify(manifest)],
  );
}

async function deleteManifest(db: Database): Promise<void> {
  await db.runAsync(`DELETE FROM app_meta WHERE key = ?`, [MANIFEST_KEY]);
}

async function withTransaction(db: Database, fn: () => Promise<void>): Promise<void> {
  await db.execAsync("BEGIN IMMEDIATE TRANSACTION");
  try {
    await fn();
    await db.execAsync("COMMIT");
  } catch (error) {
    await db.execAsync("ROLLBACK");
    throw error;
  }
}

async function hardDeleteByIds(db: Database, table: DemoManifestTable, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(", ");
  await db.runAsync(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ids);
}

async function softDeleteByIds(
  db: Database,
  table: DemoManifestTable,
  ids: string[],
  deletedAt: string,
): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(", ");
  await db.runAsync(
    `UPDATE ${table}
     SET deleted_at = ?, updated_at = ?
     WHERE id IN (${placeholders})`,
    [deletedAt, deletedAt, ...ids],
  );
}

async function insertTodoSeedRows(
  db: Database,
  manifest: DemoSeedManifest,
  createdAt: string,
): Promise<void> {
  const recurringSeriesId = createId("rec");
  const todos = [
    {
      title: "Plan the next seven days",
      notes: "Review deadlines and block time for deep work.",
      completed: 0,
      dueDate: buildDateKey(0),
      priority: "urgent",
      sortOrder: 1,
      recurrence: null,
      recurrenceId: null,
    },
    {
      title: "Review habit streaks",
      notes: "Spot the one habit that needs attention tomorrow.",
      completed: 0,
      dueDate: buildDateKey(1),
      priority: "normal",
      sortOrder: 2,
      recurrence: null,
      recurrenceId: null,
    },
    {
      title: "Prep gym bag",
      notes: "Shoes, bands, and water bottle by the door.",
      completed: 0,
      dueDate: null,
      priority: "low",
      sortOrder: 3,
      recurrence: null,
      recurrenceId: null,
    },
    {
      title: "Drink water before lunch",
      notes: "Daily reset habit tied to midday break.",
      completed: 0,
      dueDate: buildDateKey(0),
      priority: "normal",
      sortOrder: 4,
      recurrence: "daily",
      recurrenceId: recurringSeriesId,
    },
    {
      title: "Submit expense report",
      notes: "Finished after breakfast.",
      completed: 1,
      dueDate: buildDateKey(-1),
      priority: "urgent",
      sortOrder: 5,
      recurrence: null,
      recurrenceId: null,
    },
  ] as const;

  for (const todo of todos) {
    const id = trackId(manifest, "todos", createId("todo"));
    await runInsert(
      db,
      `INSERT INTO todos
         (id, title, notes, completed, due_date, priority, sort_order, recurrence, recurrence_id, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        todo.title,
        todo.notes,
        todo.completed,
        todo.dueDate,
        todo.priority,
        todo.sortOrder,
        todo.recurrence,
        todo.recurrenceId,
        createdAt,
        createdAt,
      ],
    );
  }
}

async function insertHabitSeedRows(
  db: Database,
  manifest: DemoSeedManifest,
  createdAt: string,
): Promise<void> {
  const habits = [
    {
      id: trackId(manifest, "habits", createId("habit")),
      name: "Morning Stretch",
      targetPerDay: 1,
      category: "morning",
      icon: "self-improvement",
      color: "#10b981",
    },
    {
      id: trackId(manifest, "habits", createId("habit")),
      name: "Deep Work Blocks",
      targetPerDay: 2,
      category: "anytime",
      icon: "psychology",
      color: "#6366f1",
    },
    {
      id: trackId(manifest, "habits", createId("habit")),
      name: "Water Refills",
      targetPerDay: 4,
      category: "afternoon",
      icon: "water-drop",
      color: "#0ea5e9",
    },
    {
      id: trackId(manifest, "habits", createId("habit")),
      name: "Evening Walk",
      targetPerDay: 1,
      category: "evening",
      icon: "fitness-center",
      color: "#f97316",
    },
  ] as const;

  for (const habit of habits) {
    await runInsert(
      db,
      `INSERT INTO habits
         (id, name, target_per_day, reminder_time, category, icon, color, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL)`,
      [
        habit.id,
        habit.name,
        habit.targetPerDay,
        habit.category,
        habit.icon,
        habit.color,
        createdAt,
        createdAt,
      ],
    );
  }

  const completionPlan: Array<{ habitId: string; daysFromToday: number; count: number }> = [
    ...Array.from({ length: 10 }, (_, index) => ({
      habitId: habits[0].id,
      daysFromToday: index - 9,
      count: 1,
    })),
    { habitId: habits[1].id, daysFromToday: -4, count: 2 },
    { habitId: habits[1].id, daysFromToday: -3, count: 2 },
    { habitId: habits[1].id, daysFromToday: -2, count: 2 },
    { habitId: habits[1].id, daysFromToday: -1, count: 2 },
    { habitId: habits[1].id, daysFromToday: 0, count: 2 },
    { habitId: habits[2].id, daysFromToday: -5, count: 3 },
    { habitId: habits[2].id, daysFromToday: -4, count: 4 },
    { habitId: habits[2].id, daysFromToday: -3, count: 4 },
    { habitId: habits[2].id, daysFromToday: -2, count: 4 },
    { habitId: habits[2].id, daysFromToday: -1, count: 4 },
    { habitId: habits[2].id, daysFromToday: 0, count: 4 },
    { habitId: habits[3].id, daysFromToday: -6, count: 1 },
    { habitId: habits[3].id, daysFromToday: -4, count: 1 },
    { habitId: habits[3].id, daysFromToday: -2, count: 1 },
    { habitId: habits[3].id, daysFromToday: 0, count: 1 },
  ];

  for (const completion of completionPlan) {
    const id = trackId(manifest, "habit_completions", createId("hcmp"));
    await runInsert(
      db,
      `INSERT INTO habit_completions
         (id, habit_id, date_key, count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        completion.habitId,
        buildDateKey(completion.daysFromToday),
        completion.count,
        createdAt,
        createdAt,
      ],
    );
  }
}

async function insertPomodoroSeedRows(
  db: Database,
  manifest: DemoSeedManifest,
  createdAt: string,
): Promise<void> {
  const sessions = [
    { daysFromToday: -4, hour: 9, minute: 0, durationSeconds: 1500 },
    { daysFromToday: -2, hour: 8, minute: 30, durationSeconds: 1500 },
    { daysFromToday: -2, hour: 14, minute: 0, durationSeconds: 1500 },
    { daysFromToday: -1, hour: 10, minute: 0, durationSeconds: 1500 },
    { daysFromToday: 0, hour: 7, minute: 30, durationSeconds: 1500 },
    { daysFromToday: 0, hour: 13, minute: 30, durationSeconds: 1500 },
  ] as const;

  for (const session of sessions) {
    const id = trackId(manifest, "pomodoro_sessions", createId("pom"));
    const startedAt = buildIso(session.daysFromToday, session.hour, session.minute);
    const endedAt = new Date(
      buildDate(session.daysFromToday, session.hour, session.minute).getTime() +
        session.durationSeconds * 1000,
    ).toISOString();

    await runInsert(
      db,
      `INSERT INTO pomodoro_sessions
         (id, started_at, ended_at, duration_seconds, session_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, startedAt, endedAt, session.durationSeconds, "focus", createdAt],
    );
  }
}

async function insertWorkoutSeedRows(
  db: Database,
  manifest: DemoSeedManifest,
  createdAt: string,
): Promise<void> {
  const routineId = trackId(manifest, "workout_routines", createId("wrk"));

  await runInsert(
    db,
    `INSERT INTO workout_routines
       (id, name, description, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, NULL)`,
    [
      routineId,
      "Full Body Express",
      "Compact routine for a quick but complete session.",
      createdAt,
      createdAt,
    ],
  );

  const exercises = [
    {
      id: trackId(manifest, "routine_exercises", createId("ex")),
      name: "Push-Ups",
      sortOrder: 1,
      sets: [
        { id: trackId(manifest, "routine_exercise_sets", createId("eset")), setNumber: 1, activeSeconds: 45, restSeconds: 20 },
        { id: trackId(manifest, "routine_exercise_sets", createId("eset")), setNumber: 2, activeSeconds: 45, restSeconds: 20 },
        { id: trackId(manifest, "routine_exercise_sets", createId("eset")), setNumber: 3, activeSeconds: 45, restSeconds: 30 },
      ],
    },
    {
      id: trackId(manifest, "routine_exercises", createId("ex")),
      name: "Goblet Squats",
      sortOrder: 2,
      sets: [
        { id: trackId(manifest, "routine_exercise_sets", createId("eset")), setNumber: 1, activeSeconds: 50, restSeconds: 25 },
        { id: trackId(manifest, "routine_exercise_sets", createId("eset")), setNumber: 2, activeSeconds: 50, restSeconds: 25 },
        { id: trackId(manifest, "routine_exercise_sets", createId("eset")), setNumber: 3, activeSeconds: 50, restSeconds: 35 },
      ],
    },
  ];

  for (const exercise of exercises) {
    await runInsert(
      db,
      `INSERT INTO routine_exercises
         (id, routine_id, name, sort_order, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [exercise.id, routineId, exercise.name, exercise.sortOrder, createdAt, createdAt],
    );

    for (const set of exercise.sets) {
      await runInsert(
        db,
        `INSERT INTO routine_exercise_sets
           (id, exercise_id, set_number, active_seconds, rest_seconds, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          set.id,
          exercise.id,
          set.setNumber,
          set.activeSeconds,
          set.restSeconds,
          createdAt,
          createdAt,
        ],
      );
    }
  }

  const logs = [
    {
      id: trackId(manifest, "workout_logs", createId("wrk")),
      daysFromToday: -1,
      notes: "Moved quickly between sets and felt strong.",
    },
    {
      id: trackId(manifest, "workout_logs", createId("wrk")),
      daysFromToday: 0,
      notes: "Short lunchtime lift with extra squat reps.",
    },
  ] as const;

  for (const log of logs) {
    const completedAt = buildIso(log.daysFromToday, 18, 0);
    await runInsert(
      db,
      `INSERT INTO workout_logs
         (id, routine_id, notes, completed_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [log.id, routineId, log.notes, completedAt, createdAt],
    );

    for (const exercise of exercises) {
      const sessionExerciseId = trackId(
        manifest,
        "workout_session_exercises",
        createId("wsex"),
      );
      await runInsert(
        db,
        `INSERT INTO workout_session_exercises
           (id, log_id, exercise_name, sets_completed, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [sessionExerciseId, log.id, exercise.name, exercise.sets.length, createdAt],
      );
    }
  }
}

async function insertCalorieSeedRows(
  db: Database,
  manifest: DemoSeedManifest,
  createdAt: string,
): Promise<void> {
  const entries = [
    {
      foodName: "Protein oats",
      calories: 420,
      protein: 28,
      carbs: 52,
      fats: 10,
      fiber: 8,
      mealType: "breakfast",
      consumedOn: buildDateKey(0),
    },
    {
      foodName: "Chicken rice bowl",
      calories: 610,
      protein: 43,
      carbs: 68,
      fats: 16,
      fiber: 6,
      mealType: "lunch",
      consumedOn: buildDateKey(0),
    },
    {
      foodName: "Salmon dinner",
      calories: 760,
      protein: 48,
      carbs: 54,
      fats: 32,
      fiber: 7,
      mealType: "dinner",
      consumedOn: buildDateKey(0),
    },
    {
      foodName: "Greek yogurt snack",
      calories: 190,
      protein: 17,
      carbs: 14,
      fats: 6,
      fiber: 0,
      mealType: "snack",
      consumedOn: buildDateKey(0),
    },
    {
      foodName: "Turkey wrap",
      calories: 540,
      protein: 36,
      carbs: 48,
      fats: 18,
      fiber: 5,
      mealType: "lunch",
      consumedOn: buildDateKey(-1),
    },
    {
      foodName: "Egg scramble",
      calories: 380,
      protein: 30,
      carbs: 16,
      fats: 18,
      fiber: 3,
      mealType: "breakfast",
      consumedOn: buildDateKey(-2),
    },
  ] as const;

  for (const entry of entries) {
    const id = trackId(manifest, "calorie_entries", createId("cal"));
    await runInsert(
      db,
      `INSERT INTO calorie_entries
         (id, food_name, calories, protein, carbs, fats, fiber, meal_type, consumed_on, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        entry.foodName,
        entry.calories,
        entry.protein,
        entry.carbs,
        entry.fats,
        entry.fiber,
        entry.mealType,
        entry.consumedOn,
        createdAt,
        createdAt,
      ],
    );
  }

  const savedMeals = [
    {
      foodName: "Protein oats",
      calories: 420,
      protein: 28,
      carbs: 52,
      fats: 10,
      fiber: 8,
      mealType: "breakfast",
      useCount: 6,
    },
    {
      foodName: "Chicken rice bowl",
      calories: 610,
      protein: 43,
      carbs: 68,
      fats: 16,
      fiber: 6,
      mealType: "lunch",
      useCount: 4,
    },
    {
      foodName: "Greek yogurt snack",
      calories: 190,
      protein: 17,
      carbs: 14,
      fats: 6,
      fiber: 0,
      mealType: "snack",
      useCount: 5,
    },
  ] as const;

  for (const meal of savedMeals) {
    const id = trackId(manifest, "saved_meals", createId("smeal"));
    await runInsert(
      db,
      `INSERT INTO saved_meals
         (id, food_name, calories, protein, carbs, fats, fiber, meal_type, use_count, last_used_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        meal.foodName,
        meal.calories,
        meal.protein,
        meal.carbs,
        meal.fats,
        meal.fiber,
        meal.mealType,
        meal.useCount,
        createdAt,
        createdAt,
      ],
    );
  }
}

export async function clearDemoData(): Promise<void> {
  assertDemoMode();

  const db = await getDatabase();
  const manifest = await readManifest(db);

  await withTransaction(db, async () => {
    const deletedAt = nowIso();

    for (const table of LOCAL_ONLY_TABLES) {
      await hardDeleteByIds(db, table, manifest[table]);
    }

    for (const table of SYNCED_MAIN_TABLES) {
      await softDeleteByIds(db, table, manifest[table], deletedAt);
    }

    await deleteManifest(db);
  });
}

export async function seedDemoData(): Promise<void> {
  assertDemoMode();

  await clearDemoData();

  const db = await getDatabase();
  const manifest = createEmptyManifest();

  await withTransaction(db, async () => {
    const createdAt = nowIso();

    await insertTodoSeedRows(db, manifest, createdAt);
    await insertHabitSeedRows(db, manifest, createdAt);
    await insertPomodoroSeedRows(db, manifest, createdAt);
    await insertWorkoutSeedRows(db, manifest, createdAt);
    await insertCalorieSeedRows(db, manifest, createdAt);
    await writeManifest(db, manifest);
  });
}
