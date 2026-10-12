import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRailLabels } from '../scripts/journey-label-parity.mjs';

/**
 * D3 navigation gate (W10) — structural contract for the shipped six-tab model.
 *
 * The rendered, measured evidence lives in `docs/ui-ux/v3-audit/w10/`
 * (`d3-five-destination.json` vs `d3-six-tab.json`): the five-destination
 * Health-parent model added a tap to starting a workout and logging a meal, so
 * the six-tab fallback shipped with the V3 visual restyle. These assertions pin
 * the two halves of that decision at the source level: the bar carries the six
 * destinations, and `health` stays a valid section for deep links, linked
 * actions, and command routing.
 */
const root = join(__dirname, '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('W10 D3 navigation decision', () => {
  it('the phone bar carries the six destinations and no Health parent', () => {
    const labels = parseRailLabels(read('app/index.tsx'));
    expect(labels).not.toBeNull();
    expect([...labels!.keys()]).toEqual([
      'overview',
      'todos',
      'habits',
      'pomodoro',
      'workout',
      'calories',
    ]);
    expect(labels!.has('health')).toBe(false);
  });

  it('health remains a valid AppSection', () => {
    const source = read('core/providers/navigationContext.ts');
    const sectionType = /export type AppSection =([\s\S]*?);/.exec(source);
    expect(sectionType).not.toBeNull();
    expect(sectionType![1]).toContain("'health'");
  });

  it('the Health surface still renders for its section', () => {
    const source = read('app/index.tsx');
    // SECTION_SCREENS maps every AppSection, including health, to its screen.
    expect(source).toMatch(/health:\s*memo\(HealthScreen\)/);
    expect(source).toContain("import { HealthScreen } from '@/features/health/HealthScreen'");
  });

  it('no rail group label or parent indirection remains in the shell', () => {
    const source = read('app/index.tsx');
    expect(source).not.toContain('RAIL_HEALTH_ITEMS');
    expect(source).not.toContain('HEALTH_CHILD_SECTIONS');
  });
});
