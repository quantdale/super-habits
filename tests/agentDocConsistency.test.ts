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
 *
 * 2026-09-29 `harden-agent-guidance-truth`: the same discipline now covers every
 * document a session may read first. `GUIDANCE_DOCS` is the single inventory;
 * adding a guidance document is a one-line diff here, and the cross-document
 * rules (export command before a Playwright lane, Ask/Auto default, schema
 * version, lint warning cap, authoritative-doc status, register status labels)
 * are driven from that array rather than per-file assertions.
 */

const repositoryRoot = resolve(__dirname, '..');
const read = (relative: string) => readFileSync(resolve(repositoryRoot, relative), 'utf8');

function currentSchemaVersion(): number {
  const client = read('core/db/client.ts');
  const versions = [...client.matchAll(/if \(version < (\d+)\) \{/g)].map((m) => Number(m[1]));
  expect(versions.length).toBeGreaterThan(0);
  return Math.max(...versions);
}

/**
 * Every agent-facing document a session can be pointed at. Extend this array
 * (never a new test file) when guidance is added — the assertions below then
 * cover it automatically.
 */
const GUIDANCE_DOCS = [
  'README.md',
  'CLAUDE.md',
  'AGENTS.md',
  'ONBOARDING.md',
  'docs/codex-workflow.md',
  '.cursor/rules/superhabits-rules.mdc',
  '.github/copilot-instructions.md',
  'core/db/schema.sql',
] as const;

/** A build instruction that produces a non-hermetic `dist/`. */
const NON_HERMETIC_EXPORT = 'npm run build:web';

/** A command that actually runs a Playwright/E2E lane. */
const E2E_COMMAND = /npm run e2e|npx playwright|playwright test|npm run qa:journeys/;

/** Prose naming the E2E layer (any mention, not necessarily a command). */
const E2E_MENTION = /playwright|e2e/i;

describe('agent documentation vs source truth', () => {
  const schema = currentSchemaVersion();
  const nextSchema = schema + 1;
  const pkg = JSON.parse(read('package.json')) as {
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
  const rn = pkg.dependencies['react-native'];
  const expo = pkg.dependencies.expo;
  const expoRouter = pkg.dependencies['expo-router'];
  const expoSqlite = pkg.dependencies['expo-sqlite'];
  const lintWarningCap = /--max-warnings (\d+)/.exec(pkg.scripts.lint ?? '')?.[1];

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

  it('lists every guidance document in the inventory, and each one exists', () => {
    expect(GUIDANCE_DOCS.length).toBeGreaterThan(0);
    for (const doc of GUIDANCE_DOCS) {
      expect(() => read(doc), `${doc} is listed in GUIDANCE_DOCS but missing`).not.toThrow();
      expect(read(doc).length).toBeGreaterThan(0);
    }
  });

  /**
   * `npm run build:web` inlines whatever `.env` the workstation has, so
   * pointing a Playwright lane at its `dist/` can drain the local outbox into a
   * live Supabase project (docs/testing/known-gaps.md gap 15's 2026-09-24
   * residue). Only the hermetic `npm run build:e2e` export may precede a lane.
   *
   * Proximity, not a global ban: `build:web` is still the correct command for a
   * Vercel deploy (`README.md`, `CLAUDE.md`, `AGENTS.md` deploy sections), and
   * a *prohibition* naming the script ("never feed a lane its `dist/`") is the
   * fix rather than the defect. The rule therefore reads the two forms the
   * repository already distinguishes, mirroring AGENTS.md:
   *   - an instruction is spelled `npm run build:web`;
   *   - a reference to the script is spelled `build:web`.
   * An instruction may not be paired with an E2E/Playwright lane — on its own
   * line, or with an E2E command on either of the next two lines.
   */
  it('never instructs build:web before an E2E or Playwright lane', () => {
    for (const doc of GUIDANCE_DOCS) {
      const lines = read(doc).split('\n');
      lines.forEach((line, index) => {
        if (line.includes(NON_HERMETIC_EXPORT)) {
          const pairedSameLine = E2E_MENTION.test(line);
          const pairedNextLine =
            E2E_COMMAND.test(lines[index + 1] ?? '') || E2E_COMMAND.test(lines[index + 2] ?? '');
          expect(
            pairedSameLine || pairedNextLine,
            `${doc}:${index + 1} pairs \`${NON_HERMETIC_EXPORT}\` with an E2E/Playwright lane; use \`npm run build:e2e\` (hermetic)`,
          ).toBe(false);
        }
        // A bare script reference paired with an E2E command on the same line
        // still reads as "build, then test" — e.g. "`build:web`, then `npm run e2e`".
        if (/build:web/.test(line) && !line.includes(NON_HERMETIC_EXPORT)) {
          expect(
            E2E_COMMAND.test(line),
            `${doc}:${index + 1} names \`build:web\` beside an E2E command; only the hermetic \`build:e2e\` output may feed a lane`,
          ).toBe(false);
        }
      });
    }
  });

  it('does not claim the Command Center Ask/Auto experiment is enabled', () => {
    const readme = read('README.md');
    expect(readme).not.toContain('currently `true`');
    expect(readme).not.toContain('enabled 2026-08-05');
    expect(readme).toContain('EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT');
    expect(readme).toMatch(
      /EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT[^\n]*default OFF|default OFF[^\n]*EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT/i,
    );
    expect(read('.env.example')).toContain('EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT');
    expect(read('CLAUDE.md')).toContain('EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT');
  });

  it('declares the schema snapshot version the runtime migration chain derives', () => {
    expect(read('core/db/schema.sql')).toContain(`Current stored schema version: ${schema}`);
  });

  it('states the pinned lint warning cap everywhere it mentions one', () => {
    expect(lintWarningCap).toBeDefined();
    const lintScript = pkg.scripts.lint;
    for (const doc of [
      ...GUIDANCE_DOCS,
      '.cursor/commands/pre-pr.md',
      '.cursor/commands/audit-performance.md',
      'docs/master-context.md',
    ]) {
      const text = read(doc);
      if (!text.includes('--max-warnings')) continue;
      const stated = [...text.matchAll(/--max-warnings (\d+)/g)].map((m) => m[1]);
      expect(
        stated.length,
        `${doc} mentions --max-warnings but no value could be read`,
      ).toBeGreaterThan(0);
      for (const value of stated) {
        expect(
          value,
          `${doc} states --max-warnings ${value}; package.json pins ${lintWarningCap}`,
        ).toBe(lintWarningCap);
      }
      expect(lintScript).toBeDefined();
      expect(lintScript).toContain(`--max-warnings ${lintWarningCap}`);
    }
  });

  it('keeps self-superseded documents out of the Authoritative Docs list', () => {
    const agents = read('AGENTS.md');
    const authoritative = agents
      .split('## Authoritative Docs')[1]
      ?.split('\n## ')[0]
      ?.toLowerCase();
    expect(authoritative).toBeDefined();
    expect(authoritative).not.toContain('superhabits_unified_knowledge_base');
    // The demotion must keep the file on disk and still cited somewhere.
    expect(agents).toContain('docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md');
    expect(agents).toMatch(/historical|superseded/i);
  });

  /**
   * A register entry whose status label contradicts its own later notes is the
   * exact drift this change exists to catch (gap 15 carried a resolution note
   * under an unlabelled heading). The check reads the register's own
   * vocabulary, so unrelated prose ("fail-closed", `ERR_IPC_CHANNEL_CLOSED` in
   * the environment notes) cannot trip it.
   */
  it('keeps every register entry status label consistent with its own notes', () => {
    const register = read('docs/testing/known-gaps.md');
    const lines = register.split('\n');
    let section = '';
    let entry: { title: string; body: string[] } | null = null;
    const entries: { title: string; body: string[]; section: string }[] = [];

    for (const line of lines) {
      const heading = /^##\s+(.+)$/.exec(line);
      if (heading) {
        section = heading[1];
        entry = null;
        continue;
      }
      const gapHeading = /^###\s+(.+)$/.exec(line);
      if (gapHeading) {
        entry = { title: gapHeading[1], body: [] };
        entries.push({ title: entry.title, body: entry.body, section });
        continue;
      }
      entry?.body.push(line);
    }

    const gaps = entries.filter((candidate) =>
      /^(contract gaps|capability gaps)$/i.test(candidate.section),
    );
    expect(gaps.length).toBeGreaterThan(10);

    const RESOLUTION_MARKER =
      /\*\*Resolution|\bRESOLUTION\b|\bRESOLVED\b|— CLOSED|\*\*REPAIRED|\bREPAIRED\b/;
    const STILL_OPEN = /\bstill open\b|\bremains open\b|\bnot closed\b/i;

    for (const gap of gaps) {
      const body = gap.body.join('\n');
      const closedLabel = /\bCLOSED\b/.test(gap.title);
      const openLabel = /\bOPEN\b/.test(gap.title);
      const hasResolution = RESOLUTION_MARKER.test(body);
      const stillOpen = STILL_OPEN.test(body);

      if (hasResolution) {
        expect(
          closedLabel || openLabel,
          `${gap.title}: carries a resolution note but no CLOSED/OPEN status label`,
        ).toBe(true);
      }
      if (closedLabel) {
        expect(hasResolution, `${gap.title}: labelled CLOSED with no resolution note`).toBe(true);
        expect(
          stillOpen,
          `${gap.title}: labelled CLOSED while its own notes still call it open`,
        ).toBe(false);
      }
      if (openLabel) {
        expect(
          hasResolution,
          `${gap.title}: labelled OPEN while a resolution note is present`,
        ).toBe(false);
      }
    }
  });
});
