import { describe, expect, it } from 'vitest';
import { parseCommandDraft } from '@/features/command/command.domain';
import type { ParseCommandInput } from '@/features/command/types';

/**
 * Planning destinations must win over the loose content-signal parsers.
 *
 * `add_todo_to_daily_plan` is only reached from the V2 chain's tail, AFTER
 * `parseCalorieEntry`, and the calorie parser fires on any sentence containing
 * "add"/"log" plus a nutrition word. So a plan command that also mentions
 * calories was taken by the calorie parser: "add 500 kcal pasta to plan"
 * produced a ready calorie entry whose food name was the leftover scaffolding
 * ("pasta to plan"). The user asked for a daily-plan insertion and would have
 * written to the calorie ledger instead.
 */

const INPUT: ParseCommandInput = {
  rawText: '',
  now: new Date(2026, 3, 21, 9, 0, 0),
  locale: 'en-US',
  timeZone: 'Asia/Manila',
  todayDateKey: '2026-04-21',
  tomorrowDateKey: '2026-04-22',
};

describe('daily-plan commands are not retargeted to the calorie ledger', () => {
  it.each([
    ['add 500 kcal pasta to plan', '500 kcal pasta'],
    ['add pasta 500 calories to plan', 'pasta 500 calories'],
    ['add 300 calories lunch to my plan today', '300 calories lunch'],
    ['add 30g protein chicken to plan tomorrow', '30g protein chicken'],
  ])('%s stays an add_todo_to_daily_plan draft', (rawText, expectedTodoTitle) => {
    const result = parseCommandDraft({ ...INPUT, rawText });
    expect(result.outcome, rawText).toBe('draft');
    if (result.outcome !== 'draft' || result.draft.kind !== 'add_todo_to_daily_plan') {
      throw new Error(`Expected an add_todo_to_daily_plan draft for "${rawText}".`);
    }
    expect(result.draft.fields.todoTitle, rawText).toBe(expectedTodoTitle);
    expect(result.draft.status, rawText).toBe('ready');
  });

  it('keeps plain calorie logging without a plan phrase', () => {
    const result = parseCommandDraft({
      ...INPUT,
      rawText: 'add lunch: tuna sandwich, 420 calories',
    });
    expect(result.outcome).toBe('draft');
    if (result.outcome !== 'draft') return;
    expect(result.draft.kind).toBe('log_calorie_entry');
  });
});
