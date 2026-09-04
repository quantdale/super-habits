import { vi } from 'vitest';
import { createId } from '@/lib/id';
import type { TestDatabase } from '../helpers/db';

/**
 * Fixture seeders (task 2.11): SMALL / TYPICAL / HEAVY / MATURE corpora built by
 * calling the REAL feature data-layer functions with an injected clock.
 *
 * ## Clock injection (design decision)
 *
 * The data layers derive timestamps and day keys from `nowIso()` /
 * `toDateKey()` in `lib/time.ts`. Importing this module registers a
 * `vi.mock('@/lib/time')` that routes those two functions through the
 * controllable `./clock` singleton; every other `lib/time` export stays real.
 *
 * Each seeder:
 *   1. calls `vi.resetModules()` once — clearing `core/db/client.ts`'s cached
 *      database AND re-evaluating `./clock` to a fresh state;
 *   2. opens a fresh, fully-migrated database through `getDatabase()`;
 *   3. imports the data layers fresh (so they bind to the new database and
 *      the mocked `lib/time`);
 *   4. seeds by advancing the clock day by day and calling real functions.
 *
 * Because the seeders (through `./clock`) and the `lib/time` mock factory
 * resolve the same clock module, the injected time is visible to every
 * data-layer call. `vi.resetModules()` is intentionally NOT called between
 * steps, or the mock factory would pick up a different clock instance.
 *
 * ## Contract for downstream tests
 *
 * - `seedSmall()` / `seedTypical()` / `seedHeavy()` / `seedMature()` return
 *   the seeded, current-schema `TestDatabase`. Rows written before the
 *   seed's "today" (2026-07-01) keep their backdated timestamps.
 * - Tests must import this module (or `./fixtures` index) BEFORE running a
 *   seeder so the clock mock is registered. `seedX()` is self-contained:
 *   it resets modules and re-imports everything, so a preceding static import
 *   of a data layer does not leak in.
 * - After seeding, `clock.now()` is the seed's last day (2026-07-01 local
 *   noon) unless a later seeder advanced it.
 * - Seeds deliberately go through the real data layers, so synced writes
 *   enqueue into the real sync engine and land in the durable `sync_outbox` table,
 *   and linked-action habits/todos emit source events — both are part of a
 *   realistic corpus, not noise to be cheated around in tests.
 */

/** The calendar day every seeder ends on ("today"). */
const BASE_YEAR = 2026;
const BASE_MONTH = 7; // July (1-based)
const BASE_DAY = 1;

type BuildSeedConfig = {
  /** Days of history to fill, ending on the base day. */
  days: number;
  habitCount: number;
  /** Fraction of days each habit is completed (0–1). */
  habitCoverage: number;
  /** Calorie entries per day. */
  calPerDay: number;
  todoCount: number;
  /** Fraction of todos toggled completed. */
  completedShare: number;
  /** Create one workout log every N days (1 = daily). */
  workoutLogEveryNDays: number;
  /** Create one pomodoro session every N days (1 = daily). */
  pomodoroEveryNDays: number;
  routineCount: number;
  /** Mature-corpus extras below (0/false for SMALL/TYPICAL/HEAVY). */
  /** Fraction of habits archived at the end. */
  archiveShare: number;
  /** Fraction of habits paused at the end. */
  pauseShare: number;
  /** Daily-recurrence todo series roots to create. */
  recurringTodoCount: number;
  /** Distinct saved-meal catalog entries to upsert. */
  savedMealCount: number;
  /** Planning projects to create (mixed statuses). */
  projectCount: number;
  /** Goals per project. */
  goalsPerProject: number;
  /** Interrupted sessions, legacy metadata, UTC keys, extra tombstones. */
  edgeStates: boolean;
};

const SMALL_CONFIG: BuildSeedConfig = {
  days: 1,
  habitCount: 2,
  habitCoverage: 1,
  calPerDay: 4,
  todoCount: 5,
  completedShare: 0.2,
  workoutLogEveryNDays: 1,
  pomodoroEveryNDays: 1,
  routineCount: 1,
  archiveShare: 0,
  pauseShare: 0,
  recurringTodoCount: 0,
  savedMealCount: 0,
  projectCount: 0,
  goalsPerProject: 0,
  edgeStates: false,
};

