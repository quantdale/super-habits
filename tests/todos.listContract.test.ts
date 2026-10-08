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
    expect(screen).toContain('extraData={selectedIds}');
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
    const capture = readFileSync(
      join(root, 'features/quick-capture/QuickCaptureOverlay.tsx'),
      'utf8',
    );
    expect(capture).toContain('MODE_ACCENT[mode] ?? tokens.accent');
    expect(capture).toContain('MODE_ACCENT[m.key] ?? tokens.accent');
    expect(capture).not.toContain('SECTION_COLORS.health');
  });
});
