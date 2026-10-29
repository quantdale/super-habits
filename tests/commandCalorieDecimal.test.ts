import { describe, expect, it } from 'vitest';
import { parseCommandDraft } from '@/features/command/command.domain';
import { validateCommandDraftFields } from '@/features/command/command.validation';
import type { ParseCommandInput } from '@/features/command/types';

const INPUT: ParseCommandInput = {
  rawText: '',
  now: new Date(2026, 3, 21, 9, 0, 0),
  locale: 'en-US',
  timeZone: 'Asia/Manila',
  todayDateKey: '2026-04-21',
  tomorrowDateKey: '2026-04-22',
};

describe('Command Center calorie amount contract', () => {
  it('a fractional calorie amount must not surface as a ready draft that fails at confirm', () => {
    const result = parseCommandDraft({ ...INPUT, rawText: 'I ate apple 250.5 kcal' });
    expect(result.outcome).toBe('draft');
    if (result.outcome !== 'draft') return;
    expect(result.draft.kind).toBe('log_calorie_entry');
    if (result.draft.kind !== 'log_calorie_entry') return;
    // House contract: calories are whole numbers (command.validation +
    // realCommandParser). A decimal amount is not executable, so the parser
    // must ask for calories instead of presenting a ready draft whose
    // Confirm is guaranteed to be rejected.
    expect(result.draft.status).toBe('needs_input');
    expect(result.draft.fields.calories).toBeNull();
    expect(result.draft.missingFields).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'calories' })]),
    );
  });

  it('whole-number calories still parse ready and pass execution validation', () => {
    const result = parseCommandDraft({ ...INPUT, rawText: 'I ate apple 250 kcal' });
    expect(result.outcome).toBe('draft');
    if (result.outcome !== 'draft') return;
    expect(result.draft.kind).toBe('log_calorie_entry');
    if (result.draft.kind !== 'log_calorie_entry') return;
    expect(result.draft.status).toBe('ready');
    expect(result.draft.fields.calories).toBe(250);
    expect(validateCommandDraftFields(result.draft)).toBeNull();
  });

  it('every ready calorie draft from the parser is executable', () => {
    const rawTexts = [
      'I ate apple 250 kcal',
      'log lunch: rice, 420 calories',
      'add breakfast: oats 350 cal 12 g protein',
    ];
    for (const rawText of rawTexts) {
      const result = parseCommandDraft({ ...INPUT, rawText });
      expect(result.outcome).toBe('draft');
      if (result.outcome !== 'draft') continue;
      if (result.draft.kind !== 'log_calorie_entry') continue;
      if (result.draft.status !== 'ready') continue;
      expect(validateCommandDraftFields(result.draft)).toBeNull();
    }
  });
});
