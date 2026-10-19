import { expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';
import { buildFixtureSql } from '../../e2e/helpers/seed';

vi.mock('../../e2e/helpers/dbHarness', () => ({}));
vi.mock('../../e2e/helpers/reset', () => ({}));
vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));

it('the fixed visual fixture pays its three historical quests exactly once', async () => {
  const db = await freshDatabase();
  try {
    await db.execAsync(buildFixtureSql('2026-10-13', 'TYPICAL'));
    const { runGamificationHousekeeping, readGamificationSnapshot } =
      await import('@/features/gamification/gamification.data');
    await runGamificationHousekeeping({ todayKey: '2026-10-13' });
    const expectedQuests = [
      { date_key: '2026-10-07', quest_id: 'log_meals' },
      { date_key: '2026-10-09', quest_id: 'log_meals' },
      { date_key: '2026-10-12', quest_id: 'move_body' },
    ];
    expect(
      await db.getAllAsync('SELECT date_key, quest_id FROM gamification_quests ORDER BY date_key'),
    ).toEqual(expectedQuests);
    expect(
      await db.getFirstAsync(
        "SELECT SUM(xp) AS xp FROM gamification_events WHERE event_kind = 'quest'",
      ),
    ).toEqual({ xp: 45 });
    expect((await readGamificationSnapshot({ todayKey: '2026-10-13' })).level).toMatchObject({
      totalXp: 275,
      xpIntoLevel: 93,
      xpForNextLevel: 233,
      xpToNextLevel: 140,
    });
    await runGamificationHousekeeping({ todayKey: '2026-10-13' });
    expect((await readGamificationSnapshot({ todayKey: '2026-10-13' })).level.totalXp).toBe(275);
  } finally {
    await db.closeAsync();
  }
});
