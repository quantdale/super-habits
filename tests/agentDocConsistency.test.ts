import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BACKUP_ENTITIES } from '@/core/backup/backup.types';

/**
 * Agent-facing documentation must not contradict machine-verifiable source
 * truth. Regression guard fired by the 2026-09-23 §32 adversarial review:
 * `.github/copilot-instructions.md` contradicted the repository on five points
 * (React Native version, schema version next-migration base, sync-entity
 * scope, test-count drift) — the schema claim alone could steer a migration
 * onto the wrong base.
 *
 * Every expected value below is DERIVED from source at test time (never a
 * hard-coded copy), so docs must track reality and this test cannot rot into
 * pinning two stale copies of the same number.
 */

const repositoryRoot = resolve(__dirname, '..');
const read = (relative: string) => readFileSync(resolve(repositoryRoot, relative), 'utf8');

function currentSchemaVersion(): number {
  const client = read('core/db/client.ts');
  const versions = [...client.matchAll(/if \(version < (\d+)\) \{/g)].map((m) => Number(m[1]));
  expect(versions.length).toBeGreaterThan(0);
  return Math.max(...versions);
}

describe('agent documentation vs source truth', () => {
  const schema = currentSchemaVersion();
  const nextSchema = schema + 1;
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
  const rn = pkg.dependencies['react-native'];
  const expo = pkg.dependencies.expo;
  const expoRouter = pkg.dependencies['expo-router'];
  const expoSqlite = pkg.dependencies['expo-sqlite'];

  it('states the real current schema version and next migration base', () => {
    const copilot = read('.github/copilot-instructions.md');
    expect(copilot).toContain(`Current schema: **v${schema}**`);
    expect(copilot).toContain(`if (version < ${nextSchema})`);

    const agents = read('AGENTS.md');
    expect(agents).toMatch(new RegExp(`stored schema version: \\*\\*${schema}\\*\\*`, 'i'));
    expect(agents).toContain(`if (version < ${nextSchema})`);

    const knowledgeBase = read('docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md');
    expect(knowledgeBase).toContain(`Schema stored version: **${schema}**`);
    expect(knowledgeBase).toContain(`if (version < ${nextSchema})`);
    // 2026-09-24 adversarial review: two more KB phrasings of the schema
    // number were stale ("24") while the line above passed — pin them all.
    expect(knowledgeBase).toContain(`Schema version (stored) | **${schema}**`);
    expect(knowledgeBase).toContain(`Current \`app_meta.db_schema_version\`: **${schema}**`);
    // Stale-count detector (was "740 passing").
    expect(knowledgeBase).not.toContain('**740** passing');

    const structureMap = read('docs/PROJECT_STRUCTURE_MAP.md');
    expect(structureMap).toContain(`Schema v${schema}`);
  });

  it('states the real runtime dependency pins', () => {
    const copilot = read('.github/copilot-instructions.md');
    expect(copilot).toContain(`React Native ${rn}`);

    const agents = read('AGENTS.md');
    // AGENTS.md renders versions wrapped in code backticks; copilot-instructions
    // does not — assert each file's real format rather than one invented shape.
    expect(agents).toContain(`React Native \`${rn}\``);
    expect(agents).toContain(`Expo SDK \`${expo}\``);
    expect(agents).toContain(`Expo Router \`${expoRouter}\``);
    expect(agents).toContain(`\`expo-sqlite\` (\`${expoSqlite}\`)`);
  });

  it('states the real service-worker cache generation', () => {
    const match = /const CACHE_VERSION = 'v(\d+)'/.exec(read('public/sw.js'));
    expect(match).not.toBeNull();
    const cacheVersion = `v${match![1]}`;
    expect(read('CLAUDE.md')).toContain(`superhabits-shell-${cacheVersion}`);
    const prePr = read('.cursor/commands/pre-pr.md');
    expect(prePr).toContain(`superhabits-shell-${cacheVersion}`);
    expect(prePr).not.toContain('superhabits-shell-v3');
  });

  it('states the real backup entity scope size', () => {
    const copilot = read('.github/copilot-instructions.md');
    expect(copilot).toContain(`${BACKUP_ENTITIES.length}-entity \`BACKUP_ENTITIES\``);
    expect(BACKUP_ENTITIES.length).toBeGreaterThanOrEqual(21);
  });
});
