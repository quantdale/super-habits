import type { TestDatabase } from './db';

export const REWARD_DAY = '2026-10-19';
export const REWARD_TABLES = [
  'gamification_events',
  'gamification_streak_freezes',
  'gamification_quests',
  'gamification_badges',
] as const;

export async function seedRewardHistory(db: TestDatabase) {
  // Seven active days, a seventh-day grant, then a missed day covered by it.
  // Focus sessions can be removed while their earned rewards stay in history.
  for (let day = 11; day <= 17; day++) {
    const date = `2026-10-${day}`;
    await db.runAsync('INSERT INTO gamification_events VALUES (?, ?, ?, ?, ?, ?)', [
      `gxp_1792195200000_000000${day}`,
      'focus',
      `pom_1792195200000_000000${day}`,
      date,
      day < 13 ? 15 : day < 17 ? 17 : 18,
      `${date}T12:00:00.000Z`,
    ]);
  }
  await db.execAsync(`
    INSERT INTO gamification_events VALUES
      ('gxp_1792195200000_00000021','streak_milestone','streak:3','2026-10-13',15,'2026-10-13T12:00:00.000Z'),
      ('gxp_1792195200000_00000022','streak_milestone','streak:7','2026-10-17',35,'2026-10-17T12:00:00.000Z'),
      ('gxp_1792195200000_00000023','freeze_grant','freeze:7','2026-10-17',0,'2026-10-17T12:00:00.000Z'),
      ('gxp_1792195200000_00000024','quest','2026-10-17:focus_sprint','2026-10-17',15,'2026-10-17T12:00:00.000Z');
    INSERT INTO gamification_streak_freezes VALUES ('2026-10-18','2026-10-19T12:00:00.000Z');
    INSERT INTO gamification_quests VALUES ('2026-10-17','focus_sprint','2026-10-17T12:00:00.000Z');
    INSERT INTO gamification_badges VALUES ('focus:1','focus',1,'2026-10-17T12:00:00.000Z','2026-10-17');
  `);
}

export async function readRewardHistory(db: TestDatabase) {
  return Promise.all(
    REWARD_TABLES.map((table) => db.getAllAsync(`SELECT * FROM ${table} ORDER BY 1, 2`)),
  );
}
