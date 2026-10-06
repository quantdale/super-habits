import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * V3 compact-control touch-target contract (W4.5 Fix B).
 *
 * The V3 accessibility contract requires ~44–48 logical points of interactive
 * area for frequent controls even when the visible face is smaller (visual
 * compactness must not cost touch reliability). There is no React component
 * render harness in this repo, so — like journeyLabelParity and
 * ciLaneIntegrity — this is a source-contract test: it pins the geometry
 * constants and their application at the call sites that carry the contract.
 *
 * If a primitive's face size changes, update BOTH the component and the
 * expected arithmetic here; a mismatch means the 44pt contract silently broke.
 */

const CORE_UI = join(__dirname, '..', 'core', 'ui');

function read(file: string): string {
  return readFileSync(join(CORE_UI, file), 'utf8');
}

describe('V3 compact control touch targets', () => {
  it('Button sm face stays compact (36) while hitSlop lifts the target to 44', () => {
    const source = read('Button.tsx');
    expect(source).toMatch(/sm:\s*\{\s*height:\s*36,/);
    // The slop constant must be derived from (44 - face) / 2 so a face change
    // forces the arithmetic here to be revisited rather than drift silently.
    expect(source).toMatch(/COMPACT_TOUCH_TARGET\s*=\s*44/);
    expect(source).toMatch(
      /SM_TOUCH_SLOP_VERTICAL\s*=\s*\(COMPACT_TOUCH_TARGET\s*-\s*SIZES\.sm\.height\)\s*\/\s*2/,
    );
    // The slop is applied exactly when the compact size renders…
    expect(source).toMatch(/sizeRole === 'sm'\s*\?\s*\{\s*top:\s*SM_TOUCH_SLOP_VERTICAL/);
    // …vertically only, so adjacent compact controls never overlap targets.
    expect(source).toMatch(/top:\s*SM_TOUCH_SLOP_VERTICAL,\s*bottom:\s*SM_TOUCH_SLOP_VERTICAL/);
  });

  it('Button md/lg keep their unchanged 44/52 visual heights', () => {
    const buttonSource = read('Button.tsx');
    const tokensSource = readFileSync(
      join(__dirname, '..', 'core', 'theme', 'designTokens.ts'),
      'utf8',
    );
    // The heights live in the token layer; Button wires them by role.
    expect(tokensSource).toMatch(/buttonHeight: 44/);
    expect(tokensSource).toMatch(/buttonHeightLg: 52/);
    expect(buttonSource).toMatch(/md:\s*\{\s*height:\s*size\.buttonHeight/);
    expect(buttonSource).toMatch(/lg:\s*\{\s*height:\s*size\.buttonHeightLg/);
    // Only the compact size carries slop; md/lg are >=44 already.
    expect(buttonSource).toMatch(/sizeRole === 'sm'[\s\S]{0,120}:\s*undefined/);
  });

  it('Button keeps the disabled/loading accessibility state contract', () => {
    const source = read('Button.tsx');
    expect(source).toMatch(/accessibilityState=\{\{ disabled: inactive, busy: loading \}\}/);
    expect(source).toMatch(/const inactive = disabled \|\| loading;/);
  });

  it('PillChip face stays 40 with vertical hitSlop reaching 44', () => {
    const source = read('PillChip.tsx');
    expect(source).toMatch(/minHeight: 40/);
    expect(source).toMatch(/hitSlop=\{\{\s*top:\s*2,\s*bottom:\s*2\s*\}\}/);
  });

  it('SegmentedControl segments stay 36 with vertical-only hitSlop reaching 44', () => {
    const source = read('SegmentedControl.tsx');
    expect(source).toMatch(/minHeight: 36/);
    expect(source).toMatch(/hitSlop=\{\{\s*top:\s*4,\s*bottom:\s*4\s*\}\}/);
    // Vertical-only: no horizontal slop between adjacent segments.
    expect(source).not.toMatch(/hitSlop=\{\{[^}]*left/);
  });

  it('IconButton keeps a 44x44 target (h-11 w-11)', () => {
    const source = read('IconButton.tsx');
    expect(source).toMatch(/h-11 w-11/);
  });
});
