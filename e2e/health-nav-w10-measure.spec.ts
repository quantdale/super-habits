import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { test, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { resetAll } from './helpers/reset';
import { ensureAppContext, returnToApp } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';

/**
 * D3 navigation validation gate — measurement instrument (Frontend V3 W10).
 *
 * Opt-in: run with D3_MEASURE=1 on the tree being measured. It records, from
 * an equivalent starting state (Overview active, empty device, 390×844):
 *
 *   - tap depth for "start a workout", "log a meal", "view remaining calories"
 *   - per-flow completion (did the flow reach its end state?)
 *   - section-switch behavior for every section (taps, success) and whether an
 *     active Focus session survives a switch away and back (task switch)
 *   - accessibility geometry of the phone bar at 360/390/412 (target size,
 *     label font size, truncated labels)
 *
 * It writes the record as JSON so the five-destination and six-tab builds can
 * be compared one-to-one. The instrument is model-aware: it detects whether
 * the bar exposes direct Workout/Calories destinations (six-tab) or a Health
 * parent (five-destination) and walks the matching path.
 *
 * The assertions here are existence/completion checks only — the *decision*
 * lives in the W10 ExecPlan and the shipped-model contract lives in
 * `e2e/health-nav-w10-contract.spec.ts`.
 */
const OUT_DIR = process.env.D3_OUTPUT_DIR ?? 'docs/ui-ux/v3-audit/w10';
mkdirSync(OUT_DIR, { recursive: true });
test.skip(process.env.D3_MEASURE !== '1', 'Set D3_MEASURE=1 to run the D3 measurement instrument');
test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

type FlowRecord = {
  taps: number;
  completed: boolean;
  detail: string;
};

type Measurement = {
  model: 'five-destination' | 'six-tab';
  commit: string | null;
  capturedAt: string;
  viewport: { width: number; height: number };
  barLabels: string[];
  flows: {
    startWorkout: FlowRecord;
    logMeal: FlowRecord;
    viewRemainingCalories: FlowRecord;
  };
  sectionSwitch: {
    perSection: { section: string; taps: number; success: boolean }[];
    activeSessionSurvivesSwitch: boolean;
  };
  accessibility: {
    width: number;
    minTargetWidth: number;
    minTargetHeight: number;
    minLabelFontPx: number;
    truncatedLabels: string[];
    destinationCount: number;
  }[];
};

const pad = (n: number) => String(n).padStart(2, '0');
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shortCommit(): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/** Accessible names of the phone bar's destinations, in render order. */
async function barLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const rail = document.querySelector('[aria-label="Section tabs"]');
    if (!rail) return [];
    return Array.from(rail.querySelectorAll('[role="button"]')).map(
      (el) => el.getAttribute('aria-label') ?? '',
    );
  });
}

/** Seed one startable routine so "start a workout" is measurable. */
async function seedRoutine(page: Page) {
  await resetAll(page);
  await ensureAppContext(page);
  const now = new Date().toISOString();
  await seedSql(
    page,
    `INSERT INTO workout_routines (id,name,description,created_at,updated_at,deleted_at)
       VALUES ('wrk_w10_measure','W10 Measurement Routine','D3 gate', '${now}','${now}',null);
     INSERT INTO routine_exercises (id,routine_id,name,sort_order,created_at,updated_at,deleted_at)
       VALUES ('ex_w10_measure','wrk_w10_measure','Bench Press',0,'${now}','${now}',null);
     INSERT INTO routine_exercise_sets (id,exercise_id,set_number,active_seconds,rest_seconds,created_at,updated_at,deleted_at)
       VALUES ('eset_w10_measure','ex_w10_measure',1,40,20,'${now}','${now}',null);`,
  );
  await returnToApp(page);
  await goToTab(page, 'overview');
}

