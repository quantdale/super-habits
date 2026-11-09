import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The repo has no RN component render harness. These narrow architecture pins
// complement todos-convergence.spec.ts, which measures real geometry and
// proves windowing, recycling, visible-id selection, and durable mutations.
const root = join(__dirname, '..');
const screen = readFileSync(join(root, 'features/todos/TodosScreen.tsx'), 'utf8');
const row = readFileSync(join(root, 'features/todos/TodoItem.tsx'), 'utf8');

describe('W6.5 Todo list contracts', () => {
  it('keeps compact expanding rows and full-sized completion/more controls', () => {
    expect(row).toMatch(/paddingVertical: 3/);
    expect(row).toMatch(/targetSize = size\.touchTargetMin/);
    expect(row).toMatch(/width: targetSize,\s*height: targetSize/);
    expect(row).toContain('h-11 w-11');
    // No title line clamp or fixed row height; body height grows with content.
    expect(row).not.toContain('numberOfLines={2}');
    expect(row).not.toMatch(/height:\s*(48|5[0-6])/);
  });

  it('uses a bounded grouped virtualized path rather than eager query/selection ScrollViews', () => {
    expect(screen).toContain('selectionMode || queryActive || showCompleted');
    expect(screen).toContain('<SectionList');
    expect(screen).toContain('sections={listSections}');
    expect(screen).toContain('extraData={groupedExtraData}');
    // The grouped rows' refresh marker must keep the W6.5 selection signal and
    // add the local day key so "today"-derived row meta re-renders across a
    // local-midnight rollover.
    expect(screen).toContain('groupedExtraData = useMemo(() => ({ selectedIds, todayKey })');
    expect(screen).toContain('windowSize={5}');
    expect(screen).not.toContain('ScrollView');
    expect(screen).not.toContain('groupItems.map');
  });

  it('makes completed history item data, not an unbounded mapped footer tree', () => {
    expect(screen).toContain("key: 'completed'");
    expect(screen).toContain('data: completedTasks.filter');
    expect(screen).not.toContain('completedTasks.map');
    expect(screen).toContain('ListFooterComponent={completedDisclosure}');
    expect(screen).toContain('renderItem={renderGroupedTodoItem}');
  });

  it('retains manual drag and rejects subset, duplicate, and non-manual order writes', () => {
    expect(screen).toContain('<DraggableFlatList');
    expect(screen).toContain('data.length === pendingTasks.length');
    expect(screen).toContain('new Set(data.map((item) => item.id)).size === pendingTasks.length');
    expect(screen).toContain('data.every((item) => pendingIdSet.has(item.id))');
    expect(screen).toContain('if (!canReorderManually || !isFullPendingList) return;');
  });

  it('uses the global theme accent for planning capture, not Health identity', () => {
    // P19 moved the destination-hue table beside the tile picker (the mode →
    // section translation lives in `captureType.mode.ts`); the CONTRACT is
    // unchanged: planning destinations resolve the global theme accent, and
    // the sheet never adopts the Health identity hue.
    const capture = readFileSync(
      join(root, 'features/quick-capture/QuickCaptureOverlay.tsx'),
      'utf8',
    );
    const modeMap = readFileSync(join(root, 'features/quick-capture/captureType.mode.ts'), 'utf8');
    // Planning (no section) → the theme accent, never a section hue.
    expect(modeMap).toContain(
      'return { fill: tokens.primaryBright, text: tokens.accent, lip: tokens.buttonLip };',
    );
    expect(modeMap).toMatch(/project: null,\s*goal: null,/);
    // The overlay delegates the destination hue to the picker instead of
    // hard-coding a per-mode accent table of its own.
    expect(capture).toContain("import { CaptureTypePicker } from './CaptureTypePicker';");
    expect(capture).toContain(
      '<CaptureTypePicker modes={MODES} selected={mode} onSelect={switchMode} />',
    );
    expect(capture).not.toContain('SECTION_COLORS.health');
    expect(modeMap).not.toContain('SECTION_COLORS.health');
  });
});
