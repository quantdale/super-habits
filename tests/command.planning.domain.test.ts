import { describe, expect, it } from 'vitest';
import { parseCommandDraft, preflightCommandDraft } from '@/features/command/command.domain';

const PARSE_INPUT_BASE = {
  now: new Date(2026, 3, 21, 9, 0, 0),
  locale: 'en-US',
  timeZone: 'Asia/Manila',
  todayDateKey: '2026-04-21',
  tomorrowDateKey: '2026-04-22',
};

describe('features/command planning draft parsing (W6)', () => {
  describe('create_project', () => {
    it('parses "create project X" into a ready draft', () => {
      const result = parseCommandDraft({ ...PARSE_INPUT_BASE, rawText: 'Create project Apollo' });
      expect(result.outcome).toBe('draft');
      if (result.outcome !== 'draft' || result.draft.kind !== 'create_project') {
        throw new Error('Expected a create_project draft.');
      }
      const draft = result.draft;
      expect(draft.fields.name).toBe('Apollo');
      expect(draft.fields.color).toBeNull();
      expect(draft.fields.targetDate).toBeNull();
      expect(draft.status).toBe('ready');
      expect(draft.parserKind).toBe('mock_rules');
    });

    it('extracts an explicit target date and color name', () => {
      const result = parseCommandDraft({
        ...PARSE_INPUT_BASE,
        rawText: 'create project called Apollo due 2026-05-01 in blue',
      });
      expect(result.outcome).toBe('draft');
      if (result.outcome !== 'draft' || result.draft.kind !== 'create_project') {
        throw new Error('Expected a create_project draft.');
      }
      const draft = result.draft;
      expect(draft.fields.targetDate).toBe('2026-05-01');
      expect(draft.fields.color).toBe('blue');
      // The dangling preposition left by the color word is stripped.
      expect(draft.fields.name).toBe('Apollo');
    });

    it('parses alias colors from the canonical vocabulary', () => {
      const result = parseCommandDraft({
        ...PARSE_INPUT_BASE,
        rawText: 'create project Apollo in emerald',
      });
      expect(result.outcome).toBe('draft');
      if (result.outcome !== 'draft' || result.draft.kind !== 'create_project') {
        throw new Error('Expected a create_project draft.');
      }
      expect(result.draft.fields.color).toBe('emerald');
      expect(result.draft.fields.name).toBe('Apollo');
    });

    it('needs input when the project name is missing', () => {
      const result = parseCommandDraft({ ...PARSE_INPUT_BASE, rawText: 'create project' });
      expect(result.outcome).toBe('unsupported');
    });
  });

  describe('update_goal_progress', () => {
    it('parses "set goal Y to 50%" with clamping', () => {
      const result = parseCommandDraft({
        ...PARSE_INPUT_BASE,
        rawText: 'set goal Read more to 50%',
      });
      expect(result.outcome).toBe('draft');
      if (result.outcome !== 'draft' || result.draft.kind !== 'update_goal_progress') {
        throw new Error('Expected an update_goal_progress draft.');
      }
      const draft = result.draft;
      expect(draft.fields.goalTitle).toBe('Read more');
      expect(draft.fields.percent).toBe(50);
      expect(draft.warnings).toEqual([]);
    });

    it('lets the "update goal … to n%" phrasing through the root-verb preflight', () => {
      // Narrow allowlist: exactly this phrasing is exempt from the leading-
      // "update" rejection; other update verbs stay unsupported.
      expect(
        preflightCommandDraft({ ...PARSE_INPUT_BASE, rawText: 'update goal Read more to 50%' }),
      ).toBeNull();
      expect(
        preflightCommandDraft({ ...PARSE_INPUT_BASE, rawText: 'update project Apollo' }),
      ).toMatchObject({ outcome: 'unsupported' });

      const result = parseCommandDraft({
        ...PARSE_INPUT_BASE,
        rawText: 'update goal Read more to 50%',
      });
      expect(result.outcome).toBe('draft');
      if (result.outcome !== 'draft' || result.draft.kind !== 'update_goal_progress') {
        throw new Error('Expected an update_goal_progress draft.');
      }
      expect(result.draft.fields.goalTitle).toBe('Read more');
      expect(result.draft.fields.percent).toBe(50);
    });

    it('clamps percents above 100 and records a warning', () => {
      const result = parseCommandDraft({
        ...PARSE_INPUT_BASE,
        rawText: 'set goal Read more to 150%',
      });
      expect(result.outcome).toBe('draft');
      if (result.outcome !== 'draft' || result.draft.kind !== 'update_goal_progress') {
        throw new Error('Expected an update_goal_progress draft.');
      }
      const draft = result.draft;
      expect(draft.fields.percent).toBe(100);
      expect(draft.warnings.map((warning) => warning.code)).toContain('percent_clamped');
    });

    it('rejects non-numeric progress phrasing', () => {
      const result = parseCommandDraft({
        ...PARSE_INPUT_BASE,
        rawText: 'set goal Read more to half',
      });
      expect(result.outcome).toBe('unsupported');
    });
  });

  describe('add_todo_to_daily_plan', () => {
    it('defaults the plan date to today', () => {
      const result = parseCommandDraft({
        ...PARSE_INPUT_BASE,
        rawText: 'add Buy groceries to my plan today',
      });
      expect(result.outcome).toBe('draft');
      if (result.outcome !== 'draft' || result.draft.kind !== 'add_todo_to_daily_plan') {
        throw new Error('Expected an add_todo_to_daily_plan draft.');
      }
      const draft = result.draft;
      expect(draft.fields.todoTitle).toBe('Buy groceries');
      expect(draft.fields.dateKey).toBe('2026-04-21');
    });

    it('resolves tomorrow from the parser clock', () => {
      const result = parseCommandDraft({
        ...PARSE_INPUT_BASE,
        rawText: 'add Buy groceries to plan for tomorrow',
      });
      expect(result.outcome).toBe('draft');
      if (result.outcome !== 'draft' || result.draft.kind !== 'add_todo_to_daily_plan') {
        throw new Error('Expected an add_todo_to_daily_plan draft.');
      }
      expect(result.draft.fields.dateKey).toBe('2026-04-22');
    });

    it('omits the date key when no day is stated so execution defaults to today', () => {
      const result = parseCommandDraft({
        ...PARSE_INPUT_BASE,
        rawText: 'add Buy groceries to my plan',
      });
      expect(result.outcome).toBe('draft');
      if (result.outcome !== 'draft' || result.draft.kind !== 'add_todo_to_daily_plan') {
        throw new Error('Expected an add_todo_to_daily_plan draft.');
      }
      expect(result.draft.fields.dateKey).toBeNull();
    });
  });
});
