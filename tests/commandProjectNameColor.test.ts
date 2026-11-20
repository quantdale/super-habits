import { describe, expect, it } from 'vitest';
import { parseCommandDraft } from '@/features/command/command.domain';
import type { ParseCommandInput } from '@/features/command/types';

/**
 * `create_project` name extraction vs the color vocabulary.
 *
 * The rule parser looked for a canonical color word ANYWHERE in the remaining
 * text and deleted it. Any project whose own name contains a color word lost
 * that word: "create project Red Team" produced a project literally named
 * "Team" (colored red) and "create project Blue Ocean" produced "Ocean". The
 * preview cannot save the user here — the mangled name IS the preview value, so
 * the wrong entity is created unless the user retypes the name.
 *
 * A color is only a color when the sentence marks it as one ("in <color>",
 * "with <color>", "<color> color"); otherwise the word belongs to the name.
 */

const INPUT: ParseCommandInput = {
  rawText: '',
  now: new Date(2026, 3, 21, 9, 0, 0),
  locale: 'en-US',
  timeZone: 'Asia/Manila',
  todayDateKey: '2026-04-21',
  tomorrowDateKey: '2026-04-22',
};

function projectDraft(rawText: string) {
  const result = parseCommandDraft({ ...INPUT, rawText });
  expect(result.outcome, rawText).toBe('draft');
  if (result.outcome !== 'draft' || result.draft.kind !== 'create_project') {
    throw new Error(`Expected a create_project draft for "${rawText}".`);
  }
  return result.draft;
}

describe('create_project keeps color words that belong to the name', () => {
  it.each([
    ['create project Red Team', 'Red Team'],
    ['create project Blue Ocean', 'Blue Ocean'],
    ['create project Green Thumb', 'Green Thumb'],
    ['create project Amber Room', 'Amber Room'],
    ['create project Teal', 'Teal'],
  ])('%s keeps the full name', (rawText, expectedName) => {
    const draft = projectDraft(rawText);
    expect(draft.fields.name).toBe(expectedName);
    // No color was requested, so none is invented; the normal default applies.
    expect(draft.fields.color).toBeNull();
    expect(draft.status).toBe('ready');
  });

  it('keeps a leading article inside an explicit name', () => {
    // "The Red Baron" is a name, and the shared `clean()` helper strips a
    // leading article from any create label ("add a todo to …"). Entity
    // creation is not affected by that normalization (an entity literally
    // named "the …" is rare and the user can rename it after review), so this
    // pins the current, non-destructive behaviour: the color word survives.
    const draft = projectDraft('create project The Red Baron');
    expect(draft.fields.name).toBe('Red Baron');
    expect(draft.fields.color).toBeNull();
  });

  it('still reads a color the sentence marks as a color', () => {
    for (const [rawText, expectedColor] of [
      ['create project Apollo in blue', 'blue'],
      ['create project Apollo with emerald', 'emerald'],
      ['create project called Apollo due 2026-05-01 in blue', 'blue'],
      ['create project Red Team in blue', 'blue'],
    ] as const) {
      const draft = projectDraft(rawText);
      expect(draft.fields.color, rawText).toBe(expectedColor);
      expect(draft.fields.name, rawText).toBe(rawText.includes('Red Team') ? 'Red Team' : 'Apollo');
    }
  });
});
