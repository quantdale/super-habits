import { expect, type Page } from '@playwright/test';
import { resetAll } from './reset';
import { runSql, returnToApp } from './dbHarness';
import { installClock } from './clock';
import { ACTIVE_SECTION_SELECTOR } from './oracles';

/** Deterministic, historical inserts into the real OPFS DB, never the outbox. */
export const W7_TODAY = '2026-08-10'; // Monday
export const W7_NAMES = {
  read: 'Read a chapter',
  move: 'Stretch for five minutes',
  water: 'Drink water',
  pages: 'Read 99 pages',
  rest: 'Weekend walk',
  masked: 'Back from a break',
  new: 'Started today',
  paused: 'Evening journal',
  archived: 'Old running plan',
  long: 'Prepare tomorrow’s clothes and write down one kind thing that happened today — even on a busy evening',
} as const;
export type W7Scene =
  'typical' | 'single' | 'quantitative' | 'complete' | 'rest' | 'lifecycle' | 'long' | 'heavy';

type SeedHabit = {
  key: string;
  name: string;
  target?: number;
  category?: string;
  weekdays?: number[];
  status?: string;
  lifecycle?: string;
  created?: string;
  todayCount?: number;
  reminder?: string;
  history?: { date: string; count: number }[];
};
const DAILY = [1, 2, 3, 4, 5, 6, 7];
const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;

export async function openW7Habits(page: Page): Promise<void> {
  await page
    .getByRole('tablist', { name: 'Section tabs' })
    .getByRole('button', { name: 'Habits', exact: true })
    .click();
  // Opacity-zero mounted sections are still "visible" to Playwright. Wait
  // for the actual section crossfade to finish, not merely for mounted copy.
  await expect(
    page.locator(ACTIVE_SECTION_SELECTOR).getByText('Daily check-in', { exact: true }),
  ).toBeVisible();
}

export async function seedW7Habits(page: Page, scene: W7Scene = 'typical'): Promise<void> {
  await installClock(page, '2026-08-10T12:00:00');
  await resetAll(page);
  await returnToApp(page); // Runtime migrations, not a hand-maintained schema.
  let rows: SeedHabit[] = [
    {
      key: 'read',
      name: W7_NAMES.read,
      category: 'morning',
      todayCount: 1,
      history: [4, 5, 6, 7, 8, 9].map((day) => ({ date: `2026-08-0${day}`, count: 1 })),
    },
    { key: 'move', name: W7_NAMES.move, category: 'morning' },
    {
      key: 'water',
      name: W7_NAMES.water,
      target: 8,
      category: 'afternoon',
      todayCount: 2,
      reminder: '18:00',
      history: [
        { date: '2026-08-07', count: 1 },
        { date: '2026-08-09', count: 5 },
      ],
    },
    { key: 'pages', name: W7_NAMES.pages, target: 99, category: 'evening' },
    { key: 'rest', name: W7_NAMES.rest, weekdays: [6, 7] },
  ];
  if (scene === 'single') rows = [{ key: 'move', name: W7_NAMES.move }];
  if (scene === 'quantitative') rows = [{ key: 'water', name: W7_NAMES.water, target: 8 }];
  if (scene === 'rest') rows = [{ key: 'rest', name: W7_NAMES.rest, weekdays: [6, 7] }];
  if (scene === 'complete')
    rows = rows
      .filter((row) => row.key !== 'rest')
      .map((row) => ({ ...row, todayCount: row.target ?? 1 }));
  if (scene === 'lifecycle')
    rows.push(
      {
        key: 'paused',
        name: W7_NAMES.paused,
        status: 'paused',
        lifecycle: JSON.stringify([
          { status: 'paused', from_date_key: '2026-08-08', to_date_key: null },
        ]),
      },
      {
        key: 'archived',
        name: W7_NAMES.archived,
        status: 'archived',
        lifecycle: JSON.stringify([
          { status: 'archived', from_date_key: '2026-08-08', to_date_key: null },
        ]),
      },
      {
        key: 'masked',
        name: W7_NAMES.masked,
        lifecycle: JSON.stringify([
          { status: 'paused', from_date_key: '2026-08-06', to_date_key: '2026-08-10' },
        ]),
      },
      { key: 'new', name: W7_NAMES.new, created: `${W7_TODAY}T01:00:00Z` },
    );
  if (scene === 'long')
    rows = [{ key: 'long', name: W7_NAMES.long, category: 'evening', reminder: '18:00' }, ...rows];
  if (scene === 'heavy')
    rows = Array.from({ length: 120 }, (_, index) => ({
      key: `heavy_${index}`,
      name: `Daily practice ${String(index + 1).padStart(3, '0')}`,
      target: index % 3 === 0 ? 8 : 1,
      created: '2026-05-01T01:00:00Z',
      history: Array.from({ length: 90 }, (_, day) => {
        const date = new Date('2026-08-10T12:00:00Z');
        date.setUTCDate(date.getUTCDate() - day - 1);
        return { date: date.toISOString().slice(0, 10), count: index % 3 === 0 ? 8 : 1 };
      }),
    }));

  const statements: string[] = [];
  for (const row of rows) {
    const habitId = `habit_w7_${row.key}`;
    const target = row.target ?? 1;
    const created = row.created ?? '2026-08-01T01:00:00Z';
    const rule = [
      {
        effective_from_date: created.slice(0, 10),
        weekdays: row.weekdays ?? DAILY,
        target_per_day: target,
      },
    ];
    if (row.key === 'water' && scene !== 'quantitative') {
      rule[0].target_per_day = 1;
      rule.push({ effective_from_date: '2026-08-08', weekdays: DAILY, target_per_day: 8 });
    }
    statements.push(
      `INSERT INTO habits (id,name,target_per_day,category,icon,color,created_at,updated_at,status,rule_history,lifecycle_history,reminder_time) VALUES (${quote(habitId)},${quote(row.name)},${target},${quote(row.category ?? 'anytime')},'check-circle','#ef4444',${quote(created)},${quote(created)},${quote(row.status ?? 'active')},${quote(JSON.stringify(rule))},${row.lifecycle ? quote(row.lifecycle) : 'NULL'},${row.reminder ? quote(row.reminder) : 'NULL'});`,
    );
    const history = [...(row.history ?? [])];
    if (row.todayCount) history.push({ date: W7_TODAY, count: row.todayCount });
    for (const day of history)
      statements.push(
        `INSERT INTO habit_completions (id,habit_id,date_key,count,created_at,updated_at) VALUES (${quote(`hcmp_w7_${row.key}_${day.date}`)},${quote(habitId)},${quote(day.date)},${day.count},${quote(created)},${quote(created)});`,
      );
  }
  await runSql(page, `BEGIN;\n${statements.join('\n')}\nCOMMIT;`);
  await returnToApp(page);
  await openW7Habits(page);
  await expect(
    page.getByRole('button', { name: `Open ${rows[0].name} details`, exact: true }),
  ).toBeVisible();
}

export async function openW7Detail(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: `Open ${name} details`, exact: true }).click();
  await expect(page.getByRole('tablist', { name: 'Habit detail sections' })).toBeVisible();
}

export async function selectW7Detail(
  page: Page,
  section: 'Today' | 'Progress' | 'Settings',
): Promise<void> {
  const tab = page
    .getByRole('tablist', { name: 'Habit detail sections' })
    .getByRole('tab', { name: section, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}
