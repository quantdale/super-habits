import { describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';

vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

async function exportedFile() {
  const { exportPortableBackup } = await import('@/core/portable/portableExport');
  const result = await exportPortableBackup();
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe('product-authored planning data remains recoverable', () => {
  it.each([1001, 4000])(
    'round-trips a valid %i-character weekly reflection unchanged',
    async (length) => {
      const source = await freshDatabase();
      const { saveWeeklyReview } = await import('@/features/weekly-review/weeklyReview.data');
      const { validateReflection } = await import('@/features/weekly-review/weeklyReview.domain');
      const reflection = 'r'.repeat(length);
      expect(validateReflection(reflection)).toEqual([]);
      await saveWeeklyReview({
        weekKey: '2026-11-09',
        weekStartDate: '2026-11-09',
        weekEndDate: '2026-11-15',
        nextWeekStartDate: '2026-11-16',
        summaryPayload: '{}',
        planPayload: '{}',
        reflection,
      });
      const { validateBackupRow } = await import('@/core/backup/backupValidators');
      const row = await source.getFirstAsync<Record<string, unknown>>(
        'SELECT * FROM weekly_reviews',
      );
      expect(validateBackupRow('weekly_reviews', { ...row, reflection: 'r'.repeat(4001) }).ok).toBe(
        false,
      );
      const file = await exportedFile();
      await source.closeAsync();
      const target = await freshDatabase();
      try {
        const { preparePortableImport, confirmPortableImport } =
          await import('@/core/portable/portableImport');
        const prepared = await preparePortableImport({ fileName: file.fileName, text: file.json });
        expect(prepared.status, JSON.stringify(prepared)).toBe('ready');
        if (prepared.status !== 'ready') throw new Error('valid reflection was rejected');
        expect((await confirmPortableImport({ file: prepared.file })).status).toBe('restored');
        expect(
          (
            await target.getFirstAsync<{ reflection: string }>(
              'SELECT reflection FROM weekly_reviews',
            )
          )?.reflection,
        ).toBe(reflection);
      } finally {
        await target.closeAsync();
      }
    },
  );

  it('round-trips actual executor summary and plan payloads larger than 1000 characters', async () => {
    const source = await freshDatabase();
    const { addTodo } = await import('@/features/todos/todos.data');
    for (let i = 0; i < 12; i++)
      await addTodo({ title: `${i}: ${'Task '.repeat(30)}`, dueDate: '2026-11-10' });
    const { buildWeeklyReviewSummary } =
      await import('@/features/weekly-review/weeklyReview.summary');
    const { executeWeeklyReview } = await import('@/features/weekly-review/weeklyReview.executor');
    const { validateReviewDraft } = await import('@/features/weekly-review/weeklyReview.domain');
    const summary = await buildWeeklyReviewSummary('2026-11-14');
    const draft = {
      weekKey: summary.week.weekKey,
      todoDecisions: [],
      reflection: '',
      priorities: Array.from({ length: 5 }, (_, i) => ({
        id: `priority-${i}`,
        text: 'p'.repeat(200),
      })),
      newCommitments: Array.from({ length: 10 }, (_, i) => ({
        id: `commitment-${i}`,
        title: `${i}${'t'.repeat(190)}`,
        notes: 'n'.repeat(500),
        priority: 'normal' as const,
      })),
    };
    expect(validateReviewDraft(draft)).toEqual([]);
    await executeWeeklyReview({ summary, draft });
    const before = await source.getFirstAsync<{ summary_payload: string; plan_payload: string }>(
      'SELECT summary_payload, plan_payload FROM weekly_reviews',
    );
    expect(before!.summary_payload.length).toBeGreaterThan(1000);
    expect(before!.plan_payload.length).toBeGreaterThan(1000);
    const file = await exportedFile();
    await source.closeAsync();
    const target = await freshDatabase();
    try {
      const { preparePortableImport, confirmPortableImport } =
        await import('@/core/portable/portableImport');
      const prepared = await preparePortableImport({ fileName: file.fileName, text: file.json });
      expect(prepared.status, JSON.stringify(prepared)).toBe('ready');
      if (prepared.status !== 'ready') throw new Error('valid executor payloads were rejected');
      expect((await confirmPortableImport({ file: prepared.file })).status).toBe('restored');
      expect(
        await target.getFirstAsync('SELECT summary_payload, plan_payload FROM weekly_reviews'),
      ).toEqual(before);
    } finally {
      await target.closeAsync();
    }
  });

  it('round-trips three JSON-escaped daily priority title snapshots', async () => {
    const source = await freshDatabase();
    const { addTodo } = await import('@/features/todos/todos.data');
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push(await addTodo({ title: `${i}${'"'.repeat(199)}` }));
    const { upsertDailyPlan } = await import('@/features/daily-plan/dailyPlan.data');
    await upsertDailyPlan('2026-11-14', { topTodoIds: ids, reflection: 'd'.repeat(2000) });
    const before = await source.getFirstAsync<{ top_todo_titles: string; reflection: string }>(
      'SELECT top_todo_titles, reflection FROM daily_plans',
    );
    expect(before!.top_todo_titles.length).toBeGreaterThan(1000);
    const file = await exportedFile();
    await source.closeAsync();
    const target = await freshDatabase();
    try {
      const { preparePortableImport, confirmPortableImport } =
        await import('@/core/portable/portableImport');
      const prepared = await preparePortableImport({ fileName: file.fileName, text: file.json });
      expect(prepared.status, JSON.stringify(prepared)).toBe('ready');
      if (prepared.status !== 'ready') throw new Error('valid title snapshots were rejected');
      expect((await confirmPortableImport({ file: prepared.file })).status).toBe('restored');
      expect(
        await target.getFirstAsync('SELECT top_todo_titles, reflection FROM daily_plans'),
      ).toEqual(before);
    } finally {
      await target.closeAsync();
    }
  });
});
