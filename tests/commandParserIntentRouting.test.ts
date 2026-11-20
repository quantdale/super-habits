import { describe, expect, it } from 'vitest';
import { parseCommandDraft } from '@/features/command/command.domain';
import { validateCommandDraftFields } from '@/features/command/command.validation';
import type { ParseCommandInput } from '@/features/command/types';

/**
 * Local (mock_rules) parser intent routing.
 *
 * The mock parser is the DEFAULT path in an ordinary build
 * (`EXPO_PUBLIC_AI_COMMAND_PARSE_MODE` unset → `mode: 'mock'`), so these
 * routing decisions are what most users actually get. The V2 content-signal
 * parsers (calorie, focus) run before the V1 intent detector, and they match on
 * loose content words anywhere in the sentence. When the user has already said
 * WHAT they want created ("add a todo to …", "add a habit to …", "remind me to
 * …"), that explicit scaffolding wins: a command that names a Todo must never
 * become a ready calorie entry that writes to the calorie ledger instead.
 */

const INPUT: ParseCommandInput = {
  rawText: '',
  now: new Date(2026, 3, 21, 9, 0, 0),
  locale: 'en-US',
  timeZone: 'Asia/Manila',
  todayDateKey: '2026-04-21',
  tomorrowDateKey: '2026-04-22',
};

describe('local parser intent routing (explicit create scaffolding wins)', () => {
  it('does not turn "add a todo to …" with nutrition words into a calorie entry', () => {
    // The audited shape: the user asked for a Todo; the local parser produced a
    // READY log_calorie_entry whose food name was the leftover scaffolding
    // ("todo to buy bars"), which the confirm button would have written to the
    // calorie ledger.
    const result = parseCommandDraft({
      ...INPUT,
      rawText: 'add a todo to buy 500 kcal protein bars',
    });
    expect(result.outcome).toBe('draft');
    if (result.outcome !== 'draft') return;
    expect(result.draft.kind).toBe('create_todo');
    if (result.draft.kind !== 'create_todo') return;
    expect(result.draft.fields.title).toBe('buy 500 kcal protein bars');
    expect(result.draft.status).toBe('ready');
  });

  it('keeps a "add a todo to …" command about calorie tracking a Todo', () => {
    const result = parseCommandDraft({ ...INPUT, rawText: 'add a todo to log my calories' });
    expect(result.outcome).toBe('draft');
    if (result.outcome !== 'draft') return;
    expect(result.draft.kind).toBe('create_todo');
    if (result.draft.kind !== 'create_todo') return;
    expect(result.draft.fields.title).toBe('log my calories');
  });

  it('keeps a "remind me to …" command about nutrition a Todo', () => {
    const result = parseCommandDraft({ ...INPUT, rawText: 'remind me to log calories' });
    expect(result.outcome).toBe('draft');
    if (result.outcome !== 'draft') return;
    expect(result.draft.kind).toBe('create_todo');
    if (result.draft.kind !== 'create_todo') return;
    expect(result.draft.fields.title).toBe('log calories');
  });

  it('does not turn "add a habit to …" with nutrition words into a calorie entry', () => {
    const result = parseCommandDraft({
      ...INPUT,
      rawText: 'add a habit to eat 300 calories at lunch',
    });
    expect(result.outcome).toBe('draft');
    if (result.outcome !== 'draft') return;
    expect(result.draft.kind).toBe('create_habit');
    if (result.draft.kind !== 'create_habit') return;
    expect(result.draft.fields.name).toBe('eat 300 calories at lunch');
    expect(result.draft.status).toBe('ready');
  });

  it('does not turn "add a todo to …" with focus words into a focus start', () => {
    // parseFocusStart matches "start"/"begin" + "focus" ANYWHERE, so a Todo
    // about focus sessions used to become a start_focus_session draft that
    // would have driven the live Pomodoro timer.
    const result = parseCommandDraft({
      ...INPUT,
      rawText: 'add a todo to start a 25 minute focus session',
    });
    expect(result.outcome).toBe('draft');
    if (result.outcome !== 'draft') return;
    expect(result.draft.kind).toBe('create_todo');
    if (result.draft.kind !== 'create_todo') return;
    expect(result.draft.fields.title).toBe('start a 25 minute focus session');
  });

  it('still parses genuine calorie and focus commands with no create scaffolding', () => {
    const calorie = parseCommandDraft({
      ...INPUT,
      rawText: 'add lunch: tuna sandwich, 420 calories, 30g protein',
    });
    expect(calorie.outcome).toBe('draft');
    if (calorie.outcome !== 'draft') return;
    expect(calorie.draft.kind).toBe('log_calorie_entry');

    for (const rawText of ['start a 25 minute focus session', 'focus for 45 minutes']) {
      const focus = parseCommandDraft({ ...INPUT, rawText });
      expect(focus.outcome).toBe('draft');
      if (focus.outcome !== 'draft') continue;
      expect(focus.draft.kind).toBe('start_focus_session');
      expect(focus.draft.status).toBe('ready');
    }
  });

  it('never pre-fills calories from a thousands-separated amount', () => {
    // "log 1,500 kcal lunch" matched only the digits AFTER the comma, so the
    // draft was pre-filled with 500 kcal (a silent 3x under-report) and the
    // stray "1," was left inside the food name. With no declared separator
    // format there is no safe repair, so the parser must ask for the number
    // instead of committing one the user never typed.
    for (const rawText of [
      'log 1,500 kcal lunch',
      'log 3,000 kcal pizza',
      'I ate 2,000 calories today',
      'log 1,200 calories oats',
    ]) {
      const result = parseCommandDraft({ ...INPUT, rawText });
      expect(result.outcome, rawText).toBe('draft');
      if (result.outcome !== 'draft' || result.draft.kind !== 'log_calorie_entry') {
        throw new Error(`Expected a log_calorie_entry draft for "${rawText}".`);
      }
      expect(result.draft.fields.calories, rawText).toBeNull();
      expect(result.draft.status, rawText).toBe('needs_input');
      expect(
        result.draft.missingFields.map((field) => field.field),
        rawText,
      ).toContain('calories');
      // A ready-draft invariant worth restating: nothing unexecutable is ready.
      expect(validateCommandDraftFields(result.draft), rawText).not.toBeNull();
    }
  });

  it('still accepts plain whole-number calorie amounts', () => {
    for (const rawText of ['log 500 kcal lunch', 'I ate apple 250 kcal']) {
      const result = parseCommandDraft({ ...INPUT, rawText });
      expect(result.outcome, rawText).toBe('draft');
      if (result.outcome !== 'draft' || result.draft.kind !== 'log_calorie_entry') {
        throw new Error(`Expected a log_calorie_entry draft for "${rawText}".`);
      }
      expect(result.draft.status, rawText).toBe('ready');
      expect(validateCommandDraftFields(result.draft), rawText).toBeNull();
    }
  });
});