const TYPICAL_CONFIG: BuildSeedConfig = {
  days: 30,
  habitCount: 5,
  habitCoverage: 0.7,
  calPerDay: 3,
  todoCount: 14,
  completedShare: 0.35,
  workoutLogEveryNDays: 4,
  pomodoroEveryNDays: 2,
  routineCount: 2,
  archiveShare: 0,
  pauseShare: 0,
  recurringTodoCount: 0,
  savedMealCount: 0,
  projectCount: 0,
  goalsPerProject: 0,
  edgeStates: false,
};

const HEAVY_CONFIG: BuildSeedConfig = {
  days: 90,
  habitCount: 15,
  habitCoverage: 1,
  calPerDay: 4,
  todoCount: 200,
  completedShare: 0.4,
  workoutLogEveryNDays: 1,
  pomodoroEveryNDays: 1,
  routineCount: 5,
  archiveShare: 0,
  pauseShare: 0,
  recurringTodoCount: 0,
  savedMealCount: 0,
  projectCount: 0,
  goalsPerProject: 0,
  edgeStates: false,
};

const MATURE_CONFIG: BuildSeedConfig = {
  days: 210,
  habitCount: 20,
  habitCoverage: 0.75,
  calPerDay: 3,
  todoCount: 600,
  completedShare: 0.7,
  workoutLogEveryNDays: 3,
  pomodoroEveryNDays: 2,
  routineCount: 8,
  archiveShare: 0.15,
  pauseShare: 0.1,
  recurringTodoCount: 12,
  savedMealCount: 10,
  projectCount: 4,
  goalsPerProject: 3,
  edgeStates: true,
};

// Registers the clock mock so data layers (imported below at seed time) read
// the controllable time instead of the wall clock.
vi.mock('@/lib/time', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/time')>();
  const { clock } = await import('./clock');
  return {
    ...real,
    nowIso: () => clock.nowIso(),
    toDateKey: (date?: Date) => clock.toDateKey(date),
  };
});

/** Local noon for `dayOffset` days before the base day (0 = base day). */
function seedDayDate(dayOffset: number): Date {
  return new Date(BASE_YEAR, BASE_MONTH - 1, BASE_DAY - dayOffset, 12, 0, 0, 0);
}

/** Opens a fresh version-11 database after a single module reset, keeping the clock shared. */
async function openFreshDatabase(): Promise<TestDatabase> {
  vi.resetModules();
  const { getDatabase } = await import('@/core/db/client');
  return (await getDatabase()) as unknown as TestDatabase;
}

/**
 * Builds the corpus for a config by calling real data-layer functions.
 * The returned database is fully seeded; the clock ends on the base day.
 */