async function startFromOverview(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.setItem('superhabits.calories.viewMode', 'form'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await goToTab(page, 'overview');
  await page.waitForTimeout(600);
}

/** Tap the bar destination(s) that open `section`; returns taps spent. */
async function openSectionFromBar(page: Page, section: 'Workout' | 'Calories'): Promise<number> {
  const rail = page.getByRole('tablist', { name: 'Section tabs' });
  const direct = rail.getByRole('button', { name: section, exact: true });
  if (await direct.count()) {
    await direct.click();
    return 1;
  }
  await rail.getByRole('button', { name: 'Health', exact: true }).click();
  await page.getByRole('button', { name: `Open ${section}`, exact: true }).click();
  return 2;
}

test('D3 measurement: five-destination vs six-tab', async ({ page }) => {
  const record: Measurement = {
    model: 'five-destination',
    commit: shortCommit(),
    capturedAt: new Date().toISOString(),
    viewport: { width: 390, height: 844 },
    barLabels: [],
    flows: {
      startWorkout: { taps: 0, completed: false, detail: '' },
      logMeal: { taps: 0, completed: false, detail: '' },
      viewRemainingCalories: { taps: 0, completed: false, detail: '' },
    },
    sectionSwitch: { perSection: [], activeSessionSurvivesSwitch: false },
    accessibility: [],
  };

  await seedRoutine(page);
  await startFromOverview(page);
  record.barLabels = await barLabels(page);
  record.model = record.barLabels.includes('Workout') ? 'six-tab' : 'five-destination';

  // --- Flow A: start a workout -------------------------------------------
  {
    let taps = await openSectionFromBar(page, 'Workout');
    await page.waitForTimeout(900);
    const start = page
      .getByRole('button', { name: 'Start W10 Measurement Routine', exact: true })
      .first();
    if (await start.isVisible().catch(() => false)) {
      await start.click();
      taps += 1;
      await page.waitForTimeout(900);
    }
    const setOne = page.getByText('Set 1 of 1').first();
    record.flows.startWorkout = {
      taps,
      completed: await setOne.isVisible().catch(() => false),
      detail: (await setOne.isVisible().catch(() => false))
        ? 'active session reached'
        : 'no session',
    };
  }

  // --- Flow B: log a meal -------------------------------------------------
  {
    await startFromOverview(page);
    let taps = await openSectionFromBar(page, 'Calories');
    await page.waitForTimeout(900);
    const quickAdd = page.getByRole('button', { name: 'Quick add 200 kilocalories' }).first();
    if (await quickAdd.isVisible().catch(() => false)) {
      await quickAdd.click();
      taps += 1;
      await page.waitForTimeout(1200);
    }
    // The remaining-kcal indicator must reflect the write (empty day + 200).
    const title = page.getByText(/1,800 kcal left|1800 kcal left/).first();
    const completed = await title.isVisible().catch(() => false);
    record.flows.logMeal = {
      taps,
      completed,
      detail: completed ? 'quick-add 200 logged from Overview' : 'quick-add did not land',
    };
  }

  // --- Flow C: view remaining calories ------------------------------------
  {
    await startFromOverview(page);
    const rail = page.getByRole('tablist', { name: 'Section tabs' });
    let taps = 1;
    let detail = '';
    let completed = false;
    if (record.model === 'five-destination') {
      await rail.getByRole('button', { name: 'Health', exact: true }).click();
      await page.waitForTimeout(900);
      const healthRemaining = page.getByText(/\d+\s*left/).first();
      completed = await healthRemaining.isVisible().catch(() => false);
      detail = 'remaining kcal read on the Health parent surface';
    } else {
      await rail.getByRole('button', { name: 'Calories', exact: true }).click();
      await page.waitForTimeout(900);
      // The remaining-kcal hero (the exact number varies with what the log-meal
      // flow already wrote, so the probe matches the indicator, not a value).
      const hero = page.getByText(/[\d,]+ kcal left/).first();
      completed = await hero.isVisible().catch(() => false);
      detail = 'remaining kcal read on the Calories hero';
    }
    record.flows.viewRemainingCalories = { taps, completed, detail };
  }

  // --- Section switch behavior -------------------------------------------
  {
    await startFromOverview(page);
    const sections: Record<string, string> = {
      overview: 'Today',
      todos: 'To Do',
      habits: 'Habits',
      pomodoro: 'Focus',
      workout: 'Workout',
      calories: 'Calories',
    };
    for (const [section, label] of Object.entries(sections)) {
      if (section === 'overview') continue;
      let taps = 0;
      let success = false;
      try {
        const rail = page.getByRole('tablist', { name: 'Section tabs' });
        const direct = rail.getByRole('button', { name: label, exact: true });
        if (await direct.count()) {
          await direct.click();
          taps = 1;
        } else {
          await rail.getByRole('button', { name: 'Health', exact: true }).click();
          await page.getByRole('button', { name: `Open ${label}`, exact: true }).click();
          taps = 2;
        }
        await page.waitForTimeout(700);
        const identity =
          section === 'calories'
            ? page.getByText(/kcal left|kcal over/).first()
            : page.getByText(label, { exact: true }).first();
        success = await identity.isVisible().catch(() => false);
      } catch {
        success = false;
      }
      record.sectionSwitch.perSection.push({ section, taps, success });
      await goToTab(page, 'overview');
      await page.waitForTimeout(300);
    }

    // Task-switch: a running Focus session must survive a switch away/back.
    // Uses in-app rail switches (no page reload) — the single-page shell keeps
    // sections mounted, so a reload would test something else entirely.
    try {
      await goToTab(page, 'pomodoro');
      await page.getByRole('button', { name: 'Start focus', exact: true }).click();
      await page
        .getByRole('button', { name: 'Pause', exact: true })
        .waitFor({ state: 'visible', timeout: 15_000 });
      const rail = page.getByRole('tablist', { name: 'Section tabs' });
      await rail.getByRole('button', { name: 'To Do', exact: true }).click();
      await page.waitForTimeout(600);
      await rail.getByRole('button', { name: 'Focus', exact: true }).click();
      await page.waitForTimeout(900);
      const pause = page.getByRole('button', { name: 'Pause', exact: true }).first();
      record.sectionSwitch.activeSessionSurvivesSwitch = await pause.isVisible().catch(() => false);
    } catch {
      record.sectionSwitch.activeSessionSurvivesSwitch = false;
    }
  }

  // --- Accessibility geometry of the phone bar ---------------------------
  for (const width of [360, 390, 412]) {
    await page.setViewportSize({ width, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    // The shell mounts asynchronously; wait for the rail before measuring.
    await page
      .getByRole('tablist', { name: 'Section tabs' })
      .waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForTimeout(900);
    const geometry = await page.evaluate(() => {
      const rail = document.querySelector('[aria-label="Section tabs"]');
      if (!rail) return null;
      const buttons = Array.from(rail.querySelectorAll('[role="button"]'));
      let minTargetWidth = Number.POSITIVE_INFINITY;
      let minTargetHeight = Number.POSITIVE_INFINITY;
      let minLabelFontPx = Number.POSITIVE_INFINITY;
      const truncatedLabels: string[] = [];
      for (const button of buttons) {
        const rect = button.getBoundingClientRect();
        minTargetWidth = Math.min(minTargetWidth, rect.width);
        minTargetHeight = Math.min(minTargetHeight, rect.height);
        const label = (button.getAttribute('aria-label') ?? '').trim();
        const textNodes = Array.from(button.querySelectorAll('div')).filter(
          (el) => (el.textContent ?? '').trim() === label,
        ) as HTMLElement[];
        for (const node of textNodes) {
          minLabelFontPx = Math.min(
            minLabelFontPx,
            Number.parseFloat(getComputedStyle(node).fontSize),
          );
          if (node.scrollWidth > node.clientWidth + 1) truncatedLabels.push(label);
        }
      }
      return {
        minTargetWidth: Number.isFinite(minTargetWidth) ? minTargetWidth : 0,
        minTargetHeight: Number.isFinite(minTargetHeight) ? minTargetHeight : 0,
        minLabelFontPx: Number.isFinite(minLabelFontPx) ? minLabelFontPx : 0,
        truncatedLabels,
        destinationCount: buttons.length,
      };
    });
    if (geometry) record.accessibility.push({ width, ...geometry });
  }

  const outFile = `${OUT_DIR}/d3-${record.model}.json`;
  writeFileSync(outFile, `${JSON.stringify(record, null, 2)}\n`);
  console.error(`[d3-measure] model=${record.model} written to ${outFile}`);
  console.error(
    `[d3-measure] flows: startWorkout=${record.flows.startWorkout.taps} taps/${
      record.flows.startWorkout.completed ? 'done' : 'INCOMPLETE'
    }, logMeal=${record.flows.logMeal.taps} taps/${
      record.flows.logMeal.completed ? 'done' : 'INCOMPLETE'
    }, viewRemaining=${record.flows.viewRemainingCalories.taps} taps/${
      record.flows.viewRemainingCalories.completed ? 'done' : 'INCOMPLETE'
    }`,
  );
  void todayKey;
});
