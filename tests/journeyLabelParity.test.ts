import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRailLabels } from '../scripts/journey-label-parity.mjs';

const APP_INDEX = join(__dirname, '..', 'app', 'index.tsx');

describe('journey-label-parity parser', () => {
  it('parses the real app rail into six named labels', () => {
    const source = readFileSync(APP_INDEX, 'utf8');
    const labels = parseRailLabels(source);
    expect(labels).not.toBeNull();
    expect([...labels!.entries()]).toEqual([
      ['overview', 'Today'],
      ['todos', 'To Do'],
      ['habits', 'Habits'],
      ['pomodoro', 'Focus'],
      ['workout', 'Workout'],
      ['calories', 'Calories'],
    ]);
  });

  it('returns null when NAV_ITEMS is missing', () => {
    expect(parseRailLabels('export const x = 1;')).toBeNull();
  });

  it('returns null when NAV_ITEMS has no { name, label } entries', () => {
    const source = 'const NAV_ITEMS: NavItem[] = [ 1, 2, 3 ];';
    expect(parseRailLabels(source)).toBeNull();
  });
});