async function buildSeed(config: BuildSeedConfig): Promise<TestDatabase> {
  // Rebind the time mock on EVERY seed. Mock registrations survive
  // vi.resetModules(), so without this the static factory above can keep
  // serving a previous seed's clock instance to freshly imported data
  // layers — backfilled created_at/updated_at then silently freeze on the
  // prior run's base day (invisible to count/key assertions, fatal to
  // byte-reproducibility). The factory resolves './clock' lazily on each
  // invocation, so whatever generation the data layers land in, they
  // share the clock this seed drives.
  vi.resetModules();
  vi.doMock('@/lib/time', async (importOriginal) => {
    const real = await importOriginal<typeof import('@/lib/time')>();
    const { clock: seedClock } = await import('./clock');
    return {
      ...real,
      nowIso: () => seedClock.nowIso(),
      toDateKey: (date?: Date) => seedClock.toDateKey(date),
    };
  });
  const db = await openFreshDatabase();

  const { clock } = await import('./clock');
  const todosData = await import('@/features/todos/todos.data');
  const habitsData = await import('@/features/habits/habits.data');
  const caloriesData = await import('@/features/calories/calories.data');
  const workoutData = await import('@/features/workout/workout.data');
  const pomodoroData = await import('@/features/pomodoro/pomodoro.data');
  const projectsData = await import('@/features/projects/projects.data');
  const goalsData = await import('@/features/goals/goals.data');

  clock.set(seedDayDate(0));

  // --- Habits (created once; completions are backfilled below) ---
  const habitNames = [
    'Drink water',
    'Morning stretch',
    'Read 20 minutes',
    'Walk outside',
    'Plan tomorrow',
    'Meditate',
    'Lift weights',
    'Journal',
    'No sugar',
    'Vitamin D',
    'Floss',
    'Call a friend',
    'Tidy desk',
    'Run 3k',
    'Evening tea',
    'Stretch hips',
    'Read news',
    'Practice guitar',
    'Water garden',
    'Review flashcards',
  ];
  const habitIds: string[] = [];
  for (let i = 0; i < config.habitCount; i++) {
    const target = (i % 3) + 1;
    const id = await habitsData.addHabit(habitNames[i % habitNames.length], target);
    habitIds.push(id);
  }
  // The corpus simulates habits that existed across the whole backfill
  // window, so backdate each seeded habit to one day before the earliest
  // history day. The lifecycle write gate (migration 20 semantics) would
  // otherwise reject the historical completions below as pre-creation.
  const { createHabitRule } = await import('@/features/habits/habits.domain');
  clock.set(seedDayDate(config.days));
  const historyStartIso = clock.nowIso();
  const historyStartKey = clock.toDateKey();
  for (let i = 0; i < habitIds.length; i++) {
    const target = (i % 3) + 1;
    await db.runAsync('UPDATE habits SET created_at = ?, rule_history = ? WHERE id = ?', [
      historyStartIso,
      JSON.stringify([createHabitRule(historyStartKey, [1, 2, 3, 4, 5, 6, 7], target)]),
      habitIds[i],
    ]);
  }
  clock.set(seedDayDate(0));

  // --- Workout routines (exercises + sets) ---
  const exerciseNames = [
    'Push-ups',
    'Squats',
    'Plank',
    'Lunges',
    'Rows',
    'Shoulder press',
    'Deadlift',
    'Bicep curls',
  ];
  const routineIds: string[] = [];
  for (let r = 0; r < config.routineCount; r++) {
    await workoutData.addRoutine(`Routine ${r + 1}`, 'Seeded fixture routine');
    const routines = await workoutData.listRoutines();
    const routineId = routines[0].id;
    routineIds.push(routineId);
    for (let e = 0; e < 3; e++) {
      const exerciseId = await workoutData.addExercise({
        routineId,
        name: exerciseNames[(r * 3 + e) % exerciseNames.length],
      });
      for (let s = 1; s <= 3; s++) {
        await workoutData.addSet({ exerciseId, setNumber: s, activeSeconds: 40, restSeconds: 20 });
      }
    }
  }

  // --- Todos (mix of pending / completed / one deleted) ---
  const todoTitles = [
    'Buy groceries',
    'Pay electricity bill',
    'Draft project plan',
    'Reply to Sarah',
    'Book dentist',
    'Update resume',
    'Clean the kitchen',
    'Water the plants',
    'Ship the PR',
    'Plan weekend trip',
    'Renew gym membership',
    'Fix leaky tap',
    'Order birthday gift',
    'Back up photos',
    'Write meeting notes',
    'Prep lunches',
    'Call the bank',
    'Sort old clothes',
    'Sharpen tools',
    'Review budget',
  ];
  for (let t = 0; t < config.todoCount; t++) {
    const title = todoTitles[t % todoTitles.length];
    const priority = t % 5 === 0 ? 'urgent' : t % 3 === 0 ? 'low' : 'normal';
    const dueDate = t % 4 === 0 ? clock.toDateKey(seedDayDate(t % 14)) : undefined;
    await todosData.addTodo({ title, priority, dueDate });
  }
  const pendingTodos = await todosData.listPendingTodos();
  const completedCount = Math.floor(pendingTodos.length * config.completedShare);
  for (const todo of pendingTodos.slice(0, completedCount)) {
    await todosData.toggleTodo(todo);
  }
  // One soft-deleted todo so delete paths see a tombstone in the corpus.
  if (pendingTodos.length > 0) {
    await todosData.removeTodo(pendingTodos[pendingTodos.length - 1].id);
  }

  // --- Recurring series (daily roots; instances spawn on completion) ---
  for (let r = 0; r < (config.recurringTodoCount ?? 0); r++) {
    await todosData.addTodo({
      title: `Daily review ${r + 1}`,
      priority: 'normal',
      recurrence: 'daily',
    });
  }

  // --- Day-by-day history: habits, calories, workouts, pomodoros ---
  for (let offset = config.days - 1; offset >= 0; offset--) {
    clock.set(seedDayDate(offset));
    const dateKey = clock.toDateKey();

    // Habit completions (backfill each habit on its coverage days). The
    // coverage pattern is deterministic — derived from offsets, not
    // Math.random — so the corpus is reproducible across runs.
    for (let h = 0; h < habitIds.length; h++) {
      const habitId = habitIds[h];
      const hit = (offset * 5 + h * 3) % 10;
      if (config.habitCoverage >= 1 || hit < config.habitCoverage * 10) {
        await habitsData.incrementHabit(habitId, dateKey);
      }
    }

    // Calories: a realistic day of meals through the real add path.
    const meals: {
      name: string;
      kcal: number;
      p: number;
      c: number;
      f: number;
      type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    }[] = [
      { name: 'Oatmeal with berries', kcal: 320, p: 9, c: 55, f: 6, type: 'breakfast' },
      { name: 'Chicken salad', kcal: 480, p: 38, c: 18, f: 26, type: 'lunch' },
      { name: 'Salmon with rice', kcal: 540, p: 36, c: 45, f: 22, type: 'dinner' },
      { name: 'Greek yogurt', kcal: 140, p: 14, c: 9, f: 5, type: 'snack' },
      { name: 'Banana', kcal: 105, p: 1, c: 27, f: 0, type: 'snack' },
      { name: 'Scrambled eggs', kcal: 280, p: 18, c: 4, f: 20, type: 'breakfast' },
    ];
    for (let c = 0; c < config.calPerDay; c++) {
      const meal = meals[(offset * config.calPerDay + c) % meals.length];
      await caloriesData.addCalorieEntry({
        foodName: meal.name,
        calories: meal.kcal,
        protein: meal.p,
        carbs: meal.c,
        fats: meal.f,
        mealType: meal.type,
        consumedOn: dateKey,
      });
    }

    // Workout log via the real completion path (completed_at = clock).
    if (config.workoutLogEveryNDays > 0 && offset % config.workoutLogEveryNDays === 0) {
      const routineId = routineIds[offset % routineIds.length];
      await workoutData.completeRoutine(routineId, `Seeded session ${offset}`);
    }

    // Pomodoro session via the real log path.
    if (config.pomodoroEveryNDays > 0 && offset % config.pomodoroEveryNDays === 0) {
      const started = new Date(clock.now().getTime() - 25 * 60 * 1000);
      await pomodoroData.logPomodoroSession(
        started.toISOString(),
        clock.nowIso(),
        25 * 60,
        'focus',
      );
    }
  }

  // --- Habit lifecycle depth (mature users pause/archive old habits) ---
  const archiveCount = Math.floor(habitIds.length * (config.archiveShare ?? 0));
  const pauseCount = Math.floor(habitIds.length * (config.pauseShare ?? 0));
  for (let i = 0; i < habitIds.length && i < archiveCount + pauseCount; i++) {
    if (i < archiveCount) await habitsData.archiveHabit(habitIds[i]);
    else await habitsData.pauseHabit(habitIds[i]);
  }

  // --- Saved-meal catalog (distinct names: upsert dedupes NOCASE) ---
  const savedMealCatalog = [
    { foodName: 'Overnight oats', calories: 350, protein: 12, carbs: 58, fats: 8, fiber: 9 },
    { foodName: 'Grilled chicken bowl', calories: 520, protein: 42, carbs: 40, fats: 18, fiber: 6 },
    { foodName: 'Veggie stir fry', calories: 380, protein: 14, carbs: 52, fats: 12, fiber: 11 },
    { foodName: 'Protein smoothie', calories: 290, protein: 28, carbs: 32, fats: 6, fiber: 5 },
    { foodName: 'Tuna sandwich', calories: 410, protein: 30, carbs: 38, fats: 14, fiber: 4 },
    { foodName: 'Lentil soup', calories: 330, protein: 18, carbs: 48, fats: 7, fiber: 13 },
    { foodName: 'Beef tacos', calories: 560, protein: 32, carbs: 44, fats: 26, fiber: 8 },
    { foodName: 'Quinoa salad', calories: 360, protein: 13, carbs: 50, fats: 12, fiber: 10 },
    { foodName: 'Pancake stack', calories: 480, protein: 11, carbs: 82, fats: 12, fiber: 3 },
    { foodName: 'Salmon poke', calories: 540, protein: 36, carbs: 46, fats: 20, fiber: 7 },
  ];
  for (let s = 0; s < (config.savedMealCount ?? 0); s++) {
    const meal = savedMealCatalog[s % savedMealCatalog.length];
    await caloriesData.upsertSavedMeal({ ...meal, mealType: 'dinner' });
  }

  // --- Planning depth (projects with mixed statuses + goals) ---
  const projectNames = [
    'Home renovation',
    'Learn Spanish',
    'Side business',
    'Health overhaul',
    'Garden project',
  ];
  for (let p = 0; p < (config.projectCount ?? 0); p++) {
    const projectStatus = p % 4 === 3 ? 'completed' : p % 4 === 2 ? 'archived' : 'active';
    const projectId = await projectsData.addProject({
      name: projectNames[p % projectNames.length],
      status: projectStatus,
    });
    for (let g = 0; g < (config.goalsPerProject ?? 0); g++) {
      await goalsData.addGoal({
        projectId,
        title: `Goal ${p + 1}.${g + 1}`,
        horizon: 'month',
        status: g === 0 && p % 2 === 0 ? 'completed' : 'active',
        progressPercent: (p * 17 + g * 23) % 100,
      });
    }
  }

  // --- Edge states: interrupted work, legacy metadata, UTC keys, tombstones ---
  if (config.edgeStates) {
    const nowMs = clock.now().getTime();
    // Interrupted Focus: live intent whose deadline passed with no logged row.
    await pomodoroData.savePomodoroActiveTimer({
      startedAtIso: new Date(nowMs - 25 * 60 * 1000).toISOString(),
      mode: 'focus',
      totalSeconds: 25 * 60,
      completedFocus: 0,
      notificationId: null,
    });
    // Pending focus log awaiting retry.
    await pomodoroData.enqueuePendingPomodoroLog({
      startedAtIso: new Date(nowMs - 90 * 60 * 1000).toISOString(),
      endedAtIso: new Date(nowMs - 65 * 60 * 1000).toISOString(),
      durationSeconds: 25 * 60,
      type: 'focus',
    });
    // Interrupted Workout: draft with partial progress, never logged.
    await workoutData.saveWorkoutSessionDraft({
      routineId: routineIds[0],
      startedAtIso: new Date(nowMs - 40 * 60 * 1000).toISOString(),
      phaseIndex: 1,
      elapsedAdjustSeconds: 120,
      dispositions: { 0: 'completed' },
      enteredSets: { 0: { weight: '60', reps: '8' } },
      remainingSeconds: 30,
    });
    // Pre-cutover backup metadata as left by an old client. Fresh
    // databases have no marker until backfill runs, so INSERT (an old
    // client that ran backfill carries the era value forward).
    await db.runAsync(`INSERT INTO app_meta (key, value) VALUES ('backup.scope_version', '6')`);
    // Pre-cutover UTC date key (migration 5 deliberately never backfills).
    await db.runAsync(
      `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        createId('hcmp'),
        habitIds[0],
        '2025-06-15T00:00:00.000Z',
        1,
        '2025-06-15T00:00:00.000Z',
        '2025-06-15T00:00:00.000Z',
      ],
    );
    // Extra tombstones across the tail of the pending list.
    if (pendingTodos.length > 3) {
      await todosData.removeTodo(pendingTodos[pendingTodos.length - 2].id);
      await todosData.removeTodo(pendingTodos[pendingTodos.length - 3].id);
    }
  }

  return db;
}

/** One day in the life: 5 todos, 2 habits, 4 meals, 1 routine + log, 2 pomodoros. */
export function seedSmall(): Promise<TestDatabase> {
  return buildSeed(SMALL_CONFIG);
}

/** Thirty days of consistent use: 14 todos, 5 habits, ~90 meals, 2 routines, ~8 logs, ~15 pomodoros. */
export function seedTypical(): Promise<TestDatabase> {
  return buildSeed(TYPICAL_CONFIG);
}

/** Three months at volume (J8 scale): 200 todos, 15 habits daily, ~360 meals, 5 routines, ~90 logs, ~90 pomodoros. */
export function seedHeavy(): Promise<TestDatabase> {
  return buildSeed(HEAVY_CONFIG);
}

/**
 * Mature 7-month user: 600 todos (+12 recurring series), 20 habits with
 * pause/archive lifecycle, ~630 meals + saved-meal catalog, 8 routines +
 * ~70 logs, ~105 pomodoros, projects/goals planning, and the edge-state
 * stage (interrupted Focus/Workout, legacy backup metadata, pre-cutover
 * UTC date keys, extra tombstones). See `corpus.test.ts` for the manifest.
 */
export function seedMature(): Promise<TestDatabase> {
  return buildSeed(MATURE_CONFIG);
}
