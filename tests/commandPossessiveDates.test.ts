import { describe, expect, it } from 'vitest';
import { parseCommandDraft } from '@/features/command/command.domain';
import { parseQuickCapture } from '@/features/quick-capture/quickCapture.domain';
import type { ParseCommandInput } from '@/features/command/types';

/**
 * Possessive date words must not be split out of the title.
 *
 * "today's paper" / "tomorrow's milk" are ordinary English. The local todo
 * parser stripped the bare word and left the possessive suffix behind, so
 * "add a todo to buy today's paper" produced a Todo titled `buy 's paper` —
 * a visibly broken title the user did not type. Both surfaces must keep the
 * whole phrase in the title and simply not treat it as a due-date token.
 */

const INPUT: ParseCommandInput = {
  rawText: '',
  now: new Date(2026, 3, 21, 9, 0, 0),
  locale: 'en-US',
  timeZone: 'Asia/Manila',
  todayDateKey: '2026-04-21',
  tomorrowDateKey: '2026-04-22',
};

describe('possessive date words stay inside the title', () => {
  it.each([
    ["add a todo to buy today's paper", "buy today's paper"],
    ["remind me to buy tomorrow's milk", "buy tomorrow's milk"],
    ['add a todo to note today’s standup decisions', 'note today’s standup decisions'],
  ])('%s keeps the phrase intact', (rawText, expectedTitle) => {
    const result = parseCommandDraft({ ...INPUT, rawText });
    expect(result.outcome, rawText).toBe('draft');
    if (result.outcome !== 'draft' || result.draft.kind !== 'create_todo') {
      throw new Error(`Expected a create_todo draft for "${rawText}".`);
    }
    expect(result.draft.fields.title, rawText).toBe(expectedTitle);
    // Nothing was silently dropped: the phrase still names the day to the user.
    expect(result.draft.fields.dueDate, rawText).toBeNull();
  });

  it('still reads the plain date words as due dates', () => {
    for (const [rawText, dueDate] of [
      ['add a todo to call mom today', '2026-04-21'],
      ['add a todo to buy milk tomorrow', '2026-04-22'],
    ] as const) {
      const result = parseCommandDraft({ ...INPUT, rawText });
      expect(result.outcome, rawText).toBe('draft');
      if (result.outcome !== 'draft' || result.draft.kind !== 'create_todo') {
        throw new Error(`Expected a create_todo draft for "${rawText}".`);
      }
      expect(result.draft.fields.dueDate, rawText).toBe(dueDate);
    }
  });
});

describe('quick capture agrees on possessive date words', () => {
  it('keeps "today\'s paper" in the title without inventing a due date', () => {
    const parsed = parseQuickCapture("Buy today's paper", {
      now: new Date(2026, 7, 20, 10, 0, 0),
    });
    expect(parsed.title).toBe("Buy today's paper");
    expect(parsed.dueDateKey).toBeNull();
  });
});
