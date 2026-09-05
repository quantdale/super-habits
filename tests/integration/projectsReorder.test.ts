import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Projects manual-order management against real SQLite: reorderProjects
 * rewrites sort_order for the supplied full order, the read path reflects it,
 * and every reordered project carries one coalesced durable update intent.
 */
describe('projects manual reorder (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('persists a manual reorder through the real data layer with durable intents', async () => {
    db = await freshDatabase();
    const projects = await import('@/features/projects/projects.data');

    const alpha = await projects.addProject({ name: 'Alpha' });
    const beta = await projects.addProject({ name: 'Beta' });
    const gamma = await projects.addProject({ name: 'Gamma' });

    expect((await projects.listProjects()).map((p) => p.id)).toEqual([alpha, beta, gamma]);

    await projects.reorderProjects([gamma, alpha, beta]);

    expect((await projects.listProjects()).map((p) => p.id)).toEqual([gamma, alpha, beta]);
    const orders = await db.getAllAsync<{ id: string; sort_order: number }>(
      'SELECT id, sort_order FROM projects WHERE deleted_at IS NULL ORDER BY sort_order ASC',
    );
    expect(orders).toEqual([
      { id: gamma, sort_order: 1 },
      { id: alpha, sort_order: 2 },
      { id: beta, sort_order: 3 },
    ]);

    // The create intents coalesced into exactly one update intent per project.
    const intents = await db.getAllAsync<{ id: string; operation: string }>(
      `SELECT id, operation FROM sync_outbox WHERE entity = 'projects' ORDER BY id ASC`,
    );
    expect(intents.map((intent) => intent.operation).sort()).toEqual([
      'update',
      'update',
      'update',
    ]);
    expect(intents.map((intent) => intent.id).sort()).toEqual([alpha, beta, gamma].sort());
  });
});
